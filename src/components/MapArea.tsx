import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleConnection, ModuleScene } from '../lib/import/types';
import {
  fitBounds,
  formatZoomPercent,
  MAX_ZOOM,
  MIN_ZOOM,
  PAN_THRESHOLD_PX,
  panBy,
  pinchTransform,
  TAP_SUPPRESS_MS,
  ZOOM_STEP,
  zoomAtPoint,
  type PanZoomTransform,
} from '../lib/panzoom';
import { computeReachableSceneIds, getSceneVisibility } from '../lib/solo';
import type {
  ConnectionOverrideState,
  MapAssetRecord,
  MapDisplayMode,
  ScenePin,
} from '../storage/types';
import { useBlobObjectUrl } from './MapLibrarySheet';

export interface MapAreaProps {
  mapMode: MapDisplayMode;
  maps: MapAssetRecord[];
  pins: Record<string, ScenePin>;
  sceneMap: Record<string, string>;
  lastMapId: string | null;
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  currentSceneId: string | null;
  visited: Record<string, boolean>;
  revealed: Record<string, boolean>;
  connectionState: Record<string, ConnectionOverrideState>;
  soloMask: boolean;
  scenesWithNotes: Set<string>;
  onSelectScene: (sceneId: string) => void;
  onSetScenePin: (sceneId: string, pin: ScenePin | null) => void;
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

interface DraggingPinState {
  sceneId: string;
  pointerId: number;
  xPct: number;
  yPct: number;
}

export function resolveActiveMap(params: {
  maps: MapAssetRecord[];
  sceneMap: Record<string, string>;
  currentSceneId: string | null;
  lastMapId: string | null;
}): MapAssetRecord | null {
  const { maps, sceneMap, currentSceneId, lastMapId } = params;
  if (maps.length === 0) return null;
  const preferredId =
    (currentSceneId ? sceneMap[currentSceneId] : undefined) ||
    lastMapId ||
    maps[0].id;
  return maps.find((m) => m.id === preferredId) ?? maps[0];
}

export const MapArea: React.FC<MapAreaProps> = ({
  mapMode,
  maps,
  pins,
  sceneMap,
  lastMapId,
  scenes,
  connections,
  currentSceneId,
  visited,
  revealed,
  connectionState,
  soloMask,
  scenesWithNotes,
  onSelectScene,
  onSetScenePin,
  onOpenMapLibrary,
}) => {
  const activeMap = useMemo(
    () => resolveActiveMap({ maps, sceneMap, currentSceneId, lastMapId }),
    [maps, sceneMap, currentSceneId, lastMapId]
  );
  const imageUrl = useBlobObjectUrl(activeMap?.blobKey);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 480, height: 320 });
  const [transform, setTransform] = useState<PanZoomTransform>({ x: 0, y: 0, scale: 1 });
  const [editPinsMode, setEditPinsMode] = useState(false);
  const [selectedUnpinnedSceneId, setSelectedUnpinnedSceneId] = useState<string | null>(null);
  const [draggingPin, setDraggingPin] = useState<DraggingPinState | null>(null);

  const pointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<PinchAnchor | null>(null);
  const suppressTapUntilRef = useRef<number>(0);

  const reachable = useMemo(
    () =>
      computeReachableSceneIds({
        scenes,
        connections,
        visited,
        currentSceneId,
        connectionState,
        revealed,
      }),
    [scenes, connections, visited, currentSceneId, connectionState, revealed]
  );

  // Measure viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [mapMode]);

  const fitMapToViewport = useCallback(() => {
    if (!activeMap) return;
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const vw = rect && rect.width > 0 ? rect.width : viewportSize.width;
    const vh = rect && rect.height > 0 ? rect.height : viewportSize.height;
    setTransform(
      fitBounds(
        { minX: 0, minY: 0, maxX: activeMap.width, maxY: activeMap.height },
        vw,
        vh,
        12,
        MIN_ZOOM,
        MAX_ZOOM,
        1
      )
    );
  }, [activeMap, viewportSize.height, viewportSize.width]);

  // Fit when active map changes
  useEffect(() => {
    fitMapToViewport();
  }, [activeMap?.id, fitMapToViewport]);

  // Follow current scene: pan map to current scene's pin when scene changes
  useEffect(() => {
    if (!activeMap || !currentSceneId) return;
    const pin = pins[currentSceneId];
    if (!pin || pin.mapId !== activeMap.id) return;
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const vw = rect && rect.width > 0 ? rect.width : viewportSize.width;
    const vh = rect && rect.height > 0 ? rect.height : viewportSize.height;
    const worldX = (pin.xPct / 100) * activeMap.width;
    const worldY = (pin.yPct / 100) * activeMap.height;
    setTransform((prev) => ({
      ...prev,
      x: vw / 2 - worldX * prev.scale,
      y: vh / 2 - worldY * prev.scale,
    }));
  }, [activeMap?.id, currentSceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapPins = useMemo(() => {
    if (!activeMap) return [];
    return scenes
      .filter((s) => pins[s.id]?.mapId === activeMap.id)
      .map((s) => {
        const pin = pins[s.id];
        const visibility = getSceneVisibility({
          sceneId: s.id,
          soloMask,
          visited,
          currentSceneId,
          reachable,
        });
        return {
          scene: s,
          pin,
          visibility,
          isCurrent: s.id === currentSceneId,
          isVisited: Boolean(visited[s.id]),
          hasNotes: scenesWithNotes.has(s.id),
        };
      })
      .filter((entry) => entry.visibility !== 'hidden');
  }, [activeMap, currentSceneId, pins, reachable, scenes, scenesWithNotes, soloMask, visited]);

  const unpinnedScenes = useMemo(
    () => scenes.filter((s) => !pins[s.id]),
    [pins, scenes]
  );

  const zoomCenter = (factor: number) => {
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    setTransform((prev) => zoomAtPoint(prev, prev.scale * factor, vw / 2, vh / 2));
  };

  const clientToMapPct = (clientX: number, clientY: number): { xPct: number; yPct: number } | null => {
    if (!activeMap || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - transform.x) / transform.scale;
    const worldY = (localY - transform.y) / transform.scale;
    const xPct = Math.min(100, Math.max(0, (worldX / activeMap.width) * 100));
    const yPct = Math.min(100, Math.max(0, (worldY / activeMap.height) * 100));
    return { xPct, yPct };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPin) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore in jsdom
    }

    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2 && containerRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const rect = containerRef.current.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = { transform, midX, midY, dist };
      panStartRef.current = null;
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPin && activeMap && containerRef.current) {
      const coords = clientToMapPct(e.clientX, e.clientY);
      if (coords) {
        setDraggingPin((prev) => (prev ? { ...prev, ...coords } : null));
      }
      return;
    }

    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current && containerRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const rect = containerRef.current.getBoundingClientRect();
      const curMidX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const curMidY = (pts[0].y + pts[1].y) / 2 - rect.top;
      const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const anchor = pinchRef.current;
      setTransform(
        pinchTransform(
          anchor.transform,
          anchor.midX,
          anchor.midY,
          anchor.dist,
          curMidX,
          curMidY,
          curDist
        )
      );
      suppressTapUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
      return;
    }

    if (pointersRef.current.size === 1 && panStartRef.current) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const totalDist = Math.hypot(
        e.clientX - panStartRef.current.x,
        e.clientY - panStartRef.current.y
      );
      if (totalDist > PAN_THRESHOLD_PX) {
        panStartRef.current.moved = true;
        suppressTapUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
        setTransform((t) => panBy(t, dx, dy));
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPin && draggingPin.pointerId === e.pointerId && activeMap) {
      onSetScenePin(draggingPin.sceneId, {
        mapId: activeMap.id,
        xPct: draggingPin.xPct,
        yPct: draggingPin.yPct,
      });
      setDraggingPin(null);
      return;
    }

    const wasMoved = panStartRef.current?.moved ?? false;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
    }

    if (
      !wasMoved &&
      Date.now() > suppressTapUntilRef.current &&
      editPinsMode &&
      selectedUnpinnedSceneId &&
      activeMap
    ) {
      const coords = clientToMapPct(e.clientX, e.clientY);
      if (coords) {
        onSetScenePin(selectedUnpinnedSceneId, {
          mapId: activeMap.id,
          xPct: coords.xPct,
          yPct: coords.yPct,
        });
        setSelectedUnpinnedSceneId(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setTransform((t) => zoomAtPoint(t, t.scale * factor, fx, fy));
    } else {
      setTransform((t) => panBy(t, -e.deltaX, -e.deltaY));
    }
  };

  if (!activeMap) {
    return (
      <div
        data-testid="map-area-empty"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '16px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '13px',
        }}
      >
        <div>No map image yet.</div>
        {onOpenMapLibrary && (
          <button
            type="button"
            data-testid="map-area-open-library-btn"
            onClick={onOpenMapLibrary}
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--p2)',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Maps
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="map-area-viewport"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--mapBg)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Transformed map + pins layer */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${activeMap.width}px`,
          height: `${activeMap.height}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={activeMap.name}
            draggable={false}
            data-testid="map-area-image"
            style={{
              display: 'block',
              width: `${activeMap.width}px`,
              height: `${activeMap.height}px`,
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div
            style={{
              width: `${activeMap.width}px`,
              height: `${activeMap.height}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              border: '1px dashed var(--line2)',
            }}
          >
            {activeMap.name}
          </div>
        )}

        {/* Scene pins */}
        {mapPins.map(({ scene, pin, visibility, isCurrent, isVisited, hasNotes }) => {
          const effectiveXPct =
            draggingPin?.sceneId === scene.id ? draggingPin.xPct : pin.xPct;
          const effectiveYPct =
            draggingPin?.sceneId === scene.id ? draggingPin.yPct : pin.yPct;

          const isMasked = visibility === 'masked';
          const label = isMasked && soloMask ? '?' : scene.code || scene.title.slice(0, 3);

          const bg = isCurrent
            ? 'var(--accent)'
            : isVisited
              ? 'var(--p3)'
              : 'var(--p2)';
          const border = isCurrent
            ? '2px solid var(--accent)'
            : isVisited
              ? '2px solid var(--edge)'
              : '2px solid var(--violet)';
          const color = isCurrent ? 'var(--onAccent)' : 'var(--text)';

          return (
            <button
              key={scene.id}
              type="button"
              data-testid={`map-pin-${scene.id}`}
              aria-label={isMasked ? 'Unknown scene pin' : `Scene ${scene.title}`}
              className={isCurrent ? 'gm-node-current' : undefined}
              onPointerDown={(e) => {
                if (!editPinsMode) return;
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore in jsdom
                }
                setDraggingPin({
                  sceneId: scene.id,
                  pointerId: e.pointerId,
                  xPct: pin.xPct,
                  yPct: pin.yPct,
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (editPinsMode) return;
                if (Date.now() < suppressTapUntilRef.current) return;
                onSelectScene(scene.id);
              }}
              style={{
                position: 'absolute',
                left: `${(effectiveXPct / 100) * activeMap.width}px`,
                top: `${(effectiveYPct / 100) * activeMap.height}px`,
                transform: 'translate(-50%, -50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border,
                background: bg,
                color,
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: editPinsMode ? 'grab' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                padding: 0,
              }}
            >
              <span>{label}</span>
              {hasNotes && (
                <span
                  data-testid={`map-pin-note-dot-${scene.id}`}
                  aria-label="Scene has table notes"
                  style={{
                    position: 'absolute',
                    top: '0px',
                    right: '0px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--gold)',
                    border: '2px solid var(--bg)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Top-left: map label & Edit pins toggle */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: 'calc(100% - 76px)',
          zIndex: 3,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '8px',
            background: 'rgba(15, 17, 23, 0.78)',
            color: '#f3f5fa',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {activeMap.name}
          {activeMap.scale ? ` · ${activeMap.scale}` : ''}
        </span>

        {mapMode !== 'pip' && (
          <button
            type="button"
            data-testid="map-edit-pins-btn"
            aria-pressed={editPinsMode}
            onClick={() => {
              setEditPinsMode((v) => !v);
              setSelectedUnpinnedSceneId(null);
            }}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: editPinsMode ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: editPinsMode ? 'var(--accent)' : 'var(--p2)',
              color: editPinsMode ? 'var(--onAccent)' : 'var(--text)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {editPinsMode ? 'Done editing' : 'Edit pins'}
          </button>
        )}
      </div>

      {/* Edit pins unpinned scenes bar */}
      {editPinsMode && mapMode !== 'pip' && (
        <div
          data-testid="map-unpinned-bar"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: '10px',
            right: '64px',
            top: '52px',
            zIndex: 3,
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            padding: '8px',
            borderRadius: '10px',
            background: 'var(--panel)',
            border: '1px solid var(--line2)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
            maxHeight: '110px',
            overflowY: 'auto',
          }}
        >
          {unpinnedScenes.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              All scenes are pinned. Drag any pin to move it.
            </span>
          ) : (
            <>
              <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center' }}>
                {selectedUnpinnedSceneId ? 'Tap map to place:' : 'Tap scene to pin:'}
              </span>
              {unpinnedScenes.map((s) => {
                const selected = selectedUnpinnedSceneId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`map-unpinned-scene-${s.id}`}
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedUnpinnedSceneId(selected ? null : s.id)
                    }
                    style={{
                      height: '32px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: selected ? '1px solid var(--accent)' : '1px solid var(--line)',
                      background: selected ? 'var(--accentBg)' : 'var(--p2)',
                      color: selected ? 'var(--accent)' : 'var(--text)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {s.code} · {s.title}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Top-right zoom controls (+, -, FIT) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          zIndex: 3,
        }}
      >
        <button
          type="button"
          data-testid="map-zoom-in-btn"
          aria-label="Zoom in map"
          onClick={() => zoomCenter(ZOOM_STEP)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
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
          data-testid="map-zoom-out-btn"
          aria-label="Zoom out map"
          onClick={() => zoomCenter(1 / ZOOM_STEP)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontSize: '18px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          −
        </button>
        <button
          type="button"
          data-testid="map-zoom-fit-btn"
          aria-label="Fit map"
          onClick={fitMapToViewport}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          FIT
        </button>
      </div>

      {/* Bottom-left zoom caption */}
      {mapMode !== 'pip' && (
        <div
          style={{
            position: 'absolute',
            left: '10px',
            bottom: '10px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: 'rgba(15, 17, 23, 0.72)',
            color: '#c7cede',
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            pointerEvents: 'none',
          }}
        >
          Pinch to zoom · drag to move · {formatZoomPercent(transform.scale)}
        </div>
      )}
    </div>
  );
};
