import { describe, expect, it } from 'vitest';
import {
  clampScale,
  computeFitScale,
  fitBounds,
  formatZoomPercent,
  MAP_MIN_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  pinchTransform,
  zoomAtPoint,
} from './panzoom';

describe('panzoom', () => {
  it('clamps zoom scale between 40% and 300% by default and supports custom min/max', () => {
    expect(clampScale(0.1)).toBe(MIN_ZOOM);
    expect(clampScale(0.4)).toBe(0.4);
    expect(clampScale(0.1, MAP_MIN_ZOOM, MAX_ZOOM)).toBe(0.25);
    expect(clampScale(1.5)).toBe(1.5);
    expect(clampScale(4.5)).toBe(MAX_ZOOM);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('pans by delta without changing scale', () => {
    expect(panBy({ x: 10, y: -20, scale: 1.25 }, 15, 30)).toEqual({
      x: 25,
      y: 10,
      scale: 1.25,
    });
  });

  it('zooms around a focal point keeping that world point stationary', () => {
    const start = { x: 40, y: 20, scale: 1 };
    const focalX = 140;
    const focalY = 120;
    const worldX = (focalX - start.x) / start.scale; // 100
    const worldY = (focalY - start.y) / start.scale; // 100

    const zoomed = zoomAtPoint(start, 2, focalX, focalY);
    expect(zoomed.scale).toBe(2);
    expect((focalX - zoomed.x) / zoomed.scale).toBeCloseTo(worldX, 6);
    expect((focalY - zoomed.y) / zoomed.scale).toBeCloseTo(worldY, 6);
  });

  it('clamps zoomAtPoint at min and max bounds without losing focal point', () => {
    const start = { x: 0, y: 0, scale: 1 };
    const over = zoomAtPoint(start, 10, 100, 50);
    expect(over.scale).toBe(MAX_ZOOM);
    expect((100 - over.x) / over.scale).toBeCloseTo(100, 6);

    const under = zoomAtPoint(start, 0.05, 100, 50);
    expect(under.scale).toBe(MIN_ZOOM);
    expect((100 - under.x) / under.scale).toBeCloseTo(100, 6);
  });

  it('computes two-finger pinch around moving midpoint', () => {
    const start = { x: 0, y: 0, scale: 1 };
    const next = pinchTransform(start, 100, 100, 50, 120, 110, 100);
    expect(next.scale).toBe(2);
    // World point (100, 100) should now sit at (120, 110)
    expect(100 * next.scale + next.x).toBeCloseTo(120, 6);
    expect(100 * next.scale + next.y).toBeCloseTo(110, 6);
  });

  it('fits bounds inside viewport and centers them', () => {
    const t = fitBounds(
      { minX: 0, minY: 0, maxX: 600, maxY: 400 },
      348,
      440,
      24
    );
    // Available width 300 / 600 = 0.5, height 392 / 400 = 0.98 -> scale 0.5
    expect(t.scale).toBeCloseTo(0.5, 6);
    // Center of bounds (300, 200) maps to (174, 220)
    expect(300 * t.scale + t.x).toBeCloseTo(174, 6);
    expect(200 * t.scale + t.y).toBeCloseTo(220, 6);
  });

  it('formats zoom percentage and supports fit-relative base scale', () => {
    expect(formatZoomPercent(1)).toBe('100%');
    expect(formatZoomPercent(1.246)).toBe('125%');
    const fitScale = computeFitScale({ minX: 0, minY: 0, maxX: 2000, maxY: 1500 }, 480, 320, 12);
    expect(fitScale).toBeCloseTo(296 / 1500, 6);
    expect(formatZoomPercent(fitScale, fitScale)).toBe('100%');
    expect(formatZoomPercent(fitScale * 0.25, fitScale)).toBe('25%');
  });
});
