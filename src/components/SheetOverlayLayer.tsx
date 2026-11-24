import React, { useRef, useState } from 'react';
import {
  clampOverlayPct,
  getSheetOverlaysForPage,
  SHEET_OVERLAY_COLORS,
} from '../lib/playerSheets';
import { playTactileClick } from '../lib/sound';
import type {
  SheetOverlayColor,
  SheetOverlayKind,
  SheetOverlayRecord,
} from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

const OVERLAY_COLOR_STYLE: Record<
  SheetOverlayColor,
  { fg: string; bg: string; line: string; label: string }
> = {
  accent: { fg: 'var(--accent)', bg: 'var(--accentBg)', line: 'var(--accent)', label: 'Accent' },
  gold: { fg: 'var(--gold)', bg: 'var(--goldBg)', line: 'var(--goldLine)', label: 'Gold' },
  red: { fg: 'var(--red)', bg: 'var(--redBg)', line: 'var(--redLine)', label: 'Red' },
  teal: { fg: 'var(--teal)', bg: 'var(--tealBg)', line: 'var(--tealLine)', label: 'Teal' },
  violet: { fg: 'var(--violet)', bg: 'var(--violetBg)', line: 'var(--violetLine)', label: 'Violet' },
};

function getColorTokens(color?: SheetOverlayColor) {
  return OVERLAY_COLOR_STYLE[color ?? 'accent'] ?? OVERLAY_COLOR_STYLE.accent;
}

export interface SheetOverlayToolbarProps {
  placementTool: SheetOverlayKind | null;
  onSelectTool: (tool: SheetOverlayKind | null) => void;
  testIdPrefix: string;
}

export const SheetOverlayToolbar: React.FC<SheetOverlayToolbarProps> = ({
  placementTool,
  onSelectTool,
  testIdPrefix,
}) => {
  const tools: Array<{ kind: SheetOverlayKind; label: string }> = [
    { kind: 'text', label: '+ Text' },
    { kind: 'dot', label: '+ Dot' },
    { kind: 'counter', label: '+ Counter' },
  ];

  return (
    <div
      data-testid={`${testIdPrefix}-overlay-toolbar`}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '6px 8px',
        borderRadius: '8px',
        background: 'var(--p2)',
        border: '1px solid var(--accent)',
        flexShrink: 0,
      }}
    >
      {tools.map((tool) => {
        const active = placementTool === tool.kind;
        return (
          <button
            key={tool.kind}
            type="button"
            data-testid={`${testIdPrefix}-overlay-tool-${tool.kind}`}
            aria-pressed={active}
            onClick={() => {
              playTactileClick();
              onSelectTool(active ? null : tool.kind);
            }}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: active ? 'var(--accent)' : 'var(--p3)',
              color: active ? 'var(--onAccent)' : 'var(--text)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tool.label}
          </button>
        );
      })}
      <span
        style={{
          fontSize: '12px',
          color: 'var(--muted)',
          marginLeft: '4px',
        }}
      >
        {placementTool
          ? `Tap the sheet to place a ${placementTool} pin.`
          : 'Drag pins to move them, or tap a pin to edit.'}
      </span>
    </div>
  );
};

export interface SheetOverlayInspectorProps {
  sheetId: string;
  selectedOverlay: SheetOverlayRecord | null;
  onClearSelection: () => void;
  testIdPrefix: string;
}

