import React, { useEffect, useRef, useState } from 'react';
import {
  acquireSharedPdfDocument,
  loadPdfDocument,
  releasePdfCanvasMemory,
  renderPdfPageToCanvas,
  type PdfDocumentProxy,
} from '../lib/pdf';
import { playerSheetKindLabel } from '../lib/playerSheets';
import { playTactileClick } from '../lib/sound';
import { getBlob } from '../storage';
import type { PlayerSheetRecord, SheetOverlayKind } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { useBlobObjectUrl } from './MapLibrarySheet';
import {
  SheetOverlayInspector,
  SheetOverlayLayer,
  SheetOverlayToolbar,
} from './SheetOverlayLayer';

export interface PlayerSheetViewProps {
  sheetId: string | null;
  showCloseButton?: boolean;
  onClose?: () => void;
  onDeleted?: () => void;
  testIdPrefix?: string;
  isVisible?: boolean;
  renderWidth?: number;
}

const PdfSheetRenderer: React.FC<{
  sheet: PlayerSheetRecord;
  testIdPrefix: string;
  isVisible: boolean;
  renderWidth: number;
  onChangePage: (page: number, pageCount?: number) => void;
}> = ({ sheet, testIdPrefix, isVisible, renderWidth, onChangePage }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(sheet.pageCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [editPins, setEditPins] = useState(false);
  const [placementTool, setPlacementTool] = useState<SheetOverlayKind | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  const currentPage = Math.max(1, sheet.currentPage ?? 1);

  useEffect(() => {
    setEditPins(false);
    setPlacementTool(null);
    setSelectedOverlayId(null);
  }, [sheet.id]);

  useEffect(() => {
    setSelectedOverlayId(null);
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    if (!sheet.blobKey) {
      setDoc(null);
      setNumPages(0);
      setError('PDF file is missing.');
      return;
    }

    setLoading(true);
    setError(null);
    const cacheKey = `player-sheet:${sheet.blobKey}`;
    void acquireSharedPdfDocument(
      cacheKey,
      async () => {
        const record = await getBlob(sheet.blobKey!);
        return record ? record.data : null;
      },
      loadPdfDocument
    )
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setDoc(null);
          setNumPages(0);
          setError('PDF file not found in local storage.');
        } else {
          setDoc(loaded);
          setNumPages(loaded.numPages);
          if (sheet.pageCount !== loaded.numPages) {
            onChangePage(Math.min(currentPage, loaded.numPages), loaded.numPages);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDoc(null);
        setNumPages(0);
        setError(err instanceof Error ? err.message : 'Could not open PDF sheet.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.blobKey]);

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

    const safePage = numPages > 0 ? Math.min(numPages, Math.max(1, currentPage)) : 1;
    const task = renderPdfPageToCanvas(doc, safePage, canvas, Math.max(200, renderWidth), {
      fitCssToContainer: true,
    });
    let cancelled = false;
    void task.promise
      .then(() => {
        if (!cancelled) setRendered(true);
      })
      .catch(() => {
        // Ignore cancelled renders on page/size change
      });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [doc, currentPage, numPages, isVisible, renderWidth]);

  const canPrev = currentPage > 1;
  const canNext = numPages > 0 && currentPage < numPages;
  const selectedOverlay =
    (sheet.overlays ?? []).find(
      (o) => o.id === selectedOverlayId && (o.page ?? 1) === currentPage
    ) ?? null;

  return (
    <div
      data-testid={`${testIdPrefix}-pdf-view`}
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
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-testid={`${testIdPrefix}-pdf-prev`}
            disabled={!canPrev}
            onClick={() => {
              playTactileClick();
              onChangePage(Math.max(1, currentPage - 1));
            }}
            style={{
              minWidth: '64px',
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: canPrev ? 'var(--text)' : 'var(--faint)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: canPrev ? 'pointer' : 'not-allowed',
            }}
          >
            Prev
          </button>
          <span
            data-testid={`${testIdPrefix}-pdf-page-readout`}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            {numPages > 0 ? `Page ${currentPage} / ${numPages}` : `Page ${currentPage}`}
          </span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-pdf-next`}
            disabled={!canNext}
            onClick={() => {
              playTactileClick();
              onChangePage(numPages > 0 ? Math.min(numPages, currentPage + 1) : currentPage + 1);
            }}
            style={{
              minWidth: '64px',
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: canNext ? 'var(--text)' : 'var(--faint)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: canNext ? 'pointer' : 'not-allowed',
            }}
          >
            Next
          </button>
        </div>

        <button
          type="button"
          data-testid={`${testIdPrefix}-overlay-edit-toggle`}
          aria-pressed={editPins}
          onClick={() => {
            playTactileClick();
            setEditPins((prev) => {
              const next = !prev;
              if (!next) {
                setPlacementTool(null);
                setSelectedOverlayId(null);
              }
              return next;
            });
          }}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '8px',
            border: editPins ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: editPins ? 'var(--accentBg)' : 'var(--p3)',
            color: editPins ? 'var(--accent)' : 'var(--text)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {editPins ? 'Lock pins' : 'Edit pins'}
        </button>
      </div>

      {editPins && (
        <SheetOverlayToolbar
          placementTool={placementTool}
          onSelectTool={setPlacementTool}
          testIdPrefix={testIdPrefix}
        />
      )}

      {loading && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '13px',
          }}
        >
          Loading PDF…
        </div>
      )}

      {error && (
        <div
          data-testid={`${testIdPrefix}-pdf-error`}
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--redBg)',
            border: '1px solid var(--redLine)',
            color: 'var(--red)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {!error && (
        <div
          data-pdf-rendered={rendered ? 'true' : 'false'}
          style={{
            flex: 1,
            minHeight: '160px',
            overflow: 'auto',
            padding: '8px',
            background: 'var(--mapBg)',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          {isVisible ? (
            <div
              data-testid={`${testIdPrefix}-pdf-surface`}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '100%',
              }}
            >
              <canvas
                ref={canvasRef}
                data-testid={`${testIdPrefix}-pdf-canvas`}
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '4px',
                }}
              />
              <SheetOverlayLayer
                sheetId={sheet.id}
                sheetKind="pdf"
                currentPage={currentPage}
                overlays={sheet.overlays}
                editMode={editPins}
                placementTool={placementTool}
                selectedOverlayId={selectedOverlayId}
                onPlaced={(created) => {
                  setPlacementTool(null);
                  setSelectedOverlayId(created.id);
                }}
                onSelectOverlay={setSelectedOverlayId}
                testIdPrefix={testIdPrefix}
              />
            </div>
          ) : (
            <div style={{ padding: '16px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
              Page {currentPage} (off-screen)
            </div>
          )}
        </div>
      )}

      {editPins && (
        <SheetOverlayInspector
          sheetId={sheet.id}
          selectedOverlay={selectedOverlay}
          onClearSelection={() => setSelectedOverlayId(null)}
          testIdPrefix={testIdPrefix}
        />
      )}
    </div>
  );
};

const ImageSheetRenderer: React.FC<{
  sheet: PlayerSheetRecord;
  testIdPrefix: string;
}> = ({ sheet, testIdPrefix }) => {
  const url = useBlobObjectUrl(sheet.blobKey);
  const [zoomPct, setZoomPct] = useState(100);
  const [editPins, setEditPins] = useState(false);
  const [placementTool, setPlacementTool] = useState<SheetOverlayKind | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  useEffect(() => {
    setEditPins(false);
    setPlacementTool(null);
    setSelectedOverlayId(null);
  }, [sheet.id]);

  const selectedOverlay =
    (sheet.overlays ?? []).find((o) => o.id === selectedOverlayId) ?? null;

  return (
    <div
      data-testid={`${testIdPrefix}-image-view`}
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
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: '80px',
            flex: 1,
          }}
        >
          {sheet.fileName || 'Image sheet'}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid={`${testIdPrefix}-overlay-edit-toggle`}
            aria-pressed={editPins}
            onClick={() => {
              playTactileClick();
              setEditPins((prev) => {
                const next = !prev;
                if (!next) {
                  setPlacementTool(null);
                  setSelectedOverlayId(null);
                }
                return next;
              });
            }}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: editPins ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: editPins ? 'var(--accentBg)' : 'var(--p3)',
              color: editPins ? 'var(--accent)' : 'var(--text)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {editPins ? 'Lock pins' : 'Edit pins'}
          </button>
          <button
            type="button"
            aria-label="Zoom out image sheet"
            onClick={() => setZoomPct((z) => Math.max(50, z - 25))}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset image sheet zoom"
            onClick={() => setZoomPct(100)}
            style={{
              minWidth: '52px',
              height: '44px',
              padding: '0 8px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p2)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            aria-label="Zoom in image sheet"
            onClick={() => setZoomPct((z) => Math.min(250, z + 25))}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {editPins && (
        <SheetOverlayToolbar
          placementTool={placementTool}
          onSelectTool={setPlacementTool}
          testIdPrefix={testIdPrefix}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: '160px',
          overflow: 'auto',
          padding: '8px',
          background: 'var(--mapBg)',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: zoomPct > 100 ? 'flex-start' : 'center',
        }}
      >
        {url ? (
          <div
            data-testid={`${testIdPrefix}-image-surface`}
            data-zoom-pct={String(zoomPct)}
            style={{
              position: 'relative',
              width: `${zoomPct}%`,
              maxWidth: zoomPct === 100 ? '100%' : 'none',
              flexShrink: 0,
            }}
          >
            <img
              src={url}
              alt={sheet.name}
              data-testid={`${testIdPrefix}-image-el`}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                borderRadius: '6px',
              }}
            />
            <SheetOverlayLayer
              sheetId={sheet.id}
              sheetKind="image"
              currentPage={1}
              overlays={sheet.overlays}
              editMode={editPins}
              placementTool={placementTool}
              selectedOverlayId={selectedOverlayId}
              onPlaced={(created) => {
                setPlacementTool(null);
                setSelectedOverlayId(created.id);
              }}
              onSelectOverlay={setSelectedOverlayId}
              testIdPrefix={testIdPrefix}
            />
          </div>
        ) : (
          <div
            data-testid={`${testIdPrefix}-image-loading`}
            style={{
              padding: '16px',
              color: 'var(--muted)',
              fontSize: '13px',
            }}
          >
            Loading image sheet…
          </div>
        )}
      </div>

      {editPins && (
        <SheetOverlayInspector
          sheetId={sheet.id}
          selectedOverlay={selectedOverlay}
          onClearSelection={() => setSelectedOverlayId(null)}
          testIdPrefix={testIdPrefix}
        />
      )}
    </div>
  );
};

export const PlayerSheetView: React.FC<PlayerSheetViewProps> = ({
  sheetId,
  showCloseButton = false,
  onClose,
  onDeleted,
  testIdPrefix = 'player-sheet',
  isVisible = true,
  renderWidth = 420,
}) => {
  const {
    live,
    updatePlayerSheet,
    adjustPlayerSheetTrack,
    updatePlayerSheetTrack,
    addPlayerSheetTrack,
    removePlayerSheetTrack,
    deletePlayerSheet,
  } = useCampaignStore();

  const sheet = (live?.playerSheets ?? []).find((s) => s.id === sheetId) ?? null;

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftStatLine, setDraftStatLine] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [newTrackLabel, setNewTrackLabel] = useState('');
  const [newTrackMax, setNewTrackMax] = useState('6');

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [sheetId]);

  if (!sheet) {
    return (
      <div
        data-testid={`${testIdPrefix}-empty`}
        style={{
          padding: '16px',
          color: 'var(--muted)',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        Player sheet not found.
      </div>
    );
  }

  const startEdit = () => {
    playTactileClick();
    setDraftName(sheet.name);
    setDraftRole(sheet.role ?? '');
    setDraftStatLine(sheet.statLine ?? '');
    setDraftNotes(sheet.notes ?? '');
    setEditing(true);
  };

  const saveEdit = () => {
    playTactileClick();
    updatePlayerSheet(sheet.id, {
      name: draftName.trim() || sheet.name,
      role: draftRole.trim(),
      statLine: draftStatLine.trim(),
      notes: draftNotes.trim(),
    });
    setEditing(false);
  };

  const handleConfirmDelete = async () => {
    playTactileClick();
    await deletePlayerSheet(sheet.id);
    setConfirmDelete(false);
    onDeleted?.();
    onClose?.();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '44px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box',
  };

  return (
    <div
      data-testid={`${testIdPrefix}-view`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px',
        gap: '12px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0,
          paddingBottom: '10px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2
              data-testid={`${testIdPrefix}-name`}
              style={{
                margin: 0,
                fontFamily: 'var(--head)',
                fontSize: '20px',
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {sheet.name}
            </h2>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'var(--tealBg)',
                border: '1px solid var(--tealLine)',
                color: 'var(--teal)',
              }}
            >
              PC · {playerSheetKindLabel(sheet.kind)}
            </span>
          </div>
          {sheet.kind === 'prebuilt' && sheet.role && (
            <div
              data-testid={`${testIdPrefix}-role`}
              style={{
                marginTop: '3px',
                fontSize: '13px',
                color: 'var(--muted)',
              }}
            >
              {sheet.role}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {sheet.kind === 'prebuilt' && !editing && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-edit-btn`}
              onClick={startEdit}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            data-testid={`${testIdPrefix}-delete-btn`}
            onClick={() => {
              playTactileClick();
              setConfirmDelete(true);
            }}
            style={{
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--redLine)',
              background: 'var(--redBg)',
              color: 'var(--red)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-close-btn`}
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* In-app delete confirmation */}
      {confirmDelete && (
        <div
          data-testid={`${testIdPrefix}-delete-confirm`}
          role="alertdialog"
          aria-label="Confirm delete player sheet"
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--redBg)',
            border: '1px solid var(--redLine)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--red)' }}>
            Delete “{sheet.name}”? This cannot be undone.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              data-testid={`${testIdPrefix}-delete-cancel`}
              onClick={() => setConfirmDelete(false)}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid={`${testIdPrefix}-delete-confirm-btn`}
              onClick={() => void handleConfirmDelete()}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--red)',
                background: 'var(--red)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* Body by kind */}
      {sheet.kind === 'image' && (
        <ImageSheetRenderer sheet={sheet} testIdPrefix={testIdPrefix} />
      )}

      {sheet.kind === 'pdf' && (
        <PdfSheetRenderer
          sheet={sheet}
          testIdPrefix={testIdPrefix}
          isVisible={isVisible}
          renderWidth={renderWidth}
          onChangePage={(page, pageCount) =>
            updatePlayerSheet(sheet.id, {
              currentPage: page,
              ...(pageCount !== undefined ? { pageCount } : {}),
            })
          }
        />
      )}

      {sheet.kind === 'prebuilt' && (
        <div
          data-testid={`${testIdPrefix}-prebuilt-body`}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  NAME
                </span>
                <input
                  type="text"
                  data-testid={`${testIdPrefix}-edit-name`}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  ROLE / CLASS
                </span>
                <input
                  type="text"
                  data-testid={`${testIdPrefix}-edit-role`}
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  STAT LINE
                </span>
                <input
                  type="text"
                  data-testid={`${testIdPrefix}-edit-statline`}
                  value={draftStatLine}
                  onChange={(e) => setDraftStatLine(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  NOTES
                </span>
                <textarea
                  data-testid={`${testIdPrefix}-edit-notes`}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, minHeight: '96px', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-save-edit-btn`}
                  onClick={saveEdit}
                  style={{
                    height: '44px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--accent)',
                    background: 'var(--accent)',
                    color: 'var(--onAccent)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {sheet.statLine && (
                <div
                  data-testid={`${testIdPrefix}-statline`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    fontFamily: 'var(--mono)',
                    fontSize: '13px',
                    lineHeight: 1.45,
                  }}
                >
                  {sheet.statLine}
                </div>
              )}

              {/* Tracks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Tracks
                </div>

                {(sheet.tracks ?? []).map((track) => (
                  <div
                    key={track.id}
                    data-testid={`${testIdPrefix}-track-${track.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: 'var(--p2)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {track.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        data-testid={`${testIdPrefix}-track-dec-${track.id}`}
                        aria-label={`Decrease ${track.label}`}
                        onClick={() => {
                          playTactileClick();
                          adjustPlayerSheetTrack(sheet.id, track.id, -1);
                        }}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          background: 'var(--p3)',
                          color: 'var(--text)',
                          fontSize: '18px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        −
                      </button>
                      <span
                        data-testid={`${testIdPrefix}-track-val-${track.id}`}
                        style={{
                          minWidth: '54px',
                          textAlign: 'center',
                          fontFamily: 'var(--mono)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '15px',
                          fontWeight: 700,
                        }}
                      >
                        {track.current}/{track.max}
                      </span>
                      <button
                        type="button"
                        data-testid={`${testIdPrefix}-track-inc-${track.id}`}
                        aria-label={`Increase ${track.label}`}
                        onClick={() => {
                          playTactileClick();
                          adjustPlayerSheetTrack(sheet.id, track.id, 1);
                        }}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          background: 'var(--p3)',
                          color: 'var(--text)',
                          fontSize: '18px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${track.label} track`}
                        data-testid={`${testIdPrefix}-track-del-${track.id}`}
                        onClick={() => {
                          playTactileClick();
                          removePlayerSheetTrack(sheet.id, track.id);
                        }}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          background: 'transparent',
                          color: 'var(--muted)',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {/* Quick add track row */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    data-testid={`${testIdPrefix}-new-track-label`}
                    value={newTrackLabel}
                    onChange={(e) => setNewTrackLabel(e.target.value)}
                    placeholder="Add track (e.g. Stress)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    min={1}
                    data-testid={`${testIdPrefix}-new-track-max`}
                    value={newTrackMax}
                    onChange={(e) => setNewTrackMax(e.target.value)}
                    aria-label="New track max"
                    style={{ ...inputStyle, width: '72px', fontFamily: 'var(--mono)' }}
                  />
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-new-track-add`}
                    onClick={() => {
                      const label = newTrackLabel.trim();
                      if (!label) return;
                      playTactileClick();
                      const maxNum = Number.parseInt(newTrackMax, 10);
                      addPlayerSheetTrack(sheet.id, {
                        label,
                        max: Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 6,
                      });
                      setNewTrackLabel('');
                    }}
                    style={{
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--accent)',
                      background: 'var(--accentBg)',
                      color: 'var(--accent)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    + Add
                  </button>
                </div>

                {/* Also allow editing max inline if tracks exist */}
                {(sheet.tracks ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(sheet.tracks ?? []).map((track) => (
                      <button
                        key={`max-${track.id}`}
                        type="button"
                        data-testid={`${testIdPrefix}-track-max-inc-${track.id}`}
                        onClick={() => {
                          playTactileClick();
                          updatePlayerSheetTrack(sheet.id, track.id, {
                            max: track.max + 1,
                          });
                        }}
                        style={{
                          minHeight: '44px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          color: 'var(--muted)',
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        {track.label} max +1
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {sheet.notes && (
                <div
                  data-testid={`${testIdPrefix}-notes`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--p2)',
                    border: '1px solid var(--line)',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {sheet.notes}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
