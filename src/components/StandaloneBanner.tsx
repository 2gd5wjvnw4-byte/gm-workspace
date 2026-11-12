import React from 'react';

export interface StandaloneBannerProps {
  onDismiss: () => void;
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosStandalone = nav.standalone === true;
  return Boolean(matchStandalone || iosStandalone);
}

export const StandaloneBanner: React.FC<StandaloneBannerProps> = ({ onDismiss }) => {
  return (
    <div
      role="status"
      data-testid="standalone-banner"
      style={{
        flexShrink: 0,
        background: 'var(--deltaBg)',
        borderBottom: '1px solid var(--gold)',
        color: 'var(--deltaText)',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '13px',
      }}
    >
      <span style={{ fontWeight: 500 }}>
        Add GM Workspace to your Home Screen so iPad keeps your data.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss Home Screen reminder"
        style={{
          height: '44px',
          minWidth: '44px',
          padding: '0 12px',
          borderRadius: '8px',
          border: '1px solid var(--goldLine)',
          background: 'var(--goldBg)',
          color: 'var(--gold)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Dismiss
      </button>
    </div>
  );
};
