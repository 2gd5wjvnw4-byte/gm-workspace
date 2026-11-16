import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App';
import { THEMES, TOKEN_KEYS, useThemeStore } from './store/themeStore';
import { useCampaignStore } from './store/campaignStore';
import { createDefaultLiveState, db, exportBackup, getBlob, pdfBlobKey } from './storage';
import * as pdfLib from './lib/pdf';

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

  it('defines all 35 color tokens and 3 font tokens for all 4 themes', () => {
    expect(TOKEN_KEYS).toHaveLength(38);
    for (const themeKey of ['scifi', 'fantasy', 'fantasyDark', 'warmPaper'] as const) {
      const theme = THEMES[themeKey];
      for (const token of TOKEN_KEYS) {
        expect(theme[token]).toBeTruthy();
      }
    }
    expect(THEMES.scifi.bg).toBe('#0D1117');
    expect(THEMES.fantasy.bg).toBe('#EFE6D4');
    expect(THEMES.fantasyDark.bg).toBe('#15120E');
    expect(THEMES.warmPaper.bg).toBe('#F9F7F2');
  });

  it('renders the five layout zones and switches themes via RightPanel buttons when a campaign is open', () => {
    seedOpenCampaign();
    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

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

    const warmPaperBtn = screen.getByRole('button', { name: 'Warm Paper' });
    fireEvent.click(warmPaperBtn);

    expect(warmPaperBtn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('warmPaper');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#F9F7F2');
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
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

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

    // Add a table note via the top-anchored Add note / override modal (auto-saves on outside tap)
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    const modal = screen.getByTestId('note-override-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.style.alignItems).toBe('flex-start');
    expect(screen.queryByTestId('save-note-btn')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Coolant pipe already ruptured.' },
    });
    // Close by tapping outside the modal card
    fireEvent.click(screen.getByTestId('note-override-modal'));

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
    // Close by tapping outside — edited note auto-saves
    fireEvent.click(screen.getByTestId('note-override-modal'));
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

  it('toggles non-current scene visited status, keeps left panel tabs fixed above scroll area, and closes right panel overlay and note modal on outside tap', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'The Silent Relay',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    // Render at compact width (1180x820) so RightPanel uses the rail + overlay
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
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

    // 1. Left panel tabs are fixed outside the scrolling container
    const leftPanel = screen.getByTestId('zone-left-panel');
    const tabsBar = screen.getByTestId('left-panel-tabs');
    const scrollArea = screen.getByTestId('left-panel-scroll');
    expect(leftPanel).toHaveStyle({ overflow: 'hidden' });
    expect(tabsBar).toHaveStyle({ flexShrink: '0' });
    expect(scrollArea).toHaveStyle({ overflowY: 'auto' });
    expect(scrollArea.contains(tabsBar)).toBe(false);

    // 2. Scene status toggle: starts at a1-s01 (Here), a1-s02 is New
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('Here');
    expect(screen.getByTestId('scene-status-a1-s02')).toHaveTextContent('New');

    // Walk to a1-s02 via scene list row -> a1-s01 becomes Visited, a1-s02 becomes Here
    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Hab Ring Concourse');
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('Visited');
    expect(screen.getByTestId('scene-status-a1-s02')).toHaveTextContent('Here');

    // Tap a1-s01's compact status button to toggle it back to New without changing current scene
    const s01StatusBtn = screen.getByTestId('scene-status-a1-s01');
    expect(s01StatusBtn.tagName).toBe('BUTTON');
    expect(s01StatusBtn).toHaveStyle({ padding: '2px 6px' });
    expect(s01StatusBtn.style.minHeight).toBe('');
    expect(s01StatusBtn.style.minWidth).toBe('');
    fireEvent.click(s01StatusBtn);
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('New');
    expect(useCampaignStore.getState().live?.visited['a1-s01']).toBeUndefined();
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Hab Ring Concourse');

    // Tap a1-s01's status button again to mark it Visited without changing current scene
    fireEvent.click(screen.getByTestId('scene-status-a1-s01'));
    expect(screen.getByTestId('scene-status-a1-s01')).toHaveTextContent('Visited');
    expect(useCampaignStore.getState().live?.visited['a1-s01']).toBe(true);
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Hab Ring Concourse');

    // 3. RightPanel overlay opens on rail button tap and closes when tapping outside backdrop
    fireEvent.click(screen.getByRole('button', { name: 'Open Scratchpad and Theme' }));
    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-backdrop')).toBeInTheDocument();

    // Open NoteOverrideModal from inside the RightPanel overlay
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    expect(screen.getByTestId('note-override-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('save-note-btn')).not.toBeInTheDocument();

    // Typing a note and tapping outside the modal card saves it and closes the modal
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Auto-saved when tapping outside.' },
    });

    // Tapping inside the modal card does not close it
    fireEvent.click(screen.getByTestId('note-override-modal-card'));
    expect(screen.getByTestId('note-override-modal')).toBeInTheDocument();

    // Tapping the modal backdrop closes the modal and leaves the auto-saved note on the scene
    fireEvent.click(screen.getByTestId('note-override-modal'));
    expect(screen.queryByTestId('note-override-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-change-banner')).toHaveTextContent(
      'Auto-saved when tapping outside.'
    );

    // Tapping the right-panel backdrop closes the right-panel overlay
    fireEvent.click(screen.getByTestId('right-panel-backdrop'));
    expect(screen.queryByTestId('zone-right-panel')).not.toBeInTheDocument();
  });

  it('handles note auto-save edge cases: clear-to-delete, target switching before/after typing', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Edge Case Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

    // Edge case 1: Open Add Note, type text, then clear all text before closing -> no note saved
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Temporary text' },
    });
    expect(useCampaignStore.getState().live?.notes.length).toBe(1);
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: '' },
    });
    expect(useCampaignStore.getState().live?.notes.length).toBe(0);
    fireEvent.click(screen.getByTestId('note-override-modal'));
    expect(useCampaignStore.getState().live?.notes.length).toBe(0);

    // Edge case 2: Open Add Note, change target BEFORE typing, then type -> saved to new target
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.change(screen.getByTestId('note-target-select'), {
      target: { value: 'a1-s03' },
    });
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Targeted to scene 3 first' },
    });
    fireEvent.click(screen.getByTestId('note-override-modal'));
    const notesAfterCase2 = useCampaignStore.getState().live?.notes ?? [];
    expect(notesAfterCase2.length).toBe(1);
    expect(notesAfterCase2[0].targetId).toBe('a1-s03');
    expect(notesAfterCase2[0].text).toBe('Targeted to scene 3 first');

    // Edge case 3: Open note modal, type text, THEN change target -> updated in store with new target
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'Changed target afterwards' },
    });
    const notesDuringCase3 = useCampaignStore.getState().live?.notes ?? [];
    const createdNote = notesDuringCase3.find((n) => n.text === 'Changed target afterwards');
    expect(createdNote).toBeDefined();
    expect(createdNote?.targetId).toBe('a1-s01');
    // Change target in dropdown
    fireEvent.change(screen.getByTestId('note-target-select'), {
      target: { value: 'a1-s02' },
    });
    const updatedNote = useCampaignStore
      .getState()
      .live?.notes.find((n) => n.id === createdNote?.id);
    expect(updatedNote?.targetId).toBe('a1-s02');
    fireEvent.click(screen.getByTestId('close-note-modal-btn'));

    // Edge case 4: Edit existing note and clear text -> note is deleted from store
    // Open the note for a1-s02 by navigating there or via banner
    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    const banner = screen.getByTestId('table-change-banner');
    fireEvent.click(banner.querySelectorAll('button')[0]);
    expect(screen.getByTestId('note-override-modal')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('close-note-modal-btn'));
    expect(
      useCampaignStore.getState().live?.notes.find((n) => n.id === createdNote?.id)
    ).toBeUndefined();
  });

  it('preserves multiline formatting on Table change notes, tracks entities/drones, summons/removes roaming threats, opens entity inspector, adds improvised NPCs, steps trackers, and runs global search with Solo Mask rules', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Phase 4 Test Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

    // 1. Multiline Table change note preserves line breaks (whiteSpace: pre-line)
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.change(screen.getByTestId('note-text-input'), {
      target: { value: 'First line of note.\nSecond line below it.' },
    });
    fireEvent.click(screen.getByTestId('note-override-modal'));
    const createdMultilineNote = useCampaignStore.getState().live?.notes[0]!;
    const noteTextEl = screen.getByTestId(`table-note-text-${createdMultilineNote.id}`);
    expect(noteTextEl).toHaveStyle({ whiteSpace: 'pre-line' });
    expect(noteTextEl.textContent).toBe('First line of note.\nSecond line below it.');

    // 2. TopBar tracker steppers: tr-stress (min 0, max 20, start 2), tr-o2 (min 0, max 12, start 12), tr-day (min 1, max 10, start 1)
    expect(screen.getByTestId('tracker-val-tr-stress')).toHaveTextContent('2');
    expect(screen.getByTestId('tracker-val-tr-o2')).toHaveTextContent('12');
    expect(screen.getByTestId('tracker-val-tr-day')).toHaveTextContent('1');

    // Clamp Day at min=1 when decreasing from 1
    fireEvent.click(screen.getByTestId('tracker-dec-tr-day'));
    expect(screen.getByTestId('tracker-val-tr-day')).toHaveTextContent('1');

    // Increase Day to 2
    fireEvent.click(screen.getByTestId('tracker-inc-tr-day'));
    expect(screen.getByTestId('tracker-val-tr-day')).toHaveTextContent('2');

    // Clamp O2 at max=12 when increasing from 12, then decrease to 11
    fireEvent.click(screen.getByTestId('tracker-inc-tr-o2'));
    expect(screen.getByTestId('tracker-val-tr-o2')).toHaveTextContent('12');
    fireEvent.click(screen.getByTestId('tracker-dec-tr-o2'));
    expect(screen.getByTestId('tracker-val-tr-o2')).toHaveTextContent('11');

    // 3. Roaming list in Scene 3: summon The Vent Thing (e-creature), damage its HP, then remove it
    fireEvent.click(screen.getByTestId('scene-row-a1-s03'));
    expect(screen.getByTestId('no-scene-entities')).toHaveTextContent('No one here. Yet.');
    expect(screen.getByTestId('roaming-card-e-creature')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('summon-btn-e-creature'));
    expect(screen.getByTestId('entity-card-e-creature')).toBeInTheDocument();
    expect(screen.getByTestId('no-roaming-entities')).toHaveTextContent(
      'All roaming threats are in this scene.'
    );

    expect(screen.getByTestId('entity-track-val-e-creature-0-0')).toHaveTextContent('30 / 30');
    fireEvent.click(screen.getByTestId('entity-track-dec-e-creature-0-0'));
    expect(screen.getByTestId('entity-track-val-e-creature-0-0')).toHaveTextContent('29 / 30');

    // Remove summoned entity from Scene 3
    fireEvent.click(screen.getByTestId('remove-summoned-e-creature'));
    expect(screen.queryByTestId('entity-card-e-creature')).not.toBeInTheDocument();
    expect(screen.getByTestId('roaming-card-e-creature')).toBeInTheDocument();

    // 4. Summon e-drones into Scene 3 to verify base entity.count = 3 (3 independent drone HP tracks), and check Scene 4 entity_counts override (2 drones)
    useCampaignStore.getState().summonEntityToScene('a1-s03', 'e-drones');
    await waitFor(() => {
      expect(screen.getByTestId('entity-card-e-drones')).toBeInTheDocument();
    });
    expect(screen.getByTestId('entity-track-val-e-drones-0-0')).toHaveTextContent('8 / 8');
    expect(screen.getByTestId('entity-track-val-e-drones-1-0')).toHaveTextContent('8 / 8');
    expect(screen.getByTestId('entity-track-val-e-drones-2-0')).toHaveTextContent('8 / 8');

    // Damage each of the 3 drones separately
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-0-0'));
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-1-0'));
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-1-0'));
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-2-0'));
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-2-0'));
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-2-0'));

    expect(screen.getByTestId('entity-track-val-e-drones-0-0')).toHaveTextContent('7 / 8');
    expect(screen.getByTestId('entity-track-val-e-drones-1-0')).toHaveTextContent('6 / 8');
    expect(screen.getByTestId('entity-track-val-e-drones-2-0')).toHaveTextContent('5 / 8');

    // Walk to Scene 4 where scene.entity_counts overrides e-drones to 2 copies
    fireEvent.click(screen.getByTestId('scene-row-a1-s04'));
    expect(screen.getByTestId('inspect-entity-e-drones')).toHaveTextContent(
      'Maintenance Drones ×2'
    );
    expect(screen.getByTestId('entity-track-row-e-drones-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('entity-track-row-e-drones-1-0')).toBeInTheDocument();
    expect(screen.queryByTestId('entity-track-row-e-drones-2-0')).not.toBeInTheDocument();

    // Adjust drone #1 in Scene 4 (where copyCount is 2) and confirm drone #3's HP (5/8) is NOT truncated
    fireEvent.click(screen.getByTestId('entity-track-dec-e-drones-0-0'));
    expect(screen.getByTestId('entity-track-val-e-drones-0-0')).toHaveTextContent('6 / 8');
    expect(useCampaignStore.getState().live?.entityTracks['e-drones']).toEqual([
      [6],
      [6],
      [5],
    ]);

    // 5. Global search: find "Okafor" (opens entity inspector) and "terminal" (jumps to scene 3)
    const searchInput = screen.getByTestId('global-search-input');
    fireEvent.change(searchInput, { target: { value: 'Okafor' } });
    expect(screen.getByTestId('search-results-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('search-group-entity')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-result-entity-e-okafor'));
    // Inspector drawer opens for Okafor
    expect(screen.getByTestId('inspector-entity-name')).toHaveTextContent('Chief Dana Okafor');
    expect(screen.getByTestId('inspector-stat-line')).toHaveTextContent(
      'Combat 25 · Instinct 35 · Wounds 2 · HP 12 · Revolver 3d10'
    );
    expect(screen.getByTestId('inspector-voice')).toHaveTextContent(
      'Whispers. Repeats questions back.'
    );
    expect(screen.getByTestId('inspector-goal')).toHaveTextContent(
      'Get off the station alive.'
    );
    expect(screen.getByTestId('inspector-secret')).toHaveTextContent(
      'He let the Helix tech into the reactor and did not report it.'
    );

    // Cycle Okafor's disposition (starts suspicious -> hostile -> allied)
    expect(screen.getByTestId('inspector-disp-chip')).toHaveTextContent('suspicious');
    fireEvent.click(screen.getByTestId('inspector-disp-chip'));
    expect(screen.getByTestId('inspector-disp-chip')).toHaveTextContent('hostile');
    fireEvent.click(screen.getByTestId('inspector-disp-chip'));
    expect(screen.getByTestId('inspector-disp-chip')).toHaveTextContent('allied');

    // Toggle Solo Mask ON while inspecting Okafor: secret and unrevealed clue are masked
    fireEvent.click(screen.getByTestId('solo-mask-toggle'));
    expect(screen.getByTestId('inspector-secret')).toHaveTextContent('Hidden in Solo Mode.');
    expect(screen.queryByTestId('inspector-clue-text-e-okafor-c1')).not.toBeInTheDocument();
    expect(screen.getByTestId('inspector-clue-hidden-e-okafor-c1')).toBeInTheDocument();

    // Reveal Okafor's clue -> feeds live.revealed and reveals text
    fireEvent.click(screen.getByTestId('inspector-clue-btn-e-okafor-c1'));
    expect(screen.getByTestId('inspector-clue-text-e-okafor-c1')).toHaveTextContent(
      'He saw a Helix technician at the reactor on the night of the failure.'
    );
    expect(useCampaignStore.getState().live?.revealed['e-okafor-c1']).toBe(true);

    // Close inspector and search for "terminal" -> jumps to Scene 3
    fireEvent.click(screen.getByTestId('close-entity-inspector-btn'));
    fireEvent.change(screen.getByTestId('global-search-input'), {
      target: { value: 'terminal' },
    });
    fireEvent.click(screen.getByTestId('search-result-item-a1-s03-i1'));
    expect(screen.getByTestId('scene-title')).toHaveTextContent('Operations Center');

    // 6. Add an Improvised NPC via the Add note / override modal
    fireEvent.click(screen.getByTestId('add-note-override-btn'));
    fireEvent.change(screen.getByTestId('new-npc-name-input'), {
      target: { value: 'Corporal Vance' },
    });
    fireEvent.change(screen.getByTestId('new-npc-disp-select'), {
      target: { value: 'allied' },
    });
    fireEvent.change(screen.getByTestId('new-npc-summary-input'), {
      target: { value: 'Wounded security guard.' },
    });
    fireEvent.change(screen.getByTestId('new-npc-track-label-input'), {
      target: { value: 'HP' },
    });
    fireEvent.change(screen.getByTestId('new-npc-track-max-input'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByTestId('add-improvised-npc-btn'));
    fireEvent.click(screen.getByTestId('close-note-modal-btn'));

    const impNpc = useCampaignStore.getState().live?.improvisedEntities[0]!;
    expect(impNpc).toBeDefined();
    expect(impNpc.name).toBe('Corporal Vance');
    expect(screen.getByTestId(`entity-card-${impNpc.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`entity-improvised-chip-${impNpc.id}`)).toHaveTextContent(
      'Improvised'
    );
    expect(screen.getByTestId(`entity-track-val-${impNpc.id}-0-0`)).toHaveTextContent(
      '10 / 10'
    );
    fireEvent.click(screen.getByTestId(`entity-track-dec-${impNpc.id}-0-0`));
    expect(screen.getByTestId(`entity-track-val-${impNpc.id}-0-0`)).toHaveTextContent(
      '9 / 10'
    );
  });

  it('renders full-height LeftPanel without split handle, renames Scratchpad button to Override Scene / Add Note, and steps entity tracks inside the Entity Inspector drawer', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 4a Test Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));

    // 1. LeftPanel has full-height left-panel-scroll while in-this-scene-dock lives inside Center Stage
    const leftPanel = screen.getByTestId('zone-left-panel');
    const topScroll = screen.getByTestId('left-panel-scroll');
    const sceneStage = screen.getByTestId('zone-scene-stage');
    const inlineDock = screen.getByTestId('in-this-scene-dock');

    expect(leftPanel.contains(topScroll)).toBe(true);
    expect(leftPanel.contains(inlineDock)).toBe(false);
    expect(sceneStage.contains(inlineDock)).toBe(true);
    expect(screen.queryByTestId('left-split-handle')).not.toBeInTheDocument();
    expect(topScroll).toHaveStyle({ flex: '1', minHeight: '0', overflowY: 'auto' });

    // 2. Scratchpad button and modal heading read "Override Scene / Add Note"
    const overrideBtn = screen.getByTestId('add-note-override-btn');
    expect(overrideBtn).toHaveTextContent('Override Scene / Add Note');
    fireEvent.click(overrideBtn);
    const modalCard = screen.getByTestId('note-override-modal-card');
    expect(modalCard).toHaveTextContent('Override Scene / Add Note');

    // Add an improvised NPC with HP track while modal is open
    fireEvent.change(screen.getByTestId('new-npc-name-input'), {
      target: { value: 'Tech Specialist Lin' },
    });
    fireEvent.change(screen.getByTestId('new-npc-track-label-input'), {
      target: { value: 'HP' },
    });
    fireEvent.change(screen.getByTestId('new-npc-track-max-input'), {
      target: { value: '14' },
    });
    fireEvent.click(screen.getByTestId('add-improvised-npc-btn'));
    fireEvent.click(screen.getByTestId('close-note-modal-btn'));

    // 3. Inspect improvised NPC from Center Stage and step its HP track inside the Entity Inspector drawer
    const impNpc = useCampaignStore.getState().live?.improvisedEntities[0]!;
    fireEvent.click(screen.getByTestId(`inspect-entity-${impNpc.id}`));
    expect(screen.getByTestId('inspector-entity-name')).toHaveTextContent(
      'Tech Specialist Lin'
    );
    const impDecBtn = screen.getByTestId(`inspector-track-dec-${impNpc.id}-0-0`);
    const impIncBtn = screen.getByTestId(`inspector-track-inc-${impNpc.id}-0-0`);
    expect(impDecBtn).toHaveStyle({ width: '44px', height: '44px' });
    expect(impIncBtn).toHaveStyle({ width: '44px', height: '44px' });
    expect(
      screen.getByTestId(`inspector-track-val-${impNpc.id}-0-0`)
    ).toHaveTextContent('14 / 14');

    fireEvent.click(impDecBtn);
    expect(
      screen.getByTestId(`inspector-track-val-${impNpc.id}-0-0`)
    ).toHaveTextContent('13 / 14');
    // Inline NPC strip updates in lockstep
    expect(screen.getByTestId(`entity-track-val-${impNpc.id}-0-0`)).toHaveTextContent(
      '13 / 14'
    );

    // 4. Walk to Scene 2 (where Chief Dana Okafor is in scene) and inspect Okafor
    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    fireEvent.click(screen.getByTestId('inspect-entity-e-okafor'));
    expect(screen.getByTestId('inspector-entity-name')).toHaveTextContent(
      'Chief Dana Okafor'
    );
    expect(screen.getByTestId('inspector-track-val-e-okafor-0-0')).toHaveTextContent(
      '12 / 12'
    );
    fireEvent.click(screen.getByTestId('inspector-track-dec-e-okafor-0-0'));
    expect(screen.getByTestId('inspector-track-val-e-okafor-0-0')).toHaveTextContent(
      '11 / 12'
    );
    expect(screen.getByTestId('entity-track-val-e-okafor-0-0')).toHaveTextContent(
      '11 / 12'
    );

    // Walk to Scene 4 (where Maintenance Drones has scene.entity_counts override = 2) and inspect e-drones
    fireEvent.click(screen.getByTestId('scene-row-a1-s04'));
    fireEvent.click(screen.getByTestId('inspect-entity-e-drones'));
    expect(screen.getByTestId('inspector-track-row-e-drones-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-track-row-e-drones-1-0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('inspector-track-row-e-drones-2-0')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('inspector-track-dec-e-drones-1-0'));
    expect(screen.getByTestId('inspector-track-val-e-drones-1-0')).toHaveTextContent(
      '7 / 8'
    );
    expect(screen.getByTestId('entity-track-val-e-drones-1-0')).toHaveTextContent(
      '7 / 8'
    );
  });

  it('renders inline NPC stat strips inside Center Stage and toggles collapsible roleplay details with Solo Mask protection', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6e Inline NPC Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('scene-row-a1-s02')).toBeInTheDocument();
    });

    // LeftPanel has no split handle; Center Stage contains in-this-scene-dock
    expect(screen.queryByTestId('left-split-handle')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('zone-scene-stage').contains(screen.getByTestId('in-this-scene-dock'))
    ).toBe(true);

    // Navigate to Scene 2 where Chief Dana Okafor is active
    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    expect(screen.getByTestId('entity-inline-stats-e-okafor')).toHaveTextContent(
      'Combat 25 · Instinct 35 · Wounds 2 · HP 12 · Revolver 3d10'
    );

    const accordion = screen.getByTestId('entity-details-accordion-e-okafor');
    const toggleBtn = screen.getByTestId('entity-details-toggle-e-okafor');
    expect(accordion).toHaveAttribute('data-open', 'false');

    // Expand roleplay details
    fireEvent.click(toggleBtn);
    expect(accordion).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('entity-inline-secret-e-okafor')).toHaveTextContent(
      'He let the Helix tech into the reactor and did not report it.'
    );

    // Enable Solo Mask -> inline secret is masked
    fireEvent.click(screen.getByTestId('solo-mask-toggle'));
    expect(screen.getByTestId('entity-inline-secret-e-okafor')).toHaveTextContent(
      'Hidden in Solo Mode.'
    );
  });

  it('edits current and max track numbers in the right Entity Inspector drawer while keeping steppers', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 4b Tracks Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('scene-row-a1-s02')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    fireEvent.click(screen.getByTestId('inspect-entity-e-okafor'));

    // Edit max HP from 12 to 18 by tapping max number
    fireEvent.click(screen.getByTestId('inspector-track-max-btn-e-okafor-0-0'));
    const maxInput = screen.getByTestId('inspector-track-max-input-e-okafor-0-0');
    fireEvent.change(maxInput, { target: { value: '18' } });
    fireEvent.keyDown(maxInput, { key: 'Enter' });

    expect(useCampaignStore.getState().live?.entityTrackMax?.['e-okafor']).toEqual([[18]]);
    expect(screen.getByTestId('inspector-track-max-btn-e-okafor-0-0')).toHaveTextContent('18');
    expect(screen.getByTestId('entity-track-val-e-okafor-0-0')).toHaveTextContent('18 / 18');

    // Edit current HP to 10 by tapping current number
    fireEvent.click(screen.getByTestId('inspector-track-current-btn-e-okafor-0-0'));
    const curInput = screen.getByTestId('inspector-track-current-input-e-okafor-0-0');
    fireEvent.change(curInput, { target: { value: '10' } });
    fireEvent.keyDown(curInput, { key: 'Enter' });

    expect(useCampaignStore.getState().live?.entityTracks['e-okafor']).toEqual([[10]]);
    expect(screen.getByTestId('inspector-track-current-btn-e-okafor-0-0')).toHaveTextContent('10');
    expect(screen.getByTestId('entity-track-val-e-okafor-0-0')).toHaveTextContent('10 / 18');

    // Stepper buttons still work and respect the new max (18)
    fireEvent.click(screen.getByTestId('inspector-track-inc-e-okafor-0-0'));
    expect(screen.getByTestId('inspector-track-current-btn-e-okafor-0-0')).toHaveTextContent('11');
    fireEvent.click(screen.getByTestId('inspector-track-dec-e-okafor-0-0'));
    expect(screen.getByTestId('inspector-track-current-btn-e-okafor-0-0')).toHaveTextContent('10');

    // Lowering max below current clamps current down to the new max
    fireEvent.click(screen.getByTestId('inspector-track-max-btn-e-okafor-0-0'));
    const maxInput2 = screen.getByTestId('inspector-track-max-input-e-okafor-0-0');
    fireEvent.change(maxInput2, { target: { value: '6' } });
    fireEvent.blur(maxInput2);

    expect(useCampaignStore.getState().live?.entityTrackMax?.['e-okafor']).toEqual([[6]]);
    expect(useCampaignStore.getState().live?.entityTracks['e-okafor']).toEqual([[6]]);
    expect(screen.getByTestId('inspector-track-val-e-okafor-0-0')).toHaveTextContent('6 / 6');
    expect(screen.getByTestId('entity-track-val-e-okafor-0-0')).toHaveTextContent('6 / 6');
  });

  it('renders live Node Map tab in LeftPanel, navigates on node tap, and opens/closes Expand overlay over Center', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Phase 6 Node Map Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('scene-row-a1-s02')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Node Map' }));
    expect(screen.getByTestId('node-map-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-a1-s01')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-a2-s01')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Expand node map' }));
    expect(screen.getByTestId('node-map-expanded-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('node-map-canvas-expanded')).toBeInTheDocument();

    const expandedNodes = screen.getAllByTestId('map-node-a1-s02');
    fireEvent.click(expandedNodes[expandedNodes.length - 1]);
    expect(useCampaignStore.getState().live?.currentSceneId).toBe('a1-s02');

    fireEvent.click(screen.getByRole('button', { name: 'Close expanded node map' }));
    expect(screen.queryByTestId('node-map-expanded-overlay')).not.toBeInTheDocument();
  });

  it('adds an area, scene, and map node on the fly and connects exits', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6a On The Fly Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('add-area-btn')).toBeInTheDocument();
    });

    // 1. Add an Area on the fly
    fireEvent.click(screen.getByTestId('add-area-btn'));
    expect(screen.getByTestId('add-scene-modal')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Area Name'), {
      target: { value: 'Sub-Deck Tunnel' },
    });
    fireEvent.click(screen.getByTestId('add-scene-submit'));

    await waitFor(() => {
      expect(screen.getByText('Sub-Deck Tunnel')).toBeInTheDocument();
    });
    expect(useCampaignStore.getState().live?.improvisedAreas).toHaveLength(1);

    // 2. Add a Scene on the fly inside that area, connected from current scene (a1-s01)
    fireEvent.click(screen.getByTestId('add-scene-btn'));
    fireEvent.change(screen.getByLabelText('Scene Title'), {
      target: { value: 'Secret Maintenance Hatch' },
    });
    fireEvent.change(screen.getByLabelText('Area (optional)'), {
      target: { value: 'Sub-Deck Tunnel' },
    });
    fireEvent.click(screen.getByTestId('add-scene-submit'));

    const createdScene = useCampaignStore.getState().live?.improvisedScenes?.[0];
    expect(createdScene).toBeDefined();
    expect(createdScene?.title).toBe('Secret Maintenance Hatch');
    expect(createdScene?.group).toBe('Sub-Deck Tunnel');

    // Center jumps to the new scene, and ExitsBar has the two-way return exit to a1-s01
    expect(useCampaignStore.getState().live?.currentSceneId).toBe(createdScene!.id);
    expect(screen.getByTestId(`scene-row-${createdScene!.id}`)).toBeInTheDocument();
    expect(screen.getByTestId('zone-exits-bar')).toHaveTextContent('Secret Maintenance Hatch');

    // 3. Switch to Node Map and add a Map Node on the fly
    fireEvent.click(screen.getByRole('button', { name: 'Node Map' }));
    fireEvent.click(screen.getByTestId('node-map-add-btn'));
    fireEvent.change(screen.getByLabelText('Scene Title'), {
      target: { value: 'Hidden Escape Pod' },
    });
    fireEvent.click(screen.getByTestId('add-scene-submit'));

    const createdNodeScene = useCampaignStore.getState().live?.improvisedScenes?.[1];
    expect(createdNodeScene).toBeDefined();
    expect(
      useCampaignStore.getState().live?.nodePositions?.[createdNodeScene!.id]
    ).toBeDefined();
    expect(screen.getByTestId(`map-node-${createdNodeScene!.id}`)).toBeInTheDocument();
    expect(useCampaignStore.getState().live?.improvisedConnections).toHaveLength(2);
  });

  it('renders bold anchor tags in Tier 1/2/3 and shows in-place ✓ feedback on reveal', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6d Polish Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    const baseMerged = useCampaignStore.getState().merged;
    const firstScene = baseMerged.scenes[0];
    useCampaignStore.setState({
      merged: {
        ...baseMerged,
        scenes: [
          {
            ...firstScene,
            tier1_sensory: ['Trigger: Airlock pressure drops.', 'Loot: Emergency flare kit.'],
          },
          ...baseMerged.scenes.slice(1),
        ],
      },
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('reveal-btn-a1-s01-i1')).toBeInTheDocument();
    });

    // Bold anchors in Tier 1 bullets
    const triggerStrong = screen.getByText('Trigger');
    expect(triggerStrong.tagName).toBe('STRONG');
    const lootStrong = screen.getByText('Loot');
    expect(lootStrong.tagName).toBe('STRONG');

    // In-place micro-feedback on reveal tap
    const revealBtn = screen.getByTestId('reveal-btn-a1-s01-i1');
    fireEvent.click(revealBtn);
    expect(revealBtn.textContent).toBe('Found ✓');
    expect(revealBtn.className).toContain('gm-flash-confirm');
  });

  it('toggles between Run Mode and Full Text and folds or expands Tier 2/3 item details', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6e Run Mode Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('scene-view-mode-toggle')).toBeInTheDocument();
    });

    // Starts in Run Mode with clear badge and folded unrevealed Tier 2/3 results
    expect(screen.getByTestId('scene-mode-badge')).toHaveTextContent('Run Mode · 5s Scan');
    expect(screen.queryByTestId('item-result-a1-s01-i1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('item-result-a1-s01-h1')).not.toBeInTheDocument();

    // Tapping per-card Details toggle in Run Mode expands that card's result
    fireEvent.click(screen.getByTestId('item-expand-btn-a1-s01-i1'));
    expect(screen.getByTestId('item-result-a1-s01-i1')).toHaveTextContent(
      'The panel accepts a manual override. The hab airlock opens.'
    );

    // Collapse it back in Run Mode
    fireEvent.click(screen.getByTestId('item-expand-btn-a1-s01-i1'));
    expect(screen.queryByTestId('item-result-a1-s01-i1')).not.toBeInTheDocument();

    // Switch to Full Text -> all unmasked Tier 2 and Tier 3 results expand automatically
    fireEvent.click(screen.getByTestId('scene-mode-full'));
    expect(screen.getByTestId('scene-mode-badge')).toHaveTextContent('Full Text · Expanded');
    expect(screen.getByTestId('item-result-a1-s01-i1')).toBeInTheDocument();
    expect(screen.getByTestId('item-result-a1-s01-h1')).toHaveTextContent(
      'Claw marks inside the vent. Something left this way.'
    );
  });

  it('opens and closes inline keyword peek popovers for entities and truths with Solo Mask protection', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6e Keyword Peek Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);
    fireEvent.click(screen.getByTestId('focus-mode-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('scene-row-a1-s02')).toBeInTheDocument();
    });

    // Navigate to Scene 2 where "Okafor" appears as an inline keyword in GM tip and Tier 2 result
    fireEvent.click(screen.getByTestId('scene-row-a1-s02'));
    const okaforLinks = screen.getAllByTestId('keyword-link-entity-e-okafor');
    expect(okaforLinks.length).toBeGreaterThan(0);

    fireEvent.click(okaforLinks[0]);
    expect(screen.getByTestId('keyword-peek-popover')).toBeInTheDocument();
    expect(screen.getByTestId('keyword-peek-title')).toHaveTextContent('Chief Dana Okafor');
    expect(screen.getByTestId('keyword-peek-stat-line')).toHaveTextContent(
      'Combat 25 · Instinct 35 · Wounds 2 · HP 12 · Revolver 3d10'
    );
    expect(screen.getByTestId('keyword-peek-secret')).toHaveTextContent(
      'He let the Helix tech into the reactor and did not report it.'
    );

    // Enable Solo Mask -> entity secret inside popover is masked
    fireEvent.click(screen.getByTestId('solo-mask-toggle'));
    expect(screen.getByTestId('keyword-peek-secret')).toHaveTextContent(
      'Hidden in Solo Mode.'
    );

    // Close entity popover via close button
    fireEvent.click(screen.getByTestId('keyword-peek-close'));
    expect(screen.queryByTestId('keyword-peek-popover')).not.toBeInTheDocument();

    // Navigate to Scene 3 and tap the linked Truth pill on Backup log terminal (a1-s03-i1)
    fireEvent.click(screen.getByTestId('exit-btn-a1-x02'));
    fireEvent.click(screen.getByTestId('truth-link-a1-s03-i1'));
    expect(screen.getByTestId('keyword-peek-popover')).toBeInTheDocument();
    expect(screen.getByTestId('keyword-peek-title')).toHaveTextContent(
      'Who caused the reactor failure?'
    );
    // In Solo Mode with 0 clues revealed, truth answer is masked
    expect(screen.getByTestId('keyword-peek-truth-answer')).toHaveTextContent(
      'Hidden in Solo Mode until a linked clue is revealed.'
    );

    // Close via backdrop click, reveal the clue, and reopen truth peek -> answer is now visible
    fireEvent.click(screen.getByTestId('keyword-peek-backdrop'));
    expect(screen.queryByTestId('keyword-peek-popover')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reveal-btn-a1-s03-i1'));
    fireEvent.click(screen.getByTestId('truth-link-a1-s03-i1'));
    expect(screen.getByTestId('keyword-peek-truth-answer')).toHaveTextContent(
      'A Helix technician turned off reactor cooling on purpose.'
    );
  });

  it('defaults to Table Focus Mode single-spread view, opens rail overlays, and toggles back to 3-column mode', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Stage 6f Focus Mode Test',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);

    // Live default is Focus Mode ON -> rails visible, sidebars tucked
    const focusToggle = screen.getByTestId('focus-mode-toggle');
    expect(focusToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('zone-left-rail')).toBeInTheDocument();
    expect(screen.getByTestId('zone-right-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('zone-left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('zone-right-panel')).not.toBeInTheDocument();

    // Tap left rail bar directly -> LeftPanel opens as overlay without Close button; tap backdrop -> closes
    fireEvent.click(screen.getByTestId('zone-left-rail'));
    expect(screen.getByTestId('zone-left-panel')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('zone-left-panel')).queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('left-panel-backdrop'));
    expect(screen.queryByTestId('zone-left-panel')).not.toBeInTheDocument();

    // Tap left rail icon button -> still opens LeftPanel
    fireEvent.click(screen.getByRole('button', { name: 'Open Scene List' }));
    expect(screen.getByTestId('zone-left-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('left-panel-backdrop'));
    expect(screen.queryByTestId('zone-left-panel')).not.toBeInTheDocument();

    // Tap right rail bar directly -> RightPanel opens as overlay without Close button; tap backdrop -> closes
    fireEvent.click(screen.getByTestId('zone-right-rail'));
    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('zone-right-panel')).queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('right-panel-backdrop'));
    expect(screen.queryByTestId('zone-right-panel')).not.toBeInTheDocument();

    // Tap right rail icon button -> still opens RightPanel
    fireEvent.click(screen.getByRole('button', { name: 'Open Clocks and Timeline' }));
    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('right-panel-backdrop'));
    expect(screen.queryByTestId('zone-right-panel')).not.toBeInTheDocument();

    // Toggle Focus Mode OFF -> both 300px sidebars restore and persist to live.ui.focusMode
    fireEvent.click(focusToggle);
    expect(focusToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('zone-left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('zone-right-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('zone-left-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('zone-right-rail')).not.toBeInTheDocument();

    await waitFor(
      async () => {
        const stored = await db.live.get(useCampaignStore.getState().activeCampaign!.id);
        expect(stored?.ui.focusMode).toBe(false);
      },
      { timeout: 1500 }
    );
  });

  it('uses minimal 26px scene-list add buttons and supports deleting scenes and areas with confirmation', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Delete Flow Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    useCampaignStore.getState().setFocusMode(false);
    useCampaignStore.getState().addTableNote('a1-s02', 'Keep this note when scene is deleted');

    render(<App />);

    const addAreaBtn = screen.getByTestId('add-area-btn');
    const addSceneBtn = screen.getByTestId('add-scene-btn');
    expect(addAreaBtn.style.height).toBe('26px');
    expect(addSceneBtn.style.height).toBe('26px');
    expect(addAreaBtn.style.flex).toBe('');
    expect(addSceneBtn.style.flex).toBe('');

    // Delete a scene with confirmation and verify orphaned note moves to looseNotes
    fireEvent.click(screen.getByTestId('delete-scene-a1-s02'));
    expect(screen.getByTestId('confirm-delete-left-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete-left-btn'));
    expect(screen.queryByTestId('scene-row-a1-s02')).not.toBeInTheDocument();
    expect(
      useCampaignStore
        .getState()
        .live?.looseNotes.some((n) => n.text === 'Keep this note when scene is deleted')
    ).toBe(true);

    // Add an improvised area and delete it with confirmation
    useCampaignStore.getState().addImprovisedArea({ name: 'Temp Sector', actId: 'a1' });
    const areaDeleteBtn = await screen.findByTestId('delete-area-a1:temp sector');
    fireEvent.click(areaDeleteBtn);
    expect(screen.getByTestId('confirm-delete-left-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-delete-left-modal').parentElement).toBe(document.body);
    fireEvent.click(screen.getByTestId('confirm-delete-left-btn'));
    expect(screen.queryByTestId('delete-area-a1:temp sector')).not.toBeInTheDocument();
  });

  it('portals AddRightItemModal to document.body when opened from Focus Mode RightPanel', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Focus Portal Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Clocks and Timeline' }));
    fireEvent.click(screen.getByTestId('add-clock-btn'));
    const modalBackdrop = screen.getByTestId('add-right-item-backdrop');
    expect(modalBackdrop).toBeInTheDocument();
    expect(modalBackdrop.parentElement).toBe(document.body);
  });

  it('keeps right-panel sections collapsed across Focus Mode overlay close/reopen and persists to db', async () => {
    await useCampaignStore.getState().createNewCampaign({
      title: 'Overlay Section State Campaign',
      system: 'Mothership 1e',
      genre: 'sci-fi',
    });
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    const campaignId = useCampaignStore.getState().activeCampaign!.id;

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Clocks and Timeline' }));
    const timelineBtn = within(screen.getByTestId('section-timeline')).getByRole('button', {
      name: /TIMELINE/i,
    });
    const factionsBtn = within(screen.getByTestId('section-factions')).getByRole('button', {
      name: /FACTIONS/i,
    });
    fireEvent.click(timelineBtn);
    fireEvent.click(factionsBtn);
    expect(timelineBtn).toHaveAttribute('aria-expanded', 'false');
    expect(factionsBtn).toHaveAttribute('aria-expanded', 'false');

    // Close overlay and reopen it
    fireEvent.click(screen.getByTestId('right-panel-backdrop'));
    expect(screen.queryByTestId('zone-right-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Clocks and Timeline' }));
    expect(
      within(screen.getByTestId('section-timeline')).getByRole('button', { name: /TIMELINE/i })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(screen.getByTestId('section-factions')).getByRole('button', { name: /FACTIONS/i })
    ).toHaveAttribute('aria-expanded', 'false');

    await waitFor(
      async () => {
        const stored = await db.live.get(campaignId);
        expect(stored?.ui.rightSectionsOpen).toEqual({
          timeline: false,
          factions: false,
        });
      },
      { timeout: 1500 }
    );
  });

  it('attaches a PDF in ActSwitcherSheet keyed by meta.module_id and shows missing prompt in PDF drawer', async () => {
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    render(<App />);

    // Open PDF drawer before attaching -> shows empty state
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByTestId('pdf-missing-state')).toHaveTextContent(
      'Attach the PDF for this module'
    );
    expect(screen.getByTestId('pdf-drawer-attach-btn')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('zone-drawer-host')).queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument();

    // Open Act Switcher and attach a PDF
    fireEvent.click(screen.getByTestId('act-switcher-btn'));
    const pdfFile = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'silent-relay.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByTestId('attach-pdf-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdfFile] } });

    const info = await screen.findByTestId('attached-pdf-info');
    expect(info).toHaveTextContent('silent-relay.pdf');
    expect(info).toHaveTextContent('4 B');

    const moduleId = useCampaignStore.getState().merged.meta?.module_id ?? '';
    const storedBlob = await getBlob(pdfBlobKey(moduleId));
    expect(storedBlob).toBeDefined();
    expect(storedBlob?.fileName).toBe('silent-relay.pdf');
  });

  it('opens PDF drawer at printed page + meta.page_offset from Book, Encounter, Read-Aloud, and Inspector p.N buttons', async () => {
    // Inject a chunk with page_offset = 2, encounter_page = 11, and read_aloud.page = 5
    const parsed = JSON.parse(sampleRawText) as Record<string, unknown>;
    (parsed.meta as Record<string, unknown>).page_offset = 2;
    const scenes = parsed.scenes as Array<Record<string, unknown>>;
    scenes[0].page = 4;
    scenes[0].encounter_page = 11;
    scenes[0].read_aloud = { page: 5, starts_with: 'Cold water laps at your' };

    const loadSpy = vi.spyOn(pdfLib, 'loadPdfDocument').mockResolvedValue({
      numPages: 30,
      destroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as pdfLib.PdfDocumentProxy);
    const renderSpy = vi.spyOn(pdfLib, 'renderPdfPageToCanvas').mockImplementation(() => ({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    }));

    try {
      await useCampaignStore.getState().importJsonChunk(JSON.stringify(parsed));
      const pdfFile = new File([new Uint8Array([1, 2, 3, 4])], 'module.pdf', {
        type: 'application/pdf',
      });
      await useCampaignStore.getState().attachPdf(pdfFile);

      render(<App />);

      // 1. Book p.4 -> PDF p.6
      fireEvent.click(screen.getByTestId('scene-book-page-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
          'Source PDF · printed p.4 (PDF p.6/30)'
        );
      });

      // Prev -> printed p.3 (PDF p.5), Next -> printed p.4 (PDF p.6)
      fireEvent.click(screen.getByTestId('pdf-prev-btn'));
      expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
        'Source PDF · printed p.3 (PDF p.5/30)'
      );
      fireEvent.click(screen.getByTestId('pdf-next-btn'));
      expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
        'Source PDF · printed p.4 (PDF p.6/30)'
      );

      // Go to page... -> printed p.9 -> PDF p.11
      fireEvent.click(screen.getByTestId('pdf-goto-btn'));
      fireEvent.change(screen.getByTestId('pdf-goto-input'), { target: { value: '9' } });
      fireEvent.click(screen.getByTestId('pdf-goto-submit-btn'));
      expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
        'Source PDF · printed p.9 (PDF p.11/30)'
      );

      // 2. Encounter p.11 -> PDF p.13
      fireEvent.click(screen.getByTestId('scene-encounter-page-btn'));
      expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
        'Source PDF · printed p.11 (PDF p.13/30)'
      );

      // 3. Read-aloud Open in PDF -> printed p.5 (PDF p.7)
      fireEvent.click(screen.getByTestId('read-aloud-open-pdf-btn'));
      expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
        'Source PDF · printed p.5 (PDF p.7/30)'
      );

      // 4. Entity Inspector p.N button
      const entityScene = useCampaignStore
        .getState()
        .merged.scenes.find((s) => s.entity_ids.length > 0)!;
      useCampaignStore.getState().goToScene(entityScene.id);
      const sceneEntity = useCampaignStore
        .getState()
        .merged.entities.find((e) => e.id === entityScene.entity_ids[0])!;
      expect(sceneEntity).toBeDefined();
      fireEvent.click(await screen.findByTestId(`inspect-entity-${sceneEntity.id}`));
      fireEvent.click(screen.getByTestId('inspector-page-btn'));
      const expectedPdf = sceneEntity.page + 2;
      await waitFor(() => {
        expect(screen.getByTestId('pdf-drawer-header-label')).toHaveTextContent(
          `Source PDF · printed p.${sceneEntity.page} (PDF p.${expectedPdf}/30)`
        );
      });
    } finally {
      loadSpy.mockRestore();
      renderSpy.mockRestore();
    }
  });

  it('saves backup, restores via Load Backup modal with PDF prompt, and shows visibilitychange reminder', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      writable: true,
      value: canShareMock,
    });

    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    const campId = useCampaignStore.getState().activeCampaign!.id;

    render(<App />);

    // Trigger a live change so dirtySinceBackup = true, then simulate backgrounding
    fireEvent.click(screen.getByTestId('solo-mask-toggle'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));

    expect(await screen.findByTestId('backup-reminder-banner')).toBeInTheDocument();

    // Save Backup via RightPanel Focus overlay after switching theme to Warm Paper
    fireEvent.click(screen.getByRole('button', { name: 'Open Clocks and Timeline' }));
    fireEvent.click(screen.getByRole('button', { name: /Warm Paper/i }));
    expect(useThemeStore.getState().theme).toBe('warmPaper');
    expect(screen.getByTestId('last-backup-label')).toHaveTextContent('Last backup: Never');
    fireEvent.click(screen.getByTestId('save-backup-btn'));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledTimes(1);
    });
    expect(Object.keys(shareMock.mock.calls[0][0] as Record<string, unknown>)).toEqual(['files']);
    expect(screen.getByTestId('last-backup-label')).toHaveTextContent('Last backup: Just now');

    const exported = await exportBackup(campId);
    expect(exported.live.theme).toBe('warmPaper');
    const backupFile = new File([JSON.stringify(exported)], 'backup.json', {
      type: 'application/json',
    });

    // Reset theme to scifi before restoring to prove backup restores the saved theme
    useThemeStore.getState().setTheme('scifi');

    // Return to CampaignScreen and test Load Backup conflict modal -> Restore as new
    useCampaignStore.getState().closeCampaign();
    const loadInput = (await screen.findByTestId('load-backup-input')) as HTMLInputElement;
    fireEvent.change(loadInput, { target: { files: [backupFile] } });

    expect(await screen.findByTestId('restore-backup-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('restore-as-new-btn'));

    // Restored campaign opens and shows PDF re-attach banner since no PDF was attached
    expect(await screen.findByTestId('pdf-reattach-banner')).toBeInTheDocument();
    expect(useCampaignStore.getState().activeCampaign?.id).not.toBe(campId);
    expect(useCampaignStore.getState().live?.theme).toBe('warmPaper');
    expect(useThemeStore.getState().theme).toBe('warmPaper');
  });

  it('Phase 8: Map Library, 4 map modes, pins with Solo Mask, note badge, and Edit pins work', async () => {
    await useCampaignStore.getState().importJsonChunk(sampleRawText);
    render(<App />);
    await screen.findByTestId('act-switcher-btn');

    // Open Map Library from Act Switcher -> Maps
    fireEvent.click(screen.getByTestId('act-switcher-btn'));
    fireEvent.click(await screen.findByTestId('act-sheet-maps-btn'));
    expect(await screen.findByTestId('map-library-sheet')).toBeInTheDocument();

    // Upload a map image
    const uploadInput = screen.getByTestId('map-upload-input') as HTMLInputElement;
    const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'station-deck.png', {
      type: 'image/png',
    });
    fireEvent.change(uploadInput, { target: { files: [pngFile] } });

    await waitFor(() => {
      expect(useCampaignStore.getState().live?.maps.length).toBe(1);
    });
    const mapId = useCampaignStore.getState().live!.maps[0].id;

    // Edit scale tag and assign to current scene
    const scaleSelect = await screen.findByTestId(`map-scale-select-${mapId}`);
    fireEvent.change(scaleSelect, { target: { value: 'Tactical' } });
    expect(useCampaignStore.getState().live?.maps[0].scale).toBe('Tactical');

    const currentSceneId = useCampaignStore.getState().live!.currentSceneId!;
    fireEvent.click(screen.getByTestId(`map-set-current-scene-btn-${mapId}`));
    expect(useCampaignStore.getState().live?.sceneMap[currentSceneId]).toBe(mapId);

    fireEvent.click(screen.getByTestId('map-library-close-btn'));

    // Test long-press on Map mode control opens Map Library
    const mapModeControl = screen.getByTestId('map-mode-control');
    vi.useFakeTimers();
    fireEvent.pointerDown(mapModeControl);
    vi.advanceTimersByTime(520);
    fireEvent.pointerUp(mapModeControl);
    vi.advanceTimersByTime(450);
    vi.useRealTimers();
    expect(await screen.findByTestId('map-library-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('map-library-close-btn'));

    // Switch map modes: PiP -> Split -> Map -> Text
    fireEvent.click(screen.getByRole('button', { name: 'PiP' }));
    expect(await screen.findByTestId('center-map-area')).toBeInTheDocument();
    expect(screen.getByTestId('map-area-viewport')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    expect(await screen.findByTestId('map-edit-pins-btn')).toBeInTheDocument();

    // Place a pin on an unpinned scene via Edit pins
    const scenes = useCampaignStore.getState().merged.scenes;
    const firstScene = scenes[0]; // a1-s01
    const secondScene = scenes[1]; // a1-s02
    const thirdScene = scenes[2]; // a1-s03 (open from a1-s02)
    fireEvent.click(screen.getByTestId('map-edit-pins-btn'));
    expect(screen.getByTestId('map-unpinned-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`map-unpinned-scene-${secondScene.id}`));
    const viewport = screen.getByTestId('map-area-viewport');
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 120, clientY: 120 });

    expect(useCampaignStore.getState().live?.pins[secondScene.id]).toMatchObject({ mapId });

    // Also pin firstScene and thirdScene, add a table note to firstScene -> verify amber dot badge
    useCampaignStore.getState().setScenePin(firstScene.id, { mapId, xPct: 25, yPct: 30 });
    useCampaignStore.getState().setScenePin(thirdScene.id, { mapId, xPct: 60, yPct: 60 });
    useCampaignStore.getState().addTableNote(firstScene.id, 'Hazard active');
    fireEvent.click(screen.getByTestId('map-edit-pins-btn'));

    expect(await screen.findByTestId(`map-pin-${firstScene.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`map-pin-note-dot-${firstScene.id}`)).toBeInTheDocument();

    // Tap secondScene pin to visit it, then Solo Mask shows '?' for reachable unvisited thirdScene
    fireEvent.click(screen.getByTestId(`map-pin-${secondScene.id}`));
    expect(useCampaignStore.getState().live?.currentSceneId).toBe(secondScene.id);

    fireEvent.click(screen.getByTestId('solo-mask-toggle'));
    const thirdPin = screen.getByTestId(`map-pin-${thirdScene.id}`);
    expect(thirdPin).toHaveTextContent('?');

    // Tap thirdPin navigates to thirdScene
    fireEvent.click(thirdPin);
    expect(useCampaignStore.getState().live?.currentSceneId).toBe(thirdScene.id);

    // Full Map mode hides scene stage, Text hides map area
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.queryByTestId('zone-scene-stage')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.queryByTestId('center-map-area')).not.toBeInTheDocument();
  });
});
