import React, { useEffect, useState } from 'react';
import {
  dice3dController,
  DICE_OVERLAY_CONTAINER_ID,
  type DiceOverlayState,
} from '../lib/dice3d';

export const DiceOverlay: React.FC = () => {
  const [state, setState] = useState<DiceOverlayState>(() => dice3dController.getOverlayState());

  useEffect(() => {
    return dice3dController.subscribeOverlay(setState);
  }, []);

  const active = state.phase !== 'idle';

  return (
    <div
      data-testid="dice-overlay-root"
      data-phase={state.phase}
      onClick={() => {
        if (active) {
          dice3dController.clear();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        id={DICE_OVERLAY_CONTAINER_ID}
        data-testid="dice-overlay-canvas-host"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {active && (
        <div
          data-testid="dice-overlay-banner"
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--panel)',
            border: '1px solid var(--goldLine)',
            borderRadius: '12px',
            padding: '10px 16px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '90vw',
          }}
        >
          <span
            className="gm-tabular"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--gold)',
            }}
          >
            {state.phase === 'rolling'
              ? `Rolling ${state.notation}…`
              : `${state.label}: ${state.total}`}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tap to clear</span>
        </div>
      )}
    </div>
  );
};
