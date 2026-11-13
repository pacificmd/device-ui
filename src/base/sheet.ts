import { resolveBend, type Bend, type BendOptions } from './bend.js';
import { getMaterialDef, resolveMaterial } from './registry.js';
import { bounds, mask, ring, type Shape, type Solid } from './shapes.js';
import type { Breaks, Material, MaterialDef, Part, Vec3 } from './types.js';

/** Height of a device's face, mm. */
export const TOP = 4;

/** Css px to the mm. */
export const MM = 4;

/** The colour of a keyboard focus ring. */
export const FOCUS: Vec3 = [7, 3.2, 0.5];

/** What a surface offers the parts nested in it, in css px and mm. */
export interface Seat {
  top: number;
  crown: [number, number];
  x: number;
  y: number;
  w: number;
  h: number;
  /** For a surface in steps, such as a shelf: how high it stands at a point, mm, in place of `top`. */
  at?(x: number, y: number): number;
}

const seats = new WeakMap<Element, Seat>();

/** Offers a surface to the parts nested in it. Any part can hold others this way, not only a `d-surface`. */
export function offerSeat(el: Element, seat: Seat): void {
  seats.set(el, seat);
}

/** The nearest thing round a part that offers a seat. */
function holder(el: Element): Seat | undefined {
  for (let up = el.parentElement; up; up = up.parentElement) {
    const seat = seats.get(up);
    if (seat) return seat;
  }
  return undefined;
}

/** What a part can be printed on. */
export interface Ground {
  shape: Shape;
  seed: [number, number];
  /** How worn it is, and how big its chips, which go through whatever's printed on it. */
  wear: number;
  size: number;
}

const grounds = new WeakMap<Element, Ground>();

/** Says a surface or a device's face is what the parts nested in it are printed on. */
export function offerGround(el: Element, c: SurfaceCommand): void {
  grounds.set(el, { shape: c.shape, seed: c.seed, wear: c.material.wear, size: c.material.chip });
}

/** The box of the surface a part is nested in, if it is. */
export function seatBox(p: Pick<Part, 'el'>): { x: number; y: number; w: number; h: number } | undefined {
  return holder(p.el);
}

/** Whether a part is nested in a surface that swells, so something flat wouldn't meet it all round. */
export function seatCurves(p: Pick<Part, 'el'>): boolean {
  const seat = holder(p.el);
  return !!seat && (seat.crown[0] !== 0 || seat.crown[1] !== 0);
}

/** Which way a surface's grain runs, from its `lay` attribute: degrees clockwise from level, as a machinist reads a lay. Without one it keeps the material's. */
export const layOf = (lay: string | null): { tangent?: number } => (lay === null ? {} : { tangent: (+lay * Math.PI) / 180 });

/** How high a part stands, mm: on the surface it's nested in, where its middle lands, or else on the device's face. */
export function seatOf(p: Pick<Part, 'el' | 'x' | 'y' | 'w' | 'h'>): number {
  const seat = holder(p.el);
  if (!seat) return TOP;
  if (seat.at) return seat.at(p.x + p.w / 2, p.y + p.h / 2);
  const qx = (p.x + p.w / 2 - seat.x - seat.w / 2) / (seat.w / 2), qy = (p.y + p.h / 2 - seat.y - seat.h / 2) / (seat.h / 2);
  return seat.top - seat.crown[0] * qx * qx - seat.crown[1] * qy * qy;
}

export type Profile = 'flat' | 'round' | 'chamfer' | 'dome' | 'blend';

