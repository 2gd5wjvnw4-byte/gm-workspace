import React from 'react';
import type { ReviewEntry } from '../lib/import';
import { useCampaignStore } from '../store/campaignStore';

export interface ReviewSheetProps {
  open: boolean;
  onClose: () => void;
}

export const ReviewSheet: React.FC<ReviewSheetProps> = ({ open, onClose }) => {
  const { merged, chunks } = useCampaignStore();

  if (!open) return null;

  const grouped = new Map<string, ReviewEntry[]>();
  for (const entry of merged.review) {
    const list = grouped.get(entry.chunkId) ?? [];
    list.push(entry);
    grouped.set(entry.chunkId, list);
  }

  const chunkTitleFor = (chunkId: string): string => {
    const match = chunks.find((c) => c.chunkId === chunkId);
    return match ? `${match.chunkTitle} (${chunkId})` : chunkId;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review entries"
      data-testid="review-sheet"
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
          maxWidth: '680px',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--head)',
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              Review List
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid var(--goldLine)',
                background: 'var(--goldBg)',
                color: 'var(--gold)',
              }}
            >
              {merged.review.length}
            </span>
          </div>

          <button
            type="button"
            data-testid="close-review-sheet-btn"
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

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {merged.review.length === 0 ? (
            <div
              style={{
                color: 'var(--muted)',
                textAlign: 'center',
                padding: '24px',
              }}
            >
              No review items.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([chunkId, entries]) => (
              <section
                key={chunkId}
                data-testid={`review-group-${chunkId}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                  }}
                >
                  {chunkTitleFor(chunkId)}
                </div>

                {entries.map((entry, idx) => {
                  const isWarn = entry.severity === 'warn';
                  return (
                    <div
                      key={`${entry.recordId}-${entry.field}-${idx}`}
                      data-testid="review-entry-row"
                      style={{
                        background: 'var(--p2)',
                        border: '1px solid var(--line)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          data-testid="review-entry-severity"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            border: isWarn
                              ? '1px solid var(--goldLine)'
                              : '1px solid var(--tealLine)',
                            background: isWarn ? 'var(--goldBg)' : 'var(--tealBg)',
                            color: isWarn ? 'var(--gold)' : 'var(--teal)',
                          }}
                        >
                          {entry.severity}
                        </span>
                        <span
                          data-testid="review-entry-record"
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--accent)',
                          }}
                        >
                          {entry.recordId}
                        </span>
                        <span
                          data-testid="review-entry-field"
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '12px',
                            color: 'var(--muted)',
                          }}
                        >
                          · {entry.field}
                        </span>
                      </div>
                      <div
                        data-testid="review-entry-message"
                        style={{
                          fontSize: '13px',
                          color: 'var(--text)',
                        }}
                      >
                        {entry.message}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
