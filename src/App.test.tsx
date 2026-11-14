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
});
