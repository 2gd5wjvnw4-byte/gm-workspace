import React from 'react';
import { EntitySheetContent } from './EntitySheetContent';
import { PdfDrawerContent } from './PdfDrawerContent';
import { PlayerSheetView } from './PlayerSheetView';

export type DrawerMode = 'pdf' | 'entity' | 'player-sheet' | null;

export interface DrawerHostProps {
  activeDrawer: DrawerMode;
  inspectedEntityId?: string | null;
  inspectedPlayerSheetId?: string | null;
  requestedPdfPage?: number | null;
  pdfOpenSeq?: number;
  onOpenPdfPage?: (printedPage: number) => void;
  onClose: () => void;
}

export const DrawerHost: React.FC<DrawerHostProps> = ({
  activeDrawer,
  inspectedEntityId = null,
  inspectedPlayerSheetId = null,
  requestedPdfPage = null,
  pdfOpenSeq = 0,
  onOpenPdfPage,
  onClose,
}) => {
  const isPdf = activeDrawer === 'pdf';
  const isEntity = activeDrawer === 'entity';
  const isPlayerSheet = activeDrawer === 'player-sheet';
  const width = isPdf || isPlayerSheet ? '480px' : '420px';
  const isOpen = isPdf || isEntity || isPlayerSheet;

  return (
    <>
      {isOpen && (
        <div
          data-testid="drawer-backdrop"
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            zIndex: 19,
          }}
        />
      )}
      <div
        data-testid="zone-drawer-host"
        aria-hidden={!isOpen}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          background: 'var(--panel)',
          borderLeft: isOpen ? '1px solid var(--line2)' : 'none',
          boxShadow: isOpen ? '-16px 0 40px rgba(0,0,0,.35)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease-out',
          pointerEvents: isOpen ? 'auto' : 'none',
          boxSizing: 'border-box',
        }}
      >
        {isPdf && (
          <PdfDrawerContent
            requestedPrintedPage={requestedPdfPage}
            openRequestSeq={pdfOpenSeq}
          />
        )}

        {isEntity && (
          <EntitySheetContent
            entityId={inspectedEntityId}
            showCloseButton
            onClose={onClose}
            onOpenPdfPage={onOpenPdfPage}
            testIdPrefix="inspector"
          />
        )}

        {isPlayerSheet && (
          <PlayerSheetView
            sheetId={inspectedPlayerSheetId}
            showCloseButton
            onClose={onClose}
            testIdPrefix="drawer-player-sheet"
          />
        )}
      </div>
    </>
  );
};
