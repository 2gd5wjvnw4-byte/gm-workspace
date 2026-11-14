import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RightPanel } from './components/RightPanel';
import { useCampaignStore } from './store/campaignStore';
import { createDefaultLiveState } from './storage/types';
import { mergeRawChunkObjects } from './lib/import';
import sampleJson from '../samples/silent-relay-a1.json';

function seedSampleCampaign(soloMask = false) {
  const merged = mergeRawChunkObjects([sampleJson as Record<string, unknown>]);
  const live = createDefaultLiveState('camp-1', 'scifi');
  live.currentSceneId = 'a1-s01';
  live.ui.soloMask = soloMask;

  useCampaignStore.setState({
    activeCampaign: {
      id: 'camp-1',
      moduleId: 'silent-relay',
      title: 'The Silent Relay',
      system: 'Generic',
      genre: 'sci-fi',
      updatedAt: Date.now(),
      lastBackupAt: null,
    },
    chunks: [],
    live,
    merged,
    loading: false,
    errorMessage: null,
  });
}

describe('RightPanel Phase 5 sections', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1366,
    });
    seedSampleCampaign(false);
  });

  it('renders all 7 sections in order and toggles collapse on header tap', () => {
    render(<RightPanel />);
    const panel = screen.getByTestId('zone-right-panel');
    const sections = panel.querySelectorAll('section[data-testid^="section-"]');
    expect(Array.from(sections).map((s) => s.getAttribute('data-testid'))).toEqual([
      'section-clocks',
      'section-timeline',
      'section-clue-matrix',
      'section-factions',
      'section-random-tables',
      'section-scratchpad',
      'section-theme',
    ]);

    const clocksHeader = within(screen.getByTestId('section-clocks')).getByRole('button', {
      name: /CLOCKS/i,
    });
    expect(clocksHeader.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(clocksHeader);
    expect(clocksHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('advances/rewinds clocks, shows gold when_full banner, filters by act scope, and masks hidden clocks in Solo', () => {
    const baseMerged = useCampaignStore.getState().merged;
    useCampaignStore.setState({
      merged: {
        ...baseMerged,
        clocks: [
          ...baseMerged.clocks,
          {
            id: 'c-hidden-act',
            name: 'Secret Counter',
            segments: 4,
            start: 1,
            when_full: 'Secret triggers',
            hidden: true,
            scope: 'global',
          },
          {
            id: 'c-other-act',
            name: 'Act 2 Clock',
            segments: 4,
            start: 0,
            when_full: 'Act 2 boom',
            hidden: false,
            scope: 'a2',
          },
        ],
      },
    });

    render(<RightPanel />);

    // Scope filter hides a2 clock when current scene is in a1
    expect(screen.queryByTestId('clock-card-c-other-act')).toBeNull();
    expect(screen.getByTestId('clock-card-k-reactor')).toBeTruthy();

    // Advance Reactor Meltdown from 0/6 to 6/6
    const advanceBtn = screen.getByRole('button', { name: 'Advance Reactor Meltdown clock' });
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(advanceBtn);
    }
    expect(useCampaignStore.getState().live?.clockValues['k-reactor']).toBe(6);
    expect(screen.getByTestId('clock-full-banner-k-reactor').textContent).toContain(
      'The reactor explodes'
    );

    // Rewind 1 segment
    const reactorCard = screen.getByTestId('clock-card-k-reactor');
    fireEvent.click(within(reactorCard).getByRole('button', { name: 'Rewind' }));
    expect(useCampaignStore.getState().live?.clockValues['k-reactor']).toBe(5);
    expect(screen.queryByTestId('clock-full-banner-k-reactor')).toBeNull();

    // Solo Mask hides segments on hidden: true clock
    act(() => {
      useCampaignStore.getState().setSoloMask(true);
    });
    const hiddenCard = screen.getByTestId('clock-card-c-hidden-act');
    expect(hiddenCard.textContent).toContain('?/4');
    expect(hiddenCard.textContent).toContain('Segments hidden in Solo mode.');
  });

  it('highlights timeline events when Day tracker >= event day, toggles done/reveal, and jumps to scene_id', () => {
    render(<RightPanel />);
    const rescueCard = screen.getByTestId('timeline-card-ev-rescue-ship');
    expect(rescueCard.getAttribute('data-highlighted')).toBe('false');

    // Increase Day tracker (tr-day starts at 1) to 3
    act(() => {
      useCampaignStore.getState().adjustTrackerValue('tr-day', 2, 1, 10);
    });
    expect(screen.getByTestId('timeline-card-ev-rescue-ship').getAttribute('data-highlighted')).toBe(
      'true'
    );

    // Mark done
    fireEvent.click(within(rescueCard).getByRole('button', { name: 'Mark done' }));
    expect(useCampaignStore.getState().live?.timelineDone['ev-rescue-ship']).toBe(true);

    // Jump to scene_id (a1-s01)
    act(() => {
      useCampaignStore.getState().goToScene('a1-s02');
    });
    fireEvent.click(within(rescueCard).getByRole('button', { name: /Go to:/i }));
    expect(useCampaignStore.getState().live?.currentSceneId).toBe('a1-s01');

    // Solo Mask masks hidden timeline event until Reveal
    act(() => {
      useCampaignStore.getState().setSoloMask(true);
    });
    expect(screen.getByTestId('timeline-card-ev-rescue-ship').textContent).toContain(
      'Hidden event. Tap Reveal when it happens.'
    );
    fireEvent.click(
      within(screen.getByTestId('timeline-card-ev-rescue-ship')).getByRole('button', {
        name: 'Reveal',
      })
    );
    expect(useCampaignStore.getState().live?.revealed['ev-rescue-ship']).toBe(true);
  });

  it('updates Clue Matrix on reveal, masks answer in Solo, warns on core truths with < 2 clues, and jumps/opens inspector', () => {
    seedSampleCampaign(true);
    const onOpenEntityInspector = vi.fn();
    render(<RightPanel onOpenEntityInspector={onOpenEntityInspector} />);

    // Sample has t-sabotage (core, 2 clues) and t-signal (optional, 1 clue); also add a core truth with 1 clue to verify warning
    const baseMerged = useCampaignStore.getState().merged;
    act(() => {
      useCampaignStore.setState({
        merged: {
          ...baseMerged,
          truths: [
            ...baseMerged.truths,
            {
              id: 't-core-one',
              title: 'Core single clue truth',
              text: 'Only one clue points here.',
              importance: 'core',
              scope: 'global',
              page: 1,
            },
          ],
        },
      });
    });

    expect(screen.getByTestId('truth-warning-t-core-one').textContent).toBe('1 clue only');

    const sabotageCard = screen.getByTestId('truth-card-t-sabotage');
    expect(sabotageCard.textContent).toContain('Answer hidden until a clue is found.');

    // Reveal terminal clue (a1-s03-i1) and Okafor's clue (e-okafor-c1)
    act(() => {
      useCampaignStore.getState().toggleRevealedItem('a1-s03-i1');
    });
    expect(screen.getByTestId('truth-card-t-sabotage').textContent).toContain('Found 1/2');
    expect(screen.getByTestId('truth-card-t-sabotage').textContent).not.toContain(
      'Answer hidden until a clue is found.'
    );

    act(() => {
      useCampaignStore.getState().toggleRevealedItem('e-okafor-c1');
    });
    expect(screen.getByTestId('truth-card-t-sabotage').textContent).toContain('Found 2/2');

    // Tapping scene clue jumps to scene; tapping entity clue opens entity inspector
    fireEvent.click(
      within(screen.getByTestId('truth-card-t-sabotage')).getByRole('button', {
        name: /Backup log terminal/i,
      })
    );
    expect(useCampaignStore.getState().live?.currentSceneId).toBe('a1-s03');

    fireEvent.click(
      within(screen.getByTestId('truth-card-t-sabotage')).getByRole('button', {
        name: /Chief Dana Okafor/i,
      })
    );
    expect(onOpenEntityInspector).toHaveBeenCalledWith('e-okafor');
  });

  it('cycles faction attitude and masks faction secret in Solo', () => {
    seedSampleCampaign(true);
    render(<RightPanel />);

    const factionCard = screen.getByTestId('faction-card-f-helix');
    expect(factionCard.textContent).toContain('Hidden in Solo mode.');

    const attitudeBtn = within(factionCard).getByRole('button', { name: 'neutral' });
    fireEvent.click(attitudeBtn);
    expect(useCampaignStore.getState().live?.factionAttitude['f-helix']).toBe('suspicious');
  });

  it('rolls Random Tables, caps roll log at 50 and shows 10, summons entity_id, and falls back to plain list when unparseable', () => {
    const baseMerged = useCampaignStore.getState().merged;
    useCampaignStore.setState({
      merged: {
        ...baseMerged,
        random_tables: [
          ...baseMerged.random_tables,
          {
            id: 'rt-plain',
            name: 'Unparseable Table',
            dice: 'custom',
            entries: [{ range: 'x', text: 'Plain entry only', entity_id: null }],
            scope: 'global',
            page: 1,
          },
        ],
      },
    });

    render(<RightPanel />);

    // Unparseable table has no Roll button and shows its plain list
    const plainCard = screen.getByTestId('random-table-rt-plain');
    expect(within(plainCard).queryByRole('button', { name: 'Roll' })).toBeNull();
    expect(plainCard.textContent).toContain('Plain entry only');

    // Roll Relay Encounters 55 times -> store caps at 50, UI displays last 10
    const relayCard = screen.getByTestId('random-table-rt-relay');
    const rollBtn = within(relayCard).getByRole('button', { name: 'Roll' });
    for (let i = 0; i < 55; i += 1) {
      fireEvent.click(rollBtn);
    }
    expect(useCampaignStore.getState().live?.rollLog.length).toBe(50);
    expect(screen.getByRole('button', { name: /Roll log \(10\)/i })).toBeTruthy();

    // If the latest roll has an entity_id, Add to scene summons it
    const addBtn = within(relayCard).queryByRole('button', { name: 'Add to scene' });
    if (addBtn) {
      fireEvent.click(addBtn);
      const summoned = useCampaignStore.getState().live?.summoned['a1-s01'] ?? [];
      expect(summoned.length).toBeGreaterThan(0);
    }
  });

  it('shows Last backup: Never and lets user expand and delete Loose Notes', () => {
    useCampaignStore.setState((s) => ({
      live: s.live
        ? {
            ...s.live,
            looseNotes: [
              { id: 'ln-1', targetId: 'old-scene', text: 'Orphaned clue note', createdAt: 1 },
            ],
          }
        : null,
    }));

    render(<RightPanel />);
    expect(screen.getByTestId('last-backup-label').textContent).toBe('Last backup: Never');

    fireEvent.click(screen.getByTestId('loose-notes-toggle'));
    expect(screen.getByTestId('loose-note-ln-1').textContent).toContain('Orphaned clue note');

    fireEvent.click(
      within(screen.getByTestId('loose-note-ln-1')).getByRole('button', { name: /Delete/i })
    );
    expect(useCampaignStore.getState().live?.looseNotes).toHaveLength(0);
  });
});
