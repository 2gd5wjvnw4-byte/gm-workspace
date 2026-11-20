import React from 'react';
import { getEffectiveScenes } from '../lib/improvised';
import { useFlashConfirm } from '../lib/useFlashConfirm';
import type { DispositionState } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

const DISPOSITION_COLORS: Record<DispositionState, string> = {
  allied: 'var(--teal)',
  neutral: 'var(--muted)',
  suspicious: 'var(--gold)',
  hostile: 'var(--red)',
};

export interface EntitySheetContentProps {
  entityId: string | null;
  showCloseButton?: boolean;
  onClose?: () => void;
  onOpenPdfPage?: (printedPage: number) => void;
  testIdPrefix?: string;
}

export const EntitySheetContent: React.FC<EntitySheetContentProps> = ({
  entityId,
  showCloseButton = false,
  onClose,
  onOpenPdfPage,
  testIdPrefix = 'inspector',
}) => {
  const {
    merged,
    live,
    cycleEntityDisposition,
    toggleRevealedItem,
    adjustEntityTrack,
    setEntityTrackValue,
    setEntityTrackMax,
  } = useCampaignStore();
  const { flashedIds, triggerFlash } = useFlashConfirm();
  const [editingTrackCell, setEditingTrackCell] = React.useState<{
    key: string;
    field: 'current' | 'max';
    draft: string;
  } | null>(null);

  const soloMask = Boolean(live?.ui?.soloMask);
  const revealed = live?.revealed ?? {};
  const entityDisposition = live?.entityDisposition ?? {};
  const entityTracks = live?.entityTracks ?? {};
  const entityTrackMax = live?.entityTrackMax ?? {};
  const improvisedEntities = live?.improvisedEntities ?? [];
  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene =
    effectiveScenes.find((s) => s.id === currentSceneId) ?? effectiveScenes[0] ?? null;

  React.useEffect(() => {
    setEditingTrackCell(null);
  }, [entityId]);

  const renderTracks = (
    targetEntityId: string,
    entityName: string,
    copyCount: number,
    tracks: Array<{ label: string; max: number }>
  ) => {
    if (tracks.length === 0) {
      return null;
    }
    const trackMatrix = entityTracks[targetEntityId] ?? [];
    const maxMatrix = entityTrackMax[targetEntityId] ?? [];
    return (
      <div
        data-testid={`${testIdPrefix}-tracks-${targetEntityId}`}
        style={{
          background: 'var(--p2)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
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
          TRACKING
        </span>
        {Array.from({ length: copyCount }).map((_, copyIdx) =>
          tracks.map((trackDef, trackIdx) => {
            const effectiveMax = maxMatrix[copyIdx]?.[trackIdx] ?? trackDef.max;
            const currentVal = trackMatrix[copyIdx]?.[trackIdx] ?? effectiveMax;
            const rowLabel =
              copyCount > 1
                ? `${trackDef.label} #${copyIdx + 1}`
                : trackDef.label;
            const cellKey = `${targetEntityId}-${copyIdx}-${trackIdx}`;
            const isEditingCurrent =
              editingTrackCell?.key === cellKey &&
              editingTrackCell.field === 'current';
            const isEditingMax =
              editingTrackCell?.key === cellKey &&
              editingTrackCell.field === 'max';

            const commitEdit = (field: 'current' | 'max', raw: string) => {
              const parsed = Number.parseInt(raw.trim(), 10);
              if (!Number.isNaN(parsed)) {
                if (field === 'current') {
                  setEntityTrackValue(
                    targetEntityId,
                    copyIdx,
                    trackIdx,
                    parsed,
                    copyCount,
                    tracks
                  );
                } else {
                  setEntityTrackMax(
                    targetEntityId,
                    copyIdx,
                    trackIdx,
                    parsed,
                    copyCount,
                    tracks
                  );
                }
              }
              setEditingTrackCell(null);
            };

            const numberBtnStyle: React.CSSProperties = {
              minWidth: '38px',
              minHeight: '44px',
              padding: '0 6px',
              borderRadius: '6px',
              border: '1px dashed var(--line2)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            };

            const numberInputStyle: React.CSSProperties = {
              width: '54px',
              height: '44px',
              padding: '0 4px',
              borderRadius: '6px',
              border: '1px solid var(--accent)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              fontSize: '14px',
              textAlign: 'center',
              boxSizing: 'border-box',
            };

            return (
              <div
                key={`${copyIdx}-${trackIdx}`}
                data-testid={`${testIdPrefix}-track-row-${targetEntityId}-${copyIdx}-${trackIdx}`}
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
                    width: '80px',
                    flexShrink: 0,
                  }}
                >
                  {rowLabel}
                </span>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-track-dec-${targetEntityId}-${copyIdx}-${trackIdx}`}
                  aria-label={`Decrease ${entityName} ${rowLabel}`}
                  onClick={() =>
                    adjustEntityTrack(
                      targetEntityId,
                      copyIdx,
                      trackIdx,
                      -1,
                      copyCount,
                      tracks
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
                    flexShrink: 0,
                  }}
                >
                  −
                </button>
                <span
                  data-testid={`${testIdPrefix}-track-val-${targetEntityId}-${copyIdx}-${trackIdx}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontFamily: 'var(--mono)',
                    fontWeight: 600,
                  }}
                >
                  {isEditingCurrent ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      data-testid={`${testIdPrefix}-track-current-input-${targetEntityId}-${copyIdx}-${trackIdx}`}
                      aria-label={`Edit ${entityName} ${rowLabel} current`}
                      value={editingTrackCell.draft}
                      onChange={(e) =>
                        setEditingTrackCell({
                          key: cellKey,
                          field: 'current',
                          draft: e.target.value,
                        })
                      }
                      onBlur={() => commitEdit('current', editingTrackCell.draft)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitEdit('current', editingTrackCell.draft);
                        } else if (e.key === 'Escape') {
                          setEditingTrackCell(null);
                        }
                      }}
                      style={numberInputStyle}
                    />
                  ) : (
                    <button
                      type="button"
                      className="gm-tabular"
                      data-testid={`${testIdPrefix}-track-current-btn-${targetEntityId}-${copyIdx}-${trackIdx}`}
                      aria-label={`Edit ${entityName} ${rowLabel} current value (${currentVal})`}
                      onClick={() =>
                        setEditingTrackCell({
                          key: cellKey,
                          field: 'current',
                          draft: String(currentVal),
                        })
                      }
                      style={numberBtnStyle}
                    >
                      {currentVal}
                    </button>
                  )}
                  <span style={{ color: 'var(--muted)' }}> / </span>
                  {isEditingMax ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      data-testid={`${testIdPrefix}-track-max-input-${targetEntityId}-${copyIdx}-${trackIdx}`}
                      aria-label={`Edit ${entityName} ${rowLabel} max`}
                      value={editingTrackCell.draft}
                      onChange={(e) =>
                        setEditingTrackCell({
                          key: cellKey,
                          field: 'max',
                          draft: e.target.value,
                        })
                      }
                      onBlur={() => commitEdit('max', editingTrackCell.draft)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitEdit('max', editingTrackCell.draft);
                        } else if (e.key === 'Escape') {
                          setEditingTrackCell(null);
                        }
                      }}
                      style={numberInputStyle}
                    />
                  ) : (
                    <button
                      type="button"
                      className="gm-tabular"
                      data-testid={`${testIdPrefix}-track-max-btn-${targetEntityId}-${copyIdx}-${trackIdx}`}
                      aria-label={`Edit ${entityName} ${rowLabel} max value (${effectiveMax})`}
                      onClick={() =>
                        setEditingTrackCell({
                          key: cellKey,
                          field: 'max',
                          draft: String(effectiveMax),
                        })
                      }
                      style={numberBtnStyle}
                    >
                      {effectiveMax}
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-track-inc-${targetEntityId}-${copyIdx}-${trackIdx}`}
                  aria-label={`Increase ${entityName} ${rowLabel}`}
                  onClick={() =>
                    adjustEntityTrack(
                      targetEntityId,
                      copyIdx,
                      trackIdx,
                      1,
                      copyCount,
                      tracks
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
                    flexShrink: 0,
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
  };

  const baseEntity = entityId
    ? merged.entities.find((e) => e.id === entityId) ?? null
    : merged.entities[0] ?? null;

  const impEntity =
    !baseEntity && entityId
      ? improvisedEntities.find((imp) => imp.id === entityId) ?? null
      : null;

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

  if (baseEntity) {
    const disp = entityDisposition[baseEntity.id] ?? baseEntity.disposition;
    const dispColor = DISPOSITION_COLORS[disp];
    const secretText = baseEntity.roleplay.secret
      ? soloMask
        ? 'Hidden in Solo Mode.'
        : baseEntity.roleplay.secret
      : 'None.';

    const countOverride = currentScene?.entity_counts?.[baseEntity.id];
    const copyCount =
      typeof countOverride === 'number' && countOverride > 0
        ? countOverride
        : Math.max(1, baseEntity.count || 1);

    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <span
            data-testid={`${testIdPrefix}-entity-name`}
            style={{
              fontFamily: 'var(--head)',
              fontWeight: 700,
              fontSize: '16px',
              flex: 1,
              minWidth: 0,
            }}
          >
            {baseEntity.name}
          </span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-disp-chip`}
            onClick={() =>
              cycleEntityDisposition(baseEntity.id, baseEntity.disposition)
            }
            aria-label={`Change ${baseEntity.name} disposition (${disp})`}
            style={{
              ...chipStyle(dispColor),
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {disp}
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              data-testid="close-entity-inspector-btn"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            data-testid={`${testIdPrefix}-type-page`}
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{baseEntity.type} ·</span>
            <button
              type="button"
              data-testid={`${testIdPrefix}-page-btn`}
              onClick={() => onOpenPdfPage?.(baseEntity.page)}
              style={{
                height: '28px',
                padding: '0 8px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--p2)',
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              p.{baseEntity.page}
            </button>
          </div>

          {baseEntity.stat_line && (
            <div
              data-testid={`${testIdPrefix}-stat-line`}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '13px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '10px',
              }}
            >
              {baseEntity.stat_line}
            </div>
          )}

          {renderTracks(baseEntity.id, baseEntity.name, copyCount, baseEntity.tracks)}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '.1em',
                color: 'var(--muted)',
              }}
            >
              VOICE
            </span>
            <span data-testid={`${testIdPrefix}-voice`}>
              {baseEntity.roleplay.voice || '—'}
            </span>

            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '.1em',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              GOAL
            </span>
            <span data-testid={`${testIdPrefix}-goal`}>
              {baseEntity.roleplay.goal || '—'}
            </span>

            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '.1em',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              SECRET
            </span>
            <span
              data-testid={`${testIdPrefix}-secret`}
              style={{
                color: soloMask ? 'var(--muted)' : 'var(--red)',
              }}
            >
              {secretText}
            </span>
          </div>

          {baseEntity.clues.map((clue) => {
            const isClueRevealed = Boolean(revealed[clue.id]);
            const showClueText = !soloMask || isClueRevealed;
            const btnLabel = isClueRevealed
              ? 'Found'
              : soloMask
                ? 'Reveal'
                : 'Mark found';
            return (
              <div
                key={clue.id}
                data-testid={`${testIdPrefix}-clue-card-${clue.id}`}
                style={{
                  background: 'var(--tealBg)',
                  border: '1px solid var(--tealLine)',
                  borderRadius: '10px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--teal)',
                  }}
                >
                  CLUE
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--blue)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {clue.check || 'No check'}
                </span>
                {showClueText ? (
                  <span
                    data-testid={`${testIdPrefix}-clue-text-${clue.id}`}
                    style={{ fontSize: '14px' }}
                  >
                    {clue.text}
                  </span>
                ) : (
                  <span
                    data-testid={`${testIdPrefix}-clue-hidden-${clue.id}`}
                    style={{ fontSize: '13px', color: 'var(--muted)' }}
                  >
                    Clue hidden. Roll, then tap Reveal.
                  </span>
                )}
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-clue-btn-${clue.id}`}
                  className={flashedIds[clue.id] ? 'gm-flash-confirm' : undefined}
                  onClick={() => {
                    if (!isClueRevealed) triggerFlash(clue.id);
                    toggleRevealedItem(clue.id);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--tealLine)',
                    background: 'var(--panel)',
                    color: 'var(--teal)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {flashedIds[clue.id] && isClueRevealed ? `${btnLabel} ✓` : btnLabel}
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (impEntity) {
    const disp = entityDisposition[impEntity.id] ?? impEntity.disposition;
    const dispColor = DISPOSITION_COLORS[disp];
    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <span
            data-testid={`${testIdPrefix}-entity-name`}
            style={{
              fontFamily: 'var(--head)',
              fontWeight: 700,
              fontSize: '16px',
              flex: 1,
              minWidth: 0,
            }}
          >
            {impEntity.name}
          </span>
          <span style={chipStyle('var(--gold)')}>Improvised</span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-disp-chip`}
            onClick={() =>
              cycleEntityDisposition(impEntity.id, impEntity.disposition)
            }
            aria-label={`Change ${impEntity.name} disposition (${disp})`}
            style={{
              ...chipStyle(dispColor),
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {disp}
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              data-testid="close-entity-inspector-btn"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            data-testid={`${testIdPrefix}-type-page`}
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
            }}
          >
            IMPROVISED NPC
          </div>
          <div style={{ fontSize: '14px' }}>
            {impEntity.summary || 'No summary provided.'}
          </div>
          {renderTracks(
            impEntity.id,
            impEntity.name,
            1,
            impEntity.track ? [impEntity.track] : []
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {showCloseButton && onClose && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--head)',
              fontWeight: 700,
              fontSize: '16px',
              flex: 1,
            }}
          >
            Entity Inspector
          </span>
          <button
            type="button"
            data-testid="close-entity-inspector-btn"
            onClick={onClose}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Select an entity to inspect.
        </div>
      </div>
    </>
  );
};
