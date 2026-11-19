import React, { useEffect, useRef, useState } from 'react';
import { getBlob, pdfBlobKey } from '../storage';
import { useCampaignStore } from '../store/campaignStore';
import {
  PDF_RIBBON_COLORS,
  clampCropRect,
  detectHorizontalPageSwipe,
  getPdfRibbonColorHex,
  isPdfRibbonOutOfRange,
  loadPdfDocument,
  pdfToPrintedPage,
  printedToPdfPage,
  renderPdfCropToPngBlob,
  renderPdfPageToCanvas,
  sortPdfRibbonsByPage,
  type NormalizedCropRect,
  type PdfDocumentProxy,
} from '../lib/pdf';
import type { MapScale, PdfRibbon, PdfRibbonColor } from '../storage/types';
import {
  clampScale,
  panBy,
  zoomAtPoint,
  type PanZoomTransform,
} from '../lib/panzoom';

export interface PdfDrawerContentProps {
  requestedPrintedPage: number | null;
  openRequestSeq: number;
}

const IDENTITY_TRANSFORM: PanZoomTransform = { x: 0, y: 0, scale: 1 };
const DEFAULT_CROP_RECT: NormalizedCropRect = { x: 0.15, y: 0.15, w: 0.7, h: 0.7 };
type CropDragKind = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export const PdfDrawerContent: React.FC<PdfDrawerContentProps> = ({
  requestedPrintedPage,
  openRequestSeq,
}) => {
  const {
    activeCampaign,
    merged,
    live,
    pdfVersion,
    attachPdf,
    addMapAsset,
    addPdfRibbon,
    updatePdfRibbon,
    movePdfRibbonToPage,
    deletePdfRibbon,
  } = useCampaignStore();
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
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<NormalizedCropRect>(DEFAULT_CROP_RECT);
  const [cropPromptOpen, setCropPromptOpen] = useState(false);
  const [cropTitleDraft, setCropTitleDraft] = useState('');
  const [cropScaleDraft, setCropScaleDraft] = useState<MapScale | ''>('');
  const [savingCrop, setSavingCrop] = useState(false);
  const [cropNotice, setCropNotice] = useState<string | null>(null);

  const [addRibbonOpen, setAddRibbonOpen] = useState(false);
  const [ribbonLabelDraft, setRibbonLabelDraft] = useState('');
  const [ribbonColorDraft, setRibbonColorDraft] = useState<PdfRibbonColor>('red');
  const [ribbonsMenuOpen, setRibbonsMenuOpen] = useState(false);
  const [editingRibbonId, setEditingRibbonId] = useState<string | null>(null);
  const [editRibbonLabelDraft, setEditRibbonLabelDraft] = useState('');
  const [editRibbonColorDraft, setEditRibbonColorDraft] = useState<PdfRibbonColor>('red');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const cropDragRef = useRef<{
    kind: CropDragKind;
    startX: number;
    startY: number;
    startRect: NormalizedCropRect;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    multiTouch: boolean;
  } | null>(null);
  const ribbonLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ribbonClickSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRibbonClickIdRef = useRef<string | null>(null);

  const rawRibbons = (moduleId && live?.pdfRibbons?.[moduleId]) || [];
  const sortedRibbons = sortPdfRibbonsByPage(rawRibbons);
  const editingRibbon = rawRibbons.find((r) => r.id === editingRibbonId) ?? null;

  useEffect(() => {
    return () => {
      if (ribbonLongPressTimerRef.current) {
        clearTimeout(ribbonLongPressTimerRef.current);
      }
      if (ribbonClickSuppressTimerRef.current) {
        clearTimeout(ribbonClickSuppressTimerRef.current);
      }
    };
  }, []);

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
    setPdfError(null);
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

  const jumpToRibbon = (ribbon: PdfRibbon) => {
    if (isPdfRibbonOutOfRange(ribbon, numPages)) {
      setPdfError(
        `Ribbon "${ribbon.label}" points to p.${ribbon.printedPage} (PDF p.${ribbon.pdfPage}), which is outside this PDF (${numPages} pages).`
      );
      return;
    }
    setPdfError(null);
    setCurrentPdfPage(ribbon.pdfPage);
    setTransform(IDENTITY_TRANSFORM);
  };

  const openEditRibbon = (ribbon: PdfRibbon) => {
    setEditingRibbonId(ribbon.id);
    setEditRibbonLabelDraft(ribbon.label);
    setEditRibbonColorDraft(ribbon.color);
    setAddRibbonOpen(false);
  };

  const clearRibbonLongPress = () => {
    if (ribbonLongPressTimerRef.current) {
      clearTimeout(ribbonLongPressTimerRef.current);
      ribbonLongPressTimerRef.current = null;
    }
  };

  const startRibbonClickSuppressExpiry = (ribbonId: string) => {
    if (ribbonClickSuppressTimerRef.current) {
      clearTimeout(ribbonClickSuppressTimerRef.current);
    }
    ribbonClickSuppressTimerRef.current = setTimeout(() => {
      ribbonClickSuppressTimerRef.current = null;
      if (suppressRibbonClickIdRef.current === ribbonId) {
        suppressRibbonClickIdRef.current = null;
      }
    }, 350);
  };

  const handleRibbonPointerDown = (ribbon: PdfRibbon, e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    clearRibbonLongPress();
    if (ribbonClickSuppressTimerRef.current) {
      clearTimeout(ribbonClickSuppressTimerRef.current);
      ribbonClickSuppressTimerRef.current = null;
    }
    suppressRibbonClickIdRef.current = null;
    ribbonLongPressTimerRef.current = setTimeout(() => {
      ribbonLongPressTimerRef.current = null;
      suppressRibbonClickIdRef.current = ribbon.id;
      openEditRibbon(ribbon);
    }, 500);
  };

  const handleRibbonPointerUpOrCancel = (e: React.PointerEvent) => {
    e.stopPropagation();
    clearRibbonLongPress();
    if (suppressRibbonClickIdRef.current) {
      startRibbonClickSuppressExpiry(suppressRibbonClickIdRef.current);
    }
  };

  const handleRibbonClick = (ribbon: PdfRibbon, e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressRibbonClickIdRef.current === ribbon.id) {
      suppressRibbonClickIdRef.current = null;
      if (ribbonClickSuppressTimerRef.current) {
        clearTimeout(ribbonClickSuppressTimerRef.current);
        ribbonClickSuppressTimerRef.current = null;
      }
      return;
    }
    jumpToRibbon(ribbon);
  };

  const handleRibbonContextMenu = (ribbon: PdfRibbon, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearRibbonLongPress();
    openEditRibbon(ribbon);
  };

  const handleAddRibbonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) return;
    const label = ribbonLabelDraft.trim() || `p.${printedPage}`;
    addPdfRibbon({
      moduleId,
      label,
      color: ribbonColorDraft,
      pdfPage: currentPdfPage,
      printedPage,
    });
    setRibbonLabelDraft('');
    setAddRibbonOpen(false);
  };

  const handleSaveEditRibbon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId || !editingRibbon) return;
    updatePdfRibbon(moduleId, editingRibbon.id, {
      label: editRibbonLabelDraft.trim() || editingRibbon.label,
      color: editRibbonColorDraft,
    });
    setPdfError(null);
    setEditingRibbonId(null);
  };

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
    setPdfError(null);
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
    if (pointersRef.current.size === 1) {
      swipeStartRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        multiTouch: false,
      };
    } else if (pointersRef.current.size >= 2) {
      if (swipeStartRef.current) {
        swipeStartRef.current.multiTouch = true;
      }
      const pts = Array.from(pointersRef.current.values());
      pinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    const nextPt = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, nextPt);

    if (swipeStartRef.current && swipeStartRef.current.pointerId === e.pointerId) {
      swipeStartRef.current.lastX = e.clientX;
      swipeStartRef.current.lastY = e.clientY;
    }

    if (pointersRef.current.size === 1) {
      // At unzoomed 100% scale, single-finger horizontal drag is used for swipe page turning
      if (Math.abs(transform.scale - 1) > 0.001) {
        const dx = nextPt.x - prev.x;
        const dy = nextPt.y - prev.y;
        setTransform((t) => panBy(t, dx, dy));
      }
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
    const swipe = swipeStartRef.current;
    if (
      swipe &&
      swipe.pointerId === e.pointerId &&
      !swipe.multiTouch &&
      pointersRef.current.size <= 1
    ) {
      const endX = Number.isFinite(e.clientX) ? e.clientX : swipe.lastX;
      const endY = Number.isFinite(e.clientY) ? e.clientY : swipe.lastY;
      const dir = detectHorizontalPageSwipe({
        dx: endX - swipe.startX,
        dy: endY - swipe.startY,
        scale: transform.scale,
        cropMode,
      });
      if (dir === 'next' && (numPages === 0 || currentPdfPage < numPages)) {
        setPdfError(null);
        setCurrentPdfPage((p) => (numPages > 0 ? Math.min(numPages, p + 1) : p + 1));
        setTransform(IDENTITY_TRANSFORM);
      } else if (dir === 'prev' && currentPdfPage > 1) {
        setPdfError(null);
        setCurrentPdfPage((p) => Math.max(1, p - 1));
        setTransform(IDENTITY_TRANSFORM);
      }
    }
    if (swipe && swipe.pointerId === e.pointerId) {
      swipeStartRef.current = null;
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchDistRef.current = null;
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartRef.current?.pointerId === e.pointerId) {
      swipeStartRef.current = null;
    }
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

  const startCropDrag = (kind: CropDragKind, e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore in jsdom
    }
    cropDragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startRect: cropRect,
    };
  };

  const moveCropDrag = (e: React.PointerEvent) => {
    const drag = cropDragRef.current;
    const stage = cropStageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const s = drag.startRect;
    const minSize = 0.08;

    if (drag.kind === 'move') {
      setCropRect(
        clampCropRect({
          x: s.x + dx,
          y: s.y + dy,
          w: s.w,
          h: s.h,
        }, minSize)
      );
      return;
    }

    let left = s.x;
    let top = s.y;
    let right = s.x + s.w;
    let bottom = s.y + s.h;

    if (drag.kind === 'nw' || drag.kind === 'sw') {
      left = Math.min(right - minSize, Math.max(0, s.x + dx));
    }
    if (drag.kind === 'ne' || drag.kind === 'se') {
      right = Math.max(left + minSize, Math.min(1, s.x + s.w + dx));
    }
    if (drag.kind === 'nw' || drag.kind === 'ne') {
      top = Math.min(bottom - minSize, Math.max(0, s.y + dy));
    }
    if (drag.kind === 'sw' || drag.kind === 'se') {
      bottom = Math.max(top + minSize, Math.min(1, s.y + s.h + dy));
    }

    setCropRect(
      clampCropRect({
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
      }, minSize)
    );
  };

  const endCropDrag = () => {
    cropDragRef.current = null;
  };

  const handleConfirmSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || savingCrop) return;
    setSavingCrop(true);
    setPdfError(null);
    try {
      const { blob, width, height } = await renderPdfCropToPngBlob(
        doc,
        currentPdfPage,
        cropRect
      );
      const mapName = cropTitleDraft.trim() || `Map p.${printedPage}`;
      await addMapAsset({
        name: mapName,
        data: blob,
        mimeType: 'image/png',
        width,
        height,
        scale: cropScaleDraft || undefined,
        fileName: `${mapName}.png`,
      });
      setCropPromptOpen(false);
      setCropMode(false);
      setCropTitleDraft('');
      setCropScaleDraft('');
      setCropNotice(`Saved "${mapName}" to Map Library.`);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to save cropped map.');
    } finally {
      setSavingCrop(false);
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
          data-testid="pdf-add-ribbon-btn"
          disabled={!doc}
          onClick={() => {
            setRibbonLabelDraft(`p.${printedPage}`);
            setAddRibbonOpen((v) => !v);
            setEditingRibbonId(null);
          }}
          style={{
            height: '44px',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: addRibbonOpen ? 'var(--accentBg)' : 'var(--p2)',
            color: addRibbonOpen ? 'var(--accent)' : 'var(--text)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: !doc ? 'default' : 'pointer',
            opacity: !doc ? 0.45 : 1,
          }}
        >
          + Ribbon
        </button>
        <button
          type="button"
          data-testid="pdf-ribbons-menu-btn"
          aria-expanded={ribbonsMenuOpen}
          onClick={() => setRibbonsMenuOpen((v) => !v)}
          style={{
            height: '44px',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: ribbonsMenuOpen ? 'var(--accentBg)' : 'var(--p2)',
            color: ribbonsMenuOpen ? 'var(--accent)' : 'var(--text)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Ribbons ({sortedRibbons.length})
        </button>
      </div>

      {pdfError && (
        <div
          role="alert"
          data-testid="pdf-error-banner"
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--redLine)',
            background: 'var(--redBg)',
            color: 'var(--red)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ flex: 1 }}>{pdfError}</span>
          <button
            type="button"
            data-testid="pdf-error-dismiss-btn"
            aria-label="Dismiss PDF error"
            onClick={() => setPdfError(null)}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--redLine)',
              background: 'var(--panel)',
              color: 'var(--red)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {ribbonsMenuOpen && (
        <div
          data-testid="pdf-ribbons-list-menu"
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--p2)',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {sortedRibbons.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              No ribbons on this PDF yet. Tap + Ribbon to bookmark a page.
            </div>
          ) : (
            sortedRibbons.map((ribbon) => {
              const outOfRange = isPdfRibbonOutOfRange(ribbon, numPages);
              const hex = getPdfRibbonColorHex(ribbon.color);
              return (
                <div
                  key={ribbon.id}
                  data-testid={`pdf-ribbon-list-row-${ribbon.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`pdf-ribbon-list-jump-${ribbon.id}`}
                    onClick={() => jumpToRibbon(ribbon)}
                    onContextMenu={(e) => handleRibbonContextMenu(ribbon, e)}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: outOfRange ? '1px dashed var(--red)' : '1px solid var(--line)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        background: hex,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '13px' }}>
                      {ribbon.label}
                    </span>
                    {outOfRange && (
                      <span
                        data-testid={`pdf-ribbon-out-of-range-${ribbon.id}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--red)',
                        }}
                      >
                        ⚠ Missing page
                      </span>
                    )}
                    <span
                      className="gm-tabular"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        color: 'var(--muted)',
                      }}
                    >
                      p.{ribbon.printedPage}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid={`pdf-ribbon-list-edit-${ribbon.id}`}
                    aria-label={`Edit ribbon ${ribbon.label}`}
                    onClick={() => openEditRibbon(ribbon)}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--p3)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    ✎
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      <div
        ref={viewportRef}
        data-testid="pdf-canvas-viewport"
        onPointerDown={doc && !cropMode ? handlePointerDown : undefined}
        onPointerMove={doc && !cropMode ? handlePointerMove : undefined}
        onPointerUp={doc && !cropMode ? handlePointerUp : undefined}
        onPointerCancel={doc && !cropMode ? handlePointerCancel : undefined}
        onWheel={doc && !cropMode ? handleWheel : undefined}
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

        {doc && !loadingPdf && (
          <div
            ref={cropStageRef}
            style={{
              position: 'relative',
              display: 'inline-block',
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
            {cropMode && (
              <div
                data-testid="pdf-crop-overlay"
                onPointerMove={moveCropDrag}
                onPointerUp={endCropDrag}
                onPointerCancel={endCropDrag}
                style={{
                  position: 'absolute',
                  inset: 0,
                  touchAction: 'none',
                }}
              >
                <div
                  data-testid="pdf-crop-rect"
                  onPointerDown={(e) => startCropDrag('move', e)}
                  style={{
                    position: 'absolute',
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.w * 100}%`,
                    height: `${cropRect.h * 100}%`,
                    border: '2px solid var(--teal)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    cursor: 'move',
                    boxSizing: 'border-box',
                  }}
                >
                  {(
                    [
                      { kind: 'nw', style: { left: '-22px', top: '-22px', cursor: 'nwse-resize' } },
                      { kind: 'ne', style: { right: '-22px', top: '-22px', cursor: 'nesw-resize' } },
                      { kind: 'sw', style: { left: '-22px', bottom: '-22px', cursor: 'nesw-resize' } },
                      { kind: 'se', style: { right: '-22px', bottom: '-22px', cursor: 'nwse-resize' } },
                    ] as const
                  ).map((h) => (
                    <div
                      key={h.kind}
                      data-testid={`pdf-crop-handle-${h.kind}`}
                      onPointerDown={(e) => startCropDrag(h.kind, e)}
                      style={{
                        position: 'absolute',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'none',
                        ...h.style,
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '4px',
                          background: 'var(--teal)',
                          border: '2px solid #fff',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {sortedRibbons.length > 0 && (
          <div
            data-testid="pdf-ribbon-edge-rail"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '12px',
              right: 0,
              bottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'flex-end',
              overflowY: 'auto',
              pointerEvents: 'auto',
              zIndex: 5,
            }}
          >
            {sortedRibbons.map((ribbon) => {
              const hex = getPdfRibbonColorHex(ribbon.color);
              const isCurrent = ribbon.pdfPage === currentPdfPage;
              const outOfRange = isPdfRibbonOutOfRange(ribbon, numPages);
              return (
                <button
                  key={ribbon.id}
                  type="button"
                  data-testid={`pdf-ribbon-tab-${ribbon.id}`}
                  aria-label={`Ribbon ${ribbon.label} p.${ribbon.printedPage}${outOfRange ? ' (out of range)' : ''}`}
                  onPointerDown={(e) => handleRibbonPointerDown(ribbon, e)}
                  onPointerUp={handleRibbonPointerUpOrCancel}
                  onPointerCancel={handleRibbonPointerUpOrCancel}
                  onPointerLeave={handleRibbonPointerUpOrCancel}
                  onClick={(e) => handleRibbonClick(ribbon, e)}
                  onContextMenu={(e) => handleRibbonContextMenu(ribbon, e)}
                  style={{
                    minWidth: '44px',
                    minHeight: '44px',
                    maxWidth: '148px',
                    padding: '4px 10px 4px 12px',
                    borderRadius: '10px 0 0 10px',
                    borderTop: isCurrent ? '2px solid #fff' : '1px solid rgba(0,0,0,0.35)',
                    borderBottom: isCurrent ? '2px solid #fff' : '1px solid rgba(0,0,0,0.35)',
                    borderLeft: isCurrent ? '2px solid #fff' : '1px solid rgba(0,0,0,0.35)',
                    borderRight: 'none',
                    background: hex,
                    color: '#0D1117',
                    fontWeight: 700,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isCurrent
                      ? '0 2px 10px rgba(0,0,0,0.45)'
                      : '0 1px 4px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ribbon.label}
                  </span>
                  <span
                    className="gm-tabular"
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      opacity: 0.85,
                      flexShrink: 0,
                    }}
                  >
                    p.{ribbon.printedPage}
                  </span>
                  {outOfRange && (
                    <span
                      data-testid={`pdf-ribbon-tab-warning-${ribbon.id}`}
                      title="Page out of range"
                      style={{
                        fontWeight: 800,
                        color: '#fff',
                        background: '#991B1B',
                        borderRadius: '4px',
                        padding: '0 4px',
                        fontSize: '10px',
                        flexShrink: 0,
                      }}
                    >
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {addRibbonOpen && (
        <form
          onSubmit={handleAddRibbonSubmit}
          data-testid="pdf-add-ribbon-form"
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--line)',
            background: 'var(--p2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              data-testid="pdf-ribbon-label-input"
              aria-label="Ribbon label"
              maxLength={32}
              value={ribbonLabelDraft}
              onChange={(e) => setRibbonLabelDraft(e.target.value)}
              placeholder={`p.${printedPage}`}
              style={{
                flex: 1,
                height: '40px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              data-testid="pdf-ribbon-save-btn"
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
            <button
              type="button"
              data-testid="pdf-ribbon-cancel-btn"
              onClick={() => setAddRibbonOpen(false)}
              style={{
                height: '44px',
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
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {PDF_RIBBON_COLORS.map((preset) => {
              const selected = ribbonColorDraft === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`pdf-ribbon-color-${preset.id}`}
                  aria-label={`Ribbon color ${preset.label}`}
                  aria-pressed={selected}
                  onClick={() => setRibbonColorDraft(preset.id)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    border: selected ? '2px solid var(--text)' : '1px solid var(--line)',
                    background: 'var(--bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: preset.hex,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </form>
      )}

      {editingRibbon && (
        <form
          onSubmit={handleSaveEditRibbon}
          data-testid="pdf-edit-ribbon-form"
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--line)',
            background: 'var(--p2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            <span>
              EDIT RIBBON · p.{editingRibbon.printedPage} (PDF p.{editingRibbon.pdfPage})
            </span>
            {isPdfRibbonOutOfRange(editingRibbon, numPages) && (
              <span
                data-testid="pdf-edit-ribbon-out-of-range"
                style={{ color: 'var(--red)', fontWeight: 700 }}
              >
                ⚠ Page out of range
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              data-testid="pdf-edit-ribbon-label-input"
              aria-label="Edit ribbon label"
              maxLength={32}
              value={editRibbonLabelDraft}
              onChange={(e) => setEditRibbonLabelDraft(e.target.value)}
              style={{
                flex: 1,
                height: '40px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              data-testid="pdf-edit-ribbon-save-btn"
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              data-testid="pdf-edit-ribbon-close-btn"
              onClick={() => setEditingRibbonId(null)}
              style={{
                height: '44px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {PDF_RIBBON_COLORS.map((preset) => {
              const selected = editRibbonColorDraft === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`pdf-edit-ribbon-color-${preset.id}`}
                  aria-label={`Edit ribbon color ${preset.label}`}
                  aria-pressed={selected}
                  onClick={() => setEditRibbonColorDraft(preset.id)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    border: selected ? '2px solid var(--text)' : '1px solid var(--line)',
                    background: 'var(--bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: preset.hex,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="pdf-edit-ribbon-move-here-btn"
              onClick={() => {
                if (!moduleId) return;
                movePdfRibbonToPage(moduleId, editingRibbon.id, currentPdfPage, printedPage);
                setPdfError(null);
                setEditingRibbonId(null);
              }}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Move to current page (p.{printedPage})
            </button>
            <button
              type="button"
              data-testid="pdf-edit-ribbon-delete-btn"
              onClick={() => {
                if (!moduleId) return;
                deletePdfRibbon(moduleId, editingRibbon.id);
                setPdfError(null);
                setEditingRibbonId(null);
              }}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--redLine)',
                background: 'var(--redBg)',
                color: 'var(--red)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete ribbon
            </button>
          </div>
        </form>
      )}

      {cropNotice && (
        <div
          data-testid="pdf-crop-notice"
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--tealLine)',
            background: 'var(--tealBg)',
            color: 'var(--teal)',
            fontSize: '13px',
          }}
        >
          {cropNotice}
        </div>
      )}

      {cropPromptOpen && cropMode && (
        <form
          onSubmit={(e) => void handleConfirmSaveCrop(e)}
          data-testid="pdf-crop-save-form"
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--line)',
            background: 'var(--p2)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <input
            type="text"
            data-testid="pdf-crop-title-input"
            aria-label="Map title"
            value={cropTitleDraft}
            onChange={(e) => setCropTitleDraft(e.target.value)}
            placeholder={`Map p.${printedPage}`}
            style={{
              flex: 1,
              minWidth: '140px',
              height: '40px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          />
          <select
            aria-label="Map scale"
            data-testid="pdf-crop-scale-select"
            value={cropScaleDraft}
            onChange={(e) => setCropScaleDraft(e.target.value as MapScale | '')}
            style={{
              height: '40px',
              padding: '0 8px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
            }}
          >
            <option value="">No scale</option>
            <option value="Tactical">Tactical</option>
            <option value="District">District</option>
            <option value="Regional">Regional</option>
            <option value="Relationship">Relationship</option>
          </select>
          <button
            type="submit"
            data-testid="pdf-crop-confirm-btn"
            disabled={savingCrop}
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontWeight: 700,
              cursor: savingCrop ? 'default' : 'pointer',
            }}
          >
            {savingCrop ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setCropPromptOpen(false)}
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
            setPdfError(null);
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
            setPdfError(null);
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
        {!cropMode ? (
          <button
            type="button"
            data-testid="pdf-crop-start-btn"
            disabled={!doc}
            onClick={() => {
              setCropNotice(null);
              setTransform(IDENTITY_TRANSFORM);
              setCropRect(DEFAULT_CROP_RECT);
              setCropTitleDraft(`Map p.${printedPage}`);
              setCropPromptOpen(false);
              setCropMode(true);
            }}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid var(--tealLine)',
              background: 'var(--tealBg)',
              color: 'var(--teal)',
              fontWeight: 600,
              cursor: !doc ? 'default' : 'pointer',
              opacity: !doc ? 0.45 : 1,
            }}
          >
            Crop map from this page
          </button>
        ) : (
          <>
            <button
              type="button"
              data-testid="pdf-crop-save-btn"
              onClick={() => setCropPromptOpen(true)}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save crop
            </button>
            <button
              type="button"
              data-testid="pdf-crop-cancel-btn"
              onClick={() => {
                setCropMode(false);
                setCropPromptOpen(false);
              }}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel crop
            </button>
          </>
        )}
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
