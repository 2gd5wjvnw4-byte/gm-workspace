import type DiceBoxClass from '@3d-dice/dice-box';
import type { DiceBoxConfig, DiceBoxRollGroup } from '@3d-dice/dice-box';
import {
  computeTotalFromDiceBoxResults,
  parseDiceExpression,
  rollParsedDice,
  toDiceBoxPlan,
  type ParsedDice,
} from './dice';

const DICE_3D_STORAGE_KEY = 'gm-workspace-3d-dice';
const DICE_COLOR_STORAGE_KEY = 'gm-workspace-dice-color-style';
export const DICE_OVERLAY_CONTAINER_ID = 'gm-dice-overlay';

export type DiceColorStyleId =
  | 'accent'
  | 'obsidian'
  | 'ivory'
  | 'crimson'
  | 'emerald'
  | 'cobalt'
  | 'gold';

export interface DiceColorStylePreset {
  id: DiceColorStyleId;
  label: string;
  /** Fixed hex color for DiceBox, or null to read active app theme's --accent */
  color: string | null;
  /** CSS background used to render the swatch button */
  swatch: string;
}

export const DICE_COLOR_STYLES: readonly DiceColorStylePreset[] = [
  { id: 'accent', label: 'Theme', color: null, swatch: 'var(--accent)' },
  { id: 'obsidian', label: 'Obsidian', color: '#232730', swatch: '#232730' },
  { id: 'ivory', label: 'Ivory', color: '#E8DEC8', swatch: '#E8DEC8' },
  { id: 'crimson', label: 'Crimson', color: '#B83232', swatch: '#B83232' },
  { id: 'emerald', label: 'Emerald', color: '#2E8B57', swatch: '#2E8B57' },
  { id: 'cobalt', label: 'Cobalt', color: '#2E66B8', swatch: '#2E66B8' },
  { id: 'gold', label: 'Gold', color: '#D49B2A', swatch: '#D49B2A' },
] as const;

const VALID_DICE_COLOR_IDS = new Set<string>(DICE_COLOR_STYLES.map((s) => s.id));

export type DiceOverlayPhase = 'idle' | 'rolling' | 'settled';

export interface DiceOverlayState {
  phase: DiceOverlayPhase;
  label: string;
  notation: string;
  total: number | null;
  diceValues: number[];
  used3d: boolean;
}

export interface DiceRollExecutionResult {
  total: number;
  diceValues: number[];
  used3d: boolean;
  parsed: ParsedDice;
}

export type DiceBoxCtor = new (config: DiceBoxConfig) => DiceBoxClass;
export type DiceBoxLoader = () => Promise<DiceBoxCtor>;

export interface Dice3dControllerOptions {
  loadDiceBox?: DiceBoxLoader;
  assetPath?: string;
  initTimeoutMs?: number;
  rollTimeoutMs?: number;
  autoClearMs?: number;
  rng?: () => number;
  isReducedMotion?: () => boolean;
  hasWebGl?: () => boolean;
  getContainer?: () => HTMLElement | null;
}

const IDLE_OVERLAY: DiceOverlayState = {
  phase: 'idle',
  label: '',
  notation: '',
  total: null,
  diceValues: [],
  used3d: false,
};

