import React from 'react';
import { createPortal } from 'react-dom';
import type { NavViewMode } from '../storage/types';
import { getEffectiveConnections, getEffectiveScenes, makeAreaKey } from '../lib/improvised';
import { computeReachableSceneIds, getSceneVisibility } from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';
import type { AddModalMode } from './AddSceneModal';
import { NodeMapCanvas } from './NodeMapCanvas';

export interface LeftPanelProps {
  navView: NavViewMode;
  onSelectNavView: (view: NavViewMode) => void;
  focusMode?: boolean;
  onOpenEntityInspector?: (entityId: string) => void;
  onExpandNodeMap?: () => void;
  onOpenAddModal?: (mode: AddModalMode, defaultArea?: string) => void;
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
  focusMode = false,
  onExpandNodeMap,
  onOpenAddModal,
}) => {
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<
    | { type: 'scene'; id: string; label: string }
    | { type: 'area'; actId: string; areaName: string; sceneCount: number }
    | null
  >(null);

  React.useEffect(() => {
    if (!focusMode) {
      setOverlayOpen(false);
    }
  }, [focusMode]);
  const {
    merged,
    live,
    goToScene,
    toggleSceneVisited,
    setNodePosition,
    resetNodePositions,
    deleteScene,
    deleteArea,
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

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const effectiveConnections = getEffectiveConnections(merged.connections, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const visited = live?.visited ?? {};
  const revealed = live?.revealed ?? {};
  const connectionState = live?.connectionState ?? {};
  const soloMask = Boolean(live?.ui?.soloMask);
  const leftPanelRef = React.useRef<HTMLElement | null>(null);

  const reachable = computeReachableSceneIds({
    visited,
    currentSceneId,
    connections: effectiveConnections,
    connectionState,
    revealed,
    scenes: effectiveScenes,
  });

  // Group loaded scenes by act, then by scene.group
  const actMap = new Map(merged.acts.map((a) => [a.id, a]));
  const actOrder: string[] = [];
  for (const act of merged.acts) {
    if (!actOrder.includes(act.id)) {
      actOrder.push(act.id);
    }
  }
  for (const scene of effectiveScenes) {
    if (!actOrder.includes(scene.act_id)) {
      actOrder.push(scene.act_id);
    }
  }
  for (const area of live?.improvisedAreas ?? []) {
    if (area.actId && !actOrder.includes(area.actId)) {
      actOrder.push(area.actId);
    }
  }

  // Collect unloaded target scene IDs from connections
  const loadedSceneIds = new Set(effectiveScenes.map((s) => s.id));
  const unloadedScenes: UnloadedActSceneItem[] = [];
  const seenUnloaded = new Set<string>();
  for (const conn of effectiveConnections) {
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

  const panelContent = (
    <>
      {focusMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px 6px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '.1em',
              color: 'var(--muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            NAVIGATION
          </span>
          <button
            type="button"
            onClick={() => setOverlayOpen(false)}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      )}
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
          {onOpenAddModal && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '4px' }}>
              <button
                type="button"
                data-testid="add-area-btn"
                onClick={() => onOpenAddModal('area')}
                style={{
                  height: '26px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px dashed var(--line2)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Area
              </button>
              <button
                type="button"
                data-testid="add-scene-btn"
                onClick={() => onOpenAddModal('scene')}
                style={{
                  height: '26px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Scene
              </button>
            </div>
          )}

          {effectiveScenes.length === 0 && (live?.improvisedAreas ?? []).length === 0 ? (
            <p style={{ margin: '4px', fontSize: '13px', color: 'var(--muted)' }}>
              Import a module JSON to populate the scene list.
            </p>
          ) : (
            <>
              {actOrder.map((actId) => {
                const actObj = actMap.get(actId);
                const actScenes = effectiveScenes.filter((s) => s.act_id === actId);
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
                const usedGroupNames = new Set(
                  actScenes.map((s) => s.group.trim().toLowerCase()).filter(Boolean)
                );
                const emptyImpAreas = (live?.improvisedAreas ?? []).filter(
                  (a) =>
                    a.actId === actId &&
                    !usedGroupNames.has(a.name.trim().toLowerCase())
                );
                if (visibleScenes.length === 0 && emptyImpAreas.length === 0) {
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
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                padding: '6px 4px 2px',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--mono)',
                                  fontSize: '11px',
                                  letterSpacing: '.1em',
                                  color: 'var(--muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {scene.group}
                              </span>
                              <button
                                type="button"
                                data-testid={`delete-area-${makeAreaKey(actId, scene.group)}`}
                                aria-label={`Delete area ${scene.group}`}
                                onClick={() =>
                                  setConfirmDelete({
                                    type: 'area',
                                    actId,
                                    areaName: scene.group,
                                    sceneCount: actScenes.filter(
                                      (s) =>
                                        makeAreaKey(s.act_id, s.group) ===
                                        makeAreaKey(actId, scene.group)
                                    ).length,
                                  })
                                }
                                style={{
                                  height: '22px',
                                  minWidth: '22px',
                                  padding: '0 5px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--muted)',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                ×
                              </button>
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
                            <button
                              type="button"
                              data-testid={`delete-scene-${scene.id}`}
                              aria-label={`Delete scene ${displayTitle}`}
                              onClick={() =>
                                setConfirmDelete({
                                  type: 'scene',
                                  id: scene.id,
                                  label: displayTitle,
                                })
                              }
                              style={{
                                height: '24px',
                                minWidth: '24px',
                                padding: '0 5px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--muted)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {emptyImpAreas.map((area) => (
                      <div
                        key={area.id}
                        data-testid={`improvised-area-${area.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '6px 4px 2px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '11px',
                            letterSpacing: '.1em',
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {area.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {onOpenAddModal && (
                            <button
                              type="button"
                              onClick={() => onOpenAddModal('scene', area.name)}
                              style={{
                                height: '26px',
                                padding: '0 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--line)',
                                background: 'transparent',
                                color: 'var(--accent)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              + Scene
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`delete-area-${makeAreaKey(actId, area.name)}`}
                            aria-label={`Delete area ${area.name}`}
                            onClick={() =>
                              setConfirmDelete({
                                type: 'area',
                                actId,
                                areaName: area.name,
                                sceneCount: 0,
                              })
                            }
                            style={{
                              height: '24px',
                              minWidth: '24px',
                              padding: '0 5px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--muted)',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
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
        <NodeMapCanvas
          scenes={effectiveScenes}
          connections={effectiveConnections}
          notLoadedTargets={merged.linkCheck.notLoadedTargets}
          currentSceneId={currentSceneId}
          visited={visited}
          revealed={revealed}
          connectionState={connectionState}
          soloMask={soloMask}
          nodePositions={live?.nodePositions ?? {}}
          onSelectScene={goToScene}
          onMoveNode={setNodePosition}
          onResetLayout={resetNodePositions}
          onExpand={onExpandNodeMap}
          onAddNode={onOpenAddModal ? () => onOpenAddModal('node') : undefined}
        />
      )}
      </div>
      {confirmDelete &&
        createPortal(
          <div
            data-testid="confirm-delete-left-modal"
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'var(--panel)',
              border: '1px solid var(--line2)',
              borderRadius: '14px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontFamily: 'var(--head)', fontSize: '18px', fontWeight: 700 }}>
              {confirmDelete.type === 'scene' ? 'Delete scene' : 'Delete area'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {confirmDelete.type === 'scene'
                ? `Delete "${confirmDelete.label}" from this campaign?`
                : confirmDelete.sceneCount > 0
                  ? `Delete area "${confirmDelete.areaName}" and its ${confirmDelete.sceneCount} scene(s)?`
                  : `Delete area "${confirmDelete.areaName}"?`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                data-testid="cancel-delete-left-btn"
                onClick={() => setConfirmDelete(null)}
                style={{
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--p3)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-left-btn"
                onClick={() => {
                  if (confirmDelete.type === 'scene') {
                    deleteScene(confirmDelete.id);
                  } else {
                    deleteArea(confirmDelete.actId, confirmDelete.areaName);
                  }
                  setConfirmDelete(null);
                }}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--redLine)',
                  background: 'var(--redBg)',
                  color: 'var(--red)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );

  if (focusMode) {
    return (
      <>
        <aside
          data-testid="zone-left-rail"
          style={{
            width: '56px',
            flexShrink: 0,
            background: 'var(--panel)',
            borderRight: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {[
            { view: 'list' as const, label: 'Open Scene List', icon: '☰' },
            { view: 'nodes' as const, label: 'Open Node Map', icon: '◎' },
          ].map((item) => {
            const active = overlayOpen && navView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                aria-label={item.label}
                aria-expanded={active}
                onClick={() => {
                  if (overlayOpen && navView === item.view) {
                    setOverlayOpen(false);
                  } else {
                    onSelectNavView(item.view);
                    setOverlayOpen(true);
                  }
                }}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accentBg)' : 'var(--p2)',
                  color: active ? 'var(--accent)' : 'var(--text)',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </button>
            );
          })}
        </aside>
        {overlayOpen && (
          <>
            <div
              data-testid="left-panel-backdrop"
              aria-hidden="true"
              onClick={() => setOverlayOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.25)',
                zIndex: 14,
              }}
            />
            <aside
              ref={leftPanelRef}
              data-testid="zone-left-panel"
              style={{
                position: 'absolute',
                top: 0,
                left: '56px',
                bottom: 0,
                width: '300px',
                background: 'var(--panel)',
                borderRight: '1px solid var(--line2)',
                boxShadow: '16px 0 40px rgba(0,0,0,.35)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
                zIndex: 15,
                boxSizing: 'border-box',
              }}
            >
              {panelContent}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      ref={leftPanelRef}
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
      {panelContent}
    </aside>
  );
};