export interface SurfaceOptions {
  material?: string;
  /** Overrides on the named material. */
  over?: Partial<MaterialDef>;
  /** Height at the outline, mm, where 0 is the surface the part sits on. Goes down as deep as a device's face stands, if left out. */
  zEdge?: number;
  /** Height of the top face, mm, where 0 is the surface the part sits on. */
  zTop?: number;
  /** How far the top stands above what it sits on, mm, in place of `zTop`. */
  rise?: number;
  /** Heights count from whatever is underneath at each point, so the surface takes on its curve and its edge meets it. */
  follow?: boolean;
  /** With `follow`: lies across what's under it rather than down into it, as a stiff sheet does. Seams and steps go soft over this distance, css px, and its outline still presses down. */
  bridge?: number;
  /** Lies flat on the highest thing under it and takes none of its shape, as a card does, with `rise` for its thickness. It can hang past the device's edge. */
  rest?: boolean;
  /** How far in from the outline the edge profile runs, css px. */
  bevel?: number;
  profile?: Profile;
  /** Depth of a shallow hollow in the top, mm. Two numbers curve it across x and across y alone, so `[d, 0]` is a trough running along y, as on a cylindrical keycap. */
  dish?: number | [number, number];
  /** How far the top falls from its middle to its edges, mm, so it swells instead of lying flat. Two numbers swell it along x and along y alone. */
  crown?: number | [number, number];
  /** How far the top falls across it toward +x and toward +y, mm, as a key or a rocker does as it turns on its pivot, or a sculpted keycap leans. One number tilts it along y. */
  tilt?: number | [number, number];
  /** Where it turns as it tilts, -1 to 1 from its middle along x and y, so `[0, -1]` is its back edge, which stays where it is. The middle if left out. */
  pivot?: [number, number];
  /** Brush in circles around the shape's centre. */
  radial?: boolean;
}

export interface SurfaceCommand {
  op: 'surface';
  shape: Shape;
  /** The name it was asked for by. */
  name: string;
  material: Material;
  zEdge: number;
  zTop: number;
  /** What it's built round, mm: it goes as far below this as it stands above. 0 is solid down to the ground. */
  mid: number;
  follow: boolean;
  bridge: number;
  rest: boolean;
  /** The most it can stand above the ground, mm. A following surface can't know its height exactly. */
  reach: number;
  bevel: number;
  profile: Profile;
  dish: [number, number];
  crown: [number, number];
  /** How far the top falls from its middle to its +x and +y edges, mm, and rises as far at the others: a plane through the middle. `zTop` is its middle. */
  tilt: [number, number];
  radial: boolean;
  seed: [number, number];
  /** A face's own body, or a layer of it. It's the same solid the other faces show, so never drawn edge-on as a part. */
  body?: boolean;
  /**
   * A layer of the body: the front's own, or a surface standing on it as wide as it is. The body is the stack of them, and a face
   * beside them shows them side on.
   */
  layer?: boolean;
  /** A face whose body is the others' layers side on: it has no outline of its own. */
  section?: boolean;
}

export interface CutOptions {
  /** How far to cut into whatever is underneath, mm. Negative raises it. */
  depth?: number;
  /** Paint in the cut, as a colour in linear RGB. */
  ink?: Vec3;
  rough?: number;
  metal?: number;
  wear?: number;
  /** Light from the ink, for backlit legends. Linear RGB. With no ink, it's a lamp under what it's on: light added, its colour left as it was. */
  emit?: Vec3;
  /** Sloped width of the cut's sides, css px. */
  soft?: number;
  /** Fades the ink in from its edge over this many css px, for a soft patch of light. */
  feather?: number;
  /** What it stops at, for a part that's nested in a surface and not drawn in its `on`. */
  stop?: Shape;
}

export interface CutCommand {
  op: 'cut';
  shape: Shape;
  depth: number;
  ink: Vec3 | null;
  rough: number;
  metal: number;
  wear: number;
  emit: Vec3 | null;
  soft: number;
  feather: number;
  seed: [number, number];
  /** The surface it was drawn on, as placed, which it stops at. */
  on?: Shape;
  /** The chips in that surface, which go through this. */
  chips?: Pick<Ground, 'seed' | 'wear' | 'size'>;
}

export interface GlowCommand {
  op: 'glow';
  shape: Shape;
  color: Vec3;
  width: number;
}

