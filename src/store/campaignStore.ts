import { create } from 'zustand';
import {
  createCampaign as storageCreateCampaign,
  deleteChunk as storageDeleteChunk,
  importChunk as storageImportChunk,
  listCampaigns as storageListCampaigns,
  loadCampaign as storageLoadCampaign,
  type CampaignRecord,
  type ChunkRecord,
  type LiveState,
  type LoadedCampaign,
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
  importJsonChunk: (rawJsonText: string) => Promise<LoadedCampaign>;
  removeChunk: (chunkId: string) => Promise<void>;
  setActiveLoadedCampaign: (loaded: LoadedCampaign | null) => void;
  clearError: () => void;
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
  if (loaded.live?.theme) {
    useThemeStore.getState().setTheme(loaded.live.theme);
  }
  return {
    activeCampaign: loaded.campaign,
    chunks: loaded.chunks,
    live: loaded.live,
    merged,
  };
}

let sessionEpoch = 0;

export const useCampaignStore = create<CampaignStoreState>((set, get) => ({
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
}));
