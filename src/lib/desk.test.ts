import { describe, expect, it } from 'vitest';
import {
  bringCardToFront,
  clampDeskCardSize,
  computeDeskCardsBounds,
  computeDeskPdfRenderWidth,
  computeStandardDeskLayout,
  DESK_CARD_CATALOG,
  DESK_CARD_HEADER_HEIGHT,
  DESK_MIN_CARD_HEIGHT,
  DESK_MIN_CARD_WIDTH,
  ensureDeskState,
  fitAllDeskCards,
  isDeskCardTargetMissing,
  isDeskCardVisibleInViewport,
  resizeDeskCardFromCorner,
  restoreFreeRects,
  snapshotFreeRects,
  snapToDeskGrid,
} from './desk';
import { mergeParsedChunks, parseModuleChunk } from './import';
import { createDefaultLiveState, type DeskCardRecord } from '../storage/types';
import sampleJson from '../../samples/silent-relay-a1.json';

function makeCard(overrides: Partial<DeskCardRecord> = {}): DeskCardRecord {
  return {
    id: 'card-1',
    type: 'scene',
    title: 'Scene 1',
    x: 100,
    y: 120,
    width: 400,
    height: 300,
    z: 1,
    minimized: false,
    createdAt: 1000,
    ...overrides,
  };
}

