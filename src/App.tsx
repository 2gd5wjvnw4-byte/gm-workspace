import React, { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { Center } from './components/Center';
import { RightPanel } from './components/RightPanel';
import { DrawerHost, type DrawerMode } from './components/DrawerHost';
import { isRunningStandalone, StandaloneBanner } from './components/StandaloneBanner';
import { applyThemeToElement, getThemeCssVariables, useThemeStore } from './store/themeStore';
import { requestPersist, type MapDisplayMode, type NavViewMode } from './storage';

export const App: React.FC = () => {
  const { theme } = useThemeStore();
  const [navView, setNavView] = useState<NavViewMode>('list');
  const [mapMode, setMapMode] = useState<MapDisplayMode>('off');
  const [soloMask, setSoloMask] = useState(false);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [showStandaloneBanner, setShowStandaloneBanner] = useState<boolean>(
    () => !isRunningStandalone()
  );

  useEffect(() => {
    void requestPersist();
  }, []);

  useEffect(() => {
    applyThemeToElement(theme);
  }, [theme]);

  const cssVars = getThemeCssVariables(theme) as React.CSSProperties;

  return (
    <div
      data-testid="app-root"
      data-theme={theme}
      style={{
        ...cssVars,
        width: '100%',
        height: '100%',
        paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
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

      <TopBar
        mapMode={mapMode}
        onSelectMapMode={setMapMode}
        soloMask={soloMask}
        onToggleSoloMask={() => setSoloMask((s) => !s)}
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
        />

        <RightPanel />

        <DrawerHost activeDrawer={drawer} onClose={() => setDrawer(null)} />
      </div>
    </div>
  );
};

export default App;
