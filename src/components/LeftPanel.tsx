import React from 'react';
import type { NavViewMode } from '../storage/types';

export interface LeftPanelProps {
  navView: NavViewMode;
  onSelectNavView: (view: NavViewMode) => void;
  onOpenEntityInspector: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  navView,
  onSelectNavView,
  onOpenEntityInspector,
}) => {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: '44px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
    background: active ? 'var(--accentBg)' : 'var(--p2)',
    color: active ? 'var(--accent)' : 'var(--text)',
  });

  return (
    <aside
      data-testid="zone-left-panel"
      style={{
        width: '300px',
        flexShrink: 0,
        background: 'var(--panel)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ padding: '12px 12px 8px', display: 'flex', gap: '4px' }}>
        <button
          type="button"
          onClick={() => onSelectNavView('list')}
          aria-pressed={navView === 'list'}
          style={tabStyle(navView === 'list')}
        >
          Scene List
        </button>
        <button
          type="button"
          onClick={() => onSelectNavView('nodes')}
          aria-pressed={navView === 'nodes'}
          style={tabStyle(navView === 'nodes')}
        >
          Node Map
        </button>
      </div>

      {navView === 'list' ? (
        <div
          style={{
            padding: '0 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '.1em',
              color: 'var(--muted)',
              padding: '8px 4px 2px',
              textTransform: 'uppercase',
            }}
          >
            LEFT PANEL · SCENE LIST
          </div>
          <div
            style={{
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '10px',
              fontSize: '14px',
              color: 'var(--text)',
              background: 'var(--accentBg)',
              border: '1px solid var(--accent)',
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', width: '44px', flexShrink: 0 }}>
              #1
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>Placeholder Scene</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: '6px',
                padding: '2px 6px',
              }}
            >
              Here
            </span>
          </div>
          <p style={{ margin: '4px', fontSize: '13px', color: 'var(--muted)' }}>
            LeftPanel placeholder — import a module JSON in Phase 2 to populate scenes.
          </p>
        </div>
      ) : (
        <div
          style={{
            margin: '0 12px 12px',
            height: '440px',
            position: 'relative',
            background: 'var(--mapBg)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
            Node Map placeholder (440px canvas)
          </span>
          <div
            style={{
              position: 'absolute',
              left: '10px',
              bottom: '8px',
              fontSize: '11px',
              color: 'var(--muted)',
              background: 'var(--mapBg)',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            Pinch to zoom · drag to move · 100%
          </div>
        </div>
      )}

      <div
        style={{
          borderTop: '1px solid var(--line)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.1em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          IN THIS SCENE
        </div>
        <div
          style={{
            background: 'var(--p2)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <button
            type="button"
            onClick={onOpenEntityInspector}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '44px',
            }}
          >
            <span style={{ fontWeight: 600, flex: 1 }}>Placeholder Entity (tap to inspect)</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--muted)',
                border: '1px solid var(--line2)',
                borderRadius: '6px',
                padding: '2px 6px',
              }}
            >
              Neutral
            </span>
          </button>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            No entities loaded yet.
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.1em',
            color: 'var(--muted)',
            marginTop: '4px',
            textTransform: 'uppercase',
          }}
        >
          ROAMING
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          No roaming entities loaded yet.
        </div>
      </div>
    </aside>
  );
};
