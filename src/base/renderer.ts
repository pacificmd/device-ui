// Everything that turns commands into pixels. It knows sizes and commands, and takes nothing else from the page:
// see plate.ts for all that crosses. One WebGL context, rendered off-screen. Each device owns an ordinary 2D canvas
// in the DOM, and finished frames are copied there, so the browser scrolls them with the page.
import { unbent } from './bend.js';
import { breakDevice, panelKey, type Bytes, type Cover } from './broken.js';
import { extent, join, tallest } from './commands.js';
import { Recorder } from './draw.js';
import { FieldCache } from './fields.js';
import { Block, clampTexture, link, type Program } from './gl.js';
import { getMaterialDef } from './registry.js';
import type { Player } from './player/install.js';
import { getLighting, TORCHES } from './lighting.js';
import { Plate, type Picture, type Beam, type EngineStats, type PaintJob, type Painted, type PlateSpec, type Scene, type Seat, type Turn } from './plate.js';
import { Rooms } from './rooms.js';
import { Lens, screen } from './lens.js';
import { Sections } from './section.js';
import { Store } from './store.js';
import { setStage, stageLayers, type StageShot } from './stage-layers.js';
import { MAX_HEIGHT, NEAR, POINTS } from './shaders/light.js';
import { placeOf, pointLights } from './lights.js';
import { CONDITION_FS, MATERIAL_FS, MATERIAL_VS, OCCLUSION_FS, QUAD_VS, WEATHER_FS } from './shaders/material.js';
import { PANE_SIZE, PANES } from './shaders/room.js';
import type { Command, GlassCommand, ScreenCommand, SurfaceCommand } from './sheet.js';
import { bounds, fill, type FieldShape, type RectShape, type Shape, type Solid } from './shapes.js';
import type { Box } from './types.js';

export { DEBUG_VIEWS } from './shaders/light.js';

/** Grids for spreading what stands where, kept between raises so a big panel doesn't make new ones each time. */
let grid = new Uint8Array(0), line = new Uint8Array(0), ahead = new Uint8Array(0), behind = new Uint8Array(0);
function scratch(n: number): Uint8Array {
  if (grid.length < n) grid = new Uint8Array(n);
  grid.fill(0, 0, n);
  return grid.subarray(0, n);
}

/** Each cell of a w × h grid becomes the most in the square r cells round it: rows then columns, three steps a cell whatever r is (van Herk). */
function spread(g: Uint8Array, w: number, h: number, r: number): void {
  const k = 2 * r + 1, L = Math.max(w, h) + 2 * r;
  if (line.length < L) { line = new Uint8Array(L); ahead = new Uint8Array(L); behind = new Uint8Array(L); }
  const run = (n: number, start: number, step: number) => {
    // The line padded with r empty cells each side, in blocks of k: the most so far in its block, and the most still to come.
    const end = n + 2 * r;
    line.fill(0, 0, end);
    for (let i = 0; i < n; i++) line[i + r] = g[start + i * step]!;
    for (let j = 0; j < end; j++) ahead[j] = j % k && ahead[j - 1]! > line[j]! ? ahead[j - 1]! : line[j]!;
    for (let j = end - 1; j >= 0; j--) behind[j] = j % k !== k - 1 && j !== end - 1 && behind[j + 1]! > line[j]! ? behind[j + 1]! : line[j]!;
    for (let i = 0; i < n; i++) g[start + i * step] = Math.max(behind[i]!, ahead[i + k - 1]!);
  };
  for (let y = 0; y < h; y++) run(w, y * w, 1);
  for (let x = 0; x < w; x++) run(h, x, w);
}

/** Size of a cell in the map of what stands where, css px. */
const CELL = 16;
/** How often it asks the GPU whether it took what was made, ms. Asking waits for the GPU. */
const TAKEN_EVERY = 500;
/** How soon to look again for the GPU having caught up, ms. */
const ASKS_AGAIN = 20;
const MM = 0.25;
// What the shared canvas rounds up to, pixels. A power of two, so rounding can't pass a GPU's limit.
const CANVAS_STEP = 256;
/** The most pixels on its longest side a picture keeps once its device is far from the window. */
const TOP = 32;
/** Clear pixels between devices on the shared canvas, as scaling reads a little past what it copies. */
const SEAT_GAP = 2;
/** What only changes colour reaches this far in the light: where nearby surfaces hand on their colour, css px. */
const NEARBY = 32;
/** The furthest a change that moved something carries, in glass or a shadow, css px. */
const FAR = 160;
/** How low a surface's key light can sit: a thing throws a shadow this many times its height, and the room's lamps stop there. */
const SHADOW = 1 / 0.6;
/** How far past what's drawn its maps reach, css px: what a few of their smaller sizes blur. */
const BORDER = 8;
/** How long a device that only keeps maps for a player goes on holding what a paint works in after something painted part of it, ms: see `spare`. */
const SPARE = 2000;
/** Maps start on a multiple of this many pixels, so their smaller sizes fall on the same pixels as the canvas's would. */
const MAP_STEP = 32;
/** A texture unit no shader reads, where smaller sizes are made. */
const MIP_UNIT = 16;
/** Most separate boxes a repaint keeps. */
const MANY = 6;
/** Longest a frame waits on the one before, ms, as a fence that never lands mustn't stop the page. */
const GATE = 100;
/** How long a frame can take the GPU before it counts as falling behind, ms. Time and not a count of frames, or a fast screen, which asks again in 8, makes every GPU look slow. */
const LATE = 12;
/** How many pixels of distance fields a frame can make, which is roughly what the GPU gets through in a few milliseconds. */
const FIELD_ROOM = 4e6;
/** How far off a flashlight is held from something 150mm long, mm. */
const HOLD = 260;
/** How far the viewer's eye is from the page, in mm. About arm's length. */
const VIEWER = 640;
/** The least the viewer stands back, as lengths of the object. */
const STAND_BACK = 3;
/** The same for what leans, which is seen down a long lens. A near viewer sees past an edge only once they're past it, so a box would hide its sides however far it leaned. */
const LONG_LENS = 10;
/** The furthest round from straight on a device is seen, degrees. Past about here a tall part's side shows as streaks, not a wall,
 * and whatever's set further round still shows its relief at this. */
const ANGLE_SEEN = 18;
/** Something in the room as seen from a device set at `angle`, from its own side: the turn it's set at undone. */
const settled = ([y, x]: [number, number], [vx, vy, vz]: [number, number, number]): [number, number, number] => {
  const a = (y * Math.PI) / 180, b = (x * Math.PI) / 180, x1 = vx * Math.cos(a) - vz * Math.sin(a), z1 = vz * Math.cos(a) + vx * Math.sin(a);
  return [x1, vy * Math.cos(b) + z1 * Math.sin(b), z1 * Math.cos(b) - vy * Math.sin(b)];
};
/** How much of what's shown a device leaning under the hand draws while it moves. */
const LEAN_SHARP = 0.75;
/** The furthest a face turns before it counts as edge on, radians. */
const EDGE_ON = 1.565;

/** A glowing face on a device, as a light for every other device: its middle and half its size, window px, and its colour times how bright, of what shows white. */
export interface Emitter {
  from: Plate;
  at: [number, number];
  /** Where it is on the device it's on, window px from its corner. */
  on: [number, number];
  half: number;
  /** Window px to a css px of the device it's on, as it was found. */
  per: number;
  color: [number, number, number];
}

/** A device's glow as it goes into the picture of what the page gives off: where, in cells of that picture. */
export interface GlowShot {
  plate: Plate;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** That picture, back from the GPU, `w` by `h` cells, rows from the top, with the shots it was made from. */
export interface Glow<S extends GlowShot = GlowShot> {
  w: number;
  h: number;
  data: Uint8Array;
  shots: readonly S[];
}

const NO_POINTS = { n: 0, at: new Float32Array(0), color: new Float32Array(0) };

/** A picture on the stage: a box given as left, top, right and bottom in clip space as it would lie flat, and the part of the picture
 * over it, as the same corners in its uv, rows counting up. `uH` takes it from flat to where the page has turned, moved or projected
 * it, in clip space, and what's read across it is read as it's seen, nearer px bigger. */
const SHOW_VS = `#version 300 es
uniform vec4 uRect, uUv;
uniform mat3 uH;
out vec2 vUv;
void main() {
  vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  vUv = mix(uUv.xy, uUv.zw, c);
  vec3 p = uH * vec3(mix(uRect.x, uRect.z, c.x), mix(uRect.y, uRect.w, c.y), 1.0);
  gl_Position = vec4(p.xy, 0.0, p.z);
}`;
/**
 * Seen through what a turn does to it: `uGain` brighter, and smeared across as it whips past, by three taps a side that reach `uSmear` of its uv.
 * With `uOver`, a map with no smaller sizes drawn far smaller than it is: every pixel is all of what it covers, and nothing from past the map's edge.
 */
const SHOW_FS = `#version 300 es
precision mediump float;
uniform sampler2D tP;
uniform float uGain, uSmear, uOver;
in vec2 vUv;
out vec4 o;
void main() {
  if (uOver > 0.0) {
    vec2 dx = dFdx(vUv), dy = dFdy(vUv);
    vec4 c = vec4(0.0);
    for (int i = 0; i < 16; i++) for (int j = 0; j < 16; j++) {
      vec2 q = vUv + dx * ((float(i) + 0.5) / 16.0 - 0.5) + dy * ((float(j) + 0.5) / 16.0 - 0.5);
      if (q == clamp(q, 0.0, 1.0)) c += texture(tP, q);
    }
    o = c / 256.0 * uGain;
    return;
  }
  if (uSmear <= 0.0) { o = texture(tP, vUv) * uGain; return; }
  vec4 c = vec4(0.0);
  float n = 0.0;
  for (int i = -3; i <= 3; i++) {
    float w = exp(-float(i * i) / 4.5);
    c += texture(tP, vUv + vec2(float(i) * uSmear / 3.0, 0.0)) * w;
    n += w;
  }
  o = c / n * uGain;
}`;
/** The same, read through a stage layer's offsets: mm across and down the page, over the stage, turned into this picture's uv. */
const BENT_FS = `#version 300 es
precision highp float;
uniform sampler2D tP, tBend;
uniform vec2 uStagePx, uUvPerMm;
uniform float uGain;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 d = texture(tBend, gl_FragCoord.xy / uStagePx).rg;
  o = texture(tP, vUv + vec2(d.x, -d.y) * uUvPerMm) * uGain;
}`;
const FLAT = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

/** Two maps of the plane, nine numbers each, rows: `a` after `b`. */
export function times(a: readonly number[], b: readonly number[]): number[] {
  const o: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!);
  return o;
}

/** The whole pixels a box touches, at `k` pixels to the css px. */
function pixels(b: Box, k: number): Box {
  const x = Math.floor(b.x * k), y = Math.floor(b.y * k);
  return { x, y, w: Math.ceil((b.x + b.w) * k) - x, h: Math.ceil((b.y + b.h) * k) - y };
}

export const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 });

/** Boxes without overlaps, so nothing is drawn twice. Past a few they're one box: each is a pass over the light. */
function apart(boxes: Box[]): Box[] {
  const out: Box[] = [];
  for (let b of boxes) {
    for (let i = out.length - 1; i >= 0; i--) {
      if (!meets(out[i]!, b)) continue;
      b = join(b, out[i]!)!;
      out.splice(i, 1);
      i = out.length;
    }
    out.push(b);
  }
  return out.length > MANY ? [out.reduce((a, b) => join(a, b)!)] : out;
}

/** A box among the commands, on a canvas whose corner is at `o` among them. */

const bright = (c: readonly number[] | null) => !!c && (c[0]! > 0 || c[1]! > 0 || c[2]! > 0);
/** Whether a command can write to what glows. */
const glows = (c: Command) => c.op === 'screen' || c.op === 'frost' || c.op === 'glow' || (c.op === 'surface' ? bright(c.material.emit) : c.op === 'cut' && bright(c.emit));

// Occlusion is soft, so on a sharp screen it can be worked out and stored at half the size.
const occlusionScale = (dpr: number) => (dpr >= 1.5 ? 2 : 1);

/** A device's canvas, css px: where the device's right and bottom are, its middle, and its longest side. */
const frame = (d: PlateSpec) => ({ right: d.cw - d.x, bottom: d.ch - d.y, cx: d.cw / 2, cy: d.ch / 2, long: Math.max(d.cw - d.y * 2, d.ch - d.y * 2) });
/** The pointer as a device at `r` sees it: where the scene's `lampFor` hangs it over that device, or where it is. */
const handOver = (scene: Scene, r: DOMRect) => {
  const P = scene.pointer, at = scene.lampFor?.(r, P.x, P.y);
  return at ? { ...P, x: at[0], y: at[1] } : P;
};

/** A picture the stage shows, and where, css px from the stage's corner. */
export interface Shot {
  picture: Picture;
  plate: Plate;
  x: number;
  y: number;
  w: number;
  h: number;
  /** How much of it shows, 0 to 1. All of it without one. */
  share?: number;
  /** How the page turns it, see `Turned`. Without one, it lies flat. */
  turned?: Turned | null;
}

/** What the page does to a device between where it lies flat and where it's seen: turned, moved or projected, as a map of the stage's
 * css px to the same, nine numbers, rows, for x, y and w; and how a turn shows it, `gain` times as bright and smeared across by a
 * gaussian `smear` css px of the stage wide, as it lies flat. Every shot of one device has the same. */
export interface Turned {
  h: readonly number[];
  gain: number;
  smear: number;
}

/** Whether its viewer is anywhere but straight on, by a hand's drag or a lamp that's carried. */
const leans = (d: PlateSpec, scene: Scene) => !!d.spin || (!!d.lean && (scene.carried ? d.hand > 0 : !!d.turn[0] || !!d.turn[1]));

/** The same rect square to the page, if turning it left it looking the same: round, or turned by half turns. */
function upright(r: RectShape): RectShape | null {
  const q = (((r.rotate % Math.PI) + Math.PI) % Math.PI) / Math.PI;
  if (!r.rotate || (r.hw === r.hh && r.radius >= r.hw) || q < 1e-6 || q > 1 - 1e-6) return { ...r, rotate: 0 };
  return Math.abs(q - 0.5) < 1e-6 ? { ...r, rotate: 0, hw: r.hh, hh: r.hw } : null;
}

/** Another face of the same body, as this one sees it edge-on: how far round it looks, where it is, and where on this plate it can reach, mm, and how high. */
interface Neighbour {
  plate: Plate;
  turn: [number, number, number, number];
  at: [number, number, number];
  box: Box;
  hi: number;
}

/** What `readMaps` gives: each map as its texture holds it, RGBA rows from the top, over the map's box on the canvas (x, y, w, h, canvas px). */
export interface RawMaps {
  w: number; h: number; x: number; y: number; pw: number; ph: number; cw: number; ch: number; dpr: number; split: boolean; tall: number;
  A: Uint8Array; H: Float32Array; S: Uint8Array; M: Uint8Array | null; E: Uint8Array | null; C: Uint8Array; D: Float32Array | null; N: Uint8Array | null;
  O: { w: number; h: number; data: Uint8Array };
  /** Square panes of glass, eighteen numbers each, as the light pass reads them: see `PANE_FIELDS` in maps.ts. */
  panes: number[];
  peak: number;
}

export class Renderer {
  ok = false;
  /**
   * Makes maps, and the player lights them: maps only as big as what's drawn with `BORDER` round it, and what a paint uses on its way, a
   * copy for frost or one for a bridge, given back as soon as it's done. What the player has packed is given back too: see `spare`.
   */
  /** The context has gone, and everything on it. */
  lost = false;
  /** Wait for the GPU in each pass, so timings mean something. Slow. */
  probe = false;
  /** What lights every device it can, in the light pass's place: see `player/install.ts`. Without one, the light pass below lights everything. */
  player: Player | null = null;
  fields: FieldCache = null!;
  private sections: Sections = null!;
  /** Everything this holds on the GPU, under one limit. */
  readonly store = new Store();
  /** Plates something was made for this frame, given back whole if the GPU says it had no room for it. */
  private madeFor = new Set<Plate>();
  private allocated = false;
  private askedAt = -Infinity;
  private askTimer = 0;
  /** The bench was refused this frame, and made the window's size: see `sizeBench`. */
  private refusedBench = false;
  /** The GPU refused what was made this frame. What asked for it is drawn again, smaller. */
  refused: () => void = () => {};

