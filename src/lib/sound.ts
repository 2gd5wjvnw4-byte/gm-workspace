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
