import type {
  ConnectionState,
  ModuleConnection,
  ModuleScene,
  SceneArchetype,
  SceneItem,
  SceneItemKind,
} from './import/types';
import type { ConnectionOverrideState } from '../storage/types';

export interface ArchetypeLabels {
  name: string;
  tier1: string;
  tier2: string;
  tier3: string;
  exits: string;
}

const ARCHETYPE_TABLE: Record<SceneArchetype, ArchetypeLabels> = {
  physical_zone: {
    name: 'Physical Zone',
    tier1: 'Sensory',
    tier2: 'Interactive',
    tier3: 'Hidden Threats & Loot',
    exits: 'Exits',
  },
  open_hub: {
    name: 'Open Hub',
    tier1: 'Atmosphere',
    tier2: 'Points of Interest & Hooks',
    tier3: 'Secrets',
    exits: 'Go To',
  },
  investigation: {
    name: 'Investigation',
    tier1: 'Surface Observations',
    tier2: 'Leads & Evidence',
    tier3: 'Deep Forensics & Secrets',
    exits: 'Follow Leads',
  },
  action_stage: {
    name: 'Action Stage',
    tier1: 'The Stage',
    tier2: 'Tools & Complications',
    tier3: 'Hidden Threats',
    exits: 'Outcomes',
  },
  unknown: {
    name: 'Scene',
    tier1: 'Details',
    tier2: 'Interactive',
    tier3: 'Hidden',
    exits: 'Exits',
  },
};

export function getArchetypeLabels(archetype: SceneArchetype | string): ArchetypeLabels {
  if (archetype in ARCHETYPE_TABLE) {
    return ARCHETYPE_TABLE[archetype as SceneArchetype];
  }
  return ARCHETYPE_TABLE.unknown;
}

export function buildUnlockingItemsByConnection(scenes: ModuleScene[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const scene of scenes) {
    for (const item of [...scene.tier2_interactive, ...scene.tier3_hidden]) {
      if (item.unlocks_connection_id) {
        const list = map.get(item.unlocks_connection_id) ?? [];
        list.push(item.id);
        map.set(item.unlocks_connection_id, list);
      }
    }
  }
  return map;
}

export function getEffectiveConnectionState(
  connection: ModuleConnection,
  connectionState: Record<string, ConnectionOverrideState>,
  revealed: Record<string, boolean>,
  unlockingItemsByConnection?: Map<string, string[]>
): ConnectionState {
  const override = connectionState[connection.id];
  if (override) {
    return override;
  }
  if (unlockingItemsByConnection) {
    const itemIds = unlockingItemsByConnection.get(connection.id);
    if (itemIds && itemIds.some((id) => Boolean(revealed[id]))) {
      return 'open';
    }
  }
  return connection.state;
}

export function computeReachableSceneIds(params: {
  visited: Record<string, boolean>;
  currentSceneId?: string | null;
  connections: ModuleConnection[];
  connectionState: Record<string, ConnectionOverrideState>;
  revealed: Record<string, boolean>;
  scenes: ModuleScene[];
}): Set<string> {
  const { visited, currentSceneId, connections, connectionState, revealed, scenes } = params;
  const unlockingMap = buildUnlockingItemsByConnection(scenes);
  const visitedSet = new Set<string>(
    Object.keys(visited).filter((id) => Boolean(visited[id]))
  );
  if (currentSceneId) {
    visitedSet.add(currentSceneId);
  }

  const reachable = new Set<string>();
  for (const conn of connections) {
    const effState = getEffectiveConnectionState(
      conn,
      connectionState,
      revealed,
      unlockingMap
    );
    if (effState !== 'open') {
      continue;
    }
    if (visitedSet.has(conn.from) && conn.to) {
      reachable.add(conn.to);
    }
    if (conn.two_way && visitedSet.has(conn.to) && conn.from) {
      reachable.add(conn.from);
    }
  }
  return reachable;
}

export type SceneVisibilityState = 'visible' | 'masked' | 'hidden';

export function getSceneVisibility(params: {
  sceneId: string;
  soloMask: boolean;
  visited: Record<string, boolean>;
  currentSceneId?: string | null;
  reachable: Set<string>;
}): SceneVisibilityState {
  const { sceneId, soloMask, visited, currentSceneId, reachable } = params;
  const isVisited = Boolean(visited[sceneId]) || sceneId === currentSceneId;
  if (!soloMask) {
    return 'visible';
  }
  if (isVisited) {
    return 'visible';
  }
  if (reachable.has(sceneId)) {
    return 'masked';
  }
  return 'hidden';
}