function getSafeStorage(): Storage | null {
  try {
    if (
      typeof localStorage !== 'undefined' &&
      typeof localStorage.getItem === 'function' &&
      typeof localStorage.setItem === 'function'
    ) {
      return localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return null;
}

let memory3dDiceEnabled = true;
const prefListeners = new Set<(enabled: boolean) => void>();

/**
 * Returns whether 3D physics dice are enabled (default true).
 */
export function is3dDiceEnabled(): boolean {
  const storage = getSafeStorage();
  if (storage) {
    const raw = storage.getItem(DICE_3D_STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
    return true;
  }
  return memory3dDiceEnabled;
}

/**
 * Persists the 3D dice preference and notifies subscribed UI controls.
 */
export function set3dDiceEnabled(enabled: boolean): void {
  memory3dDiceEnabled = enabled;
  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(DICE_3D_STORAGE_KEY, enabled ? 'true' : 'false');
  }
  for (const listener of prefListeners) {
    listener(enabled);
  }
}

export function subscribe3dDicePreference(listener: (enabled: boolean) => void): () => void {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
  };
}

let memoryDiceColorStyle: DiceColorStyleId = 'accent';
const colorStyleListeners = new Set<(styleId: DiceColorStyleId) => void>();

/**
 * Returns the persisted dice color style preset (defaults to 'accent').
 */
export function getDiceColorStyle(): DiceColorStyleId {
  const storage = getSafeStorage();
  if (storage) {
    const raw = storage.getItem(DICE_COLOR_STORAGE_KEY);
    if (raw && VALID_DICE_COLOR_IDS.has(raw)) {
      return raw as DiceColorStyleId;
    }
    return 'accent';
  }
  return memoryDiceColorStyle;
}

/**
 * Persists the dice color style preset and notifies subscribed UI controls.
 */
export function setDiceColorStyle(styleId: DiceColorStyleId): void {
  if (!VALID_DICE_COLOR_IDS.has(styleId)) return;
  memoryDiceColorStyle = styleId;
  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(DICE_COLOR_STORAGE_KEY, styleId);
  }
  for (const listener of colorStyleListeners) {
    listener(styleId);
  }
}

export function subscribeDiceColorStyle(listener: (styleId: DiceColorStyleId) => void): () => void {
  colorStyleListeners.add(listener);
  return () => {
    colorStyleListeners.delete(listener);
  };
}

/**
 * Resolves a DiceColorStyleId to a concrete hex color string for @3d-dice/dice-box.
 */
export function resolveDiceThemeColor(styleId: DiceColorStyleId = getDiceColorStyle()): string {
  const preset = DICE_COLOR_STYLES.find((s) => s.id === styleId);
  if (preset && preset.color) {
    return preset.color;
  }
  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const target =
      (document.querySelector('[data-testid="app-root"]') as HTMLElement | null) ??
      document.documentElement;
    const accent = getComputedStyle(target).getPropertyValue('--accent').trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(accent)) {
      return accent;
    }
  }
  return '#56D4E8';
}