export interface GlassOptions {
  /** Height of the dome above what is underneath, mm. */
  height?: number;
  /** How far in from the outline the dome curves, css px. */
  bevel?: number;
  /** Strength of the shine, 0 to 1. */
  coat?: number;
  /** A cover you can't reach through, such as a shut lid. Otherwise it's only something to look through. */
  covers?: boolean;
  /**
   * How far the glass tilts at its edge for what it reflects, as a slope. A real crystal is too shallow to catch the
   * lights of a room. Around 0.6 brings the lights in, and below 0 it hollows, as the inner faces of a lens do.
   */
  curve?: number;
  /** How thick an anti-reflection film it has, 0 to 1, as on a metal: what it reflects changes colour with the angle. */
  film?: number;
  /** How wide the edge rolls over, mm. Polished glass has no sharp edge, and the roll is what catches the light. */
  rim?: number;
  /**
   * A flat cut round its top edge, as `[width mm, angle °]` from the face. A flat crystal is read by this more than anything:
   * it faces a different part of the room from the face, so it shows as a band where the face shows nothing.
   */
  chamfer?: [number, number];
  /** What it's made of, a material with an `ior`, which sets how much each face reflects. Plain glass if not given. */
  material?: string;
  /** The colour of what it reflects, for a coated lens. Linear RGB. */
  tint?: Vec3;
  /** How thick the sheet is, mm, which sets how it breaks and how a crack in it shows. A guess from what it's made of if not given. */
  thick?: number;
}

/** How thick a sheet is if nothing says, mm, by how it breaks: a phone's cover glass, a watch's crystal, a moulded window (guesses). */
export const THICK: Record<Breaks, number> = { glass: 1, crystal: 2, split: 2, craze: 1.5 };

export interface GlassCommand {
  op: 'glass';
  covers: boolean;
  shape: Shape;
  height: number;
  bevel: number;
  coat: number;
  curve: number;
  film: number;
  rim: number;
  /** Width mm and slope of the cut round its top edge. */
  chamfer: [number, number];
  /** What its two faces reflect between them, square on. */
  reflect: number;
  tint: Vec3;
  /** How it breaks, and how thick it is, mm: see fracture.ts. Nothing for what doesn't break. */
  breaks: Breaks | null;
  thick: number;
}

export interface FrostOptions {
  /** How far what is underneath spreads, css px. 0 leaves it sharp, for smoked glass. */
  blur?: number;
  /** The glass's own colour, in linear RGB. */
  tint?: Vec3;
  /** How much of that colour shows, 0 to 1. The rest is what is underneath. */
  opacity?: number;
  /** How much light from below gets through, 0 to 1. */
  transmit?: number;
  /** How many times bigger what's underneath looks, about the pane's middle, as through a lens. */
  zoom?: number;
  zEdge?: number;
  zTop?: number;
  bevel?: number;
  rough?: number;
  coat?: number;
  /** What the pane is made of, if it should wear and age as that does: a clear plastic hazes, scratches and yellows, glass doesn't. */
  material?: string;
  /** Its own wear, over the device's. */
  wear?: number;
}

export interface FrostCommand {
  op: 'frost';
  shape: Shape;
  blur: number;
  tint: Vec3;
  opacity: number;
  transmit: number;
  zoom: number;
  zEdge: number;
  zTop: number;
  bevel: number;
  rough: number;
  coat: number;
  /** How worn and aged its material is, and what that does to it, as a surface's. */
  wear: number;
  polish: number;
  age: number;
  patina: Vec3 | null;
}

export type ScreenKind = 'crt' | 'led' | 'lcd' | 'oled' | 'tft' | 'eink' | 'coat';

export interface ScreenOptions {
  kind?: ScreenKind;
  /** Brightness of a lit pixel. */
  gain?: number;
  /** The panel when dark, as a colour in linear RGB. */
  color?: Vec3;
  /** What a dark pixel turns into, on an LCD or e-ink panel, and what shows through where a coat has gone. On a TFT, the colour of its backlight. */
  ink?: Vec3;
  /** A tube with one even phosphor, so no colour stripes. */
  mono?: boolean;
  /** How far a tube's picture bows outwards, 0 for flat. */
  bulge?: number;
  /** Light from the panel itself, such as a backlight. */
  emit?: Vec3;
  /** How much of the panel's width and height, each side, is margin round its pixels, 0 to 0.5. */
  inset?: readonly [number, number];
  zTop?: number;
  rough?: number;
  coat?: number;
  /** How metal a `coat` screen's coat is, 0 to 1. What shows where it has gone is not. */
  metal?: number;
}

