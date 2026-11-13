// The page side: what's on the page, how it's laid out and moves, and what each part draws as commands.
// The commands go to the renderer, which knows nothing of the DOM or parts. See plate.ts for all that crosses.
import { ON_GPU } from './canvases.js';
import { capture, keeps } from './drag.js';
import { Player, type Crop, type Judging, type Laid, type Matching, type Mid, type Shown } from './player/install.js';
import { apart, decodeMaps, describePart, movedBy, type DeviceMaps } from './maps.js';
import { extent, join, rises } from './commands.js';
import type { FieldCache } from './fields.js';
import { audit, maybePartsSelector, partAttributes, partFor, partsVersion, schemed, warnOnce, watchStyles, written, type Scheme } from './registry.js';
import type { PartDef } from './types.js';
import type { EngineStats, Plate, PlateSpec, Scene } from './plate.js';
import { DEBUG_VIEWS, Renderer, meets, times, type Emitter, type Glow, type GlowShot, type Shot, type Turned } from './renderer.js';
import { lettered, ownText, paintMask, sameLettering, twistOf, type Lettered } from './mask.js';
import { drawSketch, LEAST_SHOWN } from './sketch.js';
import { REACH, reachCell, reachFor } from './reach.js';
import { HIDDEN_FAR, inFlight, onShown, scaled, scaleOf, staging, unscaled, zoomOf, isTable, turnsOf } from './scale.js';
import { Eye, type Metered } from './eye.js';
import { getLighting, STUDIO, TORCHES, type TorchName } from './lighting.js';
import { glowAsked, glowSeen, onLights, placeOf, pointLights, reachOf, setBeam, setGlow } from './lights.js';
import { FOCUS, MM, TOP, Sheet, layOf, offerGround, parseLength, seatOf, type Command, type GroupOptions, type ScreenCommand, type SurfaceCommand } from './sheet.js';
import { grow as outset, path, rect, type Shape } from './shapes.js';
import { Spring, gripping, onSpringChange } from './springs.js';
import { CLOSEST_ALONE } from './camera.js';
import { onStageWake } from './stage-layers.js';
import type { Box, Carried, DeviceInfo, MaterialDef, Part } from './types.js';

/** What bodies turned as cards leave on the page while they turn. They're the engine's, not the page's, so nothing in them is a change to the device. */
const GROUNDS = new WeakSet<Node>();
const PAD = 64;
const MIP_STEP = 16;
// The fewest and most devices a moving light relights in one frame, and how much the one under the hand counts for.
const ROOM_LEAST = 3, ROOM_MOST = 32, UNDER_HAND = 4;
/** How close to a device the pointer has to come for it to follow the lamp, css px. */
const HAND_ROOM = 24;
/** The least share of what a device cost to draw that drawing it smaller does: what doesn't go with its pixels. */
const LEAST_COST = 0.25;
/** How often a flame moves, ms. */
const FLICKER = 1000 / 30;
/** What a command can change without touching height or surface. */
const COLOURS = new Set(['color', 'ink', 'emit']);
/** What a joint carrying a part whole changes of what it draws: where its shapes are, which way its grain lies, and the marks of handling, which stay where they were. */
const CARRIES = new Set(['shape', 'tangent', 'marks']);
/** Where whatever clips `el` and what's round it leaves anything inside it to be seen, in the window's px: left, top, right, bottom. What
 * clips inside it isn't counted. */
function clipOf(el: HTMLElement): number[] {
  const c = [-Infinity, -Infinity, Infinity, Infinity];
  // What's fixed is held by the window, not by what it's written in: past it, only what holds fixed things itself can clip it.
  let fixed = false;
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (fixed && cs.transform === 'none' && cs.perspective === 'none' && cs.filter === 'none' && !/transform|perspective|filter/.test(cs.willChange) && !/paint|layout|strict|content/.test(cs.contain)) continue;
    fixed = cs.position === 'fixed';
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible' && !/paint|strict|content/.test(cs.contain)) continue;
    const r = e.getBoundingClientRect();
    if (cs.overflowX !== 'visible' || cs.contain !== 'none') [c[0], c[2]] = [Math.max(c[0]!, r.left), Math.min(c[2]!, r.right)];
    if (cs.overflowY !== 'visible' || cs.contain !== 'none') [c[1], c[3]] = [Math.max(c[1]!, r.top), Math.min(c[3]!, r.bottom)];
  }
  return c;
}

/** Whether each element holds its own layout, contained for size and layout, so nothing in it can move anything outside it. Learnt
 * for what's round each device as it arrives and kept, as a page sets this once on what it lays out in, as the zoom page does on its cells. */
const holds = new WeakMap<Element, boolean>();
/**
 * The box nearest `el`, it included, that holds its own layout, so a change at `el` moves only what's inside that, or null for none.
 * Only what's been learnt counts unless `learn`, as asking the browser of an element just made would have it work out the page's styles
 * then and there. One not learnt is passed over for one further out, which only reads more again.
 */
function holderOf(el: Element | null, learn = false): Element | null {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    let h = holds.get(e);
    if (h === undefined && learn) {
      const c = getComputedStyle(e).contain;
      holds.set(e, (h = c === 'strict' || (/\bsize\b/.test(c) && /\blayout\b/.test(c))));
    }
    if (h) return e;
  }
  return null;
}

/** What's last been seen of each element about being fixed in the window, for a change on it to be known to have moved nothing. */
const fixedWas = new WeakMap<Element, boolean>();
/** How many frames a still waits for what it's of to be drawn on the stage. */
const STILL_WAIT = 120;
/** How far a device in its world may read differently, css px, and still have stayed: what's left of rounding at another zoom. */
const STAYED = 0.05;
/** Every turn on a device and what holds it, up to its world, which its box alone can't show: a half turn fills the same box. */
function poseOf(el: Element, world: Element): string {
  let pose = '';
  for (let e: Element | null = el; e && e !== world; e = e.parentElement) {
    const s = getComputedStyle(e);
    pose += `${s.transform} ${s.rotate} ${s.scale} ${s.translate},`;
  }
  return pose;
}

/** Off-screen devices give up their textures, starting this far from the viewport. */
const KEEP = 300, KEEP_MARGIN = `${KEEP}px`;
/**
 * GPU bytes what isn't shown may keep, beyond what is, for each pixel of the window: devices off screen, drawn as sharp as they were
 * shown, so going back to where you were is instant. With `FIELDS_KEPT`, the fields, as one: see S1 in docs/milestones/world-renderer.md.
 */
const KEPT_PER_PIXEL = 320;
/** What the fields may keep beyond those used now: a big panel can use hundreds. */
const FIELDS_KEPT = 96e6;
/**
 * The most the GPU is taken to hold until it refuses something, bytes. A guess: the zoom page wheeled out from 250x peaks at 2.6 GB at dpr 2.
 * A phone never refuses: its GPU memory is the page's, and Safari closes a page past about a gigabyte in all and opens it again, which
 * past it again is a page that reloads for good. So a phone holds well under that, with the page's own memory on top.
 */
const GPU_GUESS = globalThis.matchMedia?.('(pointer: coarse)').matches ? 600e6 : 3e9;
/** How far the squeeze moves, as a log, before what it sizes is laid out again: a fifth. */
const RESQUEEZE = Math.log(1.2);
/** How far past the window a device is still painted by the browser, as a share of the window. Further off, none of its markup is
 * painted or hit-tested: a world a camera shows is one layer, which the browser paints whole however little of it is in the window. */
const FAR = 1, FAR_MARGIN = `${FAR * 100}%`;
const SHOWN_MARGIN = 40;
/** The least of a flash's light worth drawing, of what shows white: under one step of a screen's 255. */
const LEAST_LIGHT = 0.004;
/** What a flat white is lit to, to come out as white. As the light shader has it. */
const EXPOSURE = 0.62;
/**
 * Where a glow is and how far it could light, window px, as a ball of light would. Flat in the page, it lights less: see `flatFar`.
 */
const reaches = (e: Emitter) => ({ at: e.at, far: reachOf({ at: e.at, reach: e.half * 2, color: e.color }, LEAST_LIGHT), from: e.from as Plate | null, flat: e });
/** Cells of the picture of what glows a device has to be across for it to say how much it glows, and where. */
const FEW_CELLS = 8;
/** A device's glow taken whole, in the css px of the device: what it gives off in each colour, where the middle of it is, and how far it
 * reaches, with the window px a css px was when it was read. */
interface Whole {
  power: [number, number, number];
  x: number;
  y: number;
  reach: number;
  per: number;
}
function whole(list: Emitter[]): Whole | null {
  if (!list.length) return null;
  const power: [number, number, number] = [0, 0, 0];
  let all = 0, x = 0, y = 0, reach = 0;
  for (const e of list) {
    const area = (e.half / e.per) ** 2, w = (e.color[0] + e.color[1] + e.color[2]) * area;
    for (let k = 0; k < 3; k++) power[k]! += e.color[k]! * area;
    all += w;
    x += (w * e.on[0]) / e.per;
    y += (w * e.on[1]) / e.per;
    reach += (w * e.half) / e.per;
  }
  return all ? { power, x: x / all, y: y / all, reach: reach / all, per: list[0]!.per } : null;
}
/**
 * Whether a device gives off the same glow as it did. What a glow lights on the next device is a few levels of 255 at most, as it comes
 * in along the page, so a quarter more or less of it, or a quarter of its reach in where it is, isn't a change. It's compared whole, in
 * the device's own css px, so a camera's zoom, which scales a glow's reach with the way to what it lights, changes nothing, and nor
 * does the page scrolling. And only as finely as the coarser reading could see: it's read off a picture of the window in cells, and
 * a device shown a few cells across rounds out to whole ones and takes in its own halo, and a small glow on it falls in or out of
 * one, so that says nothing, even whether it glows. What it lights catches up with the first reading that can.
 */
function alike(a: Whole | null, b: Whole | null, across: number, per: number, cell: number): boolean {
  const coarse = cell / Math.min(per, b?.per ?? per);
  if (across < coarse * FEW_CELLS) return true;
  if (!a || !b) return !a && !b;
  const most = Math.max(...a.power, ...b.power);
  return a.power.every((v, k) => Math.abs(v - b.power[k]!) <= most * 0.25) && Math.hypot(a.x - b.x, a.y - b.y) < Math.max(coarse, b.reach * 0.25) &&
    Math.abs(a.reach - b.reach) < Math.max(Math.max(a.reach, b.reach) * 0.25, coarse / 2);
}
/**
 * How far a glow flat in the page lights what stands up to `tall` window px off it. Past its own size it gives as the cosine
 * of how far off square it's seen, which is the height over the distance, and falls as the distance squared, so as its cube.
 */
const flatFar = (e: Emitter, tall: number) => {
  const peak = Math.max(...e.color);
  return Math.min(reachOf({ at: e.at, reach: e.half * 2, color: e.color }, LEAST_LIGHT), Math.max(e.half, Math.cbrt((peak * e.half * e.half * tall) / LEAST_LIGHT)));
};
type Point = { at: [number, number]; far: number; from: Plate | null; flat: Emitter | null };
/** How big a square of the window the lights are sorted into by where they reach, css px. */
const BIN = 64;
/**
 * The lights of a frame sorted by where they reach, so a device asks only those that could fall on it and not every one: a
 * thousand devices and a thousand glows are a thousand asks each, not a million. One that reaches over much of the window is asked by all.
 */
class Reaching {
  private bins = new Map<number, number[]>();
  private wide: number[] = [];
  private seen: Uint32Array;
  private stamp = 0;
  constructor(readonly all: Point[]) {
    this.seen = new Uint32Array(all.length);
    all.forEach((p, i) => {
      const [x0, x1, y0, y1] = Reaching.cells(p.at[0] - p.far, p.at[1] - p.far, p.at[0] + p.far, p.at[1] + p.far);
      if (!((x1 - x0 + 1) * (y1 - y0 + 1) <= 256)) return void this.wide.push(i);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = x * 65536 + y, bin = this.bins.get(k);
        if (bin) bin.push(i);
        else this.bins.set(k, [i]);
      }
    });
  }

  private static cells(l: number, t: number, r: number, b: number): [number, number, number, number] {
    const c = (v: number) => Math.min(Math.max(Math.floor(v / BIN), -32000), 32000) + 32768;
    return [c(l), c(r), c(t), c(b)];
  }

  /** Each light whose reach may fall on a box in the window, once. */
  near(l: number, t: number, r: number, b: number, fn: (p: Point) => void): void {
    const [x0, x1, y0, y1] = Reaching.cells(l, t, r, b);
    if (!((x1 - x0 + 1) * (y1 - y0 + 1) <= this.bins.size)) return this.all.forEach(fn);
    const { all, seen } = this, stamp = ++this.stamp;
    for (const i of this.wide) fn(all[i]!);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      for (const i of this.bins.get(x * 65536 + y) ?? []) if (seen[i] !== stamp) { seen[i] = stamp; fn(all[i]!); }
    }
  }
}
/** How coarse the picture of what glows is that the air is lit by, css px. Light that's spread through haze needs no finer. */
const GLOW_CELL = 16;
/** What a glow at full gives off, of what shows white: as the light shader has it. */
const GLOW_GAIN = 4;
/** The least time between two pictures of what glows, ms, unless the air wants one every frame: a page loading hundreds of screens draws
 * a new glow with nearly every frame, and each one is read back whole, while a glow coming on takes longer than this to see. */
const GLOW_EVERY = 120;
/** In a camera's world, a device shown smaller than this, css px on its longer side, is too small to work by hand, so its markup sleeps until a hand comes over it. */
const AWAKE = 100;
/** How long a part the player shows turned is held still, ms, before the maker paints it there: longer than a hand pauses mid-turn. */
const TURN_STILL = 200;
const HAND = 1, KEYS = 2;
const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
/** How long a size has to hold before it counts as stopped and light catches up, ms. The slowest page goes about 170ms between sizes on the way, and a stop called early only costs one full light. */
const SIZED = 200;
/** The same for a camera, which lays nothing out: each stop is a scale already shown, and sharp within a quarter second of one is the aim.
 * A wheel's notches come closer than this while it spins, and a stop called early only costs some of a frame's sharpening. */
const VIEWED = 100;
/** How much softer than it should be a picture left by a zoom may be, or how much bigger, before it's drawn again. */
const SOFTER = 1.5, BIGGER = 2;
/** Less than this on the screen, px, is how a rect rounds, not a change of size. */
const SNAP = 0.05;
/**
 * How long a frame's own dear work may take, ms, devices arriving and sharpening together: while something on the page moves, and
 * while nothing does. Each device's last turn says what its next will cost, so a frame starts nothing it can't finish in what's left.
 */
const BUDGET_MOVING = 6, BUDGET_STILL = 12;
/** How long a frame may spend drawing the outlines of devices waiting to arrive, before any of them is drawn, ms. */
const SKETCH_SLICE = 12;
/** How long a sketch takes to give way to the picture that lands over it, ms. */
const UNSKETCH = 400;
/** How long a sketch takes to come in, ms. */
const SKETCH_IN = 160;
/** How long in a frame what's moving on devices too small to work by hand may take to draw, all of them together, ms. */
const STIR_SLICE = 3;
/** How often what moves on devices too small to work by hand is moved on, ms, at the most: a mechanical watch's beat. One shown
 * smaller moves on less often, every so many beats as it's smaller than AWAKE, up to a second, so its hands still move about a
 * pixel a step and not a fraction of one every frame. A page of them asks for a frame on the beat, not every frame. Each is moved
 * on by the time that's passed, so nothing runs slow. */
const STIR_BEAT = 125, STIR_BEATS = 8;
function splitOf(el: Element) {
  const split = el.getAttribute('split');
  return split === null ? -1 : Math.min(Math.max(+split, 0), 1);
}
/** The most degrees a device leans. Past about here a tall part's side shows as streaks, not a wall. */
const LEAN_MOST = 8;
/** The most degrees a device is set at. Past about here it's edge on, and nothing on it can be seen or reached. */
const ANGLE_MOST = 75;
const angleOf = (el: Element): [number, number] => {
  const [y = 0, x = 0] = (el.getAttribute('angle') ?? '').trim().split(/\s+/).map(v => Math.min(Math.max(parseFloat(v) || 0, -ANGLE_MOST), ANGLE_MOST));
  return [y, x];
};
/** The same turn as one CSS `rotate`, so the page keeps `transform` and `translate` to place it with. */
const rotation = ([y, x]: [number, number]) => {
  if (!y && !x) return '';
  const a = (y * Math.PI) / 360, b = (x * Math.PI) / 360, v = [Math.cos(a) * Math.sin(b), Math.sin(a) * Math.cos(b), -Math.sin(a) * Math.sin(b)], n = Math.hypot(...v);
  return `${v.map(c => +(c / n).toFixed(6)).join(' ')} ${+((Math.atan2(n, Math.cos(a) * Math.cos(b)) * 360) / Math.PI).toFixed(4)}deg`;
};
/** Which way the eye is from a device, in the room: straight out of the page, or where the `perspective` it's set in puts it. */
function eyeOf(el: HTMLElement): [number, number, number] {
  for (let a = el.parentElement; a; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.perspective === 'none') continue;
    const r = el.getBoundingClientRect(), box = a.getBoundingClientRect(), z = zoomOf(a, box), [ox = 0, oy = 0] = cs.perspectiveOrigin.split(' ').map(parseFloat);
    const v = [box.left + ox * z - (r.left + r.width / 2), box.top + oy * z - (r.top + r.height / 2), parseFloat(cs.perspective) * z], n = Math.hypot(...v);
    return [v[0]! / n, v[1]! / n, v[2]! / n];
  }
  return [0, 0, 1];
}
const leanOf = (el: Element) => Math.min(Math.max(parseFloat(el.getAttribute('lean') ?? '') || 0, 0), LEAN_MOST);
const debugOf = (el: Element) => Math.max(DEBUG_VIEWS.indexOf((el.getAttribute('debug') ?? '') as (typeof DEBUG_VIEWS)[number]), 0);

/** What a `condition` sets. Any of these can also be set on its own. */
const CONDITIONS: Record<string, Record<'prints' | 'dust' | 'scuff' | 'haze' | 'wear' | 'age' | 'grime' | 'dents' | 'fade', number>> = {
  mint: { prints: 0, dust: 0, scuff: 0, haze: 0, wear: 0, age: 0, grime: 0, dents: 0, fade: 0 },
  new: { prints: 0.14, dust: 0.14, scuff: 0.12, haze: 0.35, wear: 0, age: 0, grime: 0, dents: 0, fade: 0 },
  used: { prints: 0.42, dust: 0.35, scuff: 0.42, haze: 0.6, wear: 0.12, age: 0.1, grime: 0.1, dents: 0.1, fade: 0.05 },
  worn: { prints: 0.7, dust: 0.6, scuff: 0.75, haze: 0.8, wear: 0.3, age: 0.3, grime: 0.35, dents: 0.35, fade: 0.2 },
  abused: { prints: 1, dust: 0.9, scuff: 1, haze: 1, wear: 0.6, age: 0.7, grime: 0.7, dents: 0.75, fade: 0.4 },
};

/** Says what threw and where, for someone reading a console with no idea which of a hundred parts it was. */
const thrown = (el: Element, e: unknown) => {
  const device = el.closest('d-device'), part = partFor(el)?.selector ?? el.localName, why = e instanceof Error ? e.message : String(e);
  return `${part} threw: ${why}\n  in ${written(el)}${device && device !== el ? `\n  of ${written(device)}` : ''}`;
};

const frameOf = (p: Part): GroupOptions => (p.def.local ? { at: [p.x, p.y], scale: p.def.local === true ? 1 : p.def.local } : {});

// The first thing a part drew, outlined, unless it lit its own focus or holds another part that has it.
function focusRing(s: Sheet, p: Part, d: Device, from: number): void {
  let n: Element | null = document.activeElement;
  while (n && !d.parts.has(n as HTMLElement)) n = n.parentElement;
  if (n !== p.el) return;
  const drawn = s.commands.slice(from);
  if (drawn.some(c => c.op === 'glow')) return;
  const first = drawn.find(c => c.op === 'surface')?.shape;
  if (first && first.type !== 'mask' && first.type !== 'holes') s.commands.push({ op: 'glow', shape: outset(first, 1.5), color: FOCUS, width: 1.1 });
}

