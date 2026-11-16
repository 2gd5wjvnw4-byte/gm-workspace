/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export type PdfDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PdfRenderTask = pdfjsLib.RenderTask;

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
  targetWidth = 440
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
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

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
