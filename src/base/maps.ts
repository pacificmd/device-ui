// A device's maps: what the material pass makes of it, once, for a renderer of its own to light every frame. What decides how a surface
// looks is all here; what's left to the one lighting it is the lamp, the room it mirrors and the shadow. See `Engine.maps`.
import type { RawMaps } from './renderer.js';

/** What each pane's eighteen numbers are, in order. Places and sizes are css px on the device's canvas, heights mm. */
export const PANE_FIELDS = ['cx', 'cy', 'halfW', 'halfH', 'radius', 'slope', 'bevel', 'curve', 'rim', 'tintR', 'tintG', 'tintB', 'coat', 'film', 'top', 'chamfer', 'chamferK', 'reflect'] as const;

/** What a renderer lighting the maps needs to know of the device beside them. */
export interface DeviceFacts {
  /** The tallest it stands, mm, and how tall a shadow it throws on the page. */
  peak: number;
  shadow: number;
  /** The lighting it's under, as the library's numbers. */
  lighting: unknown;
  /** Its glass, one object a pane, by PANE_FIELDS; places in map px. */
  panes: Record<(typeof PANE_FIELDS)[number], number>[];
  /** For a `box`: how many windows it was drawn in. */
  tiles?: number;
}

/** px a mm at a canvas px a css px of 1: 1 css px is 0.25 mm. */
const PX_PER_MM_AT_1 = 4;

/**
 * One device's maps, as rows from the top over `box` on its canvas, `w` by `h` px at `pxPerMm`. Everything in [0, 1] is eight bits, as the
 * library keeps it; only height needs more. Colour and emission are sRGB bytes, the rest linear.
 */
export interface DeviceMaps {
  w: number;
  h: number;
  pxPerMm: number;
  /** Where these lie on the device's canvas, and the device's own body within them, map px. */
  box: { x: number; y: number; w: number; h: number };
  body: { x: number; y: number; w: number; h: number };
  /** Base colour, sRGB rgb, and coverage a: straight, not premultiplied. */
  colour: Uint8Array;
  /** How high it stands, mm, relief and all: one float a px. */
  height: Float32Array;
  /** The slope of `height`, as .5 + .5 × the normal's x and y (y down the page), z what's left: worked out here from `height`. */
  normal: Uint8Array;
  /**
   * The finish: r roughness, g metal (with a thin film's share: metal + film, halved), b clear coat, a coverage. Straight, as colour is.
   * See material.ts for what each holds exactly. The grain's strength is `grain`'s length.
   */
  surface: Uint8Array;
  /** r sheen, or a coat's own roughness where there's coat, or .5 + a groove's tilt on bare metal; g scatter; b printed marks. Null where the GPU can't hold it. */
  more: Uint8Array | null;
  /** The grain's direction times how strongly it runs, x and y, as .5 + .25 × each, in r and g. */
  grain: Uint8Array;
  /** What glows of itself, sRGB rgb, a quarter of it: null if nothing does. */
  emission: Uint8Array | null;
  /** What handling left: r prints and smears, g dust, b hairline scratches, a haze, .5 being none. */
  condition: Uint8Array;
  /** The room's occlusion, over the whole canvas at its own size: r how open, gb which way. Lamp-independent. `scale` map px to one of its,
   * and `x`, `y` where the maps' top left falls on it, in its px. */
  occlusion: { w: number; h: number; x: number; y: number; scale: number; data: Uint8Array };
  /** Bytes held, all maps. */
  bytes: number;
  facts: DeviceFacts;
  /** What moves on it, a spring at a time: see `Move`. */
  moves: Move[];
  /** Its screens, drawn showing nothing in every map: what they show is the page's, live, for the renderer to lay over its box. */
  screens: Screen[];
  /** Where making them went, ms: frames drawing it, reading back, decoding, all the moves' probing, and the whole call. Absent on a box. */
  ms?: { start: number; drawn: number; read: number; decode: number; moves: number; total: number };
  /** What of it the maps can't carry, in words, one a thing: a renderer that has nothing else to go by draws it some other way. Empty, they hold all of it. */
  gaps: string[];
}

