import type {
  ConnectionState,
  ModuleConnection,
  ModuleScene,
} from './import/types';
import type { ConnectionOverrideState } from '../storage/types';
import {
  buildUnlockingItemsByConnection,
  computeReachableSceneIds,
  getEffectiveConnectionState,
  getSceneVisibility,
} from './solo';

export const NODE_WIDTH = 116;
export const NODE_HEIGHT = 48;
export const NODE_COL_GAP = 28;
export const NODE_ROW_GAP = 32;
export const LAYOUT_PADDING = 24;
export const MAX_NODES_PER_ROW = 3;

export interface NodePosition {
  x: number;
  y: number;
}

export type NodeStatus = 'current' | 'visited' | 'unvisited' | 'not-loaded';

export interface NodeMapNode {
  id: string;
  code: string;
  title: string;
  status: NodeStatus;
  masked: boolean;
  notLoaded: boolean;
  x: number;
  y: number;
}

export interface NodeMapEdge {
  id: string;
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  effectiveState: ConnectionState;
  solid: boolean;
  twoWay: boolean;
}

export interface NodeMapGraph {
  actId: string | null;
  nodes: NodeMapNode[];
  edges: NodeMapEdge[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export function computeBfsDefaultPositions(
  nodeIds: string[],
  firstSceneId: string | null,
  connections: ModuleConnection[]
): Record<string, NodePosition> {
  if (nodeIds.length === 0) {
    return {};
  }

  const idSet = new Set(nodeIds);
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    adj.set(id, []);
  }

  for (const conn of connections) {
    if (idSet.has(conn.from) && idSet.has(conn.to)) {
      adj.get(conn.from)!.push(conn.to);
      adj.get(conn.to)!.push(conn.from);
    }
  }

  const depthById = new Map<string, number>();
  const queue: string[] = [];
  const root = firstSceneId && idSet.has(firstSceneId) ? firstSceneId : nodeIds[0];

  depthById.set(root, 0);
  queue.push(root);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curDepth = depthById.get(cur)!;
    for (const next of adj.get(cur) ?? []) {
      if (!depthById.has(next)) {
        depthById.set(next, curDepth + 1);
        queue.push(next);
      }
    }
  }

  // Place any disconnected nodes after the deepest connected layer
  let maxDepth = 0;
  for (const d of depthById.values()) {
    if (d > maxDepth) {
      maxDepth = d;
    }
  }
  for (const id of nodeIds) {
    if (!depthById.has(id)) {
      maxDepth += 1;
      depthById.set(id, maxDepth);
    }
  }

  // Group into layers by depth, preserving input order within each depth
  const layers = new Map<number, string[]>();
  for (const id of nodeIds) {
    const d = depthById.get(id)!;
    const list = layers.get(d) ?? [];
    list.push(id);
    layers.set(d, list);
  }

  const sortedDepths = Array.from(layers.keys()).sort((a, b) => a - b);
  const rows: string[][] = [];
  for (const d of sortedDepths) {
    const group = layers.get(d)!;
    for (let i = 0; i < group.length; i += MAX_NODES_PER_ROW) {
      rows.push(group.slice(i, i + MAX_NODES_PER_ROW));
    }
  }

  const maxRowWidth =
    MAX_NODES_PER_ROW * NODE_WIDTH + (MAX_NODES_PER_ROW - 1) * NODE_COL_GAP;

  const positions: Record<string, NodePosition> = {};
  rows.forEach((row, rowIdx) => {
    const rowWidth =
      row.length * NODE_WIDTH + Math.max(0, row.length - 1) * NODE_COL_GAP;
    const startX = LAYOUT_PADDING + (maxRowWidth - rowWidth) / 2;
    const y = LAYOUT_PADDING + rowIdx * (NODE_HEIGHT + NODE_ROW_GAP);

    row.forEach((id, colIdx) => {
      positions[id] = {
        x: Math.round(startX + colIdx * (NODE_WIDTH + NODE_COL_GAP)),
        y: Math.round(y),
      };
    });
  });

  return positions;
}

