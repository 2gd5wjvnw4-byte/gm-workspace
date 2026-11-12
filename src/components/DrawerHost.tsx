import React from 'react';

export type DrawerMode = 'pdf' | 'entity' | null;

export interface DrawerHostProps {
  activeDrawer: DrawerMode;
  onClose: () => void;
}

export const DrawerHost: React.FC<DrawerHostProps> = ({ activeDrawer, onClose }) => {
  const isPdf = activeDrawer === 'pdf';
  const isEntity = activeDrawer === 'entity';
  const width = isPdf ? '480px' : '420px';
  const isOpen = isPdf || isEntity;

  return (
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
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span style={{ fontWeight: 600, flex: 1 }}>
              Source PDF · printed p.1 (PDF p.1)
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            <div
              style={{
                background: 'var(--p2)',
                border: '1px dashed var(--line2)',
                borderRadius: '12px',
                padding: '24px',
                color: 'var(--muted)',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              DrawerHost · PDF Drawer placeholder (480px)
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '10px',
                border: '1px solid var(--tealLine)',
                background: 'var(--tealBg)',
                color: 'var(--teal)',
                fontWeight: 600,
              }}
            >
              Crop map from this page
            </button>
            <button
              type="button"
              style={{
                height: '48px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p2)',
                color: 'var(--text)',
              }}
            >
              Go to page…
            </button>
          </div>
        </>
      )}

      {isEntity && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--head)',
                fontWeight: 700,
                fontSize: '16px',
                flex: 1,
              }}
            >
              Entity Inspector Placeholder
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
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
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              DrawerHost · Entity Inspector placeholder (420px)
            </div>
          </div>
        </>
      )}
    </div>
  );
};
