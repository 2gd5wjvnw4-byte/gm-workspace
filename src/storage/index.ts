import Dexie, { type Table } from 'dexie';
import {
  type BackupPayload,
  type BlobRecord,
  type CampaignRecord,
  type ChunkRecord,
  createDefaultLiveState,
  type LiveState,
  type LoadedCampaign,
} from './types';
import { defaultThemeForGenre } from '../store/themeStore';
import { mergeRawChunkObjects, parseModuleChunk, reconcileLiveNotes } from '../lib/import';

export * from './types';

class GMWorkspaceDB extends Dexie {
  campaigns!: Table<CampaignRecord, string>;
  chunks!: Table<ChunkRecord, string>;
  live!: Table<LiveState, string>;
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super('gm-workspace-db');
    this.version(1).stores({
      campaigns: 'id, moduleId, updatedAt',
      chunks: 'id, campaignId, chunkId, importedAt',
      live: 'campaignId',
      blobs: 'key, updatedAt',
    });
  }
}

export const db = new GMWorkspaceDB();

const LIVE_DEBOUNCE_MS = 500;
const pendingLiveTimers = new Map<
  string,
  {
    timer: ReturnType<typeof setTimeout>;
    state: LiveState;
    resolvers: Array<() => void>;
    rejecters: Array<(err: unknown) => void>;
  }
>();

export async function listCampaigns(): Promise<CampaignRecord[]> {
  const rows = await db.campaigns.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createCampaign(input: {
  id?: string;
  title: string;
  system?: string;
  genre?: string;
  moduleId?: string;
}): Promise<LoadedCampaign> {
  const now = Date.now();
  const title = input.title.trim() || 'Untitled Campaign';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'campaign';
  const id = input.id ?? `camp-${slug}-${now}`;
  const genre = input.genre?.trim() || 'sci-fi';

  const campaign: CampaignRecord = {
    id,
    moduleId: input.moduleId?.trim() || `mod-${slug}`,
    title,
    system: input.system?.trim() || '',
    genre,
    updatedAt: now,
    lastBackupAt: null,
  };

  const live = createDefaultLiveState(id, defaultThemeForGenre(genre));
  await db.campaigns.put(campaign);
  await db.live.put(live);

  return { campaign, chunks: [], live };
}

export async function loadCampaign(campaignId: string): Promise<LoadedCampaign | null> {
  const campaign = await db.campaigns.get(campaignId);
  if (!campaign) {
    return null;
  }
  const chunks = await db.chunks.where('campaignId').equals(campaignId).toArray();
  chunks.sort((a, b) => a.importedAt - b.importedAt);

  const pending = pendingLiveTimers.get(campaignId);
  let live = pending?.state ?? (await db.live.get(campaignId));
  if (!live) {
    live = createDefaultLiveState(campaignId, defaultThemeForGenre(campaign.genre));
    await db.live.put(live);
  }
  return { campaign, chunks, live };
}

export function saveLive(liveState: LiveState): Promise<void> {
  const { campaignId } = liveState;
  const existing = pendingLiveTimers.get(campaignId);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const resolvers = existing ? existing.resolvers : [];
  const rejecters = existing ? existing.rejecters : [];

  return new Promise<void>((resolve, reject) => {
    resolvers.push(resolve);
    rejecters.push(reject);

    const nextState: LiveState = {
      ...liveState,
      updatedAt: Date.now(),
    };

    const timer = setTimeout(async () => {
      pendingLiveTimers.delete(campaignId);
      try {
        await db.live.put(nextState);
        for (const r of resolvers) r();
      } catch (err) {
        for (const rj of rejecters) rj(err);
      }
    }, LIVE_DEBOUNCE_MS);

    pendingLiveTimers.set(campaignId, {
      timer,
      state: nextState,
      resolvers,
      rejecters,
    });
  });
}

export async function putBlob(
  key: string,
  data: Blob | Uint8Array | string,
  mimeType = 'application/octet-stream'
): Promise<void> {
  await db.blobs.put({
    key,
    data,
    mimeType,
    updatedAt: Date.now(),
  });
}

export async function getBlob(key: string): Promise<BlobRecord | undefined> {
  return db.blobs.get(key);
}

export async function requestPersist(): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persist === 'function'
  ) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export async function importChunk(
  rawJsonText: string,
  campaignId?: string
): Promise<LoadedCampaign> {
  const { chunk } = parseModuleChunk(rawJsonText);
  const now = Date.now();
  const targetCampaignId = campaignId ?? `camp-${chunk.meta.module_id}`;

  const existingCampaign = await db.campaigns.get(targetCampaignId);
  const existingChunksForCamp = existingCampaign
    ? await db.chunks.where('campaignId').equals(targetCampaignId).toArray()
    : [];

  const isFirstChunk = existingChunksForCamp.length === 0;
  const campaign: CampaignRecord = existingCampaign
    ? {
        ...existingCampaign,
        moduleId:
          isFirstChunk || existingCampaign.moduleId.startsWith('mod-')
            ? chunk.meta.module_id
            : existingCampaign.moduleId,
        title:
          isFirstChunk && existingCampaign.title === 'Untitled Campaign'
            ? chunk.meta.title
            : existingCampaign.title || chunk.meta.title,
        system: existingCampaign.system || chunk.meta.system,
        genre: existingCampaign.genre || chunk.meta.genre,
        updatedAt: now,
      }
    : {
        id: targetCampaignId,
        moduleId: chunk.meta.module_id,
        title: chunk.meta.title,
        system: chunk.meta.system,
        genre: chunk.meta.genre,
        updatedAt: now,
        lastBackupAt: null,
      };

  const chunkRecordId = `${targetCampaignId}:${chunk.meta.chunk_id}`;
  const existingChunkRow = await db.chunks.get(chunkRecordId);

  const chunkRecord: ChunkRecord = {
    id: chunkRecordId,
    campaignId: targetCampaignId,
    chunkId: chunk.meta.chunk_id,
    chunkTitle: chunk.meta.chunk_title,
    chunkPages: chunk.meta.chunk_pages,
    complete: chunk.meta.complete,
    stoppedAtPage: chunk.meta.stopped_at_page,
    rawJson: chunk.rawJson,
    // Keep original importedAt order on re-import so chunk order stays stable, or update if new
    importedAt: existingChunkRow ? existingChunkRow.importedAt : now,
  };

  await db.campaigns.put(campaign);
  await db.chunks.put(chunkRecord);

  const allChunks = await db.chunks.where('campaignId').equals(targetCampaignId).toArray();
  allChunks.sort((a, b) => a.importedAt - b.importedAt);

  const pending = pendingLiveTimers.get(targetCampaignId);
  let live =
    pending?.state ??
    (await db.live.get(targetCampaignId)) ??
    createDefaultLiveState(targetCampaignId, defaultThemeForGenre(campaign.genre));

  const merged = mergeRawChunkObjects(allChunks.map((c) => c.rawJson));
  live = reconcileLiveNotes(live, merged);
  if (!live.currentSceneId && merged.scenes.length > 0) {
    const firstSceneId = merged.scenes[0].id;
    live = {
      ...live,
      currentSceneId: firstSceneId,
      visited: {
        ...live.visited,
        [firstSceneId]: true,
      },
    };
  } else if (live.currentSceneId && !live.visited[live.currentSceneId]) {
    live = {
      ...live,
      visited: {
        ...live.visited,
        [live.currentSceneId]: true,
      },
    };
  }
  await db.live.put(live);

  return {
    campaign,
    chunks: allChunks,
    live,
  };
}

