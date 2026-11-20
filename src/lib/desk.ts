import type { MergedCampaignData } from './import/types';
import { getEffectiveScenes } from './improvised';
import {
  fitBounds,
  type PanZoomBounds,
  type PanZoomTransform,
} from './panzoom';
import type {
  DeskCardRecord,
  DeskCardType,
  DeskState,
  LiveState,
} from '../storage/types';

export const DESK_GRID_SIZE = 24;
export const DESK_MIN_ZOOM = 0.25;
export const DESK_MAX_ZOOM = 3.0;
export const DESK_MIN_CARD_WIDTH = 240;
export const DESK_MIN_CARD_HEIGHT = 168;
export const DESK_MAX_CARD_WIDTH = 1608;
export const DESK_MAX_CARD_HEIGHT = 1392;
export const DESK_CARD_HEADER_HEIGHT = 44;

export type DeskResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface DeskCardCatalogItem {
  type: DeskCardType;
  label: string;
  defaultTitle: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const DESK_CARD_CATALOG: DeskCardCatalogItem[] = [
  {
    type: 'scene',
    label: 'Scene Card',
    defaultTitle: 'Current Scene',
    defaultWidth: 520,
    defaultHeight: 420,
  },
  {
    type: 'pdf',
    label: 'PDF Book Card',
    defaultTitle: 'Source PDF',
    defaultWidth: 480,
    defaultHeight: 540,
  },
  {
    type: 'page',
    label: 'Detached PDF Page',
    defaultTitle: 'PDF Page 1',
    defaultWidth: 380,
    defaultHeight: 480,
  },
  {
    type: 'sheet',
    label: 'Character / NPC Sheet',
    defaultTitle: 'Character Sheet',
    defaultWidth: 360,
    defaultHeight: 420,
  },
  {
    type: 'tracker',
    label: 'Tracker Card',
    defaultTitle: 'Tracker',
    defaultWidth: 280,
    defaultHeight: 180,
  },
  {
    type: 'scene-list',
    label: 'Scene List',
    defaultTitle: 'Scenes',
    defaultWidth: 320,
    defaultHeight: 420,
  },
  {
    type: 'node-map',
    label: 'Scene Node Map',
    defaultTitle: 'Node Map',
    defaultWidth: 440,
    defaultHeight: 380,
  },
  {
    type: 'random-tables',
    label: 'Random Tables',
    defaultTitle: 'Random Tables',
    defaultWidth: 340,
    defaultHeight: 360,
  },
  {
    type: 'factions',
    label: 'Factions',
    defaultTitle: 'Factions',
    defaultWidth: 340,
    defaultHeight: 340,
  },
  {
    type: 'timeline',
    label: 'Timeline',
    defaultTitle: 'Timeline',
    defaultWidth: 340,
    defaultHeight: 360,
  },
  {
    type: 'clocks',
    label: 'Clocks',
    defaultTitle: 'Clocks',
    defaultWidth: 340,
    defaultHeight: 320,
  },
  {
    type: 'clue-matrix',
    label: 'Clue Matrix',
    defaultTitle: 'Clue Matrix',
    defaultWidth: 380,
    defaultHeight: 400,
  },
  {
    type: 'notes',
    label: 'Notes & Scratchpad',
    defaultTitle: 'Notes',
    defaultWidth: 340,
    defaultHeight: 320,
  },
];

export function createDefaultDeskState(): DeskState {
  return {
    viewMode: 'structured',
    layoutMode: 'free',
    snapToGrid: false,
    gridSize: DESK_GRID_SIZE,
    viewport: { x: 0, y: 0, scale: 1 },
    cards: [],
  };
}

export function ensureDeskState(desk?: DeskState | null): DeskState {
  if (!desk) {
    return createDefaultDeskState();
  }
  return {
    viewMode: desk.viewMode === 'desk' ? 'desk' : 'structured',
    layoutMode: desk.layoutMode === 'standard' ? 'standard' : 'free',
    snapToGrid: Boolean(desk.snapToGrid),
    gridSize:
      Number.isFinite(desk.gridSize) && desk.gridSize > 0
        ? desk.gridSize
        : DESK_GRID_SIZE,
    viewport: {
      x: Number.isFinite(desk.viewport?.x) ? desk.viewport.x : 0,
      y: Number.isFinite(desk.viewport?.y) ? desk.viewport.y : 0,
      scale:
        Number.isFinite(desk.viewport?.scale) && desk.viewport.scale > 0
          ? desk.viewport.scale
          : 1,
    },
    cards: Array.isArray(desk.cards) ? desk.cards : [],
  };
}

export function snapToDeskGrid(
  value: number,
  gridSize = DESK_GRID_SIZE,
  enabled = false
): number {
  if (!Number.isFinite(value)) return 0;
  if (!enabled || !Number.isFinite(gridSize) || gridSize <= 0) {
    return Math.round(value);
  }
  return Math.round(value / gridSize) * gridSize;
}

export function clampDeskCardSize(
  width: number,
  height: number,
  minWidth = DESK_MIN_CARD_WIDTH,
  minHeight = DESK_MIN_CARD_HEIGHT,
  maxWidth = DESK_MAX_CARD_WIDTH,
  maxHeight = DESK_MAX_CARD_HEIGHT
): { width: number; height: number } {
  const safeW = Number.isFinite(width) ? width : minWidth;
  const safeH = Number.isFinite(height) ? height : minHeight;
  return {
    width: Math.min(maxWidth, Math.max(minWidth, Math.round(safeW))),
    height: Math.min(maxHeight, Math.max(minHeight, Math.round(safeH))),
  };
}

export function resizeDeskCardFromCorner(
  rect: { x: number; y: number; width: number; height: number },
  corner: DeskResizeCorner,
  worldDx: number,
  worldDy: number,
  snapToGrid = false,
  gridSize = DESK_GRID_SIZE
): { x: number; y: number; width: number; height: number } {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  if (corner === 'se') {
    const nextRight = snapToDeskGrid(right + worldDx, gridSize, snapToGrid);
    const nextBottom = snapToDeskGrid(bottom + worldDy, gridSize, snapToGrid);
    const clamped = clampDeskCardSize(nextRight - rect.x, nextBottom - rect.y);
    return {
      x: rect.x,
      y: rect.y,
      width: clamped.width,
      height: clamped.height,
    };
  }

  if (corner === 'sw') {
    const nextLeft = snapToDeskGrid(rect.x + worldDx, gridSize, snapToGrid);
    const nextBottom = snapToDeskGrid(bottom + worldDy, gridSize, snapToGrid);
    const clamped = clampDeskCardSize(right - nextLeft, nextBottom - rect.y);
    return {
      x: right - clamped.width,
      y: rect.y,
      width: clamped.width,
      height: clamped.height,
    };
  }

  if (corner === 'ne') {
    const nextRight = snapToDeskGrid(right + worldDx, gridSize, snapToGrid);
    const nextTop = snapToDeskGrid(rect.y + worldDy, gridSize, snapToGrid);
    const clamped = clampDeskCardSize(nextRight - rect.x, bottom - nextTop);
    return {
      x: rect.x,
      y: bottom - clamped.height,
      width: clamped.width,
      height: clamped.height,
    };
  }

  // corner === 'nw'
  const nextLeft = snapToDeskGrid(rect.x + worldDx, gridSize, snapToGrid);
  const nextTop = snapToDeskGrid(rect.y + worldDy, gridSize, snapToGrid);
  const clamped = clampDeskCardSize(right - nextLeft, bottom - nextTop);
  return {
    x: right - clamped.width,
    y: bottom - clamped.height,
    width: clamped.width,
    height: clamped.height,
  };
}

export function bringCardToFront(
  cards: DeskCardRecord[],
  cardId: string
): DeskCardRecord[] {
  if (!cards.some((c) => c.id === cardId)) {
    return cards;
  }
  const ordered = [...cards].sort((a, b) => a.z - b.z || a.createdAt - b.createdAt);
  const target = ordered.find((c) => c.id === cardId)!;
  const others = ordered.filter((c) => c.id !== cardId);
  const nextOrder = [...others, target];
  const zById = new Map<string, number>();
  nextOrder.forEach((c, idx) => {
    zById.set(c.id, idx + 1);
  });
  return cards.map((c) => ({
    ...c,
    z: zById.get(c.id) ?? c.z,
  }));
}

export function computeDeskCardsBounds(cards: DeskCardRecord[]): PanZoomBounds {
  if (cards.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 500 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const card of cards) {
    const effectiveHeight = card.minimized
      ? DESK_CARD_HEADER_HEIGHT
      : Math.max(DESK_CARD_HEADER_HEIGHT, card.height);
    const effectiveWidth = Math.max(DESK_MIN_CARD_WIDTH, card.width);
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + effectiveWidth);
    maxY = Math.max(maxY, card.y + effectiveHeight);
  }

  return { minX, minY, maxX, maxY };
}

