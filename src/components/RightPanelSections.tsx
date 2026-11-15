import React, { useState } from 'react';
import { parseRollableTable, rollOnTable } from '../lib/dice';
import { useFlashConfirm } from '../lib/useFlashConfirm';
import type {
  ModuleClock,
  ModuleEntity,
  ModuleFaction,
  ModuleRandomTable,
  ModuleScene,
  ModuleTimelineEvent,
  ModuleTruth,
} from '../lib/import/types';
import type { DispositionState, ImprovisedClueRecord, RollLogEntry } from '../storage';

const minimalAddButtonStyle: React.CSSProperties = {
  height: '26px',
  padding: '0 8px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
};

export interface CollapsibleSectionProps {
  title: string;
  testId?: string;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  testId,
  open: controlledOpen,
  onToggleOpen,
  headerAction,
  children,
}) => {
  const [localOpen, setLocalOpen] = useState(true);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : localOpen;

  const handleToggle = () => {
    const next = !open;
    if (!isControlled) {
      setLocalOpen(next);
    }
    onToggleOpen?.(next);
  };

  return (
    <section
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            minHeight: '36px',
            padding: '4px 0',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.1em',
            color: 'var(--muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            textAlign: 'left',
          }}
        >
          <span>{title}</span>
          <span aria-hidden="true" style={{ fontSize: '12px' }}>
            {open ? '▾' : '▸'}
          </span>
        </button>
        {headerAction}
      </div>
      <div
        className="gm-accordion"
        data-open={open ? 'true' : 'false'}
        aria-hidden={!open}
      >
        <div
          className="gm-accordion-inner"
          style={{ visibility: open ? 'visible' : 'hidden' }}
        >
          {children}
        </div>
      </div>
    </section>
  );
};

const emptyStateStyle: React.CSSProperties = {
  background: 'var(--p2)',
  border: '1px solid var(--line)',
  borderRadius: '12px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--muted)',
};

const DISPOSITION_COLORS: Record<
  DispositionState,
  { color: string; bg: string; line: string }
> = {
  allied: { color: 'var(--teal)', bg: 'var(--tealBg)', line: 'var(--tealLine)' },
  neutral: { color: 'var(--muted)', bg: 'var(--p3)', line: 'var(--line)' },
  suspicious: { color: 'var(--gold)', bg: 'var(--goldBg)', line: 'var(--goldLine)' },
  hostile: { color: 'var(--red)', bg: 'var(--redBg)', line: 'var(--redLine)' },
};

/* ---------------- 1. Clocks ---------------- */

