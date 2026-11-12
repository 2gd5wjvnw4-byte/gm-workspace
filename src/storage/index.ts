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

export async function importChunk(_rawJsonText: string, _campaignId?: string): Promise<never> {
  throw new Error('not implemented');
}

export async function deleteChunk(_campaignId: string, _chunkId: string): Promise<never> {
  throw new Error('not implemented');
}

export async function exportBackup(_campaignId: string): Promise<BackupPayload> {
  throw new Error('not implemented');
}

export async function importBackup(_backupJsonText: string): Promise<never> {
  throw new Error('not implemented');
}