export interface ScreenCommand {
  op: 'screen';
  shape: Shape;
  source: TexImageSource;
  kind: ScreenKind;
  gain: number;
  color: Vec3;
  /** What a dark pixel turns into. A tube has no ink, so here it holds how deep its colour stripes run, then how far it bulges. */
  ink: Vec3;
  emit: Vec3;
  inset: readonly [number, number];
  zTop: number;
  rough: number;
  coat: number;
  metal: number;
}

/** `carried`: drawn in the group a part's joint moves, and not on what holds it. */
export type Command = (SurfaceCommand | CutCommand | GlowCommand | GlassCommand | FrostCommand | ScreenCommand) & { bend?: Bend; carried?: true };

export interface GroupOptions {
  /** Where the group's origin sits in the coordinates around it, css px. */
  at?: [number, number];
  /** Clockwise radians about that origin. Brushed grain turns with it. */
  rotate?: number;
  /** Reflects across the group's y axis. */
  mirror?: boolean;
  /** Raises what the group sits on, mm. */
  z?: number;
  /** Css px to one of the group's units, for everything but heights. `MM` draws in millimetres. */
  scale?: number;
  /** What's drawn in it is what the part's joint moves. What the part draws outside it, as a knob's scale printed round it, stays on what holds it. */
  carried?: boolean;
}

export interface SeamOptions {
  width?: number;
  /** How far down it goes, mm. */
  depth?: number;
}

export interface LampOptions {
  /** How much of the colour shows when it is dark. */
  dark?: number;
  /** How bright it gets, fully lit. */
  gain?: number;
}

interface Frame {
  x: number;
  y: number;
  a: number;
  flip: boolean;
  /** Css px to the unit. */
  k: number;
}

function placed(shape: Shape, f: Frame): Shape {
  const { k } = f, s = k === 1 ? shape : sized(shape, k), c = Math.cos(f.a), n = Math.sin(f.a);
  const X = (x: number, y: number) => f.x + (f.flip ? -x : x) * k * c - y * k * n, Y = (x: number, y: number) => f.y + (f.flip ? -x : x) * k * n + y * k * c;
  const turned = (r: number) => f.a + (f.flip ? -r : r);
  switch (s.type) {
    case 'capsule': return { ...s, ax: X(s.ax, s.ay), ay: Y(s.ax, s.ay), bx: X(s.bx, s.by), by: Y(s.bx, s.by) };
    // A label is a picture of the page, so it can move but not turn: what turns it is the picture, drawn turned. Here it only reaches as far as that goes.
    case 'mask': {
      if (!f.a) return { ...s, box: { ...s.box, x: s.box.x + f.x, y: s.box.y + f.y } };
      const { x, y, w, h } = s.box, xs = [x, x + w].flatMap(px => [y, y + h].map(py => f.x + px * c - py * n)), ys = [x, x + w].flatMap(px => [y, y + h].map(py => f.y + px * n + py * c));
      return { ...s, box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
    }
    case 'holes': return { ...s, cx: X(s.cx, s.cy), cy: Y(s.cx, s.cy) };
    case 'rect': return { ...s, cx: X(s.cx, s.cy), cy: Y(s.cx, s.cy), rotate: turned(s.rotate) };
    case 'arc': return { ...s, cx: X(s.cx, s.cy), cy: Y(s.cx, s.cy), rotate: turned(s.rotate), mid: f.flip ? -s.mid : s.mid };
    case 'field': {
      const moved = { ...s, cx: X(s.cx, s.cy), cy: Y(s.cx, s.cy), rotate: turned(s.rotate) };
      if (!f.flip) return moved;
      return {
        ...moved, key: `${s.key}|flip`,
        draw(ctx, w, h) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          s.draw(ctx, w, h);
        },
      };
    }
  }
}

