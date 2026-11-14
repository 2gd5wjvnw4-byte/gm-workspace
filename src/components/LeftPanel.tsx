import React from 'react';
import type { DispositionState, NavViewMode } from '../storage/types';
import { computeReachableSceneIds, getSceneVisibility } from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';

export interface LeftPanelProps {
  navView: NavViewMode;
  onSelectNavView: (view: NavViewMode) => void;
  onOpenEntityInspector: (entityId: string) => void;
}

const DISPOSITION_COLORS: Record<DispositionState, string> = {
  allied: 'var(--teal)',
  neutral: 'var(--muted)',
  suspicious: 'var(--gold)',
  hostile: 'var(--red)',
};

interface DockEntityCardModel {
  id: string;
  name: string;
  summary: string;
  disposition: DispositionState;
  defaultDisposition: DispositionState;
  copyCount: number;
  tracks: Array<{ label: string; max: number }>;
  isSummoned: boolean;
  isImprovised: boolean;
}

interface UnloadedActSceneItem {
  id: string;
  actId: string;
  actHeading: string;
}

function getUnloadedActHeading(actId: string): string {
  const m = /^a(\d+)$/i.exec(actId);
  if (m) {
    return `Act ${m[1]}`;
  }
  return actId.toUpperCase();
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  navView,
  onSelectNavView,
  onOpenEntityInspector,
}) => {
  const {
    merged,
    live,
    goToScene,
    toggleSceneVisited,
    adjustEntityTrack,
    cycleEntityDisposition,
    summonEntityToScene,
    removeSummonedEntityFromScene,
  } = useCampaignStore();

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: '44px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
    background: active ? 'var(--accentBg)' : 'var(--p2)',
    color: active ? 'var(--accent)' : 'var(--text)',
    cursor: 'pointer',
  });

  const currentSceneId = live?.currentSceneId ?? merged.scenes[0]?.id ?? null;
  const currentScene =
    merged.scenes.find((s) => s.id === currentSceneId) ?? merged.scenes[0] ?? null;
  const visited = live?.visited ?? {};
  const revealed = live?.revealed ?? {};
  const connectionState = live?.connectionState ?? {};
  const soloMask = Boolean(live?.ui?.soloMask);
  const entityTracks = live?.entityTracks ?? {};
  const entityDisposition = live?.entityDisposition ?? {};
  const summonedForScene = currentSceneId ? (live?.summoned?.[currentSceneId] ?? []) : [];
  const improvisedEntities = live?.improvisedEntities ?? [];

  // Build "In This Scene" entity list: scene.entity_ids + summonedForScene + improvisedEntities for this scene
  const entityById = new Map(merged.entities.map((e) => [e.id, e]));
  const inSceneIds: string[] = [];
  if (currentScene) {
    for (const eid of currentScene.entity_ids) {
      if (!inSceneIds.includes(eid) && entityById.has(eid)) {
        inSceneIds.push(eid);
      }
    }
    for (const eid of summonedForScene) {
      if (!inSceneIds.includes(eid) && entityById.has(eid)) {
        inSceneIds.push(eid);
      }
    }
  }

  const sceneEntityCards: DockEntityCardModel[] = inSceneIds.map((eid) => {
    const ent = entityById.get(eid)!;
    const isSummoned =
      Boolean(currentScene) &&
      !currentScene!.entity_ids.includes(eid) &&
      summonedForScene.includes(eid);
    const countOverride = currentScene?.entity_counts?.[eid];
    const copyCount =
      typeof countOverride === 'number' && countOverride > 0
        ? countOverride
        : Math.max(1, ent.count || 1);
    const disp = entityDisposition[eid] ?? ent.disposition;
    return {
      id: eid,
      name: ent.name,
      summary: ent.summary,
      disposition: disp,
      defaultDisposition: ent.disposition,
      copyCount,
      tracks: ent.tracks,
      isSummoned,
      isImprovised: false,
    };
  });

  if (currentSceneId) {
    for (const imp of improvisedEntities) {
      if (imp.sceneId === currentSceneId) {
        const disp = entityDisposition[imp.id] ?? imp.disposition;
        sceneEntityCards.push({
          id: imp.id,
          name: imp.name,
          summary: imp.summary,
          disposition: disp,
          defaultDisposition: imp.disposition,
          copyCount: 1,
          tracks: imp.track ? [imp.track] : [],
          isSummoned: false,
          isImprovised: true,
        });
      }
    }
  }

  const roamingEntities = merged.entities.filter(
    (e) => e.roaming && !inSceneIds.includes(e.id)
  );

  const reachable = computeReachableSceneIds({
    visited,
    currentSceneId,
    connections: merged.connections,
    connectionState,
    revealed,
    scenes: merged.scenes,
  });

  // Group loaded scenes by act, then by scene.group
  const actMap = new Map(merged.acts.map((a) => [a.id, a]));
  const actOrder: string[] = [];
  for (const act of merged.acts) {
    if (!actOrder.includes(act.id)) {
      actOrder.push(act.id);
    }
  }
  for (const scene of merged.scenes) {
    if (!actOrder.includes(scene.act_id)) {
      actOrder.push(scene.act_id);
    }
  }

  // Collect unloaded target scene IDs from connections
  const loadedSceneIds = new Set(merged.scenes.map((s) => s.id));
  const unloadedScenes: UnloadedActSceneItem[] = [];
  const seenUnloaded = new Set<string>();
  for (const conn of merged.connections) {
    for (const target of [conn.from, conn.to]) {
      if (
        target &&
        !loadedSceneIds.has(target) &&
        merged.linkCheck.notLoadedTargets.has(target) &&
        !seenUnloaded.has(target)
      ) {
        const visibility = getSceneVisibility({
          sceneId: target,
          soloMask,
          visited,
          currentSceneId,
          reachable,
        });
        if (visibility === 'hidden') {
          continue;
        }
        seenUnloaded.add(target);
        const dashIdx = target.indexOf('-');
        const actId = dashIdx > 0 ? target.slice(0, dashIdx) : 'unloaded';
        unloadedScenes.push({
          id: target,
          actId,
          actHeading: getUnloadedActHeading(actId),
        });
      }
    }
  }

  const chipStyle = (colorVar: string): React.CSSProperties => ({
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    color: colorVar,
    border: `1px solid ${colorVar}`,
    borderRadius: '6px',
    padding: '2px 6px',
    flexShrink: 0,
  });

  return (
    <aside
      data-testid="zone-left-panel"
      style={{
        width: '300px',
        flexShrink: 0,
        background: 'var(--panel)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="left-panel-tabs"
        style={{
          padding: '12px 12px 8px',
          display: 'flex',
          gap: '4px',
          flexShrink: 0,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--line)',
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectNavView('list')}
          aria-pressed={navView === 'list'}
          style={tabStyle(navView === 'list')}
        >
          Scene List
        </button>
        <button
          type="button"
          onClick={() => onSelectNavView('nodes')}
          aria-pressed={navView === 'nodes'}
          style={tabStyle(navView === 'nodes')}
        >
          Node Map
        </button>
      </div>

      <div
        data-testid="left-panel-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '8px',
        }}
      >
        {navView === 'list' ? (
        <div
          data-testid="scene-list-container"
          style={{
            padding: '0 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {merged.scenes.length === 0 ? (
            <p style={{ margin: '4px', fontSize: '13px', color: 'var(--muted)' }}>
              Import a module JSON to populate the scene list.
            </p>
          ) : (
            <>
              {actOrder.map((actId) => {
                const actObj = actMap.get(actId);
                const actScenes = merged.scenes.filter((s) => s.act_id === actId);
                const visibleScenes = actScenes.filter(
                  (s) =>
                    getSceneVisibility({
                      sceneId: s.id,
                      soloMask,
                      visited,
                      currentSceneId,
                      reachable,
                    }) !== 'hidden'
                );
                if (visibleScenes.length === 0) {
                  return null;
                }

                let lastGroup: string | null = null;
                const actHeading = actObj
                  ? `${actObj.id.toUpperCase()} · ${actObj.title}`
                  : actId.toUpperCase();

                return (
                  <React.Fragment key={actId}>
                    <div
                      data-testid={`act-group-${actId}`}
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                        letterSpacing: '.1em',
                        color: 'var(--muted)',
                        padding: '8px 4px 2px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      {actHeading}
                    </div>
                    {visibleScenes.map((scene) => {
                      const showGroup =
                        Boolean(scene.group) && scene.group !== lastGroup;
                      lastGroup = scene.group;
                      const isCurrent = scene.id === currentSceneId;
                      const isVisited = Boolean(visited[scene.id]) || isCurrent;
                      const visibility = getSceneVisibility({
                        sceneId: scene.id,
                        soloMask,
                        visited,
                        currentSceneId,
                        reachable,
                      });
                      const displayTitle =
                        visibility === 'masked' ? '???' : scene.title;
                      const statusLabel = isCurrent
                        ? 'Here'
                        : isVisited
                          ? 'Visited'
                          : 'New';
                      const statusColor = isCurrent
                        ? 'var(--accent)'
                        : isVisited
                          ? 'var(--muted)'
                          : 'var(--violet)';

                      return (
                        <React.Fragment key={scene.id}>
                          {showGroup && (
                            <div
                              style={{
                                fontFamily: 'var(--mono)',
                                fontSize: '11px',
                                letterSpacing: '.1em',
                                color: 'var(--muted)',
                                padding: '6px 4px 2px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {scene.group}
                            </div>
                          )}
                          <div
                            style={{
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 10px',
                              borderRadius: '10px',
                              fontSize: '14px',
                              color: 'var(--text)',
                              background: isCurrent ? 'var(--accentBg)' : 'transparent',
                              border: isCurrent
                                ? '1px solid var(--accent)'
                                : '1px solid transparent',
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                          >
                            <button
                              type="button"
                              data-testid={`scene-row-${scene.id}`}
                              onClick={() => goToScene(scene.id)}
                              style={{
                                all: 'unset',
                                cursor: 'pointer',
                                flex: 1,
                                minHeight: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--mono)',
                                  fontSize: '12px',
                                  width: '44px',
                                  flexShrink: 0,
                                  textAlign: 'left',
                                }}
                              >
                                #{scene.code}
                              </span>
                              <span style={{ flex: 1, textAlign: 'left' }}>
                                {displayTitle}
                              </span>
                            </button>
                            {isCurrent ? (
                              <span
                                data-testid={`scene-status-${scene.id}`}
                                style={chipStyle(statusColor)}
                              >
                                {statusLabel}
                              </span>
                            ) : (
                              <button
                                type="button"
                                data-testid={`scene-status-${scene.id}`}
                                aria-label={
                                  isVisited
                                    ? `Mark #${scene.code} as New`
                                    : `Mark #${scene.code} as Visited`
                                }
                                aria-pressed={isVisited}
                                onClick={() => toggleSceneVisited(scene.id)}
                                style={{
                                  ...chipStyle(statusColor),
                                  background: 'transparent',
                                  cursor: 'pointer',
                                }}
                              >
                                {statusLabel}
                              </button>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {unloadedScenes.map((unloaded, idx) => {
                const showActHeader =
                  idx === 0 || unloadedScenes[idx - 1].actId !== unloaded.actId;
                return (
                  <React.Fragment key={unloaded.id}>
                    {showActHeader && (
                      <div
                        data-testid={`act-group-${unloaded.actId}`}
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          letterSpacing: '.1em',
                          color: 'var(--muted)',
                          padding: '8px 4px 2px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {unloaded.actHeading}
                      </div>
                    )}
                    <button
                      type="button"
                      data-testid={`scene-row-${unloaded.id}`}
                      disabled
                      style={{
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--faint)',
                        background: 'transparent',
                        border: '1px dashed var(--line2)',
                        cursor: 'default',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '12px',
                          width: '44px',
                          flexShrink: 0,
                          textAlign: 'left',
                        }}
                      >
                        {unloaded.id}
                      </span>
                      <span style={{ flex: 1, textAlign: 'left' }}>Not loaded yet</span>
                      <span
                        data-testid={`scene-status-${unloaded.id}`}
                        style={chipStyle('var(--faint)')}
                      >
                        Not loaded
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            margin: '0 12px 12px',
            height: '440px',
            position: 'relative',
            background: 'var(--mapBg)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
            Node Map placeholder (440px canvas)
          </span>
          <div
            style={{
              position: 'absolute',
              left: '10px',
              bottom: '8px',
              fontSize: '11px',
              color: 'var(--muted)',
              background: 'var(--mapBg)',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            Pinch to zoom · drag to move · 100%
          </div>
        </div>
      )}

      <div
        data-testid="in-this-scene-dock"
        style={{
          borderTop: '1px solid var(--line)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.1em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          IN THIS SCENE
        </div>

        {sceneEntityCards.length === 0 ? (
          <div
            data-testid="no-scene-entities"
            style={{ fontSize: '13px', color: 'var(--muted)' }}
          >
            No one here. Yet.
          </div>
        ) : (
          sceneEntityCards.map((card) => {
            const dispColor = DISPOSITION_COLORS[card.disposition];
            const trackMatrix = entityTracks[card.id] ?? [];
            return (
              <div
                key={card.id}
                data-testid={`entity-card-${card.id}`}
                style={{
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`inspect-entity-${card.id}`}
                    onClick={() => onOpenEntityInspector(card.id)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 0,
                      minHeight: '32px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {card.name}
                    {card.copyCount > 1 ? ` ×${card.copyCount}` : ''}
                  </button>
                  {card.isImprovised && (
                    <span
                      data-testid={`entity-improvised-chip-${card.id}`}
                      style={chipStyle('var(--gold)')}
                    >
                      Improvised
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid={`entity-disp-chip-${card.id}`}
                    onClick={() =>
                      cycleEntityDisposition(card.id, card.defaultDisposition)
                    }
                    aria-label={`Change ${card.name} disposition (${card.disposition})`}
                    style={{
                      ...chipStyle(dispColor),
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {card.disposition}
                  </button>
                  {card.isSummoned && currentSceneId && (
                    <button
                      type="button"
                      data-testid={`remove-summoned-${card.id}`}
                      onClick={() =>
                        removeSummonedEntityFromScene(currentSceneId, card.id)
                      }
                      aria-label={`Remove ${card.name} from scene`}
                      style={{
                        height: '28px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--line2)',
                        background: 'var(--p3)',
                        color: 'var(--muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {card.summary && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {card.summary}
                  </div>
                )}

                {card.tracks.length > 0 &&
                  Array.from({ length: card.copyCount }).map((_, copyIdx) =>
                    card.tracks.map((trackDef, trackIdx) => {
                      const currentVal =
                        trackMatrix[copyIdx]?.[trackIdx] ?? trackDef.max;
                      const rowLabel =
                        card.copyCount > 1
                          ? `${trackDef.label} #${copyIdx + 1}`
                          : trackDef.label;
                      return (
                        <div
                          key={`${copyIdx}-${trackIdx}`}
                          data-testid={`entity-track-row-${card.id}-${copyIdx}-${trackIdx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--muted)',
                              width: '64px',
                              flexShrink: 0,
                            }}
                          >
                            {rowLabel}
                          </span>
                          <button
                            type="button"
                            data-testid={`entity-track-dec-${card.id}-${copyIdx}-${trackIdx}`}
                            aria-label={`Decrease ${card.name} ${rowLabel}`}
                            onClick={() =>
                              adjustEntityTrack(
                                card.id,
                                copyIdx,
                                trackIdx,
                                -1,
                                card.copyCount,
                                card.tracks
                              )
                            }
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'var(--p3)',
                              color: 'var(--text)',
                              fontSize: '18px',
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <span
                            data-testid={`entity-track-val-${card.id}-${copyIdx}-${trackIdx}`}
                            style={{
                              flex: 1,
                              textAlign: 'center',
                              fontFamily: 'var(--mono)',
                              fontWeight: 600,
                            }}
                          >
                            {currentVal} / {trackDef.max}
                          </span>
                          <button
                            type="button"
                            data-testid={`entity-track-inc-${card.id}-${copyIdx}-${trackIdx}`}
                            aria-label={`Increase ${card.name} ${rowLabel}`}
                            onClick={() =>
                              adjustEntityTrack(
                                card.id,
                                copyIdx,
                                trackIdx,
                                1,
                                card.copyCount,
                                card.tracks
                              )
                            }
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'var(--p3)',
                              color: 'var(--text)',
                              fontSize: '18px',
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                      );
                    })
                  )}
              </div>
            );
          })
        )}

        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.1em',
            color: 'var(--muted)',
            marginTop: '4px',
            textTransform: 'uppercase',
          }}
        >
          ROAMING
        </div>
        {roamingEntities.length === 0 ? (
          <div
            data-testid="no-roaming-entities"
            style={{ fontSize: '12px', color: 'var(--muted)' }}
          >
            {merged.entities.some((e) => e.roaming)
              ? 'All roaming threats are in this scene.'
              : 'No roaming entities loaded yet.'}
          </div>
        ) : (
          roamingEntities.map((roamer) => (
            <div
              key={roamer.id}
              data-testid={`roaming-card-${roamer.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--p2)',
                border: '1px dashed var(--line2)',
                borderRadius: '12px',
                padding: '6px 6px 6px 10px',
              }}
            >
              <button
                type="button"
                onClick={() => onOpenEntityInspector(roamer.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {roamer.name}
              </button>
              <button
                type="button"
                data-testid={`summon-btn-${roamer.id}`}
                onClick={() => {
                  if (currentSceneId) {
                    summonEntityToScene(currentSceneId, roamer.id);
                  }
                }}
                style={{
                  height: '44px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--redLine)',
                  background: 'var(--redBg)',
                  color: 'var(--red)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Summon
              </button>
            </div>
          ))
        )}
      </div>
      </div>
    </aside>
  );
};
