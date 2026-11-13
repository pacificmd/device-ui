// The air over a page. Two things, as in a real room: a haze all through it, which is nothing on its own but carries the
// light of every screen and lamp on the page, and plumes, each a small fluid of its own sized to what it is, a wisp off a lamp
// or a sheet of dust off the ceiling, so each has the detail its size needs. Everything is lit by the same light. Sources and
// sizes are in real mm; the page says how many css px a mm is shown at.
import { glow, light as roomLight, lights as allLights, stageLayer, staged, wakeStage, type Glow, type LightHandle, type StageFrame, type StageShot } from 'device-ui';
import { blackbodyColor, blackbodyLuminance, blackbodyTable, DRAPER } from './blackbody.js';
import { BEND, COPY, DRAW, GLARE, HAZE, HEIGHTS, MAX_SHOCKS, SHOCK, HEAT_KELVIN, LIT, NOISE_TILE, TABLE_FROM, TABLE_TO, MAX_LIGHTS, MAX_SOURCES, PRESSURE, RECT_VERTEX, SPARK_FRAGMENT, SPARK_VERTEX, STEP, VERTEX } from './shaders.js';

type Rgb = [number, number, number];
/** Where on the page: css px from the viewport's top left, or an element's middle. */
export type Place = [number, number] | Element;

export interface Source {
  /** The middle of its opening. */
  at: Place;
  /** How far round its opening it puts in, mm: all of it, for a source with no opening. */
  radius: number;
  /**
   * Its opening, mm across and down: a slot in a grating, a gap under a lid, a lamp's bezel. Without one it puts in from a point,
   * which nothing real does past a pipe's end.
   */
  span?: [number, number];
  /** How far its opening's turned, degrees clockwise. */
  angle?: number;
  /** Only the edge of its opening leaks, as smoke round something set into a panel. */
  seam?: boolean;
  /** How thick what it puts in gets a second. A thin wisp is about 0.3, a sheet of dust 1, a jet of steam 3. */
  rate?: number;
  /** How hot what it puts in is, in units of 450 K over the room. Over 2 it burns, in tongues, and glows as hot as it is. */
  heat?: number;
  /** How soon it's gone, 0 to 1: 0 lingers as smoke does, 1 goes in a second as steam does. Dust settles between. */
  steam?: number;
  /** Its colour, 0 to 1 each. */
  color?: Rgb;
  /** The way it blows, mm a second, down the page positive. */
  jet?: [number, number];
  /** How hard it drags the air its way, 0 to 1. */
  grip?: number;
  /** How hard it throws the air out from its middle, mm a second: a blast. */
  blast?: number;
}

export interface Light {
  at: Place;
  /** How big it is, mm: how far it reaches before it's down to a fifth. Past that it falls off as the square of the distance. */
  radius: number;
  /** Colour times strength, where 1 lights smoke as white as the room is exposed for. */
  color?: Rgb;
  /** Or how bright it really is, candela, and its colour as a temperature, kelvin: 2856 by default, a tungsten lamp's. */
  candela?: number;
  kelvin?: number;
}

/** A light put in the room. */
export interface Lamp {
  set(l: Partial<Light>): void;
  remove(): void;
}

export interface AirOptions {
  /** Where its canvas goes, over everything in it. The page, by default. */
  parent?: HTMLElement;
  /** How many css px a mm is shown at, as a number or asked each frame. Real size, 4, by default. */
  scale?: number | (() => number);
  /**
   * How fast the room's own air moves, m/s: what carries smoke off once it's done rising. Indoor air runs 0.05 to 0.2, and 0.1 by
   * default. Smoke stays as long as the room takes to turn over a plume its size, so a wisp goes sooner than a cloud.
   */
  draught?: number;
  /** How long steam lasts before it's evaporated, seconds: longer in damp air. */
  steam?: number;
  /** Its stacking on the page. */
  zIndex?: number;
  /** Where what falls lands, css px down the page: a desk or a floor. The bottom of the window, by default. */
  floor?: number | (() => number);
  /** How bright something has to be to show as white, cd/m²: what the room is exposed for. Its screens, 120, by default. */
  white?: number;
  /**
   * How much it works out, 0 to 3, held there. By default it finds its own: as much as the device it's on draws in its share of a
   * frame. For tests and comparisons, not pages.
   */
  quality?: number;
}

/** Sparks are drops of hot metal: they fall, slow in the air, cool as they go, and glow for as long as they're hot. */
export interface SparkOptions {
  /** How fast they're thrown, mm a second, and which way, degrees from up, and how widely. Off a short, 3 m/s by default, the middle of a spread: spatter leaves at 1 to 10. A grinder throws them at its rim speed, 50 to 80. */
  speed?: number;
  toward?: number;
  spread?: number;
  /** How big a drop is across, mm, on average. A quarter millimetre by default, as off a grinder or a shorted contact: a real burst is hundreds of these, not tens of big ones. */
  size?: number;
  /** How hot they start, kelvin. Burning steel is about 2100. */
  kelvin?: number;
  /** What they're made of: `steel` by default, or `copper`. Heavier and slower to cool keeps a spark going longer. */
  metal?: keyof typeof METALS;
}

export interface PlumeOptions {
  /** Where it rises from, or falls from. */
  at: Place;
  /** Its box, mm: as far as anything in it goes before it's gone. */
  size: [number, number];
  /** Where in its box `at` is, 0 to 1 across and down. The middle of its bottom edge, by default, as smoke rises. */
  anchor?: [number, number];
  /**
   * How far above the page it's held, mm: where its foot is. It's as deep as a quarter of its narrower side above that, so
   * anything standing prouder than that hides it, and anything lower is seen through it. Where there's no stage, or without
   * this, it lies on whatever is under it.
   */
  z?: number;
}

export interface Emitter {
  /** Changes it as it runs. */
  set(s: Partial<Source>): void;
  remove(): void;
}

/** One body of air, with its own grid. It stops working once everything in it is gone, and starts again when fed. */
export interface Plume {
  add(s: Source): Emitter;
  /** A source for a while, dying away over `seconds`. */
  puff(s: Source, seconds: number): void;
  remove(): void;
}

export interface Air {
  plume(o: PlumeOptions): Plume;
  /** Sparks thrown from a place: how many, and how they're thrown. */
  sparks(at: Place, n: number, o?: SparkOptions): void;
  /** How thick the haze in the room is: 0 for none, 1 for a smoky room. */
  haze: number;
  /** The light all through the room: what the page itself is seen by, so smoke in it shows as the page does. */
  ambient: Rgb;
  /** A light of the room's own, which dies away by e each `seconds` if it's given: a flash. */
  light(l: Light, seconds?: number): Lamp;
  /**
   * Dust or smoke stirred all through the room: the haze `k` thicker for now, clearing as the room's air carries it off, over
   * the time the draught takes to cross the page.
   */
  stir(k: number): void;
  /**
   * A blast of so many joules at a place on a surface: a shock front that runs out from it at the speed of sound or faster,
   * bending what's seen through it as any change in the air's density does. Seen as footage is, for a shutter's time.
   */
  shock(at: Place, joules: number): void;
  /** How much it's working out now, 0 to 3: see `AirOptions.quality`. */
  readonly quality: number;
  /** How many css px a mm is shown at now. */
  readonly scale: number;
  /**
   * For tests: what the air on the stage last took at a place in the window, css px. The height there, mm, and how far it bent
   * what's seen there, mm across and down. Null off the stage, or before anything in the air stood at a height or bent.
   */
  sample(x: number, y: number): { height: number; bend: [number, number] } | null;
  stop(): void;
}

