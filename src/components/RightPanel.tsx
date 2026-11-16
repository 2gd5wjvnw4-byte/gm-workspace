import React, { useEffect, useMemo, useState } from 'react';
import type { TableNote } from '../storage/types';
import { THEMES, THEME_ORDER, useThemeStore } from '../store/themeStore';
import {
  getEffectiveClocks,
  getEffectiveFactions,
  getEffectiveScenes,
  getEffectiveTruths,
} from '../lib/improvised';
import { deliverBackupFile } from '../lib/backupShare';
import { isSoundEnabled, playTactileClick, setSoundEnabled } from '../lib/sound';
import { useCampaignStore } from '../store/campaignStore';
import { AddRightItemModal, type AddRightItemMode } from './AddRightItemModal';
import {
  ClocksSection,
  ClueMatrixSection,
  CollapsibleSection,
  FactionsSection,
  RandomTablesSection,
  TimelineSection,
} from './RightPanelSections';

export interface RightPanelProps {
  focusMode?: boolean;
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
  focusMode = false,
  onOpenNoteModal,
  onOpenEntityInspector,
}) => {
  const { theme } = useThemeStore();
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
    addTableNote,
    addLooseNote,
    deleteLooseNote,
    addImprovisedClock,
    addImprovisedClue,
    addImprovisedFaction,
    setCampaignTheme,
    setRightSectionOpen,
    saveBackup,
  } = useCampaignStore();
  const [savingBackup, setSavingBackup] = useState(false);

  const handleSaveBackup = async () => {
    if (!activeCampaign || savingBackup) return;
    setSavingBackup(true);
    try {
      const payload = await saveBackup();
      await deliverBackupFile(payload);
    } finally {
      setSavingBackup(false);
    }
  };
  const isSectionOpen = (key: string) => live?.ui.rightSectionsOpen?.[key] ?? true;
  const looseNotes = live?.looseNotes ?? [];
  const [looseNotesOpen, setLooseNotesOpen] = useState(false);
  const [newLooseNoteText, setNewLooseNoteText] = useState('');
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<TableNote | null>(null);
  const [addItemModal, setAddItemModal] = useState<{ open: boolean; mode: AddRightItemMode }>({
    open: false,
    mode: 'clock',
  });
  const [soundClicks, setSoundClicks] = useState<boolean>(() => isSoundEnabled());
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1200 : false
  );
  const [overlayOpen, setOverlayOpen] = useState(false);

  const soloMask = Boolean(live?.ui.soloMask);
  const effectiveScenes = useMemo(
    () => getEffectiveScenes(merged.scenes, live),
    [merged.scenes, live]
  );
  const currentSceneId = live?.currentSceneId ?? null;
  const currentScene = useMemo(
    () => effectiveScenes.find((s) => s.id === currentSceneId) ?? null,
    [effectiveScenes, currentSceneId]
  );
  const currentActId = currentScene?.act_id ?? merged.acts[0]?.id ?? null;

  const effectiveClocks = useMemo(
    () => getEffectiveClocks(merged.clocks, live),
    [merged.clocks, live]
  );
  const effectiveTruths = useMemo(
    () => getEffectiveTruths(merged.truths, live),
    [merged.truths, live]
  );
  const effectiveFactions = useMemo(
    () => getEffectiveFactions(merged.factions, live),
    [merged.factions, live]
  );

  const sceneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of effectiveScenes) {
      map.set(s.id, s.title);
    }
    return map;
  }, [effectiveScenes]);

  const dayTracker = useMemo(
    () => merged.trackers.find((t) => t.label.trim().toLowerCase() === 'day') ?? null,
    [merged.trackers]
  );
  const currentDayValue = dayTracker
    ? (live?.trackerValues?.[dayTracker.id] ?? dayTracker.start)
    : null;

  const showRail = isCompact || focusMode;

  useEffect(() => {
    if (!showRail) {
      setOverlayOpen(false);
    }
  }, [showRail]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 1200;
      setIsCompact(compact);
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
      {showRail && (
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
        </div>
      )}

      {/* 1. Clocks */}
      <ClocksSection
        clocks={effectiveClocks}
        clockValues={live?.clockValues ?? {}}
        currentActId={currentActId}
        soloMask={soloMask}
        open={isSectionOpen('clocks')}
        onToggleOpen={(open) => setRightSectionOpen('clocks', open)}
        onAdjustClock={adjustClockValue}
        onOpenAddClock={() => setAddItemModal({ open: true, mode: 'clock' })}
      />

      {/* 2. Timeline */}
      <TimelineSection
        timeline={merged.timeline}
        timelineDone={live?.timelineDone ?? {}}
        revealed={live?.revealed ?? {}}
        currentDayValue={currentDayValue}
        soloMask={soloMask}
        sceneTitleById={sceneTitleById}
        open={isSectionOpen('timeline')}
        onToggleOpen={(open) => setRightSectionOpen('timeline', open)}
        onToggleDone={toggleTimelineDone}
        onToggleReveal={(id) => toggleRevealedItem(id)}
        onJumpToScene={goToScene}
      />

      {/* 3. Clue Matrix */}
      <ClueMatrixSection
        truths={effectiveTruths}
        scenes={effectiveScenes}
        entities={merged.entities}
        improvisedClues={live?.improvisedClues ?? []}
        revealed={live?.revealed ?? {}}
        soloMask={soloMask}
        open={isSectionOpen('clue-matrix')}
        onToggleOpen={(open) => setRightSectionOpen('clue-matrix', open)}
        onJumpToScene={goToScene}
        onOpenEntityInspector={onOpenEntityInspector}
        onToggleClueRevealed={(id) => toggleRevealedItem(id)}
        onOpenAddClue={() => setAddItemModal({ open: true, mode: 'clue' })}
      />

      {/* 4. Factions */}
      <FactionsSection
        factions={effectiveFactions}
        factionAttitude={live?.factionAttitude ?? {}}
        soloMask={soloMask}
        open={isSectionOpen('factions')}
        onToggleOpen={(open) => setRightSectionOpen('factions', open)}
        onCycleAttitude={cycleFactionAttitude}
        onOpenAddFaction={() => setAddItemModal({ open: true, mode: 'faction' })}
      />

      {/* 5. Random Tables */}
      <RandomTablesSection
        tables={merged.random_tables}
        rollLog={live?.rollLog ?? []}
        currentSceneId={currentSceneId}
        open={isSectionOpen('random-tables')}
        onToggleOpen={(open) => setRightSectionOpen('random-tables', open)}
        onAppendRollLog={appendRollLog}
        onSummonEntity={summonEntityToScene}
        onAddSceneNote={(sceneId, text) => addTableNote(sceneId, text)}
      />

      {/* 6. Scratchpad */}
      <CollapsibleSection
        title="SCRATCHPAD"
        testId="section-scratchpad"
        open={isSectionOpen('scratchpad')}
        onToggleOpen={(open) => setRightSectionOpen('scratchpad', open)}
      >
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
          <span className="gm-tabular">Loose Notes ({looseNotes.length})</span>
          <span aria-hidden="true">{looseNotesOpen ? '▾' : '▸'}</span>
        </button>
        <div
          className="gm-accordion"
          data-open={looseNotesOpen ? 'true' : 'false'}
          aria-hidden={!looseNotesOpen}
        >
          <div
            className="gm-accordion-inner"
            style={{ gap: '6px', visibility: looseNotesOpen ? 'visible' : 'hidden' }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                aria-label="New loose note"
                placeholder="Add a loose note..."
                value={newLooseNoteText}
                onChange={(e) => setNewLooseNoteText(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '44px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: '0 10px',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const created = addLooseNote(newLooseNoteText);
                  if (created) setNewLooseNoteText('');
                }}
                style={{
                  height: '44px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent)',
                  background: 'var(--accentBg)',
                  color: 'var(--accent)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
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
                Nothing tucked away here.
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
                    onClick={() => setConfirmDeleteNote(note)}
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
        </div>
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
            data-testid="save-backup-btn"
            disabled={!activeCampaign || savingBackup}
            onClick={() => void handleSaveBackup()}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--tealLine)',
              background: 'var(--tealBg)',
              color: 'var(--teal)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: !activeCampaign || savingBackup ? 'default' : 'pointer',
              opacity: !activeCampaign || savingBackup ? 0.6 : 1,
            }}
          >
            {savingBackup ? 'Saving…' : 'Save Backup'}
          </button>
        </div>
      </CollapsibleSection>

      {/* 7. Theme */}
      <CollapsibleSection
        title="THEME"
        testId="section-theme"
        open={isSectionOpen('theme')}
        onToggleOpen={(open) => setRightSectionOpen('theme', open)}
      >
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
                onClick={() => setCampaignTheme(themeKey)}
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
          <button
            type="button"
            data-testid="sound-clicks-toggle"
            aria-pressed={soundClicks}
            onClick={() => {
              const next = !soundClicks;
              setSoundClicks(next);
              setSoundEnabled(next);
              if (next) playTactileClick();
            }}
            style={{
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              marginTop: '4px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              border: soundClicks ? '1px solid var(--tealLine)' : '1px solid var(--line)',
              background: soundClicks ? 'var(--tealBg)' : 'var(--p2)',
              color: soundClicks ? 'var(--teal)' : 'var(--muted)',
            }}
          >
            <span>Tactile Clicks</span>
            <span>{soundClicks ? 'On' : 'Off'}</span>
          </button>
        </div>
      </CollapsibleSection>

      {confirmDeleteNote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete loose note"
          data-testid="delete-loose-note-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '48px',
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
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
            <div
              style={{
                fontFamily: 'var(--head)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Delete loose note
            </div>

            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Are you sure you want to delete this loose note?
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {confirmDeleteNote.text}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                data-testid="cancel-delete-loose-note"
                onClick={() => setConfirmDeleteNote(null)}
                style={{
                  height: '44px',
                  padding: '0 16px',
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
                data-testid="confirm-delete-loose-note"
                onClick={() => {
                  deleteLooseNote(confirmDeleteNote.id);
                  setConfirmDeleteNote(null);
                }}
                style={{
                  height: '44px',
                  padding: '0 18px',
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
        </div>
      )}

      <AddRightItemModal
        open={addItemModal.open}
        mode={addItemModal.mode}
        truths={effectiveTruths}
        currentActId={currentActId}
        currentSceneId={currentSceneId}
        currentSceneTitle={currentScene?.title ?? null}
        onClose={() => setAddItemModal((prev) => ({ ...prev, open: false }))}
        onAddClock={addImprovisedClock}
        onAddClue={addImprovisedClue}
        onAddFaction={addImprovisedFaction}
      />
    </>
  );

  if (showRail) {
    return (
      <>
        <aside
          data-testid="zone-right-rail"
          onClick={() => setOverlayOpen((o) => !o)}
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
            cursor: 'pointer',
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
              onClick={(e) => {
                e.stopPropagation();
                setOverlayOpen((o) => !o);
              }}
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
