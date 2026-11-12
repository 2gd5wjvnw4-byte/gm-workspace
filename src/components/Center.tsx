import React, { useState } from 'react';
import { ExitsBar } from './ExitsBar';
import type { MapDisplayMode } from '../storage/types';

export interface CenterProps {
  mapMode: MapDisplayMode;
  onOpenPdf: () => void;
}

export const Center: React.FC<CenterProps> = ({ mapMode, onOpenPdf }) => {
  const [readOpen, setReadOpen] = useState(true);

  return (
    <main
      data-testid="zone-center"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg)',
      }}
    >
      {mapMode !== 'off' && (
        <div
          data-testid="center-map-area"
          style={
            mapMode === 'pip'
              ? {
                  position: 'absolute',
                  right: '16px',
                  bottom: '84px',
                  width: '320px',
                  height: '220px',
                  zIndex: 5,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--line2)',
                  boxShadow: '0 12px 30px rgba(0,0,0,.35)',
                  background: 'var(--mapBg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }
              : mapMode === 'split'
                ? {
                    position: 'relative',
                    flexShrink: 0,
                    height: '360px',
                    overflow: 'hidden',
                    borderBottom: '1px solid var(--line)',
                    background: 'var(--mapBg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                : {
                    position: 'relative',
                    flex: 1,
                    overflow: 'hidden',
                    background: 'var(--mapBg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
          }
        >
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
            MAP AREA PLACEHOLDER ({mapMode.toUpperCase()})
          </span>
        </div>
      )}

      {mapMode !== 'full' && (
        <div
          data-testid="zone-scene-stage"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '13px',
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}
                >
                  scene-placeholder · #1
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: 'var(--violet)',
                    border: '1px solid var(--violetLine)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                  }}
                >
                  Physical Zone
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--head)',
                  fontSize: '30px',
                  fontWeight: 700,
                  letterSpacing: '-0.005em',
                  color: 'var(--text)',
                }}
              >
                Center Scene Stage Placeholder
              </h1>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'var(--tagBg)',
                    color: 'var(--tagText)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}
                >
                  App Shell Ready
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenPdf}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p2)',
                color: 'var(--text)',
                fontSize: '13px',
              }}
            >
              Book p.1
            </button>
          </div>

          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => setReadOpen((o) => !o)}
              aria-expanded={readOpen}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                width: '100%',
                boxSizing: 'border-box',
                alignItems: 'center',
                padding: '12px 14px',
                minHeight: '44px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  color: 'var(--muted)',
                  flex: 1,
                }}
              >
                READ-ALOUD
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {readOpen ? 'Tap to fold' : 'Tap to open'}
              </span>
            </button>
            {readOpen && (
              <p
                style={{
                  margin: 0,
                  padding: '0 14px 14px',
                  fontSize: '16px',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                  color: 'var(--readText)',
                }}
              >
                Center zone placeholder. Import a campaign module JSON to view read-aloud text, sensory details, interactive items, and hidden secrets.
              </p>
            )}
          </div>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                letterSpacing: '.1em',
                color: 'var(--muted)',
                fontWeight: 600,
              }}
            >
              TIER 1 · SENSORY
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '15px',
              }}
            >
              <li>Scene stage scrolls independently of LeftPanel, RightPanel, TopBar, and ExitsBar.</li>
            </ul>
          </section>

          <div
            style={{
              background: 'var(--panel)',
              border: '1px dashed var(--line2)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--muted)',
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.1em' }}>
              GM TIP ·{' '}
            </span>
            Use the Theme section in the right panel to switch between Sci-Fi Dark, Fantasy Light, and Fantasy Dark.
          </div>
        </div>
      )}

      <ExitsBar />
    </main>
  );
};