describe('desk pure helpers', () => {
  it('snaps coordinates to 24px grid when enabled and rounds when disabled', () => {
    expect(snapToDeskGrid(35, 24, false)).toBe(35);
    expect(snapToDeskGrid(35.6, 24, false)).toBe(36);
    expect(snapToDeskGrid(35, 24, true)).toBe(24);
    expect(snapToDeskGrid(37, 24, true)).toBe(48);
    expect(snapToDeskGrid(-13, 24, true)).toBe(-24);
  });

  it('clamps card dimensions to minimum and maximum bounds', () => {
    expect(clampDeskCardSize(120, 80)).toEqual({
      width: DESK_MIN_CARD_WIDTH,
      height: DESK_MIN_CARD_HEIGHT,
    });
    expect(clampDeskCardSize(480, 360)).toEqual({ width: 480, height: 360 });
  });

  it('resizes cards from all 4 corners while anchoring the opposite corner and enforcing minimums', () => {
    const base = { x: 100, y: 100, width: 300, height: 240 };

    const se = resizeDeskCardFromCorner(base, 'se', 50, 40, false);
    expect(se).toEqual({ x: 100, y: 100, width: 350, height: 280 });

    const nwClamped = resizeDeskCardFromCorner(base, 'nw', 200, 200, false);
    expect(nwClamped.width).toBe(DESK_MIN_CARD_WIDTH);
    expect(nwClamped.height).toBe(DESK_MIN_CARD_HEIGHT);
    // Bottom-right corner remains anchored at (400, 340)
    expect(nwClamped.x + nwClamped.width).toBe(400);
    expect(nwClamped.y + nwClamped.height).toBe(340);

    const swSnapped = resizeDeskCardFromCorner(base, 'sw', -19, 25, true, 24);
    expect(swSnapped.x % 24).toBe(0);
    expect((swSnapped.y + swSnapped.height) % 24).toBe(0);

    const ne = resizeDeskCardFromCorner(base, 'ne', 40, -30, false);
    expect(ne).toEqual({ x: 100, y: 70, width: 340, height: 270 });
  });

  it('brings target card to front and normalizes z-indices 1..N', () => {
    const cards: DeskCardRecord[] = [
      makeCard({ id: 'a', z: 2, createdAt: 1 }),
      makeCard({ id: 'b', z: 5, createdAt: 2 }),
      makeCard({ id: 'c', z: 9, createdAt: 3 }),
    ];
    const reordered = bringCardToFront(cards, 'a');
    const byId = Object.fromEntries(reordered.map((c) => [c.id, c.z]));
    expect(byId).toEqual({ b: 1, c: 2, a: 3 });
  });

  it('computes bounding boxes and fit-all transform respecting minimized cards', () => {
    const cards: DeskCardRecord[] = [
      makeCard({ id: 'a', x: 50, y: 60, width: 300, height: 400, minimized: false }),
      makeCard({ id: 'b', x: 500, y: 200, width: 400, height: 500, minimized: true }),
    ];
    const bounds = computeDeskCardsBounds(cards);
    expect(bounds).toEqual({
      minX: 50,
      minY: 60,
      maxX: 900,
      maxY: 460, // card b is minimized so its bottom is 200 + 44 = 244 < 460
    });
    expect(DESK_CARD_HEADER_HEIGHT).toBe(44);

    const fit = fitAllDeskCards(cards, 1200, 800, 48);
    expect(fit.scale).toBeGreaterThan(0.25);
    expect(fit.scale).toBeLessThanOrEqual(1);
  });

  it('detects cards whose target data is missing or deleted without throwing', () => {
    const parsed = parseModuleChunk(JSON.stringify(sampleJson));
    const merged = mergeParsedChunks([parsed]);
    const live = createDefaultLiveState('camp-1');

    const validSceneId = merged.scenes[0].id;
    const validSceneCard = makeCard({
      type: 'scene',
      targetId: validSceneId,
    });
    expect(isDeskCardTargetMissing(validSceneCard, merged, live)).toBe(false);

    const missingSceneCard = makeCard({
      type: 'scene',
      targetId: 'scene-does-not-exist',
    });
    expect(isDeskCardTargetMissing(missingSceneCard, merged, live)).toBe(true);

    // Deleting the scene in live layer also flags the card
    const liveWithDeleted = {
      ...live,
      deletedSceneIds: [validSceneId],
    };
    expect(isDeskCardTargetMissing(validSceneCard, merged, liveWithDeleted)).toBe(true);

    const missingEntityCard = makeCard({
      type: 'sheet',
      targetId: 'npc-ghost',
    });
    expect(isDeskCardTargetMissing(missingEntityCard, merged, live)).toBe(true);

    expect(DESK_CARD_CATALOG.some((item) => item.type === 'map')).toBe(true);
    const liveWithMap = {
      ...live,
      maps: [
        {
          id: 'map-1',
          name: 'Deck A',
          blobKey: 'map:camp-1:map-1',
          width: 800,
          height: 600,
        },
      ],
    };
    expect(
      isDeskCardTargetMissing(makeCard({ type: 'map', targetId: 'map-1' }), merged, liveWithMap)
    ).toBe(false);
    expect(
      isDeskCardTargetMissing(makeCard({ type: 'map', targetId: 'map-deleted' }), merged, liveWithMap)
    ).toBe(true);

    const safeDefaultDesk = ensureDeskState(undefined);
    expect(safeDefaultDesk.viewMode).toBe('structured');
    expect(safeDefaultDesk.linkOpenMode).toBe('in-place');
    expect(safeDefaultDesk.cards).toEqual([]);
    expect(
      ensureDeskState({ ...safeDefaultDesk, linkOpenMode: 'new-card' }).linkOpenMode
    ).toBe('new-card');
  });

  it('determines viewport visibility for off-screen and minimized cards', () => {
    const vp = { x: 0, y: 0, scale: 1 };
    const visibleCard = makeCard({ x: 100, y: 100, width: 400, height: 300 });
    expect(isDeskCardVisibleInViewport(visibleCard, vp, 1180, 720)).toBe(true);

    const minimizedCard = makeCard({ x: 100, y: 100, width: 400, height: 300, minimized: true });
    expect(isDeskCardVisibleInViewport(minimizedCard, vp, 1180, 720)).toBe(false);

    const farRightCard = makeCard({ x: 2500, y: 100, width: 400, height: 300 });
    expect(isDeskCardVisibleInViewport(farRightCard, vp, 1180, 720)).toBe(false);

    // Panning left brings farRightCard into view
    expect(
      isDeskCardVisibleInViewport(farRightCard, { x: -1800, y: 0, scale: 1 }, 1180, 720)
    ).toBe(true);

    // Zooming out to 0.4x brings x=2500 (screen x=1000) into view
    expect(
      isDeskCardVisibleInViewport(farRightCard, { x: 0, y: 0, scale: 0.4 }, 1180, 720)
    ).toBe(true);
  });

  it('computes zoom-matched PDF render widths quantized to 24px steps and clamped', () => {
    // 480 - 28 = 452 * 1 = 452 -> rounded to 24px step = 456
    expect(computeDeskPdfRenderWidth(480, 1)).toBe(456);
    // Zoomed out to 0.25x clamps to minPx=180
    expect(computeDeskPdfRenderWidth(480, 0.25)).toBe(180);
    // Zoomed in to 3x: 452 * 3 = 1356 -> rounded to 24px step = 1368
    expect(computeDeskPdfRenderWidth(480, 3)).toBe(1368);
    // Huge card at 3x clamps to maxPx=1400
    expect(computeDeskPdfRenderWidth(1200, 3)).toBe(1400);
  });

  it('arranges Standard layout with Follow current scene centered and zero overlaps', () => {
    const cards: DeskCardRecord[] = [
      makeCard({ id: 'list', type: 'scene-list', x: 10, y: 10, width: 300, height: 300, createdAt: 1 }),
      makeCard({ id: 'pinned', type: 'scene', followCurrentScene: false, x: 20, y: 20, width: 400, height: 300, createdAt: 2 }),
      makeCard({ id: 'follow', type: 'scene', followCurrentScene: true, x: 30, y: 30, width: 420, height: 320, createdAt: 3 }),
      makeCard({ id: 'clocks', type: 'clocks', x: 40, y: 40, width: 320, height: 280, createdAt: 4 }),
      makeCard({ id: 'tracker', type: 'tracker', x: 50, y: 50, width: 280, height: 180, createdAt: 5 }),
      makeCard({ id: 'notes', type: 'notes', x: 60, y: 60, width: 300, height: 300, createdAt: 6 }),
    ];

    const arranged = computeStandardDeskLayout(cards);
    const byId = new Map(arranged.map((c) => [c.id, c]));

    const follow = byId.get('follow')!;
    const pinned = byId.get('pinned')!;
    const list = byId.get('list')!;
    const clocks = byId.get('clocks')!;

    // Follow scene is placed at the top of the center column, between left and right columns
    expect(follow.x).toBeGreaterThan(list.x);
    expect(follow.x).toBeLessThan(clocks.x);
    expect(follow.y).toBe(48);
    expect(pinned.x).toBe(follow.x);
    expect(pinned.y).toBeGreaterThanOrEqual(follow.y + follow.height + 24);

    // Zero pairwise overlaps
    for (let i = 0; i < arranged.length; i++) {
      for (let j = i + 1; j < arranged.length; j++) {
        const a = arranged[i];
        const b = arranged[j];
        const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapsX && overlapsY).toBe(false);
      }
    }
  });

  it('snapshots and restores exact Free positions and sizes across Standard round-trip', () => {
    const original: DeskCardRecord[] = [
      makeCard({ id: 'c1', type: 'scene', followCurrentScene: true, x: 111, y: 222, width: 533, height: 444 }),
      makeCard({ id: 'c2', type: 'tracker', x: 777, y: 88, width: 290, height: 196 }),
    ];

    const saved = snapshotFreeRects(original);
    const standard = computeStandardDeskLayout(original);
    expect(standard[0].x).not.toBe(111);
    expect(standard[1].x).not.toBe(777);

    const restored = restoreFreeRects(standard, saved);
    expect(restored[0]).toMatchObject({ x: 111, y: 222, width: 533, height: 444 });
    expect(restored[1]).toMatchObject({ x: 777, y: 88, width: 290, height: 196 });

    // ensureDeskState sanitizes savedFreeRects and handles old saves without it
    const ensured = ensureDeskState({
      viewMode: 'desk',
      layoutMode: 'standard',
      snapToGrid: false,
      gridSize: 24,
      viewport: { x: 0, y: 0, scale: 1 },
      cards: standard,
      savedFreeRects: saved,
    });
    expect(ensured.layoutMode).toBe('standard');
    expect(ensured.savedFreeRects?.c1).toEqual({ x: 111, y: 222, width: 533, height: 444 });
    expect(ensureDeskState(undefined).savedFreeRects).toEqual({});
  });
});
