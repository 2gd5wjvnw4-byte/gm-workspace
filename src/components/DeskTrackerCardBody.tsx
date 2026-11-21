import React from 'react';
import { playTactileClick } from '../lib/sound';
import type { DeskCardRecord } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export interface DeskTrackerCardBodyProps {
  card: DeskCardRecord;
  onSelectTracker: (trackerId: string, title: string) => void;
}

export const DeskTrackerCardBody: React.FC<DeskTrackerCardBodyProps> = ({
  card,
  onSelectTracker,
}) => {
  const { merged, live, adjustTrackerValue } = useCampaignStore();
  const trackers = merged.trackers;

  if (trackers.length === 0) {
    return (
      <div
        data-testid={`desk-tracker-empty-${card.id}`}
        style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--p2)',
          border: '1px dashed var(--line2)',
          color: 'var(--muted)',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        No trackers in this campaign.
      </div>
    );
  }

  const activeTracker =
    trackers.find((t) => t.id === card.targetId) ?? trackers[0];
  const value = live?.trackerValues?.[activeTracker.id] ?? activeTracker.start;
  const min = activeTracker.min;
  const max = activeTracker.max;

  const handleStep = (delta: number) => {
    playTactileClick();
    adjustTrackerValue(activeTracker.id, delta, min, max);
  };

  return (
    <div
      data-testid={`desk-tracker-body-${card.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {trackers.length > 1 && (
        <select
          aria-label="Select tracker"
          data-testid={`desk-tracker-select-${card.id}`}
          value={activeTracker.id}
          onChange={(e) => {
            const next = trackers.find((t) => t.id === e.target.value);
            if (next) {
              onSelectTracker(next.id, next.label);
            }
          }}
          style={{
            height: '44px',
            borderRadius: '8px',
            border: '1px solid var(--line2)',
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: '0 10px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {trackers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'var(--p2)',
          border: '1px solid var(--line)',
        }}
      >
        <button
          type="button"
          data-testid={`desk-tracker-dec-${card.id}`}
          aria-label={`Decrease ${activeTracker.label}`}
          disabled={value <= min}
          onClick={() => handleStep(-1)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--p3)',
            color: value <= min ? 'var(--faint)' : 'var(--text)',
            fontSize: '20px',
            fontWeight: 700,
            cursor: value <= min ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          −
        </button>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {activeTracker.label}
          </span>
          <span
            data-testid={`desk-tracker-value-${card.id}`}
            className="gm-tabular"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1.15,
            }}
          >
            {value}
          </span>
          <span
            className="gm-tabular"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              color: 'var(--muted)',
            }}
          >
            {min}–{max}
          </span>
        </div>

        <button
          type="button"
          data-testid={`desk-tracker-inc-${card.id}`}
          aria-label={`Increase ${activeTracker.label}`}
          disabled={value >= max}
          onClick={() => handleStep(1)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--p3)',
            color: value >= max ? 'var(--faint)' : 'var(--text)',
            fontSize: '20px',
            fontWeight: 700,
            cursor: value >= max ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
};
