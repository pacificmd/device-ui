// Every light in the room but the lamp, in one list: the torch, if one's held, and whatever else gives off light for a while, a
// flash or a flame. The hardware is lit by them and so is the air, from the same numbers, so smoke over a knob and the knob come
// out as bright as each other.

type Rgb = [number, number, number];

/** A light that's a place more than a direction: a flash, a flame, a bulb. */
export interface PointLight {
  /** Where it is, window px, or an element's middle. */
  at: [number, number] | Element;
  /**
   * How big it is, window px. Its light falls off as the square of the distance from something this size: half of it at half
   * this far, a quarter at this far, and so on.
   */
  reach: number;
  /** How far in front of what's under it, window px: half its reach, by default, as a ball of light sits on what it's over. */
  height?: number;
  /** Its colour times how strong it is at its middle, linear, where 1 is the light that shows white as white. */
  color: Rgb;
}

/** The torch, while one's held: where its beam lands, window px, its colour and how strong. Read only. */
export interface Beam {
  kind: 'beam';
  at: [number, number];
  color: Rgb;
}

export type Light = Beam | (PointLight & { kind: 'point' });

export interface LightHandle {
  set(l: Partial<PointLight>): void;
  remove(): void;
}

const points = new Set<PointLight & { kind: 'point' }>();
let beam: Beam | null = null;
const heard = new Set<() => void>();
const changed = () => heard.forEach(f => f());

/** Puts a light in the room, until it's removed. */
export function light(l: PointLight): LightHandle {
  const p = { ...l, kind: 'point' as const };
  points.add(p);
  changed();
  return {
    set(n) {
      Object.assign(p, n);
      changed();
    },
    remove() {
      if (points.delete(p)) changed();
    },
  };
}

/** The lights in the room now, the torch first. */
export function lights(): Light[] {
  return beam ? [beam, ...points] : [...points];
}

/** The point lights alone, which is what changes what's lit. */
export const pointLights = (): ReadonlySet<PointLight & { kind: 'point' }> => points;

/** Where a light is, window px. */
export const placeOf = (at: [number, number] | Element): [number, number] => {
  if (Array.isArray(at)) return at;
  const r = at.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};

/** How far from a light, window px, it still gives this much of the light that shows white. */
export const reachOf = (l: PointLight, least: number) => {
  const peak = Math.max(...l.color);
  return peak <= least ? 0 : (l.reach / 2) * Math.sqrt(peak / least - 1);
};

/** For the engine: the torch as it is now, or none. */
export const setBeam = (b: Beam | null) => (beam = b);

/** What the page gives off, small: rows from the top of the window, each pixel `cell` css px across, linear, times `gain` for what shows white. */
export interface Glow {
  w: number;
  h: number;
  cell: number;
  gain: number;
  data: Uint8Array;
}

let glowNow: Glow | null = null, askedAt = -Infinity;

/** What the page gives off as last read: the screens and lamps and whatever else glows, where they are. Asking keeps it coming. */
export function glow(): Glow | null {
  if (performance.now() - askedAt > ASK_FOR) heard.forEach(f => f());
  askedAt = performance.now();
  return glowNow;
}
/** How long a picture of what glows keeps being made after it was last asked for, ms. */
const ASK_FOR = 1000;
/** For the engine: whether anything wants what glows. */
export const glowAsked = () => performance.now() - askedAt < ASK_FOR;
export const setGlow = (g: Glow | null) => (glowNow = g);
/** For the engine: what glows as last read, without asking for more. */
export const glowSeen = () => glowNow;

/** Called whenever a light comes, goes or changes. */
export function onLights(f: () => void) {
  heard.add(f);
  return () => heard.delete(f);
}
