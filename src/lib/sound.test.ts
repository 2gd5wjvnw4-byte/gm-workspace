// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSoundEnabled, playTactileClick, setSoundEnabled } from './sound';

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
});
