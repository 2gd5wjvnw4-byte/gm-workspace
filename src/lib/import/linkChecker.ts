import type {
  CheckedReference,
  LinkCheckResult,
  LinkStatus,
  ModuleAct,
  ModuleConnection,
  ModuleEntity,
  ModuleFaction,
  ModuleRandomTable,
  ModuleScene,
  ModuleTimelineEvent,
  ModuleTruth,
  ReviewEntry,
} from './types';

export interface LinkCheckInput {
  acts: ModuleAct[];
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  entities: ModuleEntity[];
  truths: ModuleTruth[];
  factions: ModuleFaction[];
  timeline: ModuleTimelineEvent[];
  random_tables: ModuleRandomTable[];
  recordSourceChunk: Record<string, string>;
}

const ACT_PREFIX_REGEX = /^(a\d+|act[-_]?\d+)$/i;

function isUnloadedActTarget(targetId: string, loadedActIds: Set<string>, isActField = false): boolean {
  if (isActField) {
    return ACT_PREFIX_REGEX.test(targetId) && !loadedActIds.has(targetId);
  }
  const dashIdx = targetId.indexOf('-');
  if (dashIdx <= 0) {
    return false;
  }
  const prefix = targetId.slice(0, dashIdx);
  return ACT_PREFIX_REGEX.test(prefix) && !loadedActIds.has(prefix);
}

