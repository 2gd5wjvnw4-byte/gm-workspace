import type {
  ConnectionState,
  ModuleConnection,
  ModuleEntity,
  ModuleFaction,
  ModuleRandomTable,
  ModuleScene,
  ModuleTruth,
  SceneArchetype,
  SceneItem,
  SceneItemKind,
} from './import/types';
import type {
  ConnectionOverrideState,
  ImprovisedEntityRecord,
} from '../storage/types';

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

export type SearchResultType =
  | 'scene'
  | 'entity'
  | 'item'
  | 'truth'
  | 'faction'
  | 'table';

export interface SearchResultEntry {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
  sceneId?: string;
  entityId?: string;
  itemId?: string;
}

export interface SearchModuleParams {
  query: string;
  scenes: ModuleScene[];
  entities: ModuleEntity[];
  improvisedEntities?: ImprovisedEntityRecord[];
  truths: ModuleTruth[];
  factions: ModuleFaction[];
  randomTables: ModuleRandomTable[];
  connections: ModuleConnection[];
  connectionState: Record<string, ConnectionOverrideState>;
  visited: Record<string, boolean>;
  revealed: Record<string, boolean>;
  summoned?: Record<string, string[]>;
  currentSceneId?: string | null;
  soloMask: boolean;
}

export function searchModuleRecords(params: SearchModuleParams): SearchResultEntry[] {
  const {
    query,
    scenes,
    entities,
    improvisedEntities = [],
    truths,
    factions,
    randomTables,
    connections,
    connectionState,
    visited,
    revealed,
    summoned = {},
    currentSceneId,
    soloMask,
  } = params;

  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const reachable = computeReachableSceneIds({
    visited,
    currentSceneId,
    connections,
    connectionState,
    revealed,
    scenes,
  });

  const isSceneVisited = (sceneId: string) =>
    Boolean(visited[sceneId]) || sceneId === currentSceneId;

  const results: SearchResultEntry[] = [];

  // 1. Scenes (codes, titles, summaries)
  for (const scene of scenes) {
    const vis = getSceneVisibility({
      sceneId: scene.id,
      soloMask,
      visited,
      currentSceneId,
      reachable,
    });
    if (vis === 'hidden' || vis === 'masked') {
      // Unvisited scenes in Solo Mask are either hidden or shown as "???" — do not leak their titles/summaries
      if (vis === 'masked' && `#${scene.code}`.toLowerCase().includes(q)) {
        results.push({
          type: 'scene',
          id: scene.id,
          label: `#${scene.code} · ???`,
          sublabel: scene.group || scene.act_id.toUpperCase(),
          sceneId: scene.id,
        });
      }
      continue;
    }

    const codeMatch =
      scene.code.toLowerCase().includes(q) || `#${scene.code}`.toLowerCase().includes(q);
    const titleMatch = scene.title.toLowerCase().includes(q);
    const summaryMatch = scene.summary.toLowerCase().includes(q);

    if (codeMatch || titleMatch || summaryMatch) {
      results.push({
        type: 'scene',
        id: scene.id,
        label: `#${scene.code} · ${scene.title}`,
        sublabel: scene.summary,
        sceneId: scene.id,
      });
    }
  }

  // 2. Entities (base + improvised)
  const visitedEntityIds = new Set<string>();
  if (soloMask) {
    for (const scene of scenes) {
      if (isSceneVisited(scene.id)) {
        for (const eid of scene.entity_ids) {
          visitedEntityIds.add(eid);
        }
        for (const eid of summoned[scene.id] ?? []) {
          visitedEntityIds.add(eid);
        }
      }
    }
  }

  for (const entity of entities) {
    if (soloMask && !entity.roaming && !visitedEntityIds.has(entity.id)) {
      // Check if entity exists in any scene at all; if it's placed only in unvisited scenes, hide in Solo Mask
      const placedSomewhere = scenes.some((s) => s.entity_ids.includes(entity.id));
      if (placedSomewhere) {
        continue;
      }
    }
    if (entity.name.toLowerCase().includes(q)) {
      results.push({
        type: 'entity',
        id: entity.id,
        label: entity.name,
        sublabel: entity.summary,
        entityId: entity.id,
      });
    }
  }

  for (const imp of improvisedEntities) {
    if (imp.name.toLowerCase().includes(q)) {
      results.push({
        type: 'entity',
        id: imp.id,
        label: `${imp.name} (Improvised)`,
        sublabel: imp.summary,
        entityId: imp.id,
      });
    }
  }

  // 3. Scene items (Tier 2 and Tier 3 labels)
  for (const scene of scenes) {
    if (soloMask && !isSceneVisited(scene.id)) {
      continue;
    }
    for (const item of scene.tier2_interactive) {
      const view = getMaskedItemView(item, 2, soloMask, revealed);
      if (!view.isCardMasked && item.label.toLowerCase().includes(q)) {
        results.push({
          type: 'item',
          id: item.id,
          label: item.label,
          sublabel: `#${scene.code} · ${scene.title}`,
          sceneId: scene.id,
          itemId: item.id,
        });
      }
    }
    for (const item of scene.tier3_hidden) {
      const view = getMaskedItemView(item, 3, soloMask, revealed);
      // In Solo Mask, unrevealed Tier 3 items are masked as "Something is hidden here"
      if (!view.isCardMasked && item.label.toLowerCase().includes(q)) {
        results.push({
          type: 'item',
          id: item.id,
          label: item.label,
          sublabel: `#${scene.code} · ${scene.title}`,
          sceneId: scene.id,
          itemId: item.id,
        });
      }
    }
  }

  // 4. Truth titles
  for (const truth of truths) {
    if (truth.title.toLowerCase().includes(q)) {
      results.push({
        type: 'truth',
        id: truth.id,
        label: truth.title,
        sublabel: truth.importance === 'core' ? 'Core Truth' : 'Optional Truth',
      });
    }
  }

  // 5. Faction names
  for (const faction of factions) {
    if (faction.name.toLowerCase().includes(q)) {
      results.push({
        type: 'faction',
        id: faction.id,
        label: faction.name,
        sublabel: faction.summary,
      });
    }
  }

  // 6. Random table names
  for (const table of randomTables) {
    if (table.name.toLowerCase().includes(q)) {
      results.push({
        type: 'table',
        id: table.id,
        label: table.name,
        sublabel: `Dice: ${table.dice}`,
      });
    }
  }

  return results;
}