export const SheetOverlayInspector: React.FC<SheetOverlayInspectorProps> = ({
  sheetId,
  selectedOverlay,
  onClearSelection,
  testIdPrefix,
}) => {
  const updatePlayerSheetOverlay = useCampaignStore((s) => s.updatePlayerSheetOverlay);
  const removePlayerSheetOverlay = useCampaignStore((s) => s.removePlayerSheetOverlay);

  if (!selectedOverlay) return null;

  return (
    <div
      data-testid={`${testIdPrefix}-overlay-inspector`}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'var(--p2)',
        border: '1px solid var(--line)',
        flexShrink: 0,
      }}
    >
      <input
        type="text"
        data-testid={`${testIdPrefix}-overlay-label-input`}
        aria-label="Pin label"
        value={selectedOverlay.label ?? ''}
        onChange={(e) =>
          updatePlayerSheetOverlay(sheetId, selectedOverlay.id, {
            label: e.target.value,
          })
        }
        placeholder="Label (optional)"
        style={{
          flex: 1,
          minWidth: '110px',
          height: '44px',
          padding: '0 10px',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontSize: '13px',
        }}
      />
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {SHEET_OVERLAY_COLORS.map((colorKey) => {
          const tokens = OVERLAY_COLOR_STYLE[colorKey];
          const isSelected = (selectedOverlay.color ?? 'accent') === colorKey;
          return (
            <button
              key={colorKey}
              type="button"
              data-testid={`${testIdPrefix}-overlay-color-${colorKey}`}
              aria-label={`Pin color ${tokens.label}`}
              aria-pressed={isSelected}
              onClick={() => {
                playTactileClick();
                updatePlayerSheetOverlay(sheetId, selectedOverlay.id, { color: colorKey });
              }}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: isSelected ? `2px solid ${tokens.fg}` : '1px solid var(--line)',
                background: tokens.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: tokens.fg,
                  display: 'block',
                }}
              />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-testid={`${testIdPrefix}-overlay-delete-selected`}
        onClick={() => {
          playTactileClick();
          removePlayerSheetOverlay(sheetId, selectedOverlay.id);
          onClearSelection();
        }}
        style={{
          height: '44px',
          padding: '0 12px',
          borderRadius: '8px',
          border: '1px solid var(--redLine)',
          background: 'var(--redBg)',
          color: 'var(--red)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Delete pin
      </button>
    </div>
  );
};

export interface SheetOverlayLayerProps {
  sheetId: string;
  sheetKind: 'image' | 'pdf';
  currentPage: number;
  overlays: readonly SheetOverlayRecord[] | undefined;
  editMode: boolean;
  placementTool: SheetOverlayKind | null;
  selectedOverlayId: string | null;
  onPlaced: (overlay: SheetOverlayRecord) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  testIdPrefix: string;
}

export const SheetOverlayLayer: React.FC<SheetOverlayLayerProps> = ({
  sheetId,
  sheetKind,
  currentPage,
  overlays,
  editMode,
  placementTool,
  selectedOverlayId,
  onPlaced,
  onSelectOverlay,
  testIdPrefix,
}) => {
  const addPlayerSheetOverlay = useCampaignStore((s) => s.addPlayerSheetOverlay);
  const updatePlayerSheetOverlay = useCampaignStore((s) => s.updatePlayerSheetOverlay);
  const adjustPlayerSheetOverlayCounter = useCampaignStore(
    (s) => s.adjustPlayerSheetOverlayCounter
  );
  const togglePlayerSheetOverlayDot = useCampaignStore((s) => s.togglePlayerSheetOverlayDot);
  const removePlayerSheetOverlay = useCampaignStore((s) => s.removePlayerSheetOverlay);

  const layerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    xPct: number;
    yPct: number;
    moved: boolean;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    xPct: number;
    yPct: number;
  } | null>(null);

  const visibleOverlays = getSheetOverlaysForPage(overlays, currentPage, sheetKind);

  const computePctFromClient = (clientX: number, clientY: number): { xPct: number; yPct: number } => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { xPct: 50, yPct: 50 };
    }
    return {
      xPct: clampOverlayPct(((clientX - rect.left) / rect.width) * 100),
      yPct: clampOverlayPct(((clientY - rect.top) / rect.height) * 100),
    };
  };

  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !placementTool) return;
    if (e.target !== layerRef.current) return;
    e.stopPropagation();
    const { xPct, yPct } = computePctFromClient(e.clientX, e.clientY);
    playTactileClick();
    const created = addPlayerSheetOverlay(sheetId, {
      kind: placementTool,
      xPct,
      yPct,
      ...(sheetKind === 'pdf' ? { page: currentPage } : {}),
      ...(placementTool === 'text' ? { text: 'Note' } : {}),
      ...(placementTool === 'dot' ? { active: true } : {}),
      ...(placementTool === 'counter' ? { value: 0 } : {}),
    });
    if (created) {
      onPlaced(created);
    }
  };

  const handlePinPointerDown = (overlay: SheetOverlayRecord, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!editMode) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('[data-overlay-delete="true"]')) return;

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures on synthetic pointer events
      }
    }

    dragRef.current = {
      id: overlay.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      xPct: overlay.xPct,
      yPct: overlay.yPct,
      moved: false,
    };
  };

  const handlePinPointerMove = (overlay: SheetOverlayRecord, e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!editMode || !active || active.id !== overlay.id || active.pointerId !== e.pointerId) {
      return;
    }
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    e.stopPropagation();
    const dist = Math.hypot(e.clientX - active.startClientX, e.clientY - active.startClientY);
    if (!active.moved && !(dist > 5)) return;
    const next = computePctFromClient(e.clientX, e.clientY);
    active.xPct = next.xPct;
    active.yPct = next.yPct;
    active.moved = true;
    setDragPreview({ id: overlay.id, xPct: next.xPct, yPct: next.yPct });
  };

  const finishPinDrag = (overlay: SheetOverlayRecord, e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.id !== overlay.id || active.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (active.moved) {
      updatePlayerSheetOverlay(sheetId, overlay.id, {
        xPct: active.xPct,
        yPct: active.yPct,
      });
    }
    onSelectOverlay(overlay.id);
    dragRef.current = null;
    setDragPreview(null);
  };

  return (
    <div
      ref={layerRef}
      data-testid={`${testIdPrefix}-overlay-layer`}
      data-edit-mode={editMode ? 'true' : 'false'}
      data-placement-tool={placementTool ?? ''}
      onClick={handleSurfaceClick}
      onPointerDown={(e) => {
        if (editMode && placementTool && e.target === layerRef.current) {
          e.stopPropagation();
        }
      }}
      onDoubleClick={(e) => {
        if (editMode) e.stopPropagation();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: editMode && placementTool ? 'auto' : 'none',
        cursor: editMode && placementTool ? 'crosshair' : 'default',
        zIndex: 4,
      }}
    >
      {visibleOverlays.map((overlay) => {
        const isDragging = dragPreview?.id === overlay.id;
        const leftPct = isDragging ? dragPreview.xPct : overlay.xPct;
        const topPct = isDragging ? dragPreview.yPct : overlay.yPct;
        const isSelected = editMode && selectedOverlayId === overlay.id;
        const tokens = getColorTokens(overlay.color);

        return (
          <div
            key={overlay.id}
            data-testid={`${testIdPrefix}-overlay-${overlay.id}`}
            data-overlay-kind={overlay.kind}
            data-overlay-x={String(leftPct)}
            data-overlay-y={String(topPct)}
            onPointerDown={(e) => handlePinPointerDown(overlay, e)}
            onPointerMove={(e) => handlePinPointerMove(overlay, e)}
            onPointerUp={(e) => finishPinDrag(overlay, e)}
            onPointerCancel={(e) => finishPinDrag(overlay, e)}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              touchAction: editMode ? 'none' : 'manipulation',
              cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
              zIndex: isSelected ? 10 : 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: isSelected ? '3px' : '0px',
              borderRadius: '10px',
              outline: isSelected ? `2px dashed ${tokens.fg}` : 'none',
              outlineOffset: '2px',
            }}
          >
            {overlay.label && overlay.label.trim().length > 0 && (
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: 'var(--panel)',
                  border: `1px solid ${tokens.line}`,
                  color: tokens.fg,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {overlay.label}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {overlay.kind === 'text' && (
                <input
                  type="text"
                  data-testid={`${testIdPrefix}-overlay-text-input-${overlay.id}`}
                  aria-label={overlay.label ? `${overlay.label} text` : 'Pinned text'}
                  value={overlay.text ?? ''}
                  readOnly={editMode}
                  onPointerDown={(e) => {
                    if (!editMode) e.stopPropagation();
                  }}
                  onChange={(e) => {
                    if (editMode) return;
                    updatePlayerSheetOverlay(sheetId, overlay.id, { text: e.target.value });
                  }}
                  style={{
                    minWidth: '84px',
                    width: `${Math.min(180, Math.max(84, (overlay.text?.length ?? 4) * 9 + 24))}px`,
                    height: '44px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: `1.5px solid ${tokens.line}`,
                    background: 'var(--panel)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
                    cursor: editMode ? 'grab' : 'text',
                  }}
                />
              )}

              {overlay.kind === 'dot' && (
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-overlay-dot-${overlay.id}`}
                  aria-label={overlay.label ? `${overlay.label} marker` : 'Pinned dot marker'}
                  aria-pressed={Boolean(overlay.active)}
                  onPointerDown={(e) => {
                    if (!editMode) e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    playTactileClick();
                    if (editMode) {
                      onSelectOverlay(overlay.id);
                      return;
                    }
                    togglePlayerSheetOverlayDot(sheetId, overlay.id);
                  }}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: editMode ? 'grab' : 'pointer',
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: `2.5px solid ${tokens.fg}`,
                      background: overlay.active ? tokens.fg : 'var(--panel)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--onAccent)',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {overlay.active ? '●' : ''}
                  </span>
                </button>
              )}

              {overlay.kind === 'counter' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px',
                    borderRadius: '10px',
                    border: `1.5px solid ${tokens.line}`,
                    background: 'var(--panel)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-overlay-dec-${overlay.id}`}
                    aria-label={overlay.label ? `Decrease ${overlay.label}` : 'Decrease counter'}
                    aria-disabled={editMode}
                    onPointerDown={(e) => {
                      if (!editMode) e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editMode) {
                        onSelectOverlay(overlay.id);
                        return;
                      }
                      playTactileClick();
                      adjustPlayerSheetOverlayCounter(sheetId, overlay.id, -1);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--p3)',
                      color: editMode ? 'var(--faint)' : 'var(--text)',
                      fontSize: '18px',
                      fontWeight: 700,
                      cursor: editMode ? 'grab' : 'pointer',
                      pointerEvents: editMode ? 'none' : 'auto',
                    }}
                  >
                    −
                  </button>
                  <span
                    data-testid={`${testIdPrefix}-overlay-val-${overlay.id}`}
                    style={{
                      minWidth: '34px',
                      textAlign: 'center',
                      fontFamily: 'var(--mono)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: tokens.fg,
                      padding: '0 4px',
                    }}
                  >
                    {overlay.value ?? 0}
                  </span>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-overlay-inc-${overlay.id}`}
                    aria-label={overlay.label ? `Increase ${overlay.label}` : 'Increase counter'}
                    aria-disabled={editMode}
                    onPointerDown={(e) => {
                      if (!editMode) e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editMode) {
                        onSelectOverlay(overlay.id);
                        return;
                      }
                      playTactileClick();
                      adjustPlayerSheetOverlayCounter(sheetId, overlay.id, 1);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--p3)',
                      color: editMode ? 'var(--faint)' : 'var(--text)',
                      fontSize: '18px',
                      fontWeight: 700,
                      cursor: editMode ? 'grab' : 'pointer',
                      pointerEvents: editMode ? 'none' : 'auto',
                    }}
                  >
                    +
                  </button>
                </div>
              )}

              {isSelected && (
                <button
                  type="button"
                  data-overlay-delete="true"
                  data-testid={`${testIdPrefix}-overlay-del-${overlay.id}`}
                  aria-label="Delete pin"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    playTactileClick();
                    removePlayerSheetOverlay(sheetId, overlay.id);
                    onSelectOverlay(null);
                  }}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    border: '1px solid var(--redLine)',
                    background: 'var(--redBg)',
                    color: 'var(--red)',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
