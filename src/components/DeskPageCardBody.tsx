import React from 'react';
import { pdfToPrintedPage, printedToPdfPage } from '../lib/pdf';
import type { DeskCardRecord } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { DeskPdfCanvas, useSharedCampaignPdf } from './DeskPdfCanvas';

export interface DeskPageCardBodyProps {
  card: DeskCardRecord;
  isVisible: boolean;
  renderWidth: number;
  onGoToInPdf: (printedPage: number) => void;
}

export const DeskPageCardBody: React.FC<DeskPageCardBodyProps> = ({
  card,
  isVisible,
  renderWidth,
  onGoToInPdf,
}) => {
  const { merged } = useCampaignStore();
  const { doc, numPages, hasBlob, loading, error } = useSharedCampaignPdf();

  const pageOffset = merged.meta?.page_offset ?? 0;
  const printedPage = card.pageNumber ?? 1;
  const pdfPage = printedToPdfPage(printedPage, pageOffset, numPages || undefined);
  const displayPrintedPage = pdfToPrintedPage(pdfPage, pageOffset);

  if (!hasBlob && !loading) {
    return (
      <div
        data-testid={`desk-page-empty-${card.id}`}
        style={{
          flex: 1,
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          textAlign: 'center',
          padding: '16px',
          borderRadius: '8px',
          border: '1px dashed var(--line2)',
          background: 'var(--mapBg)',
          color: 'var(--muted)',
          fontSize: '13px',
        }}
      >
        <div>{error || `Detached page p.${printedPage}. Attach the source PDF to view it.`}</div>
        <button
          type="button"
          data-testid={`desk-page-goto-pdf-${card.id}`}
          onClick={() => onGoToInPdf(printedPage)}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--accent)',
            background: 'var(--accentBg)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Go to in PDF
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid={`desk-page-card-body-${card.id}`}
      style={{
        flex: 1,
        minHeight: 0,
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
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <span
          data-testid={`desk-page-number-${card.id}`}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Page {displayPrintedPage}
          {pageOffset !== 0 ? ` (PDF p.${pdfPage})` : ''}
        </span>

        <button
          type="button"
          data-testid={`desk-page-goto-pdf-${card.id}`}
          onClick={() => onGoToInPdf(displayPrintedPage)}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--accent)',
            background: 'var(--accentBg)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Go to in PDF
        </button>
      </div>

      <DeskPdfCanvas
        cardId={card.id}
        doc={doc}
        pdfPage={pdfPage}
        numPages={numPages}
        isVisible={isVisible}
        renderWidth={renderWidth}
      />
    </div>
  );
};