  private plates = new Set<Plate>();
  private canvas: HTMLCanvasElement | null = null;
  /** Where light is drawn: the canvas, or once the canvas is a stage in the page, a texture the same size off it. */
  private bench: WebGLFramebuffer | null = null;
  private benchTex: WebGLTexture | null = null;
  /** The size light is drawn at, which is the canvas's until it's a stage. */
  private sheet: { width: number; height: number } = { width: 0, height: 0 };
  /** The canvas shows pictures in the page itself. */
  private staged = false;
  private show_: Program = null!;
  /** The stage's camera, made the first time there's a stage to show. */
  private lens: Lens | null = null;
  /** How the stage's camera is exposed, against the light pass's own: 1 shows a flat white under the lamp as white. */
  exposure = 1;
  /** The colour of the page behind the stage, as it's shown, 0 to 1: what light over nothing is added to. */
  backdrop: readonly [number, number, number] = [0, 0, 0];
  private bent: Program = null!;
  /** What the page gives off, small, and the reads of it on their way back. */
  private glowAt: { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null = null;
  private glowReads: { pbo: WebGLBuffer; sync: WebGLSync; w: number; h: number; shots: readonly GlowShot[] }[] = [];
  /** The last glow back, until it's asked for. */
  private glowBack: Glow | null = null;
  /** What glows on each device, as lights for the others round it. The engine keeps it from the picture of what glows. */
  emitters: Emitter[] = [];
  gl: WebGL2RenderingContext = null!;
  private mat: Program = null!;
  private block: Block = null!;
  private recorder: Recorder = null!;
  private wea: Program = null!;
  private con: Program = null!;
  private occ: Program = null!;
  private vao: WebGLVertexArrayObject | null = null;
  private screenTex: WebGLTexture | null = null;
  /** Stands in for what glows on a device where nothing does. */
  private dark: WebGLTexture | null = null;
  /** A screen's picture whole, as its damage map reads where nothing broke: see broken.ts. */
  private whole: WebGLTexture | null = null;
  private rooms: Rooms = null!;
  private px = new Uint8Array(4);
  private pxLight = new Float32Array(4);
  private fieldRoom = Infinity;
  private proven = false;
  /** Passed when the GPU has done the last frame. */
  private fence: WebGLSync | null = null;
  private fenced = 0;
  private mipFrom: WebGLFramebuffer | null = null;
  private heightFormat = 0;
  /** The longest side, in pixels, a texture can have on this GPU. */
  maxSide = 4096;
  private undersides = false;
  private relief = false;
  /** Whether height is a full float on its own, and grain's direction and coverage are eight bits beside it in `N`. */
  private split = false;
  /** Whether finishes raise their pattern out of the surface, which outlives a lost context. */
  private raised = true;
  private targets: number[] = [];
  /** What had been drawn and made when the frame began. */
  private drawn = 0;
  private made = 0;

  /** `restored` says everything has to be drawn again, as the GPU came back with nothing on it. */
  /** `window` is the window as the engine draws it, device px: see `room`. */
  constructor(private readonly stats: EngineStats, restored: () => void, private readonly window: () => [number, number] = () => [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio]) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance',
    });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
    this.canvas = canvas;
    this.sheet = canvas;
    this.gl = gl;
    this.init();
    this.ok = true;

    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.lost = true;
      this.fence = null;
      this.store.lost();
      this.player?.lost();
      this.madeFor.clear();
      this.painting.clear();
      for (const plate of this.plates) {
        plate.tex = plate.picture = plate.ink = null;
      }
      this.bench = this.benchTex = null;
      // What glows was being read back from the context that's gone, and is asked for again from the new one.
      this.glowReads = [];
      this.glowAt = null;
      this.lens = null;
      setStage(null);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      if (this.staged) setStage(gl);
      restored();
    });
  }

  /** A plate for a device, which stays with it however often its textures come and go. */
  open(spec: PlateSpec): Plate {
    const plate = new Plate(spec);
    this.plates.add(plate);
    return plate;
  }

  /** Raises each finish's pattern out of the surface, or leaves it flat. Only what's painted after sees it. */
  showRelief(on: boolean): void {
    this.raised = on;
    if (this.recorder) this.recorder.relief = on;
  }

  /** A device's maps as the material pass left them, read back to the CPU, or null if it holds none now. See `maps.ts`. */
  /** Draws every screen showing nothing, for `engine.maps`. */
  set blankScreens(v: boolean) { this.recorder.blank = v; }
  /** One screen stands in for its picture with a level all over: see `Recorder.stand`. */
  set standIn(v: { source: TexImageSource; level: number } | null) { this.recorder.stand = v; }

  readMaps(plate: Plate): RawMaps | null {
    const t = plate.tex;
    // What a paint works in was given back: `hold` it and paint again first.
    if (!t || !plate.ready || !t.H || !t.S || !t.C || !t.O) return null;
    const { gl } = this, m = plate.map, d = plate.spec, was = gl.getParameter(gl.FRAMEBUFFER_BINDING), fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const read = <T extends Uint8Array | Float32Array>(tex: WebGLTexture, w: number, h: number, out: T): T => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.readPixels(0, 0, w, h, gl.RGBA, out instanceof Float32Array ? gl.FLOAT : gl.UNSIGNED_BYTE, out);
      return out;
    };
    const n = m.w * m.h * 4, bytes = (tex: WebGLTexture | null) => (tex ? read(tex, m.w, m.h, new Uint8Array(n)) : null);
    const s = occlusionScale(d.dpr), ow = Math.ceil(d.pw / s), oh = Math.ceil(d.ph / s);
    const raw: RawMaps = {
      w: m.w, h: m.h, x: m.x, y: m.y, pw: d.pw, ph: d.ph, cw: d.cw, ch: d.ch, dpr: d.dpr, split: this.split, tall: plate.tall,
      A: bytes(t.A)!, H: read(t.H, m.w, m.h, new Float32Array(n)), S: bytes(t.S)!, M: this.targets.length > 4 ? bytes(t.M) : null, E: bytes(t.E), C: bytes(t.C)!,
      D: t.D ? read(t.D, m.w, m.h, new Float32Array(n)) : null, N: bytes(t.N), O: { w: ow, h: oh, data: read(t.O, ow, oh, new Uint8Array(ow * oh * 4)) },
      panes: [...(plate.panes ?? [])], peak: plate.peak,
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, was);
    gl.deleteFramebuffer(fb);
    return raw;
  }

  close(plate: Plate): void {
    this.plates.delete(plate);
    this.free(plate);
    this.player?.close(plate);
    this.freePicture(plate);
    this.store.drop(plate);
    this.madeFor.delete(plate);
  }

  /** Something's being made for a plate, or for the stage: room is made for it first, and the frame checks the GPU took it. */
  private making_(plate: Plate | null, bytes: number): void {
    this.store.room(bytes);
    this.allocated = true;
    if (plate) this.madeFor.add(plate);
  }

  /** Starts a frame. A forced one makes every field it needs, and with the page still there's nothing to keep smooth, only a viewer waiting. */
  begin(forced: boolean, still: boolean): void {
    this.drawn = this.stats.paints + this.stats.lights;
    this.made = this.fields.generated;
    this.taken();
    this.fieldRoom = forced ? Infinity : still ? FIELD_ROOM * 8 : FIELD_ROOM;
    this.store.next();
    this.glowCollect();
  }

  /**
   * Takes what glows back once the GPU has it, first thing in a frame. Reading it back waits for the GPU to take in everything sent
   * before it, fence or no fence, so after a frame's light it waits for all of that: a stop that lights the world would wait hundreds of ms.
   */
  private glowCollect(): void {
    const { gl } = this;
    while (this.glowReads.length && gl.clientWaitSync(this.glowReads[0]!.sync, 0, 0) !== gl.TIMEOUT_EXPIRED) {
      const r = this.glowReads.shift()!, data = new Uint8Array(r.w * r.h * 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, r.pbo);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteSync(r.sync);
      gl.deleteBuffer(r.pbo);
      this.glowBack = { w: r.w, h: r.h, data, shots: r.shots };
    }
  }

  /** Ends a frame, leaving something to tell when the GPU has done with it. Says if it made something the next frame asks after. */
  end(): boolean {
    if (this.stats.paints + this.stats.lights === this.drawn && this.fields.generated === this.made) return this.asking();
    const { gl } = this;
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.fenced = performance.now();
    gl.flush();
    return this.asking();
  }

  /** Whether the next frame asks if the GPU took what was made. One that can't yet is asked without a frame, so none runs only to wait. */
  private asking(): boolean {
    if (!this.allocated) return false;
    const wait = Math.max(this.askedAt + TAKEN_EVERY - performance.now(), this.behind() ? ASKS_AGAIN : 0);
    if (wait <= 0) return true;
    this.askTimer ||= window.setTimeout(() => {
      this.askTimer = 0;
      this.taken();
      this.asking();
    }, wait);
    return false;
  }

  /** Whether the frame the GPU is on has gone on long enough to count as falling behind. */
  late(): boolean {
    return performance.now() - this.fenced > LATE;
  }

  /** Goes on with the fields a plate is waiting for. Says if there are still some to make. */
  making(plate: Plate): boolean {
    if (!plate.wanted) return false;
    // Another plate may have made some meanwhile.
    const wanted = (plate.wanted = this.fields.missing(plate.wanted, plate.spec.dpr)), now: FieldShape[] = [];
    while (wanted.length && this.fieldRoom > 0) {
      const field = wanted.pop()!;
      this.fieldRoom -= this.fields.cost(field, plate.spec.dpr);
      now.push(field);
    }
    this.fields.make(now, plate.spec.dpr);
    if (wanted.length) return true;
    plate.wanted = null;
    return false;
  }

  /** Whether the GPU has yet to finish the last frame that drew anything. */
  private behind(): boolean {
    const { gl, fence } = this;
    return !!fence && gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED;
  }

  /**
   * Whether the GPU took what was made this frame. One that ran out gives back all of what it was made for, which is drawn again within
   * what the GPU said it holds, and so smaller: the stage shows the best it has of them meanwhile. Asking waits for the GPU to take in all
   * that was sent before it, which is 50 ms when that's the first programs, so it's asked only once a fence says the GPU has caught up, and no
   * more than so often: a drag bringing things on makes something every frame, and an answer waits till it's asked.
   */
  private taken(): void {
    if (!this.allocated || this.lost) return;
    const now = performance.now();
    if (now - this.askedAt < TAKEN_EVERY) return;
    if (this.behind()) return;
    this.askedAt = now;
    this.allocated = false;
    const { gl } = this, made = [...this.madeFor];
    this.madeFor.clear();
    // Out of memory, or one texture more than a browser lets one be ("total allocation size is too large" is an invalid operation, and
    // a side too long an invalid value).
    let out = false;
    for (let e = gl.getError(); e !== gl.NO_ERROR && e !== gl.CONTEXT_LOST_WEBGL; e = gl.getError()) out ||= e === gl.OUT_OF_MEMORY || e === gl.INVALID_OPERATION || e === gl.INVALID_VALUE;
    if (!out && !this.refusedBench) return;
    if (out) this.store.refused();
    this.refusedBench = false;
    for (const plate of made) {
      this.free(plate);
      this.freePicture(plate);
    }
    this.refused();
  }

  /** Estimated GPU bytes held right now. `stage` is the shared canvas's own: the light its pictures are drawn into, and its camera. */
  memory(): { textures: number; pictures: number; fields: number; room: number; stage: number; live: number } {
    const k = this.store.kinds(), room = this.rooms?.bytes ?? 0;
    let live = 0;
    for (const plate of this.plates) if (plate.tex) live++;
    return { textures: k.maps + k.bake + k.hold, pictures: k.picture, fields: k.field, room, stage: k.stage - room, live };
  }

  /** Leaves GL as the next device expects, after one threw. Returns the command it was drawing, if it was. */
  recover(): Command | null {
    const { gl } = this, { drawing, later } = this.recorder;
    this.recorder.drawing = null;
    later.length = 0;
    this.block.send();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.activeTexture(gl.TEXTURE0);
    return drawing;
  }

  private init(): void {
    const { gl } = this;
    // Extensions are lost with the context, so this runs again on restore.
    gl.getExtension('EXT_color_buffer_float');
    this.maxSide = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    // Half floats step 0.016mm up at 16mm, which is a contour on every gentle slope of a tall object.
    this.heightFormat = gl.getExtension('OES_texture_float_linear') && gl.getExtension('EXT_float_blend') ? gl.RGBA32F : gl.RGBA16F;
    // WebGL promises four targets. Without a fifth, materials simply lose sheen and scatter.
    this.targets = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3];
    const buffers = gl.getParameter(gl.MAX_DRAW_BUFFERS) as number, fifth = buffers > 4;
    if (fifth) this.targets.push(gl.COLOR_ATTACHMENT4);
    // Half floats have 15µm to spare at 16mm, and relief can be 1µm, so it gets a target of its own,
    // whose steps are fine because it stays near zero. Without room for one it only steps.
    this.relief = this.heightFormat === gl.RGBA16F && buffers > 5;
    // Only height needs a full float. Grain's direction and coverage take eight bits, so with a target to spare they have one of
    // their own, and height's map is a quarter of what it was, the most of any.
    this.split = this.heightFormat === gl.RGBA32F && buffers > 5;
    if (this.split) this.heightFormat = gl.R32F;
    if (this.relief || this.split) this.targets.push(gl.COLOR_ATTACHMENT5);
    // Without room for undersides, what stands clear of the ground reaches down to it.
    this.undersides = buffers > 6;
    const define = (fs: string) => (this.relief || this.split ? fs.replace('#version 300 es', `#version 300 es\n#define ${this.relief ? 'RELIEF' : 'SPLIT'}`) : fs);
    // Linking runs alongside the page, so started together these finish together.
    // What a paint can write to depends on the GPU, and the same goes for what a face sees of the others.
    const targeted = (fs: string) => define((fifth ? fs : fs.replace('layout(location=4) out vec4 oM;', 'vec4 oM;')).replace('layout(location=6) out vec4 oU;', this.undersides ? '$&' : 'vec4 oU;'));
    const mat = link(gl, MATERIAL_VS, targeted(MATERIAL_FS));
    const wea = link(gl, QUAD_VS, define(WEATHER_FS));
    const con = link(gl, QUAD_VS, CONDITION_FS), occ = link(gl, QUAD_VS, OCCLUSION_FS);
    this.mat = mat.finish();
    this.block = new Block(gl, this.mat.program, 'Command');
    this.wea = wea.finish();
    this.con = con.finish();
    this.occ = occ.finish();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.screenTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.screenTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    clampTexture(gl, gl.LINEAR, gl.LINEAR);
    this.dark = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dark);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    this.fields = new FieldCache(gl, this.store);
    this.sections = new Sections(gl);
    this.whole = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.whole);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 128, 0, 0]));
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    this.recorder = new Recorder(gl, this.block, this.fields, this.screenTex!);
    this.recorder.relief = this.raised;
    this.recorder.damage = (plate, c) => plate.broken?.panels.get(panelKey(c)) ?? this.whole;
    this.rooms = new Rooms(gl);
    // The stage's own, which it needs whatever's shown: sized to what's lit and the window, never given back.
    const none = () => {};
    this.store.hold('rooms', 'stage', () => this.rooms.bytes, none);
    this.store.hold('lens', 'stage', () => this.lens?.bytes ?? 0, none);
    this.store.hold('bench', 'stage', () => (this.benchTex ? this.sheet.width * this.sheet.height * 8 : 0), none);
    this.store.hold('glow', 'stage', () => (this.glowAt ? this.glowAt.w * this.glowAt.h * 4 : 0), none);
    this.mipFrom = gl.createFramebuffer();
    this.show_ = link(gl, SHOW_VS, SHOW_FS).finish();
    this.bent = link(gl, SHOW_VS, BENT_FS).finish();
    if (this.staged) this.makeBench();
  }

  /**
   * Whether the GPU is still on the last frame. Asking the browser for another on top only builds a queue,
   * and with it lag that grows and leaves nothing for scrolling, so a slow GPU gets fewer frames, never worse ones.
   */
  held(): boolean {
    const { gl, fence } = this;
    if (!fence) return false;
    if (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED && performance.now() - this.fenced < GATE) return true;
    gl.deleteSync(fence);
    this.fence = null;
    return false;
  }

  /** What a layout leaves for the GPU, put off until a paint knows the size stands. */
  private prepare(plate: Plate): void {
    if (!plate.tex) this.allocTextures(plate, null);
  }

  /**
   * Takes what a layout printed on a device to the GPU as it's printed, into the device's own mask. It's printed on a canvas every device
   * shares, in its corner, and the next device's layout prints over it: one laid out away from the window, as one arriving or woken
   * ahead of the scroll is, paints after others have been laid out. Its own mask is made here if it has no maps yet, and they take it.
   */
  ink(plate: Plate, printed: TexImageSource): void {
    if (this.lost) return;
    const { gl } = this, d = plate.spec;
    let mask = plate.tex?.mask ?? plate.ink;
    const unit = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    gl.activeTexture(gl.TEXTURE0);
    // A paint may be under way, its labels read from unit 0: that's left as it was.
    const was = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    if (!mask) {
      mask = plate.ink = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, mask);
      clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    } else gl.bindTexture(gl.TEXTURE_2D, mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // Printed in the corner of a canvas that may be bigger.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, d.pw, d.ph, 0, gl.RED, gl.UNSIGNED_BYTE, printed);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, was === mask ? mask : was);
    gl.activeTexture(unit);
    if (plate.tex) plate.tex.blank = false;
  }

  /**
   * Its labels were given back with what a paint works in, and none have been drawn for it since: a paint of all of it needs them laid
   * out again first. See `spare`.
   */
  unlabelled(plate: Plate): boolean {
    return !!plate.tex?.blank;
  }

  private condition(plate: Plate): void {
    const d = plate.spec;
    const key = [d.pw, d.ph, d.seed, d.prints, d.dust, d.scuff, d.haze].join();
    const tex = plate.tex!;
    if (key === plate.drawn && tex.C) return;
    plate.drawn = key;
    const { gl } = this, { u, program } = this.con;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.condition);
    if (!tex.C) {
      tex.C = this.target(plate, gl.RGBA8, 1);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.C, 0);
    }
    gl.viewport(-plate.map.x, -plate.map.y, d.pw, d.ph);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniform2f(u.uCanvas!, d.cw, d.ch);
    gl.uniform4f(u.uBox!, 0, 0, d.cw, d.ch);
    gl.uniform2f(u.uSeed!, (d.seed * 73.1) % 997, (d.seed * 41.7) % 991);
    gl.uniform1f(u.uPrints!, d.prints);
    gl.uniform1f(u.uDust!, d.dust);
    gl.uniform1f(u.uScuff!, d.scuff);
    gl.uniform1f(u.uHaze!, d.haze);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
  }

  private occlusion(plate: Plate, box: Box | null): void {
    const d = plate.spec;
    const { gl } = this, { u, program } = this.occ, s = occlusionScale(d.dpr), tex = plate.tex!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.occlusion);
    if (!tex.O) {
      tex.O = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex.O);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, Math.ceil(d.pw / s), Math.ceil(d.ph / s));
      clampTexture(gl, gl.LINEAR, gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.O, 0);
      box = null;
    }
    gl.viewport(0, 0, Math.ceil(d.pw / s), Math.ceil(d.ph / s));
    // Far samples reach about this far, so a change shows up that far away.
    if (box) this.clip(grow(box, 80 / Math.min(d.dpr, 1)), (d.pw / d.cw) / s, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.useProgram(program);
    gl.uniform2f(u.uCanvas!, d.cw, d.ch);
    gl.uniform4f(u.uBox!, 0, 0, d.cw, d.ch);
    gl.uniform1f(u.uDpr!, d.dpr);
    gl.uniform4f(u.uMap!, ...this.mapUv(plate));
    gl.uniform1i(u.tH!, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
  }

  private allocTextures(plate: Plate, kept: WebGLTexture | null): void {
    const d = plate.spec;
    const { gl } = this;
    // About what the maps come to with their smaller sizes, before any are made: see `mapBytes`.
    this.making_(plate, plate.map.w * plate.map.h * 40 + d.pw * d.ph * 3);
    this.store.hold(plate, 'maps', () => (plate.tex ? this.mapBytes(plate) : 0), () => this.freeMaps(plate), undefined, () => (plate.tex ? Math.max(this.mapBytes(plate), plate.tex.most) : 0));
    const levels = this.levels(plate);
    const A = this.target(plate, gl.SRGB8_ALPHA8, levels), N = this.split ? this.target(plate, gl.RGBA8, levels) : null;
    // What was printed on it before it had maps is its mask already.
    const mask = kept ?? plate.ink ?? gl.createTexture()!;
    if (!kept && !plate.ink) {
      gl.bindTexture(gl.TEXTURE_2D, mask);
      clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    }
    const fbo = gl.createFramebuffer()!, weather = gl.createFramebuffer()!, condition = gl.createFramebuffer()!, occlusion = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
    if (N) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT5, gl.TEXTURE_2D, N, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, weather);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    const tw = Math.ceil(d.cw / CELL), th = Math.ceil(d.ch / CELL), T = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, T);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8, tw, th);
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    const targets = [...this.targets];
    targets[3] = gl.NONE;
    plate.ink = null;
    plate.tex = { A, H: null, S: null, E: null, targets, M: null, D: null, N, U: null, C: null, O: null, mask, fbo, weather, condition, occlusion, tops: new Uint8Array(tw * th * 2), tw, th, T, back: null, under: null, own: null, deep: null, most: 0, blank: false };
    plate.drawn = '';
    this.work(plate);
  }

  /** One device's at a time: a device that starts to paint takes what a paint works in from every other that isn't live. See `spare`. */
  private take(plate: Plate): void {
    if (this.player) for (const other of [...this.painting]) if (other !== plate && other.spare === undefined) this.spare(other, true);
  }

  /** The devices holding what a paint works in: see `work` and `spare`. */
  private painting = new Set<Plate>();

  /**
   * What a paint works in and nothing keeps reading after: heights, finish, sheen and marks, and relief where it's kept apart. Made with
   * the maps, and again by the paint that finds them given back: see `spare`. Condition and what each point sees are made as they're drawn.
   */
  private work(plate: Plate): void {
    const { gl } = this, tex = plate.tex!, levels = this.levels(plate);
    this.take(plate);
    gl.activeTexture(gl.TEXTURE0);
    tex.H ??= this.target(plate, this.heightFormat, levels);
    if (this.split && !tex.N) {
      tex.N = this.target(plate, gl.RGBA8, levels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT5, gl.TEXTURE_2D, tex.N, 0);
    }
    tex.S = this.target(plate, gl.RGBA8, 1);
    if (this.targets.length > 4) tex.M = this.target(plate, gl.RGBA8, 1);
    else {
      tex.M = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex.M);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
      clampTexture(gl, gl.NEAREST, gl.NEAREST);
    }
    if (this.relief) tex.D = this.target(plate, gl.R16F, levels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex.H, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, tex.S, 0);
    if (this.targets.length > 4) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT4, gl.TEXTURE_2D, tex.M, 0);
    if (tex.D) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT5, gl.TEXTURE_2D, tex.D, 0);
    // Asking waits for the GPU to catch up, and the answer is the same for every device.
    if (!this.proven && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    this.proven = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.weather);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex.S, 0);
    this.painting.add(plate);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    plate.drawn = '';
  }

  /**
   * Says whether something is about to read off a plate by painting parts of it, a player's springs or a readback of its maps: while it
   * is, what a paint works in stays. See `spare`.
   */
  hold(plate: Plate, on: boolean): void {
    if (plate.keep === on) return;
    plate.keep = on;
    if (!on) this.settle(plate);
  }

  /** Whether a paint of part of it has what it works in. Without, the next paint is of all of it. */
  working(plate: Plate): boolean {
    return !!plate.tex?.S;
  }

  /** Something painted part of it, or asked to: it's live, and keeps what a paint works in for a while yet. See `spare`. */
  private rest(plate: Plate): void {
    if (!this.player) return;
    clearTimeout(plate.spare);
    plate.spare = setTimeout(() => this.spare(plate), SPARE);
  }

  /** Gives back what a paint worked in, unless it's live: see `spare`. */
  private settle(plate: Plate): void {
    if (plate.spare === undefined) this.spare(plate);
  }

  /**
   * Gives back what a paint worked in: making maps only for a player, nothing here reads it again once that has packed it. The whole
   * rule is here. It goes as soon as the pack is the plate as last painted, which is the first time the player lights it after a paint,
   * unless one of two things keeps it: something is reading off it by painting parts (`hold`: a player's springs, a readback), or a
   * paint of part of it was asked for in the last `SPARE` ms, a screen playing or a part the maker moves, and then it goes that long
   * after the last one. And one device has it at a time: a device that starts to paint takes it from every other that isn't live, one
   * held for reading too, which reads on once it has painted all of itself again, so a page of devices peaks at one device's, not at
   * the sum. Two that are both live keep theirs, as each would otherwise paint all of itself for every part. What brings it back is the next paint that isn't of glow alone: it finds nothing to paint part of, makes it
   * again and paints all of the device (`work`).
   *
   * With it go heights, the grain's lie, which the player has in its pack, and the copies frost and bridges read. The colour and what
   * glows stay, as the player reads those where they are, with undersides, which it reads from an angle. The labels go too:
   * they're as big as the canvas, only a paint reads them, and the engine lays them out again before the next one (`unlabelled`).
   */
  private spare(plate: Plate, taken = false): void {
    const { gl } = this, tex = plate.tex;
    clearTimeout(plate.spare);
    plate.spare = undefined;
    if (this.lost || !tex?.S || (plate.keep && !taken) || !this.player) return;
    // Taken before its next light, it's packed as painted first.
    if (!(taken ? this.player.repack(plate) : this.player.current(plate))) return;
    // What it held with all a paint works in, which the squeeze goes on counting: see `Store.tally`.
    tex.most = this.mapBytes(plate);
    const detach = (fbo: WebGLFramebuffer, at: number) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, at, gl.TEXTURE_2D, null, 0); };
    // Heights, and the grain's lie beside them or in them: the player packs both, and reads neither where it is.
    detach(tex.fbo, gl.COLOR_ATTACHMENT1);
    gl.deleteTexture(tex.H);
    tex.H = null;
    if (tex.N) { detach(tex.fbo, gl.COLOR_ATTACHMENT5); gl.deleteTexture(tex.N); tex.N = null; }
    detach(tex.fbo, gl.COLOR_ATTACHMENT2);
    detach(tex.weather, gl.COLOR_ATTACHMENT1);
    if (this.targets.length > 4) detach(tex.fbo, gl.COLOR_ATTACHMENT4);
    if (tex.D) detach(tex.fbo, gl.COLOR_ATTACHMENT5);
    detach(tex.condition, gl.COLOR_ATTACHMENT0);
    detach(tex.occlusion, gl.COLOR_ATTACHMENT0);
    for (const t of [tex.S, tex.M, tex.D, tex.C, tex.O]) if (t) gl.deleteTexture(t);
    tex.S = tex.M = tex.D = tex.C = tex.O = null;
    // And what frost and bridges read, which only a paint of part of it needed kept.
    this.freeBack(plate);
    this.freeUnder(plate);
    // The labels are as big as its canvas, and only a paint reads them: the layout before its next one draws them again.
    gl.bindTexture(gl.TEXTURE_2D, tex.mask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    tex.blank = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    // The shapes' fields are what a paint draws with, and with no device left that paints, nothing draws with them: they go too, and
    // the next paint, which is of all of a device, makes the ones it draws.
    this.painting.delete(plate);
    if (!this.painting.size) this.fields.clear();
  }

  /**
   * The bench, where light is drawn, device px: the window and the margin round it a shadow falls in, as the engine draws them,
   * whatever's lit, on the stage or off it. A picture bigger than this is lit coarser, to what fits, and what's lit at once that doesn't
   * fit is lit in turns, so it never grows with what's shown, and the GPU never refuses it for being shown close.
   */
  get room(): [number, number] {
    const [w, h] = this.window(), side = (n: number, most: number) => Math.min(Math.ceil(n / CANVAS_STEP) * CANVAS_STEP, most, this.maxSide);
    return [side(w, this.ceiling[0]), side(h, this.ceiling[1])];
  }

  /** Makes the bench the window's size, as it is now. */
  grow(): void {
    const [w, h] = this.room, canvas = this.sheet;
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    if (this.staged) return this.sizeBench();
    // Past some size a browser draws a WebGL canvas into less than it asked for, and says so only in the drawing buffer. Every seat
    // would land somewhere other than where it's copied from, so the canvas is made what it really is, and that's as far as it goes.
    // A window that's hidden or has no size can have no buffer at all for a while, which is no limit: learnt from that, the canvas
    // would stay 0 wide for good and draw nothing once the window is back.
    const { drawingBufferWidth: bw, drawingBufferHeight: bh } = this.gl;
    if (bw && bh && (bw < canvas.width || bh < canvas.height)) {
      this.ceiling = [bw, bh];
      canvas.width = bw;
      canvas.height = bh;
    }
  }

  /** The most the shared canvas can be, once a browser has said. */
  private ceiling: [number, number] = [Infinity, Infinity];

  /** How much of itself a device can be lit at on the shared canvas: all of it, unless it's bigger than the canvas can be. */
  private fit(d: PlateSpec): number {
    return Math.min(1, this.sheet.width / d.pw, this.sheet.height / d.ph);
  }

  private levels(plate: Plate): number {
    return Math.floor(Math.log2(Math.max(plate.map.w, plate.map.h))) + 1;
  }

  /** A map: the size of what's drawn and what's read round it, not of the canvas. */
  private target(plate: Plate, format: number, levels: number): WebGLTexture {
    const { gl } = this, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, levels, format, plate.map.w, plate.map.h);
    clampTexture(gl, levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR, gl.LINEAR);
    return t;
  }

  /**
   * Works out how its glass broke, if it did, from what it drew: every pane, every surface of glass and every screen. Kept while those
   * stay where they are and the canvas the same size, so a part moving costs nothing.
   */
  private broke(plate: Plate, commands: Command[], panes: GlassCommand[], squared: Map<Command, RectShape>): void {
    const d = plate.spec;
    if (!d.cracks || this.lost) return this.unbreak(plate);
    // What's drawn over a sheet after it hides its cracks there, though they run on under it: a wheel on a cracked front.
    const solid = (c: Command) => c.op === 'surface' && !c.body && getMaterialDef(c.name).substance !== 'glass';
    const hiddenOf = (c: Command, b: Box) => lazy(() => covered(commands.slice(commands.indexOf(c) + 1).filter(o => solid(o) && meets(extent(o), b)).map(o => o.shape), b));
    const covers: Cover[] = panes.filter(c => c.breaks).map(c => {
      const r = squared.get(c)!, b = { x: r.cx - r.hw, y: r.cy - r.hh, w: r.hw * 2, h: r.hh * 2 };
      return { ...b, breaks: c.breaks!, thick: c.thick, inside: lazy(() => outlineOf(r), true), hidden: hiddenOf(c, b) };
    });
    const shapes: Shape[] = panes.filter(c => c.breaks).map(c => squared.get(c)!);
    for (const c of commands) {
      const m = c.op === 'surface' && !c.body ? getMaterialDef(c.name) : null;
      if (c.op === 'surface' && m?.substance === 'glass') {
        // A surface of glass, a lamp's lens or a gauge's face, is a sheet a millimetre or so thick (guess).
        covers.push({ ...extent(c), breaks: m.breaks ?? 'glass', thick: 1.1, inside: lazy(() => outlineOf(c.shape), true), hidden: hiddenOf(c, extent(c)) });
        shapes.push(c.shape);
      }
    }
    const screens = commands.filter((c): c is ScreenCommand => c.op === 'screen');
    const panels = screens.map(c => ({ ...extent(c), kind: c.kind, inside: lazy(() => outlineOf(c.shape), true), hidden: hiddenOf(c, extent(c)) }));
    shapes.push(...screens.map(c => c.shape));
    const px = d.pw / d.cw, key = JSON.stringify([d.cracks, d.seed, d.x, d.y, d.w, d.h, d.cw, d.ch, Math.round(px * 64), covers, panels, shapes]);
    if (plate.broken?.key === key) return;
    this.unbreak(plate);
    const b = breakDevice({ x: d.x, y: d.y, w: d.w, h: d.h }, { w: d.cw, h: d.ch }, px, covers, panels, d.cracks, d.seed);
    const { gl } = this, upload = (m: Bytes, mips: boolean) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.data);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      clampTexture(gl, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR, gl.LINEAR);
      return t;
    };
    const panelTex = new Map<string, WebGLTexture>();
    b.panels.forEach((m, i) => { if (m) panelTex.set(panelKey(screens[i]!), upload(m, false)); });
    plate.broken = { key, cracks: upload(b.cracks, true), faces: upload(b.faces, true), panels: panelTex };
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private unbreak(plate: Plate): void {
    if (!plate.broken) return;
    if (!this.lost) for (const t of [plate.broken.cracks, plate.broken.faces, ...plate.broken.panels.values()]) this.gl.deleteTexture(t);
    plate.broken = null;
  }

  /** Gives up what's on the GPU. The last frame stays in the device's canvas, or its kept picture, so nothing looks blank while it comes back. */
  free(plate: Plate): void {
    this.freeMaps(plate);
  }

  /** Gives up its maps alone: what it shows stays, and only lighting it again needs them. */
  private freeMaps(plate: Plate): void {
    this.store.drop(plate, 'maps');
    this.player?.drop(plate);
    this.painting.delete(plate);
    clearTimeout(plate.spare);
    plate.spare = undefined;
    const { gl } = this;
    // Printed on before it had maps, it gives that up too: whatever lays it out next prints it again.
    if (plate.ink && !this.lost) gl.deleteTexture(plate.ink);
    plate.ink = null;
    this.unbreak(plate);
    if (!plate.tex) return;
    const { A, H, S, E, M, D, N, C, O, T, mask, fbo, weather, condition, occlusion, back, under, own, deep } = plate.tex;
    if (!this.lost) {
      for (const t of [A, H, S, E, M, D, N, C, O, T, mask, back?.A, back?.E, back?.S, under?.H, under?.N, own?.H]) if (t) gl.deleteTexture(t);
      if (own) gl.deleteFramebuffer(own.fbo);
      if (deep) gl.deleteRenderbuffer(deep);
      gl.deleteFramebuffer(fbo);
      gl.deleteFramebuffer(weather);
      gl.deleteFramebuffer(condition);
      gl.deleteFramebuffer(occlusion);
      if (back) gl.deleteFramebuffer(back.fbo);
      if (under) gl.deleteFramebuffer(under.fbo);
      if (under?.nfbo) gl.deleteFramebuffer(under.nfbo);
    }
    plate.tex = null;
  }

  private mapBytes(plate: Plate): number {
    const { gl } = this, d = plate.spec, t = plate.tex!, h = this.heightFormat === gl.RGBA32F ? 16 : this.heightFormat === gl.R32F ? 4 : 8;
    // Maps, over what's drawn: albedo, height and what's made when needed with their smaller sizes, then surface, condition and the rest.
    const map = (4 + (t.H ? h : 0) + (t.D ? 2 : 0) + (t.N ? 4 : 0)) * (4 / 3) + (t.E ? 4 : 0) + (t.S ? 4 : 0) + (t.C ? 4 : 0) + (t.S && this.targets.length > 4 ? 4 : 0) + (t.U ? 2 : 0) + (t.own ? (this.ownFormat() === gl.R16F ? 2 : 4) + 4 : 0);
    // Copies for frost and bridges, over what reads them.
    const area = (b: Box | undefined) => (b ? b.w * b.h : 0);
    const copies = area(t.back?.box) * 12 * (4 / 3) + area(t.under?.box) * (h + (t.under?.N ? 4 : 0)) * (4 / 3);
    // Over the whole canvas: occlusion, labels, and how far glow spreads.
    const canvas = (t.O ? 4 / occlusionScale(d.dpr) ** 2 : 0) + (t.blank ? 0 : 4 / 3) ;
    return plate.map.w * plate.map.h * map + copies + d.pw * d.ph * canvas + t.tops.length + (this.player?.bytes(plate) ?? 0);
  }

  /** Where its maps should lie for what it draws: all of that, and as far round it as anything reads, on whole steps of the canvas's pixels. */
  private mapFor(plate: Plate, commands: Command[], seen: Neighbour[]): Box {
    const d = plate.spec, k = d.pw / d.cw;
    let b: Box | null = null;
    for (const c of commands) b = join(b, extent(c));
    for (const n of seen) b = join(b, { x: n.box.x / MM, y: n.box.y / MM, w: n.box.w / MM, h: n.box.h / MM });
    if (!b) return { x: 0, y: 0, w: d.pw, h: d.ph };
    const p = pixels(grow(b, BORDER), k);
    const x = Math.max(Math.floor(p.x / MAP_STEP) * MAP_STEP, 0), y = Math.max(Math.floor(p.y / MAP_STEP) * MAP_STEP, 0);
    const right = Math.min(p.x + p.w, d.pw), bottom = Math.min(p.y + p.h, d.ph);
    return { x, y, w: Math.max(right - x, 1), h: Math.max(bottom - y, 1) };
  }

  /** From a place on the canvas, as 0 to 1, to the same place on its maps. */
  private mapUv(plate: Plate): [number, number, number, number] {
    const d = plate.spec, m = plate.map;
    return [d.pw / m.w, d.ph / m.h, -m.x / m.w, -m.y / m.h];
  }

  /** Cuts drawing into the maps to a box on the canvas. */
  private clipMap(plate: Plate, b: Box): void {
    const { gl } = this, d = plate.spec, { x, y, w, h } = pixels(b, d.pw / d.cw);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x - plate.map.x, y - plate.map.y, w, h);
  }

  /** A box on the canvas in the pixels of its maps, kept inside them. */
  private onMap(plate: Plate, b: Box | null): Box {
    const m = plate.map;
    if (!b) return { x: 0, y: 0, w: m.w, h: m.h };
    const p = pixels(b, plate.spec.pw / plate.spec.cw);
    const x = Math.max(p.x - m.x, 0), y = Math.max(p.y - m.y, 0);
    return { x, y, w: Math.max(Math.min(p.x - m.x + p.w, m.w) - x, 0), h: Math.max(Math.min(p.y - m.y + p.h, m.h) - y, 0) };
  }

  // Frosted glass sees what is below it, so that has to be copied out before it can be read.
  /**
   * Where a copy for frost or a bridge lies on the maps, map px: what it's read over, `seen` on the canvas, out to a multiple of
   * MAP_STEP so its smaller sizes fall on the maps' own. The rest of the maps is never read from it, so it's never held.
   */
  private cropOf(plate: Plate, seen: Box): Box {
    const m = plate.map, p = this.onMap(plate, seen);
    const x = Math.max(Math.floor(p.x / MAP_STEP) * MAP_STEP, 0), y = Math.max(Math.floor(p.y / MAP_STEP) * MAP_STEP, 0);
    return { x, y, w: Math.max(Math.min(p.x + p.w, m.w) - x, 1), h: Math.max(Math.min(p.y + p.h, m.h) - y, 1) };
  }

  /** Where a copy read over `seen` lies once it's made: where the one held is, if that covers it, or where a new one will be. */
  private copyBox(plate: Plate, had: Box | undefined, seen: Box | null): Box | undefined {
    if (!seen) return had;
    const want = this.cropOf(plate, seen);
    return had && had.x <= want.x && had.y <= want.y && had.x + had.w >= want.x + want.w && had.y + had.h >= want.y + want.h ? had : want;
  }

  /** From the maps' uv to a copy's over `b`: see `cropOf`. */
  private cropUv(plate: Plate, b: Box | undefined): [number, number, number, number] {
    const m = plate.map;
    return b ? [m.w / b.w, m.h / b.h, -b.x / b.w, -b.y / b.h] : [1, 1, 0, 0];
  }

  private capture(plate: Plate, blurred: boolean, box: Box | null, seen: Box): void {
    const { gl } = this, tex = plate.tex!, want = this.copyBox(plate, tex.back?.box, seen)!;
    // Made again only when what the frost sees has outgrown it.
    if (tex.back && tex.back.box !== want) this.freeBack(plate);
    if (!tex.back) {
      const levels = Math.floor(Math.log2(Math.max(want.w, want.h))) + 1;
      const make = (format: number) => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, levels, format, want.w, want.h);
        clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
        return t;
      };
      const A = make(gl.SRGB8_ALPHA8), E = make(gl.SRGB8_ALPHA8), S = make(gl.RGBA8), fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, E, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, S, 0);
      tex.back = { A, E, S, fbo, box: want };
      // Making those took over unit 0, and labels drawn after this still read the mask from it.
      gl.bindTexture(gl.TEXTURE_2D, tex.mask);
    }
    const { A, E, S, fbo, box: c } = tex.back;
    const p = this.onMap(plate, box), x = Math.max(p.x, c.x), y = Math.max(p.y, c.y), w = Math.min(p.x + p.w, c.x + c.w) - x, h = Math.min(p.y + p.h, c.y + c.h) - y;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tex.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    const copy = (from: number, to: number) => {
      if (w <= 0 || h <= 0) return;
      gl.readBuffer(from);
      gl.drawBuffers(to === gl.COLOR_ATTACHMENT0 ? [to] : to === gl.COLOR_ATTACHMENT1 ? [gl.NONE, to] : [gl.NONE, gl.NONE, to]);
      gl.blitFramebuffer(x, y, x + w, y + h, x - c.x, y - c.y, x - c.x + w, y - c.y + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    };
    gl.disable(gl.BLEND);
    // A blit is cut to the scissor as well, and a box here can be wider than the one being drawn.
    const clipped = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    copy(gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT0);
    copy(gl.COLOR_ATTACHMENT3, gl.COLOR_ATTACHMENT1);
    // A paint of only what glows, of a device that gave back what a paint works in, has no finish to copy, and writes none.
    if (tex.S) copy(gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT2);
    for (const [unit, t] of [[gl.TEXTURE3, A], [gl.TEXTURE4, E], [gl.TEXTURE5, S]] as const) {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (blurred) gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.drawBuffers(tex.targets);
    gl.enable(gl.BLEND);
    if (clipped) gl.enable(gl.SCISSOR_TEST);
  }

  private weather(plate: Plate, boxes: Box[] | null): void {
    const d = plate.spec;
    const { gl } = this, { u, program } = this.wea, k = d.pw / d.cw;
    gl.bindFramebuffer(gl.FRAMEBUFFER, plate.tex!.weather);
    gl.viewport(-plate.map.x, -plate.map.y, d.pw, d.ph);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.useProgram(program);
    gl.uniform2f(u.uCanvas, d.cw, d.ch);
    gl.uniform4f(u.uBox, 0, 0, d.cw, d.ch);
    gl.uniform4f(u.uMap!, ...this.mapUv(plate));
    gl.uniform2f(u.uSeed, (d.seed * 73.1) % 997, (d.seed * 41.7) % 991);
    gl.uniform1f(u.uAge, d.grime);
    gl.uniform1f(u.uDpr, d.dpr);
    gl.uniform1i(u.tH, 0);
    gl.uniform1i(u.tN, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.N);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.H);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    // It adds to what's there, so it goes only over what was just drawn clean.
    for (const b of boxes ?? [null]) {
      if (b) this.clipMap(plate, b);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
  }

  /**
   * Notes what stands tall around each cell, so rays can start just above it and not at the top of
   * the device, which on a flat panel is most of the cost of lighting it. A moving part only raises
   * cells, which stays correct, and the next full repaint settles them.
   */
  private raise(plate: Plate, commands: Command[], lift: number, seen: Neighbour[] = []): void {
    const { tops, tw, th } = plate.tex!, far = Math.max(plate.peak / 0.6 / MM, NEAR);
    const marks: [Box, number][] = [];
    for (const c of commands) if ('zTop' in c) marks.push([extent(c), Math.min(Math.ceil(((tallest(c) + lift) / plate.tall) * 255), 255)]);
    // What it sees of the other faces stands there too.
    for (const n of seen) marks.push([{ x: n.box.x / MM, y: n.box.y / MM, w: n.box.w / MM, h: n.box.h / MM }, Math.min(Math.ceil((n.hi / plate.tall) * 255), 255)]);
    const mark = (b: Box, by: number, channel: number, v: number) => {
      const x0 = Math.max(Math.floor((b.x - by) / CELL), 0), x1 = Math.min(Math.floor((b.x + b.w + by) / CELL), tw - 1);
      const y0 = Math.max(Math.floor((b.y - by) / CELL), 0), y1 = Math.min(Math.floor((b.y + b.h + by) / CELL), th - 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0, i = (y * tw + x) * 2 + channel; x <= x1; x++, i += 2) if (tops[i]! < v) tops[i] = v;
      }
    };
    for (const [b, v] of marks) mark(b, NEAR, 0, v);
    // A shadow reaches across most of a big panel's cells, so a wall of bricks marked one by one costs bricks × reach². Marked
    // where they stand on a grid f cells to a side and then spread by the reach, it costs a few steps a cell whatever the reach or
    // the count. A cell within r of a mark is within R of it on that grid, so the spread reaches at least as far as marking each did:
    // it only ever raises cells, which stays correct, and by no more than a cell of that grid, a sixteenth of the reach.
    const r = Math.ceil(far / CELL), f = Math.max(1, Math.ceil(r / 16)), R = Math.floor(r / f) + 1;
    const cells = (b: Box) => [Math.floor(Math.floor(b.x / CELL) / f), Math.floor(Math.floor((b.x + b.w) / CELL) / f), Math.floor(Math.floor(b.y / CELL) / f), Math.floor(Math.floor((b.y + b.h) / CELL) / f)] as const;
    let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity, one = 0;
    for (const [b] of marks) {
      const [x0, x1, y0, y1] = cells(b);
      X0 = Math.min(X0, x0 - R); X1 = Math.max(X1, x1 + R); Y0 = Math.min(Y0, y0 - R); Y1 = Math.max(Y1, y1 + R);
      one += ((x1 - x0 + 1) * f + 2 * r) * ((y1 - y0 + 1) * f + 2 * r);
    }
    // Anything further off than the reach can't spread onto the map.
    X0 = Math.max(X0, -R); X1 = Math.min(X1, Math.floor((tw - 1) / f) + R); Y0 = Math.max(Y0, -R); Y1 = Math.min(Y1, Math.floor((th - 1) / f) + R);
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1;
    if (w > 0 && h > 0 && one < 4 * w * h * f * f) for (const [b, v] of marks) mark(b, far, 1, v);
    else if (w > 0 && h > 0) {
      const grid = scratch(w * h);
      for (const [b, v] of marks) {
        const [x0, x1, y0, y1] = cells(b);
        for (let y = Math.max(y0, Y0); y <= Math.min(y1, Y1); y++) {
          for (let x = Math.max(x0, X0), i = (y - Y0) * w + x - X0; x <= Math.min(x1, X1); x++, i++) if (grid[i]! < v) grid[i] = v;
        }
      }
      spread(grid, w, h, R);
      const fx0 = Math.max(X0 * f, 0), fx1 = Math.min((X1 + 1) * f - 1, tw - 1);
      for (let y = Math.max(Y0 * f, 0); y <= Math.min((Y1 + 1) * f - 1, th - 1); y++) {
        const row = (Math.floor(y / f) - Y0) * w - X0;
        for (let x = fx0, i = (y * tw + x) * 2 + 1; x <= fx1; x++, i += 2) {
          const v = grid[row + Math.floor(x / f)]!;
          if (tops[i]! < v) tops[i] = v;
        }
      }
    }
    const { gl } = this, { T } = plate.tex!;
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, T);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, tw, th, gl.RG, gl.UNSIGNED_BYTE, tops);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Makes a texture's smaller sizes again, all of them, however little changed. Each size is a pass of its own on the GPU, and a pass
   * costs about the same whatever it covers, so making only where it changed, a blit a size, cost 0.3-0.4 ms on a map of any size
   * where all of it costs 0.04-0.2 (0.35-1.5 at 4096 px, still less). Bound on a unit nothing reads, as it's done between draws that
   * read the others.
   */
  private mips(t: WebGLTexture): void {
    const { gl } = this, was = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    gl.activeTexture(gl.TEXTURE0 + MIP_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(was);
  }

  // A sheet that bridges reads the heights under it, around it too, so they're copied out just before it's drawn.
  private level(plate: Plate, box: Box, seen: Box): void {
    const { gl } = this, tex = plate.tex!, want = this.copyBox(plate, tex.under?.box, seen)!;
    if (tex.under && tex.under.box !== want) this.freeUnder(plate);
    gl.activeTexture(gl.TEXTURE6);
    if (!tex.under) {
      // Heights are laid down by coverage, which is beside them in N when height has a map of its own, so that comes too.
      const levels = Math.floor(Math.log2(Math.max(want.w, want.h))) + 1;
      const copy = (format: number) => {
        const t = gl.createTexture()!, fbo = gl.createFramebuffer()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, levels, format, want.w, want.h);
        clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return [t, fbo] as const;
      };
      const [H, fbo] = copy(this.heightFormat), [N, nfbo] = tex.N ? copy(gl.RGBA8) : [null, null];
      tex.under = { H, N, fbo, nfbo, box: want };
    }
    const under = tex.under, c = under.box, p = this.onMap(plate, box);
    const x = Math.max(p.x, c.x), y = Math.max(p.y, c.y), w = Math.min(p.x + p.w, c.x + c.w) - x, h = Math.min(p.y + p.h, c.y + c.h) - y;
    gl.bindTexture(gl.TEXTURE_2D, under.H);
    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, under.N);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tex.fbo);
    for (const [from, t, fbo] of [[gl.COLOR_ATTACHMENT1, under.H, under.fbo], [gl.COLOR_ATTACHMENT5, under.N, under.nfbo]] as const) {
      if (!t || w <= 0 || h <= 0) continue;
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
      gl.readBuffer(from);
      gl.blitFramebuffer(x, y, x + w, y + h, x - c.x, y - c.y, x - c.x + w, y - c.y + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    this.mips(under.H);
    if (under.N) this.mips(under.N);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
    gl.enable(gl.BLEND);
  }

  private clip(b: Box, k: number, flip: number, left = 0): void {
    const { gl } = this, { x, y, w, h } = pixels(b, k);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(left + x, flip ? flip - y - h : y, w, h);
  }

  /** Whether another face of its body has been painted since this one last drew what it sees of them. */
  edgesStale(plate: Plate): boolean {
    const { body } = plate.spec;
    return !!body && !!plate.tex && body.some((p, i) => p !== plate && !!p.made && p.shaped !== plate.edged[i]);
  }

  /**
   * What a face of a body would draw, said before it draws: the faces that see it edge on draw it and make room for it from their own
   * first paint. Its own first paint then changes nothing they see, and nor does saying the same again (`news` false).
   */
  known(plate: Plate, commands: Command[], stands: number, news = true): void {
    plate.made = commands;
    plate.peak = this.reach(plate, commands, stands, [], this.beside(plate, true)).peak;
    if (news) plate.shaped++;
    plate.known = true;
  }

  /**
   * The faces of a face's body beside it that have drawn themselves or said what they would, and where each can reach on this one. One
   * opposite is never seen edge-on. `all` is every one edge on, known or not: how tall each stands on this one is in where they lie.
   */
  private beside(plate: Plate, all = false): Neighbour[] {
    const d = plate.spec, seen: Neighbour[] = [];
    if (!d.body) return seen;
    const fixed = (v: number) => Math.round(v * 1e6) / 1e6, plane = (s: PlateSpec) => s.face - s.axis;
    const ax = (d.x + d.w / 2) * MM, ay = (d.y + d.h / 2) * MM, me = plane(d);
    for (const f of d.body) {
      if (f === plate || (!f.made && !all)) continue;
      const s = f.spec, c = fixed(Math.cos(s.round - d.round)), sn = fixed(Math.sin(s.round - d.round));
      if (Math.abs(c) > 0.01) continue;
      const fx = (s.x + s.w / 2) * MM, fy = (s.y + s.h / 2) * MM, fp = plane(s);
      // Its half of the body, from the plane through the middle out to its tallest, across its box, turned to how this face sees it.
      const xs: number[] = [], hs: number[] = [];
      for (const a of [s.x * MM - fx, (s.x + s.w) * MM - fx]) for (const o of [0, f.peak - fp]) {
        xs.push(a * c + o * sn + ax);
        hs.push(-a * sn + o * c + me);
      }
      const hi = Math.max(...hs);
      if (hi <= 0) continue;
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = s.y * MM - fy + ay;
      seen.push({ plate: f, turn: [c, sn, s.cw * MM, s.ch * MM], at: [fx, fy, fp], box: { x: x0, y: y0, w: x1 - x0, h: s.h * MM }, hi });
    }
    return seen;
  }

  /**
   * A face with no outline of its own shows the body side on: each layer of it, as far as its outline reaches toward this face at
   * each row, and set in where its edge is round. That's all of its body, so where no layer reaches there's nothing.
   */
  private section(plate: Plate, own: Command, seen: Neighbour[]): void {
    const { recorder } = this, d = plate.spec;
    const ax = (d.x + d.w / 2) * MM, ay = (d.y + d.h / 2) * MM, me = d.face - d.axis, box = extent(own);
    for (const n of seen) {
      for (const c of n.plate.made!) {
        if (c.op !== 'surface' || !c.layer || c.bend) continue;
        const rows = this.sections.get(c.shape);
        if (!rows) continue;
        recorder.aim = { box, seen: [n.turn[1], ...n.at], from: [ax, ay, me], reach: extent(c), rows };
        recorder.draw(c, n.plate);
      }
    }
    recorder.aim = null;
  }

  /** What a face keeps of its own heights for the others: height alone, as wide a float as its heights. */
  private ownFormat(): number {
    const { gl } = this;
    return this.heightFormat === gl.RGBA16F ? gl.R16F : gl.R32F;
  }

  /**
   * Keeps what a face of a body drew itself, for the others to see, then draws over it the others' surfaces as it sees them edge-on:
   * each one a solid, its own outline standing up to its own top, drawn with its own material. Only where the paint drew again,
   * so what it saw before stays everywhere else, and what it keeps of itself stays its own.
   */
  private across(plate: Plate, seen: Neighbour[], boxes: Box[] | null): void {
    const { gl, recorder } = this, { later } = recorder, d = plate.spec, tex = plate.tex!, k = d.pw / d.cw;
    if (!tex.own) {
      // Height alone, at the precision it was painted at: the others read nothing else of it, and grain held with the heights where
      // there's no target for it apart would have it four times the size.
      const H = this.target(plate, this.ownFormat(), 1), fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, H, 0);
      tex.own = { H, fbo };
      boxes = null;
    }
    // The nearest of the others' solids wins, as it would in front of the eye.
    if (!tex.deep) {
      tex.deep = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, tex.deep);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, plate.map.w, plate.map.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, tex.deep);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    plate.edged = d.body!.map(p => p.shaped);
    const own = tex.own, at = (boxes ?? [null]).map(b => this.onMap(plate, b));
    later.push(() => {
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tex.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, own.fbo);
      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      for (const { x, y, w, h } of at) gl.blitFramebuffer(x, y, x + w, y + h, x, y, x + w, y + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
      gl.drawBuffers(tex.targets);
      gl.activeTexture(gl.TEXTURE8);
      gl.bindTexture(gl.TEXTURE_2D, own.H);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
    });
    const ax = (d.x + d.w / 2) * MM, ay = (d.y + d.h / 2) * MM, me = d.face - d.axis;
    // Where its corners turn away, what stands off a side turns with them: see `Sections.inset`.
    const body = plate.made!.find(c => c.op === 'surface' && c.body), inset = body ? this.sections.inset(body.shape) : null, most = (inset?.most ?? 0) * MM;
    for (const b of boxes ?? [null]) {
      later.push(() => {
        if (b) this.clipMap(plate, b);
        else gl.disable(gl.SCISSOR_TEST);
        gl.clearBufferfv(gl.DEPTH, 0, [1]);
      });
      for (const n of seen) {
        const sn = n.turn[1], [fx, fy, fp] = n.at;
        for (const c of n.plate.made!) {
          // A sheet laid over others or rolled round a bend has no outline of its own to stand up. What stands on the flat between a body's
          // rolled ends isn't rolled at all, as a lens on a camera isn't.
          // Nor does a layer of the body: it's the same solid, and this face shows it as its own. See `section`.
          // Nor does a groove or a well: it's cut into what it's on, and that solid is already there. Stood up, it would show through any hole this face has.
          if (c.op !== 'surface' || c.body || c.follow || c.bridge || (c.bend && !unbent(bounds(c.shape, 0), c.bend)) || c.zTop < c.zEdge || c.shape.type === 'holes' || c.shape.type === 'mask') continue;
          const hi = tallest(c), e = extent(c);
          // Its half of the body, from the plane through the middle out to its top, turned to how this face sees it.
          const near = Math.max((fx - e.x * MM) * sn, (fx - (e.x + e.w) * MM) * sn) + me;
          if (hi <= fp || near <= 0) continue;
          // From where it sits, not from the middle: what it stands on is a solid of its own, and the body's inside is hollow, as a deep well in this face shows.
          // Set in, it reaches as far toward the middle as the outline falls short anywhere.
          const x0 = ax + (Math.max(Math.min(c.zEdge, hi), fp) - fp) * sn - Math.sign(sn) * most, x1 = ax + (hi - fp) * sn;
          const box = { x: Math.min(x0, x1) / MM, y: (e.y * MM - fy + ay) / MM, w: Math.abs(x1 - x0) / MM, h: e.h };
          if (b && !meets(box, b)) continue;
          recorder.aim = { box, seen: [sn, fx, fy, fp], from: [ax, ay, me], reach: e, inset };
          recorder.draw(c, n.plate);
        }
      }
    }
    recorder.aim = null;
    later.push(() => {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.SCISSOR_TEST);
    });
  }

  /**
   * Turns a device's commands into its maps. Says nothing if it's waiting on fields, how much margin it needs if its
   * canvas is too small, and otherwise how much of it needs light again.
   */
  /**
   * How tall what a device draws stands, mm, with what its glass adds, and the margin its canvas needs for that, css px. A tall device
   * throws a long shadow, and the canvas has to hold it, with room to fade out. That sets the size of everything, and what's sharp at
   * it, so the GPU does nothing until it's known.
   */
  private reach(plate: Plate, commands: Command[], stands: number, seen: Neighbour[], around: Neighbour[]): { peak: number; glass: number; margin: [number, number] } {
    const d = plate.spec;
    let peak = stands, glass = 0;
    for (const c of commands) {
      if (c.op === 'glass') glass = Math.max(glass, c.height);
      else if ('zTop' in c) peak = Math.max(peak, tallest(c));
    }
    // What it sees of the other faces of its body stands on it as much as what it drew, whether or not they've drawn: how tall is in where
    // they lie, so its own height never waits on them.
    for (const n of around) peak = Math.max(peak, n.hi);
    // A little over, for what parts lift on top of their own height.
    peak += glass + 1;
    const F = frame(d);
    const past = commands.reduce((n, c) => {
      if (c.op !== 'surface' || !(c.bridge || c.rest)) return n;
      const b = extent(c);
      return Math.max(n, d.x - b.x, d.y - b.y, b.x + b.w - F.right, b.y + b.h - F.bottom);
    }, 0);
    // What hangs past the device throws a shadow from out there, and what it sees of the others is drawn out there.
    const beyond = seen.reduce((n, { box: b }) => Math.max(n, d.x - b.x / MM, d.y - b.y / MM, b.x / MM + b.w / MM - F.right, b.y / MM + b.h / MM - F.bottom), 0);
    // One that throws no shadow on the page, as a side, has none to hold. None of it reaches past what the window can show.
    // Making maps only with nothing here to light them, there's no shadow to hold. A player throws its own on the canvas, as the light pass does.
    const need = (Math.ceil((d.cast > 0 ? peak : 0) / 0.75 / MM) + 36) + Math.ceil(Math.max(past, beyond, 0));
    return { peak, glass, margin: [Math.min(need, d.room[0]), Math.min(need, d.room[1])] };
  }

  /** Whether a canvas with this margin has less round it than a device needs. */
  private narrow(d: PlateSpec, [mx, my]: [number, number]): boolean {
    return mx > d.x || my > d.y;
  }

  paint(plate: Plate, job: PaintJob): Painted {
    this.store.use(plate);
    const { gl, recorder } = this, { later } = recorder, { u, program } = this.mat, d = plate.spec;
    const { commands, began, stands, fixed, partial, moved, coloured, pictures, hot, stood, redrawn } = job;
    let remade = !!job.remade;
    // A picture changes only what glows, if the screen gives light and leaves its colour alone, and nothing else there glows.
    const glowing = pictures.filter(c => {
      if (c.kind !== 'crt' && c.kind !== 'oled') return false;
      const b = extent(c);
      return !commands.some(o => o !== c && glows(o) && meets(extent(o), b));
    });
    for (const c of pictures) if (!glowing.includes(c)) coloured.push(extent(c));
    // Frost reads back what is around it, so blurred frost repaints in full. A clear lens only reads
    // what's under it, so it joins the repaint. A big move saves nothing either way.
    const k = d.pw / d.cw, frost = commands.filter(c => c.op === 'frost');
    for (const c of frost) {
      if (c.blur === 0 && c.zoom >= 1 && moved.some(b => meets(extent(c), b))) moved.push(extent(c));
      else if (c.blur === 0 && c.zoom >= 1 && coloured.some(b => meets(extent(c), b))) coloured.push(extent(c));
    }
    let boxes: Box[] | null = partial ? apart([...moved, ...coloured]) : null;
    const parts = !!boxes?.length;
    if (boxes && boxes.reduce((n, b) => n + b.w * b.h, 0) > d.cw * d.ch * 0.5) boxes = null;
    if (boxes?.some(b => frost.some(c => c.blur > 0 && meets(grow(extent(c), c.blur * 3), b)))) boxes = null;
    // A bridging sheet reads around itself too, and what's copied for it holds whatever stood there last.
    if (boxes?.some(b => commands.some(c => c.op === 'surface' && c.bridge > 0 && meets(extent(c), b)))) boxes = null;
    // A pane is square to the page, and one turned that looks the same, a round one or one turned a half turn, is square too.
    const panes: GlassCommand[] = [], over = new Map<Command, number>(), squared = new Map<Command, RectShape>();
    for (const c of commands) {
      if (c.op === 'glass') {
        const square = c.shape.type === 'rect' ? upright(c.shape) : null;
        if (square && !(c.bend && c.bend.k >= 0)) {
          panes.push(c);
          squared.set(c, square);
          // A pane lies on the tallest thing under it so far, whatever that has on its surface.
          const b = extent(c);
          over.set(c, commands.slice(0, commands.indexOf(c)).reduce((top, o) => o.op !== 'glass' && 'zTop' in o && meets(extent(o), b) ? Math.max(top, tallest(o)) : top, 0));
        }
      }
    }
    // Biggest first for the cut, then back in painter's order, so reflections stack as they were drawn.
    const kept = new Set([...panes].sort((a, b) => squared.get(b)!.hw * squared.get(b)!.hh - squared.get(a)!.hw * squared.get(a)!.hh).slice(0, PANES));
    plate.paned = kept;
    plate.panes = panes.filter(c => kept.has(c)).flatMap(c => {
      const { height, bevel, curve, film, rim, tint, coat, chamfer, reflect } = c, r = squared.get(c)!;
      return [r.cx, r.cy, r.hw, r.hh, r.radius, height / (bevel * MM), bevel, curve, Math.max(rim / MM, 1), ...tint, coat, film, over.get(c)! + height, chamfer[0] / MM, chamfer[1], reflect];
    });
    this.broke(plate, commands, panes.filter(c => kept.has(c)), squared);
    const seen = this.beside(plate), { peak, glass, margin } = this.reach(plate, commands, stands, seen, this.beside(plate, true));
    plate.peak = peak;
    const tall = plate.peak > MAX_HEIGHT ? MAX_HEIGHT * 2 ** Math.ceil(Math.log2(plate.peak / MAX_HEIGHT)) : MAX_HEIGHT;
    // What the map holds was written to the old range, so it has to be written again.
    if (tall !== plate.tall) boxes = null;
    plate.tall = tall;
    // What a paint works in was given back: it's made again, and all of it painted into it. One of only what glows needs none of it.
    if (boxes?.length && plate.tex && !plate.tex.S) { boxes = null; remade = true; }
    if (!boxes && this.narrow(d, margin) && !fixed) return { margin };
    // Fields are most of what a device costs to arrive, and it's the GPU that pays, after the clock has stopped. So they go by what
    // they cost: too many for this frame, and the device makes them over the next few and shows when it has them all.
    // One with a field held at another sharpness draws with that meanwhile, as a field magnified a step keeps its edges, and is drawn
    // again when they're all made: a zoom shows at once.
    if (!boxes) {
      const wanted = this.fields.missing(commands.flatMap(c => 'shape' in c && c.shape.type === 'field' ? [c.shape] : []), d.dpr);
      const cost = wanted.reduce((n, f) => n + this.fields.cost(f, d.dpr), 0);
      if (wanted.length && cost > this.fieldRoom) {
        plate.wanted = wanted;
        if (!wanted.every(f => this.fields.held(f))) return null;
        plate.stood = this.making(plate);
      } else {
        this.fieldRoom -= cost;
        // A flood is the most a paint holds at once: not beside another device's maps. Only when it floods now and paints after it,
        // or a device making its fields over several frames takes from one being read on each, and that one paints all of itself each time.
        if (wanted.length && !plate.tex?.S) this.take(plate);
        this.fields.make(wanted, d.dpr);
        plate.stood = false;
      }
    }
    // Its maps cover what it draws. Drawn past them, they're made again where it is now, and all of it with them.
    const map = this.mapFor(plate, commands, seen), m = plate.map;
    if (!plate.tex) plate.map = map;
    else if (map.x < m.x || map.y < m.y || map.x + map.w > m.x + m.w || map.y + map.h > m.y + m.h) {
      const mask = plate.tex.mask, blank = plate.tex.blank;
      plate.tex.mask = null!;
      this.free(plate);
      plate.map = map;
      this.allocTextures(plate, mask);
      plate.tex!.blank = blank;
      boxes = null;
    }
    if (!boxes) this.prepare(plate);
    const tex = plate.tex!;
    if (!boxes && !tex.S) this.work(plate);
    if (!tex.E && commands.some(glows)) {
      tex.E = this.target(plate, gl.SRGB8_ALPHA8, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, tex.E, 0);
      tex.targets[3] = gl.COLOR_ATTACHMENT3;
    }
    // Only light reads undersides: the engine's, and a player's while a body leans, is at an angle or turns. Making maps only with no
    // player, nothing does.
    if (!tex.U && this.undersides && this.player && commands.some(c => c.op === 'surface' && c.mid)) {
      tex.U = this.target(plate, gl.R16F, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT6, gl.TEXTURE_2D, tex.U, 0);
      tex.targets = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, tex.targets[3]!, tex.targets[4] ?? gl.NONE, tex.targets[5] ?? gl.NONE, gl.COLOR_ATTACHMENT6];
    }
    if (boxes) this.stats.partial++;
    this.block.two(this.block.at.uCanvas!, d.cw, d.ch);
    this.block.four(this.block.at.uMap!, ...this.mapUv(plate));
    later.length = 0;
    const only = boxes?.length ? boxes.reduce((a, b) => join(a, b)!) : null;
    // What frost and bridges read of the copies made for them, on the canvas: their own box, out by their spiral of taps and the
    // mip level those taps read at, and a lens that shrinks what it shows out by what it takes in. Nothing else is copied.
    const frostSeen = frost.reduce<Box | null>((all, c) => {
      const b = extent(c), out = c.zoom < 1 ? Math.max(b.w, b.h) * (1 / c.zoom - 1) / 2 : 0;
      return join(all, grow(b, out + c.blur * 2 + 4));
    }, null);
    const bridgeSeen = commands.reduce<Box | null>((all, c) => c.op === 'surface' && c.bridge ? join(all, grow(extent(c), c.bridge * 3 + 4)) : all, null);
    // Where those copies lie is said now, as each draw keeps what it's told here: a copy given back, or outgrown, is made while they're drawn.
    this.block.four(this.block.at.uBackBox!, ...this.cropUv(plate, this.copyBox(plate, tex.back?.box, frostSeen)));
    this.block.four(this.block.at.uUnderBox!, ...this.cropUv(plate, this.copyBox(plate, tex.under?.box, bridgeSeen)));
    for (const b of boxes ?? [null]) {
      later.push(() => {
        if (b) this.clipMap(plate, b);
        for (let i = 0; i < tex.targets.length; i++) gl.clearBufferfv(gl.COLOR, i, [0, 0, 0, 0]);
      });
      let stale = true;
      for (const c of commands) {
        if (b && !meets(extent(c), b)) continue;
        if (c.op !== 'frost') stale = true;
        else if (stale) {
          later.push(() => this.capture(plate, frost.some(c => c.blur > 0), only, frostSeen!));
          stale = false;
        }
        if (c.op === 'surface' && c.bridge) later.push(() => this.level(plate, grow(extent(c), c.bridge * 2), bridgeSeen!));
        if (c.op === 'surface' && c.section) this.section(plate, c, seen);
        else recorder.draw(c, plate);
      }
    }
    // Nothing else there glows, so a clear target is what's under the picture. What's over it still covers it.
    if (boxes && glowing.length) {
      later.push(() => gl.drawBuffers([gl.NONE, gl.NONE, gl.NONE, gl.COLOR_ATTACHMENT3]));
      for (const c of glowing) {
        const b = extent(c);
        later.push(() => {
          this.clipMap(plate, b);
          gl.clearBufferfv(gl.COLOR, 3, [0, 0, 0, 0]);
        });
        recorder.draw(c, plate);
        for (const o of commands.slice(commands.indexOf(c) + 1)) if (o.op !== 'glass' && meets(extent(o), b)) recorder.draw(o, plate);
      }
    }

    if (d.body) {
      plate.made = commands;
      // A paint of only what glows, of a face that gave back what a paint works in, draws no heights: there are none here to keep or to
      // draw the others over, and the next paint of all of it does both.
      if (plate.tex!.S) this.across(plate, seen, boxes);
    }
    recorder.drawing = null;
    // Fields build through their own framebuffer while recording, so ours is only bound now.
    this.block.send();
    gl.bindFramebuffer(gl.FRAMEBUFFER, plate.tex!.fbo);
    // Drawn where it is on the canvas, onto maps that start some way into it.
    gl.viewport(-plate.map.x, -plate.map.y, d.pw, d.ph);
    gl.drawBuffers(tex.targets);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(program);
    gl.uniform1i(u.uMask, 0);
    gl.uniform1i(u.uField, 1);
    gl.uniform1i(u.uScreen, 2);
    gl.uniform1i(u.uBackA, 3);
    gl.uniform1i(u.uBackE, 4);
    gl.uniform1i(u.uBackS, 5);
    gl.uniform1i(u.uBackH, 6);
    gl.uniform1i(u.uBackN, 10);
    gl.uniform1i(u.uDamage, 11);
    gl.uniform1i(u.uOwn, 8);
    gl.uniform1i(u.uRows, 9);
    gl.uniform1i(u.uClipField, 7);
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.own?.H ?? this.dark);
    // The light pass leaves channels bound here, and sampling what we draw into is an error.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE13);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.under?.N ?? null);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.screenTex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.back?.A ?? null);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.back?.E ?? null);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.back?.S ?? null);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.under?.H ?? null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.mask);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const step of later) step();
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    gl.disable(gl.SCISSOR_TEST);
    // What the paint copied on its way goes before anything more is made, so the two are never held at once.
    this.freeScratch(plate);
    // The copies frost and bridges read stay with what a paint works in, and one made with that gone, for what glows, goes as it came.
    if (!plate.tex!.S) { this.freeBack(plate); this.freeUnder(plate); }
    // A height that stood still leaves its mips, and what the room can see from it, as they were.
    const shape = moved.length ? apart(moved).reduce((a, b) => join(a, b)!) : null, whole = !boxes;
    if (tex.H && (whole || shape)) this.mips(tex.H);
    if (tex.N && (whole || shape)) this.mips(tex.N);
    if (d.grime > 0 && (whole || boxes!.length)) this.weather(plate, boxes);
    if (whole || only) this.mips(tex.A);
    if (tex.E) this.glowDrawn = true;
    if (tex.D && (whole || shape)) this.mips(tex.D);
    gl.disable(gl.SCISSOR_TEST);
    if (tex.S && (whole || shape)) this.occlusion(plate, shape);
    gl.disable(gl.SCISSOR_TEST);
    if (tex.S) this.condition(plate);
    if (this.probe) this.wait(0, 0);
    this.stats.paintMs += performance.now() - began;
    this.stats.paints++;
    plate.painted++;
    if (whole) {
      plate.tex!.tops.fill(0);
      this.raise(plate, commands, glass + 1, seen);
      // The others only need to look again when all of this face was drawn again for what's on it.
      // Nor when it had already said what it would draw, and they drew that, nor when it's what it last drew, made again for what a
      // paint works in: each of them drawing again for that would take it from this one, which would make it again, and round.
      if (!plate.reedge && !plate.known && !remade) plate.shaped++;
      plate.known = false;
    } else if (shape) this.raise(plate, redrawn!, glass + 1);
    plate.reedge = false;
    // A change relights more than it repaints, for the shadows and reflections around it, and a
    // lamp changing brightness reaches further still. A device already waiting on a full relight
    // stays that way.
    // Only glass shows a thing further off than its shadow falls: everywhere else, what's reflected is the room.
    const far = plate.panes.length ? FAR : Math.min(NEARBY + ((stood + 1) * SHADOW) / MM, FAR);
    const reached = whole ? [] : [...moved.map(b => grow(b, far)), ...coloured.map(b => grow(b, NEARBY))];
    const lit = reached.reduce<Box | null>((a, b) => join(a, b), null);
    // Asked to paint part of it, it's live, whether or not that came out as all of it: see `spare`.
    // A paint of part of it by whoever holds it, a spring or a screen being read, is not the device being live.
    if (parts && !plate.keep) this.rest(plate);
    return { all: whole || hot, box: lit };
  }

  private freeBack(plate: Plate): void {
    const b = plate.tex?.back;
    if (!b) return;
    if (!this.lost) { for (const x of [b.A, b.E, b.S]) this.gl.deleteTexture(x); this.gl.deleteFramebuffer(b.fbo); }
    plate.tex!.back = null;
  }

  private freeUnder(plate: Plate): void {
    const u = plate.tex?.under;
    if (!u) return;
    if (!this.lost) { for (const x of [u.H, u.N]) if (x) this.gl.deleteTexture(x); for (const f of [u.fbo, u.nfbo]) if (f) this.gl.deleteFramebuffer(f); }
    plate.tex!.under = null;
  }

  /** What a face kept of itself and what a paint's depth was in, given back: see `Renderer`. A face without its own heights paints all of
   * itself the next time. The copies frost and bridges read are not: a paint of part of a plate reads round its box in them, what was
   * under the frost there when all of it was last painted, so they stay as long as what a paint works in does, and go with it in `spare`. */
  private freeScratch(plate: Plate): void {
    const t = plate.tex;
    if (!t || this.lost) return;
    const { gl } = this, { own, deep } = t;
    if (own) { gl.deleteTexture(own.H); gl.deleteFramebuffer(own.fbo); }
    if (deep) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
      gl.deleteRenderbuffer(deep);
    }
    t.own = null;
    t.deep = null;
    // And what a flood works in, which only making fields again needs.
    this.fields.release();
  }

  /** Where the torch falls on a device, in its own space. */
  private beam(d: PlateSpec, r: DOMRect, scene: Scene): Beam {
    const T = TORCHES[scene.handheld], P = handOver(scene, r), z = r.width / d.cw;
    const tx = ((P.x - r.left) / z) * MM, ty = ((P.y - r.top) / z) * MM;
    // Held nearer to a small thing, though not so near that everything is lit alike: a big object takes a smaller pool.
    const F = frame(d), hold = HOLD * (F.long * MM / 150) ** 0.75 * T.hold;
    // Whoever holds it stands in front of the object, so a pool stretches as it's thrown further, and shadows swing
    // around the hand rather than running away from the pointer.
    const bx = F.cx * MM, by = F.cy * MM + hold * 0.7, t = performance.now() / 1000;
    const shake = T.flicker ? Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 23.3 + 2) * 0.2 : 0;
    const sx = bx + (tx - bx) * T.arm + shake * hold * 0.03, sy = by + (ty - by) * T.arm, sz = hold * 0.85;
    const far = Math.hypot(tx - sx, ty - sy, sz), reach = far * Math.tan(Math.min(T.cone * 2, 1.35)) * 1.6;
    return { sx, sy, sz, ax: (tx - sx) / far, ay: (ty - sy) / far, az: -sz / far, far, shake, tx, ty,
      pool: { x: (tx - reach) / MM, y: (ty - reach) / MM, w: (reach * 2) / MM, h: (reach * 2) / MM } };
  }

  /**
   * The flashes and flames that light a device most, in its own space: mm across, down and up, and the square of half their size,
   * given less than nothing for a glowing face on another device, which sits level with this one's face.
   */
  private points(plate: Plate, r: DOMRect): { n: number; at: Float32Array; color: Float32Array } {
    const all = pointLights(), d = plate.spec;
    if (!all.size && !this.emitters.length) return NO_POINTS;
    const at = new Float32Array(POINTS * 4), color = new Float32Array(POINTS * 3);
    // About the middle of the canvas.
    const z = r.width / d.cw, F = frame(d), mx = r.left + F.cx * z, my = r.top + F.cy * z;
    // How much each gives at the middle of the device, to keep the strongest, first come first on a tie. A page can glow in
    // thousands of places and only a few are kept, so the rest are passed over as they come, not listed and sorted.
    const ranked: { x: number; y: number; half: number; up: number; color: readonly number[]; flat: boolean; gives: number }[] = [];
    const consider = (x: number, y: number, half: number, up: number, color: readonly number[], flat: boolean, most: number) => {
      const gives = (most * half * half) / (half * half + (x - mx) ** 2 + (y - my) ** 2 + up * up);
      if (ranked.length === POINTS && !(gives > ranked[POINTS - 1]!.gives)) return;
      let i = ranked.length;
      while (i > 0 && ranked[i - 1]!.gives < gives) i--;
      ranked.splice(i, 0, { x, y, half, up, color, flat, gives });
      if (ranked.length > POINTS) ranked.pop();
    };
    for (const l of all) {
      const [x, y] = placeOf(l.at), half = l.reach / 2;
      consider(x, y, half, l.height ?? half, l.color, false, Math.max(...l.color));
    }
    // Not its own glow.
    for (const e of this.emitters) if (e.from !== plate) consider(e.at[0], e.at[1], e.half, 0, e.color, true, Math.max(e.color[0], e.color[1], e.color[2]));
    ranked.forEach(({ x, y, half, up, color: c, flat }, i) => {
      const k = MM / z;
      at.set([(x - r.left) * k, (y - r.top) * k, d.face + up * k, (flat ? -1 : 1) * (half * k) ** 2], i * 4);
      color.set(c, i * 3);
    });
    return { n: ranked.length, at, color };
  }

  /** Whether a torch moving elsewhere on the page has anything to do with this. */
  poolMoved(plate: Plate, scene: Scene, r: DOMRect): boolean {
    const d = plate.spec, on = (b: Box) => b.x < d.cw && b.y < d.ch && b.x + b.w > 0 && b.y + b.h > 0;
    const { pool } = this.beam(d, r, scene), was = on(plate.pool!);
    plate.pool = pool;
    return was || on(pool);
  }

  /** Lights a device where it's seated, by the player. False with nothing to light yet, and its picture stays as it was. */
  light({ plate, rect: r, lighting, ctx }: Turn, scene: Scene): boolean {
    const { gl } = this, canvas = this.sheet, d = plate.spec, seat = plate.seat!, { pw, ph, scale } = seat;
    // Where the hand is, as this device sees it. A page may hang it somewhere else over this one, so two copies are lit alike.
    const P = handOver(scene, r);
    const { all, full, ambient, look, lights, torch: held } = scene;
    const t0 = performance.now();
    // A pool only roughened where it went, so that's all that needs putting right.
    let box = all ? null : d.lightDirty ? d.lightBox : plate.roughBox;
    const k = pw / d.cw;
    // Its grain falls the same wherever it's sitting, so a part lit again shows no seam against the rest.
    const bottom = canvas.height - seat.y - ph, here = () => gl.viewport(seat.x, bottom, pw, ph);
    // A moving lamp or torch leaves the room where it is, and a moving viewer doesn't.
    // A viewer leaning over one object sees it land somewhere new each frame, and a bake or a held picture has its landings fixed.
    const leaning = leans(d, scene);
    const points = this.points(plate, r);
    const play = this.player?.take(plate, { plate, rect: r, lighting, ctx }, scene, { leaning, torch: held * P.i > 0, points: points.n, linear: this.staged && !ctx, relief: this.relief }) ?? null;
    if (!play) return false;
    // Packed, so what its paint worked in can go.
    this.settle(plate);
    const lit = getLighting(lighting), { room, brush } = this.rooms.for(lit);
    // The viewer stands back from anything big, as a photographer would. Up close the far ends of a
    // long object would lean out of the boxes a hand presses.
    const viewer = Math.max(VIEWER, frame(d).long * MM * (d.lean || d.turns ? LONG_LENS : STAND_BACK));
    const sweep = Math.tan((look * Math.PI) / 180) * viewer * P.i;
    const rest = Math.tan((scene.tilt * Math.PI) / 180) * viewer;
    // Only this object's viewer moves, by how far the hand is across it. The lit face stays where the page put it, so what stands
    // above it moves by its height over the viewer's lean and the page's boxes stay on the face.
    let leanX = 0, leanY = 0;
    // Edge on a cosine is nothing, and the stretch below is one over it. Past that it's the face turned away.
    const spin = Math.sign(d.spin) * (Math.abs(d.spin) < Math.PI / 2 ? Math.min(Math.abs(d.spin), EDGE_ON) : Math.max(Math.abs(d.spin), Math.PI - EDGE_ON));
    if (leaning) {
      const z = r.width / d.cw, most = Math.tan((d.lean * Math.PI) / 180) * viewer;
      if (d.spin) {
        leanX = Math.tan(spin) * viewer;
        leanY = d.turn[1] * most;
      } else if (scene.carried) {
        const nx = (P.x - r.left - (d.x + d.w / 2) * z) / ((d.w / 2) * z), ny = (P.y - r.top - (d.y + d.h / 2) * z) / ((d.h / 2) * z);
        const by = (most * d.hand) / Math.max(Math.hypot(nx, ny), 1);
        leanX = nx * by;
        leanY = ny * by;
      } else {
        leanX = d.turn[0] * most;
        leanY = d.turn[1] * most;
      }
    }
    // Set at an angle, or off to one side of the eye in a room with depth, it's seen from the side, as far round as its relief can show.
    if (d.angle[0] || d.angle[1] || d.eye[0] || d.eye[1]) {
      const [ex, ey, ez] = settled(d.angle, d.eye), off = Math.hypot(ex, ey) / ez, k = Math.min(1, Math.tan((ANGLE_SEEN * Math.PI) / 180) / off) / ez;
      leanX += ex * k * viewer;
      leanY += ey * k * viewer;
    }
    const T = TORCHES[scene.handheld];
    const at = held * P.i > 0 ? this.beam(d, r, scene) : null;
    const power = held * P.i * T.power * (1 + (at?.shake ?? 0) * T.flicker);
    if (at) {
      // A held torch lights only its pool, so moving it needs only where the pool was and where it is.
      // Anything repainted under it comes along.
      if (all && !full && !lights && !look && plate.pool && (!d.lightDirty || d.lightBox)) box = join(join(plate.pool, at.pool), d.lightDirty ? d.lightBox : null);
      plate.pool = at.pool;
    } else plate.pool = null;
    const was = plate.rough;
    // Lit the quick way it looks as it would lit properly, so only one lit softer than it's shown has its light still to come.
    plate.rough = scale < this.fit(d);
    plate.roughBox = plate.rough && box && (!was || plate.roughBox) ? join(plate.roughBox, box) : null;
    const use = ({ u, program }: Program, torch = at) => {
    gl.useProgram(program);
    gl.uniform2f(u.uCss, d.cw, d.ch);
    gl.uniform4f(u.uMap!, ...this.mapUv(plate));
    // The viewer is over the object and the lamp is placed from it, by its size. So a watch and a drum machine are lit
    // alike, wherever they are and however big they're shown, and scrolling only moves a finished picture.
    const F = frame(d), cx = F.cx * MM, cy = F.cy * MM, long = F.long * MM;
    // The canvas's edges, for the shade that fades out toward them.
    gl.uniform4f(u.uFrame!, 0, 0, d.cw, d.ch);
    const px = (P.x - scene.width / 2) / (scene.width / 2), py = (P.y - scene.height / 2) / (scene.height / 2);
    gl.uniform3f(u.uCam, cx - rest * 0.44 + px * sweep + leanX, cy + rest * 0.9 + py * sweep + leanY, viewer);
    // The player's eye rests right over every point, so all it takes is how far this one has gone from there.
    gl.uniform2f(u.uLean ?? null, leanX, leanY);
    gl.uniform1f(u.uPeak, plate.peak);
    gl.uniform1f(u.uTall ?? null, plate.tall);
    gl.uniform1f(u.uFace, d.face);
    // A body turning over turns about its middle, and the lit face narrows.
    gl.uniform2f(u.uSpin!, 1 / Math.cos(spin), d.spin ? d.axis : 0);
    gl.uniform3f(u.uOwn!, ...d.owns);
    gl.uniform2f(u.uRound!, Math.sin(spin), Math.cos(spin));
    gl.uniform1f(u.uLift, Math.max(d.face - d.cast, 0));
    gl.uniform4f(u.uBody, d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2);
    gl.uniform1i(u.uPanes, plate.panes.length / PANE_SIZE);
    gl.uniform1i(u.uCracked ?? null, plate.broken ? 1 : 0);
    // A picture the stage keeps is light, for its camera. One copied to a canvas of its own is finished here.
    gl.uniform1i(u.uLinear, this.staged && !ctx ? 1 : 0);
    if (plate.panes.length) gl.uniform1fv(u['uPane[0]']!, plate.panes);
    gl.uniform1f(u.uDpr, d.dpr * scale);
    // The lamp hangs over the pointer, so light crosses an object and it stays put, and shadows fall away from the hand on
    // every side. It leans back to its own place, mostly, when no hand is there. Measured from the object, the same both ways.
    const sway = lights * d.hand, reach = Math.sqrt(scene.width * scene.height) / 2, lean = 1 - sway * 0.65, zr = r.width / d.cw;
    const lx = (P.x - r.left - F.cx * zr) / reach, ly = (P.y - r.top - F.cy * zr) / reach;
    // A lamp stays in the room as the body turns under it, so from the body's side it goes round the other way.
    // Set at an angle, the room stays where it is, so the lamp is round the other way from the device's side.
    const [ax, ay, az] = settled(d.angle, [long * (lit.lamp[0] * lean + lx * lit.sway * sway), long * (lit.lamp[1] * lean + ly * lit.sway * sway), long * 3]);
    const kx = ax, kz = az - (d.face - d.axis), sn = Math.sin(spin), cs = Math.cos(spin);
    gl.uniform3f(u.uKey, cx + kx * cs + kz * sn, cy + ay, d.face - d.axis - kx * sn + kz * cs);
    gl.uniform1f(u.uLamp, 5.2 * lit.power);
    gl.uniform1f(u.uLampSoft, lit.soft);
    gl.uniform1f(u.uFill, lit.fill);
    gl.uniform1f(u.uPageShade, lit.shadow);
    gl.uniform3f(u.uRoomColor, ...lit.color);
    gl.uniform1f(u.uRoom, ambient);
    if (torch) {
      gl.uniform4f(u.uTorch, torch.sx, torch.sy, torch.sz, power);
      gl.uniform3f(u.uAim, torch.ax, torch.ay, torch.az);
      gl.uniform4f(u.uBeam, T.core, T.flood, T.edge, T.spill);
      gl.uniform4f(u.uCone, T.cone, torch.sz, T.rings, T.fluoresce);
      gl.uniform3f(u.uTint, ...T.color);
    } else gl.uniform4f(u.uTorch, 0, 0, 1, 0);
    gl.uniform1i(u.uPoints, points.n);
    if (points.n) {
      gl.uniform4fv(u['uPoint[0]'] ?? null, points.at);
      gl.uniform3fv(u['uPointColor[0]'] ?? null, points.color);
    }
    gl.uniform1i(u.uDebug, d.debug);
    gl.uniform1f(u.uSplit, d.split < 0 ? -1 : (d.x + d.w * d.split) * MM);
    };
    // What's under anything standing clear, and the room as grooves smear it, where the player reads them.
    gl.activeTexture(gl.TEXTURE12);
    gl.bindTexture(gl.TEXTURE_2D, plate.tex!.U ?? this.dark);
    // Its broken glass, which the light finds in the panes and coats.
    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, plate.broken?.cracks ?? this.dark);
    gl.activeTexture(gl.TEXTURE13);
    gl.bindTexture(gl.TEXTURE_2D, plate.broken?.faces ?? this.dark);
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, brush);
    this.player!.shadows(plate, pw, ph, p => use(p));
    here();
    use(play);
    gl.uniform2f(play.u.uShift!, -seat.x, seat.y);
    this.player!.bind(plate, room, this.dark);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    if (box) this.clip(box, k, bottom + ph, seat.x);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
    gl.activeTexture(gl.TEXTURE0);
    if (this.probe) this.wait(seat.x, bottom);
    seat.box = box;
    this.stats.lightMs += performance.now() - t0;
    this.stats.lights++;
    return true;
  }

  /** Takes a lit device off the shared canvas. */
  private copyOut(turn: Turn): void {
    const { plate, ctx: c } = turn, t0 = performance.now(), { x: left, y: top, pw, ph, box } = plate.seat!, canvas = this.canvas!, d = plate.spec, ctx = c!;
    if (ctx.canvas.width !== d.pw) ctx.canvas.width = d.pw;
    if (ctx.canvas.height !== d.ph) ctx.canvas.height = d.ph;
    ctx.globalCompositeOperation = 'copy';
    if (box) {
      const { x, y, w, h } = pixels(box, d.pw / d.cw), f = pw / d.pw;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(canvas, left + x * f, top + y * f, w * f, h * f, x, y, w, h);
      ctx.restore();
    } else ctx.drawImage(canvas, left, top, pw, ph, 0, 0, d.pw, d.ph);
    // Past what it copies, scaling meets whatever was there, and a picture ends clear anyway.
    ctx.clearRect(d.pw - 2, 0, 2, d.ph);
    ctx.clearRect(0, d.ph - 2, d.pw, 2);
    this.stats.copyMs += performance.now() - t0;
    this.stats.copies++;
  }

  /** Copies a lit device to its own canvas while the canvas is a stage, by way of the stage, as much at a time as the stage holds.
   * The stage is drawn again after, so what passes through never shows. */
  private copyThrough(turn: Turn): void {
    const { plate, ctx: c } = turn, t0 = performance.now(), { gl } = this, stage = this.canvas!, d = plate.spec, ctx = c!, { x: left, y: top, pw, ph, box } = plate.seat!;
    if (ctx.canvas.width !== d.pw) ctx.canvas.width = d.pw;
    if (ctx.canvas.height !== d.ph) ctx.canvas.height = d.ph;
    const f = pw / d.pw, bottom = this.sheet.height - top - ph;
    // What changed, in the device's canvas pixels.
    const to = box ? pixels(box, d.pw / d.cw) : { x: 0, y: 0, w: d.pw, h: d.ph };
    const sw = Math.max(Math.floor(stage.width / Math.max(f, 1)), 1), sh = Math.max(Math.floor(stage.height / Math.max(f, 1)), 1);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.bench);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    ctx.globalCompositeOperation = 'copy';
    for (let y = to.y; y < to.y + to.h; y += sh) {
      for (let x = to.x; x < to.x + to.w; x += sw) {
        const w = Math.min(sw, to.x + to.w - x), h = Math.min(sh, to.y + to.h - y);
        const bw = Math.round(w * f), bh = Math.round(h * f);
        gl.blitFramebuffer(left + Math.round(x * f), bottom + ph - Math.round((y + h) * f), left + Math.round(x * f) + bw, bottom + ph - Math.round((y + h) * f) + bh, 0, stage.height - bh, bw, stage.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(stage, 0, 0, bw, bh, x, y, w, h);
        ctx.restore();
      }
    }
    ctx.clearRect(d.pw - 2, 0, 2, d.ph);
    ctx.clearRect(0, d.ph - 2, d.pw, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    this.stats.copyMs += performance.now() - t0;
    this.stats.copies++;
  }

  /** Keeps a lit device's picture on the GPU, for the stage to show. A copy on the GPU, so it costs next to nothing. */
  private keep({ plate }: Turn): void {
    const t0 = performance.now(), { gl } = this, d = plate.spec, { x: left, y: top, pw, ph } = plate.seat!;
    let p = plate.picture, box = plate.seat!.box;
    if (!p || p.pw !== d.pw || p.ph !== d.ph) {
      this.freePicture(plate);
      this.making_(plate, d.pw * d.ph * 8 * (4 / 3));
      this.shown(plate);
      const tex = gl.createTexture()!, fbo = gl.createFramebuffer()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // A picture holds more pixels than it's shown with, often three times as many across, and shown from one size only it
      // drops what falls between: noise a shadow is dithered with, and the fine print, which come out as grain and jaggies.
      // Light, as the stage's camera shows it, so its smaller sizes are the light averaged, as the eye averages it.
      gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(d.pw, d.ph))) + 1, gl.RGBA16F, d.pw, d.ph);
      clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      p = plate.picture = { tex, fbo, pw: d.pw, ph: d.ph, box: [0, 0, 0, 0, 0] };
      box = null;
    }
    const f = pw / d.pw, bottom = this.sheet.height - top - ph, to = box ? pixels(box, d.pw / d.cw) : { x: 0, y: 0, w: d.pw, h: d.ph };
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.bench);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.fbo);
    // Rows count up from the bottom on both.
    gl.blitFramebuffer(left + to.x * f, bottom + ph - (to.y + to.h) * f, left + (to.x + to.w) * f, bottom + ph - to.y * f,
      to.x, d.ph - to.y - to.h, to.x + to.w, d.ph - to.y, gl.COLOR_BUFFER_BIT, f === 1 ? gl.NEAREST : gl.LINEAR);
    // Past what it copies, scaling meets whatever was there, and a picture ends clear anyway.
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.scissor(d.pw - 2, 0, 2, d.ph);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.scissor(0, 0, d.pw, 2);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.mips(p.tex);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    p.box = [d.x, d.y, d.cw, d.ch, d.w];
    this.stats.copyMs += performance.now() - t0;
  }

  /** GPU bytes a device's kept picture holds, with its smaller sizes. */
  pictureBytes(plate: Plate): number {
    const p = plate.picture;
    // Half floats, light for the stage's camera.
    return p ? p.pw * p.ph * 8 * (4 / 3) : 0;
  }

  /** Keeps only the smallest sizes of a device's picture, so it still shows, soft, whenever it comes back, at almost no cost however
   * many there are. Its next light makes it whole again. */
  shrink(plate: Plate): void {
    const p = plate.picture, side = p ? Math.max(p.pw, p.ph) : 0;
    if (!p || this.lost || side <= TOP) return;
    const { gl } = this, l = Math.ceil(Math.log2(side / TOP)), w = Math.max(Math.floor(p.pw / 2 ** l), 1), h = Math.max(Math.floor(p.ph / 2 ** l), 1);
    const tex = gl.createTexture()!, fbo = gl.createFramebuffer()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA16F, w, h);
    clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.mipFrom);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.tex, l);
    gl.disable(gl.SCISSOR_TEST);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    this.freePicture(plate);
    plate.picture = { tex, fbo, pw: w, ph: h, box: p.box };
    this.shown(plate);
  }

  /** Counts a plate's picture. Given back, it keeps its smallest sizes, so it shows, soft, whenever it comes back. */
  private shown(plate: Plate): void {
    this.store.hold(plate, 'picture', () => this.pictureBytes(plate), () => this.shrink(plate));
  }

  /** Waits for the GPU by reading a pixel of the bench back, for timing. On a stage the bench holds light, in floats. */
  private wait(x: number, y: number): void {
    const { gl } = this;
    if (this.staged) gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, this.pxLight);
    else gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
  }

  /** Lets go of a device's kept picture, as its own canvas shows it again. */
  forget(plate: Plate): void {
    this.freePicture(plate);
  }

  private freePicture(plate: Plate): void {
    const p = plate.picture;
    this.store.drop(plate, 'picture');
    plate.picture = null;
    if (!p || this.lost) return;
    this.gl.deleteTexture(p.tex);
    this.gl.deleteFramebuffer(p.fbo);
  }

  /** Puts the canvas in the page as a stage, which shows the pictures it's given itself, and moves light off it. Returns the canvas. */
  stage(): HTMLCanvasElement {
    if (!this.staged) {
      this.staged = true;
      const [width, height] = this.room;
      this.sheet = { width, height };
      this.makeBench();
    }
    if (!this.lost) setStage(this.gl);
    return this.canvas!;
  }

  /** Takes the canvas out of the page, and light goes back onto it. */
  unstage(): void {
    if (!this.staged) return;
    const { gl } = this, canvas = this.canvas!;
    this.staged = false;
    setStage(null);
    canvas.remove();
    canvas.width = this.sheet.width;
    canvas.height = this.sheet.height;
    if (!this.lost) {
      if (this.benchTex) gl.deleteTexture(this.benchTex);
      if (this.bench) gl.deleteFramebuffer(this.bench);
      this.lens?.free();
    }
    this.bench = this.benchTex = null;
    this.lens = null;
    this.sheet = canvas;
    for (const plate of this.plates) this.freePicture(plate);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private makeBench(): void {
    const { gl } = this;
    this.bench = gl.createFramebuffer();
    this.benchTex = null;
    this.sizeBench();
  }

  /** A texture can't change size in place, so a bigger bench is a new one. Only its size matters, as each frame clears it. */
  private sizeBench(): void {
    const { gl } = this, { width, height } = this.sheet;
    if (this.benchTex) gl.deleteTexture(this.benchTex);
    this.benchTex = null;
    this.making_(null, width * height * 8);
    this.benchTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.benchTex);
    // Light, for pictures the stage keeps. What's copied to a canvas of its own is finished in the light pass, and fits as well.
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, Math.max(width, 1), Math.max(height, 1));
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.benchTex, 0);
    // Everything lit this frame goes onto it, so whether the GPU took it is asked now, which waits for it, as sizing it is rare.
    // Refused, it's the window's size, which it's made at, until what's lit is drawn again within what the GPU said it holds.
    const floor = this.canvas!;
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE || (width <= floor.width && height <= floor.height)) return;
    this.store.refused();
    this.refusedBench = true;
    this.sheet.width = floor.width;
    this.sheet.height = floor.height;
    this.sizeBench();
  }

  /**
   * Draws the stage: each picture at its place in the window, in the order given, over what came before. `w` and `h` are the
   * stage's size in css px, and each shot's box is in css px from its corner.
   */
  show(shots: Shot[], w: number, h: number, ratio: number, left = 0, top = 0): void {
    const { gl } = this, canvas = this.canvas!, cw = Math.max(Math.round(w * ratio), 1), ch = Math.max(Math.round(h * ratio), 1);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    // Everything is drawn as light, and the camera makes the picture of it at the end.
    const lens = (this.lens ??= new Lens(gl));
    lens.begin(cw, ch);
    // What's drawn besides the pictures works first, and may hand back offsets the pictures are read through.
    const layers = stageLayers(), frame = layers.size ? { gl, w, h, left, top, ratio, target: lens.fbo } : null;
    let bend: WebGLTexture | null = null;
    if (frame) for (const l of layers) bend = l.before(frame) ?? bend;
    const { program, u } = bend ? this.bent : this.show_;
    // From css px of the stage to clip space, and back: a turn is given in the one and drawn in the other.
    const A = [(2 * ratio) / cw, 0, -1, 0, (-2 * ratio) / ch, 1, 0, 0, 1], Ai = [cw / (2 * ratio), 0, cw / (2 * ratio), 0, -ch / (2 * ratio), ch / (2 * ratio), 0, 0, 1];
    let turning: Turned | null = null, share = 1;
    const turn = (t: Turned | null, part = share) => {
      turning = t;
      share = part;
      const h = t ? times(A, times(t.h, Ai)) : FLAT;
      // Columns, as GL takes them.
      gl.uniformMatrix3fv(u.uH!, false, [h[0]!, h[3]!, h[6]!, h[1]!, h[4]!, h[7]!, h[2]!, h[5]!, h[8]!]);
      // What's read is premultiplied, so this takes its alpha down with its light.
      gl.uniform1f(u.uGain!, (t?.gain ?? 1) * share);
    };
    const ready = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, lens.fbo);
      gl.viewport(0, 0, cw, ch);
      gl.disable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.vao);
      gl.useProgram(program);
      gl.uniform1i(u.tP!, 0);
      turn(turning);
      if (bend) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bend);
        gl.uniform1i(u.tBend!, 1);
        gl.uniform2f(u.uStagePx!, cw, ch);
      }
      gl.activeTexture(gl.TEXTURE0);
    };
    if (frame) ready();
    else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform1i(u.tP!, 0);
      turn(null);
      gl.activeTexture(gl.TEXTURE0);
    }
    // On whole pixels of the screen, and a picture as big as it's shown is shown pixel for pixel: left, top, width and height, px.
    const placed = ({ picture, x, y, w: sw, h: sh }: Shot) => {
      const l = Math.round(x * ratio), t = Math.round(y * ratio);
      return [l, t, Math.abs(sw * ratio - picture.pw) < 1 ? picture.pw : sw * ratio, Math.abs(sh * ratio - picture.ph) < 1 ? picture.ph : sh * ratio] as const;
    };
    // Some of a picture, from px to px of the stage, read from the same place in it.
    const draw = (picture: Picture, [l, t, pw, ph]: readonly number[], x0: number, y0: number, x1: number, y1: number) => {
      if (x1 <= x0 || y1 <= y0) return;
      gl.uniform4f(u.uRect!, (x0 / cw) * 2 - 1, 1 - (y0 / ch) * 2, (x1 / cw) * 2 - 1, 1 - (y1 / ch) * 2);
      gl.uniform4f(u.uUv!, (x0 - l!) / pw!, 1 - (y0 - t!) / ph!, (x1 - l!) / pw!, 1 - (y1 - t!) / ph!);
      // A mm on the device is this much of its picture: the picture is its canvas box, css px of a quarter mm each.
      if (bend) gl.uniform2f(u.uUvPerMm!, 1 / (picture.box[2] * MM), 1 / (picture.box[3] * MM));
      // Its smear is a gaussian of its own size in css px, half the taps' reach.
      else gl.uniform1f(u.uSmear!, turning?.smear ? (2 * turning.smear * ratio) / pw! : 0);
      gl.bindTexture(gl.TEXTURE_2D, picture.tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    // Where it was drawn, on whole pixels as it was, so what a layer lines up with it lines up.
    const layered = ({ picture, plate, turned }: Shot, [l, t, pw, ph]: readonly number[]) => {
      // A layer lies on the page, and what's turned off it isn't where the layer would find it.
      if (!frame || turned) return;
      const bx = l! / ratio, by = t! / ratio, bw = pw! / ratio, bh = ph! / ratio, [mx, my, mox, moy] = plate.tex ? this.mapUv(plate) : [1, 1, 0, 0];
      const shot: StageShot = {
        // Given back once the player has packed them, they're the pack's: as tall as it shows them, a key it holds down included.
        height: plate.tex?.H ?? this.player?.stands(plate) ?? null,
        toMap: [mx / bw, my / bh, mox - (mx * bx) / bw, moy - (my * by) / bh],
        mmPerPx: (picture.box[2] * MM) / bw,
        face: plate.spec.face,
        box: [bx, by, bw, bh],
      };
      for (const layer of layers) layer.shot(shot, frame);
      ready();
    };
    for (const s of shots) {
      turn(s.turned ?? null, s.share ?? 1);
      const at = placed(s), [l, t, pw, ph] = at;
      draw(s.picture, at, l, t, l + pw, t + ph);
      layered(s, at);
    }
    if (frame) for (const l of layers) {
      l.after(frame);
      ready();
    }
    lens.finish(this.exposure, this.backdrop);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    this.stats.stages++;
  }

  /**
   * What the page gives off, `w` by `h` over the window, rows from the top: each device's glow where its canvas is, at the size
   * that shows. It comes back a frame or so later, without the GPU being waited on, so this hands over the last one that has,
   * or null, with the shots it was made from. Linear, as the glow is stored, where 1 is what a glow at full shows as. `shots` is
   * only called when a new one is made: finding where every device is costs a layout read each.
   */
  glowing<S extends GlowShot>(shots: () => readonly S[], w: number, h: number, again = true): Glow<S> | null {
    const { gl } = this;
    const done = this.glowBack;
    this.glowBack = null;
    // One on its way is enough: the next is asked for once it's back.
    if (this.glowReads.length || this.lost || !again) return done as Glow<S> | null;
    const made = shots();
    let g = this.glowAt;
    if (!g || g.w !== w || g.h !== h) {
      if (g) (gl.deleteFramebuffer(g.fbo), gl.deleteTexture(g.tex));
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      g = this.glowAt = { fbo, tex, w, h };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const { program, u } = this.show_;
    gl.useProgram(program);
    gl.uniform1i(u.tP!, 0);
    gl.uniform4f(u.uUv!, 0, 1, 1, 0);
    gl.uniformMatrix3fv(u.uH!, false, FLAT);
    gl.uniform1f(u.uGain!, 1);
    gl.uniform1f(u.uSmear!, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const { plate, x, y, w: sw, h: sh } of made) {
      const t = plate.tex;
      if (!t?.E) continue;
      // As shown: a lamp the player laid lit lights the room as a paint of it would.
      const E = this.player?.glows(plate) ?? t.E;
      // Upside down, so the first row read is the top of the window. What glows is only over the maps, at the one size.
      gl.uniform4f(u.uRect!, (x / w) * 2 - 1, (y / h) * 2 - 1, ((x + sw) / w) * 2 - 1, ((y + sh) / h) * 2 - 1);
      const m = plate.map, d = plate.spec;
      gl.uniform4f(u.uUv!, -m.x / m.w, (d.ph - m.y) / m.h, (d.pw - m.x) / m.w, -m.y / m.h);
      gl.uniform1f(u.uOver!, 1);
      gl.bindTexture(gl.TEXTURE_2D, E);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.uniform1f(u.uOver!, 0);
    gl.disable(gl.BLEND);
    const pbo = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.glowReads.push({ pbo, sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!, w, h, shots: made });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    // Sent now, as a fence nobody flushes may never be passed: WebKit flushes only what a frame draws, and a page at rest draws nothing.
    gl.flush();
    return done as Glow<S> | null;
  }

  /** Something was drawn into what glows since the engine last took this, so a picture of it is out of date. */
  glowDrawn = false;

  /** Whether a read of what glows is still on its way back. */
  get glowPending(): boolean {
    return this.glowReads.length > 0 || !!this.glowBack;
  }

  /** A device's picture as the stage has it, rows from the top, for tests. */
  read(plate: Plate): ImageData | null {
    const p = plate.picture;
    if (!p || this.lost) return null;
    const { gl } = this, light = new Float32Array(p.pw * p.ph * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
    gl.readPixels(0, 0, p.pw, p.ph, gl.RGBA, gl.FLOAT, light);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    return shot(light, p.pw, p.ph, this.exposure);
  }

  /**
   * The same, as it is now, once the GPU has drawn it. Read straight back it waits for everything sent before it: a page that takes
   * a still of each kind it shows waited about 25 ms a still, and the zoom page arriving more than half of its time.
   */
  readSoon(plate: Plate): Promise<ImageData | null> {
    const p = plate.picture;
    if (!p || this.lost) return Promise.resolve(null);
    const { gl } = this, { pw, ph } = p, e = this.exposure, pbo = gl.createBuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, pw * ph * 16, gl.STREAM_READ);
    gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    gl.flush();
    return new Promise(done => {
      const look = () => {
        if (!this.lost && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(look, 4);
        let out: ImageData | null = null;
        if (!this.lost) {
          const light = new Float32Array(pw * ph * 4);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, light);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
          out = shot(light, pw, ph, e);
        }
        gl.deleteSync(sync);
        gl.deleteBuffer(pbo);
        done(out);
      };
      setTimeout(look, 4);
    });
  }

  /** A device holds more pixels than the screen shows, for when it stops. While the light moves, what's shown is enough. */
  private seatFor(d: PlateSpec, r: DOMRect, scene: Scene): Seat {
    // A lean gives up the bake, so it lights everything every frame, and pays with sharpness until it stops.
    const sizing = scene.sizing, shown = r.width * (sizing ? 1 : scene.ratio) * (scene.sweeping && leans(d, scene) ? LEAN_SHARP : 1);
    const scale = Math.min(sizing || scene.sweeping ? Math.max(shown / d.pw, 0.125) : 1, this.fit(d));
    return { x: 0, y: 0, scale, pw: Math.round(d.pw * scale), ph: Math.round(d.ph * scale), box: null };
  }

  /**
   * Lights everything that's due. Copying off the shared canvas costs several times more with something drawn since the last copy, however small.
   * So all that's due is drawn first, side by side, and then copied. Tallest first keeps the rows tight. `lit` hears of each once its
   * picture is where the page shows it, so what waits on it reads the new picture, not the one before.
   */
  lightAll<T extends Turn>(turns: T[], scene: Scene, lit: (turn: T) => void, failed: (turn: T, e: unknown) => void): void {
    if (!this.player) { for (const t of turns) lit(t); return; }
    const seated: T[] = [], gl = this.gl, canvas = this.sheet, guard = (t: T, work: () => void) => {
      try {
        work();
      } catch (e) {
        failed(t, e);
      }
    };
    for (const t of turns) this.store.use(t.plate);
    let x = 0, y = 0, row = 0;
    const copy = () => {
      for (const t of seated) guard(t, () => {
        if (!t.ctx) this.keep(t);
        else if (this.staged) this.copyThrough(t);
        else this.copyOut(t);
        lit(t);
      });
      seated.length = x = y = row = 0;
    };
    for (const t of turns) t.plate.seat = this.seatFor(t.plate.spec, t.rect, scene);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bench);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const t of turns.sort((a, b) => b.plate.seat!.ph - a.plate.seat!.ph)) {
      const seat = t.plate.seat!;
      if (x + seat.pw > canvas.width) {
        x = 0;
        y += row + SEAT_GAP;
        row = 0;
      }
      if (y + seat.ph > canvas.height) {
        copy();
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      seat.x = x;
      seat.y = y;
      guard(t, () => {
        // One nothing here can light keeps the picture it had.
        if (this.light(t, scene)) seated.push(t);
        else lit(t);
      });
      x += seat.pw + SEAT_GAP;
      row = Math.max(row, seat.ph);
    }
    copy();
  }
}

/** Light read back from a picture, upside down, as the camera shows it at its exposure, without the dither. */
function shot(light: Float32Array, pw: number, ph: number, e: number): ImageData {
  const out = new Uint8ClampedArray(light.length), row = pw * 4;
  for (let y = 0; y < ph; y++) {
    for (let i = (ph - 1 - y) * row, j = y * row, end = i + row; i < end; i += 4, j += 4) {
      const a = Math.min(Math.max(light[i + 3]!, 0), 1), q = a > 0.002 ? a : 1, c = screen((light[i]! * e) / q, (light[i + 1]! * e) / q, (light[i + 2]! * e) / q);
      out[j] = c[0] * a * 255 + 0.5;
      out[j + 1] = c[1] * a * 255 + 0.5;
      out[j + 2] = c[2] * a * 255 + 0.5;
      out[j + 3] = a * 255 + 0.5;
    }
  }
  return new ImageData(out, pw, ph);
}

/**
 * Whether a point, canvas css px, is on a shape: what a sheet's cracks stay inside. A rect, which is what most glass is, is worked out;
 * anything else is drawn once at a css px a pixel and read back.
 */
function outlineOf(s: Shape): ((x: number, y: number) => boolean) | undefined {
  if (s.type === 'rect' && !s.grow && !s.ring) {
    const cos = Math.cos(s.rotate), sin = Math.sin(s.rotate), r = s.radius;
    return (x, y) => {
      const dx = x - s.cx, dy = y - s.cy, lx = Math.abs(dx * cos + dy * sin) - s.hw + r, ly = Math.abs(-dx * sin + dy * cos) - s.hh + r;
      return Math.hypot(Math.max(lx, 0), Math.max(ly, 0)) + Math.min(Math.max(lx, ly), 0) - r <= 0;
    };
  }
  if (s.type === 'holes' || s.type === 'mask' || s.grow || s.ring) return undefined;
  const b = bounds(s, 1), k = Math.min(1, 1024 / Math.max(b.w, b.h, 1));
  const w = Math.max(1, Math.ceil(b.w * k)), h = Math.max(1, Math.ceil(b.h * k)), canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(k, k);
  ctx.translate(-b.x, -b.y);
  ctx.fillStyle = '#fff';
  fill(ctx as unknown as CanvasRenderingContext2D, s);
  const a = ctx.getImageData(0, 0, w, h).data;
  return (x, y) => {
    const i = Math.floor((x - b.x) * k), j = Math.floor((y - b.y) * k);
    return i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3]! > 127;
  };
}

