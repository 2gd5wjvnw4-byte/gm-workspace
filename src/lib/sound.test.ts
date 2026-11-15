// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installGlobalTactileClicks,
  isSoundEnabled,
  playTactileClick,
  setSoundEnabled,
} from './sound';

describe('sound helper', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to off and persists opt-in state in localStorage', () => {
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    expect(store.get('gm-workspace-sound')).toBe('true');
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it('no-ops safely when AudioContext is unavailable', () => {
    setSoundEnabled(true);
    expect(() => playTactileClick()).not.toThrow();
  });

  it('plays tactile clicks for every enabled button and interactive item, and skips disabled/plain/toggle', () => {
    const startSpy = vi.fn();
    class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: startSpy,
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }

    vi.stubGlobal('AudioContext', MockAudioContext);
    const cleanup = installGlobalTactileClicks(document);

    document.body.innerHTML = `
      <button id="btn"><span>Nested Label</span></button>
      <button id="disabled-btn" disabled>Disabled</button>
      <div id="role-btn" role="button">Role Button</div>
      <div id="aria-disabled-btn" role="button" aria-disabled="true">Disabled Role</div>
      <div id="plain-div">Plain text</div>
      <button data-testid="sound-clicks-toggle">Tactile Clicks</button>
    `;

    try {
      // Off by default: clicking enabled button does not play
      setSoundEnabled(false);
      document.querySelector('#btn span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(startSpy).toHaveBeenCalledTimes(0);

      // Enable sound: nested click inside button plays
      setSoundEnabled(true);
      document.querySelector('#btn span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(startSpy).toHaveBeenCalledTimes(1);

      // Role button plays
      document.getElementById('role-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(startSpy).toHaveBeenCalledTimes(2);

      // Disabled button, aria-disabled role, plain div, and toggle button are skipped
      document.getElementById('disabled-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.getElementById('aria-disabled-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.getElementById('plain-div')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document
        .querySelector('[data-testid="sound-clicks-toggle"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(startSpy).toHaveBeenCalledTimes(2);
    } finally {
      cleanup();
      document.body.innerHTML = '';
    }
  });
});