/** A screen as its maps hold it, blank: black, or white paper on e-ink. Its picture is the canvas, video or image in its element.
 * How it draws one: `kind`, and `gain` for what's lit, `emit` a backlight, `ink` a dark pixel, `inset` the margin round its pixels. */
export interface Screen {
  part: string;
  /** Map px, the element's box. */
  box: { x: number; y: number; w: number; h: number };
  kind: string;
  /** Whether it gives light as it was read: a picture of its own that glows, or a backlight. It's the page's, and may change; the element says so live
   * (on a d-screen, `lit`), and the maps hold the backlight as it was. */
  lit: boolean;
  gain: number;
  colour: number[];
  ink: number[];
  emit: number[];
  inset: number[];
}

/** The maps under one spring of one part, as `box` of the device's maps shows them at the spring's `to`. A renderer shows the device's maps
 * at `from` and these at `to`, lerped by the spring's value: exact where `linear`, where half way along the maps are half way between. */
export interface Move {
  /** The part, as a selector within the device, and its element on the page while the page is there: its spring's live value is
   * `partOf(el).springs[spring].value`. */
  part: string;
  el?: Element;
  spring: string;
  from: number;
  to: number;
  box: { x: number; y: number; w: number; h: number };
  /** Whether half way is half of each: a press sinking or a lamp lighting is, a turn isn't. And how far off half way's height was, mm. */
  linear: boolean;
  off: number;
  colour: Uint8Array;
  height: Float32Array;
  normal: Uint8Array;
  surface: Uint8Array;
  more: Uint8Array | null;
  emission: Uint8Array | null;
  /** The most the height moved, mm: a key's travel. */
  travel: number;
  /** A part carried whole, a slide or a turn, which a lerp can't show: see `Rigid`. */
  rigid?: Rigid;
}

/** Maps of a box of the device's maps. */
export interface Layer {
  box: { x: number; y: number; w: number; h: number };
  colour: Uint8Array;
  height: Float32Array;
  normal: Uint8Array;
  surface: Uint8Array;
  more: Uint8Array | null;
  emission: Uint8Array | null;
}

/**
 * A part its joint carries whole. `alone` is the part as it rests, coverage 0 where it isn't; `under` is the body without it, over all it sweeps.
 * A renderer draws `under`, then `alone` moved by the spring's value: along `per` map px a unit for a slide, or turned `per` radians a unit about `pin`.
 * Where a slide's `alone` covers the body at rest, `under` shows what the body is there.
 */
export interface Rigid {
  kind: 'slide' | 'turn';
  /** A unit of the spring's value, from `from`: radians, or map px across and down. It stops at `ends`, spring values: the transform is `per × (clamp(value, ends) − from)`. */
  per: [number, number] | number;
  ends: [number, number];
  pin?: [number, number];
  /** Its highest point at rest, mm. */
  peak: number;
  alone: Layer;
  under: Layer;
}

/** A box of the maps, with coverage left only where `keep` says. */
export function layerOf(m: DeviceMaps, box: Layer['box'], keep?: (i: number) => boolean): Layer {
  const { w } = m, { x: x0, y: y0, w: bw, h: bh } = box;
  const crop = <T extends Uint8Array | Float32Array>(a: T, n: number): T => {
    const o = new (a.constructor as new (n: number) => T)(bw * bh * n);
    for (let r = 0; r < bh; r++) o.set(a.subarray(((y0 + r) * w + x0) * n, ((y0 + r) * w + x0 + bw) * n), r * bw * n);
    return o;
  };
  const colour = crop(m.colour, 4);
  if (keep) for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) if (!keep((y0 + r) * w + x0 + c)) colour[(r * bw + c) * 4 + 3] = 0;
  return { box, colour, height: crop(m.height, 1), normal: crop(m.normal, 2), surface: crop(m.surface, 4), more: m.more ? crop(m.more, 4) : null, emission: m.emission ? crop(m.emission, 4) : null };
}