/** A test worked out the first time it's asked, and never if it isn't: a device that broke the same way again needs none. */
function lazy(make: () => ((x: number, y: number) => boolean) | undefined, otherwise = false): (x: number, y: number) => boolean {
  let test: ((x: number, y: number) => boolean) | undefined | null = null;
  return (x, y) => {
    if (test === null) test = make();
    return test ? test(x, y) : otherwise;
  };
}

/** Whether a point, canvas css px, lies on any of these shapes, drawn once over a box at a css px a pixel. Nothing, if there are none. */
function covered(shapes: Shape[], b: Box): ((x: number, y: number) => boolean) | undefined {
  const solids = shapes.filter((s): s is Solid => s.type !== 'holes' && s.type !== 'mask');
  if (!solids.length) return undefined;
  const k = Math.min(1, 1024 / Math.max(b.w, b.h, 1)), w = Math.max(1, Math.ceil(b.w * k)), h = Math.max(1, Math.ceil(b.h * k));
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
  ctx.scale(k, k);
  ctx.translate(-b.x, -b.y);
  ctx.fillStyle = '#fff';
  for (const s of solids) fill(ctx as unknown as CanvasRenderingContext2D, s.grow || s.ring ? { ...s, grow: undefined, ring: undefined } : s);
  const a = ctx.getImageData(0, 0, w, h).data;
  return (x, y) => {
    const i = Math.floor((x - b.x) * k), j = Math.floor((y - b.y) * k);
    return i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3]! > 127;
  };
}
