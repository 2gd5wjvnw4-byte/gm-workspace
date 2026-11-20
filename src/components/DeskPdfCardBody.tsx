import React, { useRef, useState } from 'react';
import {
  PDF_RIBBON_COLORS,
  detectHorizontalPageSwipe,
  getPdfRibbonColorHex,
  isPdfRibbonOutOfRange,
  pdfToPrintedPage,
  printedToPdfPage,
  sortPdfRibbonsByPage,
} from '../lib/pdf';
import type { DeskCardRecord, PdfRibbonColor } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { DeskPdfCanvas, useSharedCampaignPdf } from './DeskPdfCanvas';

export interface DeskPdfCardBodyProps {
  card: DeskCardRecord;
  isVisible: boolean;
  renderWidth: number;
  onUpdatePage: (cardId: string, printedPage: number) => void;
  onDetachPage: (printedPage: number, nearCard: DeskCardRecord) => void;
}

export const DeskPdfCardBody: React.FC<DeskPdfCardBodyProps> = ({
  card,
  isVisible,
  renderWidth,
  onUpdatePage,
  onDetachPage,
}) => {
  const { activeCampaign, merged, live, addPdfRibbon } = useCampaignStore();
  const { doc, numPages, hasBlob, loading, error } = useSharedCampaignPdf();

  const moduleId = merged.meta?.module_id || activeCampaign?.moduleId || '';
  const pageOffset = merged.meta?.page_offset ?? 0;

  const currentPrintedPage = card.pageNumber ?? 1;
  const currentPdfPage = printedToPdfPage(currentPrintedPage, pageOffset, numPages || undefined);
  const displayPrintedPage = pdfToPrintedPage(currentPdfPage, pageOffset);

  const [ribbonsOpen, setRibbonsOpen] = useState(false);
  const [addRibbonOpen, setAddRibbonOpen] = useState(false);
  const [ribbonLabel, setRibbonLabel] = useState('');
  const [ribbonColor, setRibbonColor] = useState<PdfRibbonColor>('red');

  const swipeStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const rawRibbons = (moduleId && live?.pdfRibbons?.[moduleId]) || [];
  const sortedRibbons = sortPdfRibbonsByPage(rawRibbons);
  const pageRibbons = sortedRibbons.filter((r) => r.pdfPage === currentPdfPage);

  const goToPdfPage = (targetPdfPage: number) => {
    const clamped =
      numPages > 0
        ? Math.min(numPages, Math.max(1, Math.round(targetPdfPage)))
        : Math.max(1, Math.round(targetPdfPage));
    const nextPrinted = pdfToPrintedPage(clamped, pageOffset);
    onUpdatePage(card.id, nextPrinted);
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;
    swipeStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic test events may not have active pointer IDs
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.pointerId !== e.pointerId) return;
    const dy = e.clientY - swipe.lastY;
    const dx = e.clientX - swipe.lastX;
    swipe.lastX = e.clientX;
    swipe.lastY = e.clientY;
    // Allow vertical touch/drag scrolling inside portrait PDF pages while touchAction is 'none'
    if (Math.abs(dy) > Math.abs(dx)) {
      const wrap = e.currentTarget.querySelector(
        `[data-testid="desk-pdf-canvas-wrap-${card.id}"]`
      ) as HTMLElement | null;
      if (wrap && wrap.scrollHeight > wrap.clientHeight) {
        const rect = wrap.getBoundingClientRect();
        const visualScale = rect.height > 0 && wrap.clientHeight > 0 ? rect.height / wrap.clientHeight : 1;
        wrap.scrollTop -= dy / visualScale;
      }
    }
  };

  const handleStagePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.pointerId !== e.pointerId) return;
    swipeStartRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events
    }
    const dir = detectHorizontalPageSwipe({
      dx: swipe.lastX - swipe.startX,
      dy: swipe.lastY - swipe.startY,
      scale: 1,
    });
    if (dir === 'next') {
      goToPdfPage(currentPdfPage + 1);
    } else if (dir === 'prev') {
      goToPdfPage(currentPdfPage - 1);
    }
  };

  const handleCreateRibbon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) return;
    addPdfRibbon({
      moduleId,
      label: ribbonLabel.trim() || `Page ${displayPrintedPage}`,
      color: ribbonColor,
      pdfPage: currentPdfPage,
      printedPage: displayPrintedPage,
    });
    setRibbonLabel('');
    setAddRibbonOpen(false);
  };

  if (!hasBlob && !loading) {
    return (
      <div
        data-testid={`desk-pdf-empty-${card.id}`}
        style={{
          flex: 1,
          minHeight: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '16px',
          borderRadius: '8px',
          border: '1px dashed var(--line2)',
          background: 'var(--mapBg)',
          color: 'var(--muted)',
          fontSize: '13px',
          lineHeight: 1.45,
        }}
      >
        {error || 'No PDF attached yet. Attach a source PDF from the PDF drawer or campaign switcher.'}
      </div>
    );
  }

  return (
    <div
      data-testid={`desk-pdf-card-body-${card.id}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
      }}
    >
      {/* Controls bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            data-testid={`desk-pdf-prev-${card.id}`}
            aria-label="Previous PDF page"
            disabled={currentPdfPage <= 1}
            onClick={() => goToPdfPage(currentPdfPage - 1)}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: currentPdfPage <= 1 ? 'var(--faint)' : 'var(--text)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: currentPdfPage <= 1 ? 'default' : 'pointer',
            }}
          >
            ‹
          </button>
          <span
            data-testid={`desk-pdf-page-readout-${card.id}`}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text)',
              padding: '0 6px',
              whiteSpace: 'nowrap',
            }}
          >
            p.{displayPrintedPage}
            {numPages > 0 ? ` / ${numPages}` : ''}
          </span>
          <button
            type="button"
            data-testid={`desk-pdf-next-${card.id}`}
            aria-label="Next PDF page"
            disabled={numPages > 0 && currentPdfPage >= numPages}
            onClick={() => goToPdfPage(currentPdfPage + 1)}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: numPages > 0 && currentPdfPage >= numPages ? 'var(--faint)' : 'var(--text)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: numPages > 0 && currentPdfPage >= numPages ? 'default' : 'pointer',
            }}
          >
            ›
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            data-testid={`desk-pdf-ribbons-btn-${card.id}`}
            aria-expanded={ribbonsOpen}
            onClick={() => {
              setRibbonsOpen((v) => !v);
              setAddRibbonOpen(false);
            }}
            style={{
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: ribbonsOpen ? '1px solid var(--gold)' : '1px solid var(--line)',
              background: ribbonsOpen ? 'var(--goldBg)' : 'var(--p2)',
              color: ribbonsOpen ? 'var(--gold)' : 'var(--text)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ribbons ({sortedRibbons.length})
          </button>

          <button
            type="button"
            data-testid={`desk-pdf-detach-${card.id}`}
            onClick={() => onDetachPage(displayPrintedPage, card)}
            style={{
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--tealLine)',
              background: 'var(--tealBg)',
              color: 'var(--teal)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Detach page
          </button>
        </div>
      </div>

      {/* Inline Ribbons Menu */}
      {ribbonsOpen && (
        <div
          data-testid={`desk-pdf-ribbons-menu-${card.id}`}
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--line2)',
            background: 'var(--p2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              Book Ribbons
            </span>
            <button
              type="button"
              data-testid={`desk-pdf-add-ribbon-toggle-${card.id}`}
              onClick={() => setAddRibbonOpen((v) => !v)}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--goldLine)',
                background: 'var(--goldBg)',
                color: 'var(--gold)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add here
            </button>
          </div>

          {addRibbonOpen && (
            <form
              onSubmit={handleCreateRibbon}
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              <input
                type="text"
                data-testid={`desk-pdf-ribbon-label-input-${card.id}`}
                placeholder={`Ribbon label (p.${displayPrintedPage})`}
                value={ribbonLabel}
                onChange={(e) => setRibbonLabel(e.target.value)}
                style={{
                  height: '44px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '13px',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {PDF_RIBBON_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setRibbonColor(c.id)}
                    style={{
                      width: '44px',
                      height: '44px',
                      padding: 0,
                      borderRadius: '8px',
                      background: 'transparent',
                      border: ribbonColor === c.id ? '2px solid var(--text)' : '1px solid transparent',
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
                        borderRadius: '50%',
                        background: c.hex,
                        display: 'block',
                      }}
                    />
                  </button>
                ))}
                <button
                  type="submit"
                  data-testid={`desk-pdf-ribbon-save-${card.id}`}
                  style={{
                    marginLeft: 'auto',
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'var(--onAccent)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {sortedRibbons.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              No ribbons saved yet.
            </div>
          ) : (
            sortedRibbons.map((r) => {
              const outOfRange = isPdfRibbonOutOfRange(r, numPages);
              return (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`desk-pdf-ribbon-item-${card.id}-${r.id}`}
                  onClick={() => {
                    goToPdfPage(r.pdfPage);
                    setRibbonsOpen(false);
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: getPdfRibbonColorHex(r.color),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.label}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      color: outOfRange ? 'var(--gold)' : 'var(--muted)',
                      flexShrink: 0,
                    }}
                  >
                    p.{r.printedPage}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* PDF Canvas Viewport with Swipe & Page-only Right-edge Ribbon Tabs */}
      <div
        data-testid={`desk-pdf-swipe-stage-${card.id}`}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerEnd}
        onPointerCancel={handleStagePointerEnd}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <DeskPdfCanvas
          cardId={card.id}
          doc={doc}
          pdfPage={currentPdfPage}
          numPages={numPages}
          isVisible={isVisible}
          renderWidth={renderWidth}
          touchActionNone
        />

        {pageRibbons.length > 0 && (
          <div
            data-testid={`desk-pdf-edge-ribbons-${card.id}`}
            style={{
              position: 'absolute',
              top: '8px',
              right: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 3,
              pointerEvents: 'auto',
            }}
          >
            {pageRibbons.map((r) => (
              <button
                key={r.id}
                type="button"
                data-testid={`desk-pdf-edge-ribbon-${card.id}-${r.id}`}
                title={`${r.label} (p.${r.printedPage})`}
                onClick={(e) => {
                  e.stopPropagation();
                  goToPdfPage(r.pdfPage);
                }}
                style={{
                  minHeight: '44px',
                  maxWidth: '128px',
                  padding: '2px 10px',
                  borderRadius: '6px 0 0 6px',
                  border: '1px solid rgba(0,0,0,0.2)',
                  background: getPdfRibbonColorHex(r.color),
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
