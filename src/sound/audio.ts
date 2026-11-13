// The page has one audio device, and everything that makes a sound plays through its one output, so one switch mutes the lot.
// A context of its own per part would open the device again each time, which stalls the page, and would leave a mute nothing to hold.

// Browsers open audio on a tap or a key, and a touch only counts once it ends.
const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
// How fast the output fades when it's muted or let go, seconds: quick, but not a click.
const FADE = 0.015;
// How long a busy page can keep the device waiting to be opened, ms.
const QUIET = 800;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = false;
const worklets = new Map<string, Promise<void>>();
const heard = new Set<(muted: boolean) => void>();

const wake = () => {
  if (ctx?.state === 'suspended' && (navigator.userActivation?.isActive ?? true)) void ctx.resume();
};

/** The page's audio device, opened the first time anything asks. It stays suspended until the page's first tap or key, which is the browser's rule, and runs while muted, silently, so what plays keeps its time. */
export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(ctx.destination);
    for (const g of GESTURES) window.addEventListener(g, wake, true);
  }
  wake();
  return ctx;
}

/**
 * Gets the device ready ahead of the first sound: when the page is next idle, or as a hand first comes over it, whichever is sooner.
 * Opening it holds the page for as much as a sixth of a second at once, and opened by the first sound that's inside the first press,
 * which then shows that long after the finger. Anything that will sound asks for this as it's made, with what it builds on the device
 * if that's costly too; by default it just opens it, muted or not, as the device runs while muted. Returns what calls it off, for one stopped before then.
 */
export function soon(ready: () => void = () => void audio()): () => void {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return () => {};
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, QUIET));
  const unidle = window.cancelIdleCallback ?? window.clearTimeout;
  const off = () => {
    unidle(early);
    window.removeEventListener('pointerover', go, true);
  };
  const go = () => {
    off();
    ready();
  };
  const early = idle(go, { timeout: QUIET });
  window.addEventListener('pointerover', go, { capture: true, passive: true });
  return off;
}

/** Where anything that makes a sound connects, in place of `audio().destination`. */
export function output(): AudioNode {
  audio();
  return out!;
}

/** Whether the page is silent. */
export function isMuted(): boolean {
  return muted;
}

/** Silences every sound on the page, or lets them be heard. Set from a tap or a key, it also opens the device. */
export function mute(on: boolean): void {
  if (on === muted) return;
  muted = on;
  if (ctx && out) out.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, FADE);
  wake();
  for (const f of heard) f(on);
}

/** Calls back whenever the page is muted or unmuted. Returns what stops it. */
export function onMute(f: (muted: boolean) => void): () => void {
  heard.add(f);
  return () => heard.delete(f);
}

/** Loads a worklet's code into the device once, however many parts use it. A processor can only be registered once in a context. */
export function worklet(name: string, code: string): Promise<void> {
  let loaded = worklets.get(name);
  if (!loaded) {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    loaded = audio().audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    worklets.set(name, loaded);
  }
  return loaded;
}
