import type { ModuleConnection, ModuleScene } from './import/types';
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

/** Merge base module scenes with any improvised scenes saved in live state. */
export function getEffectiveScenes(
  baseScenes: ModuleScene[],
  live: LiveState | null | undefined
): ModuleScene[] {
  const imp = live?.improvisedScenes ?? [];
  if (imp.length === 0) return baseScenes;
  const seen = new Set(baseScenes.map((s) => s.id));
  const extra = imp.filter((s) => !seen.has(s.id));
  return extra.length > 0 ? [...baseScenes, ...extra] : baseScenes;
}

/** Merge base module connections with any improvised connections saved in live state. */
export function getEffectiveConnections(
  baseConnections: ModuleConnection[],
  live: LiveState | null | undefined
): ModuleConnection[] {
  const imp = live?.improvisedConnections ?? [];
  if (imp.length === 0) return baseConnections;
  const seen = new Set(baseConnections.map((c) => c.id));
  const extra = imp.filter((c) => !seen.has(c.id));
  return extra.length > 0 ? [...baseConnections, ...extra] : baseConnections;
}

/** Return unique area (group) names for an act across scenes and improvised areas. */
export function getAreasForAct(
  actId: string,
  scenes: ModuleScene[],
  live: LiveState | null | undefined
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const scene of scenes) {
    if (scene.act_id === actId && scene.group && !seen.has(scene.group)) {
      seen.add(scene.group);
      result.push(scene.group);
    }
  }
  for (const area of live?.improvisedAreas ?? []) {
    if (area.actId === actId && area.name && !seen.has(area.name)) {
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
