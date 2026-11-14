import React, { useRef, useState } from 'react';
import { formatCarryOverIds } from '../lib/import';
import { useCampaignStore } from '../store/campaignStore';

export interface ActSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
}

export const ActSwitcherSheet: React.FC<ActSwitcherSheetProps> = ({ open, onClose }) => {
  const {
    activeCampaign,
    chunks,
    merged,
    importJsonChunk,
    removeChunk,
    closeCampaign,
    errorMessage,
    clearError,
  } = useCampaignStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportedText, setExportedText] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  if (!open) return null;

  const handleRemoveChunk = async (chunkId: string) => {
    setDeletingIds((prev) => ({ ...prev, [chunkId]: true }));
    try {
      await removeChunk(chunkId);
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[chunkId];
        return next;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusNotice(null);
    clearError();
    try {
      const text =
        typeof file.text === 'function'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result ?? ''));
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsText(file);
            });
      await importJsonChunk(text);
      setStatusNotice(`Imported "${file.name}".`);
    } catch {
      // errorMessage is populated in campaignStore
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportCarryOver = async () => {
    const text = formatCarryOverIds(merged);
    setExportedText(text);

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const moduleId = merged.meta?.module_id || activeCampaign?.moduleId || 'campaign';
        link.href = url;
        link.download = `${moduleId}-carry-over-ids.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Fallback preview is shown below
    }

    setStatusNotice(
      copied
        ? 'Carry-over IDs copied to clipboard and downloaded.'
        : 'Carry-over IDs exported.'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Campaign chunks and actions"
      data-testid="act-switcher-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '48px',
        zIndex: 40,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '.1em',
                color: 'var(--muted)',
              }}
            >
              Loaded Chunks
            </span>
            <span
              style={{
                fontFamily: 'var(--head)',
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              {activeCampaign?.title ?? 'Campaign'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              data-testid="switch-campaign-btn"
              onClick={() => {
                onClose();
                closeCampaign();
              }}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p2)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All campaigns
            </button>
            <button
              type="button"
              data-testid="close-act-sheet-btn"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Actions row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              data-testid="import-json-input"
              onChange={(e) => void handleFileChange(e)}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              data-testid="import-json-btn"
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
              Import JSON
            </button>

            <button
              type="button"
              data-testid="export-carry-over-btn"
              onClick={() => void handleExportCarryOver()}
              style={{
                height: '44px',
                padding: '0 16px',
                borderRadius: '10px',
                border: '1px solid var(--tealLine)',
                background: 'var(--tealBg)',
                color: 'var(--teal)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Export carry-over IDs
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              data-testid="import-error-alert"
              style={{
                background: 'var(--redBg)',
                border: '1px solid var(--redLine)',
                color: 'var(--red)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {statusNotice && (
            <div
              data-testid="act-sheet-notice"
              style={{
                background: 'var(--tealBg)',
                border: '1px solid var(--tealLine)',
                color: 'var(--teal)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            >
              {statusNotice}
            </div>
          )}

          {/* Chunk list */}
          {chunks.length === 0 ? (
            <div
              data-testid="no-chunks-msg"
              style={{
                background: 'var(--p2)',
                border: '1px dashed var(--line2)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--muted)',
              }}
            >
              No chunks loaded yet. Tap &ldquo;Import JSON&rdquo; to load a module chunk.
            </div>
          ) : (
            <div
              data-testid="loaded-chunks-list"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {chunks.map((chunkRow) => {
                const parsedMeta = merged.chunks.find(
                  (c) => c.meta.chunk_id === chunkRow.chunkId
                )?.meta;
                const pages = chunkRow.chunkPages ?? parsedMeta?.chunk_pages ?? '—';
                const isComplete =
                  (chunkRow.complete ?? parsedMeta?.complete ?? true) !== false;
                const stoppedPage =
                  chunkRow.stoppedAtPage ?? parsedMeta?.stopped_at_page ?? null;

                return (
                  <div
                    key={chunkRow.id}
                    data-testid={`chunk-row-${chunkRow.chunkId}`}
                    style={{
                      background: 'var(--p2)',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      padding: '12px 14px',
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
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>
                            {chunkRow.chunkTitle}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '11px',
                              color: 'var(--muted)',
                            }}
                          >
                            ({chunkRow.chunkId})
                          </span>
                          <span
                            data-testid={`chunk-badge-${chunkRow.chunkId}`}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: isComplete
                                ? '1px solid var(--tealLine)'
                                : '1px solid var(--goldLine)',
                              background: isComplete ? 'var(--tealBg)' : 'var(--goldBg)',
                              color: isComplete ? 'var(--teal)' : 'var(--gold)',
                            }}
                          >
                            {isComplete ? 'Complete' : 'Incomplete'}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          Pages: {pages || '—'} · Imported{' '}
                          {new Date(chunkRow.importedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`remove-chunk-${chunkRow.chunkId}`}
                        disabled={Boolean(deletingIds[chunkRow.chunkId])}
                        onClick={() => void handleRemoveChunk(chunkRow.chunkId)}
                        style={{
                          height: '44px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--redLine)',
                          background: 'var(--redBg)',
                          color: 'var(--red)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: deletingIds[chunkRow.chunkId] ? 'default' : 'pointer',
                          opacity: deletingIds[chunkRow.chunkId] ? 0.6 : 1,
                        }}
                      >
                        Remove chunk
                      </button>
                    </div>

                    {!isComplete && (
                      <div
                        data-testid={`chunk-incomplete-banner-${chunkRow.chunkId}`}
                        style={{
                          background: 'var(--deltaBg)',
                          border: '1px solid var(--gold)',
                          color: 'var(--deltaText)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '12px',
                        }}
                      >
                        Warning: This chunk is marked incomplete
                        {stoppedPage !== null ? ` (stopped at printed page ${stoppedPage})` : ''}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {exportedText !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Carry-over IDs output
              </span>
              <pre
                data-testid="carry-over-output"
                style={{
                  margin: 0,
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {exportedText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
