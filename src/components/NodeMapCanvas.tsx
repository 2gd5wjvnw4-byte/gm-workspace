import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildNodeMapGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
  type NodeMapNode,
  type NodePosition,
} from '../lib/nodeMap';
import {
  fitBounds,
  formatZoomPercent,
  PAN_THRESHOLD_PX,
  panBy,
  type PanZoomTransform,
  pinchTransform,
  TAP_SUPPRESS_MS,
  ZOOM_STEP,
  zoomAtPoint,
} from '../lib/panzoom';
import type {
  ModuleConnection,
  ModuleScene,
} from '../lib/import/types';
import type { ConnectionOverrideState } from '../storage/types';

export const LONG_PRESS_MS = 500;

export interface NodeMapCanvasProps {
  scenes: ModuleScene[];
  connections: ModuleConnection[];
  notLoadedTargets: Set<string>;
  currentSceneId: string | null;
  visited: Record<string, boolean>;
  revealed: Record<string, boolean>;
  connectionState: Record<string, ConnectionOverrideState>;
  soloMask: boolean;
  nodePositions: Record<string, NodePosition>;
  onSelectScene: (sceneId: string) => void;
  onMoveNode: (sceneId: string, pos: NodePosition) => void;
  onResetLayout: (sceneIds: string[]) => void;
  expanded?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  onAddNode?: () => void;
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

interface DraggingNodeState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

interface PendingLongPress {
  nodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_VIEWPORT = { width: 320, height: 440 };

export const NodeMapCanvas: React.FC<NodeMapCanvasProps> = ({
  scenes,
  connections,
  notLoadedTargets,
  currentSceneId,
  visited,
  revealed,
  connectionState,
  soloMask,
  nodePositions,
  onSelectScene,
  onMoveNode,
  onResetLayout,
  expanded = false,
  onExpand,
  onClose,
  onAddNode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [draggingNode, setDraggingNode] = useState<DraggingNodeState | null>(null);

  const graph = useMemo(
    () =>
      buildNodeMapGraph({
        scenes,
        connections,
        notLoadedTargets,
        currentSceneId,
        visited,
        revealed,
        connectionState,
        soloMask,
        nodePositions,
      }),
    [
      scenes,
      connections,
      notLoadedTargets,
      currentSceneId,
      visited,
      revealed,
      connectionState,
      soloMask,
      nodePositions,
    ]
  );

  const getViewportSize = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return DEFAULT_VIEWPORT;
  }, []);

  const [transform, setTransform] = useState<PanZoomTransform>(() =>
    fitBounds(graph.bounds, DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height)
  );

  const handleFit = useCallback(() => {
    const vp = getViewportSize();
    setTransform(fitBounds(graph.bounds, vp.width, vp.height));
  }, [getViewportSize, graph.bounds]);

  // Re-fit when switching acts, toggling expanded mode, or resetting layout
  const lastActRef = useRef<string | null>(graph.actId);
  const lastExpandedRef = useRef<boolean>(expanded);
  const didInitialFitRef = useRef(false);
  const resetPendingFitRef = useRef(false);

  useEffect(() => {
    if (
      !didInitialFitRef.current ||
      lastActRef.current !== graph.actId ||
      lastExpandedRef.current !== expanded ||
      resetPendingFitRef.current
    ) {
      didInitialFitRef.current = true;
      lastActRef.current = graph.actId;
      lastExpandedRef.current = expanded;
      resetPendingFitRef.current = false;
      const vp = getViewportSize();
      setTransform(fitBounds(graph.bounds, vp.width, vp.height));
    }
  }, [expanded, getViewportSize, graph.actId, graph.bounds]);

  // Pointer gesture tracking
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
  const suppressClickUntilRef = useRef<number>(0);
  const pendingLongPressRef = useRef<PendingLongPress | null>(null);

  const clearPendingLongPress = useCallback(() => {
    if (pendingLongPressRef.current) {
      clearTimeout(pendingLongPressRef.current.timer);
      pendingLongPressRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingLongPress();
    };
  }, [clearPendingLongPress]);