/** Scales a shape's sizes, leaving where it sits to `placed`. */
function sized(s: Shape, k: number): Shape {
  const offset = { ...(s.grow && { grow: s.grow * k }), ...(s.ring && { ring: s.ring * k }) };
  switch (s.type) {
    case 'mask': return s;
    case 'capsule': return { ...s, ...offset, ra: s.ra * k, rb: s.rb * k };
    case 'holes': return { ...s, ...offset, hw: s.hw * k, hh: s.hh * k, radius: s.radius * k, pitch: s.pitch * k, hole: s.hole * k };
    case 'rect': return { ...s, ...offset, hw: s.hw * k, hh: s.hh * k, radius: s.radius * k, ripple: [s.ripple[0], s.ripple[1] * k, s.ripple[2]] };
    case 'arc': return { ...s, ...offset, hw: s.hw * k, hh: s.hh * k, r: s.r * k, width: s.width * k };
    // Its spread is css px whatever it's drawn in, as only the edge needs it, and grows only by what its outline moved out.
    case 'field': return {
      ...s, ...offset, hw: s.hw * k, hh: s.hh * k, spread: Math.max(s.spread, (Math.abs(s.grow ?? 0) + (s.ring ?? 0)) * k + 8), key: `${s.key}|x${k}`,
      ...(s.source && { source: { hw: s.source.hw * k, hh: s.source.hh * k } }),
      draw(ctx, w, h) {
        ctx.scale(k, k);
        s.draw(ctx, w / k, h / k);
      },
    };
  }
}

/**
 * A part declares what it is made of here, in painter's order. Nothing touches the GPU,
 * so sheets can be built and inspected anywhere.
 */
export class Sheet {
  readonly commands: Command[] = [];
  private count = 0;
  private bent: Bend | undefined;
  /** What the whole device is rolled over, so every part is. */
  private body: Bend | undefined;
  private frame: Frame = { x: 0, y: 0, a: 0, flip: false, k: 1 };
  private level = TOP;
  /** The top of the last surface, which is what a well cuts into. */
  private top = TOP;
  /** What this part sits on, mm. Every height it asks for counts from here. */
  private seat = TOP;
  /** The surface whose `on` is drawing, as placed: what's cut or printed there stops at its edge. */
  private holder: Shape | undefined;
  /** What's printed now lies on this, and goes where it's chipped. */
  private printedOn: Ground | undefined;
  /** What a round body is built round, mm, which its parts go with. */
  private round = 0;
  /** How much this part has been handled, against the rest of its device. It rubs and wears that much more, or less. */
  private use = 1;
  /** What this part is built round, mm. */
  private mid = 0;

  /** `age` and `state` are the defaults for every surface, and `over` replaces them for one. */
  constructor(private readonly seedBase = 0, private readonly age = 0, private readonly state: Partial<MaterialDef> = {}) {}

  /** Starts a part. Its seeds count from here, so one part drawing more never reshuffles the next. */
  part(index: number, seat = TOP, clear = false, middle = seat, use = 1): void {
    this.count = (index + 1) * 1024;
    this.use = use;
    // One standing clear of the body is built round its own seat, and doesn't turn with the body.
    this.bent = clear ? undefined : this.body;
    this.mid = clear ? middle : this.round;
    this.frame = { x: 0, y: 0, a: 0, flip: false, k: 1 };
    this.level = this.top = this.seat = seat;
  }

  private add(c: Command, shape: Shape = placed(c.shape, this.frame)): this {
    this.commands.push({ ...c, shape: shape as never, ...(this.bent && { bend: this.bent }), ...(this.carrying && { carried: true as const }) });
    return this;
  }

  /** Inside a group a joint moves. */
  private carrying = false;

  /** A size in the current units as css px, or the default, which is css px already. */
  private px(v: number | undefined, fallback: number): number {
    return v === undefined ? fallback : v * this.frame.k;
  }

  /** Where a shape drawn here lands on the device. */
  resolve(shape: Shape): Shape {
    return placed(shape, this.frame);
  }

