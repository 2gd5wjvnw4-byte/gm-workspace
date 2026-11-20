import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeDeskPdfRenderWidth,
  DESK_CARD_CATALOG,
  DESK_GRID_SIZE,
  DESK_MAX_ZOOM,
  DESK_MIN_ZOOM,
  ensureDeskState,
  fitAllDeskCards,
  isDeskCardTargetMissing,
  isDeskCardVisibleInViewport,
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
import type { DeskCardRecord, DeskCardType, TableNote } from '../storage/types';
import { DeskCardShell } from './DeskCardShell';
import { DeskMapCardBody } from './DeskMapCardBody';
import { DeskPageCardBody } from './DeskPageCardBody';
import { DeskPdfCardBody } from './DeskPdfCardBody';
import { DeskSceneCardBody } from './DeskSceneCardBody';
import { DeskSheetCardBody } from './DeskSheetCardBody';
import { resolveActiveMap } from './MapArea';

export interface DeskCanvasProps {
  onOpenPdfDrawer?: (printedPage?: number) => void;
  onOpenEntityInspector?: (entityId: string) => void;
  onEditNote?: (note: TableNote) => void;
  onOpenMapLibrary?: () => void;
}

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

export const DeskCanvas: React.FC<DeskCanvasProps> = ({
  onOpenPdfDrawer,
  onOpenEntityInspector,
  onEditNote,
  onOpenMapLibrary,
}) => {
  const {
    merged,
    live,
    pdfInfo,
    setDeskSnapToGrid,
    setDeskLinkOpenMode,
    setDeskViewport,
    addDeskCard,
    moveDeskCard,
    resizeDeskCard,
    bringDeskCardToFront,
    toggleDeskCardMinimized,
    setDeskCardTarget,
    updateDeskCard,
    removeDeskCard,
  } = useCampaignStore();

  const desk = ensureDeskState(live?.desk);
  const linkOpenMode = desk.linkOpenMode ?? 'in-place';
  const [transform, setTransform] = useState<PanZoomTransform>(desk.viewport);
  const transformRef = useRef<PanZoomTransform>(desk.viewport);
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT);
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

  useEffect(() => {
    const updateSize = () => {
      const next = getViewportSize();
      setViewportSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [getViewportSize]);

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
        let curEl: HTMLElement | null = target;
        while (curEl) {
          const canScrollY = curEl.scrollHeight > curEl.clientHeight;
          const canScrollX = curEl.scrollWidth > curEl.clientWidth;
          if (canScrollY || canScrollX) {
            return;
          }
          if (curEl === cardBody) break;
          curEl = curEl.parentElement;
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
    } else if (type === 'pdf') {
      addDeskCard({
        type: 'pdf',
        title: pdfInfo ? pdfInfo.fileName : 'Source PDF',
        pageNumber: currentScene?.page ?? 1,
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
    } else if (type === 'map') {
      const activeMap = resolveActiveMap({
        maps: live?.maps ?? [],
        sceneMap: live?.sceneMap ?? {},
        currentSceneId: live?.currentSceneId ?? null,
        lastMapId: live?.ui?.lastMapId ?? null,
      });
      addDeskCard({
        type: 'map',
        title: activeMap ? activeMap.name : 'Map',
        targetId: activeMap?.id ?? null,
        x: spawnX,
        y: spawnY,
      });
    } else {
      addDeskCard({ type, x: spawnX, y: spawnY });
    }
    setAddMenuOpen(false);
  };

  const handleSpawnSceneCard = (sceneId: string, nearCard: DeskCardRecord) => {
    const effectiveScenes = getEffectiveScenes(merged.scenes, live);
    const scene = effectiveScenes.find((s) => s.id === sceneId);
    addDeskCard({
      type: 'scene',
      title: scene ? `${scene.code} · ${scene.title}` : 'Scene',
      targetId: sceneId,
      followCurrentScene: false,
      x: nearCard.x + nearCard.width + 24,
      y: nearCard.y,
    });
  };

  const handleSpawnSheetCard = (entityId: string, nearCard: DeskCardRecord) => {
    const base = merged.entities.find((e) => e.id === entityId);
    const imp = (live?.improvisedEntities ?? []).find((e) => e.id === entityId);
    addDeskCard({
      type: 'sheet',
      title: base?.name ?? imp?.name ?? 'Character Sheet',
      targetId: entityId,
      x: nearCard.x + nearCard.width + 24,
      y: nearCard.y,
    });
  };

  const handleSpawnPageCard = (printedPage: number, nearCard: DeskCardRecord) => {
    addDeskCard({
      type: 'page',
      title: `PDF Page ${printedPage}`,
      pageNumber: printedPage,
      x: nearCard.x + nearCard.width + 24,
      y: nearCard.y,
    });
  };

  const handleGoToInPdf = (printedPage?: number) => {
    const page = printedPage ?? 1;
    const openPdfCard = desk.cards.find((c) => c.type === 'pdf');
    if (openPdfCard) {
      updateDeskCard(openPdfCard.id, { pageNumber: page });
      if (openPdfCard.minimized) {
        toggleDeskCardMinimized(openPdfCard.id);
      }
      bringDeskCardToFront(openPdfCard.id);
      return;
    }
    onOpenPdfDrawer?.(page);
  };

  const renderCardBodySummary = (card: DeskCardRecord) => {
    const isCardVisible = isDeskCardVisibleInViewport(
      card,
      transform,
      viewportSize.width,
      viewportSize.height
    );
    const pdfRenderWidth = computeDeskPdfRenderWidth(card.width, transform.scale);

    switch (card.type) {
      case 'scene':
        return (
          <DeskSceneCardBody
            card={card}
            linkOpenMode={linkOpenMode}
            onUpdateCard={updateDeskCard}
            onSpawnSceneCard={handleSpawnSceneCard}
            onSpawnSheetCard={handleSpawnSheetCard}
            onSpawnPageCard={handleSpawnPageCard}
            onOpenPdfInPlace={handleGoToInPdf}
            onOpenEntityInspector={(entityId) => onOpenEntityInspector?.(entityId)}
            onEditNote={onEditNote}
            onOpenMapLibrary={onOpenMapLibrary}
          />
        );
      case 'pdf':
        return (
          <DeskPdfCardBody
            card={card}
            isVisible={isCardVisible}
            renderWidth={pdfRenderWidth}
            onUpdatePage={(cardId, printedPage) =>
              updateDeskCard(cardId, { pageNumber: printedPage })
            }
            onDetachPage={handleSpawnPageCard}
          />
        );
      case 'page':
        return (
          <DeskPageCardBody
            card={card}
            isVisible={isCardVisible}
            renderWidth={pdfRenderWidth}
            onGoToInPdf={handleGoToInPdf}
          />
        );
      case 'sheet':
        return (
          <DeskSheetCardBody
            card={card}
            onSelectEntity={(entityId, title) => setDeskCardTarget(card.id, entityId, title)}
            onOpenPdfPage={(printedPage) => {
              if (linkOpenMode === 'new-card') {
                handleSpawnPageCard(printedPage, card);
              } else {
                handleGoToInPdf(printedPage);
              }
            }}
          />
        );
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
      case 'map':
        return (
          <DeskMapCardBody
            card={card}
            maps={live?.maps ?? []}
            onSelectMap={(mapId, title) => setDeskCardTarget(card.id, mapId, title)}
          />
        );
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
        {desk.cards.map((card) => {
          const effectiveScenes =
            card.type === 'scene' && card.followCurrentScene
              ? getEffectiveScenes(merged.scenes, live)
              : null;
          const activeFollowScene = effectiveScenes
            ? effectiveScenes.find((s) => s.id === live?.currentSceneId) ??
              effectiveScenes[0] ??
              null
            : null;
          const displayCard = activeFollowScene
            ? {
                ...card,
                title: `${activeFollowScene.code} · ${activeFollowScene.title}`,
              }
            : card;

          return (
            <DeskCardShell
              key={card.id}
              card={displayCard}
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
          );
        })}
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

          <button
            type="button"
            data-testid="desk-link-mode-toggle"
            aria-pressed={linkOpenMode === 'new-card'}
            onClick={() =>
              setDeskLinkOpenMode(linkOpenMode === 'new-card' ? 'in-place' : 'new-card')
            }
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '10px',
              border:
                linkOpenMode === 'new-card'
                  ? '1px solid var(--tealLine)'
                  : '1px solid var(--line)',
              background: linkOpenMode === 'new-card' ? 'var(--tealBg)' : 'var(--panel)',
              color: linkOpenMode === 'new-card' ? 'var(--teal)' : 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            }}
          >
            Links: {linkOpenMode === 'new-card' ? 'New card' : 'In place'}
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