export function buildDiceBoxAssetPath(baseUrl: string = import.meta.env.BASE_URL): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalized}assets/dice-box/`;
}

function defaultIsReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let cachedWebGlSupport: boolean | null = null;

function defaultHasWebGl(): boolean {
  if (cachedWebGlSupport !== null) return cachedWebGlSupport;
  if (typeof document === 'undefined') {
    cachedWebGlSupport = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    cachedWebGlSupport = Boolean(gl);
  } catch {
    cachedWebGlSupport = false;
  }
  return cachedWebGlSupport;
}

function defaultGetContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(DICE_OVERLAY_CONTAINER_ID);
}

function defaultLoadDiceBox(): Promise<DiceBoxCtor> {
  return import('@3d-dice/dice-box').then((mod) => mod.default);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function clearContainerCanvases(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

export interface Dice3dController {
  canAttempt3d: (notation: string) => boolean;
  roll: (
    notation: string,
    opts?: { label?: string; themeColor?: string }
  ) => Promise<DiceRollExecutionResult | null>;
  clear: () => void;
  getOverlayState: () => DiceOverlayState;
  subscribeOverlay: (listener: (state: DiceOverlayState) => void) => () => void;
  resetSessionFallback: () => void;
  isInitialized: () => boolean;
}

export function createDice3dController(options: Dice3dControllerOptions = {}): Dice3dController {
  const loadDiceBox = options.loadDiceBox ?? defaultLoadDiceBox;
  const assetPath = options.assetPath ?? buildDiceBoxAssetPath();
  const initTimeoutMs = options.initTimeoutMs ?? 4000;
  const rollTimeoutMs = options.rollTimeoutMs ?? 6000;
  const autoClearMs = options.autoClearMs ?? 1800;
  const rng = options.rng ?? Math.random;
  const isReducedMotion = options.isReducedMotion ?? defaultIsReducedMotion;
  const hasWebGl = options.hasWebGl ?? defaultHasWebGl;
  const getContainer = options.getContainer ?? defaultGetContainer;

  let instance: DiceBoxClass | null = null;
  let initPromise: Promise<DiceBoxClass | null> | null = null;
  let sessionFailed = false;
  let overlayState: DiceOverlayState = IDLE_OVERLAY;
  let autoClearTimer: ReturnType<typeof setTimeout> | null = null;
  let latestGroups: DiceBoxRollGroup[] | null = null;
  let activeRollSeq = 0;
  let cancelInFlightRoll: (() => void) | null = null;
  const overlayListeners = new Set<(state: DiceOverlayState) => void>();

  const emitOverlay = (next: DiceOverlayState) => {
    overlayState = next;
    for (const listener of overlayListeners) {
      listener(overlayState);
    }
  };

  const cancelAutoClear = () => {
    if (autoClearTimer) {
      clearTimeout(autoClearTimer);
      autoClearTimer = null;
    }
  };

  const cancelPendingRoll = () => {
    if (cancelInFlightRoll) {
      const fn = cancelInFlightRoll;
      cancelInFlightRoll = null;
      fn();
    }
  };

  const clear = () => {
    activeRollSeq += 1;
    cancelPendingRoll();
    cancelAutoClear();
    if (instance) {
      try {
        instance.clear();
      } catch {
        // Ignore clear errors if context was lost
      }
    }
    if (overlayState.phase !== 'idle') {
      emitOverlay(IDLE_OVERLAY);
    }
  };

  const tryInitWithMode = async (
    DiceBox: DiceBoxCtor,
    container: HTMLElement,
    offscreen: boolean,
    themeColor?: string
  ): Promise<DiceBoxClass> => {
    clearContainerCanvases(container);
    const box = new DiceBox({
      container: `#${container.id || DICE_OVERLAY_CONTAINER_ID}`,
      id: 'gm-dice-canvas',
      assetPath,
      theme: 'default',
      themeColor: themeColor ?? '#56D4E8',
      offscreen,
      scale: 6,
      gravity: 2,
      throwForce: 5,
      spinForce: 5,
      settleTimeout: 4000,
      onRollComplete: (groups: DiceBoxRollGroup[]) => {
        latestGroups = groups;
      },
    });
    await withTimeout(box.init(), initTimeoutMs, `DiceBox init timed out (offscreen=${offscreen})`);
    return box;
  };

  const ensureInitialized = async (themeColor?: string): Promise<DiceBoxClass | null> => {
    if (instance) return instance;
    if (sessionFailed) return null;
    if (!hasWebGl()) return null;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const container = getContainer();
      if (!container) {
        return null;
      }

      let DiceBox: DiceBoxCtor;
      try {
        DiceBox = await loadDiceBox();
      } catch {
        sessionFailed = true;
        return null;
      }

      // Attempt 1: offscreen: true (default worker canvas)
      try {
        instance = await tryInitWithMode(DiceBox, container, true, themeColor);
        return instance;
      } catch {
        // Attempt 2: offscreen: false fallback for iPad Safari OffscreenCanvas stalls
        try {
          instance = await tryInitWithMode(DiceBox, container, false, themeColor);
          return instance;
        } catch {
          clearContainerCanvases(container);
          sessionFailed = true;
          return null;
        }
      }
    })();

    const resolved = await initPromise;
    if (!resolved) {
      initPromise = null;
    }
    return resolved;
  };

  const rollPlain = (parsed: ParsedDice): DiceRollExecutionResult => {
    const total = rollParsedDice(parsed, rng);
    return {
      total,
      diceValues: [total],
      used3d: false,
      parsed,
    };
  };

  const canAttempt3d = (notation: string): boolean => {
    const parsed = parseDiceExpression(notation);
    if (!parsed) return false;
    const plan = toDiceBoxPlan(parsed);
    return (
      is3dDiceEnabled() &&
      !isReducedMotion() &&
      hasWebGl() &&
      plan.supported3d &&
      !sessionFailed &&
      getContainer() !== null
    );
  };

  const roll: Dice3dController['roll'] = async (notation, opts) => {
    const parsed = parseDiceExpression(notation);
    if (!parsed) return null;

    const plan = toDiceBoxPlan(parsed);
    const label = opts?.label ?? notation;
    const canTry3d = canAttempt3d(notation);

    if (!canTry3d) {
      return rollPlain(parsed);
    }

    const rollSeq = ++activeRollSeq;
    cancelPendingRoll();
    cancelAutoClear();
    emitOverlay({
      phase: 'rolling',
      label,
      notation: parsed.raw,
      total: null,
      diceValues: [],
      used3d: true,
    });

    const resolvedThemeColor = opts?.themeColor ?? resolveDiceThemeColor();

    const box = await ensureInitialized(resolvedThemeColor);
    if (rollSeq !== activeRollSeq) {
      return null;
    }
    if (!box) {
      emitOverlay(IDLE_OVERLAY);
      return rollPlain(parsed);
    }

    try {
      latestGroups = null;
      const rollArgs = plan.notation.length === 1 ? plan.notation[0] : plan.notation;

      let rollTimer: ReturnType<typeof setTimeout> | null = null;
      let settledByCancel = false;
      const outcome = await new Promise<'done' | 'cancelled'>((resolve, reject) => {
        cancelInFlightRoll = () => {
          settledByCancel = true;
          if (rollTimer) {
            clearTimeout(rollTimer);
            rollTimer = null;
          }
          resolve('cancelled');
        };
        rollTimer = setTimeout(() => {
          rollTimer = null;
          if (cancelInFlightRoll) cancelInFlightRoll = null;
          reject(new Error('DiceBox roll timed out'));
        }, rollTimeoutMs);

        box
          .roll(rollArgs, { themeColor: resolvedThemeColor })
          .then(
            () => {
              if (rollTimer) {
                clearTimeout(rollTimer);
                rollTimer = null;
              }
              if (!settledByCancel) {
                cancelInFlightRoll = null;
                resolve('done');
              }
            },
            (err) => {
              if (rollTimer) {
                clearTimeout(rollTimer);
                rollTimer = null;
              }
              if (!settledByCancel) {
                cancelInFlightRoll = null;
                reject(err);
              }
            }
          );
      });

      if (outcome === 'cancelled' || rollSeq !== activeRollSeq) {
        return null;
      }

      const groups =
        (typeof box.getRollResults === 'function' ? box.getRollResults() : null) ?? latestGroups ?? [];
      const computed = computeTotalFromDiceBoxResults(parsed, groups);
      if (!computed) {
        clear();
        return rollPlain(parsed);
      }

      emitOverlay({
        phase: 'settled',
        label,
        notation: parsed.raw,
        total: computed.total,
        diceValues: computed.diceValues,
        used3d: true,
      });

      cancelAutoClear();
      autoClearTimer = setTimeout(() => {
        if (rollSeq === activeRollSeq) {
          clear();
        }
      }, autoClearMs);

      return {
        total: computed.total,
        diceValues: computed.diceValues,
        used3d: true,
        parsed,
      };
    } catch {
      if (rollSeq !== activeRollSeq) {
        return null;
      }
      clear();
      sessionFailed = true;
      instance = null;
      initPromise = null;
      return rollPlain(parsed);
    }
  };

  return {
    canAttempt3d,
    roll,
    clear,
    getOverlayState: () => overlayState,
    subscribeOverlay: (listener) => {
      overlayListeners.add(listener);
      return () => {
        overlayListeners.delete(listener);
      };
    },
    resetSessionFallback: () => {
      sessionFailed = false;
      instance = null;
      initPromise = null;
    },
    isInitialized: () => instance !== null,
  };
}

export const dice3dController = createDice3dController();

// Re-enabling 3D dice via the toggle lets the user retry if an earlier init failed.
subscribe3dDicePreference((enabled) => {
  if (enabled) {
    dice3dController.resetSessionFallback();
  } else {
    dice3dController.clear();
  }
});