/** Where two reads of the maps differ: in height, colour, surface or glow. */
export function differs(a: DeviceMaps, b: DeviceMaps, i: number): boolean {
  // A map one read lacks is none of it: no glow is a glow of 0.
  const by = (p: Uint8Array | null, q: Uint8Array | null, n: number) => { if (!p && !q) return false; for (let c = 0; c < n; c++) if (Math.abs((p?.[i * n + c] ?? 0) - (q?.[i * n + c] ?? 0)) > 2) return true; return false; };
  return Math.abs(a.height[i] - b.height[i]) > 0.002 || by(a.colour, b.colour, 4) || by(a.surface, b.surface, 4) || by(a.emission, b.emission, 4);
}

/** The box round where `hit` holds, a texel wider each way for what filtering reaches, or null. */
export function boxOf(w: number, h: number, hit: (i: number) => boolean): Layer['box'] | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (hit(y * w + x)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  x0 = Math.max(x0 - 1, 0); y0 = Math.max(y0 - 1, 0); x1 = Math.min(x1 + 1, w - 1); y1 = Math.min(y1 + 1, h - 1);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The part alone and the body without it, from the device read with it and without. */
export function apart(withIt: DeviceMaps, without: DeviceMaps, sweeps: Layer['box']): { alone: Layer; under: Layer; peak: number } | null {
  without = into(withIt, without);
  const own = (i: number) => differs(withIt, without, i), box = boxOf(withIt.w, withIt.h, own);
  if (!box) return null;
  let peak = -Infinity;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) { const i = y * withIt.w + x; if (own(i)) peak = Math.max(peak, withIt.height[i]); }
  const x0 = Math.min(box.x, sweeps.x), y0 = Math.min(box.y, sweeps.y);
  const all = { x: x0, y: y0, w: Math.max(box.x + box.w, sweeps.x + sweeps.w) - x0, h: Math.max(box.y + box.h, sweeps.y + sweeps.h) - y0 };
  return { alone: layerOf(withIt, box, own), under: layerOf(without, all), peak };
}

/** `m` in `ref`'s frame, as a part reaching further grows the canvas: what falls outside `ref` is left out, and what `m` lacks is empty. */
export function into(ref: DeviceMaps, m: DeviceMaps): DeviceMaps {
  if (m.box.x === ref.box.x && m.box.y === ref.box.y && m.w === ref.w && m.h === ref.h) return m;
  const { w, h } = ref, dx = ref.box.x - m.box.x, dy = ref.box.y - m.box.y;
  const move = <T extends Uint8Array | Float32Array>(a: T, n: number): T => {
    const o = new (a.constructor as new (n: number) => T)(w * h * n);
    for (let y = 0; y < h; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= m.h) continue;
      const x0 = Math.max(0, -dx), x1 = Math.min(w, m.w - dx);
      if (x1 > x0) o.set(a.subarray((sy * m.w + x0 + dx) * n, (sy * m.w + x1 + dx) * n), (y * w + x0) * n);
    }
    return o;
  };
  return { ...m, w, h, box: ref.box, colour: move(m.colour, 4), height: move(m.height, 1), normal: move(m.normal, 2), surface: move(m.surface, 4),
    more: m.more && move(m.more, 4), emission: m.emission && move(m.emission, 4) };
}

/** What one spring at 1 changed of the maps, cropped to where it did, or null if nothing did. */
export function movedBy(rest: DeviceMaps, at: DeviceMaps, half: DeviceMaps, from: number, to: number): Omit<Move, 'part' | 'spring'> | null {
  at = into(rest, at);
  half = into(rest, half);
  const box = boxOf(rest.w, rest.h, i => differs(rest, at, i));
  if (!box) return null;
  let off = 0, travel = 0;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
    const i = y * rest.w + x, dh = at.height[i] - rest.height[i];
    if (Math.abs(dh) > 0.002) { travel = Math.max(travel, Math.abs(dh)); off = Math.max(off, Math.abs(half.height[i] - (rest.height[i] + at.height[i]) / 2)); }
  }
  return { from, to, linear: off <= Math.max(0.01, travel * 0.05), off, travel, ...layerOf(at, box) };
}