const MM = 0.001;
/** How wide a held torch lights the air, mm. */
const TORCH_POOL = 80;
/**
 * Density kg/m³, specific heat J/(kg·K) and emissivity of what sparks are made of, oxidised, and the heat each kg gives burning in
 * the air. Steel burns as it flies, which is what keeps a grinder's sparks bright; copper hardly does.
 */
const METALS = { steel: { rho: 7800, c: 500, e: 0.8, burns: 4.9e6 }, copper: { rho: 8900, c: 385, e: 0.6, burns: 0 } };
/** The air: density kg/m³, kinematic viscosity m²/s and conductivity W/(m·K), at room temperature. */
const AIR = { rho: 1.2, nu: 1.5e-5, k: 0.026, kelvin: 295, oxygenDiffusion: 2e-5, oxygen: 0.23 };
/** The speed of sound in it, m/s, and its ratio of specific heats. Spec. */
const SOUND = 343, GAMMA = 1.4;
/** A kg of TNT, J, which blasts are measured against. Spec. */
const TNT = 4.184e6;
/**
 * A blast in the open air as it's measured (Kinney and Graham, "Explosive Shocks in Air", 1985: spec), against how far it's
 * gone, m per cube root of kg of TNT: the overpressure at its front, atmospheres, and how long that lasts where it passes, ms per
 * cube root of kg.
 */
const overpressure = (z: number) => (808 * (1 + (z / 4.5) ** 2)) / Math.sqrt((1 + (z / 0.048) ** 2) * (1 + (z / 0.32) ** 2) * (1 + (z / 1.35) ** 2));
const lasts = (z: number) => (980 * (1 + (z / 0.54) ** 10)) / ((1 + (z / 0.02) ** 3) * (1 + (z / 0.74) ** 6) * Math.sqrt(1 + (z / 6.9) ** 2));
/** How fast a front with that overpressure runs, m/s, and how much denser than the room it leaves the air, less one: Rankine–Hugoniot. */
const runs = (p: number) => SOUND * Math.sqrt(1 + ((GAMMA + 1) / (2 * GAMMA)) * p);
const jump = (p: number) => (1 + ((GAMMA + 1) / (2 * GAMMA)) * p) / (1 + ((GAMMA - 1) / (2 * GAMMA)) * p) - 1;
/** How many places a blast's front is worked out at, from a twentieth of a scaled metre out to a hundred. */
const FRONT_STEPS = 128;
/** How much metal burns for each kg of oxygen it takes up, as FeO: 55.8 g of iron to 16 of oxygen. */
const METAL_PER_OXYGEN = 3.49;
const SIGMA = 5.670374e-8, G = 9.81;
/**
 * How hard heat lifts the air, m/s² for each unit of heat: g ΔT / T, as hot gas is that much lighter than the room round it. Small
 * smoke rises at 0.2 to 0.5 m/s as it does over something smouldering. A number picked by eye made every plume drift up at 0.1.
 */
const RISE = (G * HEAT_KELVIN) / AIR.kelvin;
/**
 * How long a moving spark is taken in, s: what makes it a streak. The page is seen as footage is, a frame at a time, and footage
 * of sparks is shot with the shutter open half of each frame at 60 a second. A thirtieth drew streaks four times too long.
 */
const SHUTTER = 1 / 120;
const STRIDE = 9;
/**
 * How finely the air is worked out. How a plume moves comes from its shape, never the zoom: `short` cells across its narrower
 * side and at least `long` along its longer. The flow doesn't come out the same on other counts (finer cells smear less, and a
 * plume turns into a thin fast jet), so holding them is what keeps a plume moving the same seen large or small. All the plumes
 * running at once share `budget` cells, and only past that do they move on fewer, onto new cells once the ones they have are off
 * by more than `regrid` either way. Everything finer than a cell is the drawing's work, down to the pixel: the zoom changes only that.
 */
const SCALE = { short: 64, long: 128, most: 320, fewest: 24, regrid: 1.3 };
/**
 * What it works out at each quality, from the least to the most: the canvas up to `pixels` device pixels (never sharper than the
 * screen), `octaves` of detail below the cells, and `cells` shared by all the plumes. Each device gets the most it can keep up
 * with, read off the time between frames against the display's own, as every browser can: it steps down as soon as frames come
 * late, and tries the next up once they've come on time for a while, waiting twice as long each time that level fails. Late
 * frames are the page's whole cost, not only air's, and air is what gives way: on a busy device that keeps the page moving.
 * The GPU's own timer isn't used: on a shared GPU it counts other work too, and most browsers don't have it.
 */
const LEVELS = [
  { pixels: 0.6e6, octaves: 0, cells: 50_000 },
  { pixels: 1.3e6, octaves: 0, cells: 100_000 },
  { pixels: 2.9e6, octaves: 3, cells: 160_000 },
  { pixels: 4.2e6, octaves: 5, cells: 160_000 },
];
/** Seconds on time before trying the next level up, at first. */
const CALM = 2;
const BASE = { mixing: 0.6, vorticity: 22, swirl: 0.35, flicker: 1.6, drag: 0.35, heatLife: 0.8, expand: 0.6, retain: 0.98, extinction: 1.6, depth: 0.25, sweeps: 12 };

type Fed = { s: Source; from?: number; until?: number };
type Grid = { nx: number; ny: number; cell: number; long: number; vel: WebGLTexture[]; dye: WebGLTexture[]; p: WebGLTexture[]; lit: WebGLTexture; step: WebGLFramebuffer[]; press: WebGLFramebuffer[]; lighting: WebGLFramebuffer; cur: number };
type Body = { o: PlumeOptions; fed: Set<Fed>; box: [number, number, number, number]; at: number; grid: Grid | null; quietSince: number; time: number };

