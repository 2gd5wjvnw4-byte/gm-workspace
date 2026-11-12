import React from 'react';

export const ExitsBar: React.FC = () => {
  return (
    <div
      data-testid="zone-exits-bar"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--line)',
        background: 'var(--panel)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          letterSpacing: '.1em',
          color: 'var(--muted)',
          marginRight: '4px',
          textTransform: 'uppercase',
        }}
      >
        EXITS
      </span>
      <button
        type="button"
        style={{
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 14px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          border: '1px solid var(--accent)',
          background: 'var(--accentBg)',
          color: 'var(--accent)',
        }}
      >
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', opacity: 0.85 }}>DOOR</span>
        <span>ExitsBar placeholder · Corridor</span>
        <span style={{ fontSize: '11px', opacity: 0.85 }}>Open</span>
      </button>
    </div>
  );
};
