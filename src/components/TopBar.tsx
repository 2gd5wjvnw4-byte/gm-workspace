import React from 'react';
import type { MapDisplayMode } from '../storage/types';

export interface TopBarProps {
  campaignLabel?: string;
  reviewCount?: number;
  onOpenActSwitcher?: () => void;
  onOpenReview?: () => void;
  mapMode: MapDisplayMode;
  onSelectMapMode: (mode: MapDisplayMode) => void;
  soloMask: boolean;
  onToggleSoloMask: () => void;
  onOpenPdf: () => void;
}

const MAP_MODES: Array<{ id: MapDisplayMode; label: string }> = [
  { id: 'off', label: 'Text' },
  { id: 'pip', label: 'PiP' },
  { id: 'split', label: 'Split' },
  { id: 'full', label: 'Map' },
];

export const TopBar: React.FC<TopBarProps> = ({
  campaignLabel = 'TopBar · No module loaded',
  reviewCount = 0,
  onOpenActSwitcher,
  onOpenReview,
  mapMode,
  onSelectMapMode,
  soloMask,
  onToggleSoloMask,
  onOpenPdf,
}) => {
  return (
    <header
      data-testid="zone-topbar"
      style={{
        height: '64px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
        padding: '0 14px 4px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Brand block */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          GM WORKSPACE
        </span>
        <button
          type="button"
          data-testid="act-switcher-btn"
          onClick={onOpenActSwitcher}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: 'var(--head)',
            fontWeight: 700,
            fontSize: '15px',
            color: 'var(--text)',
            minHeight: '28px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {campaignLabel} ▾
        </button>
      </div>

      {/* 2. Tracker steppers placeholder */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--p2)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '2px',
          }}
        >
          <button
            type="button"
            aria-label="Decrease Day"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '20px',
            }}
          >
            −
          </button>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '62px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Day</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: 600 }}>1</span>
          </div>
          <button
            type="button"
            aria-label="Increase Day"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '20px',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* 3. Search field */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '0 12px',
          height: '44px',
          minWidth: '100px',
          boxSizing: 'border-box',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          style={{ color: 'var(--muted)', flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <label htmlFor="gm-search" className="gm-sr">
          Search the module
        </label>
        <input
          id="gm-search"
          type="search"
          placeholder="Search…"
          style={{
            all: 'unset',
            flex: 1,
            minWidth: 0,
            color: 'var(--text)',
            fontSize: '14px',
          }}
        />
      </div>

      {/* 4. Review button (hidden when count is 0) */}
      {reviewCount > 0 && (
        <button
          type="button"
          data-testid="review-btn"
          onClick={onOpenReview}
          style={{
            height: '44px',
            padding: '0 10px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Review {reviewCount}
        </button>
      )}

      {/* 5. Map mode segmented control */}
      <div
        style={{
          display: 'flex',
          background: 'var(--p2)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '2px',
          gap: '2px',
        }}
        role="group"
        aria-label="Map view"
      >
        {MAP_MODES.map((m) => {
          const active = mapMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMapMode(m.id)}
              aria-pressed={active}
              style={{
                height: '44px',
                minWidth: '48px',
                padding: '0 8px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--onAccent)' : 'var(--text)',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 6. Solo Mask toggle */}
      <button
        type="button"
        onClick={onToggleSoloMask}
        aria-pressed={soloMask}
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 12px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          border: soloMask ? '1px solid var(--violet)' : '1px solid var(--line)',
          background: soloMask ? 'var(--violetBg)' : 'var(--p2)',
          color: soloMask ? 'var(--violet)' : 'var(--text)',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{soloMask ? 'Solo' : 'GM'}</span>
      </button>

      {/* 7. PDF button */}
      <button
        type="button"
        onClick={onOpenPdf}
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 12px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          background: 'var(--p2)',
          color: 'var(--text)',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" />
          <path d="M4 19V5" />
        </svg>
        PDF
      </button>
    </header>
  );
};
