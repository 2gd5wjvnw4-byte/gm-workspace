import { describe, expect, it, vi } from 'vitest';
import { clampCropRect, pdfToPrintedPage, printedToPdfPage, renderPdfCropToPngBlob } from './pdf';

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
});
