import type { LiveState } from '../../storage/types';
import { checkModuleLinks } from './linkChecker';
import { parseModuleChunk } from './parser';
import type {
  MergedCampaignData,
  ModuleChunk,
  ParseChunkResult,
  ReviewEntry,
} from './types';

export function upsertParsedChunk(
  existing: ParseChunkResult[],
  incoming: ParseChunkResult
): ParseChunkResult[] {
  const chunkId = incoming.chunk.meta.chunk_id;
  const idx = existing.findIndex((c) => c.chunk.meta.chunk_id === chunkId);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = incoming;
    return next;
  }
  return [...existing, incoming];
}

export function mergeParsedChunks(parsedChunks: ParseChunkResult[]): MergedCampaignData {
  // Deduplicate by chunk_id in case raw array has two chunks with the same chunk_id (later wins)
  const deduplicated: ParseChunkResult[] = [];
  for (const item of parsedChunks) {
    const existingIdx = deduplicated.findIndex(
      (c) => c.chunk.meta.chunk_id === item.chunk.meta.chunk_id
    );
    if (existingIdx >= 0) {
      deduplicated[existingIdx] = item;
    } else {
      deduplicated.push(item);
    }
  }

  const mergeReview: ReviewEntry[] = [];
  const parserReview: ReviewEntry[] = [];
  const recordSourceChunk: Record<string, string> = {};

  const mergeById = <T extends { id: string }>(
    sectionGetter: (chunk: ModuleChunk) => T[],
    sectionLabel: string
  ): T[] => {
    const map = new Map<string, { item: T; chunkId: string }>();
    for (const { chunk } of deduplicated) {
      const cId = chunk.meta.chunk_id;
      for (const item of sectionGetter(chunk)) {
        const prev = map.get(item.id);
        if (prev && prev.chunkId !== cId) {
          mergeReview.push({
            severity: 'info',
            chunkId: cId,
            recordId: item.id,
            field: 'id',
            message: `Merged ${sectionLabel} "${item.id}" from chunk "${cId}" replaced earlier definition from "${prev.chunkId}".`,
          });
        }
        map.set(item.id, { item, chunkId: cId });
        recordSourceChunk[item.id] = cId;
      }
    }
    return Array.from(map.values()).map((v) => v.item);
  };

  for (const { review } of deduplicated) {
    parserReview.push(...review);
  }

  const trackers = mergeById((c) => c.trackers, 'tracker');
  const acts = mergeById((c) => c.acts, 'act');
  const scenes = mergeById((c) => c.scenes, 'scene');
  const connections = mergeById((c) => c.connections, 'connection');
  const entities = mergeById((c) => c.entities, 'entity');
  const truths = mergeById((c) => c.truths, 'truth');
  const clocks = mergeById((c) => c.clocks, 'clock');
  const timeline = mergeById((c) => c.timeline, 'timeline event');
  const factions = mergeById((c) => c.factions, 'faction');
  const random_tables = mergeById((c) => c.random_tables, 'random table');

  for (const scene of scenes) {
    const sChunk = recordSourceChunk[scene.id] ?? 'chunk-unknown';
    for (const item of [...scene.tier2_interactive, ...scene.tier3_hidden]) {
      recordSourceChunk[item.id] = sChunk;
    }
  }
  for (const entity of entities) {
    const eChunk = recordSourceChunk[entity.id] ?? 'chunk-unknown';
    for (const clue of entity.clues) {
      recordSourceChunk[clue.id] = eChunk;
    }
  }

  const linkCheck =
    deduplicated.length > 0
      ? checkModuleLinks({
          acts,
          scenes,
          connections,
          entities,
          truths,
          factions,
          timeline,
          random_tables,
          recordSourceChunk,
        })
      : {
          review: [],
          references: [],
          brokenTargets: new Set<string>(),
          notLoadedTargets: new Set<string>(),
          underCluedTruthIds: new Set<string>(),
        };

  const chunks = deduplicated.map((d) => d.chunk);
  const latestMeta = chunks.length > 0 ? chunks[chunks.length - 1].meta : null;

  return {
    meta: latestMeta,
    chunks,
    trackers,
    acts,
    scenes,
    connections,
    entities,
    truths,
    clocks,
    timeline,
    factions,
    random_tables,
    recordSourceChunk,
    review: [...parserReview, ...mergeReview, ...linkCheck.review],
    linkCheck,
  };
}

export function mergeRawChunkObjects(rawChunks: Array<Record<string, unknown>>): MergedCampaignData {
  const parsed = rawChunks.map((raw) => parseModuleChunk(JSON.stringify(raw)));
  return mergeParsedChunks(parsed);
}

export function collectValidTargetIds(merged: MergedCampaignData): Set<string> {
  const ids = new Set<string>();
  for (const t of merged.trackers) ids.add(t.id);
  for (const a of merged.acts) ids.add(a.id);
  for (const s of merged.scenes) {
    ids.add(s.id);
    for (const item of [...s.tier2_interactive, ...s.tier3_hidden]) {
      ids.add(item.id);
    }
  }
  for (const c of merged.connections) ids.add(c.id);
  for (const e of merged.entities) {
    ids.add(e.id);
    for (const clue of e.clues) {
      ids.add(clue.id);
    }
  }
  for (const tr of merged.truths) ids.add(tr.id);
  for (const cl of merged.clocks) ids.add(cl.id);
  for (const ev of merged.timeline) ids.add(ev.id);
  for (const f of merged.factions) ids.add(f.id);
  for (const rt of merged.random_tables) ids.add(rt.id);
  return ids;
}

export function reconcileLiveNotes(
  live: LiveState,
  merged: MergedCampaignData
): LiveState {
  if (live.notes.length === 0) {
    return live;
  }
  const validIds = collectValidTargetIds(merged);
  const keptNotes = [];
  const movedNotes = [];

  for (const note of live.notes) {
    if (validIds.has(note.targetId)) {
      keptNotes.push(note);
    } else {
      movedNotes.push(note);
    }
  }

  if (movedNotes.length === 0) {
    return live;
  }

  return {
    ...live,
    notes: keptNotes,
    looseNotes: [...live.looseNotes, ...movedNotes],
    updatedAt: Date.now(),
  };
}
