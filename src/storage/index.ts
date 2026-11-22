import Dexie, { type Table } from 'dexie';
import {
  type BackupPayload,
  type BlobRecord,
  type CampaignRecord,
  type ChunkRecord,
  createDefaultLiveState,
  type ImportedBackupResult,
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

export function pdfBlobKey(moduleId: string): string {
  return `pdf:${moduleId}`;
}

export function playerSheetBlobKey(campaignId: string, sheetId: string): string {
  return `sheet:${campaignId}:${sheetId}`;
}

export async function putBlob(
  key: string,
  data: Blob | Uint8Array | string,
  mimeType = 'application/octet-stream',
  meta?: { fileName?: string; fileSize?: number }
): Promise<void> {
  await db.blobs.put({
    key,
    data,
    mimeType,
    ...(meta?.fileName !== undefined ? { fileName: meta.fileName } : {}),
    ...(meta?.fileSize !== undefined ? { fileSize: meta.fileSize } : {}),
    updatedAt: Date.now(),
  });
}

export async function getBlob(key: string): Promise<BlobRecord | undefined> {
  return db.blobs.get(key);
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key);
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
    const blobKeys: string[] = [];
    if (live?.maps && live.maps.length > 0) {
      blobKeys.push(...live.maps.map((m) => m.blobKey).filter(Boolean));
    }
    if (live?.playerSheets && live.playerSheets.length > 0) {
      for (const sheet of live.playerSheets) {
        if (sheet.blobKey) blobKeys.push(sheet.blobKey);
      }
    }
    if (blobKeys.length > 0) {
      await db.blobs.bulkDelete(blobKeys);
    }
    await db.chunks.where('campaignId').equals(campaignId).delete();
    await db.live.delete(campaignId);
    await db.campaigns.delete(campaignId);
  });
}

async function blobDataToBase64(data: Blob | Uint8Array | string, mimeType: string): Promise<string> {
  if (typeof data === 'string') {
    if (data.startsWith('data:')) return data;
    const bytes = new TextEncoder().encode(data);
    return `data:${mimeType || 'text/plain'};base64,${uint8ToBase64(bytes)}`;
  }

  let bytes: Uint8Array;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (typeof data.arrayBuffer === 'function') {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else {
    const buf = await new Response(data).arrayBuffer();
    bytes = new Uint8Array(buf);
  }
  return `data:${mimeType || 'application/octet-stream'};base64,${uint8ToBase64(bytes)}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBlobData(encoded: string): { bytes: Uint8Array; mimeType: string } {
  let mimeType = 'application/octet-stream';
  let b64 = encoded;
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(encoded);
  if (match) {
    mimeType = match[1] || mimeType;
    b64 = match[2];
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mimeType };
}

export function parseBackupPayload(backupJsonText: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(backupJsonText);
  } catch {
    throw new Error('Invalid backup file: not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file: expected a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'gm-workspace-backup') {
    throw new Error('Invalid backup file: wrong format.');
  }
  if (obj.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(obj.version)}.`);
  }

  const campaign = obj.campaign as Record<string, unknown> | undefined;
  if (
    !campaign ||
    typeof campaign !== 'object' ||
    typeof campaign.id !== 'string' ||
    typeof campaign.moduleId !== 'string' ||
    typeof campaign.title !== 'string'
  ) {
    throw new Error('Invalid backup file: missing campaign metadata.');
  }

  if (!Array.isArray(obj.chunks)) {
    throw new Error('Invalid backup file: chunks must be an array.');
  }
  if (!obj.live || typeof obj.live !== 'object') {
    throw new Error('Invalid backup file: missing live state.');
  }
  if (obj.maps !== undefined && (typeof obj.maps !== 'object' || obj.maps === null || Array.isArray(obj.maps))) {
    throw new Error('Invalid backup file: maps must be an object.');
  }
  if (
    obj.sheetBlobs !== undefined &&
    (typeof obj.sheetBlobs !== 'object' || obj.sheetBlobs === null || Array.isArray(obj.sheetBlobs))
  ) {
    throw new Error('Invalid backup file: sheetBlobs must be an object.');
  }

  return {
    format: 'gm-workspace-backup',
    version: 1,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    campaign: obj.campaign as CampaignRecord,
    chunks: obj.chunks as ChunkRecord[],
    live: obj.live as LiveState,
    maps: (obj.maps as Record<string, string> | undefined) ?? {},
    ...(obj.sheetBlobs !== undefined
      ? { sheetBlobs: obj.sheetBlobs as Record<string, string> }
      : {}),
  };
}

