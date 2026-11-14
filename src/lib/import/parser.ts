import { z } from 'zod';
import type {
  ConnectionState,
  ConnectionType,
  EntityClue,
  EntityDisposition,
  EntityRoleplay,
  EntityTrackDef,
  EntityType,
  FactionAttitude,
  ModuleAct,
  ModuleChunk,
  ModuleClock,
  ModuleConnection,
  ModuleEntity,
  ModuleFaction,
  ModuleMeta,
  ModuleRandomTable,
  ModuleScene,
  ModuleTimelineEvent,
  ModuleTracker,
  ModuleTruth,
  ParseChunkResult,
  RandomTableEntry,
  ReviewEntry,
  SceneArchetype,
  SceneEscalation,
  SceneItem,
  SceneItemKind,
  SceneReadAloud,
  TruthImportance,
} from './types';

const VALID_ARCHETYPES: readonly SceneArchetype[] = [
  'physical_zone',
  'open_hub',
  'investigation',
  'action_stage',
];

const VALID_ITEM_KINDS: readonly SceneItemKind[] = [
  'hazard',
  'clue',
  'loot',
  'tech',
  'social',
  'other',
];

const VALID_CONNECTION_TYPES: readonly ConnectionType[] = [
  'door',
  'travel',
  'poi',
  'clue_lead',
  'event',
  'other',
];

const VALID_CONNECTION_STATES: readonly ConnectionState[] = [
  'open',
  'locked',
  'sealed',
  'hidden',
];

const VALID_ENTITY_TYPES: readonly EntityType[] = [
  'npc',
  'creature',
  'vehicle',
  'hazard',
  'other',
];

const VALID_DISPOSITIONS: readonly EntityDisposition[] = [
  'allied',
  'neutral',
  'suspicious',
  'hostile',
];

const VALID_IMPORTANCES: readonly TruthImportance[] = ['core', 'optional'];

export const MetaSchema = z.object({
  module_id: z.string().min(1).default('mod-unknown').catch('mod-unknown'),
  title: z.string().min(1).default('Untitled Module').catch('Untitled Module'),
  system: z.string().default('Unknown System').catch('Unknown System'),
  genre: z.string().default('sci-fi').catch('sci-fi'),
  check_format: z.string().default('').catch(''),
  page_offset: z.number().finite().default(0).catch(0),
  chunk_id: z.string().min(1).default('chunk-unknown').catch('chunk-unknown'),
  chunk_title: z.string().min(1).default('Untitled Chunk').catch('Untitled Chunk'),
  chunk_pages: z.string().default('').catch(''),
  complete: z.boolean().default(true).catch(true),
  stopped_at_page: z.number().finite().nullable().default(null).catch(null),
});

export const TrackerSchema = z.object({
  id: z.string().min(1).default('tr-auto-1').catch('tr-auto-1'),
  label: z.string().min(1).default('Tracker').catch('Tracker'),
  min: z.number().finite().default(0).catch(0),
  max: z.number().finite().default(10).catch(10),
  start: z.number().finite().default(0).catch(0),
  scope: z.string().default('global').catch('global'),
});

export const ActSchema = z.object({
  id: z.string().min(1).default('a1').catch('a1'),
  title: z.string().min(1).default('Act 1').catch('Act 1'),
  page_start: z.number().finite().default(1).catch(1),
  page_end: z.number().finite().default(1).catch(1),
  summary: z.string().default('').catch(''),
});

export const SceneItemSchema = z.object({
  id: z.string().min(1).default('item-1').catch('item-1'),
  label: z.string().min(1).default('Unnamed item').catch('Unnamed item'),
  check: z.string().nullable().default(null).catch(null),
  result: z.string().default('').catch(''),
  kind: z.enum(['hazard', 'clue', 'loot', 'tech', 'social', 'other']).default('other').catch('other'),
  truth_id: z.string().nullable().default(null).catch(null),
  unlocks_connection_id: z.string().nullable().default(null).catch(null),
  needs_review: z.boolean().default(false).catch(false),
  source_quote: z.string().default('').catch(''),
});

export const SceneEscalationSchema = z.object({
  at: z.string().default('Step 1').catch('Step 1'),
  text: z.string().default('').catch(''),
});

export const ReadAloudPointerSchema = z.object({
  page: z.number().finite(),
  starts_with: z.string().min(1),
});

