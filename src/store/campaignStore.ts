import { create } from 'zustand';
import {
  createCampaign as storageCreateCampaign,
  deleteBlob as storageDeleteBlob,
  deleteCampaign as storageDeleteCampaign,
  deleteChunk as storageDeleteChunk,
  exportBackup as storageExportBackup,
  getBlob as storageGetBlob,
  importBackup as storageImportBackup,
  importChunk as storageImportChunk,
  listCampaigns as storageListCampaigns,
  loadCampaign as storageLoadCampaign,
  pdfBlobKey,
  putBlob as storagePutBlob,
  saveLive as storageSaveLive,
  type BackupPayload,
  type CampaignRecord,
  type ChunkRecord,
  type ConnectionOverrideState,
  type DispositionState,
  type ImportedBackupResult,
  type ImprovisedAreaRecord,
  type ImprovisedClueRecord,
  type ImprovisedEntityRecord,
  type LiveState,
  type LoadedCampaign,
  type MapAssetRecord,
  type MapDisplayMode,
  type MapScale,
  type NavViewMode,
  type RollLogEntry,
  type ScenePin,
  type TableNote,
} from '../storage';
import {
  mergeRawChunkObjects,
  type FactionAttitude,
  type MergedCampaignData,
  type ModuleClock,
  type ModuleConnection,
  type ModuleFaction,
  type ModuleScene,
  type ModuleTruth,
  type SceneArchetype,
} from '../lib/import';
import {
  getEffectiveScenes,
  makeAreaKey,
  nextImprovisedSceneCode,
} from '../lib/improvised';
import { useThemeStore, type ThemeId } from './themeStore';

export interface CampaignStoreState {
  campaigns: CampaignRecord[];
  activeCampaign: CampaignRecord | null;
  chunks: ChunkRecord[];
  live: LiveState | null;
  merged: MergedCampaignData;
  loading: boolean;
  errorMessage: string | null;
  pdfInfo: { moduleId: string; fileName: string; fileSize: number } | null;
  pdfVersion: number;
  dirtySinceBackup: boolean;
  pdfMissingPrompt: boolean;
  refreshPdfInfo: () => Promise<void>;
  attachPdf: (file: File) => Promise<void>;
  saveBackup: () => Promise<BackupPayload>;
  restoreBackup: (
    jsonText: string,
    options?: { mode?: 'new' | 'replace'; targetCampaignId?: string }
  ) => Promise<ImportedBackupResult>;
  dismissPdfMissingPrompt: () => void;
  addMapAsset: (input: {
    name: string;
    data: Blob | Uint8Array;
    mimeType: string;
    width: number;
    height: number;
    scale?: MapScale;
    fileName?: string;
  }) => Promise<MapAssetRecord | null>;
  updateMapAsset: (mapId: string, patch: { name?: string; scale?: MapScale | undefined }) => void;
  deleteMapAsset: (mapId: string) => Promise<void>;
  setSceneMap: (sceneIds: string[], mapId: string | null) => void;
  setLastMapId: (mapId: string | null) => void;
  setScenePin: (sceneId: string, pin: ScenePin | null) => void;
  refreshCampaigns: () => Promise<CampaignRecord[]>;
  openCampaign: (campaignId: string) => Promise<LoadedCampaign | null>;
  createNewCampaign: (input: {
    title: string;
    system?: string;
    genre?: string;
  }) => Promise<LoadedCampaign>;
  closeCampaign: () => void;
  deleteCampaign: (campaignId: string) => Promise<void>;
  importJsonChunk: (rawJsonText: string) => Promise<LoadedCampaign>;
  removeChunk: (chunkId: string) => Promise<void>;
  setActiveLoadedCampaign: (loaded: LoadedCampaign | null) => void;
  clearError: () => void;
  goToScene: (sceneId: string) => void;
  toggleSceneVisited: (sceneId: string) => void;
  toggleRevealedItem: (itemId: string, unlocksConnectionId?: string | null) => void;
  setSoloMask: (soloMask: boolean) => void;
  setNavView: (navView: NavViewMode) => void;
  setMapMode: (mapMode: MapDisplayMode) => void;
  setFocusMode: (focusMode: boolean) => void;
  setCampaignTheme: (theme: ThemeId) => void;
  setRightSectionOpen: (sectionKey: string, open: boolean) => void;
  addTableNote: (targetId: string, text: string) => TableNote | null;
  updateTableNote: (noteId: string, text: string, targetId?: string) => void;
  deleteTableNote: (noteId: string) => void;
  setConnectionOverride: (connectionId: string, state: ConnectionOverrideState) => void;
  adjustTrackerValue: (trackerId: string, delta: number, min: number, max: number) => void;
  adjustEntityTrack: (
    entityId: string,
    copyIndex: number,
    trackIndex: number,
    delta: number,
    copyCount: number,
    trackDefs: Array<{ label: string; max: number }>
  ) => void;
  setEntityTrackValue: (
    entityId: string,
    copyIndex: number,
    trackIndex: number,
    value: number,
    copyCount: number,
    trackDefs: Array<{ label: string; max: number }>
  ) => void;
  setEntityTrackMax: (
    entityId: string,
    copyIndex: number,
    trackIndex: number,
    maxValue: number,
    copyCount: number,
    trackDefs: Array<{ label: string; max: number }>
  ) => void;
  cycleEntityDisposition: (entityId: string, defaultDisposition: DispositionState) => void;
  summonEntityToScene: (sceneId: string, entityId: string) => void;
  removeSummonedEntityFromScene: (sceneId: string, entityId: string) => void;
  addImprovisedEntity: (input: {
    name: string;
    summary: string;
    disposition: DispositionState;
    sceneId: string;
    trackLabel?: string;
    trackMax?: number | null;
  }) => ImprovisedEntityRecord | null;
  adjustClockValue: (
    clockId: string,
    delta: number,
    start: number,
    maxSegments: number
  ) => void;
  toggleTimelineDone: (eventId: string) => void;
  cycleFactionAttitude: (factionId: string, defaultAttitude: DispositionState) => void;
  appendRollLog: (entry: Omit<RollLogEntry, 'id' | 'createdAt'>) => RollLogEntry;
  addLooseNote: (text: string) => TableNote | null;
  deleteLooseNote: (noteId: string) => void;
  setNodePosition: (sceneId: string, pos: { x: number; y: number }) => void;
  resetNodePositions: (sceneIds?: string[]) => void;
  addImprovisedArea: (input: { name: string; actId?: string }) => ImprovisedAreaRecord | null;
  addImprovisedScene: (input: {
    title: string;
    code?: string;
    area?: string;
    actId?: string;
    archetype?: SceneArchetype;
    summary?: string;
    connectFromSceneId?: string | null;
    connectionLabel?: string;
    twoWay?: boolean;
    nodePosition?: { x: number; y: number } | null;
    selectScene?: boolean;
  }) => { scene: ModuleScene; connection: ModuleConnection | null } | null;
  addImprovisedClock: (input: {
    name: string;
    segments: number;
    whenFull?: string;
    scope?: string;
  }) => ModuleClock | null;
  addImprovisedClue: (input: {
    text: string;
    truthId?: string;
    newTruthTitle?: string;
    newTruthAnswer?: string;
    sceneId?: string | null;
    sourceLabel?: string;
  }) => { clue: ImprovisedClueRecord; truth: ModuleTruth | null } | null;
  addImprovisedFaction: (input: {
    name: string;
    goal?: string;
    summary?: string;
    attitude?: FactionAttitude;
    secret?: string | null;
  }) => ModuleFaction | null;
  deleteScene: (sceneId: string) => void;
  deleteArea: (actId: string, areaName: string) => void;
}

