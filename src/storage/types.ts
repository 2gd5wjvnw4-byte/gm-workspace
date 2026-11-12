import type { ThemeId } from '../store/themeStore';

export interface CampaignRecord {
  id: string;
  moduleId: string;
  title: string;
  system: string;
  genre: string;
  updatedAt: number;
  lastBackupAt?: number | null;
}

export interface ChunkRecord {
  id: string; // `${campaignId}:${chunkId}`
  campaignId: string;
  chunkId: string;
  chunkTitle: string;
  rawJson: Record<string, unknown>;
  importedAt: number;
}

export type ConnectionOverrideState = 'open' | 'locked' | 'sealed' | 'hidden';
export type DispositionState = 'allied' | 'neutral' | 'suspicious' | 'hostile';
export type NavViewMode = 'list' | 'nodes';
export type MapDisplayMode = 'off' | 'pip' | 'split' | 'full';

export interface TableNote {
  id: string;
  targetId: string;
  text: string;
  createdAt: number;
}

export interface MapAssetRecord {
  id: string;
  name: string;
  blobKey: string;
  width: number;
  height: number;
}

export interface ScenePin {
  mapId: string;
  xPct: number;
  yPct: number;
}

export interface RollLogEntry {
  id: string;
  tableId: string;
  tableName: string;
  roll: number;
  text: string;
  entityId?: string | null;
  createdAt: number;
}

export interface LiveState {
  campaignId: string;
  currentSceneId: string | null;
  visited: Record<string, boolean>;
  revealed: Record<string, boolean>;
  connectionState: Record<string, ConnectionOverrideState>;
  trackerValues: Record<string, number>;
  clockValues: Record<string, number>;
  timelineDone: Record<string, boolean>;
  entityTracks: Record<string, number[][]>;
  entityDisposition: Record<string, DispositionState>;
  factionAttitude: Record<string, DispositionState>;
  summoned: Record<string, string[]>;
  improvisedEntities: Array<Record<string, unknown>>;
  notes: TableNote[];
  looseNotes: TableNote[];
  nodePositions: Record<string, { x: number; y: number }>;
  maps: MapAssetRecord[];
  pins: Record<string, ScenePin>;
  sceneMap: Record<string, string>;
  rollLog: RollLogEntry[];
  theme: ThemeId;
  ui: {
    navView: NavViewMode;
    mapMode: MapDisplayMode;
    soloMask: boolean;
  };
  updatedAt?: number;
}

export interface BlobRecord {
  key: string;
  data: Blob | Uint8Array | string;
  mimeType: string;
  updatedAt: number;
}

export interface LoadedCampaign {
  campaign: CampaignRecord;
  chunks: ChunkRecord[];
  live: LiveState;
}

export interface BackupPayload {
  format: 'gm-workspace-backup';
  version: 1;
  exportedAt: string;
  campaign: CampaignRecord;
  chunks: ChunkRecord[];
  live: LiveState;
  maps: Record<string, string>;
}

export function createDefaultLiveState(campaignId: string, theme: ThemeId = 'scifi'): LiveState {
  return {
    campaignId,
    currentSceneId: null,
    visited: {},
    revealed: {},
    connectionState: {},
    trackerValues: {},
    clockValues: {},
    timelineDone: {},
    entityTracks: {},
    entityDisposition: {},
    factionAttitude: {},
    summoned: {},
    improvisedEntities: [],
    notes: [],
    looseNotes: [],
    nodePositions: {},
    maps: [],
    pins: {},
    sceneMap: {},
    rollLog: [],
    theme,
    ui: {
      navView: 'list',
      mapMode: 'off',
      soloMask: false,
    },
    updatedAt: Date.now(),
  };
}
