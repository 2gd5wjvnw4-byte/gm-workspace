import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { THEMES, TOKEN_KEYS, useThemeStore } from './store/themeStore';
import { useCampaignStore } from './store/campaignStore';
import { createDefaultLiveState, db } from './storage';

const samplePath = resolve(process.cwd(), 'samples/silent-relay-a1.json');
const sampleRawText = readFileSync(samplePath, 'utf-8');

function seedOpenCampaign() {
  useCampaignStore.getState().setActiveLoadedCampaign({
    campaign: {
      id: 'camp-test',
      moduleId: 'mod-silent-relay',
      title: 'The Silent Relay',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
      updatedAt: 1000,
    },
    chunks: [],
    live: createDefaultLiveState('camp-test', 'scifi'),
  });
}

describe('GM Workspace App Shell, Themes, Campaigns, and Import UI', () => {
  beforeEach(async () => {
    await db.campaigns.clear();
    await db.chunks.clear();
    await db.live.clear();
    await db.blobs.clear();
    useCampaignStore.getState().closeCampaign();
    await useCampaignStore.getState().refreshCampaigns();
    useThemeStore.getState().setTheme('scifi');
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1366,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('defines all 35 color tokens and 3 font tokens for all 3 themes', () => {
    expect(TOKEN_KEYS).toHaveLength(38);
    for (const themeKey of ['scifi', 'fantasy', 'fantasyDark'] as const) {
      const theme = THEMES[themeKey];
      for (const token of TOKEN_KEYS) {
        expect(theme[token]).toBeTruthy();
      }
    }
    expect(THEMES.scifi.bg).toBe('#0D1117');
    expect(THEMES.fantasy.bg).toBe('#EFE6D4');
    expect(THEMES.fantasyDark.bg).toBe('#15120E');
  });

  it('renders the five layout zones and switches themes via RightPanel buttons when a campaign is open', () => {
    seedOpenCampaign();
    render(<App />);

    expect(screen.getByTestId('zone-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('zone-left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('zone-center')).toBeInTheDocument();
    expect(screen.getByTestId('zone-exits-bar')).toBeInTheDocument();
    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    expect(screen.getByTestId('zone-drawer-host')).toBeInTheDocument();

    const fantasyBtn = screen.getByRole('button', { name: 'Fantasy Light' });
    fireEvent.click(fantasyBtn);

    expect(fantasyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#EFE6D4');
    expect(document.documentElement.style.getPropertyValue('--head')).toContain('Cinzel');

    const fantasyDarkBtn = screen.getByRole('button', { name: 'Fantasy Dark' });
    fireEvent.click(fantasyDarkBtn);

    expect(fantasyDarkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#15120E');
  });

  it('collapses RightPanel to a 56px rail at 1180x820 and opens overlay on tap', () => {
    seedOpenCampaign();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1180,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 820,
    });

    render(<App />);
    const rail = screen.getByTestId('zone-right-rail');
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveStyle({ width: '56px' });

    const openThemeBtn = screen.getByRole('button', { name: 'Open Scratchpad and Theme' });
    fireEvent.click(openThemeBtn);

    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fantasy Light' })).toBeInTheDocument();
  });

  it('shows dismissible standalone amber banner when not running standalone', () => {
    const persistSpy = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window.navigator, 'storage', {
      value: { persist: persistSpy },
      configurable: true,
    });

    render(<App />);
    expect(persistSpy).toHaveBeenCalled();

    const banner = screen.getByTestId('standalone-banner');
    expect(banner).toHaveTextContent(
      'Add GM Workspace to your Home Screen so iPad keeps your data.'
    );

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss Home Screen reminder' });
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId('standalone-banner')).not.toBeInTheDocument();
  });

  it('applies safe-area-inset-top padding on app-root and 28px minimum in standalone mode', () => {
    seedOpenCampaign();
    render(<App />);
    const root = screen.getByTestId('app-root');
    expect(root.style.paddingTop).toContain('env(safe-area-inset-top');

    const topBar = screen.getByTestId('zone-topbar');
    expect(topBar.style.alignItems).toBe('flex-end');
    expect(topBar.style.paddingBottom).toBe('4px');
  });

  it('shows Campaign screen when no campaign is open, creates and opens a campaign, imports sample and broken JSON, shows Review sheet, and exports carry-over IDs', async () => {
    render(<App />);

    // Campaign screen is shown initially
    expect(screen.getByTestId('campaign-screen')).toBeInTheDocument();
    expect(screen.getByTestId('empty-campaigns')).toBeInTheDocument();

    // Create a new campaign via in-app modal
    fireEvent.click(screen.getByTestId('new-campaign-btn'));
    expect(screen.getByTestId('new-campaign-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('new-campaign-title-input'), {
      target: { value: 'The Silent Relay' },
    });
    fireEvent.click(screen.getByTestId('create-campaign-submit'));

    // Workspace opens with 0 review items (Review button hidden)
    await waitFor(() => {
      expect(screen.getByTestId('zone-topbar')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('review-btn')).not.toBeInTheDocument();

    // Open Act switcher sheet and import sample JSON
    fireEvent.click(screen.getByTestId('act-switcher-btn'));
    expect(screen.getByTestId('act-switcher-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('no-chunks-msg')).toBeInTheDocument();

    const fileInput = screen.getByTestId('import-json-input');
    const sampleFile = new File([sampleRawText], 'silent-relay-a1.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput, { target: { files: [sampleFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('chunk-row-chunk-a1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('chunk-badge-chunk-a1')).toHaveTextContent('Complete');

    // Export carry-over IDs
    fireEvent.click(screen.getByTestId('export-carry-over-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('carry-over-output')).toHaveTextContent('e-okafor: Chief Dana Okafor');
    });

    // Close Act sheet and verify Review button shows "Review 1" (the needs_review info item on a1-s02)
    fireEvent.click(screen.getByTestId('close-act-sheet-btn'));
    const reviewBtn = screen.getByTestId('review-btn');
    expect(reviewBtn).toHaveTextContent('Review 1');

    // Open Review sheet and check grouped entry details
    fireEvent.click(reviewBtn);
    expect(screen.getByTestId('review-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('review-group-chunk-a1')).toBeInTheDocument();
    expect(screen.getByTestId('review-entry-severity')).toHaveTextContent('info');
    expect(screen.getByTestId('review-entry-record')).toHaveTextContent('a1-s02');
    expect(screen.getByTestId('review-entry-field')).toHaveTextContent('needs_review');
    fireEvent.click(screen.getByTestId('close-review-sheet-btn'));

    // Re-open Act sheet, import a broken chunk, and verify warning entries in Review sheet
    fireEvent.click(screen.getByTestId('act-switcher-btn'));
    const brokenChunkObj = JSON.parse(sampleRawText) as Record<string, unknown>;
    (brokenChunkObj.meta as Record<string, unknown>).chunk_id = 'chunk-broken';
    (brokenChunkObj.meta as Record<string, unknown>).chunk_title = 'Broken Act';
    (brokenChunkObj.meta as Record<string, unknown>).complete = false;
    (brokenChunkObj.meta as Record<string, unknown>).stopped_at_page = 15;
    (brokenChunkObj.scenes as Array<Record<string, unknown>>)[0].archetype = 'bad_archetype';

    const brokenFile = new File([JSON.stringify(brokenChunkObj)], 'broken.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByTestId('import-json-input'), {
      target: { files: [brokenFile] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('chunk-row-chunk-broken')).toBeInTheDocument();
    });
    expect(screen.getByTestId('chunk-badge-chunk-broken')).toHaveTextContent('Incomplete');
    expect(screen.getByTestId('chunk-incomplete-banner-chunk-broken')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-act-sheet-btn'));
    expect(screen.getByTestId('review-btn')).not.toHaveTextContent('Review 1');

    // Re-open Act sheet, remove chunks, and return to All campaigns
    fireEvent.click(screen.getByTestId('act-switcher-btn'));
    fireEvent.click(screen.getByTestId('remove-chunk-chunk-broken'));
    await waitFor(() => {
      expect(screen.queryByTestId('chunk-row-chunk-broken')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('remove-chunk-chunk-a1'));
    await waitFor(() => {
      expect(screen.getByTestId('no-chunks-msg')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('switch-campaign-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('campaign-screen')).toBeInTheDocument();
    });

    // Campaign appears in the list and can be opened again
    const openBtn = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(openBtn);
    await waitFor(() => {
      expect(screen.getByTestId('zone-topbar')).toBeInTheDocument();
    });
  });

  it('does not resurrect a closed campaign when in-flight removeChunk or importJsonChunk resolves after closeCampaign or campaign switch, and settles concurrent chunk removals', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Race Test Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    expect(useCampaignStore.getState().chunks).toHaveLength(1);

    // Fire removeChunk without awaiting, then immediately close the campaign
    const pendingRemove = useCampaignStore.getState().removeChunk('chunk-a1');
    useCampaignStore.getState().closeCampaign();
    expect(useCampaignStore.getState().activeCampaign).toBeNull();

    await pendingRemove;
    // Closed campaign must remain closed (null), never resurrected
    expect(useCampaignStore.getState().activeCampaign).toBeNull();

    // Re-open, fire importJsonChunk without awaiting, then immediately close the campaign
    const campId = useCampaignStore.getState().campaigns[0].id;
    await useCampaignStore.getState().openCampaign(campId);
    expect(useCampaignStore.getState().activeCampaign?.id).toBe(campId);

    const pendingImport = useCampaignStore.getState().importJsonChunk(sampleRawText);
    useCampaignStore.getState().closeCampaign();
    expect(useCampaignStore.getState().activeCampaign).toBeNull();

    await pendingImport;
    expect(useCampaignStore.getState().activeCampaign).toBeNull();

    // Switch campaign while remove is in-flight: should not overwrite active campaign
    const camp2 = await useCampaignStore.getState().createNewCampaign({
      title: 'Campaign 2',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    expect(useCampaignStore.getState().activeCampaign?.id).toBe(camp2.campaign.id);

    const pendingRemoveFromCamp2 = useCampaignStore.getState().removeChunk('chunk-a1');
    await useCampaignStore.getState().openCampaign(campId);
    expect(useCampaignStore.getState().activeCampaign?.id).toBe(campId);

    await pendingRemoveFromCamp2;
    expect(useCampaignStore.getState().activeCampaign?.id).toBe(campId);

    // Concurrent chunk removals settle cleanly without race conditions
    const brokenChunkObj = JSON.parse(sampleRawText) as Record<string, unknown>;
    (brokenChunkObj.meta as Record<string, unknown>).chunk_id = 'chunk-broken';
    (brokenChunkObj.meta as Record<string, unknown>).chunk_title = 'Broken Act';
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    await useCampaignStore.getState().importJsonChunk(JSON.stringify(brokenChunkObj));
    expect(useCampaignStore.getState().chunks).toHaveLength(2);

    await Promise.all([
      useCampaignStore.getState().removeChunk('chunk-a1'),
      useCampaignStore.getState().removeChunk('chunk-broken'),
    ]);
    expect(useCampaignStore.getState().chunks).toHaveLength(0);
  });

  it('deletes a campaign from the All Campaigns screen via the in-app confirmation modal', async () => {
    const created = await useCampaignStore.getState().createNewCampaign({
      title: 'Campaign To Delete',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    const campId = created.campaign.id;
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    useCampaignStore.getState().closeCampaign();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId(`campaign-row-${campId}`)).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId(`delete-campaign-${campId}`);
    expect(deleteBtn).toHaveStyle({ height: '44px' });

    // Open delete confirmation modal and cancel first
    fireEvent.click(deleteBtn);
    const modal = screen.getByTestId('delete-campaign-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('Campaign To Delete');

    fireEvent.click(screen.getByTestId('cancel-delete-campaign'));
    expect(screen.queryByTestId('delete-campaign-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId(`campaign-row-${campId}`)).toBeInTheDocument();

    // Open delete confirmation modal again and confirm delete
    fireEvent.click(screen.getByTestId(`delete-campaign-${campId}`));
    expect(screen.getByTestId('delete-campaign-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete-campaign'));

    await waitFor(() => {
      expect(screen.queryByTestId(`campaign-row-${campId}`)).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('delete-campaign-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-campaigns')).toBeInTheDocument();

    // Verify campaign, chunks, and live state are gone from IndexedDB
    expect(await db.campaigns.get(campId)).toBeUndefined();
    expect(await db.chunks.where('campaignId').equals(campId).count()).toBe(0);
    expect(await db.live.get(campId)).toBeUndefined();
  });

  it('walks scenes 1 -> 2 -> 3 -> 4, reveals items to unlock exits, adds/edits/deletes table notes, overrides connection states, and masks items/scenes/exits in Solo Mask mode', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'The Silent Relay',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);

    // Starts at Scene 1: Docking Ring (physical_zone)
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Docking Ring');
    expect(screen.getByTestId('scene-header-code')).toHaveTextContent('a1-s01 · #1');
    expect(screen.getByTestId('scene-archetype-chip')).toHaveTextContent('Physical Zone');
    expect(screen.getByTestId('tier1-heading')).toHaveTextContent('TIER 1 · Sensory');
    expect(screen.getByTestId('tier2-heading')).toHaveTextContent('TIER 2 · Interactive');
    expect(screen.getByTestId('tier3-heading')).toHaveTextContent(
      'TIER 3 · Hidden Threats & Loot'
    );
    expect(screen.getByTestId('exits-bar-label')).toHaveTextContent('Exits');
    expect(screen.getByTestId('read-aloud-pointer')).toHaveTextContent(
      'p.6 — starts: “Your ship locks onto the…”'
    );
    expect(screen.getByTestId('read-aloud-open-pdf-btn')).toBeInTheDocument();

    // Scene 1 exit a1-x01 starts sealed (disabled)
    const exitX01 = screen.getByTestId('exit-btn-a1-x01');
    expect(exitX01).toBeDisabled();
    expect(exitX01).toHaveTextContent('Sealed');

    // Scene list shows a1-s01 as Here, a1-s02..04 as New, and unloaded a2-s01 as Not loaded
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('Here');
    expect(screen.getByTestId('scene-status-a1-s02')).toHaveTextContent('New');
    expect(screen.getByTestId('scene-row-a2-s01')).toBeDisabled();
    expect(screen.getByTestId('scene-status-a2-s01')).toHaveTextContent('Not loaded');

    // Toggle Solo Mask ON at Scene 1 before revealing airlock panel
    const soloToggle = screen.getByTestId('solo-mask-toggle');
    fireEvent.click(soloToggle);
    expect(soloToggle).toHaveAttribute('aria-pressed', 'true');
    expect(soloToggle).toHaveTextContent('Solo');

    // In Solo Mode at Scene 1 with sealed exit: a1-s02, a1-s03, a1-s04 are unvisited and unreachable -> hidden from Scene List
    expect(screen.queryByTestId('scene-row-a1-s02')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene-row-a1-s03')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene-row-a1-s04')).not.toBeInTheDocument();

    // Tier 2 item result is hidden in Solo Mode until revealed; Tier 3 item is masked as "Something is hidden here"
    expect(screen.queryByTestId('item-result-a1-s01-i1')).not.toBeInTheDocument();
    expect(screen.getByTestId('item-hidden-hint-a1-s01-i1')).toHaveTextContent(
      'Result hidden. Roll, then tap Reveal.'
    );
    expect(screen.getByTestId('item-card-a1-s01-h1')).toHaveTextContent(
      'Something is hidden here'
    );
    expect(screen.queryByTestId('item-result-a1-s01-h1')).not.toBeInTheDocument();

    // Reveal Airlock control panel (a1-s01-i1) -> unlocks a1-x01!
    fireEvent.click(screen.getByTestId('reveal-btn-a1-s01-i1'));
    expect(screen.getByTestId('item-result-a1-s01-i1')).toHaveTextContent(
      'The panel accepts a manual override. The hab airlock opens.'
    );
    expect(screen.getByTestId('exit-btn-a1-x01')).not.toBeDisabled();
    expect(screen.getByTestId('exit-btn-a1-x01')).toHaveTextContent('Open');

    // Now a1-s02 is reachable in Solo Mode -> shown in Scene List as "???"
    expect(screen.getByTestId('scene-row-a1-s02')).toHaveTextContent('???');

    // Walk to Scene 2 via exit button
    fireEvent.click(screen.getByTestId('exit-btn-a1-x01'));
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Hab Ring Concourse');
    expect(screen.getByTestId('scene-archetype-chip')).toHaveTextContent('Open Hub');
    expect(screen.getByTestId('scene-needs-review-chip')).toHaveTextContent('Needs review');
    expect(screen.getByTestId('exits-bar-label')).toHaveTextContent('Go To');

    // Scene 2 is now visited, so its real title shows in Scene List; Scene 3 is now reachable -> shown as "???"
    expect(screen.getByTestId('scene-row-a1-s02')).toHaveTextContent('Hab Ring Concourse');
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('Visited');
    expect(screen.getByTestId('scene-status-a1-s02')).toHaveTextContent('Here');
    expect(screen.getByTestId('scene-row-a1-s03')).toHaveTextContent('???');

    // Walk to Scene 3 via open exit a1-x02
    fireEvent.click(screen.getByTestId('exit-btn-a1-x02'));
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Operations Center');
    expect(screen.getByTestId('scene-archetype-chip')).toHaveTextContent('Investigation');
    expect(screen.getByTestId('exits-bar-label')).toHaveTextContent('Follow Leads');

    // In Scene 3 with Solo Mask ON, hidden exit a1-x03 is masked as "???" and disabled
    const exitX03 = screen.getByTestId('exit-btn-a1-x03');
    expect(exitX03).toBeDisabled();
    expect(exitX03).toHaveTextContent('???');
    expect(exitX03).toHaveTextContent('Unrevealed');

    // Reveal the terminal (a1-s03-i1) -> unlocks hidden exit a1-x03 to Scene 4
    fireEvent.click(screen.getByTestId('reveal-btn-a1-s03-i1'));
    expect(screen.getByTestId('exit-btn-a1-x03')).not.toBeDisabled();
    expect(screen.getByTestId('exit-btn-a1-x03')).toHaveTextContent(
      'Reactor alarm: run for the pods'
    );
    expect(screen.getByTestId('exit-btn-a1-x03')).toHaveTextContent('Open');

    // Walk to Scene 4 via newly opened exit a1-x03
    fireEvent.click(screen.getByTestId('exit-btn-a1-x03'));
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Reactor Spine Chase');
    expect(screen.getByTestId('scene-archetype-chip')).toHaveTextContent('Action Stage');
    expect(screen.getByTestId('exits-bar-label')).toHaveTextContent('Outcomes');
    expect(screen.getByTestId('scene-escalation-section')).toHaveTextContent('Round 1');
    expect(screen.getByTestId('scene-gm-tip')).toHaveTextContent('Use range bands');

    // Unloaded exit a1-x04 to a2-s01 is disabled and marked Not loaded
    expect(screen.getByTestId('exit-btn-a1-x04')).toBeDisabled();
    expect(screen.getByTestId('exit-btn-a1-x04')).toHaveTextContent('Not loaded');

    // Add a table note via the top-anchored Add note / override modal
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    const modal = screen.getByTestId('note-override-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.style.alignItems).toBe('flex-start');

    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Coolant pipe already ruptured.' },
    });
    fireEvent.click(screen.getByTestId('save-note-btn'));

    // Table change banner shows above read-aloud
    const banner = screen.getByTestId('table-change-banner');
    expect(banner).toHaveTextContent('TABLE CHANGE');
    expect(banner).toHaveTextContent('Coolant pipe already ruptured.');

    // Tap the note in the banner to edit it, then delete it
    const noteButtons = banner.querySelectorAll('button');
    fireEvent.click(noteButtons[0]);
    expect(screen.getByTestId('note-override-modal')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Coolant pipe patched by crew.' },
    });
    fireEvent.click(screen.getByTestId('save-note-btn'));
    expect(screen.getByTestId('table-change-banner')).toHaveTextContent(
      'Coolant pipe patched by crew.'
    );

    // Reopen note and delete
    fireEvent.click(
      screen.getByTestId('table-change-banner').querySelectorAll('button')[0]
    );
    fireEvent.click(screen.getByTestId('delete-note-btn'));
    expect(screen.queryByTestId('table-change-banner')).not.toBeInTheDocument();

    // Test connection state override from the modal
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.click(screen.getByTestId('conn-override-a1-x03-locked'));
    fireEvent.click(screen.getByTestId('close-note-modal-btn'));
    expect(useCampaignStore.getState().live?.connectionState['a1-x03']).toBe('locked');
  });
});