export interface MaskedItemView {
  id: string;
  tier: 2 | 3;
  isRevealed: boolean;
  isCardMasked: boolean;
  kind: SceneItemKind | 'hidden';
  kindLabel: string;
  label: string;
  checkText: string;
  showResult: boolean;
  showHiddenResultHint: boolean;
  resultText: string;
  actionButtonLabel: string;
}

const KIND_LABELS: Record<SceneItemKind, string> = {
  hazard: 'Hazard',
  clue: 'Clue',
  loot: 'Loot',
  tech: 'Tech',
  social: 'Social',
  other: 'Other',
};

export function getMaskedItemView(
  item: SceneItem,
  tier: 2 | 3,
  soloMask: boolean,
  revealed: Record<string, boolean>
): MaskedItemView {
  const isRevealed = Boolean(revealed[item.id]);
  const isCardMasked = tier === 3 && soloMask && !isRevealed;
  const kindLabel = isCardMasked ? 'Hidden' : (KIND_LABELS[item.kind] ?? 'Other');
  const label = isCardMasked ? 'Something is hidden here' : item.label;
  const checkText = item.check ? item.check : 'No check';
  const showResult = !soloMask || isRevealed;
  const showHiddenResultHint = tier === 2 && soloMask && !isRevealed;
  const actionButtonLabel = soloMask
    ? isRevealed
      ? 'Revealed'
      : 'Reveal'
    : isRevealed
      ? 'Found'
      : 'Mark found';

  return {
    id: item.id,
    tier,
    isRevealed,
    isCardMasked,
    kind: isCardMasked ? 'hidden' : item.kind,
    kindLabel,
    label,
    checkText,
    showResult,
    showHiddenResultHint,
    resultText: item.result,
    actionButtonLabel,
  };
}

export interface ExitDisplayView {
  connectionId: string;
  targetSceneId: string;
  typeLabel: string;
  label: string;
  stateLabel: string;
  effectiveState: ConnectionState | 'not_loaded';
  disabled: boolean;
  colorVariant: 'open' | 'gold' | 'muted';
}

export function getSceneExits(params: {
  sceneId: string;
  connections: ModuleConnection[];
  scenes: ModuleScene[];
  notLoadedTargets: Set<string>;
  connectionState: Record<string, ConnectionOverrideState>;
  revealed: Record<string, boolean>;
  soloMask: boolean;
}): ExitDisplayView[] {
  const {
    sceneId,
    connections,
    scenes,
    notLoadedTargets,
    connectionState,
    revealed,
    soloMask,
  } = params;
  const loadedSceneIds = new Set(scenes.map((s) => s.id));
  const unlockingMap = buildUnlockingItemsByConnection(scenes);
  const views: ExitDisplayView[] = [];

  for (const conn of connections) {
    let targetSceneId: string | null = null;
    if (conn.from === sceneId) {
      targetSceneId = conn.to;
    } else if (conn.two_way && conn.to === sceneId) {
      targetSceneId = conn.from;
    }
    if (!targetSceneId) {
      continue;
    }

    const isTargetNotLoaded =
      notLoadedTargets.has(targetSceneId) || !loadedSceneIds.has(targetSceneId);
    const effState = getEffectiveConnectionState(
      conn,
      connectionState,
      revealed,
      unlockingMap
    );

    const typeLabel = conn.type.toUpperCase();

    if (isTargetNotLoaded) {
      views.push({
        connectionId: conn.id,
        targetSceneId,
        typeLabel,
        label: conn.label,
        stateLabel: 'Not loaded',
        effectiveState: 'not_loaded',
        disabled: true,
        colorVariant: 'muted',
      });
      continue;
    }

    if (effState === 'open') {
      views.push({
        connectionId: conn.id,
        targetSceneId,
        typeLabel,
        label: conn.label,
        stateLabel: 'Open',
        effectiveState: 'open',
        disabled: false,
        colorVariant: 'open',
      });
      continue;
    }

    if (effState === 'hidden') {
      const label = soloMask ? '???' : conn.label;
      const stateLabel = soloMask
        ? 'Unrevealed'
        : conn.requires
          ? `Hidden · ${conn.requires}`
          : 'Hidden';
      views.push({
        connectionId: conn.id,
        targetSceneId,
        typeLabel,
        label,
        stateLabel,
        effectiveState: 'hidden',
        disabled: true,
        colorVariant: 'muted',
      });
      continue;
    }

    const baseStateText = effState === 'locked' ? 'Locked' : 'Sealed';
    const stateLabel =
      !soloMask && conn.requires ? `${baseStateText} · ${conn.requires}` : baseStateText;
    views.push({
      connectionId: conn.id,
      targetSceneId,
      typeLabel,
      label: conn.label,
      stateLabel,
      effectiveState: effState,
      disabled: true,
      colorVariant: 'gold',
    });
  }

  return views;
}
