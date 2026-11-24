import { describe, expect, it } from 'vitest';
import {
  addPlayerSheetTrack,
  addSheetOverlay,
  adjustPlayerSheetTrack,
  adjustSheetOverlayCounter,
  clampOverlayPct,
  createPrebuiltPlayerSheet,
  createSheetOverlay,
  getSheetOverlaysForPage,
  removePlayerSheetTrack,
  removeSheetOverlay,
  stripFileExtension,
  toggleSheetOverlayDot,
  updatePlayerSheetTrack,
  updateSheetOverlay,
  validateSheetUploadFile,
} from './playerSheets';

describe('playerSheets helpers', () => {
  it('validates image and pdf uploads and rejects unsupported types', () => {
    expect(validateSheetUploadFile({ name: 'aria.png', type: 'image/png' }, 'image')).toEqual({
      ok: true,
      kind: 'image',
      mimeType: 'image/png',
    });
    expect(validateSheetUploadFile({ name: 'aria.jpg', type: '' }, 'image')).toEqual({
      ok: true,
      kind: 'image',
      mimeType: 'image/jpeg',
    });
    expect(validateSheetUploadFile({ name: 'aria.webp', type: 'image/webp' }, 'image')).toEqual({
      ok: true,
      kind: 'image',
      mimeType: 'image/webp',
    });
    expect(validateSheetUploadFile({ name: 'sheet.pdf', type: 'application/pdf' }, 'pdf')).toEqual({
      ok: true,
      kind: 'pdf',
      mimeType: 'application/pdf',
    });

    const badImg = validateSheetUploadFile({ name: 'notes.txt', type: 'text/plain' }, 'image');
    expect(badImg.ok).toBe(false);

    const badPdf = validateSheetUploadFile({ name: 'aria.png', type: 'image/png' }, 'pdf');
    expect(badPdf.ok).toBe(false);

    const badAny = validateSheetUploadFile({ name: 'sheet.docx', type: 'application/msword' });
    expect(badAny.ok).toBe(false);
  });

  it('creates a prebuilt player sheet with clamped tracks', () => {
    const sheet = createPrebuiltPlayerSheet({
      id: 'pc-aria',
      name: '  Aria Voss  ',
      role: ' Pilot ',
      statLine: 'STR 10 · DEX 16 · INT 14',
      tracks: [
        { id: 'hp', label: 'HP', current: 18, max: 12 },
        { id: 'stress', label: 'Stress', current: -2, max: 6 },
        { label: '   ', max: 4 },
      ],
      notes: 'Owes Captain Wren a favor.',
      now: 1000,
    });

    expect(sheet.id).toBe('pc-aria');
    expect(sheet.kind).toBe('prebuilt');
    expect(sheet.name).toBe('Aria Voss');
    expect(sheet.role).toBe('Pilot');
    expect(sheet.tracks).toEqual([
      { id: 'hp', label: 'HP', current: 12, max: 12 },
      { id: 'stress', label: 'Stress', current: 0, max: 6 },
    ]);
  });

  it('adjusts, edits, adds, and removes tracks safely', () => {
    const initial = [
      { id: 'hp', label: 'HP', current: 8, max: 10 },
      { id: 'luck', label: 'Luck', current: 1, max: 3 },
    ];

    const steppedDown = adjustPlayerSheetTrack(initial, 'hp', -3);
    expect(steppedDown[0].current).toBe(5);

    const steppedPastMax = adjustPlayerSheetTrack(steppedDown, 'hp', 99);
    expect(steppedPastMax[0].current).toBe(10);

    const steppedBelowZero = adjustPlayerSheetTrack(steppedDown, 'luck', -5);
    expect(steppedBelowZero[1].current).toBe(0);

    const edited = updatePlayerSheetTrack(steppedPastMax, 'hp', { max: 8 });
    expect(edited[0]).toEqual({ id: 'hp', label: 'HP', current: 8, max: 8 });

    const added = addPlayerSheetTrack(edited, { id: 'ammo', label: 'Ammo', max: 6, current: 4 });
    expect(added).toHaveLength(3);
    expect(added[2]).toEqual({ id: 'ammo', label: 'Ammo', current: 4, max: 6 });

    const removed = removePlayerSheetTrack(added, 'luck');
    expect(removed.map((t) => t.id)).toEqual(['hp', 'ammo']);
  });

  it('strips file extensions for default sheet names', () => {
    expect(stripFileExtension('Aria_Sheet.pdf')).toBe('Aria_Sheet');
    expect(stripFileExtension('portrait.v2.webp')).toBe('portrait.v2');
    expect(stripFileExtension('NoExt')).toBe('NoExt');
  });

  it('creates, clamps, updates, steps, toggles, filters, and removes pinned sheet overlays', () => {
    expect(clampOverlayPct(-12)).toBe(0);
    expect(clampOverlayPct(145.678)).toBe(100);
    expect(clampOverlayPct(33.336)).toBe(33.34);
    expect(clampOverlayPct(Number.NaN)).toBe(50);

    const textPin = createSheetOverlay({
      id: 'ov-text',
      kind: 'text',
      xPct: 20,
      yPct: 35,
      page: 1,
      label: ' Name ',
      text: 'Aria',
      color: 'gold',
    });
    expect(textPin).toEqual({
      id: 'ov-text',
      kind: 'text',
      xPct: 20,
      yPct: 35,
      page: 1,
      label: 'Name',
      text: 'Aria',
      color: 'gold',
    });

    let list = addSheetOverlay(undefined, textPin);
    list = addSheetOverlay(list, {
      id: 'ov-dot',
      kind: 'dot',
      xPct: 50,
      yPct: 60,
      page: 1,
      active: false,
    });
    list = addSheetOverlay(list, {
      id: 'ov-cnt',
      kind: 'counter',
      xPct: 80,
      yPct: 15,
      page: 2,
      value: 3,
      color: 'red',
    });

    expect(list).toHaveLength(3);
    expect(getSheetOverlaysForPage(list, 1, 'pdf').map((o) => o.id)).toEqual(['ov-text', 'ov-dot']);
    expect(getSheetOverlaysForPage(list, 2, 'pdf').map((o) => o.id)).toEqual(['ov-cnt']);
    expect(getSheetOverlaysForPage(list, 2, 'image')).toHaveLength(3);

    list = toggleSheetOverlayDot(list, 'ov-dot');
    expect(list.find((o) => o.id === 'ov-dot')?.active).toBe(true);

    list = adjustSheetOverlayCounter(list, 'ov-cnt', 2);
    list = adjustSheetOverlayCounter(list, 'ov-cnt', -1);
    expect(list.find((o) => o.id === 'ov-cnt')?.value).toBe(4);

    list = updateSheetOverlay(list, 'ov-text', {
      xPct: 120,
      yPct: -5,
      label: 'Spell Slots',
      text: 'Aria Voss',
    });
    expect(list.find((o) => o.id === 'ov-text')).toMatchObject({
      xPct: 100,
      yPct: 0,
      label: 'Spell Slots',
      text: 'Aria Voss',
    });

    list = removeSheetOverlay(list, 'ov-dot');
    expect(list.map((o) => o.id)).toEqual(['ov-text', 'ov-cnt']);
  });
});
