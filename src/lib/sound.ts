const SOUND_STORAGE_KEY = 'gm-workspace-sound';

let sharedAudioCtx: AudioContext | null = null;
let memorySoundEnabled = false;

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
    // Ignore storage access errors
  }
  return null;
}

/**
 * Returns whether opt-in tactile Web Audio clicks are enabled (default false).
 */
export function isSoundEnabled(): boolean {
  const storage = getSafeStorage();
  if (storage) {
    return storage.getItem(SOUND_STORAGE_KEY) === 'true';
  }
  return memorySoundEnabled;
}

/**
 * Persists the opt-in tactile click preference.
 */
export function setSoundEnabled(enabled: boolean): void {
  memorySoundEnabled = enabled;
  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  return sharedAudioCtx;
}

/**
 * Plays a subtle 12ms zero-asset tactile click when sound is enabled.
 */
export function playTactileClick(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.012);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.014);
  } catch {
    // AudioContext unavailable or blocked in test/headless environments
  }
}

const INTERACTIVE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'summary',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  'input[type="button"]:not(:disabled)',
  'input[type="submit"]:not(:disabled)',
  'input[type="reset"]:not(:disabled)',
  'input[type="checkbox"]:not(:disabled)',
  'input[type="radio"]:not(:disabled)',
  'select:not(:disabled)',
].join(', ');

/**
 * Attaches a global capture-phase click listener so every enabled button or
 * interactive item plays a tactile click when sound is enabled.
 */
export function installGlobalTactileClicks(doc: Document = document): () => void {
  const handleClick = (event: MouseEvent) => {
    if (!isSoundEnabled()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-testid="sound-clicks-toggle"]')) return;
    const interactive = target.closest(INTERACTIVE_SELECTOR);
    if (!interactive || interactive.closest('[aria-disabled="true"]')) return;
    playTactileClick();
  };
  doc.addEventListener('click', handleClick, true);
  return () => doc.removeEventListener('click', handleClick, true);
}