  /**
   * Draws in coordinates of its own, so a thing is drawn once around its own origin, and moving,
   * turning or mirroring it is one number. Groups nest.
   */
  group(o: GroupOptions, draw: () => void): this {
    const { frame, level, top, seat, carrying } = this, [x, y] = o.at ?? [0, 0];
    const c = Math.cos(frame.a), n = Math.sin(frame.a), sx = (frame.flip ? -x : x) * frame.k, sy = y * frame.k, turn = o.rotate ?? 0;
    this.frame = {
      x: frame.x + sx * c - sy * n, y: frame.y + sx * n + sy * c,
      a: frame.a + (frame.flip ? -turn : turn), flip: frame.flip !== !!o.mirror, k: frame.k * (o.scale ?? 1),
    };
    // Every height asked for inside counts from the raised seat, so a part drawn as it sits in a panel can be stood on a body as it is.
    this.level = level + (o.z ?? 0);
    this.top = top + (o.z ?? 0);
    this.seat = seat + (o.z ?? 0);
    this.carrying = carrying || !!o.carried;
    draw();
    this.carrying = carrying;
    this.frame = frame;
    this.level = level;
    this.top = top;
    this.seat = seat;
    return this;
  }

  /**
   * Rolls everything drawn after this over a curve, as if it were painted on a flat sheet and then
   * bent. Grain, cuts, ink and screens all close up as they turn away. Draw shapes at their flat
   * size. `s.bend()` goes back to flat, and each part starts flat.
   */
  bend(o?: BendOptions): this {
    this.bent = o ? resolveBend(o) : this.body;
    return this;
  }

  /** Rolls every part from here on, whatever it draws. Give `round` when it's round both ways, and that's the height it's built round. */
  roll(o: BendOptions, round = 0): this {
    this.body = this.bent = resolveBend(o);
    this.round = this.mid = round;
    return this;
  }

  private seed(): [number, number] {
    this.count += 1;
    const n = this.count + this.seedBase * 131;
    return [(n * 73.1) % 997, (n * 41.7) % 991];
  }

  /** What `on` draws sits on this surface, so its `rise` counts from this surface's top. */
  surface(shape: Shape, o: SurfaceOptions = {}, on?: () => void): this {
    const resolved = resolveMaterial(o.material ?? 'plain', { age: this.age, ...this.state, ...o.over }), used = this.use;
    const material = used === 1 ? resolved : { ...resolved, touch: Math.min(resolved.touch * used, 1), wear: Math.min(resolved.wear * used, 1) };
    const where = placed(shape, this.frame), rest = o.rest ?? false, follow = !rest && (o.follow ?? false);
    const zEdge = rest ? this.tallest(where) : follow ? o.zEdge ?? 0 : o.zEdge !== undefined ? o.zEdge + this.seat : o.rise === undefined ? this.seat - TOP : this.level;
    const zTop = o.rise !== undefined ? zEdge + o.rise : follow ? o.zTop ?? TOP : (o.zTop ?? 0) + this.seat;
    const base = follow ? this.top : 0;
    // A round capsule stands its radius above its top, so what's measuring its shadow and what rests on it have to know.
    const lift = where.type === 'capsule' && (o.profile ?? 'round') === 'round' ? Math.max(where.ra, where.rb) / MM : 0;
    const turn = 'rotate' in where ? where.rotate : this.frame.a;
    // Tilted, it turns on its pivot, which stays at zTop: the middle moves by as much as the pivot is off it, and the high edge is what it can reach.
    const [fx, fy] = typeof o.tilt === 'number' ? [0, o.tilt] : o.tilt ?? [0, 0], [px, py] = o.pivot ?? [0, 0];
    const tilt: [number, number] = [fx / 2, fy / 2], middle = zTop + tilt[0] * px + tilt[1] * py, high = middle + Math.abs(tilt[0]) + Math.abs(tilt[1]);
    this.add({
      // Handling marks are laid over the device and stay where they are, so what turns lets go of them.
      op: 'surface', shape, name: o.material ?? 'plain', material: turn ? { ...material, tangent: material.tangent + turn, marks: material.marks * Math.max(1 - Math.abs(turn) * 8, 0) } : material,
      zEdge, zTop: middle, mid: this.mid, follow, bridge: this.px(o.bridge, 0), rest, reach: follow ? this.tallest(where) + Math.max(zEdge, high, 0) + lift : high + lift, bevel: this.px(o.bevel, 2), profile: o.profile ?? 'round',
      dish: typeof o.dish === 'number' ? [o.dish, o.dish] : o.dish ?? [0, 0], crown: typeof o.crown === 'number' ? [o.crown, o.crown] : o.crown ?? [0, 0], tilt,
      radial: o.radial ?? false, seed: this.seed(),
    }, where);
    this.top = base + zTop;
    if (on) {
      const { level, top, holder } = this;
      this.level = top;
      this.holder = where;
      on();
      this.level = level;
      this.top = top;
      this.holder = holder;
    }
    return this;
  }

