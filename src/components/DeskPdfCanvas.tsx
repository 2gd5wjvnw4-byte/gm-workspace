import React, { useEffect, useRef, useState } from 'react';
import {
  acquireSharedPdfDocument,
  loadPdfDocument,
  releasePdfCanvasMemory,
  renderPdfPageToCanvas,
  type PdfDocumentProxy,
} from '../lib/pdf';
import { getBlob, pdfBlobKey } from '../storage';
import { useCampaignStore } from '../store/campaignStore';

export interface SharedPdfState {
  doc: PdfDocumentProxy | null;
  numPages: number;
  hasBlob: boolean;
  loading: boolean;
  error: string | null;
}

export function useSharedCampaignPdf(): SharedPdfState {
  const { activeCampaign, merged, pdfVersion } = useCampaignStore();
  const moduleId = merged.meta?.module_id || activeCampaign?.moduleId || '';

  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [hasBlob, setHasBlob] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!moduleId) {
      setDoc(null);
      setNumPages(0);
      setHasBlob(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const cacheKey = `${moduleId}:${pdfVersion}`;

    void acquireSharedPdfDocument(
      cacheKey,
      async () => {
        const record = await getBlob(pdfBlobKey(moduleId));
        return record ? record.data : null;
      },
      loadPdfDocument
    )
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setDoc(null);
          setNumPages(0);
          setHasBlob(false);
        } else {
          setDoc(loaded);
          setNumPages(loaded.numPages);
          setHasBlob(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDoc(null);
        setNumPages(0);
        setHasBlob(false);
        setError(err instanceof Error ? err.message : 'Could not load PDF.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId, pdfVersion]);

  return { doc, numPages, hasBlob, loading, error };
}

export interface DeskPdfCanvasProps {
  cardId: string;
  doc: PdfDocumentProxy | null;
  pdfPage: number;
  numPages: number;
  isVisible: boolean;
  renderWidth: number;
  touchActionNone?: boolean;
}

export const DeskPdfCanvas: React.FC<DeskPdfCanvasProps> = ({
  cardId,
  doc,
  pdfPage,
  numPages,
  isVisible,
  renderWidth,
  touchActionNone = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [debouncedWidth, setDebouncedWidth] = useState(renderWidth);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedWidth(renderWidth);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [renderWidth]);

  // Always zero the backing canvas store when going off-screen or unmounting (iPad Safari memory)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isVisible || !canvas) return;
    return () => {
      releasePdfCanvasMemory(canvas);
    };
  }, [isVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isVisible || !doc || !canvas) {
      setRendered(false);
      return;
    }

    const safePage =
      numPages > 0 ? Math.min(numPages, Math.max(1, Math.round(pdfPage))) : Math.max(1, Math.round(pdfPage));

    const task = renderPdfPageToCanvas(doc, safePage, canvas, debouncedWidth, {
      fitCssToContainer: true,
    });
    let cancelled = false;
    void task.promise
      .then(() => {
        if (!cancelled) {
          setRendered(true);
        }
      })
      .catch(() => {
        // Ignore cancelled render errors during rapid page/zoom changes
      });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [doc, pdfPage, numPages, isVisible, debouncedWidth]);

  return (
    <div
      data-testid={`desk-pdf-canvas-wrap-${cardId}`}
      data-visible={isVisible ? 'true' : 'false'}
      data-pdf-rendered={rendered ? 'true' : 'false'}
      data-render-width={debouncedWidth}
      style={{
        flex: 1,
        minHeight: '140px',
        display: 'flex',
        alignItems: isVisible ? 'flex-start' : 'center',
        justifyContent: 'center',
        overflow: 'auto',
        padding: isVisible ? '8px' : '0',
        boxSizing: 'border-box',
        background: 'var(--mapBg)',
        borderRadius: '8px',
        border: '1px solid var(--line)',
        position: 'relative',
        ...(touchActionNone ? { touchAction: 'none' } : {}),
      }}
    >
      {isVisible ? (
        <canvas
          ref={canvasRef}
          data-testid={`desk-pdf-canvas-${cardId}`}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.22)',
            ...(touchActionNone ? { touchAction: 'none' } : {}),
          }}
        />
      ) : (
        <div
          data-testid={`desk-pdf-deferred-${cardId}`}
          style={{
            padding: '12px',
            fontSize: '12px',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
          }}
        >
          Page {pdfPage} (off-screen)
        </div>
      )}
    </div>
  );
};
