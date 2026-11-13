import { configure, getEngine } from './engine.js';

/** How far a tilt throws the lamp. 1 would be the true angle, and this is more than that because a hand tilts a phone so little. */
const GAIN = 1.65;
/** The most tilt that counts, as the sine of the angle. */
const FURTHEST = 0.7;
/** Seconds until however the phone is being held counts as level. */
const DRIFT = 10;
/** Window pixels the lamp has to have moved by, so that a phone at rest stops drawing. */
const STILL = 1;

export interface TiltLightOptions {
  /** Degrees the viewer moves with the lamp, which is what slides reflections across shiny faces. 6 by default, and 0 keeps only the shadows moving. */
  look?: number;
  /** Called when `state` changes. */
  onState?: (state: TiltState) => void;
}

/** `ask` means the browser won't give readings until a tap calls `ask()`. `waiting` is a browser that may yet send some, which a laptop never does. */
export type TiltState = 'waiting' | 'ask' | 'on' | 'denied';

export interface TiltLight {
  readonly state: TiltState;
  /** Call this from a tap. Resolves true unless the answer was no. */
  ask(): Promise<boolean>;
  /** Puts the lamp back with the pointer. */
  stop(): void;
}

type Asks = { requestPermission?: () => Promise<string> };

/**
 * Where straight up is, seen from the screen: x to its right and y to its top, as the sine of the angle.
 * `beta` and `gamma` are in degrees, as a deviceorientation event gives them. `turned` is how far anticlockwise the phone
 * has been rotated, in degrees, with the picture staying upright.
 */
export function upFrom(beta: number, gamma: number, turned = 0): [number, number] {
  const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180, a = (turned * Math.PI) / 180;
  const x = -Math.cos(b) * Math.sin(g), y = Math.sin(b);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/**
 * Hangs the lamp straight up in the room, so that tilting the phone swings the light across whatever is on it, and any torch with it.
 * Does nothing where there's no sensor, and on iOS nothing until a tap has called `ask()`.
 */
export function tiltLight({ look = 6, onState }: TiltLightOptions = {}): TiltLight {
  const engine = getEngine();
  let state: TiltState = 'waiting', rest: [number, number] | null = null, then = 0, aimX = 0, aimY = 0, before = 0;

  const set = (next: TiltState) => {
    if (next === state) return;
    state = next;
    onState?.(state);
  };
  const turned = () => (globalThis as { orientation?: number }).orientation ?? screen.orientation?.angle ?? 0;
  // A phone turned on its side is a new way of holding it.
  const settle = () => {
    rest = null;
  };

  const read = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (state !== 'on') {
      before = engine.look;
      engine.lampHeld = true;
      configure({ look });
      set('on');
    }
    const [x, y] = upFrom(e.beta, e.gamma, turned());
    const now = performance.now(), step = Math.min((now - then) / 1000, 0.2) / DRIFT;
    then = now;
    rest ??= [x, y];
    rest[0] += (x - rest[0]) * step;
    rest[1] += (y - rest[1]) * step;
    const reach = (Math.sqrt(innerWidth * innerHeight) / 2) * GAIN;
    const clamp = (v: number) => Math.max(-FURTHEST, Math.min(FURTHEST, v));
    const tx = innerWidth / 2 + clamp(x - rest[0]) * reach, ty = innerHeight / 2 - clamp(y - rest[1]) * reach;
    if (Math.hypot(tx - aimX, ty - aimY) < STILL) return;
    aimX = tx;
    aimY = ty;
    engine.aim(tx, ty);
  };

  addEventListener('deviceorientation', read);
  addEventListener('orientationchange', settle);
  screen.orientation?.addEventListener('change', settle);

  const asks = globalThis.DeviceOrientationEvent as unknown as Asks | undefined;
  const hear = (answer: string) => {
    // Readings already coming in say more than any answer can.
    if (state === 'on') return true;
    set(answer === 'granted' ? 'waiting' : 'denied');
    return answer === 'granted';
  };
  if (asks?.requestPermission) {
    set('ask');
    // A yes from earlier in the session holds, and this finds that out. With no tap and no answer yet it's turned down, and nothing has changed.
    asks.requestPermission().then(hear, () => {});
  }

  return {
    get state() {
      return state;
    },
    ask: () => asks?.requestPermission?.().then(hear, () => false) ?? Promise.resolve(true),
    stop() {
      removeEventListener('deviceorientation', read);
      removeEventListener('orientationchange', settle);
      screen.orientation?.removeEventListener('change', settle);
      if (state === 'on') {
        configure({ look: before });
        engine.letGo();
      }
      set('waiting');
    },
  };
}
