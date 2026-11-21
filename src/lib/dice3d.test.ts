import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiceBoxConfig, DiceBoxDieResult, DiceBoxRollGroup } from '@3d-dice/dice-box';
import {
  buildDiceBoxAssetPath,
  createDice3dController,
  DICE_OVERLAY_CONTAINER_ID,
  is3dDiceEnabled,
  set3dDiceEnabled,
  type DiceBoxCtor,
} from './dice3d';

function makeContainer(): HTMLElement {
  const existing = document.getElementById(DICE_OVERLAY_CONTAINER_ID);
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = DICE_OVERLAY_CONTAINER_ID;
  document.body.appendChild(el);
  return el;
}

describe('dice3d controller', () => {
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
    set3dDiceEnabled(true);
    makeContainer();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    const existing = document.getElementById(DICE_OVERLAY_CONTAINER_ID);
    if (existing) existing.remove();
  });

  it('builds GitHub Pages safe assetPath from BASE_URL', () => {
    expect(buildDiceBoxAssetPath('/gm-workspace/')).toBe('/gm-workspace/assets/dice-box/');
    expect(buildDiceBoxAssetPath('/gm-workspace')).toBe('/gm-workspace/assets/dice-box/');
    expect(buildDiceBoxAssetPath('/')).toBe('/assets/dice-box/');
  });

  it('lazy-loads DiceBox only on first roll tap using v1.1 single-object constructor and feeds settled results', async () => {
    vi.useFakeTimers();
    const configs: DiceBoxConfig[] = [];
    const rollCalls: Array<string | string[]> = [];
    const clearSpy = vi.fn();

    class MockDiceBox {
      config: DiceBoxConfig;
      constructor(config: DiceBoxConfig) {
        this.config = config;
        configs.push(config);
      }
      async init() {
        return this;
      }
      async roll(notation: string | string[]): Promise<DiceBoxDieResult[]> {
        rollCalls.push(notation);
        return [];
      }
      getRollResults(): DiceBoxRollGroup[] {
        return [
          { id: 0, qty: 2, sides: 6, value: 8, rolls: [{ groupId: 0, rollId: 0, sides: 6, value: 3 }, { groupId: 0, rollId: 1, sides: 6, value: 5 }] },
          { id: 1, qty: 1, sides: 8, value: 7, rolls: [{ groupId: 1, rollId: 2, sides: 8, value: 7 }] },
        ];
      }
      clear() {
        clearSpy();
        return this;
      }
      hide() { return this; }
      show() { return this; }
      resizeWorld() {}
    }

    const loader = vi.fn(async () => MockDiceBox as unknown as DiceBoxCtor);
    const controller = createDice3dController({
      loadDiceBox: loader,
      assetPath: '/gm-workspace/assets/dice-box/',
      autoClearMs: 1200,
      isReducedMotion: () => false,
      hasWebGl: () => true,
    });

    // Not loaded before user rolls
    expect(loader).not.toHaveBeenCalled();
    expect(controller.isInitialized()).toBe(false);

    const res = await controller.roll('2d6+1d8+2', { label: 'Compound Test' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(configs).toHaveLength(1);
    expect(configs[0].container).toBe(`#${DICE_OVERLAY_CONTAINER_ID}`);
    expect(configs[0].assetPath).toBe('/gm-workspace/assets/dice-box/');
    expect(configs[0].offscreen).toBe(true);
    expect(rollCalls[0]).toEqual(['2d6', '1d8']);
    expect(res?.used3d).toBe(true);
    expect(res?.total).toBe(17); // 8 + 7 + 2
    expect(controller.getOverlayState().phase).toBe('settled');

    // Auto-clear after settle
    vi.advanceTimersByTime(1250);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(controller.getOverlayState().phase).toBe('idle');
  });

  it('retries with offscreen: false when offscreen: true init fails', async () => {
    const offscreenModes: Array<boolean | undefined> = [];

    class FlakyOffscreenDiceBox {
      config: DiceBoxConfig;
      constructor(config: DiceBoxConfig) {
        this.config = config;
        offscreenModes.push(config.offscreen);
      }
      async init() {
        if (this.config.offscreen) {
          throw new Error('OffscreenCanvas worker stalled');
        }
        return this;
      }
      async roll(): Promise<DiceBoxDieResult[]> {
        return [];
      }
      getRollResults(): DiceBoxRollGroup[] {
        return [
          { id: 0, qty: 2, sides: 6, value: 9, rolls: [{ groupId: 0, rollId: 0, sides: 6, value: 4 }, { groupId: 0, rollId: 1, sides: 6, value: 5 }] },
        ];
      }
      clear() { return this; }
      hide() { return this; }
      show() { return this; }
      resizeWorld() {}
    }

    const controller = createDice3dController({
      loadDiceBox: async () => FlakyOffscreenDiceBox as unknown as DiceBoxCtor,
      isReducedMotion: () => false,
      hasWebGl: () => true,
    });

    const res = await controller.roll('d66');
    expect(offscreenModes).toEqual([true, false]);
    expect(res?.used3d).toBe(true);
    expect(res?.total).toBe(45);
    controller.clear();
  });

  it('falls back to plain random without loading dice-box when prefers-reduced-motion is active', async () => {
    const loader = vi.fn();
    const controller = createDice3dController({
      loadDiceBox: loader,
      isReducedMotion: () => true,
      rng: () => 0.5,
    });

    const res = await controller.roll('1d6');
    expect(loader).not.toHaveBeenCalled();
    expect(res?.used3d).toBe(false);
    expect(res?.total).toBe(4);
  });

  it('falls back to plain random when 3D Dice is toggled off and persists preference', async () => {
    const loader = vi.fn();
    set3dDiceEnabled(false);
    expect(is3dDiceEnabled()).toBe(false);
    expect(localStorage.getItem('gm-workspace-3d-dice')).toBe('false');

    const controller = createDice3dController({
      loadDiceBox: loader,
      isReducedMotion: () => false,
      rng: () => 0.0,
    });

    const res = await controller.roll('1d20');
    expect(loader).not.toHaveBeenCalled();
    expect(res?.used3d).toBe(false);
    expect(res?.total).toBe(1);
  });

  it('falls back cleanly to plain random when WebGL initialization fails in both modes', async () => {
    class BrokenWebGlDiceBox {
      constructor(_config: DiceBoxConfig) {}
      async init() {
        throw new Error('WebGL not supported');
      }
      async roll(): Promise<DiceBoxDieResult[]> {
        return [];
      }
      getRollResults(): DiceBoxRollGroup[] {
        return [];
      }
      clear() { return this; }
      hide() { return this; }
      show() { return this; }
      resizeWorld() {}
    }

    const controller = createDice3dController({
      loadDiceBox: async () => BrokenWebGlDiceBox as unknown as DiceBoxCtor,
      isReducedMotion: () => false,
      hasWebGl: () => true,
      rng: () => 0.99,
    });

    const res = await controller.roll('1d6');
    expect(res?.used3d).toBe(false);
    expect(res?.total).toBe(6);
    expect(controller.getOverlayState().phase).toBe('idle');
  });

  it('skips loading dice-box and uses instant plain fallback when WebGL is unavailable', async () => {
    const loader = vi.fn();
    const controller = createDice3dController({
      loadDiceBox: loader,
      isReducedMotion: () => false,
      hasWebGl: () => false,
      rng: () => 0.5,
    });

    expect(controller.canAttempt3d('1d20')).toBe(false);
    const res = await controller.roll('1d20');
    expect(loader).not.toHaveBeenCalled();
    expect(res?.used3d).toBe(false);
    expect(res?.total).toBe(11);
    expect(controller.getOverlayState().phase).toBe('idle');
  });

  it('cancels an in-flight roll cleanly on mid-roll clear() without breaking subsequent 3D rolls', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    let markFirstRollEntered!: () => void;
    const firstRollEntered = new Promise<void>((resolve) => {
      markFirstRollEntered = resolve;
    });

    class PendingDiceBox {
      constructor(_config: DiceBoxConfig) {}
      async init() {
        return this;
      }
      roll(): Promise<DiceBoxDieResult[]> {
        callCount += 1;
        if (callCount === 1) {
          markFirstRollEntered();
          // Simulates real @3d-dice/dice-box leaving the promise unsettled after clear()
          return new Promise<DiceBoxDieResult[]>(() => {});
        }
        return Promise.resolve([]);
      }
      getRollResults(): DiceBoxRollGroup[] {
        return [{ id: 0, qty: 1, sides: 8, value: 5, rolls: [{ groupId: 0, rollId: 0, sides: 8, value: 5 }] }];
      }
      clear() { return this; }
      hide() { return this; }
      show() { return this; }
      resizeWorld() {}
    }

    const controller = createDice3dController({
      loadDiceBox: async () => PendingDiceBox as unknown as DiceBoxCtor,
      isReducedMotion: () => false,
      hasWebGl: () => true,
      rollTimeoutMs: 500,
    });

    const firstPromise = controller.roll('1d20');
    await firstRollEntered;
    expect(controller.getOverlayState().phase).toBe('rolling');

    controller.clear();
    const firstResult = await firstPromise;
    expect(firstResult).toBeNull();
    expect(controller.getOverlayState().phase).toBe('idle');

    // Advance well past rollTimeoutMs — no delayed fallback or sessionFailed
    vi.advanceTimersByTime(1000);
    expect(controller.canAttempt3d('1d8')).toBe(true);

    const secondResult = await controller.roll('1d8');
    expect(secondResult?.used3d).toBe(true);
    expect(secondResult?.total).toBe(5);
  });

  it('supersedes an in-flight roll on rapid consecutive rolls and settles only the latest roll in 3D', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    let markFirstRollEntered!: () => void;
    const firstRollEntered = new Promise<void>((resolve) => {
      markFirstRollEntered = resolve;
    });

    class RapidDiceBox {
      constructor(_config: DiceBoxConfig) {}
      async init() {
        return this;
      }
      roll(): Promise<DiceBoxDieResult[]> {
        callCount += 1;
        if (callCount === 1) {
          markFirstRollEntered();
          return new Promise<DiceBoxDieResult[]>(() => {});
        }
        return Promise.resolve([]);
      }
      getRollResults(): DiceBoxRollGroup[] {
        return [{ id: 0, qty: 1, sides: 12, value: 9, rolls: [{ groupId: 0, rollId: 0, sides: 12, value: 9 }] }];
      }
      clear() { return this; }
      hide() { return this; }
      show() { return this; }
      resizeWorld() {}
    }

    const controller = createDice3dController({
      loadDiceBox: async () => RapidDiceBox as unknown as DiceBoxCtor,
      isReducedMotion: () => false,
      hasWebGl: () => true,
      rollTimeoutMs: 500,
    });

    const firstPromise = controller.roll('1d6');
    await firstRollEntered;

    const secondPromise = controller.roll('1d12');
    const [firstRes, secondRes] = await Promise.all([firstPromise, secondPromise]);

    expect(firstRes).toBeNull();
    expect(secondRes?.used3d).toBe(true);
    expect(secondRes?.total).toBe(9);

    // Advance past first roll's old timeout — 3D must remain enabled
    vi.advanceTimersByTime(1000);
    expect(controller.canAttempt3d('1d8')).toBe(true);
  });
});
