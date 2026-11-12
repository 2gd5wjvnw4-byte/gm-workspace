import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultLiveState,
  db,
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

  it('throws "not implemented" for stubbed Phase 2 / Phase 7 functions', async () => {
    await expect(importChunk('{}')).rejects.toThrow('not implemented');
    await expect(deleteChunk('camp-1', 'a1')).rejects.toThrow('not implemented');
    await expect(exportBackup('camp-1')).rejects.toThrow('not implemented');
    await expect(importBackup('{}')).rejects.toThrow('not implemented');
  });
});