function buildClockSlicePath(
  cx: number,
  cy: number,
  r: number,
  index: number,
  total: number
): string {
  const startAngle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const endAngle = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export interface ClocksSectionProps {
  clocks: ModuleClock[];
  clockValues: Record<string, number>;
  currentActId: string | null;
  soloMask: boolean;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onAdjustClock: (clockId: string, delta: number, start: number, maxSegments: number) => void;
  onOpenAddClock?: () => void;
}

export const ClocksSection: React.FC<ClocksSectionProps> = ({
  clocks,
  clockValues,
  currentActId,
  soloMask,
  open,
  onToggleOpen,
  onAdjustClock,
  onOpenAddClock,
}) => {
  const visibleClocks = clocks.filter((c) => {
    const scope = (c.scope || 'global').trim();
    if (scope === '' || scope === 'global') return true;
    return currentActId ? scope === currentActId : true;
  });

  return (
    <CollapsibleSection
      title="CLOCKS"
      testId="section-clocks"
      open={open}
      onToggleOpen={onToggleOpen}
      headerAction={
        onOpenAddClock ? (
          <button
            type="button"
            data-testid="add-clock-btn"
            onClick={onOpenAddClock}
            style={minimalAddButtonStyle}
          >
            + Clock
          </button>
        ) : undefined
      }
    >
      {visibleClocks.length === 0 ? (
        <div style={emptyStateStyle}>No clocks ticking yet.</div>
      ) : (
        visibleClocks.map((clock) => {
          const segments = Math.max(1, clock.segments || 4);
          const value = Math.max(0, Math.min(segments, clockValues[clock.id] ?? clock.start ?? 0));
          const isMasked = soloMask && clock.hidden;
          const isFull = !isMasked && value >= segments;

          return (
            <div
              key={clock.id}
              data-testid={`clock-card-${clock.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--p2)',
                border: isFull ? '1px solid var(--gold)' : '1px solid var(--line)',
                borderRadius: '12px',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onAdjustClock(clock.id, 1, clock.start ?? 0, segments);
                  }}
                  aria-label={`Advance ${clock.name} clock`}
                  style={{
                    position: 'relative',
                    width: '84px',
                    height: '84px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <svg
                    width="84"
                    height="84"
                    viewBox="0 0 84 84"
                    aria-hidden="true"
                    data-testid={`clock-svg-${clock.id}`}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    {segments === 1 ? (
                      <circle
                        cx="42"
                        cy="42"
                        r="40"
                        fill={!isMasked && value >= 1 ? 'var(--gold)' : 'var(--line2)'}
                        stroke="var(--p2)"
                        strokeWidth="2"
                        style={{ transition: 'fill 250ms ease-out' }}
                      />
                    ) : (
                      Array.from({ length: segments }, (_, i) => {
                        const filled = !isMasked && i < value;
                        return (
                          <path
                            key={i}
                            d={buildClockSlicePath(42, 42, 40, i, segments)}
                            fill={filled ? 'var(--gold)' : 'var(--line2)'}
                            stroke="var(--p2)"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            style={{ transition: 'fill 250ms ease-out' }}
                          />
                        );
                      })
                    )}
                  </svg>
                  <span
                    className="gm-tabular"
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: '58px',
                      height: '58px',
                      borderRadius: '50%',
                      background: 'var(--p2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                      fontWeight: 600,
                      fontSize: '15px',
                      color: 'var(--text)',
                    }}
                  >
                    {isMasked ? `?/${segments}` : `${value}/${segments}`}
                  </span>
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                    {clock.name}
                  </span>
                  {!isMasked && !isFull && clock.when_full && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Full: {clock.when_full}
                    </span>
                  )}
                  {isMasked && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Segments hidden in Solo mode.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onAdjustClock(clock.id, -1, clock.start ?? 0, segments);
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--p3)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Rewind
                  </button>
                </div>
              </div>

              {isFull && clock.when_full && (
                <div
                  data-testid={`clock-full-banner-${clock.id}`}
                  style={{
                    background: 'var(--goldBg)',
                    border: '1px solid var(--goldLine)',
                    color: 'var(--gold)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {clock.when_full}
                </div>
              )}
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
};

/* ---------------- 2. Timeline ---------------- */

export interface TimelineSectionProps {
  timeline: ModuleTimelineEvent[];
  timelineDone: Record<string, boolean>;
  revealed: Record<string, boolean>;
  currentDayValue: number | null;
  soloMask: boolean;
  sceneTitleById: Map<string, string>;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onToggleDone: (eventId: string) => void;
  onToggleReveal: (eventId: string) => void;
  onJumpToScene: (sceneId: string) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  timeline,
  timelineDone,
  revealed,
  currentDayValue,
  soloMask,
  sceneTitleById,
  open,
  onToggleOpen,
  onToggleDone,
  onToggleReveal,
  onJumpToScene,
}) => {
  const sorted = [...timeline].sort((a, b) => a.order - b.order);

  return (
    <CollapsibleSection
      title="TIMELINE"
      testId="section-timeline"
      open={open}
      onToggleOpen={onToggleOpen}
    >
      {sorted.length === 0 ? (
        <div style={emptyStateStyle}>Nothing on the timeline yet.</div>
      ) : (
        sorted.map((ev) => {
          const isDone = Boolean(timelineDone[ev.id]);
          const isRevealed = Boolean(revealed[ev.id]);
          const isMasked = soloMask && ev.hidden && !isRevealed;
          const isDue =
            currentDayValue !== null && ev.day !== null && ev.day <= currentDayValue;

          return (
            <div
              key={ev.id}
              data-testid={`timeline-card-${ev.id}`}
              data-highlighted={isDue ? 'true' : 'false'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                borderRadius: '12px',
                padding: '10px 12px',
                background: isDue ? 'var(--deltaBg)' : 'var(--p2)',
                border: isDue ? '1px solid var(--gold)' : '1px solid var(--line)',
                opacity: isDone ? 0.68 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="gm-tabular"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    color: isDue ? 'var(--gold)' : 'var(--muted)',
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {ev.when || (ev.day !== null ? `Day ${ev.day}` : `Order ${ev.order}`)}
                </span>
                {isMasked ? (
                  <button
                    type="button"
                    onClick={() => onToggleReveal(ev.id)}
                    style={{
                      height: '44px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--tealLine)',
                      background: 'var(--tealBg)',
                      color: 'var(--teal)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Reveal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleDone(ev.id)}
                    style={{
                      height: '44px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isDone ? 'var(--tealBg)' : 'var(--p3)',
                      color: isDone ? 'var(--teal)' : 'var(--text)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isDone ? 'Done' : 'Mark done'}
                  </button>
                )}
              </div>

              <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                {isMasked ? 'Hidden event. Tap Reveal when it happens.' : ev.text}
              </span>

              {!isMasked && ev.scene_id && (
                <button
                  type="button"
                  onClick={() => onJumpToScene(ev.scene_id!)}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: '44px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--p3)',
                    color: 'var(--accent)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Go to: {sceneTitleById.get(ev.scene_id) ?? ev.scene_id}
                </button>
              )}
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
};

/* ---------------- 3. Clue Matrix ---------------- */

interface CollectedClue {
  id: string;
  label: string;
  targetType: 'scene' | 'entity' | 'improvised';
  targetId: string;
}

export interface ClueMatrixSectionProps {
  truths: ModuleTruth[];
  scenes: ModuleScene[];
  entities: ModuleEntity[];
  improvisedClues?: ImprovisedClueRecord[];
  revealed: Record<string, boolean>;
  soloMask: boolean;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onJumpToScene: (sceneId: string) => void;
  onOpenEntityInspector?: (entityId: string) => void;
  onToggleClueRevealed?: (clueId: string) => void;
  onOpenAddClue?: () => void;
}

export const ClueMatrixSection: React.FC<ClueMatrixSectionProps> = ({
  truths,
  scenes,
  entities,
  improvisedClues = [],
  revealed,
  soloMask,
  open,
  onToggleOpen,
  onJumpToScene,
  onOpenEntityInspector,
  onToggleClueRevealed,
  onOpenAddClue,
}) => {
  const cluesByTruth = new Map<string, CollectedClue[]>();

  for (const scene of scenes) {
    for (const item of [...scene.tier2_interactive, ...scene.tier3_hidden]) {
      if (item.truth_id) {
        const list = cluesByTruth.get(item.truth_id) ?? [];
        list.push({
          id: item.id,
          label: `${scene.title} · ${item.label}`,
          targetType: 'scene',
          targetId: scene.id,
        });
        cluesByTruth.set(item.truth_id, list);
      }
    }
  }

  for (const entity of entities) {
    for (const clue of entity.clues) {
      if (clue.truth_id) {
        const list = cluesByTruth.get(clue.truth_id) ?? [];
        list.push({
          id: clue.id,
          label: `${entity.name} · ${clue.text}`,
          targetType: 'entity',
          targetId: entity.id,
        });
        cluesByTruth.set(clue.truth_id, list);
      }
    }
  }

  for (const impClue of improvisedClues) {
    const list = cluesByTruth.get(impClue.truthId) ?? [];
    list.push({
      id: impClue.id,
      label: impClue.sourceLabel ? `${impClue.sourceLabel} · ${impClue.text}` : impClue.text,
      targetType: 'improvised',
      targetId: impClue.id,
    });
    cluesByTruth.set(impClue.truthId, list);
  }

  return (
    <CollapsibleSection
      title="CLUE MATRIX"
      testId="section-clue-matrix"
      open={open}
      onToggleOpen={onToggleOpen}
      headerAction={
        onOpenAddClue ? (
          <button
            type="button"
            data-testid="add-clue-btn"
            onClick={onOpenAddClue}
            style={minimalAddButtonStyle}
          >
            + Clue
          </button>
        ) : undefined
      }
    >
      {truths.length === 0 ? (
        <div style={emptyStateStyle}>No truths tucked away here.</div>
      ) : (
        truths.map((truth) => {
          const clues = cluesByTruth.get(truth.id) ?? [];
          const foundCount = clues.filter((c) => Boolean(revealed[c.id])).length;
          const isCore = truth.importance === 'core';
          const answerMasked = soloMask && foundCount === 0;
          const statusLabel =
            foundCount > 0
              ? `Found ${foundCount}/${clues.length}`
              : isCore
                ? 'Core · open'
                : 'Optional';
          const statusStyle =
            foundCount > 0
              ? { color: 'var(--teal)', bg: 'var(--tealBg)', line: 'var(--tealLine)' }
              : isCore
                ? { color: 'var(--gold)', bg: 'var(--goldBg)', line: 'var(--goldLine)' }
                : { color: 'var(--muted)', bg: 'var(--p3)', line: 'var(--line)' };

          return (
            <div
              key={truth.id}
              data-testid={`truth-card-${truth.id}`}
              style={{
                background: 'var(--p2)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontWeight: 600, flex: 1, fontSize: '14px', color: 'var(--text)' }}>
                  {truth.title}
                </span>
                <span
                  className="gm-tabular"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    color: statusStyle.color,
                    background: statusStyle.bg,
                    border: `1px solid ${statusStyle.line}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {isCore && clues.length < 2 && (
                <span
                  data-testid={`truth-warning-${truth.id}`}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    color: 'var(--gold)',
                    background: 'var(--goldBg)',
                    border: '1px solid var(--goldLine)',
                  }}
                >
                  1 clue only
                </span>
              )}

              <span style={{ fontSize: '13px', color: 'var(--readText)' }}>
                {answerMasked ? 'Answer hidden until a clue is found.' : truth.text}
              </span>

              {clues.map((clue) => {
                const isFound = Boolean(revealed[clue.id]);
                return (
                  <button
                    key={clue.id}
                    type="button"
                    onClick={() => {
                      if (clue.targetType === 'scene') {
                        onJumpToScene(clue.targetId);
                      } else if (clue.targetType === 'improvised') {
                        onToggleClueRevealed?.(clue.id);
                      } else {
                        onOpenEntityInspector?.(clue.targetId);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      minHeight: '44px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--p3)',
                      fontSize: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: isFound ? 'var(--teal)' : 'var(--line2)',
                      }}
                    />
                    <span style={{ flex: 1, color: 'var(--text)' }}>{clue.label}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: isFound ? 'var(--teal)' : 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isFound ? 'Found' : 'Not yet'}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
};

/* ---------------- 4. Factions ---------------- */

export interface FactionsSectionProps {
  factions: ModuleFaction[];
  factionAttitude: Record<string, DispositionState>;
  soloMask: boolean;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onCycleAttitude: (factionId: string, defaultAttitude: DispositionState) => void;
  onOpenAddFaction?: () => void;
}

export const FactionsSection: React.FC<FactionsSectionProps> = ({
  factions,
  factionAttitude,
  soloMask,
  open,
  onToggleOpen,
  onCycleAttitude,
  onOpenAddFaction,
}) => {
  return (
    <CollapsibleSection
      title="FACTIONS"
      testId="section-factions"
      open={open}
      onToggleOpen={onToggleOpen}
      headerAction={
        onOpenAddFaction ? (
          <button
            type="button"
            data-testid="add-faction-btn"
            onClick={onOpenAddFaction}
            style={minimalAddButtonStyle}
          >
            + Faction
          </button>
        ) : undefined
      }
    >
      {factions.length === 0 ? (
        <div style={emptyStateStyle}>No factions in play yet.</div>
      ) : (
        factions.map((faction) => {
          const attitude = factionAttitude[faction.id] ?? faction.attitude;
          const chip = DISPOSITION_COLORS[attitude];

          return (
            <div
              key={faction.id}
              data-testid={`faction-card-${faction.id}`}
              style={{
                background: 'var(--p2)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', flex: 1, color: 'var(--text)' }}>
                  {faction.name}
                </span>
                <button
                  type="button"
                  onClick={() => onCycleAttitude(faction.id, faction.attitude)}
                  style={{
                    minHeight: '44px',
                    padding: '0 10px',
                    borderRadius: '999px',
                    border: `1px solid ${chip.line}`,
                    background: chip.bg,
                    color: chip.color,
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {attitude}
                </button>
              </div>
              {faction.summary && (
                <span style={{ fontSize: '13px', color: 'var(--readText)' }}>
                  {faction.summary}
                </span>
              )}
              {faction.goal && (
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>Goal:</strong> {faction.goal}
                </span>
              )}
              {faction.secret && (
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>Secret:</strong>{' '}
                  {soloMask ? 'Hidden in Solo mode.' : faction.secret}
                </span>
              )}
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
};

/* ---------------- 5. Random Tables ---------------- */

export interface RandomTablesSectionProps {
  tables: ModuleRandomTable[];
  rollLog: RollLogEntry[];
  currentSceneId: string | null;
  open?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onAppendRollLog: (entry: Omit<RollLogEntry, 'id' | 'createdAt'>) => RollLogEntry;
  onSummonEntity: (sceneId: string, entityId: string) => void;
  onAddSceneNote: (sceneId: string, text: string) => void;
}

export const RandomTablesSection: React.FC<RandomTablesSectionProps> = ({
  tables,
  rollLog,
  currentSceneId,
  open,
  onToggleOpen,
  onAppendRollLog,
  onSummonEntity,
  onAddSceneNote,
}) => {
  const [latestByTable, setLatestByTable] = useState<
    Record<
      string,
      {
        roll: number;
        displayRoll?: number;
        settling?: boolean;
        text: string;
        entityId: string | null;
        noteAdded?: boolean;
      }
    >
  >({});
  const [logOpen, setLogOpen] = useState(false);
  const { flashedIds, triggerFlash } = useFlashConfirm();
  const rollTimersRef = React.useRef<
    Record<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>
  >({});

  const clearTableTimers = React.useCallback((tableId: string) => {
    const active = rollTimersRef.current[tableId];
    if (active) {
      clearInterval(active.interval);
      clearTimeout(active.timeout);
      delete rollTimersRef.current[tableId];
    }
  }, []);

  React.useEffect(() => {
    return () => {
      for (const tableId of Object.keys(rollTimersRef.current)) {
        clearTableTimers(tableId);
      }
    };
  }, [clearTableTimers]);

  const settleNow = React.useCallback(
    (tableId: string) => {
      clearTableTimers(tableId);
      setLatestByTable((prev) => {
        const cur = prev[tableId];
        if (!cur || !cur.settling) return prev;
        return {
          ...prev,
          [tableId]: { ...cur, settling: false, displayRoll: cur.roll },
        };
      });
    },
    [clearTableTimers]
  );

  const visibleLog = rollLog.slice(0, 10);

  return (
    <CollapsibleSection
      title="RANDOM TABLES"
      testId="section-random-tables"
      open={open}
      onToggleOpen={onToggleOpen}
    >
      {tables.length === 0 ? (
        <div style={emptyStateStyle}>No random tables loaded.</div>
      ) : (
        tables.map((table) => {
          const rollable = parseRollableTable(table.dice, table.entries) !== null;
          const latest = latestByTable[table.id];

          return (
            <div
              key={table.id}
              data-testid={`random-table-${table.id}`}
              style={{
                background: 'var(--p2)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                    {table.name}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                    {table.dice || 'Plain list'}
                  </div>
                </div>
                {rollable && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = rollOnTable(table.dice, table.entries);
                      if (!res) return;
                      clearTableTimers(table.id);
                      const text = res.entry ? res.entry.text : `No matching entry for ${res.roll}`;
                      const entityId = res.entry?.entity_id ?? null;
                      const reduceMotion =
                        typeof window !== 'undefined' &&
                        typeof window.matchMedia === 'function' &&
                        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                      onAppendRollLog({
                        tableId: table.id,
                        tableName: table.name,
                        roll: res.roll,
                        text,
                        entityId,
                      });

                      if (reduceMotion) {
                        setLatestByTable((prev) => ({
                          ...prev,
                          [table.id]: { roll: res.roll, displayRoll: res.roll, settling: false, text, entityId },
                        }));
                        return;
                      }

                      const maxDisplay = Math.max(2, res.roll + 2);
                      setLatestByTable((prev) => ({
                        ...prev,
                        [table.id]: {
                          roll: res.roll,
                          displayRoll: ((res.roll % maxDisplay) + 1),
                          settling: true,
                          text,
                          entityId,
                        },
                      }));

                      const interval = setInterval(() => {
                        setLatestByTable((prev) => {
                          const cur = prev[table.id];
                          if (!cur || !cur.settling) return prev;
                          const nextDisplay = ((cur.displayRoll ?? 1) % maxDisplay) + 1;
                          return {
                            ...prev,
                            [table.id]: { ...cur, displayRoll: nextDisplay },
                          };
                        });
                      }, 50);

                      const timeout = setTimeout(() => {
                        settleNow(table.id);
                      }, 350);

                      rollTimersRef.current[table.id] = { interval, timeout };
                    }}
                    style={{
                      height: '48px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--accent)',
                      background: 'var(--accentBg)',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Roll
                  </button>
                )}
              </div>

              {rollable && latest && (
                <div
                  data-testid={`random-table-result-${table.id}`}
                  data-settling={latest.settling ? 'true' : 'false'}
                  onClick={() => {
                    if (latest.settling) settleNow(table.id);
                  }}
                  style={{
                    background: 'var(--p3)',
                    border: '1px solid var(--line2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: latest.settling ? 'pointer' : 'default',
                  }}
                >
                  <div
                    className="gm-tabular"
                    style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--gold)', fontWeight: 700 }}
                  >
                    {latest.settling
                      ? `Rolling ${latest.displayRoll ?? latest.roll}… (tap to skip)`
                      : `Rolled ${latest.roll}`}
                  </div>
                  {!latest.settling && (
                    <>
                      <div style={{ fontSize: '13px', color: 'var(--text)' }}>{latest.text}</div>
                  {currentSceneId && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onAddSceneNote(
                            currentSceneId,
                            `${table.name} (${latest.roll}): ${latest.text}`
                          );
                          setLatestByTable((prev) => ({
                            ...prev,
                            [table.id]: { ...latest, noteAdded: true },
                          }));
                        }}
                        style={{
                          height: '44px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--goldLine)',
                          background: 'var(--goldBg)',
                          color: 'var(--gold)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {latest.noteAdded ? 'Added to scene notes' : 'Add as scene note'}
                      </button>
                      {latest.entityId && (
                        <button
                          type="button"
                          className={flashedIds[`summon-${table.id}`] ? 'gm-flash-confirm' : undefined}
                          onClick={() => {
                            onSummonEntity(currentSceneId, latest.entityId!);
                            triggerFlash(`summon-${table.id}`);
                          }}
                          style={{
                            height: '44px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--tealLine)',
                            background: 'var(--tealBg)',
                            color: 'var(--teal)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {flashedIds[`summon-${table.id}`] ? 'Added ✓' : 'Add to scene'}
                        </button>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {!rollable && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '12px',
                    color: 'var(--readText)',
                  }}
                >
                  {table.entries.map((entry, idx) => (
                    <li key={`${table.id}-e-${idx}`}>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                        {entry.range ? `${entry.range}: ` : ''}
                      </span>
                      {entry.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          aria-expanded={logOpen}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span className="gm-tabular">Roll log ({visibleLog.length})</span>
          <span aria-hidden="true">{logOpen ? '▾' : '▸'}</span>
        </button>

        <div
          className="gm-accordion"
          data-open={logOpen ? 'true' : 'false'}
          aria-hidden={!logOpen}
        >
          <div
            className="gm-accordion-inner"
            style={{ gap: '4px', visibility: logOpen ? 'visible' : 'hidden' }}
          >
            {visibleLog.length === 0 ? (
              <div style={emptyStateStyle}>No rolls yet — tap Roll above when ready.</div>
            ) : (
              visibleLog.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--p2)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 700 }}>
                    [{item.roll}]
                  </span>{' '}
                  <span style={{ color: 'var(--muted)' }}>{item.tableName}:</span> {item.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
