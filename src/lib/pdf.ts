/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfRibbon, PdfRibbonColor } from '../storage/types';
import type { PanZoomTransform } from './panzoom';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export type PdfDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PdfRenderTask = pdfjsLib.RenderTask;

export interface PdfRibbonColorPreset {
  id: PdfRibbonColor;
  label: string;
  hex: string;
}

export const PDF_RIBBON_COLORS: readonly PdfRibbonColorPreset[] = [
  { id: 'red', label: 'Crimson', hex: '#E05555' },
  { id: 'gold', label: 'Amber', hex: '#E5A93B' },
  { id: 'teal', label: 'Teal', hex: '#38B89A' },
  { id: 'blue', label: 'Cobalt', hex: '#4C8FE8' },
  { id: 'violet', label: 'Violet', hex: '#9D75E6' },
  { id: 'emerald', label: 'Emerald', hex: '#43A854' },
  { id: 'orange', label: 'Tangerine', hex: '#E67A38' },
  { id: 'pink', label: 'Rose', hex: '#D95B96' },
] as const;

export function getPdfRibbonColorHex(color: PdfRibbonColor): string {
  const found = PDF_RIBBON_COLORS.find((c) => c.id === color);
  return found ? found.hex : PDF_RIBBON_COLORS[0].hex;
}

export function sortPdfRibbonsByPage(ribbons: readonly PdfRibbon[]): PdfRibbon[] {
  return [...ribbons].sort((a, b) => {
    if (a.pdfPage !== b.pdfPage) return a.pdfPage - b.pdfPage;
    return a.createdAt - b.createdAt;
  });
}

export function isPdfRibbonOutOfRange(ribbon: Pick<PdfRibbon, 'pdfPage'>, numPages: number): boolean {
  if (!Number.isFinite(ribbon.pdfPage) || ribbon.pdfPage < 1) return true;
  if (numPages > 0 && ribbon.pdfPage > numPages) return true;
  return false;
}

export function detectHorizontalPageSwipe(input: {
  dx: number;
  dy: number;
  scale: number;
  cropMode?: boolean;
  minSwipePx?: number;
}): 'prev' | 'next' | null {
  const { dx, dy, scale, cropMode = false, minSwipePx = 50 } = input;
  if (cropMode) return null;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(scale)) return null;
  if (Math.abs(scale - 1) > 0.001) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < minSwipePx) return null;
  if (absX <= 1.5 * absY) return null;
  // Swiping left (dx < 0) turns to next page; swiping right (dx > 0) turns to previous page.
  return dx < 0 ? 'next' : 'prev';
}

export function clampPdfPan(
  transform: PanZoomTransform,
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding = 12
): PanZoomTransform {
  const safeScale =
    Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
  const safeX = Number.isFinite(transform.x) ? transform.x : 0;
  const safeY = Number.isFinite(transform.y) ? transform.y : 0;

  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(contentWidth) ||
    !Number.isFinite(contentHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return { x: safeX, y: safeY, scale: safeScale };
  }

  const availW = Math.max(1, viewportWidth - padding * 2);
  const availH = Math.max(1, viewportHeight - padding * 2);
  const scaledW = contentWidth * safeScale;
  const scaledH = contentHeight * safeScale;
  const baseLeft = Math.max(padding, (viewportWidth - contentWidth) / 2);
  const baseTop = padding;

  const minX =
    scaledW > availW
      ? viewportWidth - padding - scaledW - baseLeft
      : padding - baseLeft;
  const maxX =
    scaledW > availW
      ? padding - baseLeft
      : viewportWidth - padding - scaledW - baseLeft;

  const minY =
    scaledH > availH
      ? viewportHeight - padding - scaledH - baseTop
      : padding - baseTop;
  const maxY =
    scaledH > availH
      ? padding - baseTop
      : viewportHeight - padding - scaledH - baseTop;

  return {
    x: Math.min(maxX, Math.max(minX, safeX)),
    y: Math.min(maxY, Math.max(minY, safeY)),
    scale: safeScale,
  };
}

export function printedToPdfPage(
  printedPage: number,
  pageOffset: number,
  numPages?: number
): number {
  const safePrinted = Number.isFinite(printedPage) ? Math.round(printedPage) : 1;
  const safeOffset = Number.isFinite(pageOffset) ? Math.round(pageOffset) : 0;
  const raw = safePrinted + safeOffset;
  if (numPages && numPages > 0) {
    return Math.min(numPages, Math.max(1, raw));
  }
  return Math.max(1, raw);
}

export function pdfToPrintedPage(pdfPage: number, pageOffset: number): number {
  const safePdf = Number.isFinite(pdfPage) ? Math.round(pdfPage) : 1;
  const safeOffset = Number.isFinite(pageOffset) ? Math.round(pageOffset) : 0;
  return safePdf - safeOffset;
}