// Everything a stretch of commands touches.
function reach(commands: Command[], from: number): Box | null {
  let box: Box | null = null;
  for (let i = from; i < commands.length; i++) box = join(box, extent(commands[i]!));
  return box;
}
/** An attribute without what `reach` writes on the page itself. */
const unclipped = (v: string | null) => v?.replace(CLIP, '');
const CLIP = / ?(?:clip-path|--reach-[xywh]):(?:[^;"]|"[^"]*")*;?/g;
// What marks how a device is seated or turned, and draws nothing.
/** Parts that have moved, which wake their device for the frame as they're added. */
/** One spring of a part as the player holds it: its far end as a crop of the maps, once the GPU has said (`ok`) they lerp to it. */
interface Layer {
  to: number; crop: Crop | null; judging: Judging | null; ok: boolean; why?: string;
  /** Of a part its joint carries whole: where the joint had it at rest, its pin in the canvas's css px. Its crop is then the body without it. */
  carry?: Carried;
}
/** A screen as read, for its next picture to be no paint: what the player keeps of it, or why it's the maker's. */
interface Screened {
  cmd: ScreenCommand; shown: Shown | null; matching: Matching | null; ok: boolean; why?: string;
  /** Everything else drawn where the screen is, which is what stands over it: while that's the same, so is how much of the screen comes through. */
  round: Command[];
}
/** A part's springs as read: where each was (`at`), what the part drew there, and how far a move of it is lit again. */
interface Layers {
  at: Record<string, number>; rest: Command[]; springs: Map<string, Layer>; lit: Box | null; size: [number, number];
  /** A spring of it changes what it gives off, a lamp coming on, and that lights all round it. */
  hot?: boolean;
  /**
   * What the maker had drawn of each other part its crops cover, when they were read. Its crops hold those as they were then, so
   * once the maker draws one of them otherwise, a key pressed beside it, the crops are of something that's gone and it's the maker's.
   */
  near: Map<Part, Command[]>;
}

class Stirring<T> extends Set<T> {
  /** Those only asked whether they changed, as their device was read again, which nothing has said did. A screen among them shows
   * what it showed: a picture that's new is said by the screen, or by what ticks it. */
  readonly asked = new Set<T>();

  constructor(private readonly stirred: () => void) {
    super();
  }

  override add(v: T): this {
    this.stirred();
    this.asked.delete(v);
    return super.add(v);
  }

  ask(v: T): void {
    if (this.has(v)) return;
    this.add(v);
    this.asked.add(v);
  }

  override clear(): void {
    this.asked.clear();
    super.clear();
  }
}

/** What a device has to do, which wakes it for the frame when set. */
/** A box kept until something could have moved it: read at `moves` and the camera move `look`, and where it is in its camera's world. */
interface Kept { r: DOMRect | null; at: number; look: number; local: number[] | null }
const kept = (): Kept => ({ r: null, at: -1, look: -1, local: null });

/** What, between a staged device's picture and its world, can turn, move or project it. See `bent`. */
interface Bend {
  /** Its canvas, the device, everything round it up to its world, and the world, whose perspective what's in it takes. */
  chain: HTMLElement[];
  /** Something but its canvas has a transform, so where it lies flat isn't where its box is, and is read with that taken off. */
  moved: boolean;
  /** Each one's box as it lies flat, css px of its world from the world's corner: left, top, width, height. Read as of `at`, a page move. */
  flat: (readonly [number, number, number, number])[] | null;
  /** Each one's zoom, all the zooms from it to its world: what its style's lengths are scaled by, as they're given unzoomed. */
  zoom: number[];
  at: number;
  /** What `bent` last made of it, for the page move and the turn of its body it was made at. */
  h?: number[] | null;
  made?: string;
}
const AXES: Record<string, readonly [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const DEG: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 };
/** A length of a box `of` px across, from its computed value: px, or a share of it. */
const lengthOf = (v: string | undefined, of: number) => (v ? (v.endsWith('%') ? (parseFloat(v) / 100) * of : parseFloat(v)) || 0 : 0);
const degrees = (v: string) => parseFloat(v) * (DEG[v.match(/[a-z]+$/)?.[0] ?? 'deg'] ?? 1);
/** What an element's own transform does to it, about its origin: its translate, rotate and scale, then its transform, as CSS takes them,
 * for a box `w` by `h`. Null for none. */
function ownTransform(s: CSSStyleDeclaration, w: number, h: number): DOMMatrix | null {
  if (s.transform === 'none' && s.translate === 'none' && s.rotate === 'none' && s.scale === 'none') return null;
  const m = new DOMMatrix();
  if (s.translate !== 'none') {
    const [x, y, z] = s.translate.split(' ');
    m.translateSelf(lengthOf(x, w), lengthOf(y, h), lengthOf(z, 0));
  }
  if (s.rotate !== 'none') {
    const t = s.rotate.split(' '), axis = t.length === 4 ? t.slice(0, 3).map(Number) : t.length === 2 ? AXES[t[0]!] ?? AXES.z! : AXES.z!;
    m.rotateAxisAngleSelf(axis[0], axis[1], axis[2], degrees(t[t.length - 1]!));
  }
  if (s.scale !== 'none') {
    const [x = 1, y = x, z = 1] = s.scale.split(' ').map(v => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)));
    m.scaleSelf(x, y, z);
  }
  if (s.transform !== 'none') m.multiplySelf(new DOMMatrix(s.transform));
  return m;
}
/** About a point: `m` with the origin moved there. */
const about = (m: DOMMatrix, x: number, y: number, z = 0) => new DOMMatrix().translate(x, y, z).multiply(m).translate(-x, -y, -z);
/** `m` as it is in an element zoomed by `z`: every length it moves by scaled with it. */
const zoomed = (m: DOMMatrix, z: number) => (z === 1 ? m : new DOMMatrix().scale(z, z, z).multiply(m).scale(1 / z, 1 / z, 1 / z));
/** A camera world's own style, but for the scale and shift its camera writes. */
const unlensed = (el: HTMLElement) => el.style.cssText.replace(/(^|;)\s*(translate|scale|will-change)\s*:[^;]*/g, '').trim();
const STIRS = ['layoutDirty', 'viewDirty', 'materialDirty', 'lightDirty', 'reachDirty', 'sharpen', 'visible', 'handy', 'used'] as const;
const OWN = new Set(['data-veiled', 'data-far', 'data-asleep', 'data-over', 'data-up', 'data-turning', 'seated', 'moving', 'at', 'folded', 'data-face']);
const unzoomed = (v: string | null) => v?.replace(ZOOM, '');
// A scale on a device is a view of it too, as a page shows one being pinched, until a zoom takes over.
const ZOOM = / ?(?:zoom|translate|scale|transform-origin|will-change):[^;"]*;?/g;
const placing = (v: string | null) => v?.match(/zoom:[^;"]*/)?.join('') ?? '';
/** Where each device was last seen shown, so laying one flat for a moment and back again isn't a move. */
const placings = new WeakMap<Element, string>();
/** A style without what turning a body as cards writes on each face, or what setting it at an angle writes, which draw nothing. Nor
 * the spacing the browser writes it out with once a script has set any of it, so `width:1px` and `width: 1px;` are the same. */
const undealt = (v: string | null | undefined) => (v ?? '').replace(DEALT, '').replace(/\s*([:;])\s*/g, '$1').replace(/;$/, '').trim();
const DEALT = / ?(?:perspective|transform-style|isolation|rotate):[^;"]*;?/g;

/** What a device's markup comes to for laying it out, worked out once and kept until that markup changes, as `markup` hears: its parts,
 * which of its elements are parts at all, and each label's own text. A layout that finds the same markup asks the browser only where
 * things are. */
interface Compiled {
  version: number;
  found: [HTMLElement, PartDef][];
  parts: Set<Element>;
  texts: Map<Element, Text[]>;
  /** Where each part was in the window when last measured, and how each label was set, as of `at`: where the device was then, the moves
   * and camera moves that had happened, and the changes to its markup. While all of that holds, nothing can have moved either. */
  rects: Map<Element, DOMRect>;
  labels: Map<Element, Lettered>;
  at: string;
}
/** One of the engine's own canvases, which draw nothing of the device's. */
const ownCanvas = (n: Node) => n instanceof HTMLCanvasElement && (n.dataset.d !== undefined || n.dataset.sketch !== undefined);
/** The part of the device it's in that takes this attribute of `t`, or its text (`#text`), live: drawn again as it moves, not laid out. */
const livePart = (t: Node, name: string): Part | undefined => {
  const node = (t.nodeType === 1 ? t : t.parentElement) as HTMLElement | null, host = node?.closest('d-device, [data-alone]') as (Element & { __d?: Device }) | null;
  const part = node && host?.__d && (host.__d.parts.get(node) ?? host.__d.parts.get(node.parentElement!));
  return part && part.def.live?.includes(name) ? part : undefined;
};
/** What the engine writes on a device that says how it's reached or how near the window it is, and draws nothing. */
const UNMARKED = new Set(['d-reach', 'data-far', 'data-asleep', 'data-bent', 'data-flat']);
/** A style without a clip, or what dealing or turning a body writes. As the browser writes it out, which it does once a script has set
 * any of it, with its own spacing and its numbers to the places it keeps: `left:86.69999999999999px` and `left: 86.7px;` are the same,
 * and so are no style and an empty one, which is what's left once a script takes back all it set. */
const unmarked = (v: string | null) => restyled(v ?? '').replace(CLIP, '').replace(DEALT, '');
let scratch: CSSStyleDeclaration | null = null;
const restyled = (v: string) => {
  scratch ??= document.createElement('i').style;
  scratch.cssText = v;
  return scratch.cssText;
};

/** How much of a shape there is, whichever way it's turned. A box round it grows as a hand sweeps past the diagonal, and gives no more light for it. */
const area = (s: Shape) => (s.type === 'mask' ? s.box.w * s.box.h : s.type === 'capsule' ? Math.hypot(s.ax - s.bx, s.ay - s.by) * (s.ra + s.rb) : s.hw * s.hh * 4);

/**
 * How much light commands give off. A screen whose picture is light can show anything, so it never equals itself.
 * One that only stands in front of a backlight gives what the backlight gives, whatever it shows.
 */
function warmth(commands: Command[], from: number): number {
  let sum = 0;
  for (let i = from; i < commands.length; i++) {
    const c = commands[i]!;
    if (c.op === 'screen' && c.gain > 0) return NaN;
    const e = c.op === 'glow' ? c.color : c.op === 'surface' ? c.material.emit : c.op === 'cut' || c.op === 'screen' ? c.emit : null;
    if (!e) continue;
    sum += (e[0] + e[1] + e[2]) * area(c.shape);
  }
  return sum;
}
/** Whether two commands draw the same. A function is kept for its key, and anything else with no plain shape is only itself. */
function same(a: unknown, b: unknown, except?: Set<string>, skip?: Set<string>): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b) || (proto !== Object.prototype && proto !== Array.prototype)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>, keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  return keys.every(k => skip?.has(k) || (typeof x[k] === 'function' && typeof y[k] === 'function' ? 'key' in x : (except?.has(k) && x[k] && y[k]) || same(x[k], y[k], except, skip)));
}

/** Which of two devices comes first in the page, and is drawn under the other. */
const byPage = (a: Device, b: Device) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
/** Where a device goes in a list in page order: one arriving finds its place in a few looks, without the whole list sorted again. */
function inOrder(order: Device[], d: Device): number {
  let lo = 0, hi = order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (byPage(order[mid]!, d) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
const sameBox = (a?: Box | null, b?: Box | null) => a?.x === b?.x && a?.y === b?.y && a?.w === b?.w && a?.h === b?.h;

type Facing = 'back' | 'left' | 'right';
/** How far round each face of a body is from its front. Turning one way brings the right side round to face you. */
/** A surface standing on a body as wide as it is, with an outline of its own, is a layer of it. */
const isLayer = (el: Element) => el.localName === 'd-surface' && el.hasAttribute('path') && !(el as HTMLElement).style.width && (parseFloat(el.getAttribute('height') ?? '') || 0) > 0;
/** How deep a body is, mm: its own height and its layers'. */
const depthOf = (el: Element) => [...el.children].reduce((n, c) => n + (isLayer(c) ? parseFloat(c.getAttribute('height')!) : 0), parseFloat(el.getAttribute('height') ?? '') || TOP);
/** How far the body's layers on its back stand off it, behind the front's stack, as a panel on the back of a case does. */
const behindOf = (el: Element) => [...(el.querySelector(':scope > d-device[reverse]')?.children ?? [])].reduce((n, c) => n + (isLayer(c) ? parseFloat(c.getAttribute('height')!) : 0), 0);
const ROUND: Record<Facing | 'front', number> = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 };
/** Which face a body's `turned` asks for. Bare, it's the back. */
const asked = (el: Element): Facing | 'front' => {
  const v = el.getAttribute('turned');
  return v === null ? 'front' : v === 'left' || v === 'right' ? v : 'back';
};
/** Where a body that's got to `from` goes to show a face: the nearest way round to it. */
/** How far back the viewer of a body turned as cards stands, as lengths of it. */
const CARD_BACK = 3;
/** How far a face turned as a card rocks before the whip takes it, radians. Cards pass for the body this far round. */
const CARD_ROCK = 0.35;
/** How far a hand takes a body toward its next face before it whips, as a share of the way, and how much of the hand's move it follows till then. */
const CARD_GIVE = 0.3, CARD_FOLLOW = 0.6;
/** So held, it's at most this far from its face toward the swap, 0 to 1. Past that it's whipping. */
const CARD_HELD = 2 * CARD_GIVE * CARD_FOLLOW;
/** How much of the way to a side coming into view a held body leans. Two cards never meet seamlessly at a rounded edge, so none is seen to. */
const CARD_LEAN = 0.6;
/** How far the whip smears a card at the swap, as a share of the body's width, and how much brighter it flashes there. */
const CARD_SMEAR = 0.015, CARD_GLINT = 0.25;
/** How quickly a body turned as cards catches up with the hand, per s: slow enough that a face it whips past is seen. */
const CARD_PACE = 6;
/** How long a turning body's shadow takes to go in under it once it's set off for another face, and to come back out once it's down, s,
 * and how much longer than that it waits at the lean for the face it's going to be drawn. */
const CARD_FADE = 0.15, CARD_RETURN = 0.2, CARD_WAIT = 0.6;
const toward = (from: number, face: Facing | 'front') => from + Math.atan2(Math.sin(ROUND[face] - from), Math.cos(ROUND[face] - from));

export interface Device extends DeviceInfo, PlateSpec {
  /** When the lamp last relit it, and whether a move since is still to be lit: see `lampHz`. */
  lampAt?: number;
  lampOwed?: boolean;
  /** What the GPU's store had each side of what's drawn shrink by when it was last measured: see `sharpness`. */
  squeeze?: number;
  /** The face this one is the reverse of, which holds the body and how it's turned. */
  front?: Device;
  /** The face on the other side. */
  reverse?: Device;
  /** Which face of the body this is, if not its front. */
  facing?: Facing;
  /** Set by `maps` for a box of it: its canvas is only this, css px from its top left, at `dpr`, past every cap. */
  window?: { x: number; y: number; w: number; h: number; dpr: number };
  /** Set by `maps`: canvas px a css px, past every cap. */
  sharp?: number;
  /** The body's other faces, the reverse among them. */
  faces: Device[];
  /** Where a hand or `turned` has sent it, radians from the front, and where it's got to. */
  spun: number;
  spinning: number;
  /** The face that's up, or nearest it while it turns. */
  showing?: Device;
  /** Some face but the front is up. */
  over: boolean;
  /** Going round, so both faces show. */
  turning: boolean;
  /** Turned as cards and headed for another face, not just leaning under a hand. It stays so until it's down. */
  whipped: boolean;
  /** How far its shadow has gone in under it for a turn, 0 to 1. See `ground`. */
  hush: number;
  /** How long, s, it's been held at the lean for the face it's going to, which is drawn before the whip lands on it. */
  held: number;
  /** A hand is on it, so the face turned away keeps itself ready. */
  handy: boolean;
  /** Where a hand has turned it to, which `turn` eases toward. */
  aim: [number, number];
  plate: Plate;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  parts: Map<HTMLElement, Part>;
  list: Part[];
  /** Of `list`, in its order, what can move on its own: what has springs, and what ticks. The rest is never stepped. */
  movers: { p: Part; springs: Spring[] }[];
  cleanups: Map<Part, () => void>;
  observer: MutationObserver;
  /** The colour scheme it was last laid out in, and whether anything on it follows that. */
  scheme: Scheme;
  themed: boolean;
  /** The body's outline, under everything. */
  shell?: Shape;
  listeners: AbortController;
  visible: boolean;
  /** When it last left the screen. */
  left: number;
  layoutDirty: boolean;
  materialDirty: boolean;
  /** How its labels were last drawn, where the words they're drawn from were kept: see `relabel`. */
  /** The labels its mask was last drawn with, set where the page had them when it was at `ox`, `oy` and `z`, while `of` is still how
   * its markup is: what a relabel draws them again from. */
  inked: { of: Compiled; labels: Map<Element, Lettered>; ox: number; oy: number; z: number } | null;
  /** Frames this device has given up its turn to a moving light. */
  waited: number;
  /** When what moves on it was last drawn. */
  stirred: number;
  /** When its springs and ticks were last moved on, ms, for one moved on only on the beat. */
  stepped: number;
  /** Shown too small to work by hand when last it moved, so it moves on the beat. */
  small: boolean;
  /** What its last turn arriving or sharpening cost, ms, to guess what the next will. 0 before it's had one. */
  cost: number;
  /** How many of its pixels the sharpening it waits for draws, for each it drew last: what that costs goes mostly with them. */
  toward: number;
  /** Where it is in the window, and where its canvas is. See `Kept`. */
  kept: [Kept, Kept];
  /** What holds it and turns it, and when that was read. */
  turners?: { at: number; els: HTMLElement[] };
  /** The camera's world it's in, the one camera round it, or null for none or more than one. Undefined until it's asked. */
  cam: HTMLElement | null | undefined;
  /** Nothing about it is due: a frame passes it by until something says otherwise. */
  quiet: boolean;
  /** Something on it moved when it last moved on, or a part asked to go again. */
  ticked: boolean;
  placed: boolean;
  version: number;
  /** A resize left it owing a layout, for when resizing stops. */
  owed: boolean;
  /** All of it is to be painted again as it is, for what a paint works in, which was given back: see `readOne`. Nothing of it changed. */
  remake?: boolean;
  /** It was measured while something holding it moved, and is measured again when that lands. */
  landing: boolean;
  /** It has a picture, only not sharp enough for the size it's shown at now, so it waits its turn for a better one. */
  sharpen: boolean;
  /** Only how it's shown has changed, its zoom or its canvas being given back, and not its shape: its canvas
   * is placed again and its parts kept where they were measured, in its own px. `layoutDirty` measures them again too. */
  viewDirty: boolean;
  /** How many times its markup has changed, in anything it draws: its parts are measured again. */
  marks: number;
  /** How many of those could change more than what its parts draw and where they are, and their labels, which a layout
   * reads for itself: what's a part, or its own element. Part of `print`. */
  reshaped: number;
  /** What its markup comes to, until that changes. See `Compiled`. */
  compiled: Compiled | null;
  /** What the last layout found, so one that finds the same can say so. */
  print: string;
  dents: number;
  fade: number;
  /** Parts that moved this frame, when nothing else about the device changed. */
  moving: Stirring<Part>;
  /** Waiting to have the maker paint what the player laid turned, once it's still: see `turnedLaid`. */
  turnWait?: number;
  /** Every spring on it the player could hold has been read: see `Engine.read`. `unread`, there's more to read, and it isn't at rest. */
  read?: boolean;
  unread?: boolean;
  /** Which of the player's packs its springs were read off. */
  packed?: number;
  /** Its parts whose screens were read. */
  screened?: Set<Part>;
  /** How its maps lay on its canvas when all of it was last drawn: map px a css px, and where the canvas's top left falls on them. */
  seated?: number[];
  /** What a hand can reach may have changed. */
  reachDirty: boolean;
  /** How fine the map of what a hand can reach is, css px: finer than a pointer can aim at the size it's shown is wasted. */
  reachCell: number;
  /** What it drew last, and where its canvas's corner was then, among those commands. */
  drawn: { commands: Command[]; x: number; y: number; stands: number; fixed: boolean } | null;
  /** Its edges, sketched without the GPU while it waits its turn to arrive, until its first picture lands under them. */
  drawing: HTMLCanvasElement | null;
  /** The set of parts it threw with. It stays as it was until those change, as nothing else would stop it throwing. */
  failed: number | null;
  /** The stage shows it, from a picture kept on the GPU, and its own canvas holds nothing. */
  staged: boolean;
  /** It's off the stage, and the stage goes on showing it until its own canvas has a picture: see `restage`. */
  leaving: boolean;
  /** It has shown a picture of its own since it arrived. The first time, it says `pictured`. */
  shown: boolean;
  /** Its own canvas holds a picture of it: lit there, not on the stage, since its canvas was last emptied. */
  own: boolean;
  /** Put to sleep by the page: see `Engine.sleep`. Null while it's awake. */
  slept: Slept | null;
  /** Its markup paints nothing of its own, so a picture of it is all of it. Asked after each layout. */
  bare: boolean | null;
  /** Its markup paints nothing of its own but the devices in it, so one in it drawn on the stage, under all markup, is still over it. */
  plain: boolean | null;
  /** The page's own style hides its canvas, as it does a piece its seat draws, or one under a fold: it shows nothing, so it draws
   * nothing until that changes or a hand comes near. Asked after each layout, and again when what marks it as seated or turned does. */
  hid: boolean | null;
  /** What turns, moves or projects it off where it lies flat, as the stage draws it. Null for nothing. */
  bend: Bend | null;
  /** Turned as a card and part way round: how bright it shows, how far it's smeared, css px of its own, and whether it shows at all. */
  card: { gain: number; smear: number; shows: boolean } | null;
  /** A hand is over it (HAND) or the keyboard is in it (KEYS), so its markup stays awake however small it's shown. */
  used: number;
  /** Where flashes and flames reached on it when last lit, its canvas css px, so what they leave is lit again once they've gone. */
  pointBox: Box | null;
  /** Where it was, window px, when what glows was last pictured with it in, as left, top, width, height. */
  glowedAt: string;
  /** What it gave off when what glows was last read: the cells of that picture under it, and where it was over them. The same
   * cells under the same box give the same, so a page of glowing things still works out only those that changed. */
  gave: { plate: Plate; at: readonly number[]; cells: Uint8Array; out: Emitter[] } | null;
  /** What it gave off when what's round it was last lit for it. Out of the window it still does, as it can't be read there. */
  shone: Emitter[];
  /** The light the page had when it left the window, which is all it was lit by: see `lightChanges`. */
  seenLight: number;
}

export type { EngineStats } from './plate.js';

/** What a device asleep shows in place of its canvas: its last picture, encoded off the GPU, once that's ready, and the size it was drawn at. */
interface Slept {
  still: HTMLImageElement | null;
  url: string | null;
  pw: number;
  ph: number;
}

export interface EngineOptions {
  /** Degrees the viewer sits off centre, down the page and a little left. 0 by default, above the middle of the window. */
  tilt?: number;
  /** How far the lights follow the pointer. 1 by default. 0 holds them still. */
  lights?: number;
  /** Degrees the viewer moves as the pointer crosses from the centre to the edge of the window. Off by default. */
  look?: number;
  /** How much light the room gives, 1 by default. At 0 only what glows, and any torch, can be seen. */
  ambient?: number;
  /** How a camera's world is exposed: `auto` by default, where an eye meters the light in the room and adapts to it, or a number,
   * held, where 1 shows the studio as it's lit. A held exposure shows a flash or a dark room as they are against the studio. */
  exposure?: number | 'auto';
  /** How strong a torch held at the pointer is, off at 0. It casts its own shadows. */
  torch?: number;
  /** What that torch is: `flashlight` by default, `candle` or `blacklight`. */
  handheld?: TorchName;
  /** The lighting setup every device gets unless it names its own, `studio` by default. */
  lighting?: string;
  /** Whether finishes raise their pattern out of the surface, on by default. Off, grain and weave keep their colour and lie flat. */
  relief?: boolean;
  /** How often a moving lamp relights what follows it, a second: 30 by default. 0 relights every frame. Where the lamp stops is
   * lit the same either way. */
  lampHz?: number;
  /** How much of the page is live, lit as it's touched and moved. `full` holds what every device shown needs to relight at once.
   * `one` holds it for one device, the one in focus, and every other keeps only its final picture, lit where the lamp rests: what changes
   * on one still shows, as it borrows what the focus holds for the frames it needs. `fixed` holds it for none. On a touch screen `one`
   * by default, and `full` elsewhere; the GPU running short steps it on, and only past `fixed` is everything drawn coarser. */
  live?: Liveness;
  /** For development. A part that throws stops its device and reaches the page as an error, and checks too dear for a release run are on. Off by default. */
  strict?: boolean;
}

/** How much of the page is live: see `live` in `configure`. */
export type Liveness = 'full' | 'one' | 'fixed';
const LIVES: Liveness[] = ['full', 'one', 'fixed'];
/** How long the GPU is short of room before one fewer is live, and after a step before another: longer than a page takes to load, and
 * long enough for what one fewer live device gives back to have gone. */
const LIVE_STEP_MS = 3000;

/** The colour of the page behind `el`, as it's shown, 0 to 1: the first opaque background from it up. White where nothing has one,
 * as a page with none is. Only its colour: light added over a picture or text on the page is added as if over its background. */
function backdrop(el: Element | null): [number, number, number] {
  for (; el; el = el.parentElement) {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (m && m.length >= 3 && (m.length < 4 || Number(m[3]) >= 0.5)) return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  }
  return [1, 1, 1];
}

export class Engine {
  readonly devices = new Set<Device>();
  readonly stats: EngineStats = { paints: 0, partial: 0, lights: 0, frames: 0, layouts: 0, measures: 0, paintMs: 0, lightMs: 0, copyMs: 0, copies: 0, stages: 0, layoutMs: 0, held: 0 };
  ok = false;
  /** The most pixels a device gets per css px. More is sharper and costs the square of it. */
  // A coarse pointer means a phone, which stays at what the screen shows. Everything else draws twice
  // that and lets the browser bring it down, because one height a pixel makes a hard edge stair-step,
  // unless its screen's own pixels are too small to show one: see `sharpness`.
  maxRatio = globalThis.matchMedia?.('(pointer: coarse)').matches ? 2 : 6;
  oversample = this.maxRatio > 2 ? 2 : 1;
  /** Turns a body with more than one face as cards: each face's picture lit once, rocked a little and whipped round to the next. Off, each face is lit again at every angle on the way. */
  cards = true;
  /** Turned as cards, whether a hand turns it onto its sides too, or only between its front and back. */
  sides = false;
  private raised = true;
  /** Whether finishes raise their pattern out of the surface. Changing it paints everything again. */
  get relief(): boolean {
    return this.raised;
  }
  set relief(on: boolean) {
    if (on === this.raised) return;
    this.raised = on;
    this.renderer?.showRelief(on);
    if (typeof document !== 'undefined') this.repaintWithin(document.documentElement);
  }
  /** The smear each body turned as cards whips with, and how many have been made. */
  private whips = new WeakMap<Device, SVGFEGaussianBlurElement>();
  private whipped = 0;
  /** What each body turned as cards leaves on the page while it turns, flat under it: the shadow and all else its face drew past it, and which face that was. */
  private grounds = new WeakMap<Device, { canvas: HTMLCanvasElement; of: Device | null }>();
  /** The most GPU bytes what isn't shown may keep, so coming back to it is instant. It keeps no more than the window's size allows. */
  keep = globalThis.matchMedia?.('(pointer: coarse)').matches ? 600e6 : Infinity;
  /** How many times a device has left the screen, for telling which went longest ago. */
  private departures = 0;
  private renderer: Renderer = null!;

  /** Wait for the GPU in each pass, so timings mean something. Slow. */
  get probe(): boolean {
    return this.renderer.probe;
  }
  set probe(on: boolean) {
    this.renderer.probe = on;
  }

  get fields(): FieldCache {
    return this.renderer.fields;
  }

  // Off the page, as a canvas on it costs 15-20 ms of the main thread for each paint to take as a texture, and one off it nothing.
  private maskCanvas = new OffscreenCanvas(1, 1);
  private maskCtx = this.maskCanvas.getContext('2d')!;
  private reachCanvas = document.createElement('canvas');
  private io: IntersectionObserver | null = null;
  private view: IntersectionObserver | null = null;
  private far: IntersectionObserver | null = null;
  /** What went far during a camera move, hidden once it stops, and what came near that the stage already shows whole. */
  private farOff = new Set<Element>();
  private farOn = new Set<Element>();
  /**
   * Devices in a camera's world, which the engine tells near, shown and far itself, from where they are in that world, with how each was
   * last told. The browser would ask the same of every device in the world each frame the camera moves, which across thousands of them
   * costs more than the frame. `judgedAt` is the move and camera move they were told at, and how many devices there were: one that's arrived since has to be told too.
   */
  private judged = new Map<Device, { near: boolean; shown: boolean; far: boolean | null }>();
  private judgedAt: [number, number, number, number] = [-1, -1, -1, -1];
  /** Devices whose markup is asleep, with where each was in the window when it went to sleep; whether the page has moved since; the one a
   * hand has woken, and where, while the hand stays on it; and where the hand last was. */
  private sleepers = new Map<Device, DOMRect>();
  private sleptStale = false;
  private woken: { d: Device; r: DOMRect } | null = null;
  private handAt: [number, number] | null = null;
  /** The world a camera shows whose devices one canvas draws, rather than each its own: the shared canvas itself, put in the page.
   * `order` is the staged devices as the page has them, which is the order they're drawn in. */
  private stage: { world: HTMLElement; canvas: HTMLCanvasElement; order: Device[] | null } | null = null;
  /** How much of what's in each of these the stage shows, where it's not all of it. */
  private veils = new Map<Element, number>();
  /** Something the stage shows has moved or been drawn again. */
  private staleStage = false;
  private ro: ResizeObserver | null = null;
  /** Counts what could have moved a device in the window: a scroll, a camera, a resize, the page changing round them, or something on
   * it animating that holds one. A box is read once for each, so a frame where nothing moved reads none. */
  private moves = 0;
  /** Counts changes inside a box that holds its own layout, after which only the devices in it are read again. */
  private shifts = 0;
  /** Boxes that hold their own layout to be read before boxes are next used, each with whether its own attributes changed since. */
  private unsure = new Map<HTMLElement, boolean>();
  /** What's round each device that's arrived, to learn which box holds its layout when boxes are next read: asked as each one arrives,
   * between its own writes, the browser worked out the page's styles once for each, 1 ms a device and an eighth of a second as zoom arrives. */
  private arrived = new Set<Element>();
  /** Changes round devices that may have moved them, to be sorted when boxes are next read. Sorting one takes the page's styles, and changes
   * come one task at a time between the page's own writes: sorted as they came, zoom arriving worked out its styles 230 times in 4 s. */
  private changes: { el: Element; m: MutationRecord; own: Element | null }[] = [];
  /** Where each box that holds its own layout was last read in its layout, so one whose attributes changed is known to have stayed. */
  private holderBox = new WeakMap<Element, string>();
  /** Where each device showed in the one camera's world round them all, as of a count of `moves`. Kept once the page has shown it changes
   * attributes round that world, to tell afterwards whether one of those changes moved anything. */
  private seen: { at: number; world: HTMLElement; boxes: Map<Device, { box: readonly [number, number, number, number]; pose: string }> } | null = null;
  private wantsSeen = false;
  /** The count of `moves` when an attribute changed round a camera's world, which moved something only if a device shows somewhere else or turned. */
  private doubt = -1;
  /** Bumped by every camera move, which moves its world and nothing in it. */
  private looks = 0;
  private lenses = new WeakMap<HTMLElement, { left: number; top: number; s: number; at: number; look: number }>();
  /** Each camera world's style without the camera's own, to tell its writes from anyone else's. */
  private lensStyle = new WeakMap<Element, string>();
  /** The parts version every quiet device was quiet at. */
  private quietAt = -1;
  /** The device whose parts are moving on, and whether one of them asked for another frame. */
  private ticking: Device | null = null;
  private tickAsked = false;
  private scrolledTo = [0, 0];
  private page: MutationObserver | null = null;
  private carries = new WeakMap<Element, boolean>();
  private raf = 0;
  private last = 0;
  private lightDirty = true;
  /** Counts each frame the light changed for the page, which a device out of the window misses. */
  private lightChanges = 0;
  /** A flash or flame came, went or changed since it was last lit. */
  private pointsMoved = false;
  /** Glows that have changed what they light since it was last lit: as they are now, and as they were. */
  private glowMoved: Emitter[] = [];
  /** The glows as they were when what they light was last lit. */
  /** Whether this frame's points are every light, or only glows that changed. */
  private pointsAll = true;
  /** What glows has been lit again or moved since the last picture of it. */
  private glowStale = true;
  private glowAt = -Infinity;
  /** Where they are this frame and how far they reach, window px, when they've changed. */
  private points: Reaching | null = null;
  private flickered = 0;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0, i: 0, ti: 0, seen: false };
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private byPointer = false;
  tilt = 0;
  strict = false;
  ambient = 1;
  lighting = 'studio';
  /** The eye the stage is seen with, and an exposure held instead of it. */
  private eye = new Eye();
  exposure: number | 'auto' = 'auto';
  private scrollAt = -Infinity;
  torch = 0;
  handheld: TorchName = 'flashlight';
  /** Something other than the torch changed, so the whole of a device needs light. */
  private fullLight = true;
  private sweeping = false;
  /** How many devices a moving light relights in a frame. */
  private room = ROOM_MOST;
  /** What a device arriving costs, ms, lately: the guess for one that never has. */
  private arriving = 4;
  /** What lighting a device costs, ms, lately. */
  private lightEach = 0.2;
  private behind = false;
  /** The page moved under a torch since the last frame. */
  private scrolled = false;
  /** Something has the lamp through `aim`, not the pointer. */
  private carried = false;
  /** A part drawn as nothing, for `maps` to read the body without it. */
  private leftOut: Part | null = null;
  /** Whether the part left out drew anything in its joint's group, last time. */
  private leftCarried = false;
  /** A spring `maps` holds where it put it, against what its markup asks: a ring on an input goes back to the input's value. */
  private pinned: Spring | null = null;
  /** The face `maps` is reading, drawn though it's turned away. */
  private making: Device | null = null;
  /** Some device is still on its way to or from the lamp. */
  private handsDue = false;
  private turnsDue = false;
  /** The page moved under a still pointer. */
  private handShifted = false;
  /** The part being worked on, for saying which one threw. */
  private blamed: Element | null = null;
  /** Something on the page is changing size, and when it last did: a camera moving its world, or the page laid out at a new size. */
  private sizing = false;
  /** When sizing counts as stopped, if nothing moves before then. */
  private sizedUntil = 0;
  private sizedTimer = 0;
  /** When small things last moved on, and the wait for the next beat while nothing else asks for a frame. */
  private beatAt = 0;
  private beatTimer = 0;
  /** The device each part is on. */
  private owner = new WeakMap<Part, Device>();
  /** Hears every device's markup change, whoever changed it, so what it comes to is worked out again. See `Compiled`. */
  private markup = new MutationObserver(ms => this.remark(ms));
  lights = 1;
  /** How often a moving lamp relights what follows it, a second: 30 by default, and 0 for every frame. The pointer still eases every
   * frame, each relight lights from where it's got to, and where it stops is lit once it's still. `lampHzOf` sets it device by device,
   * as a page comparing two copies does. */
  lampHz = 30;
  lampHzOf: ((el: HTMLElement) => number | undefined) | null = null;
  /** How much of the page is live: see `live` in `configure`. */
  live: Liveness = globalThis.matchMedia?.('(pointer: coarse)').matches ? 'one' : 'full';
  /** When the GPU running short last stepped `live` on, and since when it's been short. */
  private livedAt = -Infinity;
  private shortSince: number | null = null;
  /** The device last pressed, which has focus while it's shown, until the page scrolls. */
  private pressed: Device | null = null;
  private focusAt = -1;
  private focusIs: Device | null = null;
  /** Where the lamp hangs for a device, in client px, if not over the pointer: a page showing two copies side by side lights both the same.
   * Null for one, and it's lit as any other. One that has a place is lit as though the pointer were over it. */
  lampFor: ((rect: { left: number; top: number; width: number; height: number }, x: number, y: number) => [number, number] | null) | null = null;
  private lampOwed = false;
  look = 0;

  constructor() {
    // Styles come first in the head, so a page's own rules win ties.
    // They are set up before WebGL, because without it they keep the controls usable.
    const style = document.createElement('style');
    style.dataset.deviceUi = '';
    document.head.prepend(style);
    // What packs define later goes in after it, each task's together in a sheet of its own. Added to the one sheet, the browser read all of
    // it again for each: on zoom, with every pack arriving, a fifth of a second.
    let later: HTMLStyleElement = style, due: string[] | null = null;
    const now = (css: string) => style.append(css);
    watchStyles(css => {
      if (!due) {
        due = [];
        queueMicrotask(() => {
          const sheet = document.createElement('style');
          sheet.dataset.deviceUi = '';
          sheet.textContent = due!.join('\n');
          due = null;
          later.after(sheet);
          later = sheet;
        });
      }
      due.push(css);
    }, now);
    // Where a staged device lies flat is read with every transform between it and its world taken off, for a moment.
    style.append('[data-bent],[data-flat]{transform:none!important;translate:none!important;rotate:none!important;scale:none!important}');

    this.renderer = new Renderer(this.stats, () => {
      for (const d of this.devices) d.layoutDirty = true;
      this.schedule();
    }, () => {
      // At as many px to the css px as something shown at its own size draws, so whatever fits in the window with its shadow is drawn whole.
      const k = this.sharpness(1) / this.renderer.store.squeeze;
      return [(innerWidth + 2 * PAD) * k, (innerHeight + 2 * PAD) * k];
    });
    if (!this.renderer.ok) return;
    // The player lights every device, from the maps the renderer makes: see `player/install.ts`. Where it can't run, the page stays
    // plain, as with no WebGL2.
    this.player = this.renderer.player = new Player(this.renderer.gl);
    if (!this.player.ready()) return;
    this.renderer.store.ceiling = GPU_GUESS;
    // The GPU said it holds less than it was asked to: everything is measured again, and drawn within what it said.
    this.renderer.refused = () => {
      this.renderer.store.tally();
      for (const d of this.devices) d.layoutDirty = true;
      this.schedule();
    };
    this.ok = true;

    this.io = new IntersectionObserver(entries => this.near(entries.flatMap(e => {
      const d = (e.target as HTMLElement & { __d?: Device }).__d;
      return d ? [[d, e.isIntersecting] as const] : [];
    })), { rootMargin: KEEP_MARGIN });
    // Kept near the window is for painting ahead. Light waits until there's something to see, and this says when.
    this.view = new IntersectionObserver(entries => {
      for (const e of entries) this.sighted((e.target as HTMLElement & { __d?: Device }).__d, e.isIntersecting);
      this.schedule();
    }, { rootMargin: `${SHOWN_MARGIN}px` });
    // Coming near is shown at once, as a camera brings it in. Going far waits for the camera to stop, as hiding it changes nothing
    // anyone sees and every change to the page during a move makes the browser paint and layer the whole world again.
    // One the stage shows whole is the same either way, so it comes near only once the camera stops too.
    this.far = new IntersectionObserver(entries => {
      for (const e of entries) this.farFrom(e.target, e.isIntersecting);
    }, { rootMargin: FAR_MARGIN });
    this.ro = new ResizeObserver(entries => this.resized(entries));
    // The page changing anywhere but inside a device can move one: what's inside moves only within it.
    this.page = new MutationObserver(ms => this.changed(ms));
    this.page.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    const shifted = () => {
      this.moves++;
      if (this.judged.size) this.schedule();
    };
    addEventListener('resize', shifted);
    addEventListener('load', shifted, { capture: true });

    // One too small to work by hand moves on the beat, so a page of watches each set going by its own clock asks for a frame on it,
    // not whenever one of them does. A hand or keys on it bring it back to every frame.
    onSpringChange(s => {
      const d = s.part && this.owner.get(s.part);
      if (d) this.stir(d);
      if (d?.small && !d.used) this.onBeat();
      else this.schedule();
    });
    onLights(() => {
      this.pointsMoved = true;
      this.schedule();
    });
    const relight = () => this.relight();
    addEventListener('scroll', () => this.panned(), { passive: true, capture: true });
    onShown(world => this.viewed(world));
    // A layer on the stage that changes, as the air does, has it drawn again.
    onStageWake(() => {
      if (!this.stage) return;
      this.staleStage = true;
      this.schedule();
    });
    // Light comes from the room around a device, so a new window leaves it alone, unless something is held up in that window.
    addEventListener('resize', () => {
      if (this.look || this.torch) relight();
      else if (this.lights && this.pointer.i) {
        this.handShifted = true;
        this.schedule();
      }
    });
    addEventListener('pointermove', e => {
      if ((!this.look && !this.lights && !this.torch) || this.reduced.matches || this.lampHeld) return;
      // A hand on a control is working it, not moving the lamp, and only what it moves should cost anything. A torch is in that hand. A
      // finger is always down when it moves, and the lamp follows it.
      if (e.buttons && !this.torch && e.pointerType !== 'touch') return;
      const p = this.pointer;
      p.tx = e.clientX;
      p.ty = e.clientY;
      p.ti = 1;
      this.carried = false;
      if (!p.seen) {
        p.x = p.tx;
        p.y = p.ty;
        p.seen = true;
      }
      this.schedule();
    }, { passive: true });
    // A hand over a sleeping device wakes it. It's found from where the device was when it went to sleep, not by the browser: a sleeping
    // device's markup can't be hit, and a page may leave the device's own box unhittable too, as one whose world takes no pointer does.
    const hand = (e: PointerEvent) => {
      const x = e.clientX, y = e.clientY, was = this.woken;
      this.handAt = [x, y];
      if (was && !inside(was.r, x, y)) this.unhand();
      if (this.woken || this.sizing || !this.sleepers.size) return;
      if (this.sleptStale) {
        for (const d of this.sleepers.keys()) this.sleepers.set(d, this.where(d));
        this.sleptStale = false;
      }
      for (const [d, r] of this.sleepers) {
        if (!inside(r, x, y) || d.el.closest('[inert]')) continue;
        this.woken = { d, r };
        d.used |= HAND;
        this.rest(d);
        break;
      }
    };
    addEventListener('pointermove', hand, { passive: true });
    addEventListener('pointerdown', hand, { capture: true, passive: true });
    // What's pressed has focus: see `focused`. Scrolling gives it back to what's in the middle.
    addEventListener('pointerdown', e => {
      const d = e.target instanceof Element ? deviceOf(e.target) : null;
      if (!d) return;
      this.pressed = d.front ?? d;
      this.focusAt = -1;
      if (this.live === 'one') this.schedule();
    }, { capture: true, passive: true });
    addEventListener('scroll', () => { this.pressed = null; this.focusAt = -1; }, { passive: true, capture: true });
    // A finger lifted, or taken by a scroll, lets the lamp rest.
    const lifted = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || this.torch || this.lampHeld) return;
      this.pointer.ti = 0;
      this.schedule();
    };
    addEventListener('pointerup', lifted, { passive: true });
    addEventListener('pointercancel', lifted, { passive: true });
    // Controls take focus when dragged, and that should not light them up as a Tab would.
    addEventListener('pointerdown', () => {
      this.byPointer = true;
    }, { capture: true, passive: true });
    addEventListener('keydown', () => {
      if (!this.byPointer) return;
      this.byPointer = false;
      for (const d of this.devices) if (d.el.contains(document.activeElement)) this.touch(d, document.activeElement);
      this.schedule();
    }, { capture: true });
    document.documentElement.addEventListener('pointerleave', () => {
      this.pointer.ti = 0;
      this.schedule();
    });
    // Labels are drawn with whatever font is ready, so a late font means drawing them again.
    const refont = () => {
      this.moves++;
      for (const d of this.devices) {
        d.layoutDirty = true;
        d.print = '';
      }
      this.schedule();
    };
    document.fonts?.ready.then(refont);
    document.fonts?.addEventListener('loadingdone', refont);

    // Forced colours hide the canvas, so those users get the plain controls.
    const forced = matchMedia('(forced-colors: active)');
    const plain = () => document.documentElement.classList.toggle('d-gl', !forced.matches);
    forced.addEventListener('change', plain);
    plain();

    // A page changes its scheme from the root, whichever way it likes, and the css says which way it went.
    const rescheme = () => {
      for (const d of this.devices) {
        if (!d.themed || schemeOf(d.el) === d.scheme) continue;
        d.layoutDirty = d.materialDirty = true;
        d.print = '';
        this.schedule();
      }
    };
    new MutationObserver(rescheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-mode', 'data-theme', 'data-color-scheme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rescheme);
  }

  add(el: HTMLElement): void {
    // Size doesn't wait on light: without WebGL this is still a page.
    scaled(el);
    if (!this.ok) return;
    // A cloned device brings its old canvases with it.
    for (const c of el.querySelectorAll(':scope > canvas[data-d]')) c.remove();
    const canvas = document.createElement('canvas');
    canvas.dataset.d = '';
    canvas.setAttribute('aria-hidden', 'true');
    el.prepend(canvas);
    const d: Device = {
      el, canvas, ctx: canvas.getContext('2d', ON_GPU)!, parts: new Map(), list: [], movers: [], cleanups: new Map(),
      observer: new MutationObserver(ms => {
        for (const m of ms) {
          if (m.target === canvas || m.target === d.drawing || m.attributeName === 'data-bent' || m.attributeName === 'data-flat' || GROUNDS.has(m.target)
            || (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(n => GROUNDS.has(n)))) continue;
          if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(n => n instanceof HTMLCanvasElement && 'sketch' in n.dataset)) continue;
          const node = (m.target.nodeType === 1 ? m.target : m.target.parentElement) as HTMLElement;
          // Turned, faded or clipped, it may have to go back to a canvas of its own, or may now come onto the stage. Only what its own
          // style says is read here, which costs nothing: the rest of it is read as it's laid out.
          if (this.stage && node === el && m.attributeName === 'style' && looks(m.oldValue) !== looks(el.getAttribute('style'))) this.restage(d);
          // What's on the other face of a body is that face's to deal with.
          if (node.closest('d-device, [data-alone]') !== el) continue;
          if (node === el && m.attributeName && OWN.has(m.attributeName)) {
            this.reseen(el);
            continue;
          }
          if (node === el && m.attributeName === 'turned') {
            const face = asked(el);
            if (face === 'front' || d.faces.some(f => f.facing === face)) d.spun = toward(d.spun, face);
            this.turnsDue = true;
            this.schedule();
            continue;
          }
          // Plenty of code sets what's already there, and a clip only says what the pointer can reach.
          if (m.attributeName === 'd-reach' || (m.attributeName && unclipped(m.oldValue) === unclipped(node.getAttribute(m.attributeName)))) continue;
          // A zoom on the device itself changes its size, which is the resize observer's to deal with, and being dealt as a card draws nothing.
          if (node === el && m.attributeName === 'style' && undealt(unzoomed(m.oldValue)) === undealt(unzoomed(el.getAttribute(m.attributeName)))) {
            // Except that a zoom leaves the box its own size, so no resize comes: shown bigger, it's sized as if it had been, scaled
            // until it stops and drawn sharp when it does. A move is only a finished picture moving.
            const now = placing(el.getAttribute('style'));
            if (placings.get(el) !== now) {
              placings.set(el, now);
              this.resized([{ target: el } as unknown as ResizeObserverEntry]);
            }
            continue;
          }
          if (node === el && m.attributeName === 'scale') {
            scaled(el, true);
            continue;
          }
          // Moving a split only asks for the light again.
          if (node === el && m.attributeName === 'split') {
            d.split = splitOf(el);
            d.lightDirty = true;
            d.lightBox = null;
            this.carry(d);
            this.schedule();
            continue;
          }
          // So does a view of one layer, which is only what the light puts out.
          if (node === el && m.attributeName === 'debug') {
            d.debug = debugOf(el);
            for (const f of d.faces) f.debug = d.debug;
            d.lightDirty = true;
            d.lightBox = null;
            this.carry(d);
            this.schedule();
            continue;
          }
          // So does a change of room, as when the lights go to red.
          if (node === el && m.attributeName === 'lighting') {
            d.lightDirty = true;
            d.lightBox = null;
            this.schedule();
            continue;
          }
          // So does setting it at an angle, which turns it as well.
          if (node === el && m.attributeName === 'angle') {
            d.angle = angleOf(el);
            el.style.rotate = rotation(d.angle);
            for (const f of d.faces) f.angle = d.angle;
            d.lightDirty = true;
            d.lightBox = null;
            this.schedule();
            continue;
          }
          // So does a lean.
          if (node === el && m.attributeName === 'lean') {
            d.lean = leanOf(el);
            for (const f of d.faces) f.lean = d.lean;
            d.lightDirty = true;
            d.lightBox = null;
            this.schedule();
            continue;
          }
          // A meter inside a gauge counts as the gauge.
          const part = livePart(m.target, m.type === 'attributes' ? m.attributeName! : '#text');
          if (part) {
            part.def.update?.(part);
            d.moving.add(part);
          } else d.layoutDirty = true;
          this.schedule();
        }
      }),
      listeners: new AbortController(), plate: null!, x: el.hasAttribute('fill') ? 0 : PAD, y: el.hasAttribute('fill') ? 0 : PAD, w: 0, h: 0, room: [Infinity, Infinity], drawn: null, bare: null, plain: null, hid: null, bend: null, card: null, used: 0, pointBox: null, glowedAt: '', gave: null, inked: null, shone: [], seenLight: -1,
      material: 'plain', wear: 0, age: 0, radius: 10, pw: 0, ph: 0, cw: 0, ch: 0, dpr: 1, fine: 1, seed: this.devices.size + 1,
      scheme: 'light', themed: false, debug: 0, split: -1, lean: leanOf(el), angle: angleOf(el), eye: [0, 0, 1], turns: el.matches('[reverse], [side]') || !!el.querySelector(':scope > d-device:is([reverse], [side])'), faces: [], spin: 0, axis: 0, owns: [0, 0, 0], round: 0, body: null, spun: 0, spinning: 0, over: false, turning: false, whipped: false, hush: 0, held: 0, handy: false, visible: false, waited: 0, stirred: 0, stepped: 0, small: false, cost: 0, toward: 1, kept: [kept(), kept()], cam: undefined, quiet: false, ticked: false, left: 0, hand: 0, turn: [0, 0], aim: [0, 0], owed: false, landing: false, sharpen: false, viewDirty: false, marks: 0, reshaped: 0, compiled: null, layoutDirty: true, materialDirty: true, lightDirty: true, placed: false, version: 0,
      prints: 0, dust: 0, scuff: 0, haze: 0, grime: 0, dents: 0, cracks: 0, fade: 0, print: '', face: TOP, cast: TOP, moving: null!, lightBox: null, reachDirty: true, reachCell: REACH, drawing: null, failed: null, staged: false, leaving: false, shown: false, own: false, slept: null,
    };
    d.moving = new Stirring(() => this.stir(d));
    // Whatever says a device has something to do says it to the frame too, and to the other faces of its body, which see it edge-on.
    for (const k of STIRS) {
      let v = d[k];
      Object.defineProperty(d, k, {
        get: () => v,
        set: (x: never) => {
          v = x;
          if (x) this.stir(d);
        },
      });
    }
    const facing: Facing | null = el.hasAttribute('reverse') ? 'back' : el.getAttribute('side') === 'left' ? 'left' : el.getAttribute('side') === 'right' ? 'right' : null;
    const holder = (el.parentElement as HTMLElement & { __d?: Device }).__d;
    if (facing && holder) {
      d.front = holder;
      d.facing = facing;
      holder.faces.push(d);
      if (facing === 'back') holder.reverse = d;
      // The faces of one body lean as one, and are set as one.
      d.lean = holder.lean;
      d.angle = holder.angle;
      // A side is as wide as the body is deep, across the middle of it.
      if (facing !== 'back') el.style.setProperty('--d-deep', `${(depthOf(holder.el) + behindOf(holder.el)) / 0.25}px`);
      if (asked(holder.el) === facing) {
        holder.spun = toward(holder.spun, facing);
        this.turnsDue = true;
      }
    } else if (d.angle[0] || d.angle[1]) el.style.rotate = rotation(d.angle);
    d.plate = this.renderer.open(d);
    if (d.front) {
      d.round = ROUND[d.facing!];
      this.bodied(d.front);
    }
    (el as HTMLElement & { __d?: Device }).__d = d;
    this.devices.add(d);
    // Come into something asleep, it's asleep too, with nothing drawn to show.
    for (let at: Element | null = el; at; at = at.parentElement) if (this.dormant.has(at)) {
      d.slept = { still: null, url: null, pw: 0, ph: 0 };
      d.quiet = true;
      break;
    }
    if (el.parentElement) this.arrived.add(el.parentElement);
    this.io!.observe(el);
    this.view!.observe(el);
    this.far!.observe(el);
    // In device pixels, so a zoom on something round it is heard too, as a window moved to another screen is: neither changes its css size.
    // Safari has no such box, and there a zoom from outside only sharpens with the next layout.
    try {
      this.ro!.observe(el, { box: 'device-pixel-content-box' });
    } catch {
      this.ro!.observe(el);
    }
    d.observer.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true });
    this.markup.observe(el, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true });
    this.bind(d);
  }

  /** Every face of a body sees the others edge-on, so each knows all of them. */
  private bodied(front: Device): void {
    const faces = [front, ...front.faces], body = front.faces.length ? faces.map(f => f.plate) : null;
    for (const f of faces) {
      f.body = body;
      f.plate.edged = [];
    }
  }

  remove(el: HTMLElement): void {
    unscaled(el);
    const d = (el as HTMLElement & { __d?: Device }).__d;
    if (!d) return;
    this.devices.delete(d);
    // What it lit loses its glow.
    if (d.shone.length) {
      this.glowMoved.push(...d.shone);
      this.schedule();
    }
    if (d.front) {
      d.front.faces = d.front.faces.filter(f => f !== d);
      if (d.front.reverse === d) delete d.front.reverse;
      this.bodied(d.front);
    }
    this.io!.unobserve(el);
    this.view!.unobserve(el);
    this.far!.unobserve(el);
    this.judged.delete(d);
    this.farOff.delete(el);
    this.farOn.delete(el);
    el.removeAttribute('data-far');
    el.removeAttribute('data-asleep');
    this.sleepers.delete(d);
    if (this.woken?.d === d) this.woken = null;
    this.ro!.unobserve(el);
    d.observer.disconnect();
    d.listeners.abort();
    for (const fn of d.cleanups.values()) fn();
    this.renderer.close(d.plate);
    if (d.slept?.url) URL.revokeObjectURL(d.slept.url);
    d.slept = null;
    d.canvas.remove();
    this.grounds.get(d)?.canvas.remove();
    this.grounds.delete(d);
    d.drawing?.remove();
    if ((d.staged || d.leaving) && this.stage) {
      const { order } = this.stage, i = order?.indexOf(d) ?? -1;
      if (i >= 0) order!.splice(i, 1);
      this.staleStage = true;
      this.schedule();
    }
    delete (el as HTMLElement & { __d?: Device }).__d;
  }

  /** Whatever is on a device around an element has something new to draw, or finds it hasn't. */
  private touch(d: Device, el: Element | null): void {
    for (let n = el; n && n !== d.el.parentElement; n = n.parentElement) {
      const p = d.parts.get(n as HTMLElement);
      if (p) d.moving.add(p);
    }
  }

  /** The same, from outside. */
  redraw(el: Element, d: Device): void {
    this.touch(d, el);
    this.schedule();
  }

  private bind(d: Device): void {
    const { signal } = d.listeners;
    const focus = (e: Event) => {
      this.touch(d, e.target as Element);
      this.schedule();
    };
    // A press or the keyboard on one asleep wakes all of it that sleeps, before anything it does is drawn.
    const wake = () => {
      if (!d.slept) return;
      let top = d.el;
      for (let up = top.parentElement?.closest<HTMLElement>('d-device, [data-alone]'); up && deviceOf(up)?.slept; up = up.parentElement?.closest<HTMLElement>('d-device, [data-alone]')) top = up;
      void this.wake(top);
    };
    d.el.addEventListener('pointerdown', wake, { signal, capture: true });
    d.el.addEventListener('focusin', wake, { signal, capture: true });
    d.el.addEventListener('focusin', focus, { signal });
    d.el.addEventListener('focusout', focus, { signal });
    // The keyboard in it wakes its markup at once, unless a camera is moving, as then the stop does.
    const keys = (e: FocusEvent) => {
      if (e.type === 'focusin' || d.el.contains(e.relatedTarget as Node | null)) d.used |= KEYS;
      else d.used &= ~KEYS;
      if (!this.sizing) this.rest(d);
    };
    d.el.addEventListener('focusin', keys, { signal });
    d.el.addEventListener('focusout', keys, { signal });
    // A hand on the body, and not on a control, turns the whole thing by what it's holding. It stays there to be looked at and lit, until the hand leaves.
    const body = d.front ?? d;
    if (!d.front && d.turns) for (const [name, on] of [['pointerenter', true], ['pointerleave', false]] as const) d.el.addEventListener(name, () => {
      d.handy = on;
      this.schedule();
    }, { signal });
    const aim = (x: number, y: number) => {
      const over = Math.max(Math.hypot(x, y), 1);
      d.aim = [x / over, y / over];
      this.turnsDue = true;
      this.schedule();
    };
    let held = false;
    d.el.addEventListener('pointerdown', e => {
      if (e.button || e.target !== d.el) return;
      // A body with more than one face goes all the way round under the hand, half a turn to a width of it, and lands on whichever is nearest.
      // Up and down it leans, as one with a single face does, so its top and bottom still come into view. All its faces lean as one.
      // A fixed one stays on the face it's on, and only leans.
      if (body.faces.length && !body.el.hasAttribute('fixed')) {
        const r = body.el.getBoundingClientRect(), ay = body.aim[1], { clientY: y } = e;
        let from = body.spun, x = e.clientX;
        capture(body.el, e);
        held = true;
        const drag = (m: PointerEvent) => {
          // A page that took the pointer for itself in the same press leaves this one nothing to follow.
          if (!keeps(body.el, m)) return drop();
          const by = -((m.clientX - x) / r.width) * Math.PI;
          if (this.cards) {
            // Turned as cards it's never held part way: it gives a little under the hand, and past that whips round to the next face.
            const way = Math.sign(by), rounds = this.turnable(body).flatMap(f => [-1, 0, 1].map(k => toward(from, f.facing ?? 'front') + k * Math.PI * 2));
            const gap = Math.min(...rounds.map(a => (a - from) * way).filter(a => a > 1e-3));
            if (Math.abs(by) > gap * CARD_GIVE) {
              from += way * gap;
              x = m.clientX;
              body.spun = from;
            } else body.spun = from + by * CARD_FOLLOW;
          } else body.spun = from - ((m.clientX - x) / r.width) * Math.PI;
          if (body.lean) for (const f of [body, ...body.faces]) f.aim = [0, Math.max(-1, Math.min(1, ay - (m.clientY - y) / (r.height / 2)))];
          this.turnsDue = true;
          this.schedule();
        };
        const drop = () => {
          held = false;
          // It lands on whichever face it has that's nearest, a side as much as the back.
          const near = this.turnable(body).map(f => f.facing ?? 'front').reduce((a, b) => (Math.abs(toward(body.spun, b) - body.spun) < Math.abs(toward(body.spun, a) - body.spun) ? b : a));
          body.spun = toward(body.spun, near);
          if (near === 'front') body.el.removeAttribute('turned');
          else body.el.setAttribute('turned', near === 'back' ? '' : near);
          this.turnsDue = true;
          this.schedule();
          body.el.removeEventListener('pointermove', drag);
          body.el.removeEventListener('lostpointercapture', drop);
        };
        body.el.addEventListener('pointermove', drag, { signal });
        body.el.addEventListener('lostpointercapture', drop, { signal });
        return;
      }
      if (!d.lean) return;
      const r = d.el.getBoundingClientRect(), [ax, ay] = d.aim, { clientX: x, clientY: y } = e;
      capture(d.el, e);
      held = true;
      const drag = (m: PointerEvent) => (keeps(d.el, m) ? aim(ax - (m.clientX - x) / (r.width / 2), ay - (m.clientY - y) / (r.height / 2)) : drop());
      const drop = () => {
        held = false;
        d.el.removeEventListener('pointermove', drag);
        d.el.removeEventListener('lostpointercapture', drop);
      };
      d.el.addEventListener('pointermove', drag, { signal });
      d.el.addEventListener('lostpointercapture', drop, { signal });
    }, { signal });
    d.el.addEventListener('pointerleave', () => {
      if (held) return;
      for (const f of body.faces.length ? [body, ...body.faces] : [d]) if (f.aim[0] || f.aim[1]) {
        f.aim = [0, 0];
        this.turnsDue = true;
        this.schedule();
      }
    }, { signal });
    const sync = (e: Event) => {
      // Picking a radio button clears the others, and they get no event of their own.
      if ((e.target as HTMLInputElement).type === 'radio') {
        for (const p of d.list) {
          p.def.update?.(p);
          d.moving.add(p);
        }
        this.schedule();
      }
      for (let n = e.target as HTMLElement | null; n && n !== d.el.parentElement; n = n.parentElement) {
        const part = d.parts.get(n);
        if (part?.def.update) {
          part.def.update(part);
          d.moving.add(part);
          this.schedule();
        }
      }
    };
    d.el.addEventListener('input', sync, { signal });
    d.el.addEventListener('change', sync, { signal });
  }

  /** Lights everything again, for a change to the light itself. */
  relight(): void {
    this.lightDirty = this.fullLight = true;
    this.schedule();
  }

  /** True while something else aims the lamp with `aim`, and the pointer doesn't. */
  lampHeld = false;

  /** Where the torch has got to, in window pixels, for anything on the page that should move with it. */
  get aimed(): { x: number; y: number } {
    return this.pointer;
  }

  /** Points the torch and the lights somewhere, in window pixels. Unlike a hand, this carries the lamp over everything on the page. */
  aim(x: number, y: number): void {
    const p = this.pointer;
    p.tx = x;
    p.ty = y;
    p.ti = 1;
    this.carried = true;
    this.schedule();
  }

  /** Hands the lamp back to the pointer, which lets it lean home until the pointer next moves. */
  letGo(): void {
    this.lampHeld = false;
    this.pointer.ti = 0;
    this.schedule();
  }

  /** Asks for a frame. With `el`, for the device it's in, which the frame then takes up. Asked from a part's `tick`, it's for that
   * part's device, which is taken up again on the next. */
  schedule(el?: Element): void {
    const d = el ? deviceOf(el) : this.ticking;
    if (d) {
      this.stir(d);
      if (d === this.ticking) this.tickAsked = true;
    }
    if (!this.raf && this.ok) this.raf = requestAnimationFrame(this.tick);
  }

  /** A frame on the next beat, unless one comes sooner. */
  private onBeat(): void {
    if (this.raf || this.beatTimer || !this.ok) return;
    this.beatTimer = window.setTimeout(() => ((this.beatTimer = 0), this.schedule()), Math.max(0, this.beatAt + STIR_BEAT - performance.now()));
  }

  /** Runs frames until there's nothing left to work out and the renderer has drawn all it was asked for. For tests, as rAF can be throttled.
   * Twice quiet running, as what one frame finishes can ask for the next. What's live is never settled, so waiting on the renderer stops after 2 s. */
  /** Devices `flushed` has waited to be told about whether they're near the window. */
  private told = new WeakSet<Element>();
  async flushed(frames = 240): Promise<void> {
    await document.fonts.ready;
    for (let i = 0; i < 300 && ![...this.devices].some(d => d.visible); i++) await new Promise(r => setTimeout(r, 10));
    // One just added isn't near the window to the engine until its observers say so, at the next rendering step. An observer made now
    // reports then too, after the engine's, which were made first. What's been waited for once already has been told.
    const els = [...this.devices].map(d => d.el).filter(el => !this.told.has(el));
    for (const el of els) this.told.add(el);
    if (els.length) await new Promise<void>(done => {
      const io = new IntersectionObserver(() => { io.disconnect(); done(); });
      for (const el of els) io.observe(el);
    });
    let t = performance.now(), quiet = 0;
    const work = () => this.stats.lights + this.stats.paints + this.stats.layouts;
    for (let i = 0; i < frames && quiet < 2; i++) {
      const before = work();
      this.flush((t += 16.7));
      // A lamp still easing to where it's going is lit at its own rate, so a frame between two of its lights draws nothing and isn't quiet.
      const easing = this.sweeping || this.handsDue || this.turnsDue;
      // Nor is one whose springs are still being read for the player: each is painted three times, and the page is at rest once they all are.
      const reading = !!this.player && [...this.devices].some(d => d.unread);
      quiet = work() === before && !easing && !reading ? quiet + 1 : 0;
      await new Promise(r => setTimeout(r));
    }
  }

  /** Runs one frame now. */
  flush(now = performance.now()): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.sizing) this.settle();
    this.tick(now, true);
  }

  /**
   * Runs after layout and before paint, so what's drawn here goes out with the HTML. Only what changed size draws, in a
   * frame of its own that costs what a device arriving would, with light kept cheap until it stops.
   */
  private resized(entries: ResizeObserverEntry[]): void {
    // One resized moves what's round it, as far as the box that holds its layout.
    const within = new Set<Element>();
    for (const e of entries) {
      const holder = holderOf(e.target.parentElement);
      if (!holder) {
        within.clear();
        this.moves++;
        break;
      }
      within.add(holder);
    }
    if (within.size) this.shifted(within);
    let draw = false, sized = false;
    for (const e of entries) {
      const d = (e.target as HTMLElement & { __d?: Device }).__d;
      if (!d) continue;
      // What's arriving has no picture to keep up.
      if (!d.placed) {
        d.layoutDirty = true;
        continue;
      }
      // A zoom has the browser scale the picture that's there, so it's right already, and only sharper for a layout when it stops.
      const same = this.flat(d, () => {
        const r = d.el.getBoundingClientRect(), z = zoomOf(d.el, r);
        // Rects snap to a fraction of a pixel on the screen, which dividing out a small zoom would make a change of size.
        return Math.abs(r.width - d.w * z) < SNAP && Math.abs(r.height - d.h * z) < SNAP;
      });
      // Out of sight, one that only zoomed keeps its picture too, and is seen to as it comes back: a page zoomed out shows hundreds at once.
      if (!d.visible) {
        if (same) d.owed = true;
        else d.layoutDirty = true;
        continue;
      }
      sized = d.owed = true;
      if (same) continue;
      if (!this.shown(d, d.el)) continue;
      d.el.dispatchEvent(new Event('resized'));
      // Whatever that changed goes in the layout coming now, and needs no other.
      d.observer.takeRecords();
      d.layoutDirty = draw = true;
    }
    if (sized) {
      this.sizing = true;
      this.sizedUntil = Math.max(this.sizedUntil, performance.now() + SIZED);
      this.sizedTimer ||= window.setTimeout(this.waited, SIZED);
    }
    if (draw && !this.renderer.lost) {
      this.renderer.begin(false, performance.now() - this.scrollAt > 200);
      this.weigh();
      this.frame(performance.now());
    } else this.schedule();
  }

  /** Devices that came near the window or left it, by `KEEP_MARGIN`. */
  private near(seen: readonly (readonly [Device, boolean])[]): void {
    const came: Device[] = [];
    for (const [d, near] of seen) {
      d.visible = near;
      if (near) {
        came.push(d);
        // Lit as it was when it left, it needs lighting again only if the light changed meanwhile.
        if (this.held(d)) d.lightDirty ||= d.seenLight !== this.lightChanges;
        // Given back to make room, it still shows what it drew, so it's made again in turn, as one waiting to be sharper is.
        else if (d.placed) {
          d.viewDirty = d.sharpen = true;
          d.toward = 1;
        }
        else d.layoutDirty = true;
      } else {
        d.left = ++this.departures;
        d.seenLight = this.lightChanges;
      }
    }
    // A camera still moving leaves it to the stop, but for what's out of reach, which it costs every frame till then.
    if (this.stage) this.restAll(this.sizing ? came.filter(d => d.el.closest('[inert]')) : came);
    this.schedule();
  }

  /** A device came within `SHOWN_MARGIN` of the window, or left it. */
  private sighted(d: Device | undefined, shown: boolean): void {
    if (d?.owed && shown && !this.sizing) {
      this.sharpenFor(d);
      d.owed = false;
    }
  }

  /** A device came within `FAR_MARGIN` of the window, or went further. */
  private farFrom(el: Element, near: boolean): void {
    const d = (el as HTMLElement & { __d?: Device }).__d;
    if (near) {
      this.farOff.delete(el);
      if (this.sizing && d?.staged && this.bare(d)) this.farOn.add(el);
      else el.removeAttribute('data-far');
    } else {
      this.farOn.delete(el);
      if (this.sizing) this.farOff.add(el);
      else el.setAttribute('data-far', '');
    }
  }

  /**
   * Tells each device in a camera's world whether it's near the window, shown in it or far from it, as the observers do for the rest, once
   * for each move. A box in a camera's world is worked out from where it is in that world, so this reads nothing, however many there are.
   * One that comes into a camera's world is taken from the observers here, and told where it is from what they last said.
   */
  private judge(): void {
    this.sure();
    if (this.judgedAt[0] === this.moves && this.judgedAt[1] === this.looks && this.judgedAt[2] === this.shifts && this.judgedAt[3] === this.devices.size) return;
    this.judgedAt = [this.moves, this.looks, this.shifts, this.devices.size];
    for (const d of this.devices) {
      if (this.judged.has(d) || !d.el.isConnected || !this.camOf(d)) continue;
      this.io!.unobserve(d.el);
      this.view!.unobserve(d.el);
      // What the observer had still to say of it is said first, and what it said that's waiting for the camera to stop is let go:
      // from here its being far is this one's word alone, given whole the first time. Or one the observer called far as it
      // arrived, before it was laid out, is marked far when the camera stops, in the window, and nothing takes the mark off.
      for (const e of this.far!.takeRecords()) this.farFrom(e.target, e.isIntersecting);
      this.far!.unobserve(d.el);
      this.farOff.delete(d.el);
      this.farOn.delete(d.el);
      this.judged.set(d, { near: d.visible, shown: false, far: null });
    }
    if (!this.judged.size) return;
    // All laid flat at once, as one at a time lays the whole world out again for each.
    this.unbend([...this.judged.keys()].filter(d => d.staged && d.bend?.moved));
    const W = innerWidth, H = innerHeight;
    // As the observers judge it: a box is cut to whatever clips its world first, and what's left is near if it meets the window grown by
    // the margin. A world shown in a window-sized view has nothing near that's out of the window, whatever the margin.
    // In the window's px, or in its camera's world from where the window is in it, so a box kept there is judged without being made.
    let l = 0, t = 0, k = 1, clip = [-Infinity, -Infinity, Infinity, Infinity];
    const clips = new Map<HTMLElement, number[]>();
    const within = (x: number, y: number, w: number, h: number, mx: number, my: number) =>
      x + w >= (Math.max(-mx, clip[0]!) - l) / k && x <= (Math.min(W + mx, clip[2]!) - l) / k &&
      y + h >= (Math.max(-my, clip[1]!) - t) / k && y <= (Math.min(H + my, clip[3]!) - t) / k;
    const near: [Device, boolean][] = [];
    let shown = false;
    for (const [d, was] of this.judged) {
      // Laid out again somewhere no camera shows, it's the observers' again.
      if (d.cam === undefined && !this.camOf(d)) {
        this.judged.delete(d);
        this.io!.observe(d.el);
        this.view!.observe(d.el);
        this.far!.observe(d.el);
        continue;
      }
      const kept = d.kept[0], lens = this.lens(d.cam!);
      clip = clips.get(d.cam!) ?? (clips.set(d.cam!, clipOf(d.cam!)), clips.get(d.cam!)!);
      let x: number, y: number, w: number, h: number;
      // One that something moves is judged where it's shown, not where it would lie flat, or one whose corner turns into the window is
      // judged out of it, here and not by the observers it came from.
      const turned = this.shownOf(d);
      if (turned) [x, y, w, h, l, t, k] = [turned.left, turned.top, turned.width, turned.height, 0, 0, 1];
      else if (lens && kept.at === this.moves && kept.local) {
        [x, y, w, h] = kept.local;
        [l, t, k] = [lens.left, lens.top, lens.s];
      } else {
        const r = this.where(d);
        [x, y, w, h, l, t, k] = [r.left, r.top, r.width, r.height, 0, 0, 1];
      }
      const keep = within(x, y, w, h, KEEP, KEEP), see = within(x, y, w, h, SHOWN_MARGIN, SHOWN_MARGIN), far = !within(x, y, w, h, W * FAR, H * FAR);
      if (keep !== was.near) near.push([d, (was.near = keep)]);
      if (see !== was.shown) {
        this.sighted(d, (was.shown = see));
        shown = true;
      }
      if (far !== was.far) this.farFrom(d.el, !(was.far = far));
    }
    this.see();
    if (near.length) this.near(near);
    else if (shown) this.schedule();
  }

  /** The camera world a device is in, the one camera round it, or null for none or more than one. */
  private camOf(d: Device): HTMLElement | null {
    if (d.cam === undefined) {
      const w = d.el.closest<HTMLElement>('[data-camera]');
      d.cam = w && !w.parentElement?.closest('[data-camera]') ? w : null;
    }
    return d.cam;
  }

  /** Scrolling moves finished pictures, unless they're lit from the pointer. A camera moves its world, which is kept apart: see `keep`. */
  private panned(camera = false): void {
    if (camera) this.looks++;
    else this.moves++;
    this.scrollAt = performance.now();
    this.glowStale = true;
    if (this.sleepers.size) this.sleptStale = true;
    if (this.stage) {
      this.staleStage = true;
      this.schedule();
    }
    // What's under the hand changes as the page moves.
    if (this.lights && this.pointer.i) {
      this.handShifted = true;
      this.schedule();
    }
    if (!this.torch) return;
    this.lightDirty = this.scrolled = true;
    this.schedule();
  }

  /** A camera moved: what's in its world is shown at a new size and place, and nothing in it was laid out again. So it's a scroll, and a zoom
   * with nothing to measure: each picture is scaled by the browser until the camera stops, then what's in the window is drawn again if it's soft. */
  private viewed(world: HTMLElement): void {
    if (!this.stage && world.isConnected && staging(world)) this.stageIn(world);
    this.panned(true);
    let any = false;
    for (const d of this.devices) {
      if (!d.placed || !world.contains(d.el)) continue;
      // Drawn again only once it stops, as all of it is.
      d.owed = any = true;
    }
    if (!any) return;
    this.sizing = true;
    // A resize still going keeps its own wait.
    this.sizedUntil = Math.max(this.sizedUntil, performance.now() + VIEWED);
    this.sizedTimer ||= window.setTimeout(this.waited, VIEWED);
    this.schedule();
  }

  private waited = (): void => {
    const left = this.sizedUntil - performance.now();
    if (left >= 1) this.sizedTimer = window.setTimeout(this.waited, left);
    else this.settle();
  };

  /** Resizing stopped: everything it put off, which comes out as a fresh load would. */
  private settle(): void {
    clearTimeout(this.sizedTimer);
    this.sizedTimer = 0;
    this.sizing = false;
    this.quietAt = -1;
    for (const el of this.farOff) el.setAttribute('data-far', '');
    for (const el of this.farOn) el.removeAttribute('data-far');
    this.farOff.clear();
    this.farOn.clear();
    if (this.stage) {
      // A device a hand woke is still the one under it only if the camera left it there.
      const w = this.woken, at = this.handAt;
      if (w && (!at || !inside((w.r = this.where(w.d)), at[0], at[1]))) this.unhand();
      // Only what's near the window. The rest is judged as it comes back: waking what nobody can see restyles the world for nothing.
      this.restAll([...this.devices].filter(d => d.visible));
      this.sleptStale = false;
    }
    // What's out of sight is judged as it comes back, at whatever zoom it comes back to, and not for one it was never seen at.
    for (const d of this.devices) {
      if (!d.owed || !d.visible) continue;
      this.sharpenFor(d);
      d.owed = false;
    }
    this.schedule();
  }

  /**
   * What a zoom left a device owing, now it's stopped. Its picture is already scaled to the size it's shown at, so it's
   * drawn again only once that's visibly soft, or far bigger than it needs: a page zoomed a little out of hundreds of things
   * would otherwise draw every one of them again, for nothing anyone could see.
   */
  private sharpenFor(d: Device): void {
    const z = zoomOf(d.el), want = this.whole(d.cw, d.ch, z), cell = reachCell(z);
    if (cell !== d.reachCell) {
      d.reachCell = cell;
      d.reachDirty = true;
    }
    if (want > d.dpr * SOFTER || want < d.dpr / BIGGER) {
      d.viewDirty = d.sharpen = true;
      d.toward = (want / d.dpr) ** 2;
    }
    // A zoom that came back before its turn came leaves nothing to do, unless what it drew was given back meanwhile and all it has is
    // a picture made small to keep, however sharp it was once drawn. Its own canvas, or a picture given back whole, still shows what
    // it drew as sharp as it was.
    else if (d.sharpen && (this.held(d) || !d.staged || (d.plate.picture?.pw === d.pw && d.plate.picture.ph === d.ph))) d.viewDirty = d.sharpen = false;
    if (d.viewDirty) d.quiet = false;
  }

  /** Whether what a device last drew is still all there is to show: nothing about it, its light or its parts has changed or is moving. */
  private standing(d: Device, version: number): boolean {
    return !d.layoutDirty && !d.viewDirty && !d.materialDirty && !d.lightDirty && !this.lightDirty && !d.moving.size && d.version === version &&
      !d.movers.some(m => m.p.def.tick || m.springs.some(s => s.active));
  }

  /** How many pixels a device draws to the css px at the zoom it's shown at, whatever its size: what fits of that is `whole`. */
  private sharpness(z: number): number {
    // Shown smaller than a pixel to the css px, it draws at what it's shown at, and what falls below a pixel is roughness, as it is for
    // the eye. A page of a thousand things shown small is otherwise a thousand drawn full size.
    // And never finer than a hand can take a camera: a script going closer sees the closest drawing shown bigger.
    const shown = (devicePixelRatio || 1) * Math.min(z, CLOSEST_ALONE);
    // A screen with two pixels or more to the css px hides a stair-step of one, as a phone's does, so it's drawn at what it shows:
    // drawn at twice that, a page zoomed into a cell held 1.2 GB of maps where 0.4 does, and took 2.6 times as long to come out sharp.
    const over = (devicePixelRatio || 1) >= 2 ? 1 : this.oversample;
    // Unless the window shows more than the GPU holds: then everything is drawn that much coarser, which is better than blank.
    return Math.max(Math.min(shown * over, this.maxRatio), shown) * this.renderer.store.squeeze;
  }

  /** What a device is made of and how it's aged. Two faces of a body are the one body, so the front says. */
  private condition(d: Device): void {
    const { el } = d.front ?? d;
    d.material = el.getAttribute('material') ?? 'plain';
    d.scheme = schemeOf(el);
    const c = CONDITIONS[el.getAttribute('condition') ?? 'new'] ?? CONDITIONS.new!;
    d.age = +(el.getAttribute('age') ?? c.age);
    // Age brings wear with it, unless a device asks for something else.
    d.wear = +(el.getAttribute('wear') ?? Math.max(c.wear, d.age * 0.6));
    d.prints = +(el.getAttribute('prints') ?? c.prints);
    d.dust = +(el.getAttribute('dust') ?? c.dust);
    d.scuff = +(el.getAttribute('scuff') ?? c.scuff);
    d.haze = +(el.getAttribute('haze') ?? c.haze);
    // Time brings dirt and sun with it, unless a device asks for something else.
    d.grime = +(el.getAttribute('grime') ?? Math.max(c.grime, d.age));
    d.dents = +(el.getAttribute('dents') ?? c.dents);
    // Glass breaks once, in a fall. No amount of use brings it on, so no condition sets it.
    d.cracks = Math.min(Math.max(+(el.getAttribute('cracks') ?? 0) || 0, 0), 1);
    d.fade = +(el.getAttribute('fade') ?? Math.max(c.fade, d.age * 0.5));
    d.radius = parseLength(el.getAttribute('radius'), 2.5) * MM;
    d.seed = +(el.getAttribute('seed') ?? d.seed);
    d.debug = debugOf(el);
    d.split = splitOf(el);
    // A loose thing is in its holder, so a view of the holder is a view of it too, unless it asks for its own.
    const holder = el.hasAttribute('loose') ? (el.parentElement as HTMLElement & { __d?: Device } | null)?.__d : undefined;
    if (holder && !el.hasAttribute('debug')) d.debug = holder.debug;
    if (holder && !el.hasAttribute('split')) d.split = this.seam(holder, d);
  }

  /**
   * Hands a device's view on to what's loose in it, each with the seam where it crosses that one: the holder's seam is a line down the
   * page, and a piece lying beside the body may be all on one side of it.
   */
  private carry(d: Device): void {
    for (const el of d.el.querySelectorAll<HTMLElement & { __d?: Device }>(':scope > d-device[loose]')) {
      const c = el.__d;
      if (!c) continue;
      if (!el.hasAttribute('debug')) {
        c.debug = d.debug;
        for (const f of c.faces) f.debug = c.debug;
      }
      if (!el.hasAttribute('split')) c.split = this.seam(d, c);
      c.lightDirty = true;
      c.lightBox = null;
    }
  }

  /** Where a holder's seam falls across one of its loose pieces, as that piece's own split. */
  private seam(holder: Device, c: Device): number {
    if (holder.split < 0) return -1;
    const a = holder.el.getBoundingClientRect(), b = c.el.getBoundingClientRect(), x = a.left + a.width * holder.split;
    return b.width ? Math.min(Math.max((x - b.left) / b.width, 0), 1) : holder.split;
  }

  /** Measures a device and its parts off the page, or with `view`, only places its canvas again for how it's shown now. */
  private layout(d: Device, view = false): void {
    d.eye = eyeOf(d.front?.el ?? d.el);
    d.bare = d.plain = d.hid = null;
    d.kept[0].at = d.kept[1].at = -1;
    d.cam = undefined;
    this.flat(d, () => this.measure(d, view && d.placed && !d.layoutDirty));
    // Measured while what holds it was moving, as a page sliding it to where a new zoom puts it does, it's measured again where it lands.
    const landing = d.landing ? null : inFlight(d.el);
    if (landing) {
      d.landing = true;
      void landing.then(() => {
        d.landing = false;
        d.layoutDirty = true;
        this.schedule();
      });
    }
    if (!this.stage) return;
    this.restage(d);
    if (!this.sizing) this.rest(d);
  }

  /** Puts the shared canvas in a camera's world, to draw what's in it from pictures it keeps, one canvas for all of them. */
  private stageIn(world: HTMLElement): void {
    const canvas = this.renderer.stage();
    canvas.dataset.d = 'stage';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform' });
    // First, so every device in the world is drawn over it, its parts and all.
    world.prepend(canvas);
    this.stage = { world, canvas, order: null };
    for (const d of this.devices) if (d.placed) this.restage(d);
    this.staleStage = true;
  }

  /** Takes the shared canvas back out of the page, and every device it showed goes back to a canvas of its own. */
  private stageOut(): void {
    const was = this.stage;
    if (!was) return;
    this.stage = null;
    this.sleepers.clear();
    this.woken = null;
    for (const d of this.devices) {
      d.el.removeAttribute('data-asleep');
      d.used &= ~HAND;
      if (d.reachDirty) this.stir(d);
      d.leaving = false;
      if (!d.staged) continue;
      d.staged = false;
      d.lightDirty = true;
      d.lightBox = null;
    }
    this.renderer.unstage();
    this.schedule();
  }

  /** Whether the stage can show a device as its own canvas would: only what nothing between them clips, fades or filters, as one picture
   * can't be, though anything may turn, move or project it, which the stage draws it through. One in another device is drawn on the stage
   * under all markup, so only over one there too whose markup paints nothing but what's in it. Clipped for being far from the window is
   * ours, not the page's, and the stage already leaves out what isn't near it. */
  private stageable(d: Device): boolean {
    const world = this.stage?.world, was = d.bend;
    d.bend = null;
    if (!world || !world.contains(d.el)) return false;
    const holder = d.el.parentElement?.closest('d-device, [data-alone]'), round = holder && world.contains(holder) ? deviceOf(holder) : null;
    if (holder && world.contains(holder) && (!round?.staged || !this.plain(round))) return false;
    // What shows of it is its canvas, which a face, a fold or a piece shows or hides as it's up, open or out: one hidden now may show,
    // and is read again each time it's drawn. Hidden for being far off is ours.
    const hidden = getComputedStyle(d.canvas).visibility !== 'visible' && !d.el.closest(HIDDEN_FAR), chain: HTMLElement[] = [d.canvas];
    // A body turned as cards turns its faces' canvases, and what holds one may move it.
    let moved = false, turns = !!(d.front || d.faces.length || round || hidden);
    for (let e: HTMLElement | null = d.el; e && e !== world; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.filter !== 'none' || s.opacity !== '1' || (s.clipPath !== 'none' && !e.hasAttribute('data-far')) || s.maskImage !== 'none' || s.mixBlendMode !== 'normal'
        || s.overflowX !== 'visible' || s.overflowY !== 'visible') return false;
      const own = s.transform !== 'none' || s.translate !== 'none' || s.rotate !== 'none' || s.scale !== 'none';
      moved ||= own;
      turns ||= own || s.perspective !== 'none';
      chain.push(e);
    }
    if (!turns && getComputedStyle(world).perspective === 'none') return true;
    chain.push(world);
    // Turning its faces restyles a body each frame, which moves nothing of where they lie flat.
    d.bend = was && was.chain.length === chain.length && was.chain.every((e, i) => e === chain[i]) ? Object.assign(was, { moved, h: undefined }) : { chain, moved, flat: null, zoom: [], at: -1 };
    return true;
  }

  /** Whether a device's markup paints nothing but its canvas: no other canvas or image shown, no text or box anyone can see. */
  private bare(d: Device): boolean {
    if (d.bare !== null) return d.bare;
    // Hidden for being far off, what it shows can't be read, so it's taken to show something until it's back.
    if (d.el.closest(HIDDEN_FAR)) return false;
    return (d.bare = this.paintless(d, false));
  }

  /** The same, but for the devices in it, which are theirs. */
  private plain(d: Device): boolean {
    if (d.plain !== null) return d.plain;
    if (d.el.closest(HIDDEN_FAR)) return false;
    return (d.plain = this.paintless(d, true));
  }

  private paintless(d: Device, within: boolean): boolean {
    const walk = (el: Element): boolean => {
      for (const n of el.children) {
        // Its sketch is gone once its picture lands, so it shows nothing the picture doesn't.
        if (n === d.canvas || n === d.drawing || (within && n.matches('d-device, [data-alone]')) || d.faces.some(f => f.el === n)) continue;
        // A screen's canvas is drawn into the picture, and left in the markup unseen.
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.opacity === '0') continue;
        if (['canvas', 'img', 'svg', 'video', 'iframe', 'object', 'embed'].includes(n.localName)) return false;
        if (s.visibility === 'visible') {
          const box = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || s.boxShadow !== 'none'
            || (s.borderStyle !== 'none' && s.borderWidth !== '0px') || (s.outlineStyle !== 'none' && s.outlineWidth !== '0px');
          const text = s.color !== 'rgba(0, 0, 0, 0)' && [...n.childNodes].some(c => c.nodeType === Node.TEXT_NODE && c.textContent!.trim());
          if (box || text || ['input', 'select', 'textarea'].includes(n.localName) && s.appearance !== 'none') return false;
        }
        if (!walk(n)) return false;
      }
      return true;
    };
    return walk(d.el);
  }

  /**
   * Reads where each of these staged devices lies flat, and everything between it and its world: with every transform among them taken
   * off for a moment, as `[data-bent]` does, all at once, so the page is laid out again once for all of them. Kept until the page moves:
   * a camera moves its world, which is where they're kept.
   */
  private unbend(ds: Device[]): void {
    const world = this.stage?.world, due = ds.filter(d => d.bend && d.bend.at !== this.moves);
    if (!world || !due.length) return;
    for (const d of due) for (const e of d.bend!.chain) if (e !== d.canvas && e !== world) e.setAttribute('data-bent', '');
    const wr = world.getBoundingClientRect(), k = world.offsetWidth ? wr.width / world.offsetWidth : 1;
    for (const d of due) {
      const b = d.bend!;
      b.flat = b.chain.map(e => {
        if (e === world) return [0, 0, world.offsetWidth, world.offsetHeight] as const;
        const r = e === d.canvas ? null : e.getBoundingClientRect();
        return r ? ([(r.left - wr.left) / k, (r.top - wr.top) / k, r.width / k, r.height / k] as const) : ([0, 0, 0, 0] as const);
      });
      b.zoom = b.chain.map(() => 1);
      for (let i = b.chain.length - 2; i >= 0; i--) b.zoom[i] = b.zoom[i + 1]! * (parseFloat(getComputedStyle(b.chain[i]!).zoom) || 1);
      // Its canvas is wherever it was last put, as the stage shows it: where it would be is worked out from the device, in its px.
      const [x, y] = b.flat[1]!, z = b.zoom[1]!;
      b.flat[0] = [x - d.x * z, y - d.y * z, d.cw * z, d.ch * z];
      b.at = this.moves;
    }
    for (const d of due) for (const e of d.bend!.chain) e.removeAttribute('data-bent');
  }

  /** Where a staged device that something moves would lie flat in the window, or null for one whose box is already that. */
  private flatOf(d: Device): DOMRect | null {
    const b = d.bend, world = this.stage?.world;
    if (!d.staged || !b?.moved || !world) return null;
    this.unbend([d]);
    const [x, y, w, h] = b.flat![1]!, wr = world.getBoundingClientRect(), k = world.offsetWidth ? wr.width / world.offsetWidth : 1;
    return new DOMRect(wr.left + x * k, wr.top + y * k, w * k, h * k);
  }

  /** Where a staged device that something moves is shown in the window, or its canvas for `which` 1: the box round where it lies flat,
   * carried by all that moves it, as an observer sees its box. Null for one whose box is already that. */
  private shownOf(d: Device, which: 0 | 1 = 0): DOMRect | null {
    const b = d.bend, world = this.stage?.world;
    if (!d.staged || !b?.moved || !world) return null;
    const m = this.bent(d), [x, y, w, h] = b.flat![which ? 0 : 1]!;
    // A camera's world is where its lens says, read once a move for all of them.
    const wr = (this.camOf(d) === world && this.lens(world)) || (r => ({ left: r.left, top: r.top, s: world.offsetWidth ? r.width / world.offsetWidth : 1 }))(world.getBoundingClientRect()), k = wr.s;
    let [l, t, r, bt] = [x, y, x + w, y + h];
    if (m) {
      [l, t, r, bt] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) {
        const q = m[6]! * px + m[7]! * py + m[8]!, sx = (m[0]! * px + m[1]! * py + m[2]!) / q, sy = (m[3]! * px + m[4]! * py + m[5]!) / q;
        [l, t, r, bt] = [Math.min(l, sx), Math.min(t, sy), Math.max(r, sx), Math.max(bt, sy)];
      }
    }
    return new DOMRect(wr.left + l * k, wr.top + t * k, (r - l) * k, (bt - t) * k);
  }

  /**
   * How the page shows a staged device off where it lies flat: each transform between its picture and its world, about its own origin,
   * and the perspective of what holds each, flattened wherever that doesn't keep 3D, as the browser does it. A map of its world's css px
   * to the same, nine numbers, rows, for x, y and w; null for none.
   */
  private bent(d: Device): number[] | null {
    const b = d.bend!, world = this.stage!.world, made = `${this.moves} ${(d.front ?? d).spinning} ${turnsOf(world)}`;
    if (b.h !== undefined && b.made === made) return b.h;
    this.unbend([d]);
    let m = new DOMMatrix(), any = false;
    b.chain.forEach((e, i) => {
      const s = getComputedStyle(e), [x, y, w, h] = b.flat![i]!, z = b.zoom[i]!;
      if (i) {
        if (s.perspective !== 'none') {
          const [px, py] = s.perspectiveOrigin.split(' ').map(v => parseFloat(v)), p = new DOMMatrix();
          p.m34 = -1 / parseFloat(s.perspective);
          m = about(zoomed(p, z), x + px! * z, y + py! * z).multiply(m);
          any = true;
        }
        if (s.transformStyle !== 'preserve-3d') m.m13 = m.m23 = m.m33 = m.m43 = 0;
      }
      const own = e === world ? null : ownTransform(s, w / z, h / z);
      if (!own) return;
      const [ox, oy, oz] = s.transformOrigin.split(' ').map(v => parseFloat(v));
      m = about(zoomed(own, z), x + ox! * z, y + oy! * z, (oz || 0) * z).multiply(m);
      any = true;
    });
    b.made = made;
    return (b.h = any ? [m.m11, m.m21, m.m41, m.m12, m.m22, m.m42, m.m14, m.m24, m.m44] : null);
  }

  /**
   * Puts a device's markup to sleep, or wakes it. Each frame a camera moves, the browser lays every piece of markup in its world into layers
   * again, however little of it paints, so markup nobody can use costs every frame. In a camera's world, one that paints nothing of its own
   * and is shown too small to work by hand, or is inert, which no hand can work at any size, has its markup hidden: not painted or hit, but laid out where it was, so its box, place and
   * parts hold. Until it wakes, the keyboard and a screen reader pass it by too. A hand coming over where it is wakes it.
   * Asked only once a camera stops, or the page is still, so a move changes nothing in the page but the camera.
   */
  private rest(d: Device, r = this.restAt(d)): void {
    const sleep = !!r && (Math.max(r.width, r.height) < AWAKE || !!d.el.closest('[inert]'));
    if (sleep) this.sleepers.set(d, r);
    // What a hand can reach on it waited while it slept.
    else if (this.sleepers.delete(d) && d.reachDirty) this.stir(d);
    if (sleep !== d.el.hasAttribute('data-asleep')) d.el.toggleAttribute('data-asleep', sleep);
  }

  /** Puts each to sleep or wakes it. All read, then all set: a box read after a device was put to sleep lays the whole world out again, each time. */
  private restAll(ds: Device[]): void {
    const where = ds.map(d => this.restAt(d));
    ds.forEach((d, i) => this.rest(d, where[i]));
  }

  /** Where a device that could sleep is, or null for one that can't. */
  private restAt(d: Device): DOMRect | null {
    const world = this.stage?.world;
    if (!world || d.used || !world.contains(d.el)) return null;
    // Turned away and out of reach it shows nothing, drawn yet or not.
    return (d.placed && this.bare(d)) || (this.away(d) && d.el.closest('[inert]')) ? this.where(d) : null;
  }

  /** The hand has left the device it woke, which may sleep again. */
  private unhand(): void {
    const was = this.woken;
    if (!was) return;
    this.woken = null;
    was.d.used &= ~HAND;
    if (!this.sizing) this.rest(was.d);
  }

  /** Moves a device onto the stage or off it, as it now can or can't be shown there. */
  private restage(d: Device): void {
    const on = this.stageable(d);
    if (on === d.staged) return;
    d.staged = on;
    const order = this.stage!.order;
    if (on) {
      // Its canvas stays for where the picture goes, and goes on showing what it last drew until the stage has a picture of it,
      // as one comes only once it's lit: a camera that brings a page of them onto the stage would otherwise show them blank.
      if (d.plate.picture || !d.canvas.width) this.vacate(d);
      // Back before it had left, it's still in the order.
      if (d.leaving) d.leaving = false;
      else order?.splice(inOrder(order, d), 0, d);
    } else if (d.plate.picture && order) {
      // The other way the same: its own canvas has nothing until it's lit, a frame or two on, so the stage goes on showing it till then
      // (`left`), as it last was. A body starting to turn would otherwise blink.
      d.leaving = true;
    } else {
      this.renderer.forget(d.plate);
      order?.splice(order.indexOf(d), 1);
    }
    d.lightDirty = true;
    d.lightBox = null;
    this.staleStage = true;
    // What's in it is drawn over it, so it goes on the stage or off with it.
    for (const e of d.el.querySelectorAll('d-device, [data-alone]')) {
      const n = deviceOf(e);
      if (n?.placed && n !== d) this.restage(n);
    }
  }

  /** A device that went off the stage has a picture on its own canvas now, so the stage lets it go. */
  private left(d: Device): void {
    if (!d.leaving) return;
    d.leaving = false;
    const order = this.stage?.order, i = order?.indexOf(d) ?? -1;
    if (i >= 0) order!.splice(i, 1);
    this.renderer.forget(d.plate);
    this.staleStage = true;
    this.schedule();
  }

  /** Empties a staged device's canvas: the stage shows it now. Shrunk to nothing, not hidden or taken out, so its style still says whether
   * the page would show it and how it's turned, as a face up or a fold open does. Off the stage, it's given its box again as it's drawn. */
  private vacate(d: Device): void {
    d.own = false;
    if (d.canvas.width) d.canvas.width = 0;
    if (d.canvas.height) d.canvas.height = 0;
    const s = d.canvas.style;
    if (s.width !== '0px' || s.height !== '0px') Object.assign(s, { width: '0px', height: '0px' });
  }

  /** Draws the stage: over the part of the world in the window, every staged device near it from its last picture. */
  private showStage(): void {
    const stage = this.stage!, { world, canvas } = stage;
    this.staleStage = false;
    if (!world.isConnected) {
      this.stageOut();
      return;
    }
    if (canvas.parentElement !== world) world.prepend(canvas);
    const view = (world.parentElement ?? world).getBoundingClientRect();
    const L = Math.max(view.left, 0), T = Math.max(view.top, 0), R = Math.min(view.right, innerWidth), B = Math.min(view.bottom, innerHeight);
    const wr = world.getBoundingClientRect(), k = world.offsetWidth ? wr.width / world.offsetWidth : 1;
    if (R <= L || B <= T || !k) {
      canvas.style.width = canvas.style.height = '0';
      return;
    }
    stage.order ??= [...this.devices].filter(d => d.staged).sort(byPage);
    const shots: Shot[] = [];
    // What turns any of them is read where they lie flat, all at once. A turn is given in the world's css px, and drawn in the stage's.
    this.unbend(stage.order.filter(d => d.bend && d.visible));
    const S = [k, 0, wr.left - L, 0, k, wr.top - T, 0, 0, 1], Si = [1 / k, 0, (L - wr.left) / k, 0, 1 / k, (T - wr.top) / k, 0, 0, 1];
    for (const d of stage.order) {
      const picture = d.plate.picture;
      // A face turned away, or out of sight while another whips past, shows nothing.
      if (!picture || !d.visible || this.away(d) || d.card?.shows === false) continue;
      if (d.bend && getComputedStyle(d.canvas).visibility !== 'visible' && !d.el.closest(HIDDEN_FAR)) continue;
      const r = this.where(d);
      if (!r.width || !d.w) continue;
      const share = this.veiled(d);
      if (!share) continue;
      const z = r.width / d.w, bent = d.bend && this.bent(d);
      // Brightened on the page, a card is brighter in what's shown, and on the stage in the light, which goes as about its 2.2th power.
      const turned: Turned | null = bent ? { h: times(S, times(bent, Si)), gain: (d.card?.gain ?? 1) ** 2.2, smear: (d.card?.smear ?? 0) * z } : null;
      // Turned, what of it the window shows isn't where it would lie flat, so nothing of it is left out for that.
      const [cl, ct, cr, cb] = turned ? [-Infinity, -Infinity, Infinity, Infinity] : [0, 0, R - L, B - T];
      const [x, y, cw, ch] = picture.box, sx = r.left - x * z - L, sy = r.top - y * z - T, sw = cw * z, sh = ch * z;
      if (sx > cr || sy > cb || sx + sw < cl || sy + sh < ct) continue;
      shots.push({ picture, plate: d.plate, x: sx, y: sy, w: sw, h: sh, turned, share });
    }
    // The stage's eye takes in the light the world is in, and keeps the stage drawn while it adapts to it.
    // An eye held still still looks, so it's adapted to the room when it's let go.
    if (this.eye.look(this.metered(L, T, R, B)) && this.exposure === 'auto') {
      this.staleStage = true;
      this.schedule();
    }
    this.renderer.exposure = this.exposure === 'auto' ? this.eye.exposure : this.exposure;
    this.renderer.backdrop = backdrop(world);
    this.renderer.show(shots, R - L, B - T, devicePixelRatio || 1, L, T);
    // The canvas is in the world, so the camera moves it with everything else and a frame it misses still lines up, and a page sliding or
    // fading the world takes it along. It covers the window, at the window's size. Placed last, after everything is read, as a page laid
    // out again to read one more box would cost more than the whole stage.
    const cs = canvas.style, w = `${R - L}px`, h = `${B - T}px`, move = `translate(${(L - wr.left) / k}px, ${(T - wr.top) / k}px) scale(${1 / k})`;
    if (cs.width !== w || cs.height !== h) Object.assign(cs, { width: w, height: h });
    if (cs.transform !== move) cs.transform = move;
  }

  /** What lights the world seen from L, T to R, B in the window and what it gives off, for its eye to meter. */
  private metered(L: number, T: number, R: number, B: number): Metered {
    const lit = getLighting(this.lighting), Y = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    const room = this.ambient * Y(lit.color) * (lit.power / STUDIO.power);
    // Each light as it falls on nine places across the view, on average, as the hardware is lit by it.
    let lights = 0;
    for (const l of pointLights()) {
      const [x, y] = placeOf(l.at), r2 = (l.reach / 2) ** 2, z = l.height ?? l.reach / 2, c = Y(l.color);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const dx = L + ((i + 0.5) / 3) * (R - L) - x, dy = T + ((j + 0.5) / 3) * (B - T) - y;
        lights += (c * r2) / (r2 + dx * dx + dy * dy + z * z) / 9;
      }
    }
    // What glows, over the cells of the view, as the light pass shows it.
    let glow = 0;
    const g = glowSeen();
    if (g) {
      const x0 = Math.max(Math.floor(L / g.cell), 0), x1 = Math.min(Math.ceil(R / g.cell), g.w), y0 = Math.max(Math.floor(T / g.cell), 0), y1 = Math.min(Math.ceil(B / g.cell), g.h);
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++, n++) {
        const i = (y * g.w + x) * 4;
        glow += Y([g.data[i]!, g.data[i + 1]!, g.data[i + 2]!]);
      }
      glow = n ? (glow / n / 255) * g.gain : 0;
    }
    return { room, lights, glow };
  }

  /** What holds a device and turns it, read once for as long as nothing could have moved it. A scale or a shift only moves its box, which a zoom and a place allow for. */
  private turners(d: Device): HTMLElement[] {
    if (d.turners?.at === this.moves) return d.turners.els;
    const els: HTMLElement[] = [];
    for (let e = (d.front ?? d).el.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.rotate !== 'none' || (s.transform !== 'none' && !/^matrix\([^,]+, 0, 0,/.test(s.transform))) els.push(e);
    }
    d.turners = { at: this.moves, els };
    return els;
  }

  /** Runs `fn` with the device laid flat and on the page, so its parts' boxes are where they are on it, not where a turn, its own or
   * that of anything holding it, or a place nearer the eye or further from it, shows them. Nor a scale a page shows it at while it's
   * pinched, which is only a view of it. */
  private flat<T>(d: Device, fn: () => T): T {
    const el = (d.front ?? d).el, { rotate, translate, scale } = el.style, lifted = !!rotate || getComputedStyle(el).translate.split(' ').length >= 3, held = this.turners(d);
    if (!lifted && !scale && !held.length) return fn();
    for (const e of held) e.setAttribute('data-flat', '');
    el.style.rotate = '';
    el.style.scale = '';
    if (lifted) el.style.translate = 'none';
    try {
      return fn();
    } finally {
      el.style.rotate = rotate;
      el.style.scale = scale;
      if (lifted) el.style.translate = translate;
      for (const e of held) e.removeAttribute('data-flat');
    }
  }

  /**
   * How many pixels a device draws to the css px: as many as `sharpness` says, as far as the whole of it fits the bench, where it's lit
   * in one go. Shown bigger than that, as a close look at something is, it's drawn whole at what fits, coarser than it's shown, which is
   * better than blank.
   */
  private whole(cw: number, ch: number, z: number): number {
    const [W, H] = this.renderer.room;
    // A hair under, so a picture sized to just fit isn't rounded a step past it.
    return Math.min(this.sharpness(z), Math.min(W / cw, H / ch) * (1 - 1e-9));
  }

  /** Whether a device has what it drew on the GPU. */
  private held(d: Device): boolean {
    return d.plate.ready;
  }

  private measure(d: Device, view: boolean): void {
    const t0 = performance.now();
    const { el } = d, [x0, y0] = [d.x, d.y];
    // Reads every element, and a device's markup rarely changes, so only when asked after the first time.
    if (!view && (this.strict || !d.placed)) this.auditDevice(d);
    const r = el.getBoundingClientRect();
    // Rects are in page pixels, but the canvas sits inside any CSS zoom, so all of this is in
    // the device's own pixels. A zoomed-out device needs fewer of them, which matters on a phone.
    const z = zoomOf(el, r);
    // However far a shadow reaches, the window shows no more of it past an edge than the window's own size: scrolled or zoomed to a
    // corner, a thing bigger than the window has the whole window of page beside it, and its shadow lies there. A small thing shown big
    // would otherwise draw a margin many windows wide, at the sharpness of the thing. Across and down apart.
    d.room = [Math.ceil(innerWidth / z), Math.ceil(innerHeight / z)];
    if (!el.hasAttribute('fill')) {
      d.y = Math.min(d.y, d.room[1]);
      if (d.facing !== 'left' && d.facing !== 'right') d.x = Math.min(d.x, d.room[0]);
    }
    // A side is narrow, and turning it sweeps across the whole body, so its canvas reaches as far as the front's does.
    if (d.facing === 'left' || d.facing === 'right') d.x = d.y + Math.max(d.front!.el.getBoundingClientRect().width - r.width, 0) / z / 2;
    // A hair over a whole px is how a rect read at another zoom rounds, not more of it.
    let cw = Math.ceil(r.width / z - 0.01) + d.x * 2, ch = Math.ceil(r.height / z - 0.01) + d.y * 2;
    // A window onto it: its margin goes negative, so all it draws is placed as ever and only what's in the window lands.
    const win = d.window;
    if (win) [d.x, d.y, cw, ch] = [-win.x, -win.y, win.w, win.h];
    // While it's resizing it stays as sharp as it was, for what the GPU holds: past the odd pixel that's nothing to see, and everything
    // cached by sharpness would be made again. It never takes more than the bench, however it was before.
    const [W, H] = this.renderer.room, squeeze = this.renderer.store.squeeze, kept = Math.min((d.dpr * squeeze) / (d.squeeze ?? 1), W / cw, H / ch);
    const dpr = win ? win.dpr : d.sharp ? d.sharp : this.sizing && d.placed ? kept : this.whole(cw, ch, z);
    d.squeeze = squeeze;
    // Mips only update in part while a size halves cleanly, so the canvas takes a little more margin to get there.
    const pw = Math.ceil((cw * dpr) / MIP_STEP) * MIP_STEP, ph = Math.ceil((ch * dpr) / MIP_STEP) * MIP_STEP;
    cw = pw / dpr;
    ch = ph / dpr;
    d.fine = dpr / ((devicePixelRatio || 1) * z);
    const cell = reachCell(z);
    if (cell !== d.reachCell) {
      d.reachCell = cell;
      d.reachDirty = true;
    }
    // A margin that moves is a new canvas too, if one the same size.
    if (pw !== d.pw || ph !== d.ph || dpr !== d.dpr || d.x !== x0 || d.y !== y0) {
      // The canvas takes the size with the next picture, in `place`. Until then it shows the last one where it was, not nothing.
      this.renderer.free(d.plate);
      Object.assign(d, { pw, ph, cw, ch, dpr });
      this.renderer.grow();
    }
    d.w = r.width / z;
    d.h = r.height / z;
    if (!view) this.condition(d);

    const ox = r.left - d.x * z, oy = r.top - d.y * z;
    const seen = new Set<HTMLElement>();
    let cast = false;
    // Shown at another size its parts are where they were in its own px, only the margin round them may have changed.
    if (view) {
      for (const p of d.parts.values()) {
        p.x += d.x - x0;
        p.y += d.y - y0;
      }
    }
    const c = view ? null : this.compile(d), marks = d.marks, at = `${this.moves},${this.looks},${marks},${r.left},${r.top},${r.width},${r.height}`;
    // Nothing could have moved it or anything in it since it was last measured, so its parts are where they were then. Unless it was
    // asked to be taken again from scratch, as a late font or a new scheme does.
    let settled = c?.at === at && d.print !== '';
    const place = (p: Part, pr: DOMRect) => {
      c?.rects.set(p.el, pr);
      p.x = (pr.left - ox) / z;
      p.y = (pr.top - oy) / z;
      p.w = pr.width / z;
      p.h = pr.height / z;
    };
    // Where each part was, for when it reads where it was again: a hair apart in the last bits, as a box shifted by a fraction reads.
    const was = view ? null : new Map([...d.parts].map(([n, p]) => [n, [p.x, p.y, p.w, p.h] as const]));
    for (const [node, def] of c?.found ?? []) {
      this.blamed = node;
      let p = d.parts.get(node);
      if (!p || p.def !== def) {
        if (p) this.disconnect(d, p);
        p = {
          el: node, def, x: 0, y: 0, w: 0, h: 0, focused: false, label: null, mask: null, data: {},
          springs: Object.fromEntries(Object.entries(def.springs ?? {}).map(([k, v]) => [k, new Spring({ through: k === 'press', contact: k === 'press' && 'press', ...v })])),
        };
        for (const s of Object.values(p.springs)) s.part = p;
        this.owner.set(p, d);
        d.parts.set(node, p);
        cast = true;
        const off = def.connect?.(p);
        if (off) d.cleanups.set(p, off);
        def.update?.(p);
        for (const s of Object.values(p.springs)) s.snap(s.target);
      } else {
        def.update?.(p);
      }
      place(p, (settled && c!.rects.get(node)) || node.getBoundingClientRect());
      seen.add(node);
    }
    for (const [node, p] of d.parts) {
      if (view || seen.has(node)) continue;
      this.disconnect(d, p);
      d.parts.delete(node);
      cast = true;
    }
    // Most layouts find what the last one did: a pack arriving, a size that was never in doubt, a mutation that came to nothing.
    // What's left to tell can only be in the commands, and a partial paint compares those.
    // What its parts did to its markup as they came on counts too, and may have moved them.
    if (!view) this.remark(this.markup.takeRecords());
    if (settled && d.marks !== marks) {
      settled = false;
      for (const node of seen) place(d.parts.get(node)!, node.getBoundingClientRect());
    }
    // Its size and its parts' boxes to a 64th of a css px, as a rect read at another zoom comes out a hair different.
    const print = [pw, ph, dpr, d.fine, d.reshaped, ...[d.w, d.h, ...[...d.parts.values()].flatMap(p => [p.x, p.y, p.w, p.h])].map(n => Math.round(n * 64))].join();
    // Markup inside it that moved nothing may still have changed how a label is set, which only the mask shows.
    if (!cast && print === d.print && this.held(d) && (settled || this.letteredAsInked(d, c, ox, oy))) {
      // Nothing about its parts was read, so none of them can have changed. They keep the numbers they were drawn at, or what's drawn
      // from them, which a paint compares, comes out a hair apart everywhere and is painted whole.
      if (was) for (const [n, p] of d.parts) {
        const w = was.get(n);
        if (w) [p.x, p.y, p.w, p.h] = w;
      }
      if (!view) for (const p of d.parts.values()) d.moving.ask(p);
    } else {
      const layer = (p: Part) => {
        const own = p.el.getAttribute('d-layer'), back = p.el.getAttribute('back');
        if (back !== null) return -Math.max(+back, 0.001);
        if (own !== null) return +own;
        return typeof p.def.layer === 'function' ? p.def.layer(p) : p.def.layer ?? 0;
      };
      // Then in the order of the markup, not of arrival: a piece put in later still sits under what stands over it.
      const order = new Map(d.compiled?.found.map(([n], i) => [n, i]));
      d.list = [...d.parts.values()].sort((a, b) => layer(a) - layer(b) || order.get(a.el)! - order.get(b.el)!);
      for (const p of d.list) p.under = layer(p) < 0;
      d.movers = d.list.map(p => ({ p, springs: Object.values(p.springs) })).filter(m => m.springs.length || m.p.def.tick);
      if (c && !settled) c.labels.clear();
      // Seen anew, its markup is as the last measure found it, and its labels are set again where the page has them now, which is
      // what a relabel draws from after: a view keeps it as much as a measure does.
      const of = view ? d.compiled : c && d.compiled === c ? c : null, labels = view ? new Map<Element, Lettered>() : of?.labels;
      paintMask(d, this.maskCanvas, this.maskCtx, ox, oy, z, el => (this.blamed = el), p => this.textOf(d, p), labels);
      this.renderer.ink(d.plate, this.maskCanvas);
      d.inked = of && labels ? { of, labels, ox, oy, z } : null;
      d.materialDirty = d.lightDirty = true;
      d.print = print;
    }
    if (c) c.at = d.compiled === c && d.marks === marks ? at : '';
    d.version = partsVersion();
    this.blamed = null;
    d.layoutDirty = d.viewDirty = d.sharpen = false;
    const first = !d.placed;
    d.placed = true;
    // Out of reach, it sleeps as soon as it's drawn, camera moving or not.
    if (first && this.stage && d.el.closest('[inert]')) this.rest(d);
    this.stats.layouts++;
    if (!view) this.stats.measures++;
    this.stats.layoutMs += performance.now() - t0;
  }

  /** What a device's markup comes to, as it is now: kept from the last time unless that markup has changed since. */
  private compile(d: Device): Compiled {
    this.remark(this.markup.takeRecords());
    const version = partsVersion();
    if (d.compiled?.version === version) return d.compiled;
    const { el } = d, found: [HTMLElement, PartDef][] = [], parts = new Set<Element>();
    for (const node of [el, ...el.querySelectorAll<HTMLElement>(maybePartsSelector() || 'never')]) {
      const def = partFor(node);
      if (!def) continue;
      parts.add(node);
      // What has a canvas of its own inside this one, as a part in a dialog does, draws itself.
      if (node === el || node.closest('d-device, [data-alone]') === el) found.push([node, def]);
    }
    return (d.compiled = { version, found, parts, texts: new Map(), rects: new Map(), labels: new Map(), at: '' });
  }

  /** A part's own text, kept with what its device's markup comes to. */
  private textOf(d: Device, p: Part): Text[] {
    const c = d.compiled;
    if (!c || !c.parts.has(p.el)) return ownText(p);
    let found = c.texts.get(p.el);
    if (!found) c.texts.set(p.el, (found = ownText(p, n => c.parts.has(n))));
    return found;
  }

  /** Markup changed: every device it's in counts a change, and has what its markup comes to worked out again as far as the change
   * reaches. What the engine writes that draws nothing doesn't count: its own canvases, a clip that only says what the pointer can reach,
   * how a body is dealt or turned, how near the window it is. Nor does anything set and put back, as laying a device flat does: only
   * what it ends up as. Elements coming or going, or an attribute a part is told by, can change what's a part; text, what a label says. */
  private remark(ms: MutationRecord[]): void {
    if (!ms.length) return;
    const changed = new Map<Node, 0 | 1 | 2>(), first = new Map<Node, Map<string | null, string | null>>(), names = partAttributes(), printed = new Set<Node>();
    const mark = (n: Node, how: 0 | 1 | 2) => changed.set(n, Math.max(changed.get(n) ?? 0, how) as 0 | 1 | 2);
    for (const m of ms) {
      const t = m.target;
      if (m.type === 'childList') {
        if (![...m.addedNodes, ...m.removedNodes].every(ownCanvas)) mark(t, 2);
        continue;
      }
      if (m.type === 'attributes' && (ownCanvas(t) || UNMARKED.has(m.attributeName!))) continue;
      // What a part takes live, as a key's pressed state or a meter's value, it's drawn again for as it moves, and that compares the commands.
      if (livePart(t, m.type === 'attributes' ? m.attributeName! : '#text')) continue;
      let was = first.get(t);
      if (!was) first.set(t, (was = new Map()));
      const name = m.type === 'attributes' ? m.attributeName : null;
      if (!was.has(name)) was.set(name, m.oldValue);
    }
    for (const [t, was] of first) {
      for (const [name, old] of was) {
        if (name === null) {
          if (old !== (t as CharacterData).data) mark(t, 1);
          continue;
        }
        const now = (t as Element).getAttribute(name);
        // A device's own zoom, shift or scale is a view of it, as the observer takes it: what it draws is the same.
        const own = (v: string | null) => ((t as Node & { __d?: Device }).__d ? unzoomed(v) ?? null : v);
        if (name === 'style' ? unmarked(own(old)) === unmarked(own(now)) : old === now) continue;
        const how = !names || names.has(name) || name === 'data-alone' ? 2 : 0;
        mark(t, how);
        // What a part prints round it is drawn from its attributes, as a knob's ticks are, and changes with them though no box does.
        if (!how && t.nodeType === Node.ELEMENT_NODE && partFor(t as Element)?.mask) printed.add(t);
      }
    }
    for (const [t, how] of changed) for (let n: Node | null = t; n; n = n.parentNode) {
      const d = (n as Node & { __d?: Device }).__d;
      if (!d) continue;
      d.marks++;
      if (how === 2 || n === t || printed.has(t)) d.reshaped++;
      if (how === 2) d.compiled = null;
      else if (how === 1) d.compiled?.texts.clear();
    }
  }

  /** Whether every label is set as it was when its mask was drawn, read off the page now. */
  private letteredAsInked(d: Device, c: Compiled | null, ox: number, oy: number): boolean {
    const k = d.inked;
    if (!c || d.compiled !== c || k?.of !== c) return false;
    const range = document.createRange();
    for (const p of d.list) {
      if (!p.def.label) continue;
      this.blamed = p.el;
      if (!sameLettering(k.labels.get(p.el), [k.ox, k.oy], lettered(p, p => this.textOf(d, p), this.maskCtx, range) ?? undefined, [ox, oy])) return false;
    }
    return true;
  }

  private auditDevice(d: Device): void {
    if (getComputedStyle(d.el).position === 'static') warnOnce(`This is position: static, so its canvas lines up with whatever is positioned around it, not with it. ${written(d.el)}`);
    for (const el of [d.el, ...d.el.querySelectorAll('*')]) audit(el);
  }

  /** Whether every device in `root` the window shows has shown a picture of its own, of the face it has up: until then, part of it is blank.
   * One that's out of sight, as a lens seated in its body is or a sheet shut inside a cover, draws nothing of its own and isn't waited for. */
  shows(root: Element): boolean {
    let any = false;
    for (const d of this.devices) {
      if (d.front || !d.visible || !root.contains(d.el) || this.unseen(d)) continue;
      if (!(d.showing ?? d).shown) return false;
      any = true;
    }
    return any;
  }

  /** Whether nothing of what's in `root` that's in the window has any more to come: it's drawn as sharp as it'll get. Where a hand can
   * reach on it, and what moves on it, don't change that, and nor does a face turned away, which the frame doesn't draw. */
  /** What lights every device, with its counts. Null only where nothing draws. */
  player: Player | null = null;

  /**
   * A device's maps, as the material pass makes them: everything that decides how its surfaces look, for a renderer that lights them
   * itself. Waits until the device is drawn as sharp as it'll get. `pxPerMm` asks for a size, by zooming the device's element while it's
   * made, within what the GPU's bench holds; left out, they're at the size it's shown. Made by the engine's own renderer.
   */
  async maps(el: Element, o: { pxPerMm?: number; timeout?: number; moves?: boolean; face?: Facing; box?: { x: number; y: number; w: number; h: number } } = {}): Promise<DeviceMaps> {
    const body = deviceOf(el), d = o.face ? body?.faces.find(f => f.facing === o.face) : body;
    if (!d) throw new Error(o.face ? `maps: no ${o.face} face` : 'maps: not a device');
    if (this.making) throw new Error('maps: one at a time');
    this.making = d;
    // A readback takes everything a paint worked in, so it's kept till it's over.
    this.renderer.hold(d.plate, true);
    const until = performance.now() + (o.timeout ?? 20000), frame = () => {
      if (performance.now() > until) throw new Error('maps: the device never settled');
      return new Promise(requestAnimationFrame);
    };
    // Its size is known once it's been measured, and asked for only then.
    try {
      while (!d.cw) await frame();
    } catch (e) {
      this.making = null;
      this.renderer.hold(d.plate, false);
      throw e;
    }
    // Drawn at the size asked, whatever the page shows it at: 1 css px is 0.25 mm, so a css px is pxPerMm / 4 canvas px.
    if (o.pxPerMm && !o.box) {
      const [W, H] = this.renderer.room, k = o.pxPerMm / 4;
      if (d.cw * k > W || d.ch * k > H) {
        this.making = null;
        this.renderer.hold(d.plate, false);
        throw new Error(`maps: ${o.pxPerMm} px/mm is ${Math.ceil(d.cw * k)} by ${Math.ceil(d.ch * k)} px, past the ${W} by ${H} one canvas holds: ask for a box`);
      }
      d.sharp = k;
      d.layoutDirty = true;
      this.schedule();
    }
    // Where its time went, ms: waiting for frames to draw it, reading the textures back, and turning them into maps.
    const ms = { start: performance.now(), drawn: 0, read: 0, decode: 0, moves: 0, total: 0 };
    const settled = async () => {
      const t0 = performance.now();
      for (let quiet = 0; quiet < 3; ) {
        await frame();
        // Another device that painted meanwhile took what a paint works in, which is what's read back: it's painted again, the same, so
        // it's no news to the other faces of its body. See `Renderer.spare`.
        if (!d.plate.ready) { d.materialDirty = true; this.schedule(); quiet = 0; }
        else if (!this.renderer.working(d.plate)) { d.remake = true; this.schedule(); quiet = 0; }
        // Asked for a size, it isn't done until it's been laid out at it.
        else if (d.layoutDirty) quiet = 0;
        else quiet = this.finished(d.el) ? quiet + 1 : 0;
      }
      const t1 = performance.now(), raw = this.renderer.readMaps(d.plate);
      if (!raw) throw new Error('maps: the device holds none');
      const t2 = performance.now();
      ms.drawn += t1 - t0; ms.read += t2 - t1;
      // The body, inside the canvas's margin: css px.
      const r = d.el.getBoundingClientRect(), z = zoomOf(d.el, r);
      try { return decodeMaps(raw, [d.x, d.y], [r.width / z, r.height / z], { shadow: d.cast, lighting: getLighting(this.lighting) }); } finally { ms.decode += performance.now() - t2; }
    };
    // Screens show nothing, as what's on them is the page's: a picture still moving would be taken for the device, or a move.
    this.renderer.blankScreens = true;
    d.materialDirty = true;
    this.schedule();
    try {
      if (o.box) return await this.boxMaps(d, o.box, o.pxPerMm ?? (4 * d.pw) / d.cw, settled);
      const maps = await settled();
      maps.ms = ms;
      const k = maps.pxPerMm / 4, r = d.el.getBoundingClientRect(), z = zoomOf(d.el, r);
      for (const p of d.parts.values()) for (const c of p.commands ?? []) {
        if (c.op !== 'screen') continue;
        const b = p.el.getBoundingClientRect();
        maps.screens.push({
          part: describePart(p.el, d.el), kind: c.kind, gain: c.gain, lit: (c.gain > 0 && ['crt', 'led', 'oled', 'tft'].includes(c.kind)) || c.emit.some(v => v > 0), colour: [...c.color], ink: [...c.ink], emit: [...c.emit], inset: [...c.inset],
          box: { x: ((b.left - r.left) / z + d.x) * k - maps.box.x, y: ((b.top - r.top) / z + d.y) * k - maps.box.y, w: (b.width / z) * k, h: (b.height / z) * k },
        });
      }
      // What the maps can't hold, said rather than left for a renderer to find: a halo the light pass draws round a part, and frost
      // that blurs what a live screen shows.
      for (const p of d.parts.values()) for (const c of p.commands ?? []) {
        if (c.op === 'glow') maps.gaps.push(`${describePart(p.el, d.el)} glows onto what's round it, which the light pass draws`);
        if (c.op === 'frost' && c.blur > 0 && maps.screens.length) maps.gaps.push(`${describePart(p.el, d.el)} is frost, which blurs whatever is drawn under it, a screen too`);
      }
      if (o.moves === false) { ms.total = performance.now() - ms.start; return maps; }
      const movesFrom = performance.now(), atRest = { ...ms };
      // What moves: each spring of each part, drawn where it is, at its far end and half way, so a renderer lerps between its maps by its value.
      // What a spring changes is found by what changed, so no pack says how its parts move. A turn isn't a straight line in what it draws:
      // half way between isn't half of each, and it's marked so.
      // A part keeps what it drew while nothing of its own moves, so it's told to draw again.
      // Where its joint has it at a value, and its top left in map px.
      const carry = (p: Part, sp: Spring, v: number) => {
        if (!p.def.carried) return null;
        const was = sp.value;
        sp.value = v;
        try { return p.def.carried.call(p.def, p); } finally { sp.value = was; }
      };
      const origin = (p: Part): [number, number] => {
        const r = d.el.getBoundingClientRect(), z = zoomOf(d.el, r), b = p.el.getBoundingClientRect(), k = maps.pxPerMm / 4;
        return [((b.left - r.left) / z + d.x) * k - maps.box.x, ((b.top - r.top) / z + d.y) * k - maps.box.y];
      };
      const hold = (p: Part, sp: Spring, v: number) => { sp.value = sp.target = v; sp.velocity = 0; this.redraw(p.el, d); };
      for (const p of d.parts.values()) for (const [name, sp] of Object.entries(p.springs)) {
        const was = sp.value, wasTarget = sp.target;
        this.pinned = sp;
        try {
          // Against the device as it is now, so anything else still settling, a lamp coming on, isn't taken for this spring's.
          const now = await settled();
          // To its far end, so one at rest at 1, a lamp that's on, is seen going off. One its joint carries goes the way it goes furthest:
          // a lever whose stops are below its rest goes down, as springs say nothing of their range and joints do.
          const far = (c: Carried | null) => { const c0 = carry(p, sp, was); return c && c0 ? Math.hypot(c.x - c0.x, c.y - c0.y) + Math.abs(c.rotate - c0.rotate) * 100 : 0; };
          const stopsAt = p.def.ends?.(p) ?? null;
          const to = stopsAt ? (Math.abs(stopsAt[0] - was) > Math.abs(stopsAt[1] - was) ? stopsAt[0] : stopsAt[1]) : p.def.carried ? [1, -1, 0].filter(v => v !== was).reduce((a, b) => (far(carry(p, sp, b)) > far(carry(p, sp, a)) ? b : a)) : was > 0.5 ? 0 : 1;
          hold(p, sp, to);
          const at1 = await settled();
          hold(p, sp, (was + to) / 2);
          const half = await settled();
          const move = movedBy(now, at1, half, was, to);
          if (!move) {
            // Its joint carried it and the drawing came back the same, as ribs round a drum seen edge-on do: between, it isn't the same.
            const a = carry(p, sp, was), z = carry(p, sp, to);
            if (a && z && (a.x !== z.x || a.y !== z.y || a.rotate !== z.rotate)) maps.gaps.push(`${describePart(p.el, d.el)} ${name} moves and looks the same at both ends, as a drum's ribs seen edge-on do, so the maps can't show it between`);
            continue;
          }
          // One its joint carries whole, slid or turned, is the part alone moved over the body without it, as a lerp can't show.
          const c0 = carry(p, sp, was), c1 = carry(p, sp, to);
          if (c0 && c1 && (c0.x !== c1.x || c0.y !== c1.y || c0.rotate !== c1.rotate)) {
            sp.value = sp.target = was; sp.velocity = 0;
            this.leftOut = p;
            this.redraw(p.el, d);
            const without = await settled().finally(() => { this.leftOut = null; });
            const parted = apart(now, without, move.box);
            if (parted) {
              // How fast it goes from rest, and how far it can: a joint stops at its ends whatever the spring's value.
              const k = maps.pxPerMm / 4, e = 1e-3 * Math.sign(to - was), ce = carry(p, sp, was + e)!, turn = c1.rotate !== c0.rotate, o = origin(p);
              const rate = turn ? (ce.rotate - c0.rotate) / e : Math.hypot(ce.x - c0.x, ce.y - c0.y) / Math.abs(e);
              const reach = turn ? (c1.rotate - c0.rotate) / rate : Math.hypot(c1.x - c0.x, c1.y - c0.y) / rate * Math.sign(to - was);
              move.rigid = {
                kind: turn ? 'turn' : 'slide', peak: parted.peak, alone: parted.alone, under: parted.under,
                per: turn ? rate : [((ce.x - c0.x) * k) / e, ((ce.y - c0.y) * k) / e],
                ends: stopsAt ?? [Math.min(was, was + reach), Math.max(was, was + reach)],
                ...(turn && { pin: [o[0] + c0.pin[0] * k, o[1] + c0.pin[1] * k] as [number, number] }),
              };
            }
          }
          const part = describePart(p.el, d.el);
          maps.moves.push({ ...move, spring: name, part, el: p.el });
          if (!move.linear && !move.rigid) maps.gaps.push(`${part} ${name} isn't linear between its ends, ${move.off.toFixed(2)} mm off half way, and its joint doesn't carry it whole`);
        } finally {
          this.pinned = null;
          sp.value = was; sp.target = wasTarget; sp.velocity = 0; this.redraw(p.el, d);
        }
      }
      // A part on a clock of its own with no spring changes its drawing with nothing to read it by. One with springs was probed by them.
      for (const p of d.parts.values()) if (p.def.tick && !Object.keys(p.springs).length && !p.commands?.some(c => c.op === 'screen')) maps.gaps.push(`${describePart(p.el, d.el)} moves on its own every frame, not by a spring`);
      if (maps.moves.length) await settled();
      // What probing the moves took, all of it, apart from the rest.
      ms.moves = performance.now() - movesFrom; Object.assign(ms, { drawn: atRest.drawn, read: atRest.read, decode: atRest.decode });
      ms.total = performance.now() - ms.start;
      return maps;
    } finally {
      this.making = null;
      this.renderer.hold(d.plate, false);
      this.renderer.blankScreens = false;
      d.materialDirty = true;
      if (d.window) { d.window = undefined; d.layoutDirty = true; }
      if (d.sharp) { d.sharp = undefined; d.layoutDirty = true; }
      this.schedule();
    }
  }

  /**
   * A box of a device, mm from its top left, at any px a mm: drawn a window at a time, each as big as the bench takes, through a canvas that's
   * only that window (`Device.window`), and laid side by side. Each window draws a margin past its edge so what reaches across, a bevel or a
   * normal, is whole, and only its middle is kept. The room's occlusion is the whole canvas's and isn't given; nor are moves.
   */
  private async boxMaps(d: Device, box: { x: number; y: number; w: number; h: number }, px: number, settled: () => Promise<DeviceMaps>): Promise<DeviceMaps> {
    const dpr = px / 4, padPx = Math.ceil(16 * dpr), pad = padPx / dpr, [W, H] = this.renderer.room;
    const ow = Math.round(box.w * px), oh = Math.round(box.h * px), n = ow * oh;
    const tile = Math.max(64, Math.floor(Math.min(W, H) - 2 * padPx - 2 * 16));
    const out = {
      colour: new Uint8Array(n * 4), height: new Float32Array(n), normal: new Uint8Array(n * 2), surface: new Uint8Array(n * 4), more: null as Uint8Array | null,
      grain: new Uint8Array(n * 2), emission: null as Uint8Array | null, condition: new Uint8Array(n * 4),
    };
    let first: DeviceMaps | null = null, tiles = 0;
    for (let ty = 0; ty < oh; ty += tile) for (let tx = 0; tx < ow; tx += tile) {
      const tw = Math.min(tile, ow - tx), th = Math.min(tile, oh - ty);
      d.window = { x: box.x * 4 + tx / dpr - pad, y: box.y * 4 + ty / dpr - pad, w: tw / dpr + 2 * pad, h: th / dpr + 2 * pad, dpr };
      d.layoutDirty = true;
      this.schedule();
      const m = await settled();
      tiles++;
      if (Math.abs(m.pxPerMm - px) > 1e-3 * px) throw new Error(`maps: a window came out at ${m.pxPerMm} px/mm, not ${px}`);
      first ??= m;
      if (m.more) out.more ??= new Uint8Array(n * 4);
      if (m.emission) out.emission ??= new Uint8Array(n * 4);
      // Out px (x, y) is canvas px (x − tx + pad): the window starts a pad before the tile.
      for (let y = 0; y < th; y++) {
        const sy = y + padPx - m.box.y;
        if (sy < 0 || sy >= m.h) continue;
        for (let x = 0; x < tw; x++) {
          const sx = x + padPx - m.box.x;
          if (sx < 0 || sx >= m.w) continue;
          const i = sy * m.w + sx, j = (ty + y) * ow + tx + x;
          out.height[j] = m.height[i]!;
          out.colour.set(m.colour.subarray(i * 4, i * 4 + 4), j * 4);
          out.surface.set(m.surface.subarray(i * 4, i * 4 + 4), j * 4);
          out.condition.set(m.condition.subarray(i * 4, i * 4 + 4), j * 4);
          out.normal.set(m.normal.subarray(i * 2, i * 2 + 2), j * 2);
          out.grain.set(m.grain.subarray(i * 2, i * 2 + 2), j * 2);
          if (m.more) out.more!.set(m.more.subarray(i * 4, i * 4 + 4), j * 4);
          if (m.emission) out.emission!.set(m.emission.subarray(i * 4, i * 4 + 4), j * 4);
        }
      }
    }
    const r = d.el.getBoundingClientRect(), z = zoomOf(d.el, r), f = first!;
    // Panes, from the first window's px to the box's.
    const panes = f.facts.panes.map(q => ({ ...q, cx: q.cx + f.box.x - padPx, cy: q.cy + f.box.y - padPx }));
    const maps: DeviceMaps = {
      ...out, w: ow, h: oh, pxPerMm: px, box: { x: box.x * px, y: box.y * px, w: ow, h: oh },
      body: { x: -box.x * px, y: -box.y * px, w: (r.width / z) * dpr, h: (r.height / z) * dpr },
      occlusion: { w: 0, h: 0, x: 0, y: 0, scale: 1, data: new Uint8Array(0) },
      bytes: n * (4 + 4 + 2 + 4 + 2 + 4) + (out.more ? n * 4 : 0) + (out.emission ? n * 4 : 0),
      facts: { ...f.facts, panes, tiles }, moves: [], screens: [], gaps: ['a box holds no moves and no occlusion: read the whole device for those'],
    };
    for (const p of d.parts.values()) for (const c of p.commands ?? []) {
      if (c.op !== 'screen') continue;
      const b = p.el.getBoundingClientRect();
      maps.screens.push({
        part: describePart(p.el, d.el), kind: c.kind, gain: c.gain, lit: (c.gain > 0 && ['crt', 'led', 'oled', 'tft'].includes(c.kind)) || c.emit.some(v => v > 0), colour: [...c.color], ink: [...c.ink], emit: [...c.emit], inset: [...c.inset],
        box: { x: ((b.left - r.left) / z) * dpr - box.x * px, y: ((b.top - r.top) / z) * dpr - box.y * px, w: (b.width / z) * dpr, h: (b.height / z) * dpr },
      });
    }
    return maps;
  }

  finished(root: Element): boolean {
    const version = partsVersion();
    for (const d of this.devices) if (d.visible && !d.quiet && root.contains(d.el) && !this.asleep(d) && !this.drawn(d, version)) return false;
    return true;
  }

  /**
   * How much of what's in `root` a stage shows, from 0 to 1: it's drawn and sharpened all the same, and a page brings it in over a stand-in
   * when it's ready, so nobody sees it arrive in steps. Set before what's in it arrives, none of that shows. Its markup is hidden till it's all there.
   */
  veil(root: HTMLElement, share: number): void {
    if (share >= 1) this.veils.delete(root);
    else this.veils.set(root, share);
    root.toggleAttribute('data-veiled', share < 1);
    this.staleStage = true;
    this.schedule();
  }

  private veiled(d: Device): number {
    if (this.veils.size) for (const [root, share] of this.veils) if (root.contains(d.el)) return share;
    return 1;
  }

  /**
   * A picture of what's in `root` as the window shows it now, of the faces it has up, and where in the window that is and `root` are, as
   * they'd lie flat with nothing round them turning them, or null until `shows(root)`. It's for a page to put in place of copies of the
   * same thing that aren't on yet, so a page of a thousand shows each of them the moment one of a kind is drawn. Only what the engine
   * draws is in it, at the size it's shown, as the light falls on this one. It comes once the GPU has drawn what it holds, so asking
   * holds nothing up.
   */
  async still(root: HTMLElement): Promise<{ image: HTMLCanvasElement; rect: DOMRect; root: DOMRect } | null> {
    if (!this.shows(root)) return null;
    const shots: { from: Promise<CanvasImageSource | null>; r: DOMRect }[] = [];
    const showing = () => [...this.devices].filter(d => !d.front && d.visible && root.contains(d.el) && !this.unseen(d)).sort(byPage).map(d => d.showing ?? d);
    // One just put on the stage, as a face is once its body gets there, was drawn on its own canvas and has no picture till it's drawn again.
    for (let i = 0; i < STILL_WAIT && showing().some(d => d.staged && !d.plate.picture); i++) await new Promise(requestAnimationFrame);
    const up = showing();
    if (!up.length) return null;
    const held = this.turners(up[0]!).filter(e => e.contains(root));
    for (const e of held) e.setAttribute('data-flat', '');
    const flat = root.getBoundingClientRect();
    for (const e of held) e.removeAttribute('data-flat');
    for (const d of up) {
      const p = d.plate.picture;
      if (d.staged && p) {
        const r = this.where(d), z = d.w ? r.width / d.w : 1, [x, y, cw, ch] = p.box;
        const from = this.renderer.readSoon(d.plate).then(data => {
          if (!data) return null;
          const c = document.createElement('canvas');
          c.width = data.width;
          c.height = data.height;
          c.getContext('2d')!.putImageData(data, 0, 0);
          return c;
        });
        shots.push({ from, r: new DOMRect(r.left - x * z, r.top - y * z, cw * z, ch * z) });
      } else if (!d.staged && d.canvas.width) {
        // As it is now: it may be drawn again before the rest come back.
        const c = document.createElement('canvas');
        c.width = d.canvas.width;
        c.height = d.canvas.height;
        c.getContext('2d')!.drawImage(d.canvas, 0, 0);
        shots.push({ from: Promise.resolve(c), r: this.boxOf(d, 1) });
      }
    }
    if (!shots.length) return null;
    const froms = await Promise.all(shots.map(s => s.from));
    if (froms.some(f => !f)) return null;
    const L = Math.min(...shots.map(s => s.r.left)), T = Math.min(...shots.map(s => s.r.top));
    const R = Math.max(...shots.map(s => s.r.right)), B = Math.max(...shots.map(s => s.r.bottom)), k = devicePixelRatio || 1;
    const image = document.createElement('canvas');
    image.width = Math.max(Math.ceil((R - L) * k), 1);
    image.height = Math.max(Math.ceil((B - T) * k), 1);
    const ctx = image.getContext('2d')!;
    shots.forEach(({ r }, i) => ctx.drawImage(froms[i]!, (r.left - L) * k, (r.top - T) * k, r.width * k, r.height * k));
    return { image, rect: new DOMRect(L, T, R - L, B - T), root: flat };
  }

  /**
   * Puts the device round `el` to sleep, and every device in it: each shows what it last drew, as a picture the GPU doesn't hold, and gives
   * back its maps and all the light keeps for it, so a page of many costs what the ones awake cost. Nothing about it is drawn again till
   * it wakes, whatever changes meanwhile: its markup stays, and a press or the keyboard on it wakes it. One never drawn shows only its
   * markup till then, and so does one that comes into it while it sleeps, which is born asleep. On the stage its picture is the stage's,
   * which the store gives back as it needs room.
   */
  sleep(el: HTMLElement): void {
    this.dormant.add(el);
    for (const d of this.within(el)) {
      if (d.slept) continue;
      const slept: Slept = { still: null, url: null, pw: d.canvas.width, ph: d.canvas.height };
      d.slept = slept;
      d.quiet = true;
      this.renderer.free(d.plate);
      const c = d.canvas;
      if (d.staged || !d.own || !c.width || !c.height) continue;
      // Off the GPU as an image, and only then is the canvas emptied, with the image shown over its box, so no frame shows neither.
      c.toBlob(blob => {
        if (d.slept !== slept || !blob) return;
        const url = (slept.url = URL.createObjectURL(blob)), still = new Image();
        still.src = url;
        still.decode().then(() => {
          if (d.slept !== slept || c.width !== slept.pw || c.height !== slept.ph) return;
          slept.still = still;
          c.style.background = `url(${url}) 0 0 / 100% 100% no-repeat`;
          c.width = c.height = 0;
        }, () => {});
      });
    }
  }

  /**
   * Wakes the device round `el` and every device in it, as they were when they went to sleep: each shows its still on its canvas until it's
   * drawn again. Comes back once what it shows of itself is drawn, and says `wake` on `el` as it starts, as a press on one asleep wakes it
   * too.
   */
  wake(el: HTMLElement): Promise<void> {
    for (let at: Element | null = el; at; at = at.parentElement) this.dormant.delete(at);
    const woken = this.within(el).filter(d => d.slept);
    if (!woken.length) return Promise.resolve();
    for (const d of woken) {
      const s = d.slept!, c = d.canvas;
      d.slept = null;
      if (s.still && !c.width) {
        c.width = s.pw;
        c.height = s.ph;
        d.ctx.drawImage(s.still, 0, 0);
      }
      if (s.url) {
        c.style.background = '';
        URL.revokeObjectURL(s.url);
      }
      // Drawn again whole, from new maps: what was lit last may be only a box of it.
      d.lightBox = null;
      d.toward = 1;
      d.viewDirty = d.materialDirty = d.lightDirty = true;
    }
    el.dispatchEvent(new Event('wake', { bubbles: true }));
    this.schedule();
    const shows = woken.filter(d => !d.front && !this.away(d));
    return Promise.all(shows.map(d => new Promise<void>(done => d.el.addEventListener('lit', () => done(), { once: true })))).then(() => {});
  }

  /** Whether the device round `el` is asleep. */
  sleeping(el: Element): boolean {
    return !!deviceOf(el)?.slept;
  }

  /** What was put to sleep, so a device that comes into one is born asleep. */
  private dormant = new WeakSet<Element>();
  /** The devices at `el` and in it. */
  private within(el: Element): Device[] {
    return [...this.devices].filter(d => d.el === el || el.contains(d.el));
  }

  /**
   * Draws a device's labels again as its last layout did, from the words that kept, with nothing measured: the renderer gave them
   * back with what a paint works in (`Renderer.spare`). Without those words, the markup changed since or a layout that kept none,
   * it's laid out again instead, and painted after.
   */
  private relabel(d: Device): boolean {
    const k = d.inked;
    if (!k || d.compiled !== k.of) {
      d.print = '';
      d.layoutDirty = d.materialDirty = true;
      this.schedule();
      return false;
    }
    paintMask(d, this.maskCanvas, this.maskCtx, k.ox, k.oy, k.z, el => (this.blamed = el), p => this.textOf(d, p), k.labels);
    this.blamed = null;
    this.renderer.ink(d.plate, this.maskCanvas);
    return true;
  }

  // Handling marks stay put between frames, so this runs only when they or the device change.
  repaintWithin(root: Element): void {
    for (const d of this.devices) {
      if (!root.contains(d.el)) continue;
      d.layoutDirty = d.materialDirty = true;
      d.print = '';
    }
    this.schedule();
  }

  private disconnect(d: Device, p: Part): void {
    d.cleanups.get(p)?.();
    d.cleanups.delete(p);
  }

  /**
   * Judges everything a device holds on the GPU, for the store to give back the least worth first whenever it needs room, and gives
   * back what isn't shown down to what a window's worth of pixels may keep, so memory goes with the window and not with how many things
   * there are. What the window shows stays. A device away from the window is worth the less the longer it's been gone, but one that
   * ticks is drawn again whenever it's seen, so it's kept longer. Maps go before pictures: they only matter to light again, and a
   * picture kept shows at once, as sharp as it left, so a zoom back out to where it was has nothing to draw.
   */
  private weigh(): void {
    const s = this.renderer.store, px = innerWidth * innerHeight * (devicePixelRatio || 1) ** 2;
    for (const d of this.devices) {
      const here = d.visible && !this.away(d) && !d.slept, ticks = d.movers.some(m => m.p.def.tick), gone = here ? 0 : (this.departures - d.left) / (ticks ? 16 : 1);
      s.judge(d.plate, here ? 0 : 2, gone, here);
    }
    s.tally();
    // Short of room for a while, and at rest, not only as a page loads and lights everything, one fewer is live before anything is drawn
    // coarser for good.
    if (s.squeeze >= 1) this.shortSince = null;
    else if (this.shortSince == null) this.shortSince = performance.now();
    else if (performance.now() - this.shortSince > LIVE_STEP_MS && this.liveLess()) { this.shortSince = null; this.schedule(); }
    // A device is sized by the squeeze it was laid out at, so one shown that's a step away from it now is laid out again, smaller to fit
    // or sharper once there's room.
    for (const d of this.devices) if (d.visible && Math.abs(Math.log(s.squeeze / (d.squeeze ?? 1))) > RESQUEEZE) { d.layoutDirty = true; this.schedule(); }
    s.keep = Math.min(this.keep, px * KEPT_PER_PIXEL + FIELDS_KEPT);
    s.room();
  }

  /** Estimated GPU bytes held right now. */
  memory(): { textures: number; pictures: number; canvases: number; fields: number; room: number; stage: number; live: number } {
    let canvases = 0;
    for (const d of this.devices) if (!d.staged) canvases += d.pw * d.ph * 4;
    const { textures, pictures, fields, room, stage, live } = this.renderer.memory();
    return { textures, pictures, canvases, fields, room, stage, live };
  }

  private paint(d: Device, moving?: Stirring<Part>, sketch = false, known = false): void {
    const t0 = performance.now();
    // What a face sees edge on of the others is in its picture from its first paint, and so is the room that takes. A face asleep has
    // drawn nothing, so it says what it would draw: laid out and recorded, with no maps made. Else a hand coming near, which wakes them,
    // would have this one drawn again with more room round it, at another sharpness, and all the player read of it let go.
    if (!moving && !sketch && d.body) {
      const body = d.front ?? d, end = (f: Device) => f.facing === 'left' || f.facing === 'right';
      for (const f of [body, ...body.faces]) if (f !== d && end(f) !== end(d) && !f.plate.tex) this.know(f);
    }
    this.stir(d);
    schemed(d.scheme);
    const state: Partial<MaterialDef> = {};
    if (d.wear) state.wear = d.wear;
    if (d.dents) state.dents = d.dents;
    if (d.fade) state.fade = d.fade;
    const s = new Sheet(d.seed, d.age, state);
    // `bare` has no body, so its parts are set straight into the page. Nor has anything that's its own device.
    const bare = d.el.hasAttribute('bare') || d.el.localName !== 'd-device';
    // How the body rolls away at its ends, mm, inside how far past it the lugs and the like stand, and how far they fall. One axis.
    // A side is a body of its own, as wide as the body is deep, and stands only as far as it's nearer than the front and back are.
    const side = d.facing === 'left' || d.facing === 'right', front = d.front ?? d, { el } = side ? d : front;
    const deep = depthOf(front.el), behind = behindOf(front.el);
    // The front's ends are where it rolls away, inside any room it keeps for lugs and the like.
    const wide = side ? front.owns[0] * 2 || front.w * 0.25 : d.w * 0.25 - 2 * (+(front.el.getAttribute('roll')?.trim().split(/\s+/)[2] ?? 0) || 0);
    // A side stands from the middle of the body, so all it sees of the others, as far in as that, has a height.
    d.face = side ? wide / 2 : deep;
    // The middle is halfway through all of it, the back's layers too, which stand off the back's ground.
    d.axis = side ? wide / 2 : d.facing === 'back' ? (deep - behind) / 2 : (deep + behind) / 2;
    // A side's ground is inside the body, not the page, so it throws nothing there.
    d.cast = side ? 0 : parseFloat(front.el.getAttribute('shadow') ?? '') || deep;
    // Which face meets each end of this one, across it as it's seen. From behind, left and right swap; a side has the front at one end and the back at the other.
    const has = (f: Facing) => +front.faces.some(g => g.facing === f), back = +!!front.reverse;
    const across = Math.min(d.w * 0.25, wide) / 2;
    d.owns = d.facing === 'right' ? [across, 1, back] : d.facing === 'left' ? [across, back, 1] : d.facing === 'back' ? [wide / 2, has('right'), has('left')] : [wide / 2, has('left'), has('right')];
    // The front's own body stands under its layers, so only its own height. From behind, it's all of them.
    const rise = bare ? 0 : !side && !d.facing ? parseFloat(el.getAttribute('height') ?? '') || TOP : d.face;
    const [rx = 0, ry = 0, ix = 0, iy = 0, fall = rise] = el.getAttribute('roll')?.trim().split(/\s+/).map(Number) ?? [];
    // Ends that fall further than the body stands would land below the page, in a pit of their own shadow. So it stands taller.
    const stands = Math.max(fall, rise);
    if (rx || ry) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2, r = (rx || ry) / 0.25;
      const hw = d.w / 2 - ix / 0.25, hh = d.h / 2 - iy / 0.25;
      // It sits on the page, so unless it's said to fall further the curve squashes to fit what it stands.
      s.roll(rx ? { from: [cx + hw - r, cy], to: [cx + hw, cy], mirror: [cx, cy], past: true, drop: fall } : { from: [cx, cy + hh - r], to: [cx, cy + hh], mirror: [cx, cy], past: true, drop: fall }, fall * 2 >= stands ? stands - fall : 0);
    }
    const outline = el.getAttribute('path');
    const viewBox = el.getAttribute('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined;
    const body = d.list.find(p => p.def.outline);
    let drawn: Shape | undefined;
    if (body) s.group(frameOf(body), () => (drawn = s.resolve(body.def.outline!(body))));
    const plain = outline ? path(outline, d.x, d.y, d.w, d.h, { viewBox, spread: 12, rule: el.getAttribute('rule') === 'evenodd' ? 'evenodd' : undefined }) : rect(d.x, d.y, d.w, d.h, { radius: d.radius });
    // From behind, the same outline the other way round.
    if (!drawn && d.facing === 'back') s.group({ at: [(d.x + d.w / 2) * 2, 0], mirror: true }, () => (drawn = s.resolve(plain)));
    const shell = drawn ?? plain;
    d.shell = shell;
    // What a repaint has to draw again: moved, recoloured, and pictures on screens.
    const moved: Box[] = [], coloured: Box[] = [], pictures: ScreenCommand[] = [];
    // Parts shown where their springs have them by the player's crops, which the maker doesn't draw.
    const plays: [Part, { laid: Laid[]; rests: boolean; here: boolean }, Layers][] = [];
    // Where each part drawn as it was last time starts among the commands.
    const kept = new Map<Part, number>();
    // Whether what a part's crops saw round it has been drawn otherwise since: see `Layers.near`. Not the one being read, which is drawn
    // at its far end for its own crops only, and back where it was before the read is over.
    const gone = (L: Layers) => [...L.near].some(([q, was]) => q !== this.reading && q.commands !== was && !(q.commands?.length === was.length && q.commands.every((c, n) => same(was[n], c))));
    // Screens whose new pictures the player shows.
    const shows: [Screened, ScreenCommand][] = [];
    let hot = false, walled = false, stood = 0;
    // Below layer 0 a part is under the body, and the body's edge closes over it.
    const wall = () => {
      walled = true;
      if (bare) return;
      s.part(-1, stands);
      s.surface(shell, { material: d.material, over: { wear: d.wear, ...layOf(el.getAttribute('lay')) }, zEdge: -stands, bevel: parseLength(el.getAttribute('bevel'), 0) * MM || 6 * stands / TOP });
      const own = s.commands[s.commands.length - 1] as SurfaceCommand;
      own.body = true;
      offerGround(el, own);
      // The front's is the first layer of the body. The back's is the same one from behind.
      if (!d.facing) own.layer = true;
      // A side with no outline of its own is the body side on, whatever that's made of.
      if (side && !outline) own.section = true;
    };
    const one = (i: number, again = false): void => {
      const p = d.list[i]!;
      if (!walled && !p.under) wall();
      if (moving && !again && !moving.has(p) && p.commands) {
        kept.set(p, s.commands.length);
        for (const c of p.commands) s.commands.push(c);
        return;
      }
      p.focused = !this.byPointer && (p.el.matches(':focus-visible') || !!p.el.querySelector(':focus-visible'));
      const from = s.commands.length;
      const draw = () => {
      // Standing clear of the body, it's built round a plane that far behind the front, and all its heights count from there. What's on it sits on it, and goes with it.
      const back = p.el.closest('[back]')?.getAttribute('back');
      if (back != null) s.part(i, stands - +back + seatOf(p) - TOP, true, stands - +back, useOf(p, d));
      else s.part(i, seatOf(p) + stands - TOP, undefined, undefined, useOf(p, d));
      this.blamed = p.el;
      try {
        // A box with no size is one that isn't laid out, display: none among them, and sizes worked out from it go negative.
        // One that only hands something on to the others draws nothing, so it has no size to get wrong.
        if ((p.w && p.h) || p.def.spreads) {
          const paint = () => (p.def.local ? s.group(frameOf(p), () => p.def.paint(s, p, d)) : p.def.paint(s, p, d));
          // Turned about its middle with everything on it, as a lens twisted on its mount. Only the drawing turns: the page's boxes stay square.
          const twist = twistOf(d, p);
          if (twist) {
            const { at: c, rotate } = twist;
            s.group({ at: c, rotate }, () => s.group({ at: [-c[0], -c[1]] }, paint));
          } else paint();
        }
      } catch (e) {
        if (this.strict) throw e;
        // The rest of the device still stands. Each part starts clean, so all that's left of this one is what it drew.
        s.commands.length = from;
        warnOnce(thrown(p.el, e), 'error');
      }
      // Left out for `maps`, to read the body without it: what it drew in its joint's group, and nothing else. What it prints on what
      // holds it, as a knob's scale or a fader's ticks, is the body's, and stays where it is as the rest moves.
      if (p === this.leftOut) {
        const own = s.commands.slice(from), still = own.filter(c => !c.carried);
        this.leftCarried = still.length < own.length;
        s.commands.length = from;
        s.commands.push(...still);
      }
      // A surface on the body, as wide as it, is another layer of it, on the front or the back.
      if ((!d.facing || d.facing === 'back') && !bare && p.el.parentElement === d.el && isLayer(p.el)) {
        const layer = s.commands.slice(from).find(c => c.op === 'surface');
        if (layer) (layer as SurfaceCommand).body = (layer as SurfaceCommand).layer = true;
      }
      if (p.focused) focusRing(s, p, d, from);
      };
      const L = this.layers.get(p);
      if (L && !sketch && p.commands && this.reading !== p) {
        // Drawn as it was when its springs were read. The same as then, nothing of it has changed but its springs, and its crops show
        // where those have it with no paint; anything else, and the crops are of something that's gone.
        // One its joint carries whole is drawn where it is: all the joint changes of it is where and which way, and the rest is as it was read.
        const whole = [...L.springs.values()].some(l => l.carry);
        if (whole) draw();
        else {
          // Where its springs were, and not where a hand has it, which a joint goes by over its spring.
          const now = Object.values(p.springs).map(sp => sp.value), grips = Object.keys(p.springs).map(n => gripping(n)).filter(k => k in p.data).map(k => [k, p.data[k]] as const);
          Object.entries(p.springs).forEach(([n, sp]) => { sp.value = L.at[n] ?? sp.value; });
          for (const [k] of grips) delete p.data[k];
          try { draw(); } finally {
            Object.values(p.springs).forEach((sp, n) => { sp.value = now[n]!; });
            for (const [k, v] of grips) p.data[k] = v;
          }
        }
        const rest = s.commands.slice(from);
        s.commands.length = from;
        if (rest.length !== L.rest.length || p.w !== L.size[0] || p.h !== L.size[1] || !rest.every((c, n) => same(L.rest[n], c, undefined, whole ? CARRIES : undefined)) || gone(L)) this.unlayer(d, p);
        else if (moving) {
          const laid = this.laid(d, p, L);
          if (laid) {
            plays.push([p, laid, L]);
            kept.set(p, s.commands.length);
            for (const c of p.commands) s.commands.push(c);
            return;
          }
        }
      }
      draw();
      if (moving) this.redraws.set(p, (this.redraws.get(p) ?? 0) + 1);
      if (moving && this.reading !== p) this.redrew.set(p, performance.now());
      const reached = reach(s.commands, from), glow = warmth(s.commands, from), next = s.commands.slice(from), was = p.commands;
      if (moving) {
        hot ||= glow !== p.glow;
        // Only what differs from last time, so a meter that moved one bar doesn't repaint or relight all of them.
        if (was?.length === next.length) {
          next.forEach((c, n) => {
            const old = was[n]!;
            if (c.op === 'screen' && same(old, c)) {
              if (!moving.asked.has(p)) {
                // Read, its picture is the player's to show, with no paint.
                const S = this.screens.get(p);
                if (S?.ok && S.shown && !S.shown.dead && S.cmd.source === c.source && this.reading !== p && this.player!.plays(d.plate) && same(S.cmd, c)) shows.push([S, c]);
                else pictures.push(c);
              }
            }
            else if (same(old, c, COLOURS)) {
              if (!same(old, c)) coloured.push(join(extent(old), extent(c))!);
            } else {
              moved.push(join(extent(old), extent(c))!);
              stood = Math.max(stood, rises(old), rises(c));
            }
          });
        } else {
          const all = join(p.painted, reached);
          if (all) moved.push(all);
          for (const c of [...(was ?? []), ...next]) stood = Math.max(stood, rises(c));
        }
      }
      if ((p.hit !== false || p.commands?.some(c => c.op === 'glass' && c.covers)) && !sameBox(p.painted, reached)) d.reachDirty = p.shifted = true;
      p.painted = reached;
      p.glow = glow;
      p.commands = next;
      if (this.player) this.made.set(p, Object.fromEntries(Object.entries(p.springs).map(([n, sp]) => [n, sp.value])));
    };
    for (let i = 0; i < d.list.length; i++) one(i);
    // One read before a part round it was drawn otherwise is the maker's after all, moving or held still where its crops have it: let go,
    // and drawn now in its own place among the rest, if it wasn't just drawn, the last place first so the places before stay where they
    // are. Each drawn may leave another's crops of something gone, so round again.
    const stale = () => d.list.filter(p => { const L = this.layers.get(p); return !!L && gone(L); });
    for (let late = stale(); late.length; late = stale()) {
      for (const p of late.sort((a, b) => (kept.get(b) ?? -1) - (kept.get(a) ?? -1))) {
        const at = kept.get(p), k = plays.findIndex(e => e[0] === p);
        if (k >= 0) plays.splice(k, 1);
        const n = p.commands?.length ?? 0;
        this.unlayer(d, p);
        if (at === undefined) continue;
        const end = s.commands.length;
        one(d.list.indexOf(p), true);
        const drawn = s.commands.splice(end);
        s.commands.splice(at, n, ...drawn);
        kept.delete(p);
        for (const [q, k] of kept) if (k > at) kept.set(q, k + drawn.length - n);
      }
    }
    this.blamed = null;
    if (!walled) wall();
    // What stands clear of the body is one thing seen from either side, so a back draws the front's too, the other way round and as deep from here.
    // It's the same part, so a dial turned on the front is turned on the back. A repaint of the back draws it all again.
    if (d.facing === 'back' && !bare) {
      const f = d.front!, A = d.x + d.w / 2 + f.x + f.w / 2;
      f.list.forEach((p, j) => {
        const back = p.el.closest('[back]')?.getAttribute('back');
        if (back == null || !((p.w && p.h) || p.def.spreads)) return;
        const deep = d.face - +back;
        s.part(d.list.length + j, stands - deep + seatOf(p) - TOP, true, stands - deep, useOf(p, d));
        this.blamed = p.el;
        const from = s.commands.length;
        try {
          s.group({ at: [A, d.y - f.y], mirror: true }, () => (p.def.local ? s.group(frameOf(p), () => p.def.paint(s, p, d)) : p.def.paint(s, p, d)));
          // One sunk into the front that never reaches the middle isn't there from behind.
          if (!s.commands.slice(from).some(c => rises(c) > stands - d.face / 2)) s.commands.length = from;
        } catch (e) {
          if (this.strict) throw e;
          s.commands.length = from;
          warnOnce(thrown(p.el, e), 'error');
        }
      });
      this.blamed = null;
    }
    // What the crops moved is lit again as far as a paint of it would have been.
    const relit = () => {
      if (!plays.length && !shows.length) return;
      for (const [p, { laid, rests, here }] of plays) {
        this.player!.move(d.plate, p, laid, rests, here);
        if (laid.some(l => l.go?.turn)) this.turnedLaid(d);
      }
      let lit = plays.reduce<Box | null>((a, [, , L]) => join(a, L.lit), null), all = false;
      // A lamp laid brighter lights all round it, as a paint of it would have.
      if (plays.some(([, , L]) => L.hot)) all = this.renderer.glowDrawn = true;
      for (const [S, c] of shows) {
        this.player!.show(d.plate, S.shown!, c.source);
        // What gives light lights all round it, as a paint of it would have; what only takes it is lit again a little past its glass.
        if (S.shown!.lit) all = this.renderer.glowDrawn = true;
        else { const b = extent(c); lit = join(lit, { x: b.x - 32, y: b.y - 32, w: b.w + 64, h: b.h + 64 }); }
      }
      if (all) d.lightBox = null;
      else if (!d.lightDirty) d.lightBox = lit;
      else if (d.lightBox) d.lightBox = join(d.lightBox, lit);
      d.lightDirty = true;
    };
    this.drew = moving ? { box: [...moved, ...coloured].reduce<Box | null>((a, b) => join(a, b), null), plain: !coloured.length && !pictures.length && !hot, pictures: !!pictures.length, hot, lit: null, painted: false } : null;
    if (moving && !moved.length && !coloured.length && !pictures.length) return relit();
    // Said again the same, as every paint of a face across from it asks, it's no news to the others: else each would redraw what it
    // sees of the others for ever.
    if (known) return this.renderer.known(d.plate, s.commands, stands, !(d.plate.known && d.plate.made && same(d.plate.made, s.commands)));
    if (sketch) return this.sketchOf(d, s.commands);
    if (schemed(d.scheme)) d.themed = true;
    // What the maker paints over a screen that was read may change what stands over it: read again.
    if (moving && d.screened?.size) {
      const touched = [...moved, ...coloured];
      for (const p of [...d.screened]) {
        const S = this.screens.get(p);
        if (this.reading !== p && S && touched.some(b => meets(b, extent(S.cmd)))) this.unlayer(d, p);
      }
    }
    // Its labels went back with what a paint works in, and this paint is of all of it: they're drawn again first, as they were laid out.
    if (this.renderer.unlabelled(d.plate) && !this.relabel(d)) return;
    const done = this.renderer.paint(d.plate, {
      commands: s.commands, began: t0, stands, fixed: d.el.hasAttribute('fill') || !!d.window, partial: !!moving, moved, coloured, pictures, hot, stood,
      redrawn: moving && moved.length ? [...moving].flatMap(p => p.commands ?? []) : null,
      remade: !moving && !!d.remake && !d.materialDirty,
    });
    if (!moving) d.remake = false;
    if (!done) return;
    if ('margin' in done) {
      [d.x, d.y] = done.margin;
      d.layoutDirty = true;
      return;
    }
    d.drawn = { commands: s.commands, x: d.x, y: d.y, stands, fixed: d.el.hasAttribute('fill') };
    d.materialDirty = false;
    if (done.all) d.lightBox = null;
    else if (!d.lightDirty) d.lightBox = done.box;
    else if (d.lightBox) d.lightBox = join(d.lightBox, done.box);
    d.lightDirty = true;
    if (this.drew) { this.drew.painted = true; this.drew.lit = done.box; }
    if (this.player && !moving) this.seated(d);
    relit();
  }

  /**
   * All of a device was drawn again, and its plate has every part where its springs are. Its crops are boxes of the maps, which lie where
   * they did unless the canvas grew a margin or changed size, and then they're let go: a part that drew the same as when it was read, in the
   * same place, keeps its own.
   */
  private seated(d: Device): void {
    const m = d.plate.map, k = d.plate.spec.pw / d.plate.spec.cw, at = [k, d.x * k - m.x, d.y * k - m.y, m.w, m.h], was = d.seated;
    d.seated = at;
    this.player!.settle(d.plate);
    if (was && at.some((v, i) => Math.abs(v - was[i]!) > 1e-6)) for (const p of d.list) this.unlayer(d, p);
    // A screen is as it was read while it draws the same, and so does all that's drawn where it is.
    for (const p of [...(d.screened ?? [])]) {
      const S = this.screens.get(p)!, c = p.commands?.find(o => o.op === 'screen');
      if (!c || !same(S.cmd, c) || !same(S.round, this.round(d, c))) this.unlayer(d, p);
    }
  }

  /** What the player holds of each part to show it moved with no paint: see `read`. */
  private layers = new WeakMap<Part, Layers>();
  /** Each part's screen as the player read it: see `readScreen`. */
  private screens = new WeakMap<Part, Screened>();
  /** Each part's springs as the maker last drew it, which is where its plate has it. */
  private made = new WeakMap<Part, Record<string, number>>();
  private readTimer = 0;
  /** The part whose springs are being read, which the maker draws whatever is held of it. */
  private reading: Part | null = null;
  /** What the last paint of moving parts came to: the box it drew, whether only shapes moved, and how far it's lit again. */
  private drew: { box: Box | null; plain: boolean; pictures: boolean; hot: boolean; lit: Box | null; painted: boolean } | null = null;

  /** Lets go of what's held of a part, and it's read again when the page is next still. */
  private unlayer(d: Device, p: Part): void {
    const S = this.screens.get(p);
    if (S) {
      if (S.shown) this.player?.unshow(S.shown);
      this.screens.delete(p);
      d.screened?.delete(p);
      d.read = false;
    }
    const L = this.layers.get(p);
    if (!L) return;
    this.player?.unmove(d.plate, p);
    for (const l of L.springs.values()) if (l.crop) this.player?.free(l.crop);
    this.layers.delete(p);
    d.read = false;
  }

  /**
   * How far along each of a part's crops the maps are to show it where its springs have it, or null if they can't and the maker draws it.
   * `rests` is whether the plate has the part where it was read, with nothing to lay once its springs are back there, and `here` whether it
   * has it where its springs are now: the maker drew it there, as it draws one carried whole wherever it is.
   */
  private laid(d: Device, p: Part, L: Layers): { laid: Laid[]; rests: boolean; here: boolean } | null {
    if (!this.player?.plays(d.plate)) return null;
    const laid: Laid[] = [], made = this.made.get(p);
    let rests = true, here = true;
    for (const [name, sp] of Object.entries(p.springs)) {
      const at = L.at[name] ?? sp.value, l = L.springs.get(name), m = made?.[name] ?? at;
      if (Math.abs(sp.value - m) > 1e-6) here = false;
      if (l?.ok && l.crop && !l.crop.dead && l.crop.B0) {
        if (l.carry) {
          const c = p.def.carried!.call(p.def, p);
          laid.push({ crop: l.crop, f: 0, go: { x: c.x - l.carry.x, y: c.y - l.carry.y, turn: c.rotate - l.carry.rotate, pin: l.carry.pin } });
        }
        else laid.push({ crop: l.crop, f: (sp.value - at) / (l.to - at) });
        if (Math.abs(m - at) > 1e-6) rests = false;
      }
      // A spring with no crop has to be where the others were read with it, on the plate too, or their crops are of something else.
      else if (Math.abs(sp.value - at) > 1e-4 || Math.abs(m - at) > 1e-4) return null;
    }
    // The part alone is the part as it rested: with another spring of it away too, it isn't that.
    if (laid.length > 1 && laid.some(l => l.go) && laid.filter(l => (l.go ? l.go.x || l.go.y || l.go.turn : l.f)).length > 1) return null;
    return { laid, rests, here };
  }

  /**
   * Reads one spring of a device that's still, so the player can show it moved with no paint: the maker draws the part with the spring at
   * its far end, half way and back, the player keeps the far end as a crop of its maps, and the GPU says whether half way was half of
   * each. One that is plays from then on by laying the crop that far over the maps. One that isn't, a turn or a slide or a lamp, stays
   * the maker's. Nothing is shown of the reading: it's over within the frame and the picture isn't lit from it. True while there's more to read.
   */
  private read(d: Device): boolean {
    const player = this.player;
    // A face turned away is drawn and never seen: it's read when it comes round.
    if (!player) return false;
    // A new pack came with new maps, and what was read off the old one went with it.
    const pack = player.packed(d.plate);
    if (pack !== d.packed) {
      if (d.packed) for (const p of d.list) this.unlayer(d, p);
      d.packed = pack;
    }
    // A face turned away, or one too small to be read, has nothing to read.
    // One the player doesn't play has nothing it can read, and doesn't take the turn from one that has.
    const wants = !d.read && !d.small && d.visible && !this.away(d) && player.plays(d.plate), scan = wants ? this.nextRead(d) : null, due = !!scan && (!!scan.next || !!scan.screen || scan.soon);
    // A spring is read by painting its part, so what the maker paints in stays while there's one to read: see `Renderer.spare`. One
    // device at a time, so a page of them never keeps it for all at once: the rest give theirs back at their first light, and each
    // paints all of itself again when its turn comes. A reader that has stopped coming by, scrolled off or closed, loses its turn.
    const now = performance.now();
    if (this.reader && this.reader !== d && now - this.readerAt > 500) this.reader = null;
    if (due) this.reader ??= d;
    else if (this.reader === d) this.reader = null;
    const mine = due && this.reader === d;
    if (mine) this.readerAt = now;
    if (this.making !== d) this.renderer.hold(d.plate, mine);
    // One whose maps were let go has nothing to read, till it's drawn again.
    if (!wants || this.making) return false;
    // What the GPU has said since.
    let waiting = false;
    for (const { p } of d.movers) for (const l of this.layers.get(p)?.springs.values() ?? []) {
      if (!l.judging) continue;
      const said = player.judged(l.judging);
      if (said === null) { waiting = true; continue; }
      l.judging = null;
      l.ok = said;
      if (!said) l.why = 'half way is not half of each end';
      if (!said && l.crop) { player.free(l.crop); l.crop = null; }
    }
    for (const p of d.screened ?? []) {
      const S = this.screens.get(p);
      if (!S?.matching) continue;
      const said = player.matched(S.matching);
      if (said === null) { waiting = true; continue; }
      S.matching = null;
      S.ok = said;
      if (!said) {
        S.why = 'its picture shown by the player is not what was painted';
        if (S.shown) player.unshow(S.shown);
        S.shown = null;
      }
    }
    // Nothing of it can be read now: all read, unless one is held up or the GPU has still to say.
    if (!due) {
      d.read = !scan!.held && !waiting;
      return waiting;
    }
    if (!mine) return true;
    if (!this.shown(d, d.el)) return waiting;
    // Something of it is moving, and the reading waits for it to stop: looked at again shortly, as nothing else may ask for a frame by then.
    // A pointer crossing it, and the lamp easing after, move none of what's read, and what's under a pointer is what's pressed next.
    if (this.scrolled || this.turnsDue || d.moving.size || d.materialDirty || d.remake || !player.current(d.plate)) {
      this.readTimer ||= window.setTimeout(() => { this.readTimer = 0; this.schedule(); }, 150);
      return true;
    }
    // A few ms of it a frame, so a keyboard is read in a few frames and none of them is long.
    for (const t0 = performance.now(); ;) {
      const more = this.readOne(d, player, waiting);
      // All read, and no frame may follow to say so.
      if (d.read) this.renderer.hold(d.plate, false);
      if (more !== 'next' || performance.now() - t0 > 3) return more !== 'done';
    }
  }

  /** The device whose springs are being read, and when it last came by to be: see `read`. */
  private reader: Device | null = null;
  private readerAt = 0;

  /**
   * The spring of a device to read next, the one under the pointer first, as it's the one about to be pressed. `held` says one is held
   * up, moving or drawn again by the maker a moment ago, and `soon` that one hasn't been drawn at all yet, before the device's first paint.
   * `screen` is a screen still to read, which comes after every spring: nothing of a screen's reading is where its picture is at.
   */
  private nextRead(d: Device): { next: [Part, string] | null; screen: Part | null; held: boolean; soon: boolean } {
    let next: [Part, string] | null = null, held = false, soon = false;
    const now = performance.now();
    for (const { p } of d.movers) {
      const L = this.layers.get(p), made = this.made.get(p);
      if (now - (this.redrew.get(p) ?? -1e9) < 1000) { held = true; continue; }
      for (const name of Object.keys(p.springs)) {
        if (L?.springs.has(name)) continue;
        if (!p.commands) { soon ||= !d.plate.painted; continue; }
        if (!(p.w && p.h)) continue;
        // Read where it rests, and the plate has it there.
        if (Object.values(p.springs).some(o => o.active) || (made && Object.entries(p.springs).some(([n, o]) => Math.abs((made[n] ?? o.value) - o.value) > 1e-6))) { held = true; continue; }
        if (!next || (!next[0].el.matches(':hover') && p.el.matches(':hover'))) next = [p, name];
      }
    }
    return { next, screen: next ? null : d.list.find(p => !this.screens.has(p) && p.commands?.some(c => c.op === 'screen')) ?? null, held, soon };
  }

  /** Reads the next spring of a device: see `read`. */
  private readOne(d: Device, player: NonNullable<Engine['player']>, waiting: boolean): 'next' | 'wait' | 'done' {
    const { next, screen, held } = this.nextRead(d);
    // Given back already, as it is once all were read and one is to be read again: all of the device is painted again first, and the
    // spring or the screen read off that.
    if ((next || screen) && !this.renderer.working(d.plate)) { d.remake = true; this.schedule(); return 'wait'; }
    if (!next) {
      if (screen) { this.readScreen(d, screen, player); return 'next'; }
      waiting ||= [...(d.screened ?? [])].some(p => this.screens.get(p)?.matching);
      // What was asked this frame hasn't been said yet either.
      waiting ||= d.movers.some(({ p }) => [...(this.layers.get(p)?.springs.values() ?? [])].some(l => l.judging));
      d.read = !held && !waiting;
      return waiting ? 'wait' : 'done';
    }
    const [p, name] = next, sp = p.springs[name]!, was = sp.value, target = sp.target, velocity = sp.velocity;
    const L: Layers = this.layers.get(p) ?? { at: Object.fromEntries(Object.entries(p.springs).map(([n, o]) => [n, o.value])), rest: p.commands!, springs: new Map(), lit: null, size: [p.w, p.h], near: new Map() };
    this.layers.set(p, L);
    const stops = p.def.ends?.(p) ?? null, to = stops ? (Math.abs(stops[0] - was) > Math.abs(stops[1] - was) ? stops[0] : stops[1]) : was > 0.5 ? 0 : 1;
    const entry: Layer = { to, crop: null, judging: null, ok: false };
    L.springs.set(name, entry);
    // One its joint carries whole, a slide or a turn, is no lerp of its ends: it's the part alone, moved over the body without it.
    const carry = (v: number) => { sp.value = v; try { return p.def.carried!.call(p.def, p); } finally { sp.value = was; } };
    const c0 = p.def.carried ? carry(was) : null, c1 = c0 && carry(to);
    let whole = !!c0 && !!c1 && (c0.x !== c1.x || c0.y !== c1.y || c0.rotate !== c1.rotate);
    // All a box covers as the joint takes it from one stop to the other.
    const swept = (b: Box): Box => {
      const pin = [p.x + c0!.pin[0], p.y + c0!.pin[1]], [lo, hi] = stops ?? [was, to];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i <= 16; i++) {
        // One that turns with no stops goes all the way round.
        const c = carry(lo + ((hi - lo) * i) / 16), a = !stops && c1!.rotate !== c0!.rotate ? (i / 16) * 2 * Math.PI : c.rotate - c0!.rotate, cos = Math.cos(a), sin = Math.sin(a);
        for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]] as const) {
          const X = pin[0]! + (x - pin[0]!) * cos - (y - pin[1]!) * sin + c.x - c0!.x, Y = pin[1]! + (x - pin[0]!) * sin + (y - pin[1]!) * cos + c.y - c0!.y;
          x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
        }
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    const dirty = d.lightDirty, box = d.lightBox, peak = d.plate.peak;
    const at = (v: number) => {
      sp.value = sp.target = v;
      sp.velocity = 0;
      d.moving.add(p);
      this.drew = null;
      this.paint(d, d.moving);
      d.moving.clear();
      const drew = this.drew as Engine['drew'];
      return drew?.painted ? drew : null;
    };
    this.reading = p;
    let all: Box | null = null, mid: Mid | null = null, far: Crop | null = null, seen: Box | null = null;
    try {
      // What its joint carries is only what it drew in the joint's group, and what it drew outside it is the body's: carried whole, all
      // of that is the same at either end. One that draws nothing there, or whose print or stem changes as it goes, isn't carried.
      let gone: ReturnType<typeof at> = null;
      if (whole) {
        this.leftOut = p;
        try {
          const far = at(to), there = p.commands!, moves = this.leftCarried;
          // Drawn as nothing, where it rests: what's there is the body without it. The same as at its far end, that's already on the
          // plate, and the paint that took it off is the one to read.
          gone = at(was);
          whole = moves && this.leftCarried && there.length === p.commands!.length && there.every((c, i) => same(c, p.commands![i]));
          if (whole) gone ??= far;
        } finally { this.leftOut = null; }
      }
      if (whole) {
        all = gone?.box ?? null;
        if (gone?.box && gone.plain) {
          const over = swept(gone.box);
          seen = join(gone.box, over);
          entry.crop = player.read(d.plate, seen!, over, true);
          entry.carry = { ...c0!, pin: [p.x + c0!.pin[0], p.y + c0!.pin[1]] };
          L.lit = join(L.lit, swept(gone.lit ?? gone.box));
          // And at its far end, for what of the body stands over it there.
          const end = at(to);
          all = join(all, end?.box);
          if (entry.crop && end?.box) { const box = join(end.box, over)!; seen = join(seen, box); far = player.read(d.plate, box, over, true); }
        }
        else entry.why = !gone ? 'nothing painted' : !gone.box ? 'no box' : 'more than its maps changed';
        return 'next';
      }
      const a = at(to);
      all = a?.box ?? null;
      // Taller at its far end than the device stood, a book drawn out: more than the maps' heights hold, and its shadow on the page is longer.
      if (a && d.plate.peak > peak + 1e-3) entry.why = 'it stands taller than the device did';
      else if (a?.box && !a.pictures) {
        // More than its maps changed, a lamp coming on: its colour and light are read at each end too.
        const glows = !a.plain;
        entry.crop = player.read(d.plate, a.box, a.box, false, glows);
        const b = at((was + to) / 2);
        all = join(all, b?.box);
        if (entry.crop && b?.box) mid = player.readMid(d.plate, all!, a.box, glows);
        L.lit = join(L.lit, a.lit);
        if (a.hot) L.hot = true;
      }
      else entry.why = !a ? 'nothing painted' : !a.box ? 'no box' : 'a picture changed with it';
    } finally {
      const c = at(was);
      sp.target = target;
      sp.velocity = velocity;
      all = join(all, c?.box);
      if (all) player.read(d.plate, all, null);
      // What else its crops hold, as the maker had it drawn.
      seen = join(seen, all);
      if (seen) for (const q of d.list) if (q !== p && q.commands && q.painted && !L.near.has(q) && meets(q.painted, seen)) L.near.set(q, q.commands);
      if (entry.crop && mid) entry.judging = player.ask(d.plate, entry.crop, mid);
      if (mid) player.freeMid(mid);
      if (entry.crop && !entry.judging && !whole) { player.free(entry.crop); entry.crop = null; entry.why ??= mid ? 'no query' : 'no crop half way'; }
      else if (!entry.crop) entry.why ??= 'no crop';
      player.readEnd(d.plate, entry.crop, far && entry.carry && { crop: far, go: { x: c1!.x - c0!.x, y: c1!.y - c0!.y, turn: c1!.rotate - c0!.rotate, pin: entry.carry.pin } });
      if (far) player.free(far);
      // Carried whole, there's nothing to ask: it is what its joint says it is.
      if (whole) entry.ok = !!entry.crop?.mask;
      this.reading = null;
      L.rest = p.commands!;
      // Back as it was, and nothing of it to light.
      d.lightDirty = dirty;
      d.lightBox = box;
      // Drawn past its maps at its far end, they were made again to hold it there and the pack went with them: lit again for a new one,
      // and the spring read off that, which now reaches.
      if (!player.packed(d.plate)) {
        L.springs.delete(name);
        d.lightDirty = true;
        d.lightBox = null;
        this.schedule();
      }
    }
    return 'next';
  }

  /**
   * Reads a screen of a device that's still, so its next picture is no paint: the maker draws it all black and all white, the player keeps
   * the maps with none of it in them and how much of it comes through at each pixel, and from then on lays what the screen makes of a
   * picture over those itself. The GPU says whether the picture it has now, shown that way, is what the maker painted; one that isn't,
   * under frost that blurs it, stays the maker's.
   */
  private round(d: Device, c: Command): Command[] {
    const box = extent(c);
    return d.list.flatMap(o => o.commands ?? []).filter(o => o !== c && meets(extent(o), box));
  }

  private readScreen(d: Device, p: Part, player: NonNullable<Engine['player']>): void {
    const all = p.commands!.filter((c): c is ScreenCommand => c.op === 'screen'), c = all[0]!, entry: Screened = { cmd: c, shown: null, matching: null, ok: false, round: this.round(d, c) };
    this.screens.set(p, entry);
    (d.screened ??= new Set()).add(p);
    const { width, height } = c.source as { width: number; height: number }, box = extent(c);
    if (all.length > 1) entry.why = 'more than one screen';
    else if (c.kind === 'coat') entry.why = 'a coat is its finish too';
    else if ((c as Command).bend || !('hw' in c.shape) || c.shape.type === 'arc') entry.why = 'not flat on the plate';
    else if (!(width > 0 && height > 0) || width * height > 4e6) entry.why = 'no picture of a size';
    else if (entry.round.some(o => o.op === 'frost' && o.blur > 0)) entry.why = 'under frost, which blurs it';
    if (entry.why) return;
    const dirty = d.lightDirty, lit = d.lightBox, glowed = this.renderer.glowDrawn;
    const at = (level: number | null) => {
      this.renderer.standIn = level === null ? null : { source: c.source, level };
      d.moving.add(p);
      this.drew = null;
      try { this.paint(d, d.moving); } finally { this.renderer.standIn = null; d.moving.clear(); }
      return (this.drew as Engine['drew'])?.painted ? player.lifts(d.plate, box) : null;
    };
    this.reading = p;
    let black: ReturnType<typeof at> = null, white: ReturnType<typeof at> = null, real: ReturnType<typeof at> = null;
    try {
      black = at(0);
      white = black && at(255);
    } finally {
      // Back as it was, with the picture it has now, which may be newer than the one it showed.
      real = at(null);
      this.reading = null;
      // The pack is the plate's again, which is as it was, with nothing of it to light.
      player.read(d.plate, box, null);
      player.readEnd(d.plate, null);
      d.lightDirty = dirty;
      d.lightBox = lit;
      this.renderer.glowDrawn = glowed;
    }
    const got = real && black && white && player.screen(d.plate, real, black, white, c, [width, height]);
    player.unlift(real); player.unlift(black); player.unlift(white);
    if (got) { entry.shown = got.shown; entry.matching = got.matching; }
    else entry.why = !real ? 'no maps to read' : !black || !white ? 'nothing painted' : 'no pack';
  }

  private redraws = new WeakMap<Part, number>();
  /** When the maker last drew a part again that wasn't being read. One it keeps drawing, a lit key in a wave of colour, isn't read till it stops. */
  private redrew = new WeakMap<Part, number>();
  /** How many times the maker has drawn a part again because it moved, rather than the player laying what was read of it. */
  redrawn(el: Element): number {
    const d = deviceOf(el), p = d?.list.find(p => p.el === el);
    return (p && this.redraws.get(p)) ?? 0;
  }

  /** How many springs of a device the player holds to move with no paint, how many it can't, and how many it has still to read. */
  played(el: Element): { held: number; makers: number; left: number; why: Record<string, number> } {
    const d = deviceOf(el), out = { held: 0, makers: 0, left: 0, why: {} as Record<string, number> };
    if (!d) return out;
    for (const { p } of d.movers) for (const name of Object.keys(p.springs)) {
      const l = this.layers.get(p)?.springs.get(name);
      if (l?.ok && l.crop && !l.crop.dead) out.held++;
      else if (l && !l.judging) { out.makers++; const w = l.why ?? '?'; out.why[w] = (out.why[w] ?? 0) + 1; }
      else out.left++;
    }
    return out;
  }

  /** How many screens of a device the player shows a new picture on with no paint, how many it can't, and how many it has still to read. */
  screened(el: Element): { held: number; makers: number; left: number; why: Record<string, number> } {
    const d = deviceOf(el), out = { held: 0, makers: 0, left: 0, why: {} as Record<string, number> };
    if (!d) return out;
    for (const p of d.list) {
      if (!p.commands?.some(c => c.op === 'screen')) continue;
      const S = this.screens.get(p);
      if (S?.ok && S.shown && !S.shown.dead) out.held++;
      else if (S && !S.matching) { out.makers++; const w = S.why ?? '?'; out.why[w] = (out.why[w] ?? 0) + 1; }
      else out.left++;
    }
    return out;
  }

  /** Devices whose outlines have been drawn, or tried. */
  private sketched = new WeakSet<Device>();

  /** Lays a device out and draws its outlines, while it waits its turn to arrive. A device that can't is simply left to arrive. */
  private sketch(d: Device): void {
    try {
      if (d.layoutDirty || !d.placed) this.layout(d);
      this.paint(d, undefined, true);
    } catch (e) {
      if (this.strict) throw e;
    } finally {
      this.blamed = null;
    }
  }

  /** Has a face that hasn't drawn say what it would: see `paint`. One that can't is left out of what the others see until it draws. */
  private know(f: Device): void {
    try {
      if (f.layoutDirty || !f.placed) this.layout(f);
      this.paint(f, undefined, true, true);
    } catch (e) {
      if (this.strict) throw e;
    } finally {
      this.blamed = null;
    }
  }

  private sketchOf(d: Device, commands: readonly Command[]): void {
    if (!d.cw || !d.ch || !d.w) return;
    // Drawn at the size it's shown, so a line is a pixel on the screen however small the page shows it. Too small to read, it waits as it did.
    const zoom = this.where(d).width / d.w;
    if (Math.max(d.w, d.h) * zoom < LEAST_SHOWN) return;
    const c = (d.drawing ??= document.createElement('canvas'));
    c.dataset.sketch = '';
    c.setAttribute('aria-hidden', 'true');
    drawSketch(c, { commands, x: d.x, y: d.y, cw: d.cw, ch: d.ch, dpr: devicePixelRatio || 1, zoom, scheme: d.scheme });
    if (c.isConnected) return;
    d.canvas.after(c);
    if (!this.reduced.matches) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SKETCH_IN, easing: 'ease-out' });
  }

  /** Its picture has landed, so the outlines give way to it: one fades as the other comes. */
  private unsketch(d: Device): void {
    const c = d.drawing;
    if (!c) return;
    c.style.transition = `opacity ${UNSKETCH}ms`;
    c.style.opacity = '0';
    // And the picture comes in under them as they go, so the one turns into the other and nothing lands all at once.
    if (!this.reduced.matches && !d.staged) d.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: UNSKETCH, easing: 'ease-out' });
    setTimeout(() => {
      c.remove();
      if (d.drawing === c) d.drawing = null;
    }, UNSKETCH);
  }

  /** Gives a device's canvas the box its picture is about to be made for, and says where that is on the screen. Only as the
   * picture lands, in the same task, so a canvas never shows one picture stretched over another's box: a zoom across a page of
   * them, lit a few at a time, would show each at the wrong size until its turn came. */
  private place(d: Device): DOMRect {
    // Staged, its canvas shows nothing and its box is only worked out: setting it would lay the page out again to read it.
    if (d.staged) return this.box(d);
    const s = d.canvas.style, box = [`${-d.x}px`, `${-d.y}px`, `${d.cw}px`, `${d.ch}px`] as const;
    if (s.left !== box[0] || s.top !== box[1] || s.width !== box[2] || s.height !== box[3]) Object.assign(s, { left: box[0], top: box[1], width: box[2], height: box[3] });
    return this.boxOf(d, 1, true);
  }

  /** Where a device's picture is on the screen: its canvas, or for one the stage shows, where that canvas would be, as its own is empty
   * and wherever it was last put. A canvas not yet placed for the box it has now is where its next picture will be: it's placed only as
   * that lands, and until then it's at a browser's default size, or shrunk to nothing off the stage, or the box of a layout before, at the
   * device's corner. Up close that can be off the window with the device in it, and nothing would light it to put it right. */
  private box(d: Device): DOMRect {
    if (!d.staged && d.canvas.style.width === `${d.cw}px` && d.canvas.style.height === `${d.ch}px`) return this.boxOf(d, 1);
    const r = this.where(d), z = d.w ? r.width / d.w : 1;
    return new DOMRect(r.left - d.x * z, r.top - d.y * z, d.cw * z, d.ch * z);
  }

  /**
   * The player laid a part of `d` turned, which is only as near the maker's as a turned raster gets: held still a moment, the maker paints it
   * where it is, once, and a turn played on through a drag still makes no maps.
   */
  private turnedLaid(d: Device): void {
    clearTimeout(d.turnWait);
    d.turnWait = window.setTimeout(() => {
      if (!this.devices.has(d) || !this.player?.turned(d.plate)) return;
      if (d.moving.size || d.movers.some(m => m.springs.some(s => s.active))) return this.turnedLaid(d);
      d.materialDirty = true;
      this.stir(d);
      this.schedule();
    }, TURN_STILL);
  }

  /** Has the frame take up a device again, and the other faces of its body, which see what it draws edge-on. */
  private stir(d: Device): void {
    const body = d.front ?? d;
    d.quiet = body.quiet = false;
    for (const f of body.faces) f.quiet = false;
  }

  /** Whether nothing about a device is due, once the frame has done what it could: nothing to lay out, paint or light, nothing
   * moving on it, and a picture that's whole and sharp. */
  private restful(d: Device, version: number): boolean {
    return this.drawn(d, version) && !(d.reachDirty && !this.sleepers.has(d)) && !d.moving.size && !d.ticked && !d.unread && !d.movers.some(m => m.springs.some(s => s.active));
  }

  /** Whether a device has nothing left to draw of how it is now, as sharp as it'll get, whatever's still to work out about a hand or to move. */
  private drawn(d: Device, version: number): boolean {
    return d.placed && d.version === version && this.held(d) && !d.layoutDirty && !d.viewDirty && !d.materialDirty && !d.lightDirty &&
      !d.sharpen && !d.plate.wanted && !d.plate.stood && !this.rough(d) && !this.renderer.edgesStale(d.plate) && !this.player?.turned(d.plate);
  }

  /** Where a device is in the window: read once for as long as nothing could have moved it. */
  private where(d: Device): DOMRect {
    return this.boxOf(d, 0);
  }

  /**
   * A device's box, or its canvas's, read once for as long as nothing could have moved it. A camera moving moves all of its world
   * by one scale and shift, so one in a camera's world is worked out from where it is in that world, not read: a flight over
   * thousands of devices reads the world's own box once a move, and none of theirs.
   */
  private boxOf(d: Device, which: 0 | 1, read = false): DOMRect {
    this.sure();
    const k = d.kept[which];
    if (!read && k.at === this.moves && k.look === this.looks) return k.r!;
    const lens = this.camOf(d) && this.lens(d.cam!);
    if (!read && lens && k.at === this.moves && k.local) {
      const [x, y, w, h] = k.local;
      k.r = new DOMRect(lens.left + x * lens.s, lens.top + y * lens.s, w * lens.s, h * lens.s);
    } else {
      // On the stage, where something moves it, it's where it lies flat, as its picture is drawn and lit: the stage moves that.
      const r = (k.r = (!which && this.flatOf(d)) || (which ? d.canvas : d.el).getBoundingClientRect());
      k.local = lens ? [(r.left - lens.left) / lens.s, (r.top - lens.top) / lens.s, r.width / lens.s, r.height / lens.s] : null;
      k.at = this.moves;
    }
    k.look = this.looks;
    return k.r;
  }

  /** Where a camera's world has its corner in the window, and the scale it's shown at, as of the last camera move. */
  private lens(world: HTMLElement): { left: number; top: number; s: number } | null {
    this.sure();
    let l = this.lenses.get(world);
    if (l?.at === this.moves && l.look === this.looks) return l.s ? l : null;
    const r = world.getBoundingClientRect(), s = scaleOf(world);
    this.lenses.set(world, (l = { left: r.left, top: r.top, s: s && s > 0 ? s : 0, at: this.moves, look: this.looks }));
    return l.s ? l : null;
  }

  /** The page changed. Only what's round a device can move it, and its own attributes, but for those it keeps itself. A change inside
   * a box that holds its own layout moves only the devices in that box, so a page of cells, one arriving at a time, reads only that cell
   * again and not every device on the page. */
  private changed(ms: MutationRecord[]): void {
    // It says whether what's in it can be worked, and so whether its markup sleeps, now, whatever else changed with it.
    if (this.stage) for (const m of ms) {
      if (m.attributeName !== 'inert') continue;
      const el = m.target as HTMLElement;
      // No hand is on what's gone out of reach.
      if (el.inert && this.woken && el.contains(this.woken.d.el)) this.unhand();
      this.restAll([...this.devices].filter(d => el.contains(d.el)));
    }
    for (const m of ms) {
      const n = m.target, el = (n.nodeType === 1 ? n : n.parentElement) as Element | null;
      // What's already left the page, as a device's parts do after it, moves nothing there.
      if (!el || !el.isConnected || el === this.stage?.canvas || m.attributeName === 'data-bent' || m.attributeName === 'data-flat') continue;
      const own = el.closest('d-device, [data-alone]');
      if (own && (own !== el || (m.attributeName && OWN.has(m.attributeName)))) continue;
      // Going inert or coming back moves nothing.
      if (m.attributeName === 'inert') continue;
      // What a camera turns lies where it did, and the camera says it turned.
      if (m.attributeName === 'style' && isTable(el)) continue;
      // A camera writes only its scale and shift on its world, and says so itself. Anything else there moves what's in it.
      if (m.attributeName === 'style' && scaleOf(el) !== undefined && this.lensStyle.get(el) === (this.lensStyle.set(el, unlensed(el as HTMLElement)), unlensed(el as HTMLElement))) continue;
      this.changes.push({ el, m, own });
    }
    if (this.changes.length && this.judged.size) this.schedule();
  }

  /** What's changed round devices since boxes were last read, sorted all at once: what it moved, if anything, by where it is. */
  private sortChanges(): void {
    const list = this.changes;
    this.changes = [];
    let within: Set<Element> | null = null;
    for (const { el, m, own } of list) {
      if (!el.isConnected) continue;
      // A box that holds its own layout whose attributes changed, a background, say, moved nothing round it if its own box stayed, which
      // is seen when boxes are next read, with everything else that changed by then.
      if (m.type === 'attributes' && holderOf(el, true) === el) {
        this.unsure.set(el as HTMLElement, true);
        if (this.judged.size) this.schedule();
        continue;
      }
      // What's added to or taken from a box, or its text, stays in it if it holds its own layout. Its own attributes can resize it.
      const holder = holderOf(m.type === 'attributes' ? el.parentElement : el);
      if (holder) {
        (within ??= new Set()).add(holder);
        continue;
      }
      if (!own && this.aside(el, m)) continue;
      // An attribute round a camera's world, what it did is seen by looking. Inside the world it's usually a thing being moved, where looking only costs.
      if (m.type === 'attributes' && !el.closest('[data-camera]')) {
        this.wantsSeen = true;
        if (this.seen?.at === this.moves) {
          this.doubt = this.moves;
          if (this.judged.size) this.schedule();
          continue;
        }
      }
      this.moves++;
      // What the engine judges itself is told at the next frame, which nothing else may have asked for.
      if (this.judged.size) this.schedule();
      return;
    }
    if (within) this.shifted(within);
  }

  /** Whether this change is to a box fixed in the window with no device in it, which takes up no room, so nothing round it moves. Fixed
   * before and after, as one that's just become so left a gap. Its style, text or children only: a rule can ask after any other attribute
   * and restyle what's beside it. */
  private aside(el: Element, m: MutationRecord): boolean {
    if (m.type === 'attributes' && m.attributeName !== 'style') return false;
    if (el.querySelector('d-device, [data-alone]')) return false;
    const was = fixedWas.get(el), now = getComputedStyle(el).position === 'fixed';
    fixedWas.set(el, now);
    return !!was && now;
  }

  /** Whether every device still shows where `seen` has it, turned the same, in a world that's where it was. */
  private stayed(): boolean {
    const seen = this.seen, lens = seen?.at === this.moves ? this.lens(seen.world) : null;
    if (!seen || !lens || seen.boxes.size !== this.devices.size) return false;
    const w = seen.world.getBoundingClientRect();
    if (Math.abs(w.left - lens.left) > STAYED || Math.abs(w.top - lens.top) > STAYED) return false;
    for (const [d, { box }] of seen.boxes) {
      if (!d.el.isConnected) return false;
      const r = d.el.getBoundingClientRect();
      if (Math.abs((r.left - lens.left) / lens.s - box[0]) > STAYED || Math.abs((r.top - lens.top) / lens.s - box[1]) > STAYED || Math.abs(r.width / lens.s - box[2]) > STAYED || Math.abs(r.height / lens.s - box[3]) > STAYED) return false;
    }
    for (const [d, { pose }] of seen.boxes) if (poseOf(d.el, seen.world) !== pose) return false;
    return true;
  }

  /** Notes where every device shows, if they're all in the one camera's world. A count of `moves` needs this once, and a page that changes nothing round its world never does. */
  private see(): void {
    if (!this.wantsSeen || this.seen?.at === this.moves) return;
    this.seen = null;
    const boxes: NonNullable<Engine['seen']>['boxes'] = new Map();
    let world: HTMLElement | null = null;
    for (const d of this.devices) {
      world ??= this.camOf(d);
      if (!d.el.isConnected || !world || this.camOf(d) !== world) return;
    }
    const lens = world && this.lens(world);
    if (!lens) return;
    for (const d of this.devices) {
      const r = d.el.getBoundingClientRect();
      boxes.set(d, { box: [(r.left - lens.left) / lens.s, (r.top - lens.top) / lens.s, r.width / lens.s, r.height / lens.s], pose: poseOf(d.el, world!) });
    }
    this.seen = { at: this.moves, world: world!, boxes };
  }

  /** Reads where each box that holds its own layout and may have moved is, before any box is used: one that stayed moved only what's in it. */
  private sure(): void {
    if (this.changes.length) this.sortChanges();
    if (this.doubt >= 0) {
      const at = this.doubt;
      this.doubt = -1;
      // Anything that's counted since has had everything read again anyway.
      if (at === this.moves && !this.stayed()) {
        this.moves++;
        if (this.judged.size) this.schedule();
      }
    }
    for (const p of this.arrived) {
      const box = p.isConnected ? (holderOf(p, true) as HTMLElement | null) : null;
      if (box && !this.holderBox.has(box) && !this.unsure.has(box)) this.unsure.set(box, false);
    }
    this.arrived.clear();
    if (!this.unsure.size) return;
    const within = new Set<Element>();
    let out = false;
    for (const [el, changed] of this.unsure) {
      const box = `${el.offsetLeft},${el.offsetTop},${el.offsetWidth},${el.offsetHeight}`, was = this.holderBox.get(el);
      this.holderBox.set(el, box);
      if (!changed) continue;
      if (was === undefined || was !== box) out = true;
      within.add(el);
    }
    this.unsure.clear();
    if (out) {
      this.moves++;
      if (this.judged.size) this.schedule();
    } else if (within.size) this.shifted(within);
  }

  /** Something moved inside each of these boxes, which hold their own layout, so the devices in them are read again and no others. */
  private shifted(within: Set<Element>): void {
    for (const holder of within)
      for (const e of holder.querySelectorAll('d-device, [data-alone]')) {
        const d = (e as HTMLElement & { __d?: Device }).__d;
        if (d) d.kept[0].at = d.kept[1].at = -1;
      }
    this.shifts++;
    if (this.judged.size) this.schedule();
  }

  /** Whether the page has something animating that holds a device, which moves the devices with it. */
  private animating(): boolean {
    for (const a of document.getAnimations()) {
      const t = (a.effect as KeyframeEffect | null)?.target;
      if (!t || a.playState !== 'running') continue;
      let held = this.carries.get(t);
      if (held === undefined) this.carries.set(t, (held = t.matches('d-device, [data-alone]') || !!t.querySelector('d-device, [data-alone]')));
      if (held) return true;
    }
    return false;
  }

  /** Whether any of a device is in the window, rather than only near enough to keep: its picture, or `el`. */
  private shown(d: Device, el?: Element): boolean {
    // Turned, it's where it's shown, not where it would lie flat, or one whose end turns into the window is never lit.
    const r = el && el !== d.el ? el.getBoundingClientRect() : this.shownOf(d, el ? 0 : 1) ?? (el ? this.where(d) : this.box(d));
    return r.bottom > -SHOWN_MARGIN && r.top < innerHeight + SHOWN_MARGIN && r.right > -SHOWN_MARGIN && r.left < innerWidth + SHOWN_MARGIN;
  }

  /**
   * A flash or a flame lights only as far as it reaches, and once it's moved or gone, where it was. So twenty short ones relight
   * what's round them, and nothing else. The torch goes in the list as well, for what else is lit by it, such as the air.
   */
  private lightPoints(): boolean {
    const P = this.pointer, T = TORCHES[this.handheld];
    // As bright as the middle of its pool shows white: its core, at the distance it's held.
    setBeam(this.torch && P.i > 0 ? { kind: 'beam', at: [P.x, P.y], color: T.color.map(c => c * 10 * T.core * T.power * P.i * this.torch * (EXPOSURE / Math.PI)) as [number, number, number] } : null);
    this.points = null;
    // A camera on the move writes nothing but where it's looking: what they light catches up when it stops.
    if ((!this.pointsMoved && !this.glowMoved.length) || this.sizing) return false;
    // A glow that changed relights only where it reaches, where it is now and where it was. Anything else relights where all of them do.
    this.pointsAll = this.pointsMoved;
    const points: Point[] = this.pointsMoved
      ? [...pointLights()].map(l => ({ at: placeOf(l.at), far: reachOf(l, LEAST_LIGHT), from: null as Plate | null, flat: null as Emitter | null })).concat(this.renderer.emitters.map(reaches))
      : this.glowMoved.map(reaches);
    this.points = new Reaching(points.filter(l => l.far > 0));
    this.pointsMoved = false;
    this.glowMoved = [];
    return true;
  }

  /**
   * What the page gives off, small, for the air to be lit by while it's asked for, and for what glows to light the devices round
   * it. Only what glows is drawn into it, and not while a camera moves. It comes back a frame late, so a frame that asks for one waits for the next to collect it.
   */
  private glowOut(): boolean {
    if (this.sizing) return false;
    const asked = glowAsked();
    if (!asked && !this.glowStale && !this.renderer.glowPending) return false;
    // A new picture waits its turn. Taken up once one is due, as nothing else may ask for a frame then.
    if (!asked && !this.renderer.glowPending && performance.now() - this.glowAt < GLOW_EVERY) return true;
    const glowing: Device[] = [];
    let seen = 0;
    for (const d of this.devices) {
      if (!d.visible || this.asleep(d)) continue;
      seen++;
      if (d.plate.tex?.E) glowing.push(d);
    }
    // A glow lights only other devices, so with nothing else on the page there's nothing to work out, unless the air asks.
    if (!glowing.length || (!asked && seen < 2)) {
      setGlow(null);
      if (!this.renderer.emitters.length) return false;
      this.renderer.emitters = [];
      return this.shift([]);
    }
    // A new picture is made while the air wants one every frame, or once what glows has changed or moved.
    // Where each is is read only for a picture that's made, and kept with it, so what it gives off is found where it was drawn.
    const shots = () => glowing.map(d => {
      const r = this.box(d);
      return { d, r, plate: d.plate, x: r.left / GLOW_CELL, y: r.top / GLOW_CELL, w: r.width / GLOW_CELL, h: r.height / GLOW_CELL };
    });
    const got = this.renderer.glowing(shots, Math.ceil(innerWidth / GLOW_CELL), Math.ceil(innerHeight / GLOW_CELL), asked || this.glowStale);
    // Asked and answered: a picture back, or one on its way. What the renderer can't take yet, it says it owes once it can, as `glowPending`,
    // so an answer that left something out isn't asked again every frame.
    if (got || this.renderer.glowPending) (this.glowStale = false), (this.glowAt = performance.now());
    if (got) {
      setGlow({ ...got, cell: GLOW_CELL, gain: GLOW_GAIN });
      // What they light catches up on the next frame.
      if (this.emit(got)) return true;
    }
    return this.renderer.glowPending || this.glowStale;
  }

  /**
   * What glows on each device, as lights for the others: a screen lights the knobs on the desk beside it. Each device's glow is
   * cut in two along its longer spread, and again, into as many patches as a device is lit by lights, and each patch gives off
   * all its glow over a disc as big as it covers. Only a change worth seeing is passed on, as each one relights what's round it.
   */
  private emit(g: Glow<GlowShot & { d: Device; r: DOMRect }>): boolean {
    const out: Emitter[] = [], c = GLOW_CELL, area = c * c;
    for (const { d, r } of g.shots) {
      const from = d.plate;
      if (!d.visible || !from.tex?.E || this.asleep(d)) continue;
      const x0 = Math.max(0, Math.floor(r.left / c)), x1 = Math.min(g.w, Math.ceil(r.right / c));
      const y0 = Math.max(0, Math.floor(r.top / c)), y1 = Math.min(g.h, Math.ceil(r.bottom / c));
      const at = [r.left, r.top, r.right, r.bottom, g.w, g.h], was = d.gave;
      if (was && was.plate === from && was.at.every((v, k) => v === at[k])) {
        let same = true;
        for (let y = y0, k = 0; same && y < y1; y++)
          for (let i = (y * g.w + x0) * 4, end = (y * g.w + x1) * 4; i < end; i++, k++)
            if (g.data[i] !== was.cells[k]) {
              same = false;
              break;
            }
        if (same) {
          out.push(...was.out);
          continue;
        }
      }
      const cells: number[] = [], under = new Uint8Array(Math.max(0, x1 - x0) * Math.max(0, y1 - y0) * 4);
      for (let y = y0; y < y1; y++) {
        under.set(g.data.subarray((y * g.w + x0) * 4, (y * g.w + x1) * 4), (y - y0) * (x1 - x0) * 4);
        for (let x = x0; x < x1; x++) {
          const i = (y * g.w + x) * 4;
          if (g.data[i]! + g.data[i + 1]! + g.data[i + 2]! > 2) cells.push(i);
        }
      }
      const gave: Emitter[] = [];
      d.gave = { plate: from, at, cells: under, out: gave };
      const col = (i: number) => (i / 4) % g.w, row = (i: number) => Math.floor(i / 4 / g.w);
      // Cut where the device is cut, not where its glow is, so a patch stays put as what's on a screen moves about in it.
      const patch = (cells: number[], x0: number, y0: number, x1: number, y1: number, cuts: number): void => {
        if (!cells.length) return;
        if (cuts) {
          const across = x1 - x0 >= y1 - y0, mid = across ? (x0 + x1) / 2 : (y0 + y1) / 2, at = across ? col : row;
          const a = cells.filter(i => at(i) + 0.5 < mid), b = cells.filter(i => at(i) + 0.5 >= mid);
          if (across) return (patch(a, x0, y0, mid, y1, cuts - 1), patch(b, mid, y0, x1, y1, cuts - 1));
          return (patch(a, x0, y0, x1, mid, cuts - 1), patch(b, x0, mid, x1, y1, cuts - 1));
        }
        let f = 0, fx = 0, fy = 0, fxx = 0, fyy = 0, fxy = 0;
        const rgb = [0, 0, 0];
        for (const i of cells) {
          const v = (g.data[i]! + g.data[i + 1]! + g.data[i + 2]!) / 3, x = col(i) + 0.5, y = row(i) + 0.5;
          for (let k = 0; k < 3; k++) rgb[k]! += g.data[i + k]!;
          f += v, fx += v * x, fy += v * y, fxx += v * x * x, fyy += v * y * y, fxy += v * x * y;
        }
        if (!f) return;
        // Spread in cells, each a square, not a point.
        const mx = fx / f, my = fy / f, vx = fxx / f - mx * mx + 1 / 12, vy = fyy / f - my * my + 1 / 12, cxy = fxy / f - mx * my;
        // A disc of even glow as spread out as this has a radius twice the square root of its spread's: what it gives off, over that.
        const disc = 4 * Math.PI * Math.sqrt(Math.max(vx * vy - cxy * cxy, 1 / 144)), k = (GLOW_GAIN / 255) / disc;
        gave.push({ from, at: [mx * c, my * c], on: [mx * c - r.left, my * c - r.top], half: Math.sqrt((disc * area) / Math.PI), per: r.width / from.spec.cw || 1, color: rgb.map(v => v * k) as [number, number, number] });
      };
      patch(cells, r.left / c, r.top / c, r.right / c, r.bottom / c, 2);
      out.push(...gave);
    }
    this.renderer.emitters = out;
    return this.shift(out);
  }

  /**
   * Which glows changed since what they light was last lit for them, as relights what's round them. A glow that goes out of the
   * window, or whose device gave back what it drew, still shines as it did, so only one that can be read now says whether it changed:
   * a camera bringing a page of screens back into view has nothing to relight.
   */
  private shift(out: Emitter[]): boolean {
    const c = GLOW_CELL, on = new Map<Plate, Emitter[]>(), moved: Emitter[] = [];
    for (const e of out) on.get(e.from)?.push(e) ?? on.set(e.from, [e]);
    for (const d of this.devices) {
      const from = d.plate;
      if (!d.visible || !from.tex || this.asleep(d)) continue;
      const now = on.get(from) ?? [], then = d.shone;
      if (!now.length && !then.length) continue;
      // A device that's stopped glowing has nothing to say how big it's shown but its box.
      if (alike(whole(now), whole(then), Math.min(from.spec.cw, from.spec.ch), now[0]?.per ?? this.box(d).width / from.spec.cw, c)) continue;
      // Measured from what it was when what it lights was last lit, so a slow change still comes through.
      d.shone = now;
      moved.push(...then, ...now);
    }
    if (!moved.length) return false;
    this.glowMoved.push(...moved);
    return true;
  }

  /** What a device has to have lit again for the flashes and flames as they are now: where they reach on it, and where they did. */
  private pointsOn(d: Device): void {
    let box: Box | null = null;
    if (this.points!.all.length) {
      const r = this.box(d), z = r.width / d.cw || 1;
      this.points!.near(r.left, r.top, r.left + d.cw * z, r.top + d.ch * z, ({ at: [x, y], far: reach, from, flat }) => {
        if (from === d.plate) return;
        // A glow reaches as far as it lights the tallest thing on this device: 4 css px to the mm.
        const far = flat ? flatFar(flat, d.plate.peak * 4 * z) : reach;
        const x0 = Math.max((x - far - r.left) / z, 0), y0 = Math.max((y - far - r.top) / z, 0);
        const x1 = Math.min((x + far - r.left) / z, d.cw), y1 = Math.min((y + far - r.top) / z, d.ch);
        if (x1 > x0 && y1 > y0) box = join(box, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      });
    }
    // Where every light reaches is kept, to relight once they move away. A few glows that changed leave that as it was.
    const need = this.pointsAll ? join(d.pointBox, box) : box;
    if (this.pointsAll) d.pointBox = box;
    if (!need) return;
    if (!d.lightDirty) d.lightBox = need;
    else if (d.lightBox) d.lightBox = join(d.lightBox, need);
    d.lightDirty = true;
  }

  /** Whether what a device shows was lit softer than it's shown, and is to be lit again. */
  private rough(d: Device): boolean {
    return d.plate.rough;
  }

  /** Whether the light on a device has changed. A torch moving elsewhere on the page leaves it as it is. */
  private touched(d: Device): boolean {
    if (d.lightDirty || (this.rough(d) && !this.sweeping && !this.sizing) || this.fullLight || this.lights || this.look || !this.torch || !d.plate.pool) return true;
    return this.renderer.poolMoved(d.plate, this.scene(), this.box(d));
  }

  /** A device that threw stays as it was, and the renderer as the next one expects. Returns what to say about it. */
  private abandon(d: Device, e: unknown, version: number): string {
    const drawing = this.renderer.recover(), el = d.list.find(p => drawing && p.commands?.includes(drawing))?.el ?? this.blamed ?? d.el;
    d.failed = version;
    this.blamed = null;
    return thrown(el, e);
  }

  /**
   * The device in focus, which alone is live when `live` is `one`: the one last pressed while it's shown, and failing that the one nearest
   * the window's middle. None when `fixed`. A body is its front, which holds its faces.
   */
  focused(): Device | null {
    if (this.live === 'full' || this.live === 'fixed') return null;
    if (this.focusAt === 0) return this.focusIs;
    let f = this.pressed?.visible && !this.away(this.pressed) ? this.pressed : null;
    if (!f) {
      // Of those as near, the smallest, as with the hand: one laid behind others covers the middle too.
      let least = Infinity, size = Infinity;
      const mx = innerWidth / 2, my = innerHeight / 2;
      for (const d of this.devices) {
        if (!d.visible || d.front || this.away(d)) continue;
        const r = this.where(d), dx = Math.max(r.left - mx, 0, mx - r.right), dy = Math.max(r.top - my, 0, my - r.bottom), far = dx * dx + dy * dy, area = r.width * r.height;
        if (far < least || (far === least && area < size)) { least = far; size = area; f = d; }
      }
    }
    this.focusAt = 0;
    return (this.focusIs = f);
  }

  /** Whether a device is live: all are when `live` is `full`, its focus's body when `one`, and none when `fixed`. */
  isLive(d: Device): boolean {
    if (this.live === 'full') return true;
    const f = this.focused();
    return !!f && (d.front ?? d) === f;
  }

  /** The GPU ran short: one fewer is live, if there's a step left and the last one has had time to give back. Says whether it stepped. */
  private liveLess(): boolean {
    const i = LIVES.indexOf(this.live), now = performance.now();
    if (i >= LIVES.length - 1) return false;
    if (now - this.livedAt < LIVE_STEP_MS) return true;
    this.live = LIVES[i + 1]!;
    this.livedAt = now;
    this.focusAt = -1;
    return true;
  }

  /** The smallest device the hand is over, or near. Something nothing can point at, such as a page's wall, is never it. */
  private under(): Device | null {
    const { tx, ty } = this.pointer;
    let found: Device | null = null, least = Infinity;
    for (const d of this.devices) {
      if (!d.visible || this.away(d)) continue;
      const r = this.where(d), area = r.width * r.height;
      if (area >= least || tx < r.left - HAND_ROOM || tx > r.right + HAND_ROOM || ty < r.top - HAND_ROOM || ty > r.bottom + HAND_ROOM) continue;
      if (getComputedStyle(d.el).pointerEvents === 'none') continue;
      found = d;
      least = area;
    }
    return found;
  }

  /**
   * Eases the device under the hand toward the lamp and every other back to its own light. Only those with some share
   * of it relight, so moving a pointer costs one device, however much is on the page. Says if any are still going.
   */
  private follow(dt: number, moved: boolean, now: number): boolean {
    const P = this.pointer, over = this.carried ? null : this.under();
    let going = false, owed = false;
    for (const d of this.devices) {
      // Coming back lights it anyway.
      if (!d.visible) {
        d.hand = 0;
        continue;
      }
      const placed = !!this.lampFor && !!this.lampFor(d.el.getBoundingClientRect(), P.x, P.y);
      // What isn't live is lit where the lamp rests.
      const by = ((this.carried || d === over || placed) && this.isLive(d) ? P.ti : 0) - d.hand;
      if (by) {
        d.hand = Math.abs(by) > 0.004 ? d.hand + by * (1 - Math.exp(-dt * 5)) : d.hand + by;
        going = true;
      }
      // A lamp not due on this one yet waits, and the frame comes again for it. What moved while it waited is owed, so where the pointer
      // eased to last is lit even once it's still.
      if (by || (d.hand && moved) || d.lampOwed) {
        const hz = this.lampHzOf?.(d.el) ?? this.lampHz;
        if (hz && now - (d.lampAt ?? -Infinity) < 1000 / hz - 4) d.lampOwed = owed = true;
        else {
          d.lightDirty = true;
          d.lightBox = null;
          d.lampAt = now;
          d.lampOwed = false;
        }
      }
      d.plate.lampOwed = !!d.lampOwed;
    }
    this.lampOwed = owed;
    return going || owed;
  }

  /** Eases each device toward the way a hand has turned it, quickly while held and slowly home. Says if any are still going. */
  private turned(dt: number): boolean {
    let going = false;
    for (const d of this.devices) {
      const by = d.spun - d.spinning;
      if (d.faces.length && (by || d.whipped || d.hush)) {
        const was = d.spinning;
        // One nobody's seen yet is just lying that way, as a body that arrives turned does.
        if (this.reduced.matches || !d.visible || !(d.showing ?? d).shown || Math.abs(by) < 0.002) d.spinning = d.spun;
        else {
          d.spinning += by * (1 - Math.exp(-dt * (this.cards ? CARD_PACE : 11)));
          going = true;
        }
        // Each face counts from straight on, so the one turned away is past a right angle.
        const off = (a: number) => {
          const t = Math.atan2(Math.sin(a), Math.cos(a));
          return Math.abs(t) < 1e-6 ? 0 : t;
        };
        const faces = this.turnable(d), round = (f: Device) => ROUND[f.facing ?? 'front'];
        const nearest = (t: number) => faces.reduce((a, b) => (Math.abs(off(t - round(b))) < Math.abs(off(t - round(a))) ? b : a));
        // The face it's going to is drawn first, either way it turns: woken by the turn, it has as long as the lean holds, and a little
        // more if it needs it, so a turn never comes round to a face still being sketched. One that can't be drawn in time comes as its sketch.
        const lean = (CARD_HELD * Math.PI) / faces.length, up = nearest(d.spinning), aim = nearest(d.spun), from = off(d.spinning - round(up));
        d.held = aim === up ? 0 : d.held + dt;
        const ready = (f: Device) => this.pictured(f) || d.held > CARD_WAIT;
        if (this.cards) {
          // Set off for another face, its shadow goes in under it first: till it has, it only leans, as far as a hand would take it.
          // It's down once it's back within that lean, long before the last of the turn eases out, and its shadow comes back out then.
          // One the stage showed goes off it to turn, and its shadow only goes in once the face that's up is drawn on its own canvas,
          // which is where it's copied from: till then it only leans, or its shadow would go out at once and come back half gone.
          d.whipped = aim !== up || (d.whipped && Math.abs(from) >= lean);
          const instant = this.reduced.matches || !d.visible || !(d.showing ?? d).shown, to = +d.whipped;
          d.hush = instant ? to : to ? (ready(up) ? Math.min(d.hush + dt / CARD_FADE, 1) : d.hush) : Math.max(d.hush - dt / CARD_RETURN, 0);
          if (d.hush !== to) going = true;
          if (aim !== up && (d.hush < 1 || !ready(aim)) && Math.abs(from) > lean) d.spinning += Math.sign(from) * lean - from;
        } else {
          // Lit again at each angle, it comes round to every face between, sides too, so it waits at each for the next one it comes to,
          // from the one it was on before this step, however far one long frame takes it.
          const on = nearest(was), way = Math.sign(d.spun - was), next = nearest(round(on) + way * ((2 * Math.PI) / faces.length)), past = off(d.spinning - round(on)) * way;
          if (aim !== on && next !== on && !ready(next) && past > lean) d.spinning = round(on) + off(was - round(on)) + way * (lean - off(was - round(on)) * way);
        }
        // The one nearest straight on is the one that shows, and has its page live.
        d.showing = nearest(d.spinning);
        d.over = d.showing !== d;
        d.el.toggleAttribute('data-over', d.over);
        if (d.showing.facing) d.el.setAttribute('data-up', d.showing.facing);
        else d.el.removeAttribute('data-up');
        // Held part way round is turning too: all that shows draws until it lies flat.
        d.turning = d.spinning !== d.spun || off(d.spinning - round(d.showing)) !== 0;
        d.el.toggleAttribute('data-turning', d.turning);
        // Dead edge on, one of each opposite pair is still up and the other away, or both would take the same half.
        const side = (a: number, up: boolean) => {
          const t = off(a), most = Math.PI / 2 - 1e-9;
          return up ? Math.sign(t) * Math.min(Math.abs(t), most) : Math.sign(t) * Math.max(Math.abs(t), Math.PI - most);
        };
        if (this.cards) this.dealt(d, faces);
        else {
          const front = Math.cos(d.spinning) >= 0, right = Math.cos(d.spinning - ROUND.right) >= 0;
          for (const f of faces) f.spin = side(d.spinning - round(f), f.facing === 'back' ? !front : f.facing === 'right' ? right : f.facing === 'left' ? !right : front);
          for (const face of faces) {
            face.lightDirty = true;
            face.lightBox = null;
          }
        }
      }
      const [ax, ay] = d.aim, dx = ax - d.turn[0], dy = ay - d.turn[1];
      if (!dx && !dy) continue;
      if (!d.visible) {
        d.aim = [0, 0];
        d.turn = [0, 0];
        continue;
      }
      const f = Math.hypot(dx, dy) > 0.002 ? 1 - Math.exp(-dt * (ax || ay ? 18 : 5)) : 1;
      d.turn = [d.turn[0] + dx * f, d.turn[1] + dy * f];
      d.lightDirty = true;
      d.lightBox = null;
      going = true;
    }
    return going;
  }

  /**
   * A body turned as cards: each face keeps the one picture of it lit straight on. Cards only pass for the body a little way round,
   * so a face only ever rocks a little. Past that the turn is a whip: what's up smears along the way it's going and catches the light,
   * and the next face is swapped in under the smear and rocks back to rest. What lies between is never seen, so nothing has to be right there.
   */
  private dealt(d: Device, faces: Device[]): void {
    // It lands only on `faces`, but whips past the others on the way.
    const all = [d, ...d.faces];
    for (const f of all) if (f.spin) {
      f.spin = 0;
      f.lightDirty = true;
      f.lightBox = null;
    }
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), round = (f: Device) => ROUND[f.facing ?? 'front'], t = d.spinning;
    // How far it is from the face that's up toward the next one, 0 to 1, where the swap is.
    const rest = t + wrap(round(d.showing ?? d) - t), way = Math.sign(t - rest) || 1;
    let gap = Math.PI * 2;
    for (const f of faces) for (const k of [-1, 0, 1]) {
      const c = (rest + wrap(round(f) - rest) + k * Math.PI * 2 - rest) * way;
      if (c > 1e-3) gap = Math.min(gap, c);
    }
    const u = Math.min(Math.abs(t - rest) / (gap / 2), 1);
    // Half across the body itself, inside any room its box keeps for lugs, and all the way through it, its back's layers too, css px.
    // The sides are as wide as that, so the cards meet at every corner.
    const half = d.owns[0] / 0.25 || d.el.offsetWidth / 2, deep = (d.axis * 2) / 0.25 || d.face / 0.25;
    const eye = Math.max(d.el.offsetWidth, d.el.offsetHeight) * CARD_BACK;
    // Held, it only leans, short of where the eye would see round its edge to the next face. Whipping, it rocks on to the swap.
    const held = Math.min(u / CARD_HELD, 1), whip = Math.max((u - CARD_HELD) / (1 - CARD_HELD), 0), lean = CARD_LEAN * Math.atan(half / eye);
    // Whipping past a face it doesn't land on, that one's up for its stretch of the way, rocked from one end of it to the other.
    const up = whip > 0 ? all.reduce((a, b) => (Math.abs(wrap(t - round(b))) < Math.abs(wrap(t - round(a))) ? b : a)) : d.showing ?? d;
    const passing = !faces.includes(up), by = wrap(t - round(up)), stretch = Math.PI / all.length;
    const shown = passing ? t - by + (by / stretch) * Math.min(CARD_ROCK, stretch) : rest + way * (lean * held + (Math.min(CARD_ROCK, gap / 2) - lean) * whip);
    // Its front stays where the page put it, whichever face that is, so a face that's up is just as it was at rest.
    const near = (deep / 2) * Math.cos(shown) ** 2 + half * Math.sin(shown) ** 2;
    d.el.style.perspective = `${eye}px`;
    // Each face it passes is at full speed from one end to the other.
    const ease = (a: number, b: number) => Math.min(Math.max(((passing ? 1 : u) - a) / (b - a), 0), 1) ** 2;
    // Each card keeps its shadow. Held, it only leans a few degrees, so its shadow hardly moves; whipping, it's smeared with the rest.
    const smear = ease(0.35, 1) * d.el.offsetWidth * CARD_SMEAR, glint = 1 + CARD_GLINT * ease(0.6, 1);
    let blur = this.whips.get(d);
    if (!blur && d.turning) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), filter = document.createElementNS(svg.namespaceURI, 'filter');
      const made = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      filter.id = `d-whip-${++this.whipped}`;
      filter.setAttribute('x', '-20%');
      filter.setAttribute('width', '140%');
      filter.append(made);
      svg.append(filter);
      svg.setAttribute('aria-hidden', 'true');
      Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
      document.body.append(svg);
      this.whips.set(d, (blur = made));
    }
    blur?.setAttribute('stdDeviation', `${smear.toFixed(1)} 0`);
    this.ground(d, near + half + deep);
    // The stage draws what of it it shows again each frame it turns.
    if (all.some(f => f.staged)) this.staleStage = true;
    for (const f of all) {
      Object.assign(f.el.style, { transformStyle: 'preserve-3d', isolation: 'auto' });
      const a = round(f) - shown, c = Math.cos(a), s = f.canvas.style;
      const end = f.facing === 'left' || f.facing === 'right', reach = end ? half : deep / 2;
      const ow = f.el.offsetWidth, oh = f.el.offsetHeight, mx = f.x + ow / 2, across = end ? ow / 2 : half;
      // Cut to the body, round its corners, as what it drew past it lies on the page: see `ground`. A side throws no shadow on the page,
      // and what it draws past its box is what it sees of the others, so it keeps all of it.
      const inset = [f.y, f.canvas.offsetWidth - mx - across, f.canvas.offsetHeight - f.y - oh, mx - across].map(v => `${Math.max(v, 0).toFixed(1)}px`).join(' ');
      const cut = end ? '' : `inset(${inset} round ${d.radius.toFixed(1)}px)`;
      if (!d.turning) {
        // Down: the one that's up as it was drawn, still cut to the body while its shadow comes back out on the page, and the rest out of the way.
        Object.assign(s, { transform: '', filter: '', clipPath: d.hush ? cut : '', opacity: f === d.showing ? '' : '0' });
        f.card = null;
        continue;
      }
      // Lit from the left and in front, so a face swung toward that brightens and one swung off it goes dim.
      const lit = c - 0.5 * Math.sin(a), gain = Math.min(Math.max(0.5 + 0.5 * lit, 0.45), 1.12) * glint;
      // Only the whip shows another face, smeared, so no two are ever seen to meet. The stage shows it with the same.
      const shows = c > 0.01 && (f === up || whip > 0);
      f.card = { gain, smear: smear > 0.2 ? smear : 0, shows };
      Object.assign(s, {
        transform: `translateZ(${-near}px) rotateY(${a}rad) translateZ(${reach}px)`,
        // About the middle of the body, which is the middle of the face's box, not its canvas: that's rounded up on one side.
        transformOrigin: `${mx}px ${f.y + oh / 2}px`,
        backfaceVisibility: 'hidden',
        filter: `${smear > 0.2 && blur ? `url(#${blur.parentElement!.id}) ` : ''}brightness(${gain.toFixed(3)})`,
        clipPath: cut,
        opacity: shows ? '' : '0',
      });
    }
  }

  /**
   * The page under a body turned as cards. The face that's up drew its shadow on the page, and that mustn't swing with the card: while it
   * turns, a copy of all it drew past the body lies flat, far enough back that every card stands over it, and grown to look the size it
   * was. Once the body sets off for another face it goes in under it and fades, as by `hush`, before the body whips; once the next face
   * is down, that one's comes back out from under it, and then the face shows its own again. A side throws none.
   */
  private ground(d: Device, back: number): void {
    let g = this.grounds.get(d);
    const f = d.showing ?? d, end = f.facing === 'left' || f.facing === 'right', from = f.canvas;
    if (!(d.turning || d.hush) || end || !from.width || !f.own) {
      if (g) {
        g.canvas.style.display = 'none';
        g.of = null;
      }
      return;
    }
    if (!g) {
      const canvas = document.createElement('canvas');
      canvas.dataset.d = '';
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none' });
      GROUNDS.add(canvas);
      d.el.prepend(canvas);
      this.grounds.set(d, (g = { canvas, of: null }));
    }
    const c = g.canvas, left = (f === d ? 0 : f.el.offsetLeft) - f.x, top = (f === d ? 0 : f.el.offsetTop) - f.y;
    if (g.of !== f) {
      g.of = f;
      c.width = from.width;
      c.height = from.height;
      const x = c.getContext('2d', ON_GPU)!, k = from.width / (from.offsetWidth || 1), half = d.owns[0] / 0.25 || f.el.offsetWidth / 2, mx = f.x + f.el.offsetWidth / 2;
      x.drawImage(from, 0, 0);
      // The body itself is the card's. Under it the shadow carries on as it is at each edge, so where the card turned narrower the page
      // goes on dark up to it, not bare.
      const x0 = Math.floor((mx - half) * k), x1 = Math.ceil((mx + half) * k), y0 = Math.floor(f.y * k), h = Math.ceil(f.el.offsetHeight * k), mid = Math.round(mx * k);
      x.clearRect(x0, y0, x1 - x0, h);
      if (x0 > 0) x.drawImage(from, x0 - 1, y0, 1, h, x0, y0, mid - x0, h);
      if (x1 < c.width) x.drawImage(from, x1, y0, 1, h, mid, y0, x1 - mid, h);
      Object.assign(c.style, { left: `${left}px`, top: `${top}px`, width: `${from.offsetWidth}px`, height: `${from.offsetHeight}px` });
    }
    // Pushed back it would look smaller, so it grows by as much about where the eye looks from. Going in, it shrinks till what it
    // reached past the body lies under it.
    const eye = Math.max(d.el.offsetWidth, d.el.offsetHeight) * CARD_BACK, ow = d.el.offsetWidth, oh = d.el.offsetHeight;
    const under = Math.min(ow / (from.offsetWidth || ow), oh / (from.offsetHeight || oh)), shrink = 1 - d.hush * (1 - under);
    Object.assign(c.style, {
      display: '',
      transformOrigin: `${ow / 2 - left}px ${oh / 2 - top}px`,
      transform: `translateZ(${-back}px) scale(${((eye + back) / eye) * shrink})`,
      opacity: `${(1 - d.hush).toFixed(3)}`,
    });
  }

  /** Whether what shows of a face holds a picture of it: the stage's, or its own canvas's. */
  private pictured(f: Device): boolean {
    return f.staged ? f.shown : f.own;
  }

  /** The faces a hand can turn a body onto: all of them, or turned as cards without sides, its front and back, unless it's been set on a side. */
  private turnable(d: Device): Device[] {
    const faces = [d, ...d.faces], end = (f: Device) => f.facing === 'left' || f.facing === 'right';
    return this.cards && !this.sides && !end(d.showing ?? d) ? faces.filter(f => !end(f)) : faces;
  }

  /** Whether this is the face of a body that's turned away and at rest, which shows nothing and needs no light. */
  private away(d: Device): boolean {
    const body = d.front ?? d, shown = body.showing ?? body, end = (f: Device) => f.facing === 'left' || f.facing === 'right';
    // On a side, front and back lie edge on, and what stands off them, as a lens does, is still there to see.
    return (!body.turning && shown !== d && !(end(shown) && !end(d))) || this.hidden(d);
  }

  /** Whether the page's own style hides a device's canvas. A face is its body's to show as it turns, and one hidden for being far is
   * still taken to show, as what it shows can't be read until it's back. */
  private hidden(d: Device): boolean {
    return (d.hid ??= !d.front && getComputedStyle(d.canvas).visibility !== 'visible' && !d.el.closest(HIDDEN_FAR));
  }

  /** What marks how `el` is seated or turned changed, which may show or hide it and any device in it: each is asked again, and one that
   * shows now wakes. */
  private reseen(el: HTMLElement): void {
    for (const e of [el, ...el.querySelectorAll<HTMLElement>('d-device')]) {
      const d = deviceOf(e);
      if (!d || d.hid === null) continue;
      const was = d.hid;
      d.hid = null;
      if (was && !this.hidden(d)) {
        this.stir(d);
        this.schedule();
      }
    }
  }

  /** A face turned away is as good as off the page, until a hand comes near. So a back nobody turns to is never drawn. */
  /** Out of sight with no face of its own up instead: nothing of it is drawn for anyone to see. A body turned to another face isn't, as that face is it. */
  private unseen(d: Device): boolean {
    return !d.showing && this.away(d);
  }

  private asleep(d: Device): boolean {
    return !!d.slept || (this.away(d) && !(d.front ?? d).handy && d !== this.making);
  }

  /** All a light pass needs to know that isn't about one device. */
  private scene(): Scene {
    return {
      carried: this.carried, all: this.lightDirty, full: this.fullLight, sweeping: this.sweeping, sizing: this.sizing, tilt: this.tilt, look: this.look, lights: this.lights, ambient: this.ambient, torch: this.torch,
      handheld: this.handheld, lighting: this.lighting, pointer: this.pointer, lampFor: this.lampFor, width: innerWidth, height: innerHeight, ratio: devicePixelRatio,
    };
  }

  private tick = (now: number, forced = false): void => {
    this.raf = 0;
    if (this.renderer.lost) return;
    if (!forced && this.renderer.held()) {
      this.stats.held++;
      if (this.renderer.late()) this.behind = true;
      this.schedule();
      return;
    }
    this.renderer.begin(forced, now - this.scrollAt > 200);
    this.weigh();
    this.frame(now);
  };

  /** Everything that's due, drawn now. */
  private frame(now: number): void {
    // A flush can run ahead of the animation clock, so the next step may start in the past.
    const dt = Math.max(0, Math.min(this.last ? (now - this.last) / 1000 : 1 / 60, 1 / 30));
    this.last = now;
    // Focus is worked out again each frame: what's in the middle changes with what's shown, not only with what moves.
    this.focusAt = -1;
    this.judge();
    let again = this.scrolled;

    const P = this.pointer;
    const dx = P.tx - P.x, dy = P.ty - P.y, di = P.ti - P.i;
    const moved = Math.abs(dx) + Math.abs(dy) > 0.3 || Math.abs(di) > 0.004;
    if (moved) {
      const f = 1 - Math.exp(-dt * 7);
      P.x += dx * f;
      P.y += dy * f;
      P.i += di * (1 - Math.exp(-dt * 5));
      // A torch and a moving viewer reach the whole page. The lamp only reaches what's following it.
      if (this.torch || this.look) this.lightDirty = true;
      again = this.sweeping = true;
    } else this.sweeping = this.scrolled;
    if (this.lights && (moved || this.lampOwed || this.handsDue || this.handShifted)) {
      this.handsDue = this.follow(dt, moved || this.handShifted, now);
      this.handShifted = false;
      // A hand's light easing onto what's under it relights that one device. It isn't the page moving, so arriving and sharpening
      // keep their whole budget: a zoom that stops leaves a new device under a still pointer, and its light takes a second to come.
      if (this.handsDue) again = true;
    }
    if (this.turnsDue) {
      this.turnsDue = this.turned(dt);
      if (this.turnsDue) again = this.sweeping = true;
    }
    this.scrolled = false;
    // A flame never holds still, though nothing about one is quicker than the eye.
    if (this.torch && TORCHES[this.handheld].flicker && !this.reduced.matches) {
      if (now - this.flickered >= FLICKER) {
        this.flickered = now;
        this.lightDirty = true;
      }
      again = this.sweeping = true;
    }

    // A flash or flame changing is a light moving, so it's lit as a moving torch is: cheaply, in turns, and sharp once it stops.
    // A glow that changed relights only the little it reaches, and does it properly, as a screen changes all the time.
    if (this.lightPoints()) {
      again = true;
      if (this.pointsAll) this.sweeping = true;
    }

    // Whatever moved the page since it was last read, this frame included, has every box read again, once. A camera in flight
    // or anything animating round a device moves them all the time.
    // A scroll is told on the next update, and a frame can come before that.
    const told = this.page?.takeRecords();
    if (told?.length) this.changed(told);
    if (this.animating() || scrollX !== this.scrolledTo[0] || scrollY !== this.scrolledTo[1]) this.moves++;
    this.scrolledTo = [scrollX, scrollY];

    let worked = false, fault: Error | null = null;
    const version = partsVersion(), began = performance.now(), turns: Device[] = [];
    let started = false, stirring = 0, beating = false;
    const onBeat = now - this.beatAt >= STIR_BEAT;
    // As many as the GPU turned out to manage: fewer as soon as it falls behind, and slowly more while it doesn't.
    if (this.sweeping) this.room = this.behind ? Math.max(this.room * 0.8, ROOM_LEAST) : Math.min(this.room + 0.1, ROOM_MOST);
    this.behind = false;
    // What's arriving goes first: something painting every frame would otherwise spend the frame before it got a turn, every frame.
    // Of those waiting to be sharper, what's biggest and nearest the middle of the window goes first, as an eye would look.
    // Only what has something due, unless what's due is everyone's: the light, the parts, a flash or a turn. A camera moving gives
    // nothing at rest anything to do until it stops, and what it owes them then says so as it's set; the frame after takes everyone.
    const all = this.lightDirty || this.fullLight || version !== this.quietAt || !!this.points || this.sweeping || this.turnsDue;
    const due = all ? [...this.devices] : [...this.devices].filter(d => !d.quiet);
    this.quietAt = version;
    const near = new Map<Device, number>();
    for (const d of due) {
      if (!d.sharpen || !d.visible) continue;
      const r = this.where(d), off = Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
      near.set(d, off / Math.max(Math.sqrt(r.width * r.height), 1));
    }
    // And of the rest, what moved longest ago, so what's moving takes turns.
    const order = due.sort((a, b) => +this.held(a) - +this.held(b) || +a.sharpen - +b.sharpen || (near.get(a) ?? 0) - (near.get(b) ?? 0) || a.stirred - b.stirred);
    // While nothing moves there's no frame to keep up, so more of it goes to arriving and sharpening.
    const budget = this.sweeping || this.sizing ? BUDGET_MOVING : BUDGET_STILL;
    // Whatever is on its way shows its outlines first, which cost no GPU: a page arriving is drawn whole at once, then filled in.
    for (const d of order) {
      if (this.held(d)) break;
      // Only what's in the window: what's kept near it arrives before it's seen. Under a veil that shows none of it, nobody would see them.
      // A face of a body that's already here isn't arriving: a turn holds for its picture, which a sketch would only show flat under.
      if (!d.visible || d.shown || d.front?.shown || this.sketched.has(d) || d.failed === version || this.asleep(d) || !this.shown(d, d.el) || !this.veiled(d)) continue;
      if (performance.now() - began > SKETCH_SLICE) {
        again = true;
        break;
      }
      this.sketched.add(d);
      this.sketch(d);
    }
    for (const d of order) {
      // A flash or a glow lights what's out of the window too, which is lit for it when it comes back.
      if (this.points && !d.visible && (d.pointBox || this.points.all.length)) this.pointsOn(d);
      if (!d.visible || d.failed === version) continue;
      // A face turned away waits for a hand near it, or a turn, which take it up again.
      // Nothing of it is read while it's away either: that's when it comes round, and taken up again it asks.
      if (this.asleep(d)) {
        d.quiet = true;
        d.unread = false;
        continue;
      }
      // Awake, it's quiet only as long as the end of its frame finds nothing due, whatever it was before: a face come round from asleep
      // with springs still to read is left out of every frame that doesn't take all, and would wait for ever.
      d.quiet = false;
      if (this.points && (d.pointBox || this.points.all.length)) this.pointsOn(d);
      // Given back to make room, a device still shows what it last drew, and that stands until something about it has to be drawn again.
      // One with springs still to read gave its maps back to wait its turn, and asks for it each frame, as only its own read takes the
      // turn from a reader that has stopped coming by, scrolled off as this one came on. Asking is all: it isn't laid out or drawn till
      // its turn comes, when it's drawn again whole to have them.
      if (!this.held(d) && d.placed && this.standing(d, version)) {
        if (d.unread && this.player && (d.unread = this.read(d))) this.readTimer ||= window.setTimeout(() => { this.readTimer = 0; this.schedule(); }, 0);
        // It stands, with nothing due but its turn to read.
        d.quiet = !d.unread;
        if (!d.unread || this.reader !== d) continue;
      }
      // A device arriving is the dearest thing there is, and one waiting only to be sharper shows what it had meanwhile, so either
      // waits for a frame with room for what it cost last time (one never drawn, what others arriving did), and a frame stays a frame.
      // The first always goes, so something always moves.
      const dear = !this.held(d) || d.sharpen, arriving = !this.held(d), t = performance.now();
      // Drawn smaller, it costs less, down to what drawing anything costs.
      const guess = d.cost ? d.cost * (d.sharpen ? Math.min(Math.max(d.toward, LEAST_COST), 1) : 1) : this.arriving;
      if (dear && started && t - began + guess > budget) {
        again = true;
        continue;
      }
      if (dear) started = true;
      try {
        if (this.renderer.making(d.plate)) {
          again = true;
          continue;
        }
        if (d.plate.stood) d.materialDirty = true;
        if (d.layoutDirty || !d.placed || d.version !== version) this.layout(d);
        else if (d.viewDirty || !this.held(d)) this.layout(d, true);
        let going = false, small = false;
        if (d.movers.some(m => m.p.def.tick || m.springs.some(s => s.active))) {
          // Too small to work by hand, and no hand or keys on it: it moves on with the others on the beat, by all the time since.
          const r = this.where(d);
          const size = Math.max(r.width, r.height), every = STIR_BEAT * Math.min(Math.ceil(AWAKE / Math.max(size, 1)), STIR_BEATS);
          small = d.small = size < AWAKE && !d.used;
          if (small && (!onBeat || now - d.stepped < every - STIR_BEAT / 2)) beating = true;
          else {
            const step = small && d.stepped ? Math.min((now - d.stepped) / 1000, (STIR_BEAT * STIR_BEATS) / 1000) : dt;
            d.stepped = now;
            this.ticking = d;
            this.tickAsked = false;
            for (const { p, springs } of d.movers) {
              for (const s of springs) {
                if (!s.active || this.pinned === s) continue;
                if (s.step(step, this.reduced.matches)) going = true;
                d.moving.add(p);
              }
              this.blamed = p.el;
              if (p.def.tick?.(p, step)) {
                d.moving.add(p);
                going = true;
              }
            }
            this.ticking = null;
            // A tick that moved nothing and asked for nothing waits to be told: by its springs, its markup, or a frame asked for it.
            d.ticked = going || this.tickAsked;
          }
        }
        // Kept near the window is for painting ahead, and anything moving there can wait. `view` wakes it.
        if (going && (again || this.shown(d, d.el))) {
          if (small) beating = true;
          else again = true;
        }
        // What others read as they paint moves all of them, and what they drew decides what that came to.
        if ([...d.moving].some(p => p.def.spreads)) for (const p of d.list) d.moving.add(p);
        // Another face of its body was painted again, and what it sees of that edge-on is out of date.
        if (!d.materialDirty && this.renderer.edgesStale(d.plate)) d.materialDirty = d.plate.reedge = true;
        // Canvases reach past their devices for the shadows, so something can be moving just out of sight.
        if (d.materialDirty || d.remake) {
          this.paint(d);
          d.moving.clear();
        } else if (d.moving.size && this.shown(d, d.el)) {
          // What moves on something too small to work by hand moves by less than a pixel a frame, mostly. All of those share a little
          // of the frame, the longest waiting first, and the rest show what they last drew for a frame or two more. So a page of a
          // thousand ticking watches costs what a few do, and one shown big enough to use moves every frame, as it did.
          const r = this.where(d), small = Math.max(r.width, r.height) < AWAKE;
          if (small && stirring > STIR_SLICE) again = true;
          else {
            const t = performance.now();
            // The back draws what stands clear of the front too.
            if (d.reverse && [...d.moving].some(p => p.el.closest('[back]'))) d.reverse.materialDirty = true;
            this.paint(d, d.moving);
            d.moving.clear();
            d.stirred = t;
            if (small) stirring += performance.now() - t;
          }
        }
        // Asked for on a timer, not as part of this frame's work: a frame owed to it would keep the page from ever being still.
        if (this.player && !going && (d.unread = this.read(d))) this.readTimer ||= window.setTimeout(() => { this.readTimer = 0; this.schedule(); }, 0);
        // A paint that found the canvas too small stopped short, so it takes one more go.
        while (d.layoutDirty) {
          this.layout(d);
          this.paint(d);
        }
        // What it drew the other faces of its body see edge-on, so they catch up at rest, not on the next turn.
        const body = d.front ?? d;
        if (d.body && [body, ...body.faces].some(f => f !== d && f.visible && !this.asleep(f) && this.renderer.edgesStale(f.plate))) again = true;
        this.blamed = null;
        if (d.plate.wanted && !d.plate.stood) {
          again = true;
          continue;
        }
        // Turned as cards, a face away is lit straight on like any other and only hidden, so it's ready before a whip shows it.
        if (this.away(d) && !this.cards) {
          // What it showed was at some angle on the way here, and the next turn would show that before it's lit again.
          if (!d.lightDirty) d.ctx.clearRect(0, 0, d.canvas.width, d.canvas.height);
          d.own = false;
          d.lightDirty = true;
        }
        else if (d.lightDirty || this.lightDirty || (this.rough(d) && !this.sweeping && !this.sizing)) {
          // A moving light only lights what's in view. A device's shadow reaches further, and catches up when it stops.
          if (!this.shown(d, this.sweeping ? d.el : undefined)) {
            d.lightDirty = true;
            d.lightBox = null;
          } else if (this.touched(d)) {
            turns.push(d);
          }
        }
        // Tracing that out is the one long job in a layout, and no hand is on something being resized, or on one asleep, which a hand
        // coming near wakes first: a page of thousands shown small traces only what a hand comes to.
        // What's on its way somewhere waits to get there. What only goes round where it is, as a platter coming up to speed, changes nothing a hand can reach.
        if (d.reachDirty && !this.sizing && !this.sleepers.has(d) && !d.movers.some(m => m.p.shifted && m.springs.some(s => s.active))) reachFor(d, this.reachCanvas);
        if (this.restful(d, version)) d.quiet = true;
      } catch (e) {
        this.ticking = null;
        const said = this.abandon(d, e, version);
        if (this.strict) fault ??= new Error(said, { cause: e });
        else warnOnce(said, 'error');
      } finally {
        // A turn that only found its maps still being made says nothing about what drawing costs.
        const cost = performance.now() - t;
        if (dear && cost > 0.5) {
          d.cost = cost;
          d.toward = 1;
          if (arriving) this.arriving += (cost - this.arriving) * 0.2;
        }
      }
    }
    // Each copy out to a device's canvas costs about the same however small the device, so a light crossing a page full of
    // them takes turns. Near the hand and big goes first, and whoever has waited longest catches up. At rest it's the frame's budget
    // that says how many, by what each cost lately, so a camera stopping over a thousand devices lights them over a few frames, not in one.
    const room = this.sweeping ? this.room : Math.max(ROOM_MOST, budget / this.lightEach);
    if (turns.length > room) {
      const hand = (d: Device) => {
        const r = this.where(d);
        return P.x >= r.left && P.x <= r.right && P.y >= r.top && P.y <= r.bottom ? UNDER_HAND : 1;
      };
      // The faces of a body go together, or a turn would show each at a different angle.
      const body = (d: Device) => d.front ?? d, rank = new Map(turns.map(d => [d, Math.sqrt(body(d).pw * body(d).ph) * (body(d).waited + 1) * hand(body(d))]));
      turns.sort((a, b) => rank.get(b)! - rank.get(a)!);
      const bodies = new Set<Device>(), kept = turns.filter(d => (bodies.has(body(d)) || bodies.size < Math.floor(room)) && !!bodies.add(body(d)));
      for (const d of turns.filter(d => !kept.includes(d))) {
        d.lightDirty = true;
        d.lightBox = null;
        d.waited++;
        again = true;
      }
      turns.splice(0, turns.length, ...kept);
    }
    // What this frame lights stays on the GPU through it, whatever the store gives back to make room.
    for (const d of turns) this.renderer.store.use(d.plate);
    // What glows changes only when it's painted, which is taken up below. A device lit again only because the light moved gives off
    // the same, unless it moved, as it's lit again when it does.
    for (const d of turns) {
      if (!d.plate.tex?.E) continue;
      const r = this.box(d), at = `${r.left},${r.top},${r.width},${r.height}`;
      if (at !== d.glowedAt) (this.glowStale = true), (d.glowedAt = at);
    }
    if (turns.length) {
      const lit = performance.now();
      const lighting = (d: Device) => d.el.getAttribute('lighting') ?? this.lighting;
      this.renderer.lightAll(turns.map(d => ({ d, plate: d.plate, ctx: d.staged ? null : d.ctx, rect: this.place(d), lighting: lighting(d) })), this.scene(), ({ d }) => {
        d.lightDirty = false;
        d.lightBox = null;
        d.waited = 0;
        worked = true;
        if (!d.shown) {
          d.shown = true;
          d.el.dispatchEvent(new Event('pictured', { bubbles: true }));
          this.unsketch(d);
        }
        if (d.staged) {
          this.staleStage = true;
          if (d.canvas.width) this.vacate(d);
        } else {
          d.own = true;
          this.left(d);
        }
        // Its canvas shows its markup as it is now, for anything waiting to hand over to it.
        d.el.dispatchEvent(new Event('lit'));
      }, ({ d }, e) => {
        const said = this.abandon(d, e, version);
        if (this.strict) fault ??= new Error(said, { cause: e });
        else warnOnce(said, 'error');
      });
      this.lightEach += ((performance.now() - lit) / turns.length - this.lightEach) * 0.2;
    }
    if (this.lightDirty || this.fullLight) this.lightChanges++;
    this.lightDirty = this.fullLight = false;
    if (this.renderer.glowDrawn) (this.glowStale = true), (this.renderer.glowDrawn = false);
    if (this.glowOut()) again = true;
    if (onBeat) this.beatAt = now;
    // Copies to devices of their own pass through the stage, so a frame with any draws it again.
    if (this.stage && (this.staleStage || (turns.length && turns.some(d => !d.staged)))) this.showStage();
    if (worked) this.stats.frames++;
    // What it made is asked after next frame, once the GPU has taken it in, so there is one.
    if (this.renderer.end()) again = true;
    if (again) this.schedule();
    else {
      this.last = 0;
      // Only what's small is moving: the next frame is on the beat.
      if (beating) this.onBeat();
    }
    // Last, so one device failing leaves every other drawn and the next frame on its way.
    if (fault) throw fault;
  }
}

