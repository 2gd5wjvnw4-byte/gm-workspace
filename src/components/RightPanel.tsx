import React, { useEffect, useMemo, useState } from 'react';
import { THEMES, THEME_ORDER, useThemeStore } from '../store/themeStore';
import { useCampaignStore } from '../store/campaignStore';
import {
  ClocksSection,
  ClueMatrixSection,
  CollapsibleSection,
  FactionsSection,
  RandomTablesSection,
  TimelineSection,
} from './RightPanelSections';

export interface RightPanelProps {
  onOpenNoteModal?: () => void;
  onOpenEntityInspector?: (entityId: string) => void;
}

function formatLastBackup(lastBackupAt?: number | null): string {
  if (!lastBackupAt) return 'Never';
  const diffMs = Math.max(0, Date.now() - lastBackupAt);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  onOpenNoteModal,
  onOpenEntityInspector,
}) => {
  const { theme, setTheme } = useThemeStore();
  const {
    activeCampaign,
    live,
    merged,
    goToScene,
    toggleRevealedItem,
    adjustClockValue,
    toggleTimelineDone,
    cycleFactionAttitude,
    appendRollLog,
    summonEntityToScene,
    deleteLooseNote,
  } = useCampaignStore();
  const looseNotes = live?.looseNotes ?? [];
  const [looseNotesOpen, setLooseNotesOpen] = useState(false);
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1200 : false
  );
  const [overlayOpen, setOverlayOpen] = useState(false);

  const soloMask = Boolean(live?.ui.soloMask);
  const currentSceneId = live?.currentSceneId ?? null;
  const currentScene = useMemo(
    () => merged.scenes.find((s) => s.id === currentSceneId) ?? null,
    [merged.scenes, currentSceneId]
  );
  const currentActId = currentScene?.act_id ?? merged.acts[0]?.id ?? null;

  const sceneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of merged.scenes) {
      map.set(s.id, s.title);
    }
    return map;
  }, [merged.scenes]);

  const dayTracker = useMemo(
    () => merged.trackers.find((t) => t.label.trim().toLowerCase() === 'day') ?? null,
    [merged.trackers]
  );
  const currentDayValue = dayTracker
    ? (live?.trackerValues?.[dayTracker.id] ?? dayTracker.start)
    : null;

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 1200;
      setIsCompact(compact);
      if (!compact) {
        setOverlayOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sectionHeaderStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    letterSpacing: '.1em',
    color: 'var(--muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
  };

  const panelContent = (
    <>
      {isCompact && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={sectionHeaderStyle}>RIGHT PANEL</span>
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

      {/* 1. Clocks */}
      <ClocksSection
        clocks={merged.clocks}
        clockValues={live?.clockValues ?? {}}
        currentActId={currentActId}
        soloMask={soloMask}
        onAdjustClock={adjustClockValue}
      />

      {/* 2. Timeline */}
      <TimelineSection
        timeline={merged.timeline}
        timelineDone={live?.timelineDone ?? {}}
        revealed={live?.revealed ?? {}}
        currentDayValue={currentDayValue}
        soloMask={soloMask}
        sceneTitleById={sceneTitleById}
        onToggleDone={toggleTimelineDone}
        onToggleReveal={(id) => toggleRevealedItem(id)}
        onJumpToScene={goToScene}
      />

      {/* 3. Clue Matrix */}
      <ClueMatrixSection
        truths={merged.truths}
        scenes={merged.scenes}
        entities={merged.entities}
        revealed={live?.revealed ?? {}}
        soloMask={soloMask}
        onJumpToScene={goToScene}
        onOpenEntityInspector={onOpenEntityInspector}
      />

      {/* 4. Factions */}
      <FactionsSection
        factions={merged.factions}
        factionAttitude={live?.factionAttitude ?? {}}
        soloMask={soloMask}
        onCycleAttitude={cycleFactionAttitude}
      />

      {/* 5. Random Tables */}
      <RandomTablesSection
        tables={merged.random_tables}
        rollLog={live?.rollLog ?? []}
        currentSceneId={currentSceneId}
        onAppendRollLog={appendRollLog}
        onSummonEntity={summonEntityToScene}
      />

      {/* 6. Scratchpad */}
      <CollapsibleSection title="SCRATCHPAD" testId="section-scratchpad">
        <button
          type="button"
          data-testid="add-note-override-btn"
          onClick={onOpenNoteModal}
          style={{
            height: '48px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Override Scene / Add Note
        </button>
        <button
          type="button"
          data-testid="loose-notes-toggle"
          aria-expanded={looseNotesOpen}
          onClick={() => setLooseNotesOpen((v) => !v)}
          style={{
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            cursor: 'pointer',
          }}
        >
          <span>Loose Notes ({looseNotes.length})</span>
          <span aria-hidden="true">{looseNotesOpen ? '▾' : '▸'}</span>
        </button>
        {looseNotesOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {looseNotes.length === 0 ? (
              <div
                style={{
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                }}
              >
                No loose notes.
              </div>
            ) : (
              looseNotes.map((note) => (
                <div
                  key={note.id}
                  data-testid={`loose-note-${note.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--p2)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{note.text}</span>
                  <button
                    type="button"
                    onClick={() => deleteLooseNote(note.id)}
                    aria-label={`Delete loose note ${note.text}`}
                    style={{
                      height: '44px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--redLine)',
                      background: 'var(--redBg)',
                      color: 'var(--red)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--muted)',
            paddingTop: '4px',
          }}
        >
          <span data-testid="last-backup-label">
            Last backup: {formatLastBackup(activeCampaign?.lastBackupAt)}
          </span>
          <button
            type="button"
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--tealLine)',
              background: 'var(--tealBg)',
              color: 'var(--teal)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Save Backup
          </button>
        </div>
      </CollapsibleSection>

      {/* 7. Theme */}
      <CollapsibleSection title="THEME" testId="section-theme">
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
          role="group"
          aria-label="Theme"
        >
          {THEME_ORDER.map((themeKey) => {
            const th = THEMES[themeKey];
            const active = theme === themeKey;
            return (
              <button
                key={themeKey}
                type="button"
                onClick={() => setTheme(themeKey)}
                aria-pressed={active}
                style={{
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accentBg)' : 'var(--p2)',
                  color: active ? 'var(--accent)' : 'var(--text)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '28px',
                    height: '20px',
                    borderRadius: '5px',
                    flexShrink: 0,
                    border: `1px solid ${th.line2}`,
                    background: `linear-gradient(90deg, ${th.bg} 0 50%, ${th.accent} 50% 75%, ${th.gold} 75% 100%)`,
                  }}
                />
                <span style={{ flex: 1, textAlign: 'left' }}>{th.label}</span>
              </button>
            );
          })}
        </div>
      </CollapsibleSection>
    </>
  );

  if (isCompact) {
    return (
      <>
        <aside
          data-testid="zone-right-rail"
          style={{
            width: '56px',
            flexShrink: 0,
            background: 'var(--panel)',
            borderLeft: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {[
            { label: 'Open Clocks and Timeline', icon: '⏱' },
            { label: 'Open Clues and Factions', icon: '◈' },
            { label: 'Open Scratchpad and Theme', icon: '🎨' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-expanded={overlayOpen}
              onClick={() => setOverlayOpen((o) => !o)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                border: overlayOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: overlayOpen ? 'var(--accentBg)' : 'var(--p2)',
                color: overlayOpen ? 'var(--accent)' : 'var(--text)',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </button>
          ))}
        </aside>
        {overlayOpen && (
          <>
            <div
              data-testid="right-panel-backdrop"
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
              data-testid="zone-right-panel"
              style={{
                position: 'absolute',
                top: 0,
                right: '56px',
                bottom: 0,
                width: '300px',
                background: 'var(--panel)',
                borderLeft: '1px solid var(--line2)',
                boxShadow: '-16px 0 40px rgba(0,0,0,.35)',
                overflowY: 'auto',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
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
      data-testid="zone-right-panel"
      style={{
        width: '300px',
        flexShrink: 0,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--line)',
        overflowY: 'auto',
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxSizing: 'border-box',
      }}
    >
      {panelContent}
    </aside>
  );
};