export const SceneSchema = z.object({
  id: z.string().min(1).default('scene-auto-1').catch('scene-auto-1'),
  code: z.string().default('1').catch('1'),
  title: z.string().min(1).default('Untitled Scene').catch('Untitled Scene'),
  act_id: z.string().default('a1').catch('a1'),
  archetype: z
    .enum(['physical_zone', 'open_hub', 'investigation', 'action_stage', 'unknown'])
    .default('unknown')
    .catch('unknown'),
  group: z.string().default('General').catch('General'),
  page: z.number().finite().default(1).catch(1),
  encounter_page: z.number().finite().nullable().optional().catch(undefined),
  summary: z.string().default('').catch(''),
  tags: z.array(z.string()).default([]).catch([]),
  read_aloud: z
    .union([ReadAloudPointerSchema, z.string()])
    .nullable()
    .default(null)
    .catch(null),
  tier1_sensory: z.array(z.string()).default([]).catch([]),
  tier2_interactive: z.array(SceneItemSchema).default([]).catch([]),
  tier3_hidden: z.array(SceneItemSchema).default([]).catch([]),
  entity_ids: z.array(z.string()).default([]).catch([]),
  entity_counts: z.record(z.string(), z.number()).default({}).catch({}),
  gm_tips: z.string().default('').catch(''),
  escalation: z.array(SceneEscalationSchema).default([]).catch([]),
  default_map_id: z.string().nullable().default(null).catch(null),
  needs_review: z.boolean().default(false).catch(false),
  source_quote: z.string().default('').catch(''),
});

export const ConnectionSchema = z.object({
  id: z.string().min(1).default('conn-auto-1').catch('conn-auto-1'),
  from: z.string().default('').catch(''),
  to: z.string().default('').catch(''),
  type: z.enum(['door', 'travel', 'poi', 'clue_lead', 'event', 'other']).default('other').catch('other'),
  label: z.string().default('Path').catch('Path'),
  two_way: z.boolean().default(false).catch(false),
  state: z.enum(['open', 'locked', 'sealed', 'hidden']).default('open').catch('open'),
  requires: z.string().nullable().default(null).catch(null),
  page: z.number().finite().default(1).catch(1),
  needs_review: z.boolean().default(false).catch(false),
  source_quote: z.string().default('').catch(''),
});

export const EntityClueSchema = z.object({
  id: z.string().min(1).default('clue-1').catch('clue-1'),
  text: z.string().default('').catch(''),
  check: z.string().nullable().default(null).catch(null),
  truth_id: z.string().nullable().default(null).catch(null),
  hidden: z.boolean().default(true).catch(true),
});

export const EntitySchema = z.object({
  id: z.string().min(1).default('e-auto-1').catch('e-auto-1'),
  name: z.string().min(1).default('Unnamed Entity').catch('Unnamed Entity'),
  type: z.enum(['npc', 'creature', 'vehicle', 'hazard', 'other']).default('other').catch('other'),
  page: z.number().finite().default(1).catch(1),
  summary: z.string().default('').catch(''),
  count: z.number().finite().default(1).catch(1),
  stat_line: z.string().default('').catch(''),
  tracks: z
    .array(z.object({ label: z.string().default('HP').catch('HP'), max: z.number().finite().default(1).catch(1) }))
    .default([])
    .catch([]),
  roleplay: z
    .object({
      voice: z.string().default('').catch(''),
      goal: z.string().default('').catch(''),
      secret: z.string().nullable().default(null).catch(null),
    })
    .default({ voice: '', goal: '', secret: null })
    .catch({ voice: '', goal: '', secret: null }),
  clues: z.array(EntityClueSchema).default([]).catch([]),
  disposition: z.enum(['allied', 'neutral', 'suspicious', 'hostile']).default('neutral').catch('neutral'),
  faction_id: z.string().nullable().default(null).catch(null),
  roaming: z.boolean().default(false).catch(false),
  needs_review: z.boolean().default(false).catch(false),
  source_quote: z.string().default('').catch(''),
});

export const TruthSchema = z.object({
  id: z.string().min(1).default('t-auto-1').catch('t-auto-1'),
  title: z.string().min(1).default('Unnamed Truth').catch('Unnamed Truth'),
  text: z.string().default('').catch(''),
  importance: z.enum(['core', 'optional']).default('optional').catch('optional'),
  scope: z.string().default('global').catch('global'),
  page: z.number().finite().default(1).catch(1),
});

