import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceOverlay } from './DiceOverlay';
import { dice3dController, type DiceOverlayState } from '../lib/dice3d';

const IDLE_STATE: DiceOverlayState = {
  phase: 'idle',
  label: '',
  notation: '',
  total: null,
  diceValues: [],
  used3d: false,
};

describe('DiceOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps settled dice visible until tapped and clears to idle on tap', () => {
    let currentState: DiceOverlayState = {
      phase: 'settled',
      label: 'Quick Roll (1d100)',
      notation: '1d100',
      total: 80,
      diceValues: [80],
      used3d: true,
    };
    const listeners = new Set<(state: DiceOverlayState) => void>();

    vi.spyOn(dice3dController, 'getOverlayState').mockImplementation(() => currentState);
    vi.spyOn(dice3dController, 'subscribeOverlay').mockImplementation((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    });
    const clearSpy = vi.spyOn(dice3dController, 'clear').mockImplementation(() => {
      currentState = IDLE_STATE;
      for (const listener of listeners) {
        listener(currentState);
      }
    });

    render(<DiceOverlay />);

    const root = screen.getByTestId('dice-overlay-root');
    expect(root.getAttribute('data-phase')).toBe('settled');
    expect(root.style.pointerEvents).toBe('auto');
    expect(screen.getByTestId('dice-overlay-banner').textContent).toContain('Quick Roll (1d100): 80');
    expect(screen.getByTestId('dice-overlay-banner').textContent).toContain('Tap to clear');

    act(() => {
      fireEvent.click(root);
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(root.getAttribute('data-phase')).toBe('idle');
    expect(root.style.pointerEvents).toBe('none');
    expect(screen.queryByTestId('dice-overlay-banner')).toBeNull();
  });
});