export async function loadPdfDocument(
  data: Blob | Uint8Array | string
): Promise<PdfDocumentProxy> {
  let bytes: Uint8Array;
  if (data instanceof Uint8Array) {
    bytes = data.slice();
  } else if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (typeof data.arrayBuffer === 'function') {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else {
    bytes = new Uint8Array(await new Response(data).arrayBuffer());
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  return loadingTask.promise;
}

export function renderPdfPageToCanvas(
  doc: PdfDocumentProxy,
  pdfPageNum: number,
  canvas: HTMLCanvasElement,
  targetWidth = 440,
  options?: { fitCssToContainer?: boolean }
): { promise: Promise<void>; cancel: () => void } {
  let activeTask: PdfRenderTask | null = null;
  let cancelled = false;

  const promise = (async () => {
    const page = await doc.getPage(pdfPageNum);
    if (cancelled) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const cssScale = baseViewport.width > 0 ? targetWidth / baseViewport.width : 1;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const viewport = page.getViewport({ scale: cssScale * dpr });

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    if (options?.fitCssToContainer) {
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
    } else {
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    activeTask = page.render({
      canvasContext: ctx,
      viewport,
    });
    await activeTask.promise;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      try {
        activeTask?.cancel();
      } catch {
        // ignore cancel errors
      }
    },
  };
}

export interface NormalizedCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampCropRect(rect: NormalizedCropRect, minSize = 0.05): NormalizedCropRect {
  const w = Math.min(1, Math.max(minSize, rect.w));
  const h = Math.min(1, Math.max(minSize, rect.h));
  const x = Math.min(1 - w, Math.max(0, rect.x));
  const y = Math.min(1 - h, Math.max(0, rect.y));
  return { x, y, w, h };
}

export async function renderPdfCropToPngBlob(
  doc: PdfDocumentProxy,
  pdfPageNum: number,
  cropRect: NormalizedCropRect,
  dpr?: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await doc.getPage(pdfPageNum);
  const effectiveDpr =
    dpr ?? (typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1);
  const renderScale = 2 * effectiveDpr;
  const viewport = page.getViewport({ scale: renderScale });

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.max(1, Math.floor(viewport.width));
  fullCanvas.height = Math.max(1, Math.floor(viewport.height));
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) {
    throw new Error('Could not create canvas context for PDF crop.');
  }

  const renderTask = page.render({
    canvasContext: fullCtx,
    viewport,
  });
  await renderTask.promise;

  const norm = clampCropRect(cropRect);
  const sx = Math.floor(norm.x * fullCanvas.width);
  const sy = Math.floor(norm.y * fullCanvas.height);
  const sw = Math.max(1, Math.floor(norm.w * fullCanvas.width));
  const sh = Math.max(1, Math.floor(norm.h * fullCanvas.height));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('Could not create output canvas context.');
  }
  cropCtx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to encode cropped map as PNG.'));
      }
    }, 'image/png');
  });

  return { blob, width: sw, height: sh };
}

const sharedPdfCache = new Map<string, Promise<PdfDocumentProxy | null>>();
const resolvedPdfDocs = new Map<string, PdfDocumentProxy>();

export function acquireSharedPdfDocument(
  cacheKey: string,
  loadData: () => Promise<Blob | Uint8Array | string | null>,
  loader: (data: Blob | Uint8Array | string) => Promise<PdfDocumentProxy> = loadPdfDocument
): Promise<PdfDocumentProxy | null> {
  const existing = sharedPdfCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  // Evict stale versions for the same module prefix (`moduleId:version`)
  const prefix = cacheKey.includes(':') ? cacheKey.slice(0, cacheKey.lastIndexOf(':') + 1) : null;
  if (prefix) {
    for (const [k, doc] of resolvedPdfDocs.entries()) {
      if (k !== cacheKey && k.startsWith(prefix)) {
        resolvedPdfDocs.delete(k);
        sharedPdfCache.delete(k);
        void doc.destroy();
      }
    }
  }

  const pending = (async () => {
    try {
      const data = await loadData();
      if (!data) {
        sharedPdfCache.delete(cacheKey);
        return null;
      }
      const proxy = await loader(data);
      resolvedPdfDocs.set(cacheKey, proxy);
      return proxy;
    } catch (err) {
      sharedPdfCache.delete(cacheKey);
      throw err;
    }
  })();

  sharedPdfCache.set(cacheKey, pending);
  return pending;
}

export function clearSharedPdfDocumentCache(cacheKey?: string): void {
  if (cacheKey) {
    sharedPdfCache.delete(cacheKey);
    const doc = resolvedPdfDocs.get(cacheKey);
    if (doc) {
      resolvedPdfDocs.delete(cacheKey);
      void doc.destroy();
    }
    return;
  }
  for (const doc of resolvedPdfDocs.values()) {
    void doc.destroy();
  }
  resolvedPdfDocs.clear();
  sharedPdfCache.clear();
}

export function releasePdfCanvasMemory(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}
