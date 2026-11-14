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

  it('throws "not implemented" for stubbed Phase 7 backup functions', async () => {
    await expect(exportBackup('camp-1')).rejects.toThrow('not implemented');
    await expect(importBackup('{}')).rejects.toThrow('not implemented');
  });
});