  /** The highest anything drawn so far stands under a shape, mm. */
  private tallest(shape: Shape): number {
    const b = bounds(shape, 0);
    let most = 0;
    for (const c of this.commands) {
      if (c.op !== 'surface' || c.reach <= most) continue;
      const o = bounds(c.shape, 0);
      if (o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y) most = c.reach;
    }
    return most;
  }

  /** Cuts relative to the surface below, so a cut follows a key as it moves. */
  cut(shape: Shape, o: CutOptions = {}): this {
    return this.add({
      op: 'cut', shape, depth: o.depth ?? 0, ink: o.ink ?? null, rough: o.rough ?? 0.5,
      metal: o.metal ?? 0, wear: Math.min((o.wear ?? 0) * this.use, 1), emit: o.emit ?? null, soft: this.px(o.soft, 0.7), feather: this.px(o.feather, 0), seed: this.seed(),
      ...(o.stop ? { on: placed(o.stop, this.frame) } : this.holder && { on: this.holder }),
      ...(this.printedOn && { on: this.printedOn.shape, chips: this.printedOn }),
    });
  }

  /** The surface just laid is what's printed on `el` lies on, as a sticker's sheet is for its print. */
  ground(el: Element): void {
    const c = this.commands[this.commands.length - 1];
    if (c?.op === 'surface') offerGround(el, c);
  }

  /** What `draw` lays down is printed on whatever holds this part, or on the part itself where `own`: it stops at that one's edge and holes, and comes away with it. */
  printing(el: Element, draw: () => void, own = false): void {
    let ground: Ground | undefined;
    for (let up = own ? el : el.parentElement; up && !ground; up = up.parentElement) ground = grounds.get(up);
    this.printedOn = ground;
    draw();
    this.printedOn = undefined;
  }

  /** Lays ink on what is underneath, with no depth of its own. */
  print(shape: Shape, ink: Vec3, o: Omit<CutOptions, 'ink' | 'depth'> = {}): this {
    return this.cut(shape, { ...o, ink });
  }

  /** Cuts a shape in, left the colour of what it cuts. */
  engrave(shape: Shape, depth = 0.2, o: Omit<CutOptions, 'depth'> = {}): this {
    return this.cut(shape, { ...o, depth });
  }

  /** Prints a part's own text where the page put it, however the part draws. */
  legend(p: Pick<Part, 'label'>, ink: Vec3, o: Omit<CutOptions, 'ink'> = {}): this {
    if (!p.label) return this;
    const { frame } = this;
    this.frame = { x: 0, y: 0, a: 0, flip: false, k: 1 };
    this.cut(mask(p.label), { depth: 0.04, ...o, ink });
    this.frame = frame;
    return this;
  }

  /** A recess in whatever is underneath, following its curve. What `on` draws sits on its floor. */
  well(shape: Shape, depth: number, o: SurfaceOptions = {}, on?: () => void): this {
    const { top } = this;
    this.surface(shape, { material: 'well', bevel: 1 / this.frame.k, follow: o.zEdge === undefined, ...o, rise: -depth }, on);
    this.top = top;
    return this;
  }

  /** The dark line where two parts of an object meet. */
  seam(shape: Solid, o: SeamOptions = {}): this {
    return this.cut(ring(shape, o.width ?? 0.8 / this.frame.k), { depth: o.depth ?? 0.5, ink: [0.008, 0.008, 0.009], rough: 0.8, soft: 0.5 / this.frame.k });
  }

