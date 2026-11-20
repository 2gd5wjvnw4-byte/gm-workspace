import React, { useRef, useState } from 'react';
import {
  DESK_CARD_HEADER_HEIGHT,
  DESK_GRID_SIZE,
  resizeDeskCardFromCorner,
  snapToDeskGrid,
  type DeskResizeCorner,
} from '../lib/desk';
import type { DeskCardRecord } from '../storage/types';

export interface DeskCardShellProps {
  card: DeskCardRecord;
  scale: number;
  snapToGrid: boolean;
  gridSize?: number;
  isMissingTarget: boolean;
  onBringToFront: (cardId: string) => void;
  onMove: (cardId: string, x: number, y: number) => void;
  onResize: (
    cardId: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  onToggleMinimize: (cardId: string) => void;
  onClose: (cardId: string) => void;
  children?: React.ReactNode;
}

const CORNERS: DeskResizeCorner[] = ['nw', 'ne', 'sw', 'se'];

const CARD_TYPE_BADGES: Record<DeskCardRecord['type'], string> = {
  scene: 'SCENE',
  pdf: 'PDF',
  page: 'PAGE',
  sheet: 'SHEET',
  tracker: 'TRACKER',
  'scene-list': 'LIST',
  'node-map': 'NODES',
  'random-tables': 'TABLES',
  factions: 'FACTIONS',
  timeline: 'TIMELINE',
  clocks: 'CLOCKS',
  'clue-matrix': 'CLUES',
  notes: 'NOTES',
};

export const DeskCardShell: React.FC<DeskCardShellProps> = ({
  card,
  scale,
  snapToGrid,
  gridSize = DESK_GRID_SIZE,
  isMissingTarget,
  onBringToFront,
  onMove,
  onResize,
  onToggleMinimize,
  onClose,
  children,
}) => {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resizeRef = useRef<{
    pointerId: number;
    corner: DeskResizeCorner;
    startClientX: number;
    startClientY: number;
    originRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const [activeGesture, setActiveGesture] = useState<'drag' | 'resize' | null>(null);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    e.stopPropagation();
    onBringToFront(card.id);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: card.x,
      originY: card.y,
    };
    setActiveGesture('drag');
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic test events may not register active pointer IDs
    }
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const worldDx = (e.clientX - active.startClientX) / safeScale;
    const worldDy = (e.clientY - active.startClientY) / safeScale;
    const nextX = snapToDeskGrid(active.originX + worldDx, gridSize, snapToGrid);
    const nextY = snapToDeskGrid(active.originY + worldDy, gridSize, snapToGrid);
    onMove(card.id, nextX, nextY);
  };

  const handleHeaderPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragRef.current = null;
    setActiveGesture(null);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events
    }
  };

  const handleCornerPointerDown = (
    corner: DeskResizeCorner,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    onBringToFront(card.id);
    resizeRef.current = {
      pointerId: e.pointerId,
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originRect: {
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
      },
    };
    setActiveGesture('resize');
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }
  };

  const handleCornerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const worldDx = (e.clientX - active.startClientX) / safeScale;
    const worldDy = (e.clientY - active.startClientY) / safeScale;
    const nextRect = resizeDeskCardFromCorner(
      active.originRect,
      active.corner,
      worldDx,
      worldDy,
      snapToGrid,
      gridSize
    );
    onResize(card.id, nextRect);
  };

  const handleCornerPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    e.stopPropagation();
    resizeRef.current = null;
    setActiveGesture(null);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events
    }
  };

  const effectiveHeight = card.minimized ? DESK_CARD_HEADER_HEIGHT : card.height;

  return (
    <div
      data-testid={`desk-card-${card.id}`}
      data-card-id={card.id}
      data-card-type={card.type}
      data-minimized={card.minimized ? 'true' : 'false'}
      data-flagged={isMissingTarget ? 'true' : 'false'}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBringToFront(card.id);
      }}
      style={{
        position: 'absolute',
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${effectiveHeight}px`,
        zIndex: card.z,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel)',
        border: isMissingTarget
          ? '2px solid var(--gold)'
          : activeGesture
            ? '2px solid var(--accent)'
            : '1px solid var(--line2)',
        borderRadius: '12px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
        overflow: 'visible',
        userSelect: 'none',
      }}
    >
      {/* Card Title Bar (Drag Handle) */}
      <div
        data-testid={`desk-card-header-${card.id}`}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerEnd}
        onPointerCancel={handleHeaderPointerEnd}
        style={{
          height: `${DESK_CARD_HEADER_HEIGHT}px`,
          minHeight: `${DESK_CARD_HEADER_HEIGHT}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '0 22px 0 24px',
          background: 'var(--p2)',
          borderBottom: card.minimized ? 'none' : '1px solid var(--line)',
          borderRadius: card.minimized ? '11px' : '11px 11px 0 0',
          cursor: activeGesture === 'drag' ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: '5px',
              background: isMissingTarget ? 'var(--goldBg)' : 'var(--accentBg)',
              color: isMissingTarget ? 'var(--gold)' : 'var(--accent)',
              border: isMissingTarget
                ? '1px solid var(--goldLine)'
                : '1px solid var(--line)',
              flexShrink: 0,
            }}
          >
            {CARD_TYPE_BADGES[card.type]}
          </span>
          <span
            data-testid={`desk-card-title-${card.id}`}
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.title}
          </span>
          {card.followCurrentScene && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: '4px',
                background: 'var(--tealBg)',
                color: 'var(--teal)',
                border: '1px solid var(--tealLine)',
                flexShrink: 0,
              }}
            >
              FOLLOW
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flexShrink: 0,
            position: 'relative',
            zIndex: 6,
          }}
        >
          <button
            type="button"
            data-testid={`desk-card-minimize-${card.id}`}
            aria-label={card.minimized ? 'Restore card' : 'Minimize card'}
            aria-pressed={card.minimized}
            onClick={(e) => {
              e.stopPropagation();
              onBringToFront(card.id);
              onToggleMinimize(card.id);
            }}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--muted)',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {card.minimized ? '▢' : '−'}
          </button>
          <button
            type="button"
            data-testid={`desk-card-close-${card.id}`}
            aria-label="Close card"
            onClick={(e) => {
              e.stopPropagation();
              onClose(card.id);
            }}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--muted)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Card Body */}
      {!card.minimized && (
        <div
          data-testid={`desk-card-body-${card.id}`}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '12px',
            borderRadius: '0 0 11px 11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            userSelect: 'text',
          }}
        >
          {isMissingTarget ? (
            <div
              data-testid="desk-card-missing-flag"
              role="alert"
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--goldBg)',
                border: '1px solid var(--gold)',
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--gold)',
                }}
              >
                Flagged · Missing Target Data
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                This card points to record{' '}
                <code style={{ fontFamily: 'var(--mono)' }}>
                  {card.targetId || 'unknown'}
                </code>
                , which is not loaded or was deleted.
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      )}

      {/* 4 Corner Resize Handles (44x44px touch targets) */}
      {!card.minimized &&
        CORNERS.map((corner) => {
          const isTop = corner === 'nw' || corner === 'ne';
          const isLeft = corner === 'nw' || corner === 'sw';
          const cursor =
            corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
          return (
            <div
              key={corner}
              data-testid={`desk-card-resize-${corner}-${card.id}`}
              aria-label={`Resize ${corner.toUpperCase()} corner`}
              onPointerDown={(e) => handleCornerPointerDown(corner, e)}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={handleCornerPointerEnd}
              onPointerCancel={handleCornerPointerEnd}
              style={{
                position: 'absolute',
                width: '44px',
                height: '44px',
                ...(isTop ? { top: '-24px' } : { bottom: '-20px' }),
                ...(isLeft ? { left: '-24px' } : { right: '-24px' }),
                display: 'flex',
                alignItems: isTop ? 'center' : 'flex-end',
                justifyContent: isLeft ? 'center' : 'flex-end',
                padding: '10px',
                cursor,
                touchAction: 'none',
                zIndex: 4,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '10px',
                  height: '10px',
                  borderColor: 'var(--line2)',
                  borderStyle: 'solid',
                  borderTopWidth: isTop ? '2px' : 0,
                  borderBottomWidth: !isTop ? '2px' : 0,
                  borderLeftWidth: isLeft ? '2px' : 0,
                  borderRightWidth: !isLeft ? '2px' : 0,
                  borderRadius: '2px',
                  pointerEvents: 'none',
                }}
              />
            </div>
          );
        })}
    </div>
  );
};