/** Starts the air over a page. Where WebGL2 can't render to floats, or motion is unwanted, there's no air, and it does nothing. */
export function air(o: AirOptions = {}): Air {
  const parent = o.parent ?? document.body, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: String(o.zIndex ?? 10) });
  canvas.setAttribute('aria-hidden', 'true');
  const own = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false });
  const ok = !!own && !!own.getExtension('EXT_color_buffer_float') && !still;
  /**
   * The context it works on: its own canvas's, over everything, or the stage's while there is one, where it's drawn among the
   * devices, in front of what's lower than it and behind what stands prouder, and bends what's seen through it.
   */
  let gl = own!, onStage = false;
  const bodies = new Set<Body>();
  /** Where each is, css px, how fast, m/s, how big across, m, how hot, K, and what it's made of. */
  const sparks: { x: number; y: number; vx: number; vy: number; d: number; t: number; m: (typeof METALS)[keyof typeof METALS]; resting: boolean; fuel: number }[] = [];
  let raf = 0, frame = () => {}, asked = false;
  /** Blasts: where, css px, how much, J, and when. */
  const shocks: { x: number; y: number; w: number; r: Float64Array; t: Float64Array; from: number }[] = [];
  const scale = () => (typeof o.scale === 'function' ? o.scale() : o.scale ?? 4);
  const place = (p: Place): [number, number] => {
    if (Array.isArray(p)) return p;
    const r = p.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  /** A plume's box on the page, css px: left, top, width, height. Set where it's made, as smoke stays put when a desk shakes. */
  const boxOf = (b: PlumeOptions): [number, number, number, number] => {
    const [x, y] = place(b.at), px = scale(), [ax, ay] = b.anchor ?? [0.5, 1], w = b.size[0] * px, h = b.size[1] * px;
    return [x - ax * w, y - ay * h, w, h];
  };
  /** Whether the next frame is its first since it rested. */
  let rested = true;
  const wake = () => {
    if (!ok) return;
    // On the stage it's drawn when the stage is, so it asks for that; once the stage is done with this frame, not during it.
    if (onStage) {
      if (!asked) (asked = true), queueMicrotask(() => ((asked = false), wakeStage()));
    } else if (!raf) raf = requestAnimationFrame(() => frame());
  };
  let free = (_: Grid) => {};
  let thick = 0, stirred = 0;
  const lamps = new Set<{ l: Light; from: number; seconds: number; on: LightHandle | null }>();
  /** This frame's lights, and how thick its haze is. */
  let roomLights: Light[] = [], hazy = 0;
  const draught = o.draught ?? 0.1, white = o.white ?? 120;
  /** A light's colour in the room's terms. One that says candela lights smoke as white where it gives what white needs, π·white lux. */
  const colorOf = (l: Light): Rgb => {
    if (l.color) return l.color;
    const c = blackbodyColor(l.kelvin ?? 2856), y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], r = l.radius * MM;
    const k = (4 * (l.candela ?? 0)) / (r * r * Math.PI * white) / y;
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  /**
   * Every light in the room as it is now, from the one list the hardware is lit from too: this room's own, each as bright as
   * it's died away to, and whatever else is in there, the torch first.
   */
  const lightsNow = (now: number): Light[] => {
    const s = scale();
    for (const lamp of lamps) {
      const k = Number.isFinite(lamp.seconds) ? Math.exp(-(now - lamp.from) / lamp.seconds) : 1;
      if (k < 0.01) {
        lamp.on?.remove();
        lamps.delete(lamp);
        continue;
      }
      const l = { at: lamp.l.at, reach: lamp.l.radius * s, color: colorOf(lamp.l).map(c => c * k) as Rgb };
      if (lamp.on) lamp.on.set(l);
      else lamp.on = roomLight(l);
    }
    // A torch's pool is lit about as wide as a hand. Guess.
    return allLights().map(l => ({ at: l.at, radius: l.kind === 'beam' ? TORCH_POOL : l.reach / s, color: l.color }));
  };
  const field: Air = {
    get haze() {
      return thick;
    },
    set haze(k) {
      thick = Math.max(0, k);
      if (thick > 0) wake();
    },
    ambient: [0.05, 0.05, 0.05],
    light(l, seconds = Infinity) {
      const lamp = { l: { ...l }, from: performance.now() / 1000, seconds, on: null as LightHandle | null };
      lamps.add(lamp);
      wake();
      return {
        set: next => void Object.assign(lamp.l, next),
        remove: () => {
          lamp.on?.remove();
          lamps.delete(lamp);
        },
      };
    },
    stir(k) {
      stirred += Math.max(0, k);
      wake();
    },
    get quality() {
      return level;
    },
    get scale() {
      return scale();
    },
    plume(po) {
      const b: Body = { o: po, fed: new Set(), box: boxOf(po), at: scale(), grid: null, quietSince: -Infinity, time: 0 };
      bodies.add(b);
      return {
        add(s) {
          const e = { s: { ...s } };
          b.fed.add(e);
          b.quietSince = -Infinity;
          wake();
          return { set: next => void Object.assign(e.s, next), remove: () => void b.fed.delete(e) };
        },
        puff(s, seconds) {
          const t = performance.now() / 1000;
          b.fed.add({ s: { ...s }, from: t, until: t + seconds });
          b.quietSince = -Infinity;
          wake();
        },
        remove() {
          if (b.grid) free(b.grid);
          bodies.delete(b);
        },
      };
    },
    sparks(at, n, so = {}) {
      if (!ok) return;
      const [x, y] = place(at), speed = (so.speed ?? 3000) * MM, toward = ((so.toward ?? 0) * Math.PI) / 180, spread = ((so.spread ?? 360) * Math.PI) / 180;
      const m = METALS[so.metal ?? 'steel'], kelvin = so.kelvin ?? 2100;
      for (let i = 0; i < n; i++) {
        // Speeds spread as sizes do, log-normal: a few fly off fast, and most are slow enough to be seen falling.
        const a = toward + (Math.random() - 0.5) * spread, v = speed * Math.exp((Math.random() + Math.random() + Math.random() - 1.5) * 1.2);
        // Drops come in all sizes, a few big ones among many small: log-normal about the size asked for.
        const d = (so.size ?? 0.25) * MM * Math.exp((Math.random() + Math.random() + Math.random() - 1.5) * 0.7);
        sparks.push({ x, y, vx: Math.sin(a) * v, vy: -Math.cos(a) * v, d, t: kelvin * (0.9 + Math.random() * 0.15), m, resting: false, fuel: 1 });
      }
      if (sparks.length > 2000) sparks.splice(0, sparks.length - 2000);
      wake();
    },
    shock(at, joules) {
      if (!ok || !(joules > 0)) return;
      const [x, y] = place(at);
      // Set off on a surface, all its energy goes into half the room: as a free blast of twice as much. Spec.
      const w = Math.cbrt((2 * joules) / TNT), r = new Float64Array(FRONT_STEPS), t = new Float64Array(FRONT_STEPS);
      // When its front gets where: run out at the speed the overpressure there gives it.
      const pace = (i: number) => 1 / runs(overpressure(r[i]! / w));
      for (let i = 0; i < FRONT_STEPS; i++) {
        r[i] = w * 0.05 * 2000 ** (i / (FRONT_STEPS - 1));
        t[i] = i ? t[i - 1]! + (r[i]! - r[i - 1]!) * 0.5 * (pace(i - 1) + pace(i)) : r[0]! * pace(0);
      }
      shocks.push({ x, y, w, r, t, from: performance.now() / 1000 });
      wake();
    },
    sample(x, y) {
      if (!ok || !onStage || !depth) return null;
      const d = depth, X = Math.floor(x - view.x), Y = d.h - 1 - Math.floor(y - view.y), o = new Float32Array(4);
      if (X < 0 || Y < 0 || X >= d.w || Y >= d.h) return null;
      const read = (fbo: WebGLFramebuffer) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.readPixels(X, Y, 1, 1, gl.RGBA, gl.FLOAT, o);
        return [o[0]!, o[1]!] as [number, number];
      };
      const height = read(d.fbo)[0], bend = read(d.bent);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { height, bend };
    },
    stop() {
      for (const lamp of lamps) lamp.on?.remove();
      lamps.clear();
      cancelAnimationFrame(raf);
      raf = 0;
      removeEventListener('resize', size);
      canvas.remove();
      unlayer();
    },
  };
  /** Device pixels to a css px on the canvas. */
  let unlayer = () => {};
  let dpr = 1, level = Math.max(0, Math.min(LEVELS.length - 1, Math.round(o.quality ?? LEVELS.length - 1)));
  const size = () => {
    if (!onStage) {
      dpr = Math.min(devicePixelRatio || 1, Math.sqrt(LEVELS[level]!.pixels / (innerWidth * innerHeight)));
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      view = { x: 0, y: 0, w: innerWidth, h: innerHeight, ratio: dpr };
    }
    // Every plume finds its place again. What's in it stays: it's in metres, and moves to new cells if it needs them.
    for (const b of bodies) (b.box = boxOf(b.o)), (b.at = scale());
    wake();
  };
  /** Where it draws, css px in the window, and how many device px a css px is there: the window on its own canvas, the stage's box on the stage. */
  let view = { x: 0, y: 0, w: innerWidth, h: innerHeight, ratio: 1 };
  if (!ok) return field;
  if (!staged()) parent.append(canvas);

  // -- WebGL: programs, a quad, and the targets.
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`air: ${gl.getShaderInfoLog(sh)}`);
    return sh;
  };
  const program = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`air: ${gl.getProgramInfoLog(p)}`);
    const where = new Map<string, WebGLUniformLocation | null>();
    const u = (name: string) => (where.has(name) ? where.get(name)! : where.set(name, gl.getUniformLocation(p, name)).get(name)!);
    return { p, u };
  };
  type Program = ReturnType<typeof program>;
  let copy: Program, step: Program, pressure: Program, lit: Program, draw: Program, haze: Program, spark: Program, heights: Program, bendPlume: Program, shockBend: Program;
  let quadVao: WebGLVertexArrayObject | null, sparkVao: WebGLVertexArrayObject | null, sparkBuf: WebGLBuffer | null;
  let sourceTex: WebGLTexture, shineTex: WebGLTexture, noiseTex: WebGLTexture, hotTex: WebGLTexture;
  /** On the stage: how high what's under each css px of it is, mm, and how far the air moves what's seen there, mm. */
  let depth: { w: number; h: number; tex: WebGLTexture; fbo: WebGLFramebuffer; bend: WebGLTexture; bent: WebGLFramebuffer } | null = null;
  /** Makes everything it works with on the context it's on now. */
  const setup = () => {
    copy = program(VERTEX, COPY), step = program(VERTEX, STEP), pressure = program(VERTEX, PRESSURE), lit = program(VERTEX, LIT), draw = program(RECT_VERTEX, DRAW), haze = program(VERTEX, HAZE), spark = program(SPARK_VERTEX, SPARK_FRAGMENT);
    heights = program(RECT_VERTEX, HEIGHTS), bendPlume = program(RECT_VERTEX, BEND), shockBend = program(VERTEX, SHOCK);
    quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    (sparkBuf = gl.createBuffer()), (sparkVao = gl.createVertexArray());
    gl.bindVertexArray(sparkVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuf);
    // Each corner: where it is, css px, where along and across the streak, how long the streak is and how wide the drop, and its light.
    const aSpark = gl.getAttribLocation(spark.p, 'aSpark'), aShape = gl.getAttribLocation(spark.p, 'aShape'), aLight = gl.getAttribLocation(spark.p, 'aLight');
    gl.enableVertexAttribArray(aSpark);
    gl.vertexAttribPointer(aSpark, 4, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(aShape);
    gl.vertexAttribPointer(aShape, 2, gl.FLOAT, false, STRIDE * 4, 16);
    gl.enableVertexAttribArray(aLight);
    gl.vertexAttribPointer(aLight, 3, gl.FLOAT, false, STRIDE * 4, 24);
    gl.bindVertexArray(null);
    sourceTex = texture(MAX_SOURCES * 5, 1, gl.RGBA32F, gl.NEAREST, sourceData, gl.FLOAT);
    // What the hardware gives off, as base last read it: small, and mipped so the drawing can blur it as far as it likes.
    shineTex = texture(1, 1, gl.RGBA8, gl.LINEAR, new Uint8Array(4), gl.UNSIGNED_BYTE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    // Random values, smoothed between, for the finest detail: a texture read is much cheaper than hashing for every pixel.
    noiseTex = texture(NOISE_TILE, NOISE_TILE, gl.RGBA8, gl.LINEAR, Uint8Array.from({ length: NOISE_TILE * NOISE_TILE * 4 }, () => Math.random() * 256), gl.UNSIGNED_BYTE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // What glows for being hot, as bright as the room's exposure shows it.
    hotTex = texture(64, 1, gl.RGBA16F, gl.LINEAR, blackbodyTable(64, TABLE_FROM, TABLE_TO, white), gl.FLOAT);
    shone = null;
    depth = null;
  };
  /** Lets go of everything it made on the context it's on, and of every plume's cells. */
  const teardown = () => {
    for (const b of bodies) if (b.grid) (free(b.grid), (b.grid = null));
    for (const pr of [copy, step, pressure, lit, draw, haze, spark, heights, bendPlume, shockBend]) gl.deleteProgram(pr.p);
    for (const t of [sourceTex, shineTex, noiseTex, hotTex]) gl.deleteTexture(t);
    if (depth) {
      for (const t of [depth.tex, depth.bend]) gl.deleteTexture(t);
      for (const f of [depth.fbo, depth.bent]) gl.deleteFramebuffer(f);
    }
    gl.deleteVertexArray(quadVao);
    gl.deleteVertexArray(sparkVao);
    gl.deleteBuffer(sparkBuf);
    rested = true;
  };

  const texture = (w: number, h: number, format: number, filter: number, data: ArrayBufferView | null = null, type: number = gl.HALF_FLOAT) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, gl.RGBA, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const target = (...ts: WebGLTexture[]) => {
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return fb;
  };
  const sourceData = new Float32Array(MAX_SOURCES * 20);

  /** A plume's grid, `long` cells along its longer side. Its span is its size in metres, so a cell is as big as that makes it. */
  const build = (b: Body, long: number): Grid => {
    const [sw, sh] = b.o.size, wide = sw >= sh;
    const nx = wide ? long : Math.max(8, Math.round((long * sw) / sh)), ny = wide ? Math.max(8, Math.round((long * sh) / sw)) : long;
    const cell = (sw * MM) / nx;
    const make = () => texture(nx, ny, gl.RGBA16F, gl.LINEAR);
    const vel = [make(), make()], dye = [make(), make()], p = [make(), make()], lightIn = make();
    return { nx, ny, cell, long, vel, dye, p, lit: lightIn, step: [target(vel[0]!, dye[0]!), target(vel[1]!, dye[1]!)], press: [target(p[0]!), target(p[1]!)], lighting: target(lightIn), cur: 0 };
  };
  /** The cells along each live plume's longer side, from its shape, all of them together within the budget. */
  const wanted = (live: Body[]) => {
    const want = live.map(b => {
      const [w, h] = b.o.size;
      return Math.min(SCALE.most, Math.max(SCALE.long, (SCALE.short * Math.max(w, h)) / Math.min(w, h)));
    });
    const cells = live.reduce((sum, b, i) => sum + want[i]! ** 2 * Math.min(b.o.size[0], b.o.size[1]) / Math.max(b.o.size[0], b.o.size[1]), 0);
    const k = Math.min(1, Math.sqrt(LEVELS[level]!.cells / Math.max(cells, 1)));
    return want.map(n => Math.max(SCALE.fewest, Math.round(n * k)));
  };
  /** Moves a plume onto new cells, what's in it carried over as it is: velocity and heat in m/s and units, not per cell. */
  const regrid = (b: Body, long: number) => {
    const old = b.grid!, g = build(b, long);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.step[0]!);
    gl.viewport(0, 0, g.nx, g.ny);
    gl.useProgram(copy.p);
    gl.uniform2f(copy.u('uFrom'), old.nx, old.ny);
    gl.uniform2f(copy.u('uTo'), g.nx, g.ny);
    bind(copy, 'uVel', 0, old.vel[old.cur]!);
    bind(copy, 'uDye', 1, old.dye[old.cur]!);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    free(old);
    b.grid = g;
  };
  free = g => {
    for (const t of [...g.vel, ...g.dye, ...g.p, g.lit]) gl.deleteTexture(t);
    for (const fb of [...g.step, ...g.press, g.lighting]) gl.deleteFramebuffer(fb);
  };
  addEventListener('resize', size);
  size();

  let shone: Glow | null = null;
  setup();
  const glows = () => {
    const g = glow();
    if (g === shone) return;
    shone = g;
    gl.bindTexture(gl.TEXTURE_2D, shineTex);
    if (g) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, g.w, g.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, g.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.generateMipmap(gl.TEXTURE_2D);
  };

  const steamLife = o.steam ?? 0.6;
  /** How long a plume's smoke stays, s: as long as the room's air takes to carry off something its size. */
  const smokeLife = (b: Body) => (Math.max(b.o.size[0], b.o.size[1]) * MM) / draught;
  let last = performance.now() / 1000, time = 0;

  const bind = (prog: Program, name: string, unit: number, t: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(prog.u(name), unit);
  };
  const gridUniforms = (prog: Program, g: Grid) => {
    gl.uniform2f(prog.u('uCells'), g.nx, g.ny);
    gl.uniform1f(prog.u('uCell'), g.cell);
    gl.uniform1i(prog.u('uBlockCount'), 0);
  };
  /** The room's light, in page metres, for the haze and every plume. */
  const lightUniforms = (prog: Program) => {
    const k = MM / scale();
    bind(prog, 'uShine', 4, shineTex);
    gl.uniform1f(prog.u('uShineGain'), shone ? shone.gain : 0);
    gl.uniform1f(prog.u('uShineCell'), shone ? shone.cell : 1);
    // What glows covers the window in whole cells, so a little past its edges.
    gl.uniform2f(prog.u('uPageSpan'), (shone ? shone.w * shone.cell : innerWidth) * k, (shone ? shone.h * shone.cell : innerHeight) * k);
    gl.uniform3fv(prog.u('uAmbient'), field.ambient);
    const ls = roomLights.slice(0, MAX_LIGHTS), at = new Float32Array(MAX_LIGHTS * 4), col = new Float32Array(MAX_LIGHTS * 3);
    ls.forEach((l, i) => {
      const [x, y] = place(l.at);
      at.set([x * k, y * k, l.radius * MM, 0], i * 4);
      col.set(colorOf(l), i * 3);
    });
    gl.uniform1i(prog.u('uLightCount'), ls.length);
    gl.uniform4fv(prog.u('uLightAt'), at);
    gl.uniform3fv(prog.u('uLightColor'), col);
  };

  /** Packs what's feeding a plume this frame, in its own metres. */
  const pack = (b: Body, now: number) => {
    let n = 0;
    const k = MM / scale(), [left, top] = b.box;
    for (const e of b.fed) {
      if (e.until !== undefined && now > e.until) {
        b.fed.delete(e);
        continue;
      }
      if (n >= MAX_SOURCES) break;
      const s = e.s, fade = e.until !== undefined ? 1 - (now - e.from!) / (e.until - e.from!) : 1;
      const [x, y] = place(s.at), c = s.color ?? [0.5, 0.5, 0.5];
      sourceData.set([
        (x - left) * k, (y - top) * k, Math.max(s.radius * MM, b.grid!.cell * 1.6), (s.rate ?? 1) * fade,
        (s.jet?.[0] ?? 0) * MM, (s.jet?.[1] ?? 0) * MM, (s.heat ?? 0) * fade, s.steam ?? 0,
        c[0], c[1], c[2], s.grip ?? (s.blast ? 1 : 0),
        (s.blast ?? 0) * MM * fade, ((s.span?.[0] ?? 0) / 2) * MM, ((s.span?.[1] ?? 0) / 2) * MM, ((s.angle ?? 0) * Math.PI) / 180,
        s.seam ? 1 : 0, 0, 0, 0,
      ], n * 20);
      n++;
    }
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_SOURCES * 5, 1, gl.RGBA, gl.FLOAT, sourceData);
    return n;
  };

  /** Runs one plume on by dt, in steps of at most a sixtieth. */
  const run = (b: Body, dtAll: number, n: number) => {
    const g = b.grid!, steps = Math.max(1, Math.ceil(dtAll * 60)), dt = dtAll / steps;
    for (let i = 0; i < steps; i++) {
      b.time += dt;
      const nxt = 1 - g.cur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.step[nxt]!);
      gl.viewport(0, 0, g.nx, g.ny);
      gl.useProgram(step.p);
      gridUniforms(step, g);
      bind(step, 'uVel', 0, g.vel[g.cur]!);
      bind(step, 'uDye', 1, g.dye[g.cur]!);
      bind(step, 'uP', 2, g.p[0]!);
      bind(step, 'uSources', 3, sourceTex);
      const u = step.u;
      gl.uniform1f(u('uDt'), dt);
      gl.uniform1f(u('uTime'), b.time);
      gl.uniform1f(u('uSourceCount'), n);
      gl.uniform1f(u('uMixing'), BASE.mixing);
      gl.uniform1f(u('uVorticity'), BASE.vorticity);
      gl.uniform1f(u('uSwirl'), BASE.swirl);
      gl.uniform1f(u('uFlicker'), BASE.flicker);
      gl.uniform1f(u('uDrag'), BASE.drag);
      gl.uniform1f(u('uHeatLife'), BASE.heatLife);
      gl.uniform1f(u('uSmokeLife'), smokeLife(b));
      gl.uniform1f(u('uSteamLife'), steamLife);
      gl.uniform1f(u('uRise'), RISE);
      gl.uniform2f(u('uWind'), 0, 0);
      gl.uniform2f(u('uOrigin'), b.box[0] * MM / scale(), b.box[1] * MM / scale());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      g.cur = nxt;
      // The pressure, warm from the step before. A sweep carries it one cell, so there are as many as it takes to cross the same
      // share of the plume however many cells it has. An even number, so it ends where it started.
      const sweeps = 2 * Math.max(2, Math.round((BASE.sweeps * g.long) / SCALE.long / 2));
      gl.useProgram(pressure.p);
      gridUniforms(pressure, g);
      gl.uniform1f(pressure.u('uExpand'), BASE.expand);
      gl.uniform1f(pressure.u('uRetain'), BASE.retain);
      bind(pressure, 'uVel', 0, g.vel[g.cur]!);
      for (let k = 0; k < sweeps; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, g.press[(k + 1) % 2]!);
        bind(pressure, 'uP', 1, g.p[k % 2]!);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  };

  // What frames cost: the time between them, against the display's own.
  const gaps: number[] = [], wait = LEVELS.map(() => CALM);
  let calmFor = 0, refresh = 1000 / 60, runningSince = Infinity, climbedAt = -Infinity;
  /** Over twenty frames, or a third of a second's worth on a device that's struggling, so a slow one comes down fast. */
  const settle = (now: number) => {
    const spent = gaps.reduce((t, c) => t + c, 0);
    if (gaps.length < 20 && (gaps.length < 4 || spent < 330)) return;
    const at = (q: number) => [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length * q)]!;
    // The display's own frame: what a quarter of the frames come in, as no frame comes sooner than it refreshes. Not slower than
    // 60 Hz, or a device that's always slow would take its slowness for its display.
    refresh = Math.min(1000 / 60, Math.max(at(0.25), 4));
    const late = at(0.75) > refresh * 1.3, easy = at(0.9) < refresh * 1.15;
    gaps.length = 0;
    if (late && level > 0) {
      // A level it only just climbed to that it can't keep: it waits longer before trying that one again.
      if (now - climbedAt < 5) wait[level] = Math.min(wait[level]! * 2, 120);
      level--, (calmFor = 0), size();
    } else if (easy && level < LEVELS.length - 1 && (calmFor += spent / 1000) >= wait[level + 1]!) {
      level++, (calmFor = 0), (climbedAt = now), size();
    } else if (!easy) calmFor = 0;
  };
  /** How far in front of the page a plume is held, mm, from its foot to its top. */
  const slab = (b: Body): [number, number] => {
    const z0 = b.o.z ?? 0;
    return [z0, z0 + BASE.depth * Math.min(b.o.size[0], b.o.size[1])];
  };
  /** A box on the page, css px, in clip space where it's drawn: left, bottom, right, top. */
  const clip = (x: number, y: number, w: number, h: number): [number, number, number, number] => {
    const X = x - view.x, Y = y - view.y;
    return [(X / view.w) * 2 - 1, 1 - ((Y + h) / view.h) * 2, ((X + w) / view.w) * 2 - 1, 1 - (Y / view.h) * 2];
  };
  /** Which of a plume's edges fade: not those on the edge of where it's drawn, which cuts it there anyway. */
  const fades = (b: Body): [number, number, number, number] => {
    const [x, y, w, h] = b.box;
    return [x > view.x ? 1 : 0, x + w < view.x + view.w ? 1 : 0, y > view.y ? 1 : 0, y + h < view.y + view.h ? 1 : 0];
  };

  /** Runs the room on to `now`: its haze, its lights and every plume that's live, which it hands back. */
  const advance = (now: number, dt: number): Body[] => {
    time += dt;
    stirred *= Math.exp(-dt / ((innerHeight / scale()) * MM / draught));
    if (stirred < 0.002) stirred = 0;
    hazy = thick + stirred;
    roomLights = lightsNow(now);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quadVao);
    // Each plume that's fed, or still has something in it, runs on.
    const live: Body[] = [];
    for (const b of bodies) {
      if (!b.fed.size) {
        if (b.quietSince === -Infinity) b.quietSince = now;
        if (now - b.quietSince > smokeLife(b) * 2.5) continue;
      }
      // A zoom moves it, and the cells it needs.
      if (Math.abs(scale() / b.at - 1) > 0.01) (b.box = boxOf(b.o)), (b.at = scale());
      live.push(b);
    }
    const want = wanted(live);
    live.forEach((b, i) => {
      const n = want[i]!;
      if (!b.grid) b.grid = build(b, n);
      else if (n > b.grid.long * SCALE.regrid || n * SCALE.regrid < b.grid.long) regrid(b, n);
      run(b, dt, pack(b, now));
    });

    return live;
  };

  /** Draws the room over what's there, premultiplied: on its own canvas, or on the stage's light, standing at its heights in `under`. */
  const paint = (live: Body[], dt: number, under: WebGLTexture | null) => {
    const vw = Math.max(Math.round(view.w * view.ratio), 1), vh = Math.max(Math.round(view.h * view.ratio), 1);
    if (hazy > 0 || live.length) glows();
    gl.bindFramebuffer(gl.FRAMEBUFFER, onto);
    gl.viewport(0, 0, vw, vh);
    // Premultiplied, over the page.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(quadVao);
    if (hazy > 0) {
      gl.useProgram(haze.p);
      lightUniforms(haze);
      gl.uniform4f(haze.u('uView'), view.x * MM / scale(), view.y * MM / scale(), view.w * MM / scale(), view.h * MM / scale());
      gl.uniform1f(haze.u('uTime'), time);
      gl.uniform1f(haze.u('uHaze'), hazy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (live.length) {
      const k = MM / scale();
      // The light that reaches into each plume, worked out at its own cells, as shade changes slowly across a cell.
      gl.disable(gl.BLEND);
      gl.useProgram(lit.p);
      lightUniforms(lit);
      bind(lit, 'uBlackbody', 5, hotTex);
      gl.uniform1f(lit.u('uExtinction'), BASE.extinction);
      for (const b of live) {
        const g = b.grid!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, g.lighting);
        gl.viewport(0, 0, g.nx, g.ny);
        gridUniforms(lit, g);
        bind(lit, 'uVel', 0, g.vel[g.cur]!);
        bind(lit, 'uDye', 1, g.dye[g.cur]!);
        gl.uniform2f(lit.u('uOrigin'), b.box[0] * k, b.box[1] * k);
        gl.uniform1f(lit.u('uDepth'), BASE.depth * Math.min(b.box[2], b.box[3]) * k);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, onto);
      gl.viewport(0, 0, vw, vh);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(draw.p);
      bind(draw, 'uHeights', 7, under ?? noiseTex);
      gl.uniform2f(draw.u('uViewPx'), vw, vh);
      bind(draw, 'uBlackbody', 5, hotTex);
      bind(draw, 'uNoise', 6, noiseTex);
      gl.uniform1f(draw.u('uExtinction'), BASE.extinction);
      gl.uniform1i(draw.u('uLinear'), onStage ? 1 : 0);
      for (const b of live) {
        const g = b.grid!, [x, y, w, h] = b.box;
        gridUniforms(draw, g);
        bind(draw, 'uVel', 0, g.vel[g.cur]!);
        bind(draw, 'uDye', 1, g.dye[g.cur]!);
        bind(draw, 'uLit', 2, g.lit);
        gl.uniform1f(draw.u('uTime'), b.time);
        // How big a device pixel is in the plume, metres: where its finest detail stops.
        gl.uniform1f(draw.u('uPixel'), k / view.ratio);
        const [z0, z1] = slab(b);
        gl.uniform3f(draw.u('uSlab'), z0, z1, under && b.o.z !== undefined ? 1 : 0);
        gl.uniform1i(draw.u('uOctaves'), LEVELS[level]!.octaves);
        gl.uniform2f(draw.u('uOrigin'), x * k, y * k);
        gl.uniform4f(draw.u('uFade'), ...fades(b));
        gl.uniform4f(draw.u('uRect'), ...clip(x, y, w, h));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    // Sparks: each falls, is slowed by the air as a ball is, cools by what it radiates and what the air carries off, and lands.
    if (sparks.length) {
      const pxPerM = scale() / MM, floor = (typeof o.floor === 'function' ? o.floor() : o.floor) ?? innerHeight;
      const data = new Float32Array(sparks.length * 6 * STRIDE);
      let m = 0;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!, v = Math.hypot(p.vx, p.vy), mass = (p.m.rho * Math.PI * p.d ** 3) / 6, area = Math.PI * p.d * p.d;
        // The air it touches is the film round it, halfway between it and the room: thinner, more viscous, and carrying heat and
        // oxygen several times better than air at room temperature. At room values a burning drop could never stay as hot as
        // steel burns, 2,100 to 2,700 K.
        const hot = (p.t + AIR.kelvin) / 2 / AIR.kelvin, rho = AIR.rho / hot, nuFilm = AIR.nu * hot ** 1.7, kFilm = AIR.k * hot ** 0.8;
        // Drag on a sphere, Cd about a half at these speeds.
        const drag = (0.5 * rho * 0.47 * (area / 4) * v) / mass;
        p.vx -= p.vx * drag * dt;
        p.vy -= p.vy * drag * dt - (p.resting ? 0 : G * dt);
        // Ranz–Marshall for what the moving air carries off, and Stefan–Boltzmann for what it shines away. Lying on a desk it
        // also loses heat into the desk, which is most of it.
        const nu = 2 + 0.6 * Math.sqrt((v * p.d) / nuFilm) * 0.89, h = (nu * kFilm) / p.d;
        const loss = area * (h * (p.t - AIR.kelvin) + p.m.e * SIGMA * (p.t ** 4 - AIR.kelvin ** 4)) * (p.resting ? 4 : 1);
        // Burning, as fast as oxygen reaches it through the film (the same flow as the heat, by the Lewis analogy), until the
        // metal in it is all burnt. Then it cools, faster the smaller it is: a fine spark flares and winks out, a big one burns on.
        const burn = p.m.burns && !p.resting && p.fuel > 0 ? area * ((nu * AIR.oxygenDiffusion * hot ** 1.75) / p.d) * rho * AIR.oxygen * METAL_PER_OXYGEN * p.m.burns : 0;
        p.fuel -= (burn / p.m.burns / mass) * dt;
        p.t -= ((loss - burn) / (mass * p.m.c)) * dt;
        if (p.t < DRAPER || p.y > innerHeight + 50 || p.x < -50 || p.x > innerWidth + 50) {
          sparks.splice(i, 1);
          continue;
        }
        const was = [p.x, p.y];
        p.x += p.vx * pxPerM * dt;
        p.y += p.vy * pxPerM * dt;
        // It lands: bounces a little, as a drop of hot metal does, then skids to a stop and lies there glowing.
        if (p.y > floor && was[1]! <= floor + 1) {
          p.y = floor;
          if (p.vy > 0.25) p.vy *= -0.3, p.vx *= 0.7;
          else (p.vy = 0), (p.resting = true);
        }
        if (p.resting) p.vx *= Math.exp(-dt * 0.4 * G / Math.max(Math.abs(p.vx), 0.05));
        // Seen for a shutter's time it's a streak, as long as it went in that time, in device pixels. However small, it
        // gives off all its light: a drop under a pixel is drawn a pixel wide, and that much fainter, so a tenth of a pixel and two
        // pixels shine in the ratio of their areas. Spread along its streak, a fast spark is a long faint line.
        const dpr = view.ratio, sv = Math.hypot(p.vx, p.vy), rTrue = (p.d * pxPerM * dpr) / 2, r = Math.max(rTrue, 0.5), seg = sv * SHUTTER * pxPerM * dpr;
        // What it's drawn over, counting the pixel-wide ramp its edge is smoothed by: 2r across, and r² + 1/12 round its ends.
        const drawn = 2 * r * seg + Math.PI * (r * r + 1 / 12);
        const c = blackbodyColor(p.t), k = ((Math.PI * rTrue * rTrue) / drawn) * ((p.m.e * blackbodyLuminance(p.t)) / white);
        // A capsule from where it was a shutter ago to where it is, as wide as the drop, and its glare round it.
        const dx = sv > 1e-4 ? p.vx / sv : 1, dy = sv > 1e-4 ? p.vy / sv : 0, out = r + (onStage ? 1 : GLARE), x = (p.x - view.x) * dpr, y = (p.y - view.y) * dpr;
        const corner = (along: number, side: number) =>
          data.set([x + dx * (along - seg) - dy * side, y + dy * (along - seg) + dx * side, along, side, seg, r, c[0] * k, c[1] * k, c[2] * k], m++ * STRIDE);
        corner(-out, out), corner(-out, -out), corner(seg + out, out);
        corner(seg + out, out), corner(-out, -out), corner(seg + out, -out);
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(spark.p);
      gl.uniform2f(spark.u('uSpan'), vw, vh);
      gl.uniform1f(spark.u('uFloor'), (floor - view.y) * view.ratio);
      gl.uniform1i(spark.u('uLinear'), onStage ? 1 : 0);
      gl.bindVertexArray(sparkVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, m * STRIDE), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, m);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  /** Whether there's anything left to do: with no haze, no lamp, nothing in the air, no sparks and no blast, it rests until it's fed. */
  const busy = (live: Body[]) => hazy > 0 || lamps.size > 0 || live.length > 0 || sparks.length > 0 || shocks.length > 0;

  /** The time since the frame before, and what it costs. */
  const tick = () => {
    const now = performance.now() / 1000, dt = Math.min(now - last, 0.1);
    const gap = (now - last) * 1000;
    // Its first second after starting, or waking from rest, is shaders and new cells, not what it costs.
    if (rested) (runningSince = now), (rested = false);
    if (o.quality === undefined && now - runningSince > 1) {
      gaps.push(gap);
      settle(now);
    }
    last = now;
    return { now, dt };
  };

  frame = () => {
    raf = 0;
    if (onStage) return;
    over();
    const { now, dt } = tick(), live = advance(now, dt);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // A blast has nothing to bend here: the page under it is drawn by the browser.
    shocks.length = 0;
    paint(live, dt, null);
    if (busy(live)) wake();
    else rested = true;
  };

  /**
   * Keeps its own canvas over the window, as what it draws is placed in the window. Fixed, that's where it is, unless it sits in something
   * shown bigger or moved, as a page under a camera is: then it's that thing's size and moves with it, and is turned back by as much.
   */
  let turned = [0, 0, 1];
  const over = () => {
    const r = canvas.getBoundingClientRect(), [tx, ty, q] = turned, k = canvas.offsetWidth ? r.width / (q * canvas.offsetWidth) : 1;
    const to = [(tx * k - r.left) / k, (ty * k - r.top) / k, 1 / k];
    if (to.every((v, i) => Math.abs(v - turned[i]!) < 1e-3)) return;
    turned = to;
    const plain = Math.abs(to[2]! - 1) < 1e-3 && Math.abs(to[0]!) < 0.5 && Math.abs(to[1]!) < 0.5;
    Object.assign(canvas.style, plain
      ? { inset: '0', width: '100%', height: '100%', transform: '', transformOrigin: '' }
      : { inset: 'auto', left: '0', top: '0', width: `${innerWidth}px`, height: `${innerHeight}px`, transform: `translate(${to[0]}px, ${to[1]}px) scale(${to[2]})`, transformOrigin: '0 0' });
  };

  // -- On the stage: the room is worked out before the pictures, takes their heights as each is drawn, and is drawn over them.
  let staging: { live: Body[]; dt: number; deep: boolean } | null = null;
  /** Where the air is drawn: its own canvas, or on the stage the light its camera shows. */
  let onto: WebGLFramebuffer | null = null;
  /** Moves onto the stage's context, or back onto its own. What's in the air is lost: it's on the context it was made on. */
  const move = (to: WebGL2RenderingContext | null) => {
    teardown();
    cancelAnimationFrame(raf);
    raf = 0;
    onStage = !!to;
    onto = null;
    gl = to ?? own!;
    if (to) canvas.remove();
    else parent.append(canvas);
    setup();
    size();
  };
  /** The targets the heights and the bend are drawn into, css px over the stage. Only their size matters, as each frame clears them. */
  const targets = (w: number, h: number) => {
    if (depth && depth.w === w && depth.h === h) return depth;
    if (depth) {
      for (const t of [depth.tex, depth.bend]) gl.deleteTexture(t);
      for (const f of [depth.fbo, depth.bent]) gl.deleteFramebuffer(f);
    }
    const tex = texture(w, h, gl.RGBA16F, gl.LINEAR), bend = texture(w, h, gl.RGBA16F, gl.LINEAR);
    return (depth = { w, h, tex, fbo: target(tex), bend, bent: target(bend) });
  };
  /**
   * A blast's front as it was at time `t` after it, s: its radius, mm, how much denser than the room it is at its front, and how
   * far behind its front that falls away by e, mm. Its overpressure falls over its positive phase much as e^-2 does, so about
   * half the length that phase spans in the air. Guess.
   */
  const front = (sh: (typeof shocks)[number], t: number): [number, number, number] => {
    const { r, t: at, w } = sh, n = FRONT_STEPS - 1;
    let R: number;
    if (t <= at[0]!) R = r[0]! * (t / at[0]!) ** 0.4;
    else if (t >= at[n]!) R = r[n]! + SOUND * (t - at[n]!);
    else {
      let lo = 0, hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (at[mid]! <= t) lo = mid;
        else hi = mid;
      }
      R = r[lo]! + ((r[hi]! - r[lo]!) * (t - at[lo]!)) / (at[hi]! - at[lo]!);
    }
    const z = R / w, p = overpressure(z);
    return [R / MM, jump(p), (0.5 * runs(p) * lasts(z) * w) / 1000 / MM];
  };
  /** How far what's seen moves for the air's bends, onto the bend target. Heights are last frame's. Whether anything bent. */
  const bending = (live: Body[], now: number): boolean => {
    const d = depth!, mmPerPx = 1 / scale(), diagonal = Math.hypot(view.w, view.h) * mmPerPx;
    // Each blast seen for a shutter's time, in four looks, while any of its front is still where it's drawn.
    const looks: number[] = [];
    for (let i = shocks.length - 1; i >= 0; i--) {
      const sh = shocks[i]!, t = now - sh.from;
      let seen = false;
      for (let k = 0; k < 4; k++) {
        const at = t - (SHUTTER * (k + 0.5)) / 4;
        if (at <= 0) continue;
        const [r, a, th] = front(sh, at), cx = sh.x - view.x, cy = sh.y - view.y;
        if (a < 1e-5 || r - 8 * th > diagonal + Math.hypot(cx, cy) * mmPerPx) continue;
        seen = true;
        if (looks.length < MAX_SHOCKS * 6) looks.push(cx, cy, r, a, th, 0.25);
      }
      if (!seen && t > SHUTTER) shocks.splice(i, 1);
    }
    const hot = live.filter(b => b.grid);
    gl.bindFramebuffer(gl.FRAMEBUFFER, d.bent);
    gl.viewport(0, 0, d.w, d.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!looks.length && !hot.length) return false;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(quadVao);
    if (hot.length) {
      gl.useProgram(bendPlume.p);
      bind(bendPlume, 'uHeights', 3, d.tex);
      gl.uniform2f(bendPlume.u('uViewPx'), d.w, d.h);
      for (const b of hot) {
        const g = b.grid!, [x, y, w, h] = b.box, [z0, z1] = slab(b);
        gridUniforms(bendPlume, g);
        bind(bendPlume, 'uVel', 0, g.vel[g.cur]!);
        gl.uniform3f(bendPlume.u('uSlab'), z0, z1, b.o.z !== undefined ? 1 : 0);
        gl.uniform4f(bendPlume.u('uFade'), ...fades(b));
        gl.uniform4f(bendPlume.u('uRect'), ...clip(x, y, w, h));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    if (looks.length) {
      gl.useProgram(shockBend.p);
      bind(shockBend, 'uHeights', 3, d.tex);
      gl.uniform2f(shockBend.u('uViewPx'), d.w, d.h);
      gl.uniform1f(shockBend.u('uMmPerPx'), mmPerPx);
      const n = looks.length / 6, a = new Float32Array(MAX_SHOCKS * 4), b = new Float32Array(MAX_SHOCKS * 2);
      for (let i = 0; i < n; i++) a.set(looks.slice(i * 6, i * 6 + 4), i * 4), b.set(looks.slice(i * 6 + 4, i * 6 + 6), i * 2);
      gl.uniform4fv(shockBend.u('uShock'), a);
      gl.uniform2fv(shockBend.u('uShockShell'), b);
      gl.uniform1i(shockBend.u('uShockCount'), n);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    return true;
  };
  unlayer = stageLayer({
    before(f: StageFrame) {
      if (f.gl !== gl) move(f.gl);
      // The context is shared: take nothing the renderer left set.
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.blendEquation(gl.FUNC_ADD);
      gl.colorMask(true, true, true, true);
      view = { x: f.left, y: f.top, w: f.w, h: f.h, ratio: f.ratio };
      onto = f.target;
      const { now, dt } = tick(), live = advance(now, dt);
      // Heights are worth taking only while something in the air stands at a height or bends.
      const deep = live.length > 0 || shocks.length > 0;
      staging = { live, dt, deep };
      if (!deep) return null;
      const d = targets(Math.max(Math.ceil(f.w), 1), Math.max(Math.ceil(f.h), 1));
      const bent = bending(live, now);
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo);
      gl.viewport(0, 0, d.w, d.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return bent ? d.bend : null;
    },
    shot(s: StageShot, f: StageFrame) {
      if (f.gl !== gl || !staging?.deep || !depth) return;
      const d = depth;
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo);
      gl.viewport(0, 0, d.w, d.h);
      // Where two pictures meet, what stands taller is in front.
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      gl.bindVertexArray(quadVao);
      gl.useProgram(heights.p);
      bind(heights, 'uH', 0, s.height ?? noiseTex);
      gl.uniform1i(heights.u('uFlat'), s.height ? 0 : 1);
      gl.uniform1f(heights.u('uFace'), s.face);
      gl.uniform4f(heights.u('uToMap'), ...s.toMap);
      gl.uniform1f(heights.u('uRows'), d.h);
      const [x, y, w, h] = s.box;
      gl.uniform4f(heights.u('uRect'), (x / d.w) * 2 - 1, 1 - ((y + h) / d.h) * 2, ((x + w) / d.w) * 2 - 1, 1 - (y / d.h) * 2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    after(f: StageFrame) {
      if (f.gl !== gl || !staging) return;
      const { live, dt, deep } = staging;
      staging = null;
      paint(live, dt, deep && depth ? depth.tex : null);
      if (busy(live)) wake();
      else rested = true;
    },
    leave(was) {
      if (onStage && was === gl) move(null);
    },
  });
  return field;
}