export const ClockSchema = z.object({
  id: z.string().min(1).default('k-auto-1').catch('k-auto-1'),
  name: z.string().min(1).default('Unnamed Clock').catch('Unnamed Clock'),
  segments: z.number().finite().default(4).catch(4),
  start: z.number().finite().default(0).catch(0),
  when_full: z.string().default('').catch(''),
  hidden: z.boolean().default(false).catch(false),
  scope: z.string().default('global').catch('global'),
});

export const TimelineEventSchema = z.object({
  id: z.string().min(1).default('ev-auto-1').catch('ev-auto-1'),
  when: z.string().default('').catch(''),
  day: z.number().finite().nullable().default(null).catch(null),
  order: z.number().finite().default(10).catch(10),
  text: z.string().default('').catch(''),
  trigger: z.string().default('').catch(''),
  hidden: z.boolean().default(false).catch(false),
  scene_id: z.string().nullable().default(null).catch(null),
  scope: z.string().default('global').catch('global'),
});

export const FactionSchema = z.object({
  id: z.string().min(1).default('f-auto-1').catch('f-auto-1'),
  name: z.string().min(1).default('Unnamed Faction').catch('Unnamed Faction'),
  summary: z.string().default('').catch(''),
  goal: z.string().default('').catch(''),
  attitude: z.enum(['allied', 'neutral', 'suspicious', 'hostile']).default('neutral').catch('neutral'),
  secret: z.string().nullable().default(null).catch(null),
  scope: z.string().default('global').catch('global'),
  page: z.number().finite().default(1).catch(1),
});

export const RandomTableEntrySchema = z.object({
  range: z.string().default('1').catch('1'),
  text: z.string().default('').catch(''),
  entity_id: z.string().nullable().default(null).catch(null),
});

