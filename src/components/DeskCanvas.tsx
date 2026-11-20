import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DESK_CARD_CATALOG,
  DESK_GRID_SIZE,
  DESK_MAX_ZOOM,
  DESK_MIN_ZOOM,
  ensureDeskState,
  fitAllDeskCards,
  isDeskCardTargetMissing,
} from '../lib/desk';
import { getEffectiveScenes } from '../lib/improvised';
import {
  formatZoomPercent,
  PAN_THRESHOLD_PX,
  panBy,
  type PanZoomTransform,
  pinchTransform,
  ZOOM_STEP,
  zoomAtPoint,
} from '../lib/panzoom';
import { useCampaignStore } from '../store/campaignStore';
import type { DeskCardRecord, DeskCardType } from '../storage/types';
import { DeskCardShell } from './DeskCardShell';

interface ActivePointer {
  x: number;
  y: number;
}

interface PinchAnchor {
  transform: PanZoomTransform;
  midX: number;
  midY: number;
  dist: number;
}

const DEFAULT_VIEWPORT = { width: 1180, height: 720 };

export const DeskCanvas: React.FC = () => {
  const {
    merged,
    live,
    pdfInfo,
    setDeskSnapToGrid,
    setDeskViewport,
    addDeskCard,
    moveDeskCard,
    resizeDeskCard,
    bringDeskCardToFront,
    toggleDeskCardMinimized,
    removeDeskCard,
  } = useCampaignStore();

  const desk = ensureDeskState(live?.desk);
  const [transform, setTransform] = useState<PanZoomTransform>(desk.viewport);
  const transformRef = useRef<PanZoomTransform>(desk.viewport);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Sync local transform when campaign changes or external viewport update happens
  useEffect(() => {
    transformRef.current = desk.viewport;
    setTransform(desk.viewport);
  }, [desk.viewport.x, desk.viewport.y, desk.viewport.scale, live?.campaignId]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const singleAnchorRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const pinchAnchorRef = useRef<PinchAnchor | null>(null);

  const getViewportSize = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return DEFAULT_VIEWPORT;
  }, []);

  const applyAndSaveTransform = useCallback(
    (next: PanZoomTransform) => {
      transformRef.current = next;
      setTransform(next);
      setDeskViewport(next);
    },
    [setDeskViewport]
  );

  // Attach native non-passive wheel listener so ctrl/cmd+wheel zooms without Chrome passive warnings
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid="desk-add-card-menu"]')) {
        if (!e.ctrlKey && !e.metaKey) {
          return;
        }
      }
      const cardBody = target?.closest('[data-testid^="desk-card-body-"]') as HTMLElement | null;
      if (cardBody && !e.ctrlKey && !e.metaKey) {
        const canScrollY = cardBody.scrollHeight > cardBody.clientHeight;
        const canScrollX = cardBody.scrollWidth > cardBody.clientWidth;
        if (canScrollY || canScrollX) {
          return;
        }
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const cur = transformRef.current;

      if (e.ctrlKey || e.metaKey) {
        if (e.deltaY === 0) return;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const next = zoomAtPoint(
          cur,
          cur.scale * factor,
          focalX,
          focalY,
          DESK_MIN_ZOOM,
          DESK_MAX_ZOOM
        );
        applyAndSaveTransform(next);
      } else {
        const next = panBy(cur, -e.deltaX, -e.deltaY);
        applyAndSaveTransform(next);
      }
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [applyAndSaveTransform]);

  const handleZoomIn = () => {
    const vp = getViewportSize();
    const cur = transformRef.current;
    const next = zoomAtPoint(
      cur,
      cur.scale * ZOOM_STEP,
      vp.width / 2,
      vp.height / 2,
      DESK_MIN_ZOOM,
      DESK_MAX_ZOOM
    );
    applyAndSaveTransform(next);
  };

  const handleZoomOut = () => {
    const vp = getViewportSize();
    const cur = transformRef.current;
    const next = zoomAtPoint(
      cur,
      cur.scale / ZOOM_STEP,
      vp.width / 2,
      vp.height / 2,
      DESK_MIN_ZOOM,
      DESK_MAX_ZOOM
    );
    applyAndSaveTransform(next);
  };

  const handleFitAll = () => {
    const vp = getViewportSize();
    const next = fitAllDeskCards(desk.cards, vp.width, vp.height, 64);
    applyAndSaveTransform(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[data-testid^="desk-card-"]') ||
      target?.closest('[data-testid="desk-toolbar"]') ||
      target?.closest('[data-testid="desk-add-card-menu"]')
    ) {
      return;
    }

    if (addMenuOpen) {
      setAddMenuOpen(false);
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const localX = e.clientX - (rect?.left ?? 0);
    const localY = e.clientY - (rect?.top ?? 0);

    pointersRef.current.set(e.pointerId, { x: localX, y: localY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic test events may not have active pointer IDs
    }

    if (pointersRef.current.size === 1) {
      singleAnchorRef.current = {
        pointerId: e.pointerId,
        startX: localX,
        startY: localY,
        lastX: localX,
        lastY: localY,
        moved: false,
      };
      pinchAnchorRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchAnchorRef.current = {
        transform: transformRef.current,
        midX,
        midY,
        dist,
      };
      singleAnchorRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const localX = e.clientX - (rect?.left ?? 0);
    const localY = e.clientY - (rect?.top ?? 0);
    pointersRef.current.set(e.pointerId, { x: localX, y: localY });

    if (pointersRef.current.size === 1 && singleAnchorRef.current) {
      const anchor = singleAnchorRef.current;
      const totalDist = Math.hypot(localX - anchor.startX, localY - anchor.startY);
      if (!anchor.moved && totalDist < PAN_THRESHOLD_PX) {
        return;
      }
      anchor.moved = true;
      const dx = localX - anchor.lastX;
      const dy = localY - anchor.lastY;
      anchor.lastX = localX;
      anchor.lastY = localY;
      const next = panBy(transformRef.current, dx, dy);
      applyAndSaveTransform(next);
    } else if (pointersRef.current.size >= 2 && pinchAnchorRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const curMidX = (pts[0].x + pts[1].x) / 2;
      const curMidY = (pts[0].y + pts[1].y) / 2;
      const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const anchor = pinchAnchorRef.current;
      const next = pinchTransform(
        anchor.transform,
        anchor.midX,
        anchor.midY,
        anchor.dist,
        curMidX,
        curMidY,
        curDist,
        DESK_MIN_ZOOM,
        DESK_MAX_ZOOM
      );
      applyAndSaveTransform(next);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events
    }

    if (pointersRef.current.size === 0) {
      singleAnchorRef.current = null;
      pinchAnchorRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const [remainingId, pt] = Array.from(pointersRef.current.entries())[0];
      singleAnchorRef.current = {
        pointerId: remainingId,
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y,
        moved: true,
      };
      pinchAnchorRef.current = null;
    }
  };

  const handleAddCardType = (type: DeskCardType) => {
    const effectiveScenes = getEffectiveScenes(merged.scenes, live);
    const currentScene =
      effectiveScenes.find((s) => s.id === live?.currentSceneId) ??
      effectiveScenes[0] ??
      null;
    const cur = transformRef.current;
    const safeScale = cur.scale > 0 ? cur.scale : 1;
    const offset = (desk.cards.length * 36) % 216;
    const spawnX = (48 - cur.x) / safeScale + offset;
    const spawnY = (72 - cur.y) / safeScale + offset;

    if (type === 'scene') {
      addDeskCard({
        type: 'scene',
        title: currentScene ? `${currentScene.code} · ${currentScene.title}` : 'Current Scene',
        followCurrentScene: true,
        x: spawnX,
        y: spawnY,
      });
    } else if (type === 'sheet') {
      const firstEntity = merged.entities[0];
      addDeskCard({
        type: 'sheet',
        title: firstEntity ? firstEntity.name : 'Character Sheet',
        targetId: firstEntity?.id ?? null,
        x: spawnX,
        y: spawnY,
      });
    } else if (type === 'tracker') {
      const firstTracker = merged.trackers[0];
      addDeskCard({
        type: 'tracker',
        title: firstTracker ? firstTracker.label : 'Tracker',
        targetId: firstTracker?.id ?? null,
        x: spawnX,
        y: spawnY,
      });
    } else if (type === 'page') {
      addDeskCard({
        type: 'page',
        title: `PDF Page ${currentScene?.page ?? 1}`,
        pageNumber: currentScene?.page ?? 1,
        x: spawnX,
        y: spawnY,
      });
    } else {
      addDeskCard({ type, x: spawnX, y: spawnY });
    }
    setAddMenuOpen(false);
  };

  const renderCardBodySummary = (card: DeskCardRecord) => {
    const effectiveScenes = getEffectiveScenes(merged.scenes, live);
    const currentScene =
      effectiveScenes.find((s) => s.id === live?.currentSceneId) ??
      effectiveScenes[0] ??
      null;

    switch (card.type) {
      case 'scene': {
        const scene = card.followCurrentScene
          ? currentScene
          : effectiveScenes.find((s) => s.id === card.targetId) ?? currentScene;
        if (!scene) {
          return <div style={{ color: 'var(--muted)' }}>No scene selected.</div>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                color: 'var(--accent)',
              }}
            >
              {scene.id} · #{scene.code} · p.{scene.page}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              {scene.title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--readText)', lineHeight: 1.45 }}>
              {scene.summary || 'Interactive scene stage.'}
            </div>
          </div>
        );
      }
      case 'pdf':
        return (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {pdfInfo
              ? `Attached: ${pdfInfo.fileName}`
              : 'Source PDF book card (attach a PDF in the campaign switcher).'}
          </div>
        );
      case 'page':
        return (
          <div style={{ fontSize: '13px', color: 'var(--text)' }}>
            Detached PDF Page · p.{card.pageNumber ?? 1}
          </div>
        );
      case 'sheet': {
        const baseEntity =
          merged.entities.find((e) => e.id === card.targetId) ?? null;
        const impEntity =
          (live?.improvisedEntities ?? []).find((e) => e.id === card.targetId) ??
          null;
        const entity =
          baseEntity ?? (card.targetId ? null : merged.entities[0] ?? null);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {entity ? entity.name : impEntity ? impEntity.name : card.title}
            </div>
            {entity && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                >
                  {entity.stat_line}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {entity.summary}
                </div>
              </>
            )}
            {!entity && impEntity && (
              <>
                {impEntity.track && (
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  >
                    {impEntity.track.label} (max {impEntity.track.max})
                  </div>
                )}
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {impEntity.summary}
                </div>
              </>
            )}
          </div>
        );
      }
      case 'tracker': {
        const tracker =
          merged.trackers.find((t) => t.id === card.targetId) ??
          merged.trackers[0] ??
          null;
        const val = tracker
          ? (live?.trackerValues?.[tracker.id] ?? tracker.start)
          : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {tracker ? tracker.label : card.title}
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              {val}
            </span>
          </div>
        );
      }
      default:
        return (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {card.title} card on Desk ({card.width}×{card.height}px)
          </div>
        );
    }
  };

  const gridSize = desk.gridSize || DESK_GRID_SIZE;
  const scaledGridPx = Math.max(6, gridSize * transform.scale);

  return (
    <div
      ref={containerRef}
      data-testid="desk-canvas"
      data-snap-to-grid={desk.snapToGrid ? 'true' : 'false'}
      data-scale={transform.scale.toFixed(4)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--mapBg)',
        backgroundImage:
          'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
        backgroundSize: `${scaledGridPx}px ${scaledGridPx}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Transformed World Layer */}
      <div
        data-testid="desk-world"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {desk.cards.map((card) => (
          <DeskCardShell
            key={card.id}
            card={card}
            scale={transform.scale}
            snapToGrid={desk.snapToGrid}
            gridSize={gridSize}
            isMissingTarget={isDeskCardTargetMissing(card, merged, live)}
            onBringToFront={(id) => {
              if (addMenuOpen) setAddMenuOpen(false);
              bringDeskCardToFront(id);
            }}
            onMove={moveDeskCard}
            onResize={resizeDeskCard}
            onToggleMinimize={toggleDeskCardMinimized}
            onClose={removeDeskCard}
          >
            {renderCardBodySummary(card)}
          </DeskCardShell>
        ))}
      </div>

      {/* Empty Desk Hint */}
      {desk.cards.length === 0 && (
        <div
          data-testid="desk-empty-hint"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '16px 22px',
              borderRadius: '12px',
              background: 'var(--panel)',
              border: '1px dashed var(--line2)',
              color: 'var(--muted)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            Your Desk is clear. Tap <strong>+ Add Card</strong> to lay out scenes, sheets, PDF pages, and tools.
          </div>
        </div>
      )}

      {/* Floating Desk Toolbar */}
      <div
        data-testid="desk-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '14px',
          left: '14px',
          right: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {/* Left group: Add Card + Snap to Grid */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'auto',
            position: 'relative',
          }}
        >
          <button
            type="button"
            data-testid="desk-add-card-btn"
            aria-expanded={addMenuOpen}
            onClick={() => setAddMenuOpen((v) => !v)}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '10px',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.28)',
            }}
          >
            + Add Card
          </button>

          <button
            type="button"
            data-testid="desk-snap-toggle"
            aria-pressed={desk.snapToGrid}
            onClick={() => setDeskSnapToGrid(!desk.snapToGrid)}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '10px',
              border: desk.snapToGrid
                ? '1px solid var(--accent)'
                : '1px solid var(--line)',
              background: desk.snapToGrid ? 'var(--accentBg)' : 'var(--panel)',
              color: desk.snapToGrid ? 'var(--accent)' : 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            }}
          >
            Snap {desk.snapToGrid ? 'On' : 'Off'}
          </button>

          {addMenuOpen && (
            <div
              data-testid="desk-add-card-menu"
              role="menu"
              style={{
                position: 'absolute',
                top: '52px',
                left: 0,
                width: '260px',
                maxHeight: '420px',
                overflowY: 'auto',
                background: 'var(--panel)',
                border: '1px solid var(--line2)',
                borderRadius: '12px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                zIndex: 30,
              }}
            >
              {DESK_CARD_CATALOG.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  role="menuitem"
                  data-testid={`desk-add-card-option-${item.type}`}
                  onClick={() => handleAddCardType(item.type)}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid transparent',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      color: 'var(--muted)',
                    }}
                  >
                    +
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right group: Zoom -, %, +, Fit All */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px',
            borderRadius: '10px',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            data-testid="desk-zoom-out"
            aria-label="Zoom out Desk"
            onClick={handleZoomOut}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <span
            data-testid="desk-zoom-readout"
            style={{
              minWidth: '58px',
              textAlign: 'center',
              fontFamily: 'var(--mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {formatZoomPercent(transform.scale)}
          </span>
          <button
            type="button"
            data-testid="desk-zoom-in"
            aria-label="Zoom in Desk"
            onClick={handleZoomIn}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            type="button"
            data-testid="desk-fit-all"
            onClick={handleFitAll}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p2)',
              color: 'var(--accent)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Fit all
          </button>
        </div>
      </div>
    </div>
  );
};
