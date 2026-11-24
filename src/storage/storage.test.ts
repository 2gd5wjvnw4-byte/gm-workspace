import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCampaign,
  createDefaultLiveState,
  db,
  deleteCampaign,
  deleteChunk,
  exportBackup,
  getBlob,
  importBackup,
  importChunk,
  listCampaigns,
  loadCampaign,
  putBlob,
  requestPersist,
  saveLive,
  type CampaignRecord,
  type ChunkRecord,
} from './index';

const samplePath = resolve(process.cwd(), 'samples/silent-relay-a1.json');
const sampleRawText = readFileSync(samplePath, 'utf-8');

describe('storage module (Dexie + fake-indexeddb)', () => {
  beforeEach(async () => {
    await db.campaigns.clear();
    await db.chunks.clear();
    await db.live.clear();
    await db.blobs.clear();
  });

  it('lists campaigns ordered by updatedAt descending', async () => {
    const c1: CampaignRecord = {
      id: 'camp-1',
      moduleId: 'silent-relay',
      title: 'The Silent Relay',
      system: 'Mothership',
      genre: 'Sci-Fi Horror',
      updatedAt: 1000,
    };
    const c2: CampaignRecord = {
      id: 'camp-2',
      moduleId: 'sunken-keep',
      title: 'The Sunken Keep',
      system: 'OSE',
      genre: 'Fantasy Dungeon',
      updatedAt: 2000,
    };
    await db.campaigns.bulkPut([c1, c2]);

    const list = await listCampaigns();
    expect(list.map((c) => c.id)).toEqual(['camp-2', 'camp-1']);
  });

  it('loads a campaign with chunks and creates default live state based on genre', async () => {
    const campaign: CampaignRecord = {
      id: 'camp-fantasy',
      moduleId: 'barrow-maze',
      title: 'Barrow Maze',
      system: 'B/X',
      genre: 'Dark Fantasy',
      updatedAt: 3000,
    };
    const chunk: ChunkRecord = {
      id: 'camp-fantasy:a1',
      campaignId: 'camp-fantasy',
      chunkId: 'a1',
      chunkTitle: 'Act 1',
      rawJson: { meta: { chunk_id: 'a1' } },
      importedAt: 3001,
    };
    await db.campaigns.put(campaign);
    await db.chunks.put(chunk);

    const loaded = await loadCampaign('camp-fantasy');
    expect(loaded).not.toBeNull();
    expect(loaded?.campaign.title).toBe('Barrow Maze');
    expect(loaded?.chunks).toHaveLength(1);
    expect(loaded?.live.theme).toBe('fantasy');

    const missing = await loadCampaign('does-not-exist');
    expect(missing).toBeNull();
  });

  it('debounces saveLive by 500ms and writes only the latest state', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const state1 = createDefaultLiveState('camp-1', 'scifi');
      state1.currentSceneId = 'a1-s01';

      const state2 = {
        ...state1,
        currentSceneId: 'a1-s02',
        trackerValues: { day: 3 },
      };

      const p1 = saveLive(state1);
      await vi.advanceTimersByTimeAsync(300);

      const beforeFlush = await db.live.get('camp-1');
      expect(beforeFlush).toBeUndefined();

      const p2 = saveLive(state2);
      await vi.advanceTimersByTimeAsync(499);
      expect(await db.live.get('camp-1')).toBeUndefined();

      await vi.advanceTimersByTimeAsync(1);
      await Promise.all([p1, p2]);

      const stored = await db.live.get('camp-1');
      expect(stored?.currentSceneId).toBe('a1-s02');
      expect(stored?.trackerValues.day).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists currentSceneId, visited, revealed, connectionState, notes, and ui.soloMask via saveLive to IndexedDB', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const live = createDefaultLiveState('camp-persist', 'scifi');
      live.currentSceneId = 'a1-s03';
      live.visited = { 'a1-s01': true, 'a1-s02': true, 'a1-s03': true };
      live.revealed = { 'a1-s01-i1': true, 'a1-s03-i1': true };
      live.connectionState = { 'a1-x01': 'open', 'a1-x03': 'locked' };
      live.notes = [
        {
          id: 'note-persist-1',
          targetId: 'a1-s03',
          text: 'Overridden security terminal.',
          createdAt: 123456,
        },
      ];
      live.ui.soloMask = true;

      const p = saveLive(live);
      await vi.advanceTimersByTimeAsync(500);
      await p;

      const stored = await db.live.get('camp-persist');
      expect(stored).toBeDefined();
      expect(stored?.currentSceneId).toBe('a1-s03');
      expect(stored?.visited).toEqual({
        'a1-s01': true,
        'a1-s02': true,
        'a1-s03': true,
      });
      expect(stored?.revealed).toEqual({
        'a1-s01-i1': true,
        'a1-s03-i1': true,
      });
      expect(stored?.connectionState).toEqual({
        'a1-x01': 'open',
        'a1-x03': 'locked',
      });
      expect(stored?.notes).toEqual([
        {
          id: 'note-persist-1',
          targetId: 'a1-s03',
          text: 'Overridden security terminal.',
          createdAt: 123456,
        },
      ]);
      expect(stored?.ui.soloMask).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stores and retrieves blobs with putBlob and getBlob', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    await putBlob('map:deck-1', payload, 'image/png');

    const record = await getBlob('map:deck-1');
    expect(record).toBeDefined();
    expect(record?.mimeType).toBe('image/png');
    expect(Array.from(record?.data as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('calls navigator.storage.persist() in requestPersist()', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: { persist: persistMock },
      configurable: true,
    });

    const result = await requestPersist();
    expect(result).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('creates a campaign, imports a chunk, replaces on re-import, and deletes a chunk while moving orphaned notes to looseNotes', async () => {
    const created = await createCampaign({
      id: 'camp-relay',
      title: 'The Silent Relay',
      system: 'Mothership 1e',
      genre: 'sci-fi horror',
    });
    expect(created.campaign.id).toBe('camp-relay');

    const afterImport = await importChunk(sampleRawText, 'camp-relay');
    expect(afterImport.chunks).toHaveLength(1);
    expect(afterImport.chunks[0].chunkId).toBe('chunk-a1');
    expect(afterImport.live.currentSceneId).toBe('a1-s01');
    expect(afterImport.live.visited['a1-s01']).toBe(true);

    // Add a live note targeting scene a1-s01
    const liveWithNote = {
      ...afterImport.live,
      notes: [
        {
          id: 'note-1',
          targetId: 'a1-s01',
          text: 'Airlock forced open',
          createdAt: 1000,
        },
      ],
    };
    await db.live.put(liveWithNote);

    // Re-import the same chunk_id with an updated title -> replaces existing chunk
    const updatedObj = JSON.parse(sampleRawText) as Record<string, unknown>;
    (updatedObj.meta as Record<string, unknown>).chunk_title = 'Act 1 Updated';
    const afterReimport = await importChunk(JSON.stringify(updatedObj), 'camp-relay');
    expect(afterReimport.chunks).toHaveLength(1);
    expect(afterReimport.chunks[0].chunkTitle).toBe('Act 1 Updated');
    expect(afterReimport.live.notes).toHaveLength(1);

    // Delete the chunk -> live note targeting a1-s01 moves to looseNotes
    const afterDelete = await deleteChunk('camp-relay', 'chunk-a1');
    expect(afterDelete?.chunks).toHaveLength(0);
    expect(afterDelete?.live.notes).toHaveLength(0);
    expect(afterDelete?.live.looseNotes).toHaveLength(1);
    expect(afterDelete?.live.looseNotes[0].text).toBe('Airlock forced open');
  });

  it('deletes a campaign along with its chunks, live state, map blobs, and pending saveLive timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await createCampaign({
        id: 'camp-del',
        title: 'Doomed Expedition',
        system: 'Mothership 1e',
        genre: 'sci-fi horror',
      });
      await importChunk(sampleRawText, 'camp-del');
      await putBlob('map:camp-del-1', new Uint8Array([9, 8, 7]), 'image/png');
      await putBlob('map:other-camp', new Uint8Array([1, 2, 3]), 'image/png');

      const pendingLive = createDefaultLiveState('camp-del', 'scifi');
      pendingLive.maps = [
        {
          id: 'm1',
          name: 'Deck 1',
          blobKey: 'map:camp-del-1',
          width: 800,
          height: 600,
        },
      ];
      const savePromise = saveLive(pendingLive);

      await deleteCampaign('camp-del');
      await vi.advanceTimersByTimeAsync(600);
      await savePromise;

      expect(await db.campaigns.get('camp-del')).toBeUndefined();
      expect(await db.chunks.where('campaignId').equals('camp-del').count()).toBe(0);
      expect(await db.live.get('camp-del')).toBeUndefined();
      expect(await getBlob('map:camp-del-1')).toBeUndefined();
      expect(await getBlob('map:other-camp')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('round-trips campaign, chunks, live layer, and map blobs via exportBackup and importBackup', async () => {
    const created = await importChunk(sampleRawText, 'camp-backup-1');

    // Attach a map blob and a PDF blob (PDF must be excluded from backup)
    await putBlob('map:deck-1', new Uint8Array([10, 20, 30, 40]), 'image/png');
    await putBlob(`pdf:${created.campaign.moduleId}`, new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'application/pdf', {
      fileName: 'module.pdf',
      fileSize: 4,
    });

    const updatedLive = {
      ...created.live,
      currentSceneId: 'act-1-s01',
      visited: { 'act-1-s01': true },
      notes: [{ id: 'n-1', targetId: 'act-1-s01', text: 'Table change note', createdAt: 12345 }],
      looseNotes: [{ id: 'ln-1', targetId: 'loose', text: 'Loose note', createdAt: 12346 }],
      maps: [{ id: 'deck-1', name: 'Deck 1', blobKey: 'map:deck-1', width: 800, height: 600 }],
    };
    await db.live.put(updatedLive);

    const payload = await exportBackup('camp-backup-1');
    expect(payload.format).toBe('gm-workspace-backup');
    expect(payload.version).toBe(1);
    expect(payload.campaign.lastBackupAt).toEqual(expect.any(Number));
    expect(Object.keys(payload.maps)).toEqual(['map:deck-1']);
    expect(JSON.stringify(payload)).not.toContain('module.pdf');

    // Delete campaign and map blob, keep PDF blob first
    await deleteCampaign('camp-backup-1');
    expect(await loadCampaign('camp-backup-1')).toBeNull();

    const restored = await importBackup(JSON.stringify(payload), { mode: 'replace' });
    expect(restored.pdfMissing).toBe(false);
    expect(restored.campaign.id).toBe(payload.campaign.id);
    expect(restored.campaign.title).toBe(payload.campaign.title);
    expect(restored.campaign.lastBackupAt).toBe(payload.campaign.lastBackupAt);
    expect(restored.chunks.length).toBe(1);
    expect(restored.live.currentSceneId).toBe('act-1-s01');
    expect(restored.live.visited).toEqual({ 'act-1-s01': true });
    expect(restored.live.notes).toEqual(updatedLive.notes);
    expect(restored.live.looseNotes).toEqual(updatedLive.looseNotes);

    const restoredMap = await getBlob('map:deck-1');
    expect(restoredMap).toBeDefined();
    expect(Array.from(restoredMap!.data as Uint8Array)).toEqual([10, 20, 30, 40]);

    // Remove PDF blob and restore as a new campaign -> pdfMissing should be true
    await db.blobs.delete(`pdf:${created.campaign.moduleId}`);
    const restoredNew = await importBackup(JSON.stringify(payload), { mode: 'new' });
    expect(restoredNew.pdfMissing).toBe(true);
    expect(restoredNew.campaign.id).not.toBe('camp-backup-1');
    expect(restoredNew.live.campaignId).toBe(restoredNew.campaign.id);
  });

  it('rejects invalid backup JSON, wrong format, or unsupported version', async () => {
    await expect(importBackup('not json')).rejects.toThrow(/Invalid backup file/i);
    await expect(importBackup(JSON.stringify({ format: 'other', version: 1 }))).rejects.toThrow(/wrong format/i);
    await expect(importBackup(JSON.stringify({ format: 'gm-workspace-backup', version: 99 }))).rejects.toThrow(/Unsupported backup version/i);
  });

  it('preserves optional map scale, pins, and sceneMap across backup and restore', async () => {
    const created = await createCampaign({ id: 'camp-map-scale', title: 'Map Scale Camp' });
    await putBlob('map:camp-map-scale:m1', new Uint8Array([1, 2, 3]), 'image/png');
    const updatedLive = {
      ...created.live,
      maps: [
        {
          id: 'm1',
          name: 'District Map',
          blobKey: 'map:camp-map-scale:m1',
          width: 1200,
          height: 900,
          scale: 'District' as const,
        },
      ],
      pins: { 's1': { mapId: 'm1', xPct: 42.5, yPct: 68.25 } },
      sceneMap: { 's1': 'm1' },
    };
    await db.live.put(updatedLive);

    const payload = await exportBackup('camp-map-scale');
    await deleteCampaign('camp-map-scale');
    const restored = await importBackup(JSON.stringify(payload), { mode: 'replace' });

    expect(restored.live.maps[0].scale).toBe('District');
    expect(restored.live.pins).toEqual({ s1: { mapId: 'm1', xPct: 42.5, yPct: 68.25 } });
    expect(restored.live.sceneMap).toEqual({ s1: 'm1' });
  });

  it('persists pdfRibbons per moduleId in LiveState and round-trips them across exportBackup and importBackup', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { useCampaignStore } = await import('../store/campaignStore');
      await useCampaignStore.getState().createNewCampaign({
        title: 'Ribbon Test Campaign',
        system: 'Mothership',
        genre: 'sci-fi',
      });
      const campId = useCampaignStore.getState().activeCampaign!.id;
      const modId = useCampaignStore.getState().activeCampaign!.moduleId;

      const r1 = useCampaignStore.getState().addPdfRibbon({
        moduleId: modId,
        label: 'Weapons Table',
        color: 'red',
        pdfPage: 14,
        printedPage: 12,
      });
      const r2 = useCampaignStore.getState().addPdfRibbon({
        moduleId: modId,
        label: 'Boss Room',
        color: 'gold',
        pdfPage: 28,
        printedPage: 26,
      });
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();

      useCampaignStore.getState().updatePdfRibbon(modId, r1!.id, {
        label: 'Armor & Weapons',
        color: 'teal',
      });
      useCampaignStore.getState().movePdfRibbonToPage(modId, r2!.id, 30, 28);

      await vi.advanceTimersByTimeAsync(600);

      const storedLive = await db.live.get(campId);
      expect(storedLive?.pdfRibbons?.[modId]).toHaveLength(2);
      expect(storedLive?.pdfRibbons?.[modId][0]).toMatchObject({
        id: r1!.id,
        label: 'Armor & Weapons',
        color: 'teal',
        pdfPage: 14,
        printedPage: 12,
      });
      expect(storedLive?.pdfRibbons?.[modId][1]).toMatchObject({
        id: r2!.id,
        label: 'Boss Room',
        color: 'gold',
        pdfPage: 30,
        printedPage: 28,
      });

      useCampaignStore.getState().deletePdfRibbon(modId, r2!.id);
      await vi.advanceTimersByTimeAsync(600);

      const payload = await exportBackup(campId);
      await deleteCampaign(campId);
      const restored = await importBackup(JSON.stringify(payload), { mode: 'replace' });

      expect(restored.live.pdfRibbons?.[modId]).toHaveLength(1);
      expect(restored.live.pdfRibbons?.[modId][0]).toMatchObject({
        id: r1!.id,
        label: 'Armor & Weapons',
        color: 'teal',
        pdfPage: 14,
        printedPage: 12,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists Desk state (cards, viewport, snapToGrid, viewMode) in LiveState and round-trips through exportBackup and importBackup', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { useCampaignStore } = await import('../store/campaignStore');
      await useCampaignStore.getState().createNewCampaign({
        title: 'Desk Backup Test Campaign',
        system: 'Mothership',
        genre: 'sci-fi',
      });
      const campId = useCampaignStore.getState().activeCampaign!.id;

      useCampaignStore.getState().setDeskViewMode('desk');
      useCampaignStore.getState().setDeskSnapToGrid(true);
      useCampaignStore.getState().setDeskViewport({ x: 140, y: -60, scale: 1.25 });

      const c1 = useCampaignStore.getState().addDeskCard({
        type: 'scene',
        title: 'Airlock Scene',
        followCurrentScene: true,
        x: 48,
        y: 72,
        width: 520,
        height: 400,
      });
      const c2 = useCampaignStore.getState().addDeskCard({
        type: 'sheet',
        title: 'Captain Vance',
        targetId: 'npc-vance',
        x: 600,
        y: 72,
        width: 360,
        height: 420,
      });
      expect(c1).not.toBeNull();
      expect(c2).not.toBeNull();

      useCampaignStore.getState().toggleDeskCardMinimized(c2!.id);
      await vi.advanceTimersByTimeAsync(600);

      const payload = await exportBackup(campId);
      await deleteCampaign(campId);
      const restored = await importBackup(JSON.stringify(payload), { mode: 'replace' });

      expect(restored.live.desk?.viewMode).toBe('desk');
      expect(restored.live.desk?.snapToGrid).toBe(true);
      expect(restored.live.desk?.viewport).toEqual({ x: 140, y: -60, scale: 1.25 });
      expect(restored.live.desk?.cards).toHaveLength(2);
      expect(restored.live.desk?.cards[0]).toMatchObject({
        id: c1!.id,
        type: 'scene',
        title: 'Airlock Scene',
        followCurrentScene: true,
        x: 48,
        y: 72,
        width: 520,
        height: 400,
        minimized: false,
      });
      expect(restored.live.desk?.cards[1]).toMatchObject({
        id: c2!.id,
        type: 'sheet',
        title: 'Captain Vance',
        targetId: 'npc-vance',
        x: 600,
        y: 72,
        width: 360,
        height: 420,
        minimized: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists Desk Standard layoutMode, savedFreeRects, and new content card types across backup round-trip', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { useCampaignStore } = await import('../store/campaignStore');
      await useCampaignStore.getState().createNewCampaign({
        title: 'Desk 8f Backup Test Campaign',
        system: 'Mothership',
        genre: 'sci-fi',
      });
      const campId = useCampaignStore.getState().activeCampaign!.id;
      await importChunk(sampleRawText, campId);
      await useCampaignStore.getState().openCampaign(campId);
      const store = useCampaignStore.getState();

      store.setDeskViewMode('desk');
      const follow = store.addDeskCard({
        type: 'scene',
        title: 'Current Scene',
        followCurrentScene: true,
        x: 120,
        y: 96,
        width: 540,
        height: 440,
      });
      const tracker = store.addDeskCard({
        type: 'tracker',
        title: 'Hull Integrity',
        targetId: 'tr-hull',
        x: 720,
        y: 144,
        width: 288,
        height: 192,
      });
      const notes = store.addDeskCard({
        type: 'notes',
        title: 'Notes',
        x: 1040,
        y: 120,
        width: 340,
        height: 320,
      });
      expect(follow && tracker && notes).toBeTruthy();

      // Switch to Standard layout — snapshots Free rects and rearranges cards
      useCampaignStore.getState().setDeskLayoutMode('standard', { width: 1180, height: 720 });
      await vi.advanceTimersByTimeAsync(600);

      const payload = await exportBackup(campId);
      await deleteCampaign(campId);
      const restored = await importBackup(JSON.stringify(payload), { mode: 'replace' });

      expect(restored.live.desk?.layoutMode).toBe('standard');
      expect(restored.live.desk?.savedFreeRects?.[follow!.id]).toEqual({
        x: 120,
        y: 96,
        width: 540,
        height: 440,
      });
      expect(restored.live.desk?.savedFreeRects?.[tracker!.id]).toEqual({
        x: 720,
        y: 144,
        width: 288,
        height: 192,
      });
      expect(restored.live.desk?.cards.map((c) => c.type)).toEqual([
        'scene',
        'tracker',
        'notes',
      ]);

      // Re-open restored campaign and switch back to Free — exact Free positions restored
      await useCampaignStore.getState().openCampaign(restored.campaign.id);
      useCampaignStore.getState().setDeskLayoutMode('free');
      const freeCards = useCampaignStore.getState().live?.desk?.cards ?? [];
      expect(freeCards.find((c) => c.id === follow!.id)).toMatchObject({
        x: 120,
        y: 96,
        width: 540,
        height: 440,
      });
      expect(freeCards.find((c) => c.id === tracker!.id)).toMatchObject({
        x: 720,
        y: 144,
        width: 288,
        height: 192,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('round-trips player sheets and sheetBlobs via exportBackup/importBackup and cleans blobs on deleteCampaign', async () => {
    const created = await importChunk(sampleRawText, 'camp-pc-backup');
    const imgKey = 'sheet:camp-pc-backup:pc-img';
    const pdfKey = 'sheet:camp-pc-backup:pc-pdf';
    await putBlob(imgKey, new Uint8Array([137, 80, 78, 71]), 'image/png', { fileName: 'aria.png' });
    await putBlob(pdfKey, new Uint8Array([37, 80, 68, 70]), 'application/pdf', { fileName: 'jax.pdf' });

    const updatedLive = {
      ...created.live,
      playerSheets: [
        {
          id: 'pc-pre',
          kind: 'prebuilt' as const,
          name: 'Kira Sol',
          role: 'Engineer',
          statLine: 'STR 12 · INT 16',
          tracks: [{ id: 'hp', label: 'HP', current: 9, max: 12 }],
          notes: 'Carries welding torch.',
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'pc-img',
          kind: 'image' as const,
          name: 'Aria',
          blobKey: imgKey,
          fileName: 'aria.png',
          mimeType: 'image/png',
          createdAt: 1001,
          updatedAt: 1001,
        },
        {
          id: 'pc-pdf',
          kind: 'pdf' as const,
          name: 'Jax',
          blobKey: pdfKey,
          fileName: 'jax.pdf',
          mimeType: 'application/pdf',
          currentPage: 2,
          createdAt: 1002,
          updatedAt: 1002,
        },
      ],
    };
    await db.live.put(updatedLive);

    const payload = await exportBackup('camp-pc-backup');
    expect(payload.sheetBlobs?.[imgKey]).toMatch(/^data:image\/png;base64,/);
    expect(payload.sheetBlobs?.[pdfKey]).toMatch(/^data:application\/pdf;base64,/);

    // Import as a NEW campaign: blobKeys must be remapped so deleting original leaves copy intact
    const importedNew = await importBackup(JSON.stringify(payload), { mode: 'new' });
    expect(importedNew.live.playerSheets).toHaveLength(3);
    const newImgSheet = importedNew.live.playerSheets?.find((s) => s.id === 'pc-img');
    const newPdfSheet = importedNew.live.playerSheets?.find((s) => s.id === 'pc-pdf');
    expect(newImgSheet?.blobKey).toBe(`sheet:${importedNew.campaign.id}:pc-img`);
    expect(newPdfSheet?.blobKey).toBe(`sheet:${importedNew.campaign.id}:pc-pdf`);

    // Delete original campaign -> its sheet blobs are removed, new campaign's blobs survive
    await deleteCampaign('camp-pc-backup');
    expect(await getBlob(imgKey)).toBeUndefined();
    expect(await getBlob(pdfKey)).toBeUndefined();

    const restoredImgBlob = await getBlob(newImgSheet!.blobKey!);
    const restoredPdfBlob = await getBlob(newPdfSheet!.blobKey!);
    expect(Array.from(restoredImgBlob?.data as Uint8Array)).toEqual([137, 80, 78, 71]);
    expect(Array.from(restoredPdfBlob?.data as Uint8Array)).toEqual([37, 80, 68, 70]);

    // Replace restore on original id also restores sheet blobs
    const restoredReplace = await importBackup(JSON.stringify(payload), { mode: 'replace' });
    expect(restoredReplace.live.playerSheets).toHaveLength(3);
    expect(restoredReplace.live.playerSheets?.[2].currentPage).toBe(2);
    expect(Array.from((await getBlob(imgKey))?.data as Uint8Array)).toEqual([137, 80, 78, 71]);
  });

  it('imports legacy backups without playerSheets or sheetBlobs cleanly', async () => {
    await importChunk(sampleRawText, 'camp-legacy');
    const payload = await exportBackup('camp-legacy');
    const legacyJson = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    delete legacyJson.sheetBlobs;
    delete (legacyJson.live as Record<string, unknown>).playerSheets;

    await deleteCampaign('camp-legacy');
    const restored = await importBackup(JSON.stringify(legacyJson), { mode: 'replace' });
    expect(restored.campaign.id).toBe('camp-legacy');
    expect(restored.live.playerSheets).toEqual([]);
  });

  it('round-trips pinned sheet overlays across exportBackup and importBackup in replace and new modes', async () => {
    const created = await importChunk(sampleRawText, 'camp-pc-overlays');
    const imgKey = 'sheet:camp-pc-overlays:pc-img';
    const pdfKey = 'sheet:camp-pc-overlays:pc-pdf';
    await putBlob(imgKey, new Uint8Array([137, 80, 78, 71]), 'image/png', { fileName: 'hero.png' });
    await putBlob(pdfKey, new Uint8Array([37, 80, 68, 70]), 'application/pdf', { fileName: 'hero.pdf' });

    const imgOverlays = [
      { id: 'ov-1', kind: 'text' as const, xPct: 25.5, yPct: 40, label: 'Name', text: 'Vex', color: 'gold' as const },
      { id: 'ov-2', kind: 'dot' as const, xPct: 55, yPct: 62.5, active: true, color: 'red' as const },
      { id: 'ov-3', kind: 'counter' as const, xPct: 75, yPct: 20, label: 'HP', value: 14, color: 'teal' as const },
    ];
    const pdfOverlays = [
      { id: 'ov-p1', kind: 'counter' as const, xPct: 30, yPct: 30, page: 1, value: 5, color: 'accent' as const },
      { id: 'ov-p2', kind: 'text' as const, xPct: 60, yPct: 70, page: 2, text: 'Page 2 note', color: 'violet' as const },
    ];

    await db.live.put({
      ...created.live,
      playerSheets: [
        {
          id: 'pc-img',
          kind: 'image' as const,
          name: 'Hero Img',
          blobKey: imgKey,
          fileName: 'hero.png',
          mimeType: 'image/png',
          overlays: imgOverlays,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'pc-pdf',
          kind: 'pdf' as const,
          name: 'Hero PDF',
          blobKey: pdfKey,
          fileName: 'hero.pdf',
          mimeType: 'application/pdf',
          currentPage: 2,
          overlays: pdfOverlays,
          createdAt: 1001,
          updatedAt: 1001,
        },
      ],
    });

    const payload = await exportBackup('camp-pc-overlays');

    const importedNew = await importBackup(JSON.stringify(payload), { mode: 'new' });
    expect(importedNew.live.playerSheets?.find((s) => s.id === 'pc-img')?.overlays).toEqual(imgOverlays);
    expect(importedNew.live.playerSheets?.find((s) => s.id === 'pc-pdf')?.overlays).toEqual(pdfOverlays);

    await deleteCampaign('camp-pc-overlays');
    const restoredReplace = await importBackup(JSON.stringify(payload), { mode: 'replace' });
    expect(restoredReplace.live.playerSheets?.find((s) => s.id === 'pc-img')?.overlays).toEqual(imgOverlays);
    expect(restoredReplace.live.playerSheets?.find((s) => s.id === 'pc-pdf')?.overlays).toEqual(pdfOverlays);
  });
});
