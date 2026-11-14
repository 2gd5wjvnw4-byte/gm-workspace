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
import { isRunningStandalone, StandaloneBanner } from './components/StandaloneBanner';
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
  } = useCampaignStore();
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [actSheetOpen, setActSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TableNote | null>(null);

  const navView = live?.ui?.navView ?? 'list';
  const mapMode = live?.ui?.mapMode ?? 'off';
  const soloMask = Boolean(live?.ui?.soloMask);

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
            onOpenPdf={() => setDrawer((d) => (d === 'pdf' ? null : 'pdf'))}
          />

          <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
            <LeftPanel
              navView={navView}
              onSelectNavView={setNavView}
              onOpenEntityInspector={() =>
                setDrawer((d) => (d === 'entity' ? null : 'entity'))
              }
            />

            <Center
              mapMode={mapMode}
              onOpenPdf={() => setDrawer('pdf')}
              onEditNote={(note) => {
                setEditingNote(note);
                setNoteModalOpen(true);
              }}
            />

            <RightPanel
              onOpenNoteModal={() => {
                setEditingNote(null);
                setNoteModalOpen(true);
              }}
            />

            <DrawerHost activeDrawer={drawer} onClose={() => setDrawer(null)} />
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
        </>
      )}
    </div>
  );
};

export default App;