  const toLocalCoords = (clientX: number, clientY: number): ActivePointer => {
    const safeX = Number.isFinite(clientX) ? clientX : 0;
    const safeY = Number.isFinite(clientY) ? clientY : 0;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: safeX, y: safeY };
    }
    return { x: safeX - rect.left, y: safeY - rect.top };
  };

  const computeTwoPointerMetrics = (pts: ActivePointer[]) => {
    const [a, b] = pts;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    return { midX, midY, dist };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on overlay toolbar buttons
    if ((e.target as HTMLElement).closest('[data-nodemap-control="true"]')) {
      return;
    }
    const local = toLocalCoords(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, local);

    if (pointersRef.current.size === 1) {
      pinchAnchorRef.current = null;
      singleAnchorRef.current = {
        pointerId: e.pointerId,
        startX: local.x,
        startY: local.y,
        lastX: local.x,
        lastY: local.y,
        moved: false,
      };
    } else if (pointersRef.current.size === 2) {
      clearPendingLongPress();
      setDraggingNode(null);
      singleAnchorRef.current = null;
      const metrics = computeTwoPointerMetrics(Array.from(pointersRef.current.values()));
      pinchAnchorRef.current = {
        transform,
        midX: metrics.midX,
        midY: metrics.midY,
        dist: metrics.dist,
      };
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const safeClientX = Number.isFinite(e.clientX) ? e.clientX : 0;
    const safeClientY = Number.isFinite(e.clientY) ? e.clientY : 0;

    // Handle active node drag in Arrange mode
    if (draggingNode && draggingNode.pointerId === e.pointerId) {
      const dx = (safeClientX - draggingNode.startClientX) / transform.scale;
      const dy = (safeClientY - draggingNode.startClientY) / transform.scale;
      setDraggingNode((prev) =>
        prev
          ? {
              ...prev,
              currentX: Math.round(prev.originX + dx),
              currentY: Math.round(prev.originY + dy),
            }
          : null
      );
      return;
    }

    // Cancel pending long-press if finger moves > 6px before 500ms
    if (pendingLongPressRef.current && pendingLongPressRef.current.pointerId === e.pointerId) {
      const dist = Math.hypot(
        safeClientX - pendingLongPressRef.current.startClientX,
        safeClientY - pendingLongPressRef.current.startClientY
      );
      if (dist > PAN_THRESHOLD_PX) {
        clearPendingLongPress();
      } else {
        // Still holding steady for long-press; don't pan yet
        return;
      }
    }

    if (!pointersRef.current.has(e.pointerId)) {
      return;
    }
    const local = toLocalCoords(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, local);

    if (pointersRef.current.size === 2 && pinchAnchorRef.current) {
      const metrics = computeTwoPointerMetrics(Array.from(pointersRef.current.values()));
      const anchor = pinchAnchorRef.current;
      setTransform(
        pinchTransform(
          anchor.transform,
          anchor.midX,
          anchor.midY,
          anchor.dist,
          metrics.midX,
          metrics.midY,
          metrics.dist
        )
      );
      suppressClickUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
      return;
    }

    if (
      pointersRef.current.size === 1 &&
      singleAnchorRef.current &&
      singleAnchorRef.current.pointerId === e.pointerId
    ) {
      const anchor = singleAnchorRef.current;
      if (!anchor.moved) {
        const distFromStart = Math.hypot(
          local.x - anchor.startX,
          local.y - anchor.startY
        );
        if (distFromStart <= PAN_THRESHOLD_PX) {
          return;
        }
        anchor.moved = true;
        // Pan from start position on the frame threshold is crossed
        const dx = local.x - anchor.lastX;
        const dy = local.y - anchor.lastY;
        anchor.lastX = local.x;
        anchor.lastY = local.y;
        setTransform((prev) => panBy(prev, dx, dy));
        suppressClickUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
        return;
      }

      const dx = local.x - anchor.lastX;
      const dy = local.y - anchor.lastY;
      anchor.lastX = local.x;
      anchor.lastY = local.y;
      setTransform((prev) => panBy(prev, dx, dy));
      suppressClickUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      pendingLongPressRef.current &&
      pendingLongPressRef.current.pointerId === e.pointerId
    ) {
      clearPendingLongPress();
    }

    if (draggingNode && draggingNode.pointerId === e.pointerId) {
      onMoveNode(draggingNode.id, {
        x: draggingNode.currentX,
        y: draggingNode.currentY,
      });
      setDraggingNode(null);
      suppressClickUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
      pointersRef.current.delete(e.pointerId);
      singleAnchorRef.current = null;
      return;
    }

    if (singleAnchorRef.current?.moved || pinchAnchorRef.current) {
      suppressClickUntilRef.current = Date.now() + TAP_SUPPRESS_MS;
    }

    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 1) {
      const [remId, remPos] = Array.from(pointersRef.current.entries())[0];
      pinchAnchorRef.current = null;
      singleAnchorRef.current = {
        pointerId: remId,
        startX: remPos.x,
        startY: remPos.y,
        lastX: remPos.x,
        lastY: remPos.y,
        moved: true,
      };
    } else if (pointersRef.current.size === 0) {
      singleAnchorRef.current = null;
      pinchAnchorRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const local = toLocalCoords(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.01);
      setTransform((prev) =>
        zoomAtPoint(prev, prev.scale * factor, local.x, local.y)
      );
    } else {
      setTransform((prev) => panBy(prev, -e.deltaX, -e.deltaY));
    }
  };

  const handleZoomButton = (direction: 1 | -1) => {
    const vp = getViewportSize();
    const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    setTransform((prev) =>
      zoomAtPoint(prev, prev.scale * factor, vp.width / 2, vp.height / 2)
    );
  };

  const handleNodePointerDown = (
    node: NodeMapNode,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!arrangeMode || node.notLoaded) {
      return;
    }
    clearPendingLongPress();
    const pointerId = e.pointerId;
    const startClientX = Number.isFinite(e.clientX) ? e.clientX : 0;
    const startClientY = Number.isFinite(e.clientY) ? e.clientY : 0;
    const originX = node.x;
    const originY = node.y;

    const timer = setTimeout(() => {
      pendingLongPressRef.current = null;
      singleAnchorRef.current = null;
      setDraggingNode({
        id: node.id,
        pointerId,
        startClientX,
        startClientY,
        originX,
        originY,
        currentX: originX,
        currentY: originY,
      });
    }, LONG_PRESS_MS);

    pendingLongPressRef.current = {
      nodeId: node.id,
      pointerId,
      startClientX,
      startClientY,
      originX,
      originY,
      timer,
    };
  };

  const handleNodeClick = (node: NodeMapNode) => {
    if (node.notLoaded) {
      return;
    }
    if (Date.now() < suppressClickUntilRef.current) {
      return;
    }
    onSelectScene(node.id);
  };

  // Apply live drag coordinates so edges follow the dragged node smoothly
  const displayNodes = useMemo(() => {
    if (!draggingNode) {
      return graph.nodes;
    }
    return graph.nodes.map((n) =>
      n.id === draggingNode.id
        ? { ...n, x: draggingNode.currentX, y: draggingNode.currentY }
        : n
    );
  }, [draggingNode, graph.nodes]);

  const displayEdges = useMemo(() => {
    if (!draggingNode) {
      return graph.edges;
    }
    const byId = new Map(displayNodes.map((n) => [n.id, n]));
    return graph.edges.map((edge) => {
      const fromNode = byId.get(edge.from);
      const toNode = byId.get(edge.to);
      if (!fromNode || !toNode) {
        return edge;
      }
      return {
        ...edge,
        fromX: fromNode.x + NODE_WIDTH / 2,
        fromY: fromNode.y + NODE_HEIGHT / 2,
        toX: toNode.x + NODE_WIDTH / 2,
        toY: toNode.y + NODE_HEIGHT / 2,
      };
    });
  }, [displayNodes, draggingNode, graph.edges]);

  const getNodeStyle = (node: NodeMapNode): React.CSSProperties => {
    const isDragging = draggingNode?.id === node.id;
    const base: React.CSSProperties = {
      position: 'absolute',
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${NODE_WIDTH}px`,
      height: `${NODE_HEIGHT}px`,
      borderRadius: '10px',
      padding: '6px 8px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      textAlign: 'left',
      overflow: 'hidden',
      boxSizing: 'border-box',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none',
      cursor: node.notLoaded ? 'default' : arrangeMode ? 'grab' : 'pointer',
      zIndex: isDragging ? 10 : 2,
    };

    if (isDragging) {
      return {
        ...base,
        border: '2px solid var(--gold)',
        background: 'var(--p2)',
        color: 'var(--text)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
      };
    }

    if (node.status === 'current') {
      return {
        ...base,
        border: '2px solid var(--accent)',
        background: 'var(--accentBg)',
        color: 'var(--text)',
        animation: 'gmpulse 2s infinite',
      };
    }

    if (node.status === 'visited') {
      return {
        ...base,
        border: '1px solid var(--edge)',
        background: 'var(--p2)',
        color: 'var(--text)',
      };
    }

    if (node.status === 'not-loaded') {
      return {
        ...base,
        border: '1px dashed var(--line2)',
        background: 'transparent',
        color: 'var(--faint)',
      };
    }

    return {
      ...base,
      border: '1px dashed var(--line2)',
      background: 'var(--panel)',
      color: 'var(--text)',
    };
  };

  const controlButtonStyle: React.CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    padding: '0 10px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    background: 'var(--p2)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      ref={containerRef}
      data-testid={expanded ? 'node-map-canvas-expanded' : 'node-map-canvas'}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onWheel={handleWheel}
      style={{
        margin: expanded ? 0 : '0 12px 12px',
        height: expanded ? '100%' : '440px',
        width: expanded ? '100%' : undefined,
        position: 'relative',
        background: 'var(--mapBg)',
        border: expanded ? 'none' : '1px solid var(--line)',
        borderRadius: expanded ? 0 : '12px',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Transformed world layer */}
      <div
        data-testid="node-map-world"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        }}
      >
        <svg
          aria-hidden="true"
          width="1"
          height="1"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {displayEdges.map((edge) => (
            <line
              key={edge.id}
              data-testid={`node-edge-${edge.id}`}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              stroke={edge.solid ? 'var(--edge)' : 'var(--line2)'}
              strokeWidth={2}
              strokeDasharray={edge.solid ? undefined : '6 4'}
            />
          ))}
        </svg>

        {displayNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            data-testid={`map-node-${node.id}`}
            disabled={node.notLoaded}
            onPointerDown={(e) => handleNodePointerDown(node, e)}
            onClick={() => handleNodeClick(node)}
            style={getNodeStyle(node)}
          >
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: node.notLoaded ? 'var(--faint)' : 'var(--muted)',
                lineHeight: 1.1,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.code}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: 1.2,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.title}
            </span>
          </button>
        ))}
      </div>

      {/* Top-left Arrange & Reset layout controls */}
      <div
        data-nodemap-control="true"
        style={{
          position: 'absolute',
          left: '8px',
          top: '8px',
          display: 'flex',
          gap: '6px',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          aria-pressed={arrangeMode}
          onClick={() => {
            clearPendingLongPress();
            setDraggingNode(null);
            setArrangeMode((v) => !v);
          }}
          style={{
            ...controlButtonStyle,
            border: arrangeMode
              ? '1px solid var(--gold)'
              : '1px solid var(--line)',
            background: arrangeMode ? 'var(--goldBg)' : 'var(--p2)',
            color: arrangeMode ? 'var(--gold)' : 'var(--text)',
          }}
        >
          Arrange
        </button>

        {onAddNode && (
          <button
            type="button"
            data-testid="node-map-add-btn"
            onClick={onAddNode}
            style={{
              ...controlButtonStyle,
              border: '1px solid var(--accent)',
              background: 'var(--accentBg)',
              color: 'var(--accent)',
            }}
          >
            + Node
          </button>
        )}

        {arrangeMode && (
          <button
            type="button"
            onClick={() => {
              resetPendingFitRef.current = true;
              onResetLayout(graph.nodes.map((n) => n.id));
            }}
            style={controlButtonStyle}
          >
            Reset layout
          </button>
        )}
      </div>

      {/* Top-right Zoom (+, -, FIT) + Expand / Close controls */}
      <div
        data-nodemap-control="true"
        style={{
          position: 'absolute',
          right: '8px',
          top: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          zIndex: 20,
        }}
      >
        {expanded && onClose ? (
          <button
            type="button"
            aria-label="Close expanded node map"
            onClick={onClose}
            style={{
              ...controlButtonStyle,
              background: 'var(--p3)',
              fontSize: '11px',
            }}
          >
            Close
          </button>
        ) : (
          onExpand && (
            <button
              type="button"
              aria-label="Expand node map"
              onClick={onExpand}
              style={{
                ...controlButtonStyle,
                fontSize: '11px',
              }}
            >
              Expand
            </button>
          )
        )}

        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => handleZoomButton(1)}
          style={{ ...controlButtonStyle, width: '44px', fontSize: '20px', padding: 0 }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => handleZoomButton(-1)}
          style={{ ...controlButtonStyle, width: '44px', fontSize: '20px', padding: 0 }}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Fit to view"
          onClick={handleFit}
          style={{ ...controlButtonStyle, width: '44px', fontSize: '11px', padding: 0 }}
        >
          FIT
        </button>
      </div>

      {/* Bottom-left caption */}
      <div
        data-testid="node-map-caption"
        style={{
          position: 'absolute',
          left: '10px',
          bottom: '8px',
          fontSize: '11px',
          color: 'var(--muted)',
          background: 'var(--mapBg)',
          padding: '2px 6px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {arrangeMode
          ? `Hold node 500ms to move · ${formatZoomPercent(transform.scale)}`
          : `Pinch to zoom · drag to move · ${formatZoomPercent(transform.scale)}`}
      </div>
    </div>
  );
};