export const RandomTableSchema = z.object({
  id: z.string().min(1).default('rt-auto-1').catch('rt-auto-1'),
  name: z.string().min(1).default('Unnamed Table').catch('Unnamed Table'),
  dice: z.string().default('1d6').catch('1d6'),
  entries: z.array(RandomTableEntrySchema).default([]).catch([]),
  scope: z.string().default('global').catch('global'),
  page: z.number().finite().default(1).catch(1),
});

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function parseModuleChunk(rawText: string): ParseChunkResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON';
    throw new Error(`Invalid JSON: ${msg}`);
  }

  const review: ReviewEntry[] = [];
  const rawRoot: Record<string, unknown> = isRecord(parsedJson) ? parsedJson : {};

  const rawMeta = isRecord(rawRoot.meta) ? rawRoot.meta : {};
  const chunkId =
    typeof rawMeta.chunk_id === 'string' && rawMeta.chunk_id.trim().length > 0
      ? rawMeta.chunk_id.trim()
      : 'chunk-unknown';

  if (!isRecord(parsedJson)) {
    review.push({
      severity: 'warn',
      chunkId,
      recordId: 'root',
      field: 'root',
      message: 'Top-level JSON value was not an object; defaulted to empty chunk.',
    });
  }

  const warnMissingOrInvalid = (recordId: string, field: string, fallbackDesc: string) => {
    review.push({
      severity: 'warn',
      chunkId,
      recordId,
      field,
      message: `Missing or invalid "${field}"; defaulted to ${fallbackDesc}.`,
    });
  };

  const strField = (
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    fallback: string,
    required = true
  ): string => {
    const raw = obj[field];
    const res = z.string().safeParse(raw);
    if (res.success && res.data.trim().length > 0) {
      return res.data;
    }
    if (res.success && !required) {
      return res.data;
    }
    if (required) {
      warnMissingOrInvalid(recordId, field, `"${fallback}"`);
    }
    return fallback;
  };

  const nullableStrField = (
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    required = true
  ): string | null => {
    const raw = obj[field];
    if (raw === undefined) {
      if (required) {
        warnMissingOrInvalid(recordId, field, 'null');
      }
      return null;
    }
    const res = z.string().nullable().safeParse(raw);
    if (res.success) {
      return res.data;
    }
    warnMissingOrInvalid(recordId, field, 'null');
    return null;
  };

  const numField = (
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    fallback: number,
    required = true
  ): number => {
    const raw = obj[field];
    const res = z.number().finite().safeParse(raw);
    if (res.success) {
      return res.data;
    }
    if (required) {
      warnMissingOrInvalid(recordId, field, String(fallback));
    }
    return fallback;
  };

  const nullableNumField = (
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    required = true
  ): number | null => {
    const raw = obj[field];
    if (raw === undefined) {
      if (required) {
        warnMissingOrInvalid(recordId, field, 'null');
      }
      return null;
    }
    const res = z.number().finite().nullable().safeParse(raw);
    if (res.success) {
      return res.data;
    }
    warnMissingOrInvalid(recordId, field, 'null');
    return null;
  };

  const boolField = (
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    fallback: boolean,
    required = true
  ): boolean => {
    const raw = obj[field];
    if (raw === undefined && !required) {
      return fallback;
    }
    const res = z.boolean().safeParse(raw);
    if (res.success) {
      return res.data;
    }
    if (required || raw !== undefined) {
      warnMissingOrInvalid(recordId, field, String(fallback));
    }
    return fallback;
  };

  const enumField = <T extends string>(
    obj: Record<string, unknown>,
    recordId: string,
    field: string,
    allowed: readonly T[],
    fallback: T
  ): T => {
    const raw = obj[field];
    if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }
    review.push({
      severity: 'warn',
      chunkId,
      recordId,
      field,
      message:
        raw === undefined
          ? `Missing "${field}"; defaulted to "${fallback}".`
          : `Unknown ${field} "${String(raw)}"; defaulted to "${fallback}".`,
    });
    return fallback;
  };

  const seenIds = new Set<string>();
  const ensureUniqueId = (
    obj: Record<string, unknown>,
    fallbackPrefix: string,
    index: number
  ): string => {
    const rawId = obj.id;
    let id: string;
    if (typeof rawId === 'string' && rawId.trim().length > 0) {
      id = rawId.trim();
    } else {
      id = `${fallbackPrefix}-${index + 1}`;
      warnMissingOrInvalid(id, 'id', `"${id}"`);
    }

    if (seenIds.has(id)) {
      let suffix = 2;
      let candidate = `${id}-${suffix}`;
      while (seenIds.has(candidate)) {
        suffix += 1;
        candidate = `${id}-${suffix}`;
      }
      review.push({
        severity: 'warn',
        chunkId,
        recordId: candidate,
        field: 'id',
        message: `Duplicate ID "${id}" inside chunk; renamed second occurrence to "${candidate}".`,
      });
      id = candidate;
    }
    seenIds.add(id);
    return id;
  };

  const checkNeedsReview = (recordId: string, needsReview: boolean, label: string) => {
    if (needsReview) {
      review.push({
        severity: 'info',
        chunkId,
        recordId,
        field: 'needs_review',
        message: `${label} is flagged needs_review.`,
      });
    }
  };

  if (!isRecord(rawRoot.meta)) {
    warnMissingOrInvalid('meta', 'meta', 'default meta object');
  }

  const metaSchema = z.object({
    module_id: z.string().min(1).catch('mod-unknown'),
    title: z.string().min(1).catch('Untitled Module'),
    system: z.string().catch('Unknown System'),
    genre: z.string().catch('sci-fi'),
    check_format: z.string().catch(''),
    page_offset: z.number().finite().catch(0),
    chunk_id: z.string().min(1).catch(chunkId),
    chunk_title: z.string().min(1).catch('Untitled Chunk'),
    chunk_pages: z.string().catch(''),
    complete: z.boolean().catch(true),
    stopped_at_page: z.number().finite().nullable().catch(null),
  });

  const parsedMetaBase = metaSchema.parse(rawMeta);
  const meta: ModuleMeta = {
    module_id: strField(rawMeta, 'meta', 'module_id', parsedMetaBase.module_id),
    title: strField(rawMeta, 'meta', 'title', parsedMetaBase.title),
    system: strField(rawMeta, 'meta', 'system', parsedMetaBase.system),
    genre: strField(rawMeta, 'meta', 'genre', parsedMetaBase.genre),
    check_format: strField(rawMeta, 'meta', 'check_format', parsedMetaBase.check_format, false),
    page_offset: numField(rawMeta, 'meta', 'page_offset', parsedMetaBase.page_offset),
    chunk_id: strField(rawMeta, 'meta', 'chunk_id', parsedMetaBase.chunk_id),
    chunk_title: strField(rawMeta, 'meta', 'chunk_title', parsedMetaBase.chunk_title),
    chunk_pages: strField(rawMeta, 'meta', 'chunk_pages', parsedMetaBase.chunk_pages, false),
    complete: boolField(rawMeta, 'meta', 'complete', parsedMetaBase.complete),
    stopped_at_page: nullableNumField(rawMeta, 'meta', 'stopped_at_page', false),
  };

  const getArraySection = (sectionName: string, required = true): Record<string, unknown>[] => {
    const raw = rawRoot[sectionName];
    if (!Array.isArray(raw)) {
      if (required) {
        warnMissingOrInvalid(sectionName, sectionName, '[]');
      }
      return [];
    }
    return raw.map((item, idx) => {
      if (!isRecord(item)) {
        warnMissingOrInvalid(`${sectionName}[${idx}]`, sectionName, '{}');
        return {};
      }
      return item;
    });
  };

  const trackers: ModuleTracker[] = getArraySection('trackers').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'tr-auto', idx);
    return {
      id,
      label: strField(obj, id, 'label', id),
      min: numField(obj, id, 'min', 0),
      max: numField(obj, id, 'max', 10),
      start: numField(obj, id, 'start', 0),
      scope: strField(obj, id, 'scope', 'global'),
    };
  });

  const acts: ModuleAct[] = getArraySection('acts').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'act-auto', idx);
    return {
      id,
      title: strField(obj, id, 'title', id),
      page_start: numField(obj, id, 'page_start', 1),
      page_end: numField(obj, id, 'page_end', 1),
      summary: strField(obj, id, 'summary', '', false),
    };
  });

  const parseSceneItem = (
    obj: Record<string, unknown>,
    sceneId: string,
    prefix: string,
    idx: number
  ): SceneItem => {
    const id = ensureUniqueId(obj, `${sceneId}-${prefix}`, idx);
    const needs_review = boolField(obj, id, 'needs_review', false, false);
    const label = strField(obj, id, 'label', 'Unnamed item');
    checkNeedsReview(id, needs_review, `Scene item "${label}"`);
    return {
      id,
      label,
      check: nullableStrField(obj, id, 'check'),
      result: strField(obj, id, 'result', ''),
      kind: enumField(obj, id, 'kind', VALID_ITEM_KINDS, 'other'),
      truth_id: nullableStrField(obj, id, 'truth_id'),
      unlocks_connection_id: nullableStrField(obj, id, 'unlocks_connection_id'),
      needs_review,
      source_quote: strField(obj, id, 'source_quote', '', false),
    };
  };

  const scenes: ModuleScene[] = getArraySection('scenes').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'scene-auto', idx);
    const title = strField(obj, id, 'title', 'Untitled Scene');

    const parseStrArray = (field: string): string[] => {
      const raw = obj[field];
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, field, '[]');
        return [];
      }
      return raw.filter((v): v is string => typeof v === 'string');
    };

    const parseItemArray = (field: string, prefix: string): SceneItem[] => {
      const raw = obj[field];
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, field, '[]');
        return [];
      }
      return raw.map((item, i) => (isRecord(item) ? parseSceneItem(item, id, prefix, i) : parseSceneItem({}, id, prefix, i)));
    };

    const parseEscalation = (): SceneEscalation[] => {
      const raw = obj.escalation;
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, 'escalation', '[]');
        return [];
      }
      return raw.map((row, i) => {
        if (!isRecord(row)) {
          warnMissingOrInvalid(id, `escalation[${i}]`, '{ at: "", text: "" }');
          return { at: '', text: '' };
        }
        return {
          at: strField(row, id, 'at', `Step ${i + 1}`),
          text: strField(row, id, 'text', ''),
        };
      });
    };

    const parseEntityCounts = (): Record<string, number> => {
      const raw = obj.entity_counts;
      if (raw === undefined || raw === null) {
        return {};
      }
      if (!isRecord(raw)) {
        warnMissingOrInvalid(id, 'entity_counts', '{}');
        return {};
      }
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          out[k] = v;
        }
      }
      return out;
    };

    const encounterPage =
      obj.encounter_page === undefined
        ? undefined
        : nullableNumField(obj, id, 'encounter_page', false);

    const parseReadAloud = (): SceneReadAloud => {
      const raw = obj.read_aloud;
      if (raw === null) {
        return null;
      }
      if (typeof raw === 'string') {
        return raw;
      }
      const ptrRes = ReadAloudPointerSchema.safeParse(raw);
      if (ptrRes.success) {
        return {
          page: ptrRes.data.page,
          starts_with: ptrRes.data.starts_with,
        };
      }
      warnMissingOrInvalid(id, 'read_aloud', 'null');
      return null;
    };

    const needs_review = boolField(obj, id, 'needs_review', false, false);
    checkNeedsReview(id, needs_review, `Scene "${title}"`);

    return {
      id,
      code: strField(obj, id, 'code', String(idx + 1)),
      title,
      act_id: strField(obj, id, 'act_id', acts[0]?.id ?? 'a1'),
      archetype: enumField(obj, id, 'archetype', VALID_ARCHETYPES, 'unknown'),
      group: strField(obj, id, 'group', 'General'),
      page: numField(obj, id, 'page', 1),
      ...(encounterPage !== undefined ? { encounter_page: encounterPage } : {}),
      summary: strField(obj, id, 'summary', ''),
      tags: parseStrArray('tags'),
      read_aloud: parseReadAloud(),
      tier1_sensory: parseStrArray('tier1_sensory'),
      tier2_interactive: parseItemArray('tier2_interactive', 'i'),
      tier3_hidden: parseItemArray('tier3_hidden', 'h'),
      entity_ids: parseStrArray('entity_ids'),
      entity_counts: parseEntityCounts(),
      gm_tips: strField(obj, id, 'gm_tips', '', false),
      escalation: parseEscalation(),
      default_map_id: nullableStrField(obj, id, 'default_map_id', false),
      needs_review,
      source_quote: strField(obj, id, 'source_quote', '', false),
    };
  });

  const connections: ModuleConnection[] = getArraySection('connections').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'conn-auto', idx);
    const label = strField(obj, id, 'label', 'Path');
    const needs_review = boolField(obj, id, 'needs_review', false, false);
    checkNeedsReview(id, needs_review, `Connection "${label}"`);
    return {
      id,
      from: strField(obj, id, 'from', ''),
      to: strField(obj, id, 'to', ''),
      type: enumField(obj, id, 'type', VALID_CONNECTION_TYPES, 'other'),
      label,
      two_way: boolField(obj, id, 'two_way', false),
      state: enumField(obj, id, 'state', VALID_CONNECTION_STATES, 'open'),
      requires: nullableStrField(obj, id, 'requires'),
      page: numField(obj, id, 'page', 1, false),
      needs_review,
      source_quote: strField(obj, id, 'source_quote', '', false),
    };
  });

  const entities: ModuleEntity[] = getArraySection('entities').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'e-auto', idx);
    const name = strField(obj, id, 'name', 'Unnamed Entity');

    const parseTracks = (): EntityTrackDef[] => {
      const raw = obj.tracks;
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, 'tracks', '[]');
        return [];
      }
      return raw.map((t, i) => {
        if (!isRecord(t)) {
          warnMissingOrInvalid(id, `tracks[${i}]`, '{ label: "HP", max: 1 }');
          return { label: 'HP', max: 1 };
        }
        return {
          label: strField(t, id, 'label', 'HP'),
          max: numField(t, id, 'max', 1),
        };
      });
    };

    const parseRoleplay = (): EntityRoleplay => {
      const raw = obj.roleplay;
      if (!isRecord(raw)) {
        warnMissingOrInvalid(id, 'roleplay', '{ voice: "", goal: "", secret: null }');
        return { voice: '', goal: '', secret: null };
      }
      return {
        voice: strField(raw, id, 'voice', '', false),
        goal: strField(raw, id, 'goal', '', false),
        secret: nullableStrField(raw, id, 'secret', false),
      };
    };

    const parseClues = (): EntityClue[] => {
      const raw = obj.clues;
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, 'clues', '[]');
        return [];
      }
      return raw.map((c, i) => {
        const cObj = isRecord(c) ? c : {};
        const clueId = ensureUniqueId(cObj, `${id}-c`, i);
        return {
          id: clueId,
          text: strField(cObj, clueId, 'text', ''),
          check: nullableStrField(cObj, clueId, 'check'),
          truth_id: nullableStrField(cObj, clueId, 'truth_id'),
          hidden: boolField(cObj, clueId, 'hidden', true),
        };
      });
    };

    const needs_review = boolField(obj, id, 'needs_review', false, false);
    checkNeedsReview(id, needs_review, `Entity "${name}"`);

    return {
      id,
      name,
      type: enumField(obj, id, 'type', VALID_ENTITY_TYPES, 'other'),
      page: numField(obj, id, 'page', 1),
      summary: strField(obj, id, 'summary', ''),
      count: numField(obj, id, 'count', 1),
      stat_line: strField(obj, id, 'stat_line', '', false),
      tracks: parseTracks(),
      roleplay: parseRoleplay(),
      clues: parseClues(),
      disposition: enumField(obj, id, 'disposition', VALID_DISPOSITIONS, 'neutral'),
      faction_id: nullableStrField(obj, id, 'faction_id'),
      roaming: boolField(obj, id, 'roaming', false),
      needs_review,
      source_quote: strField(obj, id, 'source_quote', '', false),
    };
  });

  const truths: ModuleTruth[] = getArraySection('truths').map((obj, idx) => {
    const id = ensureUniqueId(obj, 't-auto', idx);
    return {
      id,
      title: strField(obj, id, 'title', 'Unnamed Truth'),
      text: strField(obj, id, 'text', ''),
      importance: enumField(obj, id, 'importance', VALID_IMPORTANCES, 'optional'),
      scope: strField(obj, id, 'scope', 'global'),
      page: numField(obj, id, 'page', 1),
    };
  });

  const clocks: ModuleClock[] = getArraySection('clocks').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'k-auto', idx);
    return {
      id,
      name: strField(obj, id, 'name', 'Unnamed Clock'),
      segments: numField(obj, id, 'segments', 4),
      start: numField(obj, id, 'start', 0),
      when_full: strField(obj, id, 'when_full', ''),
      hidden: boolField(obj, id, 'hidden', false),
      scope: strField(obj, id, 'scope', 'global'),
    };
  });

  const timeline: ModuleTimelineEvent[] = getArraySection('timeline').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'ev-auto', idx);
    return {
      id,
      when: strField(obj, id, 'when', ''),
      day: nullableNumField(obj, id, 'day'),
      order: numField(obj, id, 'order', (idx + 1) * 10),
      text: strField(obj, id, 'text', ''),
      trigger: strField(obj, id, 'trigger', '', false),
      hidden: boolField(obj, id, 'hidden', false),
      scene_id: nullableStrField(obj, id, 'scene_id'),
      scope: strField(obj, id, 'scope', 'global'),
    };
  });

  const factions: ModuleFaction[] = getArraySection('factions').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'f-auto', idx);
    return {
      id,
      name: strField(obj, id, 'name', 'Unnamed Faction'),
      summary: strField(obj, id, 'summary', ''),
      goal: strField(obj, id, 'goal', ''),
      attitude: enumField(obj, id, 'attitude', VALID_DISPOSITIONS as readonly FactionAttitude[], 'neutral'),
      secret: nullableStrField(obj, id, 'secret'),
      scope: strField(obj, id, 'scope', 'global'),
      page: numField(obj, id, 'page', 1),
    };
  });

  const random_tables: ModuleRandomTable[] = getArraySection('random_tables').map((obj, idx) => {
    const id = ensureUniqueId(obj, 'rt-auto', idx);
    const parseEntries = (): RandomTableEntry[] => {
      const raw = obj.entries;
      if (!Array.isArray(raw)) {
        warnMissingOrInvalid(id, 'entries', '[]');
        return [];
      }
      return raw.map((entry, i) => {
        const eObj = isRecord(entry) ? entry : {};
        return {
          range: strField(eObj, `${id}#${i + 1}`, 'range', String(i + 1)),
          text: strField(eObj, `${id}#${i + 1}`, 'text', ''),
          entity_id: nullableStrField(eObj, `${id}#${i + 1}`, 'entity_id'),
        };
      });
    };

    return {
      id,
      name: strField(obj, id, 'name', 'Unnamed Table'),
      dice: strField(obj, id, 'dice', '1d6'),
      entries: parseEntries(),
      scope: strField(obj, id, 'scope', 'global'),
      page: numField(obj, id, 'page', 1),
    };
  });

  const chunk: ModuleChunk = {
    schema_version:
      typeof rawRoot.schema_version === 'string' ? rawRoot.schema_version : '1.0',
    meta,
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
    rawJson: JSON.parse(JSON.stringify(rawRoot)) as Record<string, unknown>,
  };

  return { chunk, review };
}
