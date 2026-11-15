import React, { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { Center } from './components/Center';
import { RightPanel } from './components/RightPanel';
import { DrawerHost, type DrawerMode } from './components/DrawerHost';
import { CampaignScreen } from './components/CampaignScreen';
import { ActSwitcherSheet } from './components/ActSwitcherSheet';
import { ReviewSheet } from './components/ReviewSheet';
import { NoteOverrideModal } from './components/NoteOverrideModal';
import { AddSceneModal, type AddModalMode } from './components/AddSceneModal';
import { NodeMapCanvas } from './components/NodeMapCanvas';
import { isRunningStandalone, StandaloneBanner } from './components/StandaloneBanner';
import {
  getAreasForAct,
  getEffectiveConnections,
  getEffectiveScenes,
  nextImprovisedSceneCode,
  pickNextNodePosition,
} from './lib/improvised';
import { buildNodeMapGraph } from './lib/nodeMap';
import { applyThemeToElement, getThemeCssVariables, useThemeStore } from './store/themeStore';
import { useCampaignStore } from './store/campaignStore';
import { requestPersist, type TableNote } from './storage';

export const App: React.FC = () => {
  const { theme } = useThemeStore();
  const {
    activeCampaign,
    chunks,
    merged,
    live,
    setNavView,
    setMapMode,
    setSoloMask,
    setFocusMode,
    goToScene,
    setNodePosition,
    resetNodePositions,
    addImprovisedArea,
    addImprovisedScene,
  } = useCampaignStore();
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [inspectedEntityId, setInspectedEntityId] = useState<string | null>(null);
  const [actSheetOpen, setActSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TableNote | null>(null);
  const [nodeMapExpanded, setNodeMapExpanded] = useState(false);
  const [addModalState, setAddModalState] = useState<{
    open: boolean;
    mode: AddModalMode;
    defaultArea: string;
  }>({ open: false, mode: 'scene', defaultArea: '' });

  const navView = live?.ui?.navView ?? 'list';
  const mapMode = live?.ui?.mapMode ?? 'off';
  const soloMask = Boolean(live?.ui?.soloMask);
  const focusMode = live?.ui?.focusMode ?? true;

  const standalone = isRunningStandalone();
  const [showStandaloneBanner, setShowStandaloneBanner] = useState<boolean>(
    () => !standalone
  );

  useEffect(() => {
    void requestPersist();
  }, []);

  useEffect(() => {
    applyThemeToElement(theme);
  }, [theme]);

  const cssVars = getThemeCssVariables(theme) as React.CSSProperties;
  // shortcut: iPadOS standalone PWA often reports env(safe-area-inset-top) as 0px while drawing the 24-28px clock/battery/multitasking bar, upgrade if WebKit reports accurate standalone insets
  const safeTopPadding = standalone
    ? 'var(--safe-top, max(env(safe-area-inset-top, 0px), 28px))'
    : 'var(--safe-top, env(safe-area-inset-top, 0px))';

  const latestChunkTitle =
    chunks.length > 0 ? chunks[chunks.length - 1].chunkTitle : 'No chunks loaded';
  const campaignLabel = activeCampaign
    ? `${activeCampaign.title} · ${latestChunkTitle}`
    : 'TopBar · No module loaded';

  return (
    <div
      data-testid="app-root"
      data-theme={theme}
      style={{
        ...cssVars,
        width: '100%',
        height: '100%',
        paddingTop: safeTopPadding,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel)',
        color: 'var(--text)',
        fontFamily: 'var(--body)',
        fontSize: '14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {showStandaloneBanner && (
        <StandaloneBanner onDismiss={() => setShowStandaloneBanner(false)} />
      )}

      {!activeCampaign ? (
        <CampaignScreen />
      ) : (
        <>
          <TopBar
            campaignLabel={campaignLabel}
            reviewCount={merged.review.length}
            onOpenActSwitcher={() => setActSheetOpen(true)}
            onOpenReview={() => setReviewSheetOpen(true)}
            mapMode={mapMode}
            onSelectMapMode={setMapMode}
            soloMask={soloMask}
            onToggleSoloMask={() => setSoloMask(!soloMask)}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode(!focusMode)}
            onOpenPdf={() => setDrawer((d) => (d === 'pdf' ? null : 'pdf'))}
            onOpenEntityInspector={(entityId) => {
              setInspectedEntityId(entityId);
              setDrawer('entity');
            }}
          />

          <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
            <LeftPanel
              navView={navView}
              onSelectNavView={setNavView}
              focusMode={focusMode}
              onOpenEntityInspector={(entityId) => {
                setInspectedEntityId(entityId);
                setDrawer((d) =>
                  d === 'entity' && inspectedEntityId === entityId ? null : 'entity'
                );
              }}
              onExpandNodeMap={() => setNodeMapExpanded(true)}
              onOpenAddModal={(mode, defaultArea = '') =>
                setAddModalState({ open: true, mode, defaultArea })
              }
            />

            <div style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
              <Center
                mapMode={mapMode}
                onOpenPdf={() => setDrawer('pdf')}
                onEditNote={(note) => {
                  setEditingNote(note);
                  setNoteModalOpen(true);
                }}
                onOpenEntityInspector={(entityId) => {
                  setInspectedEntityId(entityId);
                  setDrawer((d) =>
                    d === 'entity' && inspectedEntityId === entityId ? null : 'entity'
                  );
                }}
              />

              {nodeMapExpanded && (
                <div
                  data-testid="node-map-expanded-overlay"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 30,
                    background: 'var(--mapBg)',
                  }}
                >
                  <NodeMapCanvas
                    scenes={getEffectiveScenes(merged.scenes, live)}
                    connections={getEffectiveConnections(merged.connections, live)}
                    notLoadedTargets={merged.linkCheck.notLoadedTargets}
                    currentSceneId={
                      live?.currentSceneId ??
                      getEffectiveScenes(merged.scenes, live)[0]?.id ??
                      null
                    }
                    visited={live?.visited ?? {}}
                    revealed={live?.revealed ?? {}}
                    connectionState={live?.connectionState ?? {}}
                    soloMask={soloMask}
                    nodePositions={live?.nodePositions ?? {}}
                    onSelectScene={goToScene}
                    onMoveNode={setNodePosition}
                    onResetLayout={resetNodePositions}
                    expanded
                    onClose={() => setNodeMapExpanded(false)}
                    onAddNode={() =>
                      setAddModalState({ open: true, mode: 'node', defaultArea: '' })
                    }
                  />
                </div>
              )}
            </div>

            <RightPanel
              focusMode={focusMode}
              onOpenNoteModal={() => {
                setEditingNote(null);
                setNoteModalOpen(true);
              }}
              onOpenEntityInspector={(entityId) => {
                setInspectedEntityId(entityId);
                setDrawer('entity');
              }}
            />

            <DrawerHost
              activeDrawer={drawer}
              inspectedEntityId={inspectedEntityId}
              onClose={() => setDrawer(null)}
            />
          </div>

          <ActSwitcherSheet
            open={actSheetOpen}
            onClose={() => setActSheetOpen(false)}
          />

          <ReviewSheet
            open={reviewSheetOpen}
            onClose={() => setReviewSheetOpen(false)}
          />

          <NoteOverrideModal
            open={noteModalOpen}
            editingNote={editingNote}
            onClose={() => {
              setNoteModalOpen(false);
              setEditingNote(null);
            }}
          />

          <AddSceneModal
            open={addModalState.open}
            mode={addModalState.mode}
            acts={merged.acts}
            defaultActId={
              getEffectiveScenes(merged.scenes, live).find(
                (s) => s.id === live?.currentSceneId
              )?.act_id ??
              merged.acts[0]?.id ??
              'a1'
            }
            defaultArea={addModalState.defaultArea}
            areas={getAreasForAct(
              getEffectiveScenes(merged.scenes, live).find(
                (s) => s.id === live?.currentSceneId
              )?.act_id ??
                merged.acts[0]?.id ??
                'a1',
              getEffectiveScenes(merged.scenes, live),
              live
            )}
            scenes={getEffectiveScenes(merged.scenes, live)}
            currentSceneId={live?.currentSceneId ?? null}
            suggestedCode={nextImprovisedSceneCode(getEffectiveScenes(merged.scenes, live))}
            onClose={() => setAddModalState((prev) => ({ ...prev, open: false }))}
            onAddArea={(input) => {
              addImprovisedArea(input);
            }}
            onAddScene={(input) => {
              const effectiveScenes = getEffectiveScenes(merged.scenes, live);
              const effectiveConnections = getEffectiveConnections(merged.connections, live);
              let nodePosition: { x: number; y: number } | null = null;
              if (addModalState.mode === 'node') {
                const graph = buildNodeMapGraph({
                  scenes: effectiveScenes,
                  connections: effectiveConnections,
                  notLoadedTargets: merged.linkCheck.notLoadedTargets,
                  currentSceneId: live?.currentSceneId ?? effectiveScenes[0]?.id ?? null,
                  visited: live?.visited ?? {},
                  revealed: live?.revealed ?? {},
                  connectionState: live?.connectionState ?? {},
                  soloMask,
                  nodePositions: live?.nodePositions ?? {},
                });
                nodePosition = pickNextNodePosition(graph.nodes);
              }
              addImprovisedScene({
                ...input,
                nodePosition,
              });
            }}
          />
        </>
      )}
    </div>
  );
};

export default App;
