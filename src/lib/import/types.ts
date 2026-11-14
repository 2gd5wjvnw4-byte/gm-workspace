export type ReviewSeverity = 'warn' | 'info';

export interface ReviewEntry {
  severity: ReviewSeverity;
  chunkId: string;
  recordId: string;
  field: string;
  message: string;
}

export interface ModuleMeta {
  module_id: string;
  title: string;
  system: string;
  genre: string;
  check_format: string;
  page_offset: number;
  chunk_id: string;
  chunk_title: string;
  chunk_pages: string;
  complete: boolean;
  stopped_at_page: number | null;
}

export interface ModuleTracker {
  id: string;
  label: string;
  min: number;
  max: number;
  start: number;
  scope: string;
}

export interface ModuleAct {
  id: string;
  title: string;
  page_start: number;
  page_end: number;
  summary: string;
}

export type SceneArchetype =
  | 'physical_zone'
  | 'open_hub'
  | 'investigation'
  | 'action_stage'
  | 'unknown';

export type SceneItemKind = 'hazard' | 'clue' | 'loot' | 'tech' | 'social' | 'other';

export interface SceneItem {
  id: string;
  label: string;
  check: string | null;
  result: string;
  kind: SceneItemKind;
  truth_id: string | null;
  unlocks_connection_id: string | null;
  needs_review: boolean;
  source_quote: string;
}

export interface SceneEscalation {
  at: string;
  text: string;
}

export interface ReadAloudPointer {
  page: number;
  starts_with: string;
}

export type SceneReadAloud = ReadAloudPointer | string | null;

export interface ModuleScene {
  id: string;
  code: string;
  title: string;
  act_id: string;
  archetype: SceneArchetype;
  group: string;
  page: number;
  encounter_page?: number | null;
  summary: string;
  tags: string[];
  read_aloud: SceneReadAloud;
  tier1_sensory: string[];
  tier2_interactive: SceneItem[];
  tier3_hidden: SceneItem[];
  entity_ids: string[];
  entity_counts: Record<string, number>;
  gm_tips: string;
  escalation: SceneEscalation[];
  default_map_id: string | null;
  needs_review: boolean;
  source_quote: string;
}

export type ConnectionType = 'door' | 'travel' | 'poi' | 'clue_lead' | 'event' | 'other';
export type ConnectionState = 'open' | 'locked' | 'sealed' | 'hidden';

export interface ModuleConnection {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
  label: string;
  two_way: boolean;
  state: ConnectionState;
  requires: string | null;
  page: number;
  needs_review: boolean;
  source_quote: string;
}

export type EntityType = 'npc' | 'creature' | 'vehicle' | 'hazard' | 'other';
export type EntityDisposition = 'allied' | 'neutral' | 'suspicious' | 'hostile';

export interface EntityTrackDef {
  label: string;
  max: number;
}

export interface EntityRoleplay {
  voice: string;
  goal: string;
  secret: string | null;
}

export interface EntityClue {
  id: string;
  text: string;
  check: string | null;
  truth_id: string | null;
  hidden: boolean;
}

export interface ModuleEntity {
  id: string;
  name: string;
  type: EntityType;
  page: number;
  summary: string;
  count: number;
  stat_line: string;
  tracks: EntityTrackDef[];
  roleplay: EntityRoleplay;
  clues: EntityClue[];
  disposition: EntityDisposition;
  faction_id: string | null;
  roaming: boolean;
  needs_review: boolean;
  source_quote: string;
}

export type TruthImportance = 'core' | 'optional';

export interface ModuleTruth {
  id: string;
  title: string;
  text: string;
  importance: TruthImportance;
  scope: string;
  page: number;
}

export interface ModuleClock {
  id: string;
  name: string;
  segments: number;
  start: number;
  when_full: string;
  hidden: boolean;
  scope: string;
}

export interface ModuleTimelineEvent {
  id: string;
  when: string;
  day: number | null;
  order: number;
  text: string;
  trigger: string;
  hidden: boolean;
  scene_id: string | null;
  scope: string;
}

export type FactionAttitude = 'allied' | 'neutral' | 'suspicious' | 'hostile';

export interface ModuleFaction {
  id: string;
  name: string;
  summary: string;
  goal: string;
  attitude: FactionAttitude;
  secret: string | null;
  scope: string;
  page: number;
}

export interface RandomTableEntry {
  range: string;
  text: string;
  entity_id: string | null;
}

export interface ModuleRandomTable {
  id: string;
  name: string;
  dice: string;
  entries: RandomTableEntry[];
  scope: string;
  page: number;
}

export interface ModuleChunk {
  schema_version: string;
  meta: ModuleMeta;
  trackers: ModuleTracker[];
  acts: ModuleAct[];
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  entities: ModuleEntity[];
  truths: ModuleTruth[];
  clocks: ModuleClock[];
  timeline: ModuleTimelineEvent[];
  factions: ModuleFaction[];
  random_tables: ModuleRandomTable[];
  rawJson: Record<string, unknown>;
}

export interface ParseChunkResult {
  chunk: ModuleChunk;
  review: ReviewEntry[];
}

export type LinkStatus = 'ok' | 'broken' | 'not_loaded';

export interface CheckedReference {
  chunkId: string;
  recordId: string;
  field: string;
  targetId: string;
  status: LinkStatus;
}

export interface LinkCheckResult {
  review: ReviewEntry[];
  references: CheckedReference[];
  brokenTargets: Set<string>;
  notLoadedTargets: Set<string>;
  underCluedTruthIds: Set<string>;
}

export interface MergedCampaignData {
  meta: ModuleMeta | null;
  chunks: ModuleChunk[];
  trackers: ModuleTracker[];
  acts: ModuleAct[];
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  entities: ModuleEntity[];
  truths: ModuleTruth[];
  clocks: ModuleClock[];
  timeline: ModuleTimelineEvent[];
  factions: ModuleFaction[];
  random_tables: ModuleRandomTable[];
  recordSourceChunk: Record<string, string>;
  review: ReviewEntry[];
  linkCheck: LinkCheckResult;
}