  /** A patch of light: nothing much until `level` brings it up. */
  lamp(shape: Shape, color: Vec3, level = 1, o: LampOptions = {}): this {
    const dark = o.dark ?? 0.02, gain = o.gain ?? 0.6, tint = (k: number) => color.map(v => v * k) as Vec3;
    return this.cut(shape, { ink: tint(dark), emit: tint(dark + level * gain) });
  }

  /**
   * Puts a clear cover over what has been drawn so far. It's a surface of its own above what's under it, so it changes
   * nothing there and only adds a reflection. That goes for the eight biggest in a device, if they're plain rounded boxes.
   */
  glass(shape: Shape, o: GlassOptions = {}): this {
    // Fresnel square on, at each face, and both faces with what passes between them.
    const def = o.material ? getMaterialDef(o.material) : null, n = def?.ior || 1.52, r = ((n - 1) / (n + 1)) ** 2;
    const [cw, ca] = o.chamfer ?? [0, 0];
    return this.add({
      op: 'glass', shape, covers: !!o.covers, height: o.height ?? 1.2, bevel: this.px(o.bevel, 8), coat: o.coat ?? 1,
      curve: o.curve ?? 0, film: o.film ?? 0, rim: o.rim ?? 0.5, chamfer: [cw, Math.tan((ca * Math.PI) / 180)], reflect: (2 * r) / (1 + r), tint: o.tint ?? [1, 1, 1],
      breaks: def ? def.breaks ?? null : 'glass', thick: o.thick ?? THICK[(def ? def.breaks : 'glass') ?? 'glass'],
    });
  }

  /**
   * Lays a pane over what has been drawn so far, seeing and blurring it for real.
   * Light from below comes through, so a lit display shows up inside smoked glass.
   */
  frost(shape: Shape, o: FrostOptions = {}): this {
    const m = o.material ? resolveMaterial(o.material, { age: this.age, ...this.state, ...(o.wear !== undefined ? { wear: o.wear } : {}) }) : undefined;
    return this.add({
      wear: m ? Math.min(m.wear * this.use, 1) : 0, polish: m?.polish ?? 0, age: m?.age ?? 0, patina: m?.patina ?? null,
      op: 'frost', shape, blur: this.px(o.blur, 14), tint: o.tint ?? [0.8, 0.82, 0.85], opacity: o.opacity ?? 0.25,
      transmit: o.transmit ?? 1, zoom: o.zoom ?? 1, zEdge: (o.zEdge ?? 0) + this.seat, zTop: (o.zTop ?? 1.5) + this.seat, bevel: this.px(o.bevel, 3), rough: o.rough ?? 0.42, coat: o.coat ?? 0.6,
    });
  }

  /** Shows a canvas, video or image as a screen, lit unless its kind is reflective. One source pixel is one pixel of the screen. */
  screen(shape: Shape, source: TexImageSource, o: ScreenOptions = {}): this {
    const kind = o.kind ?? 'crt';
    return this.add({
      op: 'screen', shape, source, kind, gain: o.gain ?? 3, color: o.color ?? [0.008, 0.009, 0.01],
      ink: kind === 'crt' ? [o.mono ? 0 : 0.22, o.bulge ?? 0.24, 0] : o.ink ?? (kind === 'tft' ? [1, 1, 1] : [0.02, 0.03, 0.02]), emit: o.emit ?? [0, 0, 0], inset: o.inset ?? [0, 0], zTop: (o.zTop ?? -0.6) + this.seat, rough: o.rough ?? 0.2,
      coat: o.coat ?? 0.8, metal: o.metal ?? 0,
    });
  }

  /** Adds light along a shape's outline, which spills onto its surroundings. */
  glow(shape: Shape, color: Vec3, width = 1.1): this {
    return this.add({ op: 'glow', shape, color, width: width * this.frame.k });
  }
}

/** Reads a physical length into mm: 2mm, 0.5cm, or a bare number of mm. */
export function parseLength(value: string | null, fallback: number): number {
  if (value == null || value === '') return fallback;
  const m = /^\s*(-?[\d.]+)\s*(mm|cm)?\s*$/.exec(value);
  if (!m) return fallback;
  return parseFloat(m[1]!) * (m[2] === 'cm' ? 10 : 1);
}