export function checkModuleLinks(input: LinkCheckInput): LinkCheckResult {
  const {
    acts,
    scenes,
    connections,
    entities,
    truths,
    factions,
    timeline,
    random_tables,
    recordSourceChunk,
  } = input;

  const review: ReviewEntry[] = [];
  const references: CheckedReference[] = [];
  const brokenTargets = new Set<string>();
  const notLoadedTargets = new Set<string>();
  const underCluedTruthIds = new Set<string>();

  const actIds = new Set(acts.map((a) => a.id));
  const sceneIds = new Set(scenes.map((s) => s.id));
  const connectionMap = new Map(connections.map((c) => [c.id, c]));
  const entityIds = new Set(entities.map((e) => e.id));
  const truthIds = new Set(truths.map((t) => t.id));
  const factionIds = new Set(factions.map((f) => f.id));

  const chunkFor = (recordId: string): string => recordSourceChunk[recordId] ?? 'chunk-unknown';

  const checkRef = (
    chunkId: string,
    recordId: string,
    field: string,
    targetId: string | null | undefined,
    validSet: Set<string>,
    allowActPrefix = false,
    isActField = false
  ): LinkStatus | null => {
    if (!targetId) {
      return null;
    }
    if (validSet.has(targetId)) {
      references.push({ chunkId, recordId, field, targetId, status: 'ok' });
      return 'ok';
    }
    if (allowActPrefix && isUnloadedActTarget(targetId, actIds, isActField)) {
      notLoadedTargets.add(targetId);
      references.push({ chunkId, recordId, field, targetId, status: 'not_loaded' });
      return 'not_loaded';
    }
    brokenTargets.add(targetId);
    references.push({ chunkId, recordId, field, targetId, status: 'broken' });
    review.push({
      severity: 'warn',
      chunkId,
      recordId,
      field,
      message: `Broken link: "${field}" references unknown ID "${targetId}".`,
    });
    return 'broken';
  };

  for (const scene of scenes) {
    const cId = chunkFor(scene.id);
    checkRef(cId, scene.id, 'act_id', scene.act_id, actIds, true, true);

    for (const entityId of scene.entity_ids) {
      checkRef(cId, scene.id, 'entity_ids', entityId, entityIds, true);
    }

    const allItems = [...scene.tier2_interactive, ...scene.tier3_hidden];
    for (const item of allItems) {
      checkRef(cId, item.id, 'truth_id', item.truth_id, truthIds, true);
      if (item.unlocks_connection_id) {
        const status = checkRef(
          cId,
          item.id,
          'unlocks_connection_id',
          item.unlocks_connection_id,
          new Set(connectionMap.keys()),
          true
        );
        if (status === 'ok') {
          const targetConn = connectionMap.get(item.unlocks_connection_id);
          if (targetConn && targetConn.state === 'open') {
            review.push({
              severity: 'warn',
              chunkId: cId,
              recordId: item.id,
              field: 'unlocks_connection_id',
              message: `Item "${item.id}" unlocks connection "${targetConn.id}", which already starts with state "open".`,
            });
          }
        }
      }
    }
  }

  for (const conn of connections) {
    const cId = chunkFor(conn.id);
    checkRef(cId, conn.id, 'from', conn.from, sceneIds, true);
    checkRef(cId, conn.id, 'to', conn.to, sceneIds, true);
  }

  for (const entity of entities) {
    const cId = chunkFor(entity.id);
    checkRef(cId, entity.id, 'faction_id', entity.faction_id, factionIds, true);
    for (const clue of entity.clues) {
      checkRef(cId, clue.id, 'truth_id', clue.truth_id, truthIds, true);
    }
  }

  for (const event of timeline) {
    const cId = chunkFor(event.id);
    checkRef(cId, event.id, 'scene_id', event.scene_id, sceneIds, true);
  }

  for (const table of random_tables) {
    const cId = chunkFor(table.id);
    for (let i = 0; i < table.entries.length; i += 1) {
      const entry = table.entries[i];
      if (entry.entity_id) {
        checkRef(cId, `${table.id}#${i + 1}`, 'entity_id', entry.entity_id, entityIds, true);
      }
    }
  }

  // Clue count check for core truths (< 2 clues across scenes and entities)
  const clueCountByTruth = new Map<string, number>();
  for (const truth of truths) {
    clueCountByTruth.set(truth.id, 0);
  }
  for (const scene of scenes) {
    for (const item of [...scene.tier2_interactive, ...scene.tier3_hidden]) {
      if (item.truth_id && clueCountByTruth.has(item.truth_id)) {
        clueCountByTruth.set(item.truth_id, (clueCountByTruth.get(item.truth_id) ?? 0) + 1);
      }
    }
  }
  for (const entity of entities) {
    for (const clue of entity.clues) {
      if (clue.truth_id && clueCountByTruth.has(clue.truth_id)) {
        clueCountByTruth.set(clue.truth_id, (clueCountByTruth.get(clue.truth_id) ?? 0) + 1);
      }
    }
  }

  for (const truth of truths) {
    if (truth.importance === 'core') {
      const count = clueCountByTruth.get(truth.id) ?? 0;
      if (count < 2) {
        underCluedTruthIds.add(truth.id);
        review.push({
          severity: 'warn',
          chunkId: chunkFor(truth.id),
          recordId: truth.id,
          field: 'clues',
          message: `Core truth "${truth.title}" has ${count} clue(s); at least 2 are recommended.`,
        });
      }
    }
  }

  // Scene connectivity check: warn when a scene has no connection in or out (skip module's first and final scenes for missing in/out respectively, but always warn if completely disconnected when >1 scene)
  if (scenes.length > 0) {
    const hasIn = new Set<string>();
    const hasOut = new Set<string>();

    for (const conn of connections) {
      if (conn.from) {
        hasOut.add(conn.from);
        if (conn.two_way) {
          hasIn.add(conn.from);
        }
      }
      if (conn.to) {
        hasIn.add(conn.to);
        if (conn.two_way) {
          hasOut.add(conn.to);
        }
      }
    }

    scenes.forEach((scene, index) => {
      const isFirst = index === 0;
      const isFinal = index === scenes.length - 1;
      const connectedIn = hasIn.has(scene.id);
      const connectedOut = hasOut.has(scene.id);

      if (scenes.length > 1 && !connectedIn && !connectedOut) {
        review.push({
          severity: 'warn',
          chunkId: chunkFor(scene.id),
          recordId: scene.id,
          field: 'connections',
          message: `Scene "${scene.title}" (${scene.id}) has no connections in or out.`,
        });
        return;
      }

      if (!isFirst && !isFinal && (!connectedIn || !connectedOut)) {
        review.push({
          severity: 'warn',
          chunkId: chunkFor(scene.id),
          recordId: scene.id,
          field: 'connections',
          message: `Scene "${scene.title}" (${scene.id}) is missing a connection ${!connectedIn ? 'in' : 'out'}.`,
        });
      }
    });
  }

  return {
    review,
    references,
    brokenTargets,
    notLoadedTargets,
    underCluedTruthIds,
  };
}
