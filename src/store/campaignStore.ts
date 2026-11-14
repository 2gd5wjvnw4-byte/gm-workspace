import { create } from 'zustand';
import {
  createCampaign as storageCreateCampaign,
  deleteCampaign as storageDeleteCampaign,
  deleteChunk as storageDeleteChunk,
  importChunk as storageImportChunk,
  listCampaigns as storageListCampaigns,
  loadCampaign as storageLoadCampaign,
  saveLive as storageSaveLive,
  type CampaignRecord,
  type ChunkRecord,
  type ConnectionOverrideState,
  type DispositionState,
  type ImprovisedEntityRecord,
  type LiveState,
  type LoadedCampaign,
  type MapDisplayMode,
  type NavViewMode,
  type TableNote,
} from '../storage';
import { mergeRawChunkObjects, type MergedCampaignData } from '../lib/import';
import { useThemeStore } from './themeStore';

export interface CampaignStoreState {
  campaigns: CampaignRecord[];
  activeCampaign: CampaignRecord | null;
  chunks: ChunkRecord[];
  live: LiveState | null;
  merged: MergedCampaignData;
  loading: boolean;
  errorMessage: string | null;
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
    set({ live: next });
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
        });
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
        });
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
        });
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
      });
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
  };
});
