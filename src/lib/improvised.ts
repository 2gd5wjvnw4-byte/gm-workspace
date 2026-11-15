import type {
  ModuleClock,
  ModuleConnection,
  ModuleFaction,
  ModuleScene,
  ModuleTruth,
} from './import/types';
import type { LiveState } from '../storage/types';
import {
  LAYOUT_PADDING,
  NODE_COL_GAP,
  NODE_HEIGHT,
  NODE_ROW_GAP,
  NODE_WIDTH,
  type NodeMapNode,
  type NodePosition,
} from './nodeMap';

/** Build a normalized key for an act + area name pair. */
export function makeAreaKey(actId: string, areaName: string): string {
  return `${actId}:${areaName.trim().toLowerCase()}`;
}

function mergeById<T extends { id: string }>(
  base: T[],
  extra: T[] | undefined
): T[] {
  if (!extra || extra.length === 0) return base;
  const seen = new Set(base.map((item) => item.id));
  const uniqueExtra = extra.filter((item) => !seen.has(item.id));
  return uniqueExtra.length > 0 ? [...base, ...uniqueExtra] : base;
}

/** Merge base module scenes with improvised scenes and exclude deleted scenes/areas. */
export function getEffectiveScenes(
  baseScenes: ModuleScene[],
  live: LiveState | null | undefined
): ModuleScene[] {
  const combined = mergeById(baseScenes, live?.improvisedScenes);
  const deletedScenes = new Set(live?.deletedSceneIds ?? []);
  const deletedAreas = new Set(live?.deletedAreaKeys ?? []);
  if (deletedScenes.size === 0 && deletedAreas.size === 0) {
    return combined;
  }
  return combined.filter((s) => {
    if (deletedScenes.has(s.id)) return false;
    if (s.group && deletedAreas.has(makeAreaKey(s.act_id, s.group))) return false;
    return true;
  });
}

/** Merge base module connections with improvised connections and exclude deleted scenes. */
export function getEffectiveConnections(
  baseConnections: ModuleConnection[],
  live: LiveState | null | undefined
): ModuleConnection[] {
  const combined = mergeById(baseConnections, live?.improvisedConnections);
  const deletedScenes = new Set(live?.deletedSceneIds ?? []);
  if (deletedScenes.size === 0) return combined;
  return combined.filter(
    (c) => !deletedScenes.has(c.from) && !deletedScenes.has(c.to)
  );
}

/** Merge base module clocks with any improvised clocks saved in live state. */
export function getEffectiveClocks(
  baseClocks: ModuleClock[],
  live: LiveState | null | undefined
): ModuleClock[] {
  return mergeById(baseClocks, live?.improvisedClocks);
}

/** Merge base module truths with any improvised truths saved in live state. */
export function getEffectiveTruths(
  baseTruths: ModuleTruth[],
  live: LiveState | null | undefined
): ModuleTruth[] {
  return mergeById(baseTruths, live?.improvisedTruths);
}

/** Merge base module factions with any improvised factions saved in live state. */
export function getEffectiveFactions(
  baseFactions: ModuleFaction[],
  live: LiveState | null | undefined
): ModuleFaction[] {
  return mergeById(baseFactions, live?.improvisedFactions);
}

/** Return unique area (group) names for an act across scenes and improvised areas. */
export function getAreasForAct(
  actId: string,
  scenes: ModuleScene[],
  live: LiveState | null | undefined
): string[] {
  const deletedAreas = new Set(live?.deletedAreaKeys ?? []);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const scene of scenes) {
    if (
      scene.act_id === actId &&
      scene.group &&
      !seen.has(scene.group) &&
      !deletedAreas.has(makeAreaKey(actId, scene.group))
    ) {
      seen.add(scene.group);
      result.push(scene.group);
    }
  }
  for (const area of live?.improvisedAreas ?? []) {
    if (
      area.actId === actId &&
      area.name &&
      !seen.has(area.name) &&
      !deletedAreas.has(makeAreaKey(actId, area.name))
    ) {
      seen.add(area.name);
      result.push(area.name);
    }
  }
  return result;
}

/** Generate the next unused short scene code such as X1, X2, ... */
export function nextImprovisedSceneCode(existingScenes: ModuleScene[]): string {
  const used = new Set(existingScenes.map((s) => s.code.trim().toUpperCase()));
  let idx = 1;
  while (used.has(`X${idx}`)) {
    idx += 1;
  }
  return `X${idx}`;
}

/** Pick a non-overlapping canvas position for a newly added map node. */
export function pickNextNodePosition(existingNodes: NodeMapNode[]): NodePosition {
  if (existingNodes.length === 0) {
    return { x: LAYOUT_PADDING, y: LAYOUT_PADDING };
  }

  let maxY = -Infinity;
  for (const node of existingNodes) {
    if (node.y > maxY) {
      maxY = node.y;
    }
  }

  const bottomRow = existingNodes.filter(
    (n) => Math.abs(n.y - maxY) < NODE_HEIGHT / 2
  );
  let maxXInBottomRow = -Infinity;
  for (const node of bottomRow) {
    if (node.x > maxXInBottomRow) {
      maxXInBottomRow = node.x;
    }
  }

  if (bottomRow.length < 3) {
    return {
      x: Math.round(maxXInBottomRow + NODE_WIDTH + NODE_COL_GAP),
      y: Math.round(maxY),
    };
  }

  return {
    x: LAYOUT_PADDING,
    y: Math.round(maxY + NODE_HEIGHT + NODE_ROW_GAP),
  };
}
