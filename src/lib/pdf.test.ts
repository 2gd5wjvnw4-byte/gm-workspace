import { describe, expect, it, vi } from 'vitest';
import {
  PDF_RIBBON_COLORS,
  clampCropRect,
  detectHorizontalPageSwipe,
  getPdfRibbonColorHex,
  isPdfRibbonOutOfRange,
  pdfToPrintedPage,
  printedToPdfPage,
  renderPdfCropToPngBlob,
  sortPdfRibbonsByPage,
} from './pdf';
import type { PdfRibbon } from '../storage/types';

describe('PDF printed-page offset helpers', () => {
  it('converts printed page to PDF page using meta.page_offset and clamps to numPages', () => {
    expect(printedToPdfPage(6, 2, 40)).toBe(8);
    expect(printedToPdfPage(1, -3, 40)).toBe(1);
    expect(printedToPdfPage(45, 2, 40)).toBe(40);
    expect(printedToPdfPage(12, 0)).toBe(12);
  });

  it('converts PDF page back to printed page', () => {
    expect(pdfToPrintedPage(8, 2)).toBe(6);
    expect(pdfToPrintedPage(10, 0)).toBe(10);
  });

  it('clamps normalized crop rects within [0, 1]', () => {
    expect(clampCropRect({ x: -0.2, y: 0.9, w: 0.5, h: 0.4 })).toEqual({
      x: 0,
      y: 0.6,
      w: 0.5,
      h: 0.4,
    });
  });

  it('renders a cropped PDF region at 2x DPR to a PNG blob', async () => {
    const getViewport = vi.fn(({ scale }: { scale: number }) => ({
      width: 100 * scale,
      height: 200 * scale,
    }));
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const mockDoc = {
      getPage: vi.fn(async () => ({ getViewport, render })),
    } as unknown as Parameters<typeof renderPdfCropToPngBlob>[0];

    const fakeBlob = new Blob(['png'], { type: 'image/png' });
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob | null) => void) => cb(fakeBlob),
        } as unknown as HTMLCanvasElement;
      }
      return origCreate(tag);
    });

    try {
      const result = await renderPdfCropToPngBlob(mockDoc, 3, { x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 2);
      expect(getViewport).toHaveBeenCalledWith({ scale: 4 });
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      expect(result.blob).toBe(fakeBlob);
    } finally {
      spy.mockRestore();
    }
  });

  it('provides 8 preset ribbon colors and sorts ribbons by page then createdAt', () => {
    expect(PDF_RIBBON_COLORS).toHaveLength(8);
    expect(getPdfRibbonColorHex('teal')).toBe('#38B89A');

    const r1: PdfRibbon = {
      id: 'r1',
      label: 'Boss Table',
      color: 'red',
      pdfPage: 12,
      printedPage: 10,
      createdAt: 200,
    };
    const r2: PdfRibbon = {
      id: 'r2',
      label: 'Map Key',
      color: 'teal',
      pdfPage: 4,
      printedPage: 2,
      createdAt: 300,
    };
    const r3: PdfRibbon = {
      id: 'r3',
      label: 'Intro',
      color: 'gold',
      pdfPage: 4,
      printedPage: 2,
      createdAt: 100,
    };
    expect(sortPdfRibbonsByPage([r1, r2, r3]).map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
  });

  it('flags out-of-range ribbons when pdfPage < 1 or pdfPage > numPages', () => {
    expect(isPdfRibbonOutOfRange({ pdfPage: 0 }, 20)).toBe(true);
    expect(isPdfRibbonOutOfRange({ pdfPage: 21 }, 20)).toBe(true);
    expect(isPdfRibbonOutOfRange({ pdfPage: 20 }, 20)).toBe(false);
    expect(isPdfRibbonOutOfRange({ pdfPage: 15 }, 0)).toBe(false);
  });

  it('detects horizontal page swipes at 100% zoom and ignores zoomed or vertical drags', () => {
    expect(detectHorizontalPageSwipe({ dx: -80, dy: 10, scale: 1 })).toBe('next');
    expect(detectHorizontalPageSwipe({ dx: 75, dy: -12, scale: 1 })).toBe('prev');
    expect(detectHorizontalPageSwipe({ dx: -30, dy: 5, scale: 1 })).toBeNull();
    expect(detectHorizontalPageSwipe({ dx: -80, dy: 70, scale: 1 })).toBeNull();
    expect(detectHorizontalPageSwipe({ dx: -90, dy: 0, scale: 1.5 })).toBeNull();
    expect(detectHorizontalPageSwipe({ dx: -90, dy: 0, scale: 1, cropMode: true })).toBeNull();
  });
});