export function buildNodeMapGraph(params: {
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  notLoadedTargets: Set<string>;
  currentSceneId: string | null;
  visited: Record<string, boolean>;
  revealed: Record<string, boolean>;
  connectionState: Record<string, ConnectionOverrideState>;
  soloMask: boolean;
  nodePositions: Record<string, NodePosition>;
}): NodeMapGraph {
  const {
    scenes,
    connections,
    notLoadedTargets,
    currentSceneId,
    visited,
    revealed,
    connectionState,
    soloMask,
    nodePositions,
  } = params;

  const currentScene =
    scenes.find((s) => s.id === currentSceneId) ?? scenes[0] ?? null;
  const actId = currentScene?.act_id ?? null;

  const actScenes = actId
    ? scenes.filter((s) => s.act_id === actId)
    : scenes;
  const actSceneIds = new Set(actScenes.map((s) => s.id));

  const reachable = computeReachableSceneIds({
    visited,
    currentSceneId,
    connections,
    connectionState,
    revealed,
    scenes,
  });
  const unlockingMap = buildUnlockingItemsByConnection(scenes);

  // Collect unloaded target scene IDs linked from this act
  const unloadedIds: string[] = [];
  const seenUnloaded = new Set<string>();
  for (const conn of connections) {
    const fromInAct = actSceneIds.has(conn.from);
    const toInAct = actSceneIds.has(conn.to);
    if (!fromInAct && !toInAct) {
      continue;
    }
    for (const candidate of [conn.from, conn.to]) {
      if (
        candidate &&
        !actSceneIds.has(candidate) &&
        notLoadedTargets.has(candidate) &&
        !seenUnloaded.has(candidate)
      ) {
        seenUnloaded.add(candidate);
        unloadedIds.push(candidate);
      }
    }
  }

  // Compute BFS layout over all act + linked not-loaded nodes so positions stay stable when Solo Mask toggles
  const allLayoutIds = [...actScenes.map((s) => s.id), ...unloadedIds];
  const defaultPositions = computeBfsDefaultPositions(
    allLayoutIds,
    actScenes[0]?.id ?? null,
    connections
  );

  const visibleNodes: NodeMapNode[] = [];
  const visibleNodeMap = new Map<string, NodeMapNode>();

  for (const scene of actScenes) {
    const visibility = getSceneVisibility({
      sceneId: scene.id,
      soloMask,
      visited,
      currentSceneId,
      reachable,
    });
    if (visibility === 'hidden') {
      continue;
    }
    const isCurrent = scene.id === currentSceneId;
    const isVisited = Boolean(visited[scene.id]) || isCurrent;
    const status: NodeStatus = isCurrent
      ? 'current'
      : isVisited
        ? 'visited'
        : 'unvisited';
    const pos = nodePositions[scene.id] ?? defaultPositions[scene.id] ?? { x: 24, y: 24 };
    const node: NodeMapNode = {
      id: scene.id,
      code: scene.code ? `#${scene.code}` : scene.id,
      title: visibility === 'masked' ? '???' : scene.title,
      status,
      masked: visibility === 'masked',
      notLoaded: false,
      x: pos.x,
      y: pos.y,
    };
    visibleNodes.push(node);
    visibleNodeMap.set(node.id, node);
  }

  for (const targetId of unloadedIds) {
    const visibility = getSceneVisibility({
      sceneId: targetId,
      soloMask,
      visited,
      currentSceneId,
      reachable,
    });
    if (visibility === 'hidden') {
      continue;
    }
    const pos = nodePositions[targetId] ?? defaultPositions[targetId] ?? { x: 24, y: 24 };
    const node: NodeMapNode = {
      id: targetId,
      code: targetId,
      title: 'Not loaded',
      status: 'not-loaded',
      masked: false,
      notLoaded: true,
      x: pos.x,
      y: pos.y,
    };
    visibleNodes.push(node);
    visibleNodeMap.set(node.id, node);
  }

  const edges: NodeMapEdge[] = [];
  for (const conn of connections) {
    const fromNode = visibleNodeMap.get(conn.from);
    const toNode = visibleNodeMap.get(conn.to);
    if (!fromNode || !toNode) {
      continue;
    }
    const effectiveState = getEffectiveConnectionState(
      conn,
      connectionState,
      revealed,
      unlockingMap
    );
    const isNotLoadedEdge = fromNode.notLoaded || toNode.notLoaded;
    const solid = effectiveState === 'open' && !isNotLoadedEdge;
    edges.push({
      id: conn.id,
      from: conn.from,
      to: conn.to,
      fromX: fromNode.x + NODE_WIDTH / 2,
      fromY: fromNode.y + NODE_HEIGHT / 2,
      toX: toNode.x + NODE_WIDTH / 2,
      toY: toNode.y + NODE_HEIGHT / 2,
      effectiveState,
      solid,
      twoWay: conn.two_way,
    });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of visibleNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + NODE_WIDTH > maxX) maxX = n.x + NODE_WIDTH;
    if (n.y + NODE_HEIGHT > maxY) maxY = n.y + NODE_HEIGHT;
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 300;
    maxY = 200;
  }

  return {
    actId,
    nodes: visibleNodes,
    edges,
    bounds: { minX, minY, maxX, maxY },
  };
}
