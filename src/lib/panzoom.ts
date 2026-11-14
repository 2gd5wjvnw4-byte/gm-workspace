export interface PanZoomTransform {
  x: number;
  y: number;
  scale: number;
}

export interface PanZoomBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3.0;
export const ZOOM_STEP = 1.25;
export const PAN_THRESHOLD_PX = 6;
export const TAP_SUPPRESS_MS = 80;

export function clampScale(
  scale: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM
): number {
  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.min(max, Math.max(min, scale));
}

export function panBy(
  transform: PanZoomTransform,
  dx: number,
  dy: number
): PanZoomTransform {
  return {
    x: transform.x + dx,
    y: transform.y + dy,
    scale: transform.scale,
  };
}

export function zoomAtPoint(
  transform: PanZoomTransform,
  nextScale: number,
  focalX: number,
  focalY: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM
): PanZoomTransform {
  const clamped = clampScale(nextScale, min, max);
  const safeScale = transform.scale > 0 ? transform.scale : 1;
  const worldX = (focalX - transform.x) / safeScale;
  const worldY = (focalY - transform.y) / safeScale;
  return {
    x: focalX - worldX * clamped,
    y: focalY - worldY * clamped,
    scale: clamped,
  };
}

export function pinchTransform(
  startTransform: PanZoomTransform,
  startMidX: number,
  startMidY: number,
  startDist: number,
  curMidX: number,
  curMidY: number,
  curDist: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM
): PanZoomTransform {
  if (startDist <= 0 || curDist <= 0) {
    return {
      x: startTransform.x + (curMidX - startMidX),
      y: startTransform.y + (curMidY - startMidY),
      scale: clampScale(startTransform.scale, min, max),
    };
  }
  const safeStartScale = startTransform.scale > 0 ? startTransform.scale : 1;
  const ratio = curDist / startDist;
  const nextScale = clampScale(safeStartScale * ratio, min, max);
  const worldX = (startMidX - startTransform.x) / safeStartScale;
  const worldY = (startMidY - startTransform.y) / safeStartScale;
  return {
    x: curMidX - worldX * nextScale,
    y: curMidY - worldY * nextScale,
    scale: nextScale,
  };
}

export function fitBounds(
  bounds: PanZoomBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 24,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
  maxFitScale = 1
): PanZoomTransform {
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availWidth = Math.max(1, viewportWidth - padding * 2);
  const availHeight = Math.max(1, viewportHeight - padding * 2);

  const rawScale = Math.min(availWidth / contentWidth, availHeight / contentHeight);
  const scale = clampScale(Math.min(maxFitScale, rawScale), min, max);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: viewportWidth / 2 - centerX * scale,
    y: viewportHeight / 2 - centerY * scale,
    scale,
  };
}

export function formatZoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
