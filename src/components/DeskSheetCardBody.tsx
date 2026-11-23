import React, { useEffect, useRef, useState } from 'react';
import { getEffectiveScenes } from '../lib/improvised';
import { playerSheetKindLabel } from '../lib/playerSheets';
import { getSoloVisibleEntityIds } from '../lib/solo';
import { playTactileClick } from '../lib/sound';
import type { DeskCardRecord } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { EntitySheetContent } from './EntitySheetContent';
import { PlayerSheetView } from './PlayerSheetView';

export interface DeskSheetCardBodyProps {
  card: DeskCardRecord;
  onSelectEntity: (entityId: string, title: string) => void;
  onOpenPdfPage?: (printedPage: number) => void;
  isVisible?: boolean;
  renderWidth?: number;
}

export const DeskSheetCardBody: React.FC<DeskSheetCardBodyProps> = ({
  card,
  onSelectEntity,
  onOpenPdfPage,
  isVisible = true,
  renderWidth = 360,
}) => {
  const { merged, live } = useCampaignStore();
  const improvised = live?.improvisedEntities ?? [];
  const playerSheets = live?.playerSheets ?? [];
  const soloMask = Boolean(live?.ui?.soloMask);
  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const soloVisibleIds = getSoloVisibleEntityIds({
    scenes: effectiveScenes,
    entities: merged.entities,
    improvisedEntities: improvised,
    visited: live?.visited ?? {},
    summoned: live?.summoned ?? {},
    currentSceneId: live?.currentSceneId ?? null,
    soloMask,
  });

  const playerSheetIds = new Set(playerSheets.map((s) => s.id));

  const allOptions = [
    ...playerSheets.map((s) => ({
      id: s.id,
      badge: `PC · ${playerSheetKindLabel(s.kind)}`,
      name: s.name,
      isPlayerSheet: true,
    })),
    ...merged.entities
      .filter((e) => soloVisibleIds.has(e.id))
      .map((e) => ({
        id: e.id,
        badge: e.type.toUpperCase(),
        name: e.name,
        isPlayerSheet: false,
      })),
    ...improvised
      .filter((e) => soloVisibleIds.has(e.id))
      .map((e) => ({
        id: e.id,
        badge: 'IMPROVISED',
        name: e.name,
        isPlayerSheet: false,
      })),
  ];

  // Player character sheets are never hidden by Solo Mask
  const isTargetPlayerSheet = Boolean(card.targetId && playerSheetIds.has(card.targetId));
  const isTargetHiddenInSolo =
    soloMask &&
    Boolean(card.targetId) &&
    !isTargetPlayerSheet &&
    !soloVisibleIds.has(card.targetId!);

  const resolvedTargetId = isTargetHiddenInSolo
    ? null
    : card.targetId && allOptions.some((o) => o.id === card.targetId)
      ? card.targetId
      : allOptions[0]?.id ?? null;

  const resolvedOption = resolvedTargetId
    ? allOptions.find((o) => o.id === resolvedTargetId) ?? null
    : null;
  const resolvedIsPlayerSheet = Boolean(resolvedTargetId && playerSheetIds.has(resolvedTargetId));

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        pickerAreaRef.current &&
        !pickerAreaRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  return (
    <div
      data-testid={`desk-sheet-card-body-${card.id}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
      }}
    >
      {(allOptions.length > 0 || isTargetHiddenInSolo) && (
        <div
          ref={pickerAreaRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <button
            type="button"
            data-testid={`desk-sheet-picker-btn-${card.id}`}
            aria-label="Select NPC or character sheet"
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            onClick={() => {
              playTactileClick();
              setPickerOpen((v) => !v);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: pickerOpen
                ? '1px solid var(--accent)'
                : '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
              }}
            >
              {isTargetHiddenInSolo ? (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      color: 'var(--violet)',
                      flexShrink: 0,
                    }}
                  >
                    ???
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Hidden Character
                  </span>
                </>
              ) : resolvedOption ? (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  >
                    {resolvedOption.badge}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {resolvedOption.name}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Pick a sheet
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                flexShrink: 0,
              }}
            >
              {pickerOpen ? '▴' : '▾'}
            </span>
          </button>

          {pickerOpen && (
            <div
              data-testid={`desk-sheet-picker-menu-${card.id}`}
              role="listbox"
              aria-label="Character sheet options"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: '10px',
                border: '1px solid var(--line2)',
                background: 'var(--panel)',
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 10,
                touchAction: 'pan-y',
              }}
            >
              {isTargetHiddenInSolo && (
                <button
                  type="button"
                  role="option"
                  aria-selected={true}
                  disabled
                  data-testid={`desk-sheet-picker-masked-option-${card.id}`}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--violetLine)',
                    background: 'var(--violetBg)',
                    color: 'var(--violet)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      flexShrink: 0,
                    }}
                  >
                    ???
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Hidden Character
                  </span>
                </button>
              )}
              {allOptions.map((opt) => {
                const isSelected = resolvedTargetId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`desk-sheet-picker-option-${card.id}-${opt.id}`}
                    onClick={() => {
                      playTactileClick();
                      onSelectEntity(opt.id, opt.name);
                      setPickerOpen(false);
                    }}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--line)',
                      background: isSelected ? 'var(--accentBg)' : 'var(--p2)',
                      color: 'var(--text)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        color: isSelected ? 'var(--accent)' : 'var(--muted)',
                        flexShrink: 0,
                      }}
                    >
                      {opt.badge}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: isSelected ? 700 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {opt.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isTargetHiddenInSolo ? (
        <div
          data-testid={`desk-sheet-masked-${card.id}`}
          style={{
            flex: 1,
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px',
            borderRadius: '8px',
            border: '1px dashed var(--violetLine)',
            background:
              'repeating-linear-gradient(135deg, var(--panel) 0 10px, var(--stripe) 10px 20px)',
            color: 'var(--violet)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Character hidden in Solo mode until encountered in a visited scene.
        </div>
      ) : resolvedTargetId ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            overflow: 'hidden',
          }}
        >
          {resolvedIsPlayerSheet ? (
            <PlayerSheetView
              sheetId={resolvedTargetId}
              isVisible={isVisible}
              renderWidth={renderWidth}
              testIdPrefix={`desk-player-sheet-${card.id}`}
            />
          ) : (
            <EntitySheetContent
              entityId={resolvedTargetId}
              onOpenPdfPage={onOpenPdfPage}
              testIdPrefix={`desk-sheet-${card.id}`}
            />
          )}
        </div>
      ) : (
        <div
          data-testid={`desk-sheet-empty-${card.id}`}
          style={{
            flex: 1,
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px',
            borderRadius: '8px',
            border: '1px dashed var(--line2)',
            background: 'var(--mapBg)',
            color: 'var(--muted)',
            fontSize: '13px',
            lineHeight: 1.45,
          }}
        >
          No character or NPC sheets yet. Add a Player Sheet or import a module.
        </div>
      )}
    </div>
  );
};