export async function deleteChunk(
  campaignId: string,
  chunkId: string
): Promise<LoadedCampaign | null> {
  const campaign = await db.campaigns.get(campaignId);
  if (!campaign) {
    return null;
  }

  const chunkRecordId = `${campaignId}:${chunkId}`;
  await db.chunks.delete(chunkRecordId);

  const remaining = await db.chunks.where('campaignId').equals(campaignId).toArray();
  for (const row of remaining) {
    if (row.chunkId === chunkId) {
      await db.chunks.delete(row.id);
    }
  }

  const updatedChunks = await db.chunks.where('campaignId').equals(campaignId).toArray();
  updatedChunks.sort((a, b) => a.importedAt - b.importedAt);

  const updatedCampaign: CampaignRecord = {
    ...campaign,
    updatedAt: Date.now(),
  };
  await db.campaigns.put(updatedCampaign);

  const pending = pendingLiveTimers.get(campaignId);
  let live =
    pending?.state ??
    (await db.live.get(campaignId)) ??
    createDefaultLiveState(campaignId, defaultThemeForGenre(campaign.genre));

  const merged = mergeRawChunkObjects(updatedChunks.map((c) => c.rawJson));
  live = reconcileLiveNotes(live, merged);
  await db.live.put(live);

  return {
    campaign: updatedCampaign,
    chunks: updatedChunks,
    live,
  };
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const pending = pendingLiveTimers.get(campaignId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingLiveTimers.delete(campaignId);
    for (const r of pending.resolvers) r();
  }

  await db.transaction('rw', db.campaigns, db.chunks, db.live, db.blobs, async () => {
    const live = pending?.state ?? (await db.live.get(campaignId));
    if (live?.maps && live.maps.length > 0) {
      const blobKeys = live.maps.map((m) => m.blobKey).filter(Boolean);
      if (blobKeys.length > 0) {
        await db.blobs.bulkDelete(blobKeys);
      }
    }
    await db.chunks.where('campaignId').equals(campaignId).delete();
    await db.live.delete(campaignId);
    await db.campaigns.delete(campaignId);
  });
}

export async function exportBackup(_campaignId: string): Promise<BackupPayload> {
  throw new Error('not implemented');
}

export async function importBackup(_backupJsonText: string): Promise<never> {
  throw new Error('not implemented');
}