export async function exportBackup(campaignId: string): Promise<BackupPayload> {
  const pending = pendingLiveTimers.get(campaignId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingLiveTimers.delete(campaignId);
    await db.live.put(pending.state);
    for (const r of pending.resolvers) r();
  }

  const campaign = await db.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  const chunks = await db.chunks.where('campaignId').equals(campaignId).toArray();
  chunks.sort((a, b) => a.importedAt - b.importedAt);

  const live =
    (await db.live.get(campaignId)) ??
    createDefaultLiveState(campaignId, defaultThemeForGenre(campaign.genre));

  const maps: Record<string, string> = {};
  for (const mapAsset of live.maps ?? []) {
    if (!mapAsset.blobKey) continue;
    const blob = await db.blobs.get(mapAsset.blobKey);
    if (blob) {
      maps[mapAsset.blobKey] = await blobDataToBase64(blob.data, blob.mimeType);
    }
  }

  const sheetBlobs: Record<string, string> = {};
  for (const sheet of live.playerSheets ?? []) {
    if (!sheet.blobKey) continue;
    const blob = await db.blobs.get(sheet.blobKey);
    if (blob) {
      sheetBlobs[sheet.blobKey] = await blobDataToBase64(blob.data, blob.mimeType);
    }
  }

  const now = Date.now();
  const updatedCampaign: CampaignRecord = {
    ...campaign,
    lastBackupAt: now,
  };
  await db.campaigns.put(updatedCampaign);

  return {
    format: 'gm-workspace-backup',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    campaign: updatedCampaign,
    chunks,
    live,
    maps,
    ...(Object.keys(sheetBlobs).length > 0 ? { sheetBlobs } : {}),
  };
}

export async function importBackup(
  backupJsonText: string,
  options?: { mode?: 'new' | 'replace'; targetCampaignId?: string }
): Promise<ImportedBackupResult> {
  const payload = parseBackupPayload(backupJsonText);
  const mode = options?.mode ?? 'replace';

  const existingCampaignId = options?.targetCampaignId ?? payload.campaign.id;
  const targetCampaignId =
    mode === 'new'
      ? `camp-${(payload.campaign.moduleId || 'backup').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      : existingCampaignId;

  const restoredCampaign: CampaignRecord = {
    ...payload.campaign,
    id: targetCampaignId,
    updatedAt: payload.campaign.updatedAt || Date.now(),
  };

  const restoredChunks: ChunkRecord[] = payload.chunks.map((c) => ({
    ...c,
    id: `${targetCampaignId}:${c.chunkId}`,
    campaignId: targetCampaignId,
  }));

  // Remap map and player-sheet blobKeys when restoring as a new campaign so deleting one doesn't wipe the other's blobs
  const blobKeyMap = new Map<string, string>();
  const restoredMapsMeta = (payload.live.maps ?? []).map((m) => {
    if (mode === 'new') {
      const nextKey = `map:${targetCampaignId}:${m.id}`;
      blobKeyMap.set(m.blobKey, nextKey);
      return { ...m, blobKey: nextKey };
    }
    blobKeyMap.set(m.blobKey, m.blobKey);
    return m;
  });

  const sheetBlobKeyMap = new Map<string, string>();
  const restoredPlayerSheets = (payload.live.playerSheets ?? []).map((sheet) => {
    if (!sheet.blobKey) return sheet;
    if (mode === 'new') {
      const nextKey = playerSheetBlobKey(targetCampaignId, sheet.id);
      sheetBlobKeyMap.set(sheet.blobKey, nextKey);
      return { ...sheet, blobKey: nextKey };
    }
    sheetBlobKeyMap.set(sheet.blobKey, sheet.blobKey);
    return sheet;
  });

  const restoredLive: LiveState = {
    ...payload.live,
    campaignId: targetCampaignId,
    maps: restoredMapsMeta,
    playerSheets: restoredPlayerSheets,
  };

  await db.transaction('rw', db.campaigns, db.chunks, db.live, db.blobs, async () => {
    if (mode === 'replace') {
      const prevLive = await db.live.get(targetCampaignId);
      const oldKeys: string[] = [];
      if (prevLive?.maps && prevLive.maps.length > 0) {
        oldKeys.push(...prevLive.maps.map((m) => m.blobKey).filter(Boolean));
      }
      if (prevLive?.playerSheets && prevLive.playerSheets.length > 0) {
        for (const sheet of prevLive.playerSheets) {
          if (sheet.blobKey) oldKeys.push(sheet.blobKey);
        }
      }
      if (oldKeys.length > 0) {
        await db.blobs.bulkDelete(oldKeys);
      }
      await db.chunks.where('campaignId').equals(targetCampaignId).delete();
      await db.live.delete(targetCampaignId);
      await db.campaigns.delete(targetCampaignId);
    }

    await db.campaigns.put(restoredCampaign);
    if (restoredChunks.length > 0) {
      await db.chunks.bulkPut(restoredChunks);
    }
    await db.live.put(restoredLive);

    const now = Date.now();
    for (const [origKey, encoded] of Object.entries(payload.maps ?? {})) {
      const destKey = blobKeyMap.get(origKey) ?? (mode === 'new' ? `map:${targetCampaignId}:${origKey}` : origKey);
      const { bytes, mimeType } = base64ToBlobData(encoded);
      await db.blobs.put({
        key: destKey,
        data: bytes,
        mimeType,
        updatedAt: now,
      });
    }
    for (const [origKey, encoded] of Object.entries(payload.sheetBlobs ?? {})) {
      const destKey =
        sheetBlobKeyMap.get(origKey) ??
        (mode === 'new' ? `sheet:${targetCampaignId}:${origKey}` : origKey);
      const { bytes, mimeType } = base64ToBlobData(encoded);
      await db.blobs.put({
        key: destKey,
        data: bytes,
        mimeType,
        updatedAt: now,
      });
    }
  });

  const pdfRecord = await db.blobs.get(pdfBlobKey(restoredCampaign.moduleId));

  return {
    campaign: restoredCampaign,
    chunks: restoredChunks,
    live: restoredLive,
    pdfMissing: !pdfRecord,
  };
}