/** A part as its markup says it: its tag and form, and which of its kind it is in the device. */
export function describePart(el: Element, device: Element): string {
  const attr = [...el.attributes].find(a => a.name.startsWith('d-'));
  const sel = el.tagName.toLowerCase() + (attr ? `[${attr.name}${attr.value ? `="${attr.value}"` : ''}]` : '');
  const all = [...device.querySelectorAll(sel)];
  return all.length > 1 ? `${sel}:${all.indexOf(el)}` : sel;
}

/** Turns what a plate's textures hold into the maps a renderer reads: one layout whatever the GPU made them in. */
export function decodeMaps(raw: RawMaps, inset: [number, number], cssBody: [number, number], facts: { shadow: number; lighting: unknown }): DeviceMaps {
  const { w, h } = raw, n = w * h, k = raw.pw / raw.cw, pxPerMm = k * PX_PER_MM_AT_1;
  const height = new Float32Array(n), grain = new Uint8Array(n * 2), colour = raw.A;
  for (let i = 0; i < n; i++) {
    height[i] = raw.H[i * 4] + (raw.D ? raw.D[i * 4] : 0);
    if (raw.N) { grain[i * 2] = raw.N[i * 4]; grain[i * 2 + 1] = raw.N[i * 4 + 1]; }
    else for (let c = 0; c < 2; c++) grain[i * 2 + c] = Math.max(0, Math.min(255, Math.round((0.5 + 0.25 * raw.H[i * 4 + 1 + c]) * 255)));
  }
  // Colour and finish are written blended by coverage over nothing; a renderer wants them straight, with coverage beside them.
  for (const m of [colour, raw.S]) for (let i = 0; i < n * 4; i += 4) {
    const a = m[i + 3];
    if (a > 0 && a < 255) for (let c = 0; c < 3; c++) m[i + c] = Math.min(255, Math.round(m[i + c] * 255 / a));
  }
  const normal = new Uint8Array(n * 2), mm = 1 / pxPerMm;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = (xx: number, yy: number) => height[Math.min(Math.max(yy, 0), h - 1) * w + Math.min(Math.max(xx, 0), w - 1)];
    const dx = (at(x + 1, y) - at(x - 1, y)) / (2 * mm), dy = (at(x, y + 1) - at(x, y - 1)) / (2 * mm), l = Math.hypot(dx, dy, 1), i = (y * w + x) * 2;
    normal[i] = Math.round((0.5 - 0.5 * dx / l) * 255);
    normal[i + 1] = Math.round((0.5 - 0.5 * dy / l) * 255);
  }
  const s = raw.pw / raw.O.w;
  const maps: DeviceMaps = {
    w, h, pxPerMm,
    box: { x: raw.x, y: raw.y, w, h },
    body: { x: inset[0] * k - raw.x, y: inset[1] * k - raw.y, w: cssBody[0] * k, h: cssBody[1] * k },
    colour, height, normal, surface: raw.S, more: raw.M, grain, emission: raw.E, condition: raw.C,
    occlusion: { w: raw.O.w, h: raw.O.h, x: raw.x / s, y: raw.y / s, scale: s, data: raw.O.data },
    bytes: 0,
    facts: { ...facts, peak: raw.peak, panes: [] },
    moves: [],
    screens: [],
    gaps: [],
  };
  for (let i = 0; i + PANE_FIELDS.length <= raw.panes.length; i += PANE_FIELDS.length) {
    const p = Object.fromEntries(PANE_FIELDS.map((f, j) => [f, raw.panes[i + j]])) as DeviceFacts['panes'][number];
    p.cx = p.cx * k - raw.x; p.cy = p.cy * k - raw.y; p.halfW *= k; p.halfH *= k; p.radius *= k;
    maps.facts.panes.push(p);
  }
  maps.bytes = [colour, height, normal, raw.S, raw.M, grain, raw.E, raw.C, raw.O.data].reduce((t, a) => t + (a?.byteLength ?? 0), 0);
  return maps;
}
