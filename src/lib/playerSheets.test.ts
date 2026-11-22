import { describe, expect, it } from 'vitest';
import {
  addPlayerSheetTrack,
  adjustPlayerSheetTrack,
  createPrebuiltPlayerSheet,
  removePlayerSheetTrack,
  stripFileExtension,
  updatePlayerSheetTrack,
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
});
