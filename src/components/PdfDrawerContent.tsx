import React, { useEffect, useRef, useState } from 'react';
import { getBlob, pdfBlobKey } from '../storage';
import { useCampaignStore } from '../store/campaignStore';
import {
  loadPdfDocument,
  pdfToPrintedPage,
  printedToPdfPage,
  renderPdfPageToCanvas,
  type PdfDocumentProxy,
} from '../lib/pdf';
import {
  clampScale,
  panBy,
  zoomAtPoint,
  type PanZoomTransform,
} from '../lib/panzoom';

export interface PdfDrawerContentProps {
  requestedPrintedPage: number | null;
  openRequestSeq: number;
  onClose: () => void;
}

const IDENTITY_TRANSFORM: PanZoomTransform = { x: 0, y: 0, scale: 1 };

export const PdfDrawerContent: React.FC<PdfDrawerContentProps> = ({
  requestedPrintedPage,
  openRequestSeq,
  onClose,
}) => {
  const { activeCampaign, merged, pdfVersion, attachPdf } = useCampaignStore();
  const moduleId = merged.meta?.module_id || activeCampaign?.moduleId || '';
  const pageOffset = merged.meta?.page_offset ?? 0;

  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [hasBlob, setHasBlob] = useState<boolean | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [currentPdfPage, setCurrentPdfPage] = useState(() =>
    printedToPdfPage(requestedPrintedPage ?? 1, pageOffset)
  );
  const [goToOpen, setGoToOpen] = useState(false);
  const [goToDraft, setGoToDraft] = useState('');
  const [transform, setTransform] = useState<PanZoomTransform>(IDENTITY_TRANSFORM);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);

  // Load PDF document from IndexedDB whenever moduleId or pdfVersion changes
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfDocumentProxy | null = null;

    if (!moduleId) {
      setDoc(null);
      setNumPages(0);
      setHasBlob(false);
      return;
    }

    setLoadingPdf(true);
    setPdfError(null);

    (async () => {
      try {
        const record = await getBlob(pdfBlobKey(moduleId));
        if (cancelled) return;
        if (!record) {
          setHasBlob(false);
          setDoc(null);
          setNumPages(0);
          setLoadingPdf(false);
          return;
        }
        setHasBlob(true);
        const proxy = await loadPdfDocument(record.data);
        if (cancelled) {
          void proxy.destroy();
          return;
        }
        loadedDoc = proxy;
        setDoc(proxy);
        setNumPages(proxy.numPages);
        setLoadingPdf(false);
      } catch (err) {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Could not open PDF.');
        setLoadingPdf(false);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        void loadedDoc.destroy();
      }
    };
  }, [moduleId, pdfVersion]);

  // Jump to requested printed page when opened or page requested
  useEffect(() => {
    const targetPrinted = requestedPrintedPage ?? 1;
    setCurrentPdfPage(
      printedToPdfPage(targetPrinted, pageOffset, numPages > 0 ? numPages : undefined)
    );
    setTransform(IDENTITY_TRANSFORM);
  }, [requestedPrintedPage, openRequestSeq, pageOffset, numPages]);

  // Render only the currently visible page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || currentPdfPage < 1) return;

    const task = renderPdfPageToCanvas(doc, currentPdfPage, canvas, 448);
    task.promise.catch((err) => {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
        return;
      }
    });
    return () => {
      task.cancel();
    };
  }, [doc, currentPdfPage]);

  const printedPage = pdfToPrintedPage(currentPdfPage, pageOffset);

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    try {
      await attachPdf(file);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to attach PDF.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGoToSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(goToDraft.trim(), 10);
    if (!Number.isFinite(parsed)) return;
    setCurrentPdfPage(
      printedToPdfPage(parsed, pageOffset, numPages > 0 ? numPages : undefined)
    );
    setTransform(IDENTITY_TRANSFORM);
    setGoToOpen(false);
    setGoToDraft('');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore in jsdom
    }
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      pinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    const nextPt = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, nextPt);

    if (pointersRef.current.size === 1) {
      const dx = nextPt.x - prev.x;
      const dy = nextPt.y - prev.y;
      setTransform((t) => panBy(t, dx, dy));
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const prevDist = pinchDistRef.current;
      pinchDistRef.current = dist;
      if (prevDist && prevDist > 0 && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        const factor = dist / prevDist;
        setTransform((t) =>
          zoomAtPoint(t, clampScale(t.scale * factor), midX, midY)
        );
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchDistRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey && viewportRef.current) {
      e.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setTransform((t) => zoomAtPoint(t, clampScale(t.scale * factor), fx, fy));
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          data-testid="pdf-drawer-header-label"
          style={{ fontWeight: 600, flex: 1, fontSize: '14px' }}
        >
          Source PDF · printed p.{printedPage} (PDF p.{currentPdfPage}
          {numPages > 0 ? `/${numPages}` : ''})
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--p3)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <div
        ref={viewportRef}
        data-testid="pdf-canvas-viewport"
        onPointerDown={doc ? handlePointerDown : undefined}
        onPointerMove={doc ? handlePointerMove : undefined}
        onPointerUp={doc ? handlePointerUp : undefined}
        onPointerCancel={doc ? handlePointerUp : undefined}
        onWheel={doc ? handleWheel : undefined}
        style={{
          flex: 1,
          padding: '12px',
          overflow: 'hidden',
          position: 'relative',
          touchAction: doc ? 'none' : 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        {hasBlob === false && !loadingPdf && (
          <div
            data-testid="pdf-missing-state"
            style={{
              background: 'var(--p2)',
              border: '1px dashed var(--line2)',
              borderRadius: '12px',
              padding: '24px',
              color: 'var(--muted)',
              fontSize: '14px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
            }}
          >
            <div>Attach the PDF for this module</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              data-testid="pdf-drawer-attach-input"
              onChange={(e) => void handleAttachFile(e)}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              data-testid="pdf-drawer-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: '44px',
                padding: '0 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Attach PDF
            </button>
          </div>
        )}

        {loadingPdf && (
          <div style={{ padding: '24px', color: 'var(--muted)', fontSize: '14px' }}>
            Loading PDF…
          </div>
        )}

        {pdfError && (
          <div
            role="alert"
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--redLine)',
              background: 'var(--redBg)',
              color: 'var(--red)',
              fontSize: '13px',
            }}
          >
            {pdfError}
          </div>
        )}

        {doc && !loadingPdf && (
          <div
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              willChange: 'transform',
            }}
          >
            <canvas
              ref={canvasRef}
              data-testid="pdf-page-canvas"
              style={{
                display: 'block',
                borderRadius: '6px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                background: '#fff',
              }}
            />
          </div>
        )}
      </div>

      {goToOpen && (
        <form
          onSubmit={handleGoToSubmit}
          data-testid="pdf-goto-form"
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--line)',
            background: 'var(--p2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label htmlFor="pdf-goto-input" style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Printed page:
          </label>
          <input
            id="pdf-goto-input"
            data-testid="pdf-goto-input"
            type="number"
            value={goToDraft}
            onChange={(e) => setGoToDraft(e.target.value)}
            placeholder={String(printedPage)}
            style={{
              width: '88px',
              height: '40px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
            }}
          />
          <button
            type="submit"
            data-testid="pdf-goto-submit-btn"
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go
          </button>
          <button
            type="button"
            onClick={() => setGoToOpen(false)}
            style={{
              height: '40px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </form>
      )}

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          data-testid="pdf-prev-btn"
          disabled={!doc || currentPdfPage <= 1}
          onClick={() => {
            setCurrentPdfPage((p) => Math.max(1, p - 1));
            setTransform(IDENTITY_TRANSFORM);
          }}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontWeight: 600,
            cursor: !doc || currentPdfPage <= 1 ? 'default' : 'pointer',
            opacity: !doc || currentPdfPage <= 1 ? 0.45 : 1,
          }}
        >
          ‹ Prev
        </button>
        <button
          type="button"
          data-testid="pdf-next-btn"
          disabled={!doc || (numPages > 0 && currentPdfPage >= numPages)}
          onClick={() => {
            setCurrentPdfPage((p) => (numPages > 0 ? Math.min(numPages, p + 1) : p + 1));
            setTransform(IDENTITY_TRANSFORM);
          }}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontWeight: 600,
            cursor: !doc || (numPages > 0 && currentPdfPage >= numPages) ? 'default' : 'pointer',
            opacity: !doc || (numPages > 0 && currentPdfPage >= numPages) ? 0.45 : 1,
          }}
        >
          Next ›
        </button>
        <button
          type="button"
          data-testid="pdf-goto-btn"
          disabled={!doc}
          onClick={() => {
            setGoToDraft(String(printedPage));
            setGoToOpen((v) => !v);
          }}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            cursor: !doc ? 'default' : 'pointer',
            opacity: !doc ? 0.45 : 1,
          }}
        >
          Go to page…
        </button>
        {transform.scale !== 1 && (
          <button
            type="button"
            data-testid="pdf-reset-zoom-btn"
            onClick={() => setTransform(IDENTITY_TRANSFORM)}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {Math.round(transform.scale * 100)}% · Reset
          </button>
        )}
      </div>
    </>
  );
};