const emptyMerged = (): MergedCampaignData => mergeRawChunkObjects([]);

function applyLoaded(loaded: LoadedCampaign | null) {
  if (!loaded) {
    return {
      activeCampaign: null,
      chunks: [],
      live: null,
      merged: emptyMerged(),
    };
  }
  const merged = mergeRawChunkObjects(loaded.chunks.map((c) => c.rawJson));
  let live = loaded.live;
  if (!live.currentSceneId && merged.scenes.length > 0) {
    const firstId = merged.scenes[0].id;
    live = {
      ...live,
      currentSceneId: firstId,
      visited: {
        ...live.visited,
        [firstId]: true,
      },
    };
    void storageSaveLive(live);
  } else if (live.currentSceneId && !live.visited[live.currentSceneId]) {
    live = {
      ...live,
      visited: {
        ...live.visited,
        [live.currentSceneId]: true,
      },
    };
    void storageSaveLive(live);
  }
  if (live?.theme) {
    useThemeStore.getState().setTheme(live.theme);
  }
  return {
    activeCampaign: loaded.campaign,
    chunks: loaded.chunks,
    live,
    merged,
  };
}

let sessionEpoch = 0;

export const useCampaignStore = create<CampaignStoreState>((set, get) => {
  const commitLive = (updater: (prev: LiveState) => LiveState) => {
    const current = get().live;
    if (!current) return null;
    const next = updater(current);
    set({ live: next, dirtySinceBackup: true });
    void storageSaveLive(next);
    return next;
  };

  return {
    campaigns: [],
    activeCampaign: null,
    chunks: [],
    live: null,
    merged: emptyMerged(),
    loading: false,
    errorMessage: null,
    pdfInfo: null,
    pdfVersion: 0,
    dirtySinceBackup: false,
    pdfMissingPrompt: false,

    refreshCampaigns: async () => {
      const list = await storageListCampaigns();
      set({ campaigns: list });
      return list;
    },

    openCampaign: async (campaignId: string) => {
      sessionEpoch += 1;
      const myEpoch = sessionEpoch;
      set({ loading: true, errorMessage: null });
      try {
        const loaded = await storageLoadCampaign(campaignId);
        const campaigns = await storageListCampaigns();
        if (sessionEpoch !== myEpoch) {
          set({ campaigns, loading: false });
          return loaded;
        }
        set({
          ...applyLoaded(loaded),
          campaigns,
          loading: false,
          dirtySinceBackup: false,
          pdfMissingPrompt: false,
        });
        void get().refreshPdfInfo();
        return loaded;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load campaign';
        set({ loading: false, errorMessage: msg });
        throw err;
      }
    },

    createNewCampaign: async (input) => {
      sessionEpoch += 1;
      const myEpoch = sessionEpoch;
      set({ loading: true, errorMessage: null });
      try {
        const loaded = await storageCreateCampaign(input);
        const campaigns = await storageListCampaigns();
        if (sessionEpoch !== myEpoch) {
          set({ campaigns, loading: false });
          return loaded;
        }
        set({
          ...applyLoaded(loaded),
          campaigns,
          loading: false,
          dirtySinceBackup: false,
          pdfMissingPrompt: false,
        });
        void get().refreshPdfInfo();
        return loaded;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create campaign';
        set({ loading: false, errorMessage: msg });
        throw err;
      }
    },

    closeCampaign: () => {
      sessionEpoch += 1;
      set({
        ...applyLoaded(null),
        errorMessage: null,
        pdfInfo: null,
        dirtySinceBackup: false,
        pdfMissingPrompt: false,
      });
    },

    deleteCampaign: async (campaignId: string) => {
      sessionEpoch += 1;
      set({ errorMessage: null });
      try {
        await storageDeleteCampaign(campaignId);
        const campaigns = await storageListCampaigns();
        if (get().activeCampaign?.id === campaignId) {
          set({
            ...applyLoaded(null),
            campaigns,
          });
        } else {
          set({ campaigns });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete campaign';
        set({ errorMessage: msg });
        throw err;
      }
    },

    importJsonChunk: async (rawJsonText: string) => {
      set({ errorMessage: null });
      const currentId = get().activeCampaign?.id;
      const myEpoch = sessionEpoch;
      try {
        const loaded = await storageImportChunk(rawJsonText, currentId);
        const campaigns = await storageListCampaigns();
        if (
          sessionEpoch !== myEpoch ||
          (currentId !== undefined && get().activeCampaign?.id !== currentId)
        ) {
          set({ campaigns });
          return loaded;
        }
        const freshLoaded = await storageLoadCampaign(loaded.campaign.id);
        if (
          sessionEpoch !== myEpoch ||
          (currentId !== undefined && get().activeCampaign?.id !== currentId)
        ) {
          set({ campaigns });
          return loaded;
        }
        set({
          ...applyLoaded(freshLoaded ?? loaded),
          campaigns,
          dirtySinceBackup: true,
        });
        void get().refreshPdfInfo();
        return freshLoaded ?? loaded;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON file';
        if (sessionEpoch === myEpoch) {
          set({ errorMessage: msg });
        }
        throw err;
      }
    },

    removeChunk: async (chunkId: string) => {
      const currentId = get().activeCampaign?.id;
      if (!currentId) return;
      const myEpoch = sessionEpoch;
      set({ errorMessage: null });
      const loaded = await storageDeleteChunk(currentId, chunkId);
      const campaigns = await storageListCampaigns();
      if (sessionEpoch !== myEpoch || get().activeCampaign?.id !== currentId) {
        set({ campaigns });
        return;
      }
      const freshLoaded = await storageLoadCampaign(currentId);
      if (sessionEpoch !== myEpoch || get().activeCampaign?.id !== currentId) {
        set({ campaigns });
        return;
      }
      set({
        ...applyLoaded(freshLoaded ?? loaded),
        campaigns,
        dirtySinceBackup: true,
      });
      void get().refreshPdfInfo();
    },

    setActiveLoadedCampaign: (loaded: LoadedCampaign | null) => {
      sessionEpoch += 1;
      set({
        ...applyLoaded(loaded),
        errorMessage: null,
      });
    },

    clearError: () => set({ errorMessage: null }),

    goToScene: (sceneId: string) => {
      commitLive((prev) => ({
        ...prev,
        currentSceneId: sceneId,
        visited: {
          ...prev.visited,
          [sceneId]: true,
        },
      }));
    },

    toggleSceneVisited: (sceneId: string) => {
      commitLive((prev) => {
        if (prev.currentSceneId === sceneId) {
          return prev;
        }
        const nextVisited = { ...prev.visited };
        if (nextVisited[sceneId]) {
          delete nextVisited[sceneId];
        } else {
          nextVisited[sceneId] = true;
        }
        return {
          ...prev,
          visited: nextVisited,
        };
      });
    },

    toggleRevealedItem: (itemId: string, unlocksConnectionId?: string | null) => {
      commitLive((prev) => {
        const nextRevealed = !prev.revealed[itemId];
        const nextConnectionState = { ...prev.connectionState };
        if (nextRevealed && unlocksConnectionId) {
          nextConnectionState[unlocksConnectionId] = 'open';
        }
        return {
          ...prev,
          revealed: {
            ...prev.revealed,
            [itemId]: nextRevealed,
          },
          connectionState: nextConnectionState,
        };
      });
    },

    setSoloMask: (soloMask: boolean) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          soloMask,
        },
      }));
    },

    setNavView: (navView: NavViewMode) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          navView,
        },
      }));
    },

    setMapMode: (mapMode: MapDisplayMode) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          mapMode,
        },
      }));
    },

    setFocusMode: (focusMode: boolean) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          focusMode,
        },
      }));
    },

    setCampaignTheme: (theme: ThemeId) => {
      useThemeStore.getState().setTheme(theme);
      commitLive((prev) => ({
        ...prev,
        theme,
      }));
    },

    setRightSectionOpen: (sectionKey: string, open: boolean) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          rightSectionsOpen: {
            ...(prev.ui.rightSectionsOpen ?? {}),
            [sectionKey]: open,
          },
        },
      }));
    },

    addTableNote: (targetId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const newNote: TableNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetId,
        text: trimmed,
        createdAt: Date.now(),
      };
      commitLive((prev) => ({
        ...prev,
        notes: [...prev.notes, newNote],
      }));
      return newNote;
    },

    updateTableNote: (noteId: string, text: string, targetId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      commitLive((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === noteId
            ? { ...n, text: trimmed, targetId: targetId ?? n.targetId }
            : n
        ),
      }));
    },

    deleteTableNote: (noteId: string) => {
      commitLive((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== noteId),
      }));
    },

    setConnectionOverride: (connectionId: string, state: ConnectionOverrideState) => {
      commitLive((prev) => ({
        ...prev,
        connectionState: {
          ...prev.connectionState,
          [connectionId]: state,
        },
      }));
    },

    adjustTrackerValue: (trackerId: string, delta: number, min: number, max: number) => {
      const mergedTrackers = get().merged.trackers;
      const trackerDef = mergedTrackers.find((t) => t.id === trackerId);
      const startVal = trackerDef ? trackerDef.start : min;
      commitLive((prev) => {
        const currentVal = prev.trackerValues[trackerId] ?? startVal;
        const clamped = Math.max(min, Math.min(max, currentVal + delta));
        return {
          ...prev,
          trackerValues: {
            ...prev.trackerValues,
            [trackerId]: clamped,
          },
        };
      });
    },

    adjustEntityTrack: (
      entityId: string,
      copyIndex: number,
      trackIndex: number,
      delta: number,
      copyCount: number,
      trackDefs: Array<{ label: string; max: number }>
    ) => {
      if (trackDefs.length === 0) return;
      commitLive((prev) => {
        const existingMaxMatrix = prev.entityTrackMax?.[entityId] ?? [];
        const effectiveMax =
          existingMaxMatrix[copyIndex]?.[trackIndex] ??
          trackDefs[trackIndex]?.max ??
          0;
        const existingMatrix = prev.entityTracks[entityId] ?? [];
        const totalCopies = Math.max(
          existingMatrix.length,
          copyCount,
          copyIndex + 1,
          1
        );
        const nextMatrix: number[][] = [];
        for (let c = 0; c < totalCopies; c += 1) {
          const existingRow = existingMatrix[c] ?? [];
          const nextRow = trackDefs.map((def, tIdx) => {
            const val = existingRow[tIdx];
            const rowMax = existingMaxMatrix[c]?.[tIdx] ?? def.max;
            return typeof val === 'number' ? val : rowMax;
          });
          nextMatrix.push(nextRow);
        }
        const currentVal = nextMatrix[copyIndex]?.[trackIndex] ?? effectiveMax;
        nextMatrix[copyIndex][trackIndex] = Math.max(
          0,
          Math.min(effectiveMax, currentVal + delta)
        );
        return {
          ...prev,
          entityTracks: {
            ...prev.entityTracks,
            [entityId]: nextMatrix,
          },
        };
      });
    },

    setEntityTrackValue: (
      entityId: string,
      copyIndex: number,
      trackIndex: number,
      value: number,
      copyCount: number,
      trackDefs: Array<{ label: string; max: number }>
    ) => {
      if (trackDefs.length === 0 || Number.isNaN(value)) return;
      commitLive((prev) => {
        const existingMaxMatrix = prev.entityTrackMax?.[entityId] ?? [];
        const effectiveMax =
          existingMaxMatrix[copyIndex]?.[trackIndex] ??
          trackDefs[trackIndex]?.max ??
          0;
        const existingMatrix = prev.entityTracks[entityId] ?? [];
        const totalCopies = Math.max(
          existingMatrix.length,
          copyCount,
          copyIndex + 1,
          1
        );
        const nextMatrix: number[][] = [];
        for (let c = 0; c < totalCopies; c += 1) {
          const existingRow = existingMatrix[c] ?? [];
          const nextRow = trackDefs.map((def, tIdx) => {
            const val = existingRow[tIdx];
            const rowMax = existingMaxMatrix[c]?.[tIdx] ?? def.max;
            return typeof val === 'number' ? val : rowMax;
          });
          nextMatrix.push(nextRow);
        }
        nextMatrix[copyIndex][trackIndex] = Math.max(
          0,
          Math.min(effectiveMax, Math.round(value))
        );
        return {
          ...prev,
          entityTracks: {
            ...prev.entityTracks,
            [entityId]: nextMatrix,
          },
        };
      });
    },

    setEntityTrackMax: (
      entityId: string,
      copyIndex: number,
      trackIndex: number,
      maxValue: number,
      copyCount: number,
      trackDefs: Array<{ label: string; max: number }>
    ) => {
      if (trackDefs.length === 0 || Number.isNaN(maxValue)) return;
      const nextMax = Math.max(0, Math.round(maxValue));
      commitLive((prev) => {
        const existingMaxMatrix = prev.entityTrackMax?.[entityId] ?? [];
        const existingMatrix = prev.entityTracks[entityId] ?? [];
        const totalCopies = Math.max(
          existingMaxMatrix.length,
          existingMatrix.length,
          copyCount,
          copyIndex + 1,
          1
        );
        const nextMaxMatrix: number[][] = [];
        for (let c = 0; c < totalCopies; c += 1) {
          const existingRow = existingMaxMatrix[c] ?? [];
          const nextRow = trackDefs.map((def, tIdx) => {
            const val = existingRow[tIdx];
            return typeof val === 'number' ? val : def.max;
          });
          nextMaxMatrix.push(nextRow);
        }
        nextMaxMatrix[copyIndex][trackIndex] = nextMax;

        let nextEntityTracks = prev.entityTracks;
        const currentStored = existingMatrix[copyIndex]?.[trackIndex];
        if (typeof currentStored === 'number' && currentStored > nextMax) {
          const nextMatrix = existingMatrix.map((row) => [...row]);
          nextMatrix[copyIndex][trackIndex] = nextMax;
          nextEntityTracks = {
            ...prev.entityTracks,
            [entityId]: nextMatrix,
          };
        }

        return {
          ...prev,
          entityTracks: nextEntityTracks,
          entityTrackMax: {
            ...(prev.entityTrackMax ?? {}),
            [entityId]: nextMaxMatrix,
          },
        };
      });
    },

    cycleEntityDisposition: (entityId: string, defaultDisposition: DispositionState) => {
      const order: DispositionState[] = ['allied', 'neutral', 'suspicious', 'hostile'];
      commitLive((prev) => {
        const currentDisp = prev.entityDisposition[entityId] ?? defaultDisposition;
        const idx = order.indexOf(currentDisp);
        const nextDisp = order[(idx + 1) % order.length];
        return {
          ...prev,
          entityDisposition: {
            ...prev.entityDisposition,
            [entityId]: nextDisp,
          },
        };
      });
    },

    summonEntityToScene: (sceneId: string, entityId: string) => {
      commitLive((prev) => {
        const currentList = prev.summoned[sceneId] ?? [];
        if (currentList.includes(entityId)) {
          return prev;
        }
        return {
          ...prev,
          summoned: {
            ...prev.summoned,
            [sceneId]: [...currentList, entityId],
          },
        };
      });
    },

    removeSummonedEntityFromScene: (sceneId: string, entityId: string) => {
      commitLive((prev) => {
        const currentList = prev.summoned[sceneId] ?? [];
        return {
          ...prev,
          summoned: {
            ...prev.summoned,
            [sceneId]: currentList.filter((id) => id !== entityId),
          },
        };
      });
    },

    addImprovisedEntity: (input) => {
      const name = input.name.trim();
      if (!name) return null;
      const summary = input.summary.trim();
      const trackLabel = input.trackLabel?.trim() ?? '';
      const rawMax = input.trackMax;
      const hasTrack =
        trackLabel.length > 0 &&
        typeof rawMax === 'number' &&
        Number.isFinite(rawMax) &&
        rawMax > 0;
      const track = hasTrack
        ? { label: trackLabel, max: Math.round(rawMax) }
        : null;
      const newImp: ImprovisedEntityRecord = {
        id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        summary,
        disposition: input.disposition,
        sceneId: input.sceneId,
        track,
        createdAt: Date.now(),
      };
      commitLive((prev) => ({
        ...prev,
        improvisedEntities: [...(prev.improvisedEntities ?? []), newImp],
        entityDisposition: {
          ...prev.entityDisposition,
          [newImp.id]: newImp.disposition,
        },
        entityTracks: track
          ? {
              ...prev.entityTracks,
              [newImp.id]: [[track.max]],
            }
          : prev.entityTracks,
      }));
      return newImp;
    },

    adjustClockValue: (
      clockId: string,
      delta: number,
      start: number,
      maxSegments: number
    ) => {
      commitLive((prev) => {
        const current = prev.clockValues[clockId] ?? start;
        const clamped = Math.max(0, Math.min(maxSegments, current + delta));
        return {
          ...prev,
          clockValues: {
            ...prev.clockValues,
            [clockId]: clamped,
          },
        };
      });
    },

    toggleTimelineDone: (eventId: string) => {
      commitLive((prev) => ({
        ...prev,
        timelineDone: {
          ...prev.timelineDone,
          [eventId]: !prev.timelineDone[eventId],
        },
      }));
    },

    cycleFactionAttitude: (factionId: string, defaultAttitude: DispositionState) => {
      const order: DispositionState[] = ['allied', 'neutral', 'suspicious', 'hostile'];
      commitLive((prev) => {
        const current = prev.factionAttitude[factionId] ?? defaultAttitude;
        const idx = order.indexOf(current);
        const next = order[(idx + 1) % order.length];
        return {
          ...prev,
          factionAttitude: {
            ...prev.factionAttitude,
            [factionId]: next,
          },
        };
      });
    },

    appendRollLog: (entry) => {
      const created: RollLogEntry = {
        ...entry,
        id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };
      commitLive((prev) => ({
        ...prev,
        rollLog: [created, ...(prev.rollLog ?? [])].slice(0, 50),
      }));
      return created;
    },

    addLooseNote: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const note: TableNote = {
        id: `loose-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetId: 'loose',
        text: trimmed,
        createdAt: Date.now(),
      };
      commitLive((prev) => ({
        ...prev,
        looseNotes: [note, ...(prev.looseNotes ?? [])],
      }));
      return note;
    },

    deleteLooseNote: (noteId: string) => {
      commitLive((prev) => ({
        ...prev,
        looseNotes: (prev.looseNotes ?? []).filter((n) => n.id !== noteId),
      }));
    },

    setNodePosition: (sceneId: string, pos: { x: number; y: number }) => {
      commitLive((prev) => ({
        ...prev,
        nodePositions: {
          ...(prev.nodePositions ?? {}),
          [sceneId]: { x: Math.round(pos.x), y: Math.round(pos.y) },
        },
      }));
    },

    resetNodePositions: (sceneIds?: string[]) => {
      commitLive((prev) => {
        if (!sceneIds || sceneIds.length === 0) {
          return {
            ...prev,
            nodePositions: {},
          };
        }
        const next = { ...(prev.nodePositions ?? {}) };
        for (const id of sceneIds) {
          delete next[id];
        }
        return {
          ...prev,
          nodePositions: next,
        };
      });
    },

    addImprovisedArea: (input) => {
      const name = input.name.trim();
      if (!name) return null;
      const state = get();
      if (!state.live) return null;
      const effectiveScenes = getEffectiveScenes(state.merged.scenes, state.live);
      const currentScene = effectiveScenes.find((s) => s.id === state.live?.currentSceneId);
      const actId =
        input.actId?.trim() ||
        currentScene?.act_id ||
        state.merged.acts[0]?.id ||
        effectiveScenes[0]?.act_id ||
        'a1';

      const existing = (state.live.improvisedAreas ?? []).find(
        (a) => a.actId === actId && a.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return existing;

      const created: ImprovisedAreaRecord = {
        id: `imp-area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        actId,
        name,
        createdAt: Date.now(),
      };
      commitLive((prev) => ({
        ...prev,
        improvisedAreas: [...(prev.improvisedAreas ?? []), created],
      }));
      return created;
    },

    addImprovisedScene: (input) => {
      const title = input.title.trim();
      if (!title) return null;
      const state = get();
      if (!state.live) return null;

      const effectiveScenes = getEffectiveScenes(state.merged.scenes, state.live);
      const currentScene = effectiveScenes.find((s) => s.id === state.live?.currentSceneId);
      const actId =
        input.actId?.trim() ||
        currentScene?.act_id ||
        state.merged.acts[0]?.id ||
        effectiveScenes[0]?.act_id ||
        'a1';
      const code = input.code?.trim() || nextImprovisedSceneCode(effectiveScenes);
      const area = input.area?.trim() ?? '';
      const sceneId = `imp-scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newScene: ModuleScene = {
        id: sceneId,
        code,
        title,
        act_id: actId,
        archetype: input.archetype ?? 'physical_zone',
        group: area,
        page: 0,
        summary: input.summary?.trim() ?? '',
        tags: ['Improvised'],
        read_aloud: null,
        tier1_sensory: [],
        tier2_interactive: [],
        tier3_hidden: [],
        entity_ids: [],
        entity_counts: {},
        gm_tips: '',
        escalation: [],
        default_map_id: null,
        needs_review: false,
        source_quote: '',
      };

      const connectFromId = input.connectFromSceneId?.trim() || '';
      const newConnection: ModuleConnection | null = connectFromId
        ? {
            id: `imp-conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            from: connectFromId,
            to: sceneId,
            type: 'travel',
            label: input.connectionLabel?.trim() || title,
            two_way: input.twoWay ?? true,
            state: 'open',
            requires: null,
            page: 0,
            needs_review: false,
            source_quote: '',
          }
        : null;

      const selectScene = input.selectScene ?? true;
      commitLive((prev) => ({
        ...prev,
        improvisedScenes: [...(prev.improvisedScenes ?? []), newScene],
        improvisedConnections: newConnection
          ? [...(prev.improvisedConnections ?? []), newConnection]
          : prev.improvisedConnections,
        currentSceneId: selectScene ? sceneId : prev.currentSceneId,
        visited: selectScene
          ? { ...prev.visited, [sceneId]: true }
          : prev.visited,
        nodePositions: input.nodePosition
          ? {
              ...(prev.nodePositions ?? {}),
              [sceneId]: {
                x: Math.round(input.nodePosition.x),
                y: Math.round(input.nodePosition.y),
              },
            }
          : prev.nodePositions,
      }));

      return { scene: newScene, connection: newConnection };
    },

    addImprovisedClock: (input) => {
      const name = input.name.trim();
      if (!name) return null;
      const state = get();
      if (!state.live) return null;
      const segments = Math.max(2, Math.min(12, Math.round(input.segments || 4)));
      const clock: ModuleClock = {
        id: `imp-clock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        segments,
        start: 0,
        when_full: input.whenFull?.trim() ?? '',
        hidden: false,
        scope: input.scope?.trim() || 'global',
      };
      commitLive((prev) => ({
        ...prev,
        improvisedClocks: [...(prev.improvisedClocks ?? []), clock],
      }));
      return clock;
    },

    addImprovisedClue: (input) => {
      const text = input.text.trim();
      if (!text) return null;
      const state = get();
      if (!state.live) return null;

      let truthId = input.truthId?.trim() ?? '';
      let createdTruth: ModuleTruth | null = null;
      if (!truthId) {
        const truthTitle = input.newTruthTitle?.trim() || 'Improvised Mystery';
        truthId = `imp-truth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        createdTruth = {
          id: truthId,
          title: truthTitle,
          text: input.newTruthAnswer?.trim() || '',
          importance: 'optional',
          scope: 'global',
          page: 0,
        };
      }

      const clue: ImprovisedClueRecord = {
        id: `imp-clue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        truthId,
        text,
        sourceLabel: input.sourceLabel?.trim() || undefined,
        sceneId: input.sceneId ?? null,
        createdAt: Date.now(),
      };

      commitLive((prev) => ({
        ...prev,
        improvisedTruths: createdTruth
          ? [...(prev.improvisedTruths ?? []), createdTruth]
          : prev.improvisedTruths,
        improvisedClues: [...(prev.improvisedClues ?? []), clue],
      }));
      return { clue, truth: createdTruth };
    },

    addImprovisedFaction: (input) => {
      const name = input.name.trim();
      if (!name) return null;
      const state = get();
      if (!state.live) return null;
      const faction: ModuleFaction = {
        id: `imp-faction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        summary: input.summary?.trim() ?? '',
        goal: input.goal?.trim() ?? '',
        attitude: input.attitude ?? 'neutral',
        secret: input.secret?.trim() || null,
        scope: 'global',
        page: 0,
      };
      commitLive((prev) => ({
        ...prev,
        improvisedFactions: [...(prev.improvisedFactions ?? []), faction],
      }));
      return faction;
    },

    deleteScene: (sceneId) => {
      const state = get();
      if (!state.live) return;
      const isBaseScene = state.merged.scenes.some((s) => s.id === sceneId);
      const remaining = getEffectiveScenes(state.merged.scenes, state.live).filter(
        (s) => s.id !== sceneId
      );
      commitLive((prev) => {
        const orphaned = prev.notes.filter((n) => n.targetId === sceneId);
        const keptNotes = prev.notes.filter((n) => n.targetId !== sceneId);
        const deletedIds = isBaseScene
          ? Array.from(new Set([...(prev.deletedSceneIds ?? []), sceneId]))
          : (prev.deletedSceneIds ?? []);
        const nextCurrent =
          prev.currentSceneId === sceneId
            ? (remaining[0]?.id ?? null)
            : prev.currentSceneId;
        return {
          ...prev,
          improvisedScenes: (prev.improvisedScenes ?? []).filter((s) => s.id !== sceneId),
          improvisedConnections: (prev.improvisedConnections ?? []).filter(
            (c) => c.from !== sceneId && c.to !== sceneId
          ),
          deletedSceneIds: deletedIds,
          notes: keptNotes,
          looseNotes: orphaned.length > 0 ? [...prev.looseNotes, ...orphaned] : prev.looseNotes,
          currentSceneId: nextCurrent,
        };
      });
    },

    deleteArea: (actId, areaName) => {
      const state = get();
      if (!state.live) return;
      const areaKey = makeAreaKey(actId, areaName);
      const effectiveBefore = getEffectiveScenes(state.merged.scenes, state.live);
      const affectedSceneIds = new Set(
        effectiveBefore
          .filter((s) => makeAreaKey(s.act_id, s.group) === areaKey)
          .map((s) => s.id)
      );
      const remaining = effectiveBefore.filter((s) => !affectedSceneIds.has(s.id));

      commitLive((prev) => {
        const orphaned = prev.notes.filter((n) => affectedSceneIds.has(n.targetId));
        const keptNotes = prev.notes.filter((n) => !affectedSceneIds.has(n.targetId));
        const nextCurrent =
          prev.currentSceneId && affectedSceneIds.has(prev.currentSceneId)
            ? (remaining[0]?.id ?? null)
            : prev.currentSceneId;
        return {
          ...prev,
          improvisedAreas: (prev.improvisedAreas ?? []).filter(
            (a) => makeAreaKey(a.actId, a.name) !== areaKey
          ),
          improvisedScenes: (prev.improvisedScenes ?? []).filter(
            (s) => !affectedSceneIds.has(s.id)
          ),
          improvisedConnections: (prev.improvisedConnections ?? []).filter(
            (c) => !affectedSceneIds.has(c.from) && !affectedSceneIds.has(c.to)
          ),
          deletedAreaKeys: Array.from(new Set([...(prev.deletedAreaKeys ?? []), areaKey])),
          notes: keptNotes,
          looseNotes: orphaned.length > 0 ? [...prev.looseNotes, ...orphaned] : prev.looseNotes,
          currentSceneId: nextCurrent,
        };
      });
    },

    refreshPdfInfo: async () => {
      const moduleId =
        get().merged.meta?.module_id || get().activeCampaign?.moduleId || '';
      if (!moduleId) {
        set({ pdfInfo: null });
        return;
      }
      const record = await storageGetBlob(pdfBlobKey(moduleId));
      if (!record) {
        set({ pdfInfo: null });
        return;
      }
      const fileSize =
        record.fileSize ??
        (record.data instanceof Blob
          ? record.data.size
          : record.data instanceof Uint8Array
            ? record.data.byteLength
            : record.data.length);
      set({
        pdfInfo: {
          moduleId,
          fileName: record.fileName || `${moduleId}.pdf`,
          fileSize,
        },
      });
    },

    attachPdf: async (file: File) => {
      const moduleId =
        get().merged.meta?.module_id || get().activeCampaign?.moduleId;
      if (!moduleId) {
        throw new Error('No active module to attach PDF to.');
      }
      // Store as Uint8Array for reliable IndexedDB persistence on iPad Safari
      const bytes =
        typeof file.arrayBuffer === 'function'
          ? new Uint8Array(await file.arrayBuffer())
          : new Uint8Array(await new Response(file).arrayBuffer());
      await storagePutBlob(
        pdfBlobKey(moduleId),
        bytes,
        file.type || 'application/pdf',
        { fileName: file.name, fileSize: file.size || bytes.byteLength }
      );
      set((state) => ({
        pdfInfo: {
          moduleId,
          fileName: file.name,
          fileSize: file.size || bytes.byteLength,
        },
        pdfVersion: state.pdfVersion + 1,
        pdfMissingPrompt: false,
      }));
    },

    saveBackup: async () => {
      const active = get().activeCampaign;
      if (!active) {
        throw new Error('No active campaign to back up.');
      }
      const payload = await storageExportBackup(active.id);
      const campaigns = await storageListCampaigns();
      set({
        activeCampaign: payload.campaign,
        campaigns,
        dirtySinceBackup: false,
      });
      return payload;
    },

    restoreBackup: async (jsonText, options) => {
      sessionEpoch += 1;
      set({ loading: true, errorMessage: null });
      try {
        const result = await storageImportBackup(jsonText, options);
        const campaigns = await storageListCampaigns();
        set({
          ...applyLoaded(result),
          campaigns,
          loading: false,
          dirtySinceBackup: false,
          pdfMissingPrompt: result.pdfMissing,
        });
        void get().refreshPdfInfo();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to restore backup';
        set({ loading: false, errorMessage: msg });
        throw err;
      }
    },

    dismissPdfMissingPrompt: () => {
      set({ pdfMissingPrompt: false });
    },

    addMapAsset: async (input) => {
      const state = get();
      if (!state.live || !state.activeCampaign) return null;
      const campaignId = state.activeCampaign.id;
      const id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const blobKey = `map:${campaignId}:${id}`;
      let bytesOrBlob: Blob | Uint8Array = input.data;
      let fileSize = input.data instanceof Uint8Array ? input.data.byteLength : input.data.size;
      if (!(input.data instanceof Uint8Array) && typeof input.data.arrayBuffer === 'function') {
        const buf = await input.data.arrayBuffer();
        bytesOrBlob = new Uint8Array(buf);
        fileSize = bytesOrBlob.byteLength;
      }
      await storagePutBlob(blobKey, bytesOrBlob, input.mimeType, {
        fileName: input.fileName,
        fileSize,
      });
      const record: MapAssetRecord = {
        id,
        name: input.name.trim() || 'Untitled Map',
        blobKey,
        width: Math.max(1, Math.round(input.width)),
        height: Math.max(1, Math.round(input.height)),
        ...(input.scale ? { scale: input.scale } : {}),
      };
      commitLive((prev) => ({
        ...prev,
        maps: [...(prev.maps ?? []), record],
        ui: {
          ...prev.ui,
          lastMapId: id,
        },
      }));
      return record;
    },

    updateMapAsset: (mapId, patch) => {
      commitLive((prev) => ({
        ...prev,
        maps: (prev.maps ?? []).map((m) => {
          if (m.id !== mapId) return m;
          const next: MapAssetRecord = {
            ...m,
            ...(patch.name !== undefined ? { name: patch.name.trim() || m.name } : {}),
          };
          if ('scale' in patch) {
            if (patch.scale) {
              next.scale = patch.scale;
            } else {
              delete next.scale;
            }
          }
          return next;
        }),
      }));
    },

    deleteMapAsset: async (mapId) => {
      const target = get().live?.maps.find((m) => m.id === mapId);
      commitLive((prev) => {
        const nextPins: Record<string, ScenePin> = {};
        for (const [sid, pin] of Object.entries(prev.pins ?? {})) {
          if (pin.mapId !== mapId) nextPins[sid] = pin;
        }
        const nextSceneMap: Record<string, string> = {};
        for (const [sid, mid] of Object.entries(prev.sceneMap ?? {})) {
          if (mid !== mapId) nextSceneMap[sid] = mid;
        }
        const remainingMaps = (prev.maps ?? []).filter((m) => m.id !== mapId);
        const nextLastMapId =
          prev.ui.lastMapId === mapId ? (remainingMaps[0]?.id ?? null) : prev.ui.lastMapId;
        return {
          ...prev,
          maps: remainingMaps,
          pins: nextPins,
          sceneMap: nextSceneMap,
          ui: {
            ...prev.ui,
            lastMapId: nextLastMapId,
          },
        };
      });
      if (target?.blobKey) {
        await storageDeleteBlob(target.blobKey);
      }
    },

    setSceneMap: (sceneIds, mapId) => {
      if (sceneIds.length === 0) return;
      commitLive((prev) => {
        const nextSceneMap = { ...(prev.sceneMap ?? {}) };
        for (const sid of sceneIds) {
          if (mapId) {
            nextSceneMap[sid] = mapId;
          } else {
            delete nextSceneMap[sid];
          }
        }
        return {
          ...prev,
          sceneMap: nextSceneMap,
          ui: mapId
            ? {
                ...prev.ui,
                lastMapId: mapId,
              }
            : prev.ui,
        };
      });
    },

    setLastMapId: (mapId) => {
      commitLive((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          lastMapId: mapId,
        },
      }));
    },

    setScenePin: (sceneId, pin) => {
      commitLive((prev) => {
        const nextPins = { ...(prev.pins ?? {}) };
        if (pin) {
          nextPins[sceneId] = {
            mapId: pin.mapId,
            xPct: Math.min(100, Math.max(0, Number(pin.xPct.toFixed(2)))),
            yPct: Math.min(100, Math.max(0, Number(pin.yPct.toFixed(2)))),
          };
        } else {
          delete nextPins[sceneId];
        }
        return {
          ...prev,
          pins: nextPins,
        };
      });
    },
  };
});
