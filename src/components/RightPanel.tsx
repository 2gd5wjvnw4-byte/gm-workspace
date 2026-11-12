import React, { useEffect, useState } from 'react';
import { THEMES, THEME_ORDER, useThemeStore } from '../store/themeStore';

export const RightPanel: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1200 : false
  );
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 1200;
      setIsCompact(compact);
      if (!compact) {
        setOverlayOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sectionHeaderStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    letterSpacing: '.1em',
    color: 'var(--muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
  };

  const placeholderCardStyle: React.CSSProperties = {
    background: 'var(--p2)',
    border: '1px solid var(--line)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '13px',
    color: 'var(--muted)',
  };

  const panelContent = (
    <>
      {isCompact && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={sectionHeaderStyle}>RIGHT PANEL</span>
          <button
            type="button"
            onClick={() => setOverlayOpen(false)}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* 1. Clocks */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={sectionHeaderStyle}>CLOCKS</h2>
        <div style={placeholderCardStyle}>RightPanel · Clocks placeholder</div>
      </section>

      {/* 2. Timeline */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={sectionHeaderStyle}>TIMELINE</h2>
        <div style={placeholderCardStyle}>Timeline placeholder</div>
      </section>

      {/* 3. Clue Matrix */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={sectionHeaderStyle}>CLUE MATRIX</h2>
        <div style={placeholderCardStyle}>Clue Matrix placeholder</div>
      </section>

      {/* 4. Factions */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={sectionHeaderStyle}>FACTIONS</h2>
        <div style={placeholderCardStyle}>Factions placeholder</div>
      </section>

      {/* 5. Random Tables */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={sectionHeaderStyle}>RANDOM TABLES</h2>
        <div style={placeholderCardStyle}>Random Tables placeholder</div>
      </section>

      {/* 6. Scratchpad */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={sectionHeaderStyle}>SCRATCHPAD</h2>
        <button
          type="button"
          style={{
            height: '48px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Add note / override
        </button>
        <button
          type="button"
          style={{
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p2)',
            color: 'var(--text)',
            fontSize: '13px',
          }}
        >
          Loose Notes (0)
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--muted)',
            paddingTop: '4px',
          }}
        >
          <span>Last backup: never</span>
          <button
            type="button"
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--tealLine)',
              background: 'var(--tealBg)',
              color: 'var(--teal)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Save Backup
          </button>
        </div>
      </section>

      {/* 7. Theme */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={sectionHeaderStyle}>THEME</h2>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
          role="group"
          aria-label="Theme"
        >
          {THEME_ORDER.map((themeKey) => {
            const th = THEMES[themeKey];
            const active = theme === themeKey;
            return (
              <button
                key={themeKey}
                type="button"
                onClick={() => setTheme(themeKey)}
                aria-pressed={active}
                style={{
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accentBg)' : 'var(--p2)',
                  color: active ? 'var(--accent)' : 'var(--text)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '28px',
                    height: '20px',
                    borderRadius: '5px',
                    flexShrink: 0,
                    border: `1px solid ${th.line2}`,
                    background: `linear-gradient(90deg, ${th.bg} 0 50%, ${th.accent} 50% 75%, ${th.gold} 75% 100%)`,
                  }}
                />
                <span style={{ flex: 1, textAlign: 'left' }}>{th.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );

  if (isCompact) {
    return (
      <>
        <aside
          data-testid="zone-right-rail"
          style={{
            width: '56px',
            flexShrink: 0,
            background: 'var(--panel)',
            borderLeft: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {[
            { label: 'Open Clocks and Timeline', icon: '⏱' },
            { label: 'Open Clues and Factions', icon: '◈' },
            { label: 'Open Scratchpad and Theme', icon: '🎨' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-expanded={overlayOpen}
              onClick={() => setOverlayOpen((o) => !o)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                border: overlayOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: overlayOpen ? 'var(--accentBg)' : 'var(--p2)',
                color: overlayOpen ? 'var(--accent)' : 'var(--text)',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </button>
          ))}
        </aside>
        {overlayOpen && (
          <aside
            data-testid="zone-right-panel"
            style={{
              position: 'absolute',
              top: 0,
              right: '56px',
              bottom: 0,
              width: '300px',
              background: 'var(--panel)',
              borderLeft: '1px solid var(--line2)',
              boxShadow: '-16px 0 40px rgba(0,0,0,.35)',
              overflowY: 'auto',
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              zIndex: 15,
              boxSizing: 'border-box',
            }}
          >
            {panelContent}
          </aside>
        )}
      </>
    );
  }

  return (
    <aside
      data-testid="zone-right-panel"
      style={{
        width: '300px',
        flexShrink: 0,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--line)',
        overflowY: 'auto',
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxSizing: 'border-box',
      }}
    >
      {panelContent}
    </aside>
  );
};