let engine: Engine | null = null;

export function getEngine(): Engine {
  return (engine ??= new Engine());
}


/** What in a style changes how a device is seen rather than where: anything that turns, fades, clips or filters it. */
const LOOKS = /(?:^|;)\s*(transform|translate|rotate|scale|opacity|filter|clip-path|mask[\w-]*|visibility|mix-blend-mode|perspective|overflow[\w-]*)\s*:[^;]*/g;
const looks = (style: string | null) => (style?.match(LOOKS) ?? []).join(';');

const deviceOf = (el: Element) => (el.closest('d-device, [data-alone]') as (Element & { __d?: Device }) | null)?.__d;

/** The part an element is, if it has been laid out in a device. */
export function partOf(el: Element): Part | undefined {
  return deviceOf(el)?.parts.get(el as HTMLElement);
}

/** What `light-dark()` would give around a device, which keeps a scheme of its own for its screens. `color-scheme: light dark` leaves it to the reader's system. */
function schemeOf(el: Element): Scheme {
  const said = getComputedStyle(el.parentElement ?? el).colorScheme;
  return said.includes('dark') && (!said.includes('light') || matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

/** Repaints the device around `el`, for a change the engine cannot see that reaches more than one part. */
export function repaint(el: Element): void {
  const d = deviceOf(el);
  if (!d) return;
  d.materialDirty = true;
  getEngine().schedule();
}

/** How much a part was handled: its own `use`, or the nearest one round it inside its device. 1 is as much as the device as a whole. */
function useOf(p: Part, d: Device): number {
  const by = p.el.closest('[use]');
  const n = by && by !== d.el && d.el.contains(by) ? parseFloat(by.getAttribute('use')!) : 1;
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/** Draws the part at `el` again, for a change only it can see, and repaints no more than what that changed. */
export function redraw(el: Element): void {
  const d = deviceOf(el);
  if (d) getEngine().redraw(el, d);
}

/** Puts the device round `el` to sleep: it shows a still of what it last drew and gives back everything the GPU holds for it. See `Engine.sleep`. */
export function sleep(el: HTMLElement): void {
  getEngine().sleep(el);
}

/** Wakes the device round `el`, and comes back once it's drawn again. See `Engine.wake`. */
export function wake(el: HTMLElement): Promise<void> {
  return getEngine().wake(el);
}

/** Repaints every device inside `root`, for a change to what its parts read from round them, such as a theme. */
export function repaintWithin(root: Element): void {
  getEngine().repaintWithin(root);
}

export function configure(o: EngineOptions): void {
  const e = getEngine();
  if (o.tilt !== undefined) e.tilt = o.tilt;
  if (o.strict !== undefined) e.strict = o.strict;
  if (o.lights !== undefined) e.lights = o.lights;
  if (o.look !== undefined) e.look = o.look;
  if (o.ambient !== undefined) e.ambient = o.ambient;
  if (o.exposure !== undefined) e.exposure = o.exposure;
  if (o.torch !== undefined) e.torch = o.torch;
  if (o.handheld !== undefined) e.handheld = o.handheld;
  if (o.lighting !== undefined) e.lighting = o.lighting;
  if (o.relief !== undefined) e.relief = o.relief;
  if (o.lampHz !== undefined) e.lampHz = o.lampHz;
  if (o.live !== undefined) e.live = o.live;
  e.relight();
}