export function fitAllDeskCards(
  cards: DeskCardRecord[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 48
): PanZoomTransform {
  if (cards.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }
  const bounds = computeDeskCardsBounds(cards);
  return fitBounds(
    bounds,
    viewportWidth,
    viewportHeight,
    padding,
    DESK_MIN_ZOOM,
    DESK_MAX_ZOOM,
    1
  );
}

export function isDeskCardTargetMissing(
  card: DeskCardRecord,
  merged: MergedCampaignData,
  live: LiveState | null
): boolean {
  const effectiveScenes = getEffectiveScenes(merged.scenes, live);

  if (!card.targetId) {
    if (card.type === 'scene' && card.followCurrentScene) {
      return effectiveScenes.length === 0;
    }
    return false;
  }

  const targetId = card.targetId;

  switch (card.type) {
    case 'scene':
      return !effectiveScenes.some((s) => s.id === targetId);
    case 'sheet': {
      const inBase = merged.entities.some((e) => e.id === targetId);
      const inImprovised = (live?.improvisedEntities ?? []).some(
        (e) => e.id === targetId
      );
      return !inBase && !inImprovised;
    }
    case 'tracker':
      return !merged.trackers.some((t) => t.id === targetId);
    case 'clocks': {
      const inBase = merged.clocks.some((c) => c.id === targetId);
      const inImprovised = (live?.improvisedClocks ?? []).some(
        (c) => c.id === targetId
      );
      return !inBase && !inImprovised;
    }
    case 'factions': {
      const inBase = merged.factions.some((f) => f.id === targetId);
      const inImprovised = (live?.improvisedFactions ?? []).some(
        (f) => f.id === targetId
      );
      return !inBase && !inImprovised;
    }
    case 'random-tables':
      return !merged.random_tables.some((t) => t.id === targetId);
    case 'clue-matrix': {
      const inBase = merged.truths.some((t) => t.id === targetId);
      const inImprovised = (live?.improvisedTruths ?? []).some(
        (t) => t.id === targetId
      );
      return !inBase && !inImprovised;
    }
    default:
      return true;
  }
}
