import type { Box } from './types.js';

/** How a rippled edge is cut: smooth waves, sharp vees as a knurl is rolled, or round scoops with flat lands between, as on a coin. */
export const WAVE = { sine: 0, vee: 1, scoop: 2 } as const;

export interface RectShape {
  type: 'rect';
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  radius: number;
  /** Clockwise radians. */
  rotate: number;
  /** [count, depth px, wave] round the edge. See `WAVE`. */
  ripple: [number, number, number];
}

export interface CapsuleShape {
  type: 'capsule';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ra: number;
  rb: number;
}

export interface FieldShape {
  type: 'field';
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  rotate: number;
  /** Fields are cached by key, so one drawing can be reused and rotated for free. */
  key: string;
  /** How far outside the outline the distance is needed, css px. */
  spread: number;
  /** Set when a shape is shown at a different size to the one it was drawn at. */
  source?: { hw: number; hh: number };
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  /** Another outline on the same box, where this one stops. See `within`. */
  within?: { draw(ctx: CanvasRenderingContext2D): void; steep: number };
  /** The field itself at a point, css px from the top left of the box, when it's worked out and not flooded from the drawing. */
  solve?(x: number, y: number): number;
}

export interface HolesShape {
  type: 'holes';
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  radius: number;
  pitch: number;
  hole: number;
  square: boolean;
}

export interface MaskShape {
  type: 'mask';
  box: Box;
}

export interface ArcShape {
  type: 'arc';
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  rotate: number;
  r: number;
  width: number;
  /** Where the arc is centred, and how far it runs each way, in radians clockwise from up. */
  mid: number;
  half: number;
}

export interface Offset {
  /** How far a drawn field reaches past its own outline, css px. Negative pulls it in. */
  grow?: number;
  /** Width of the band centred on the outline, css px, in place of the filled shape. */
  ring?: number;
}

export type Shape = (RectShape | CapsuleShape | FieldShape | HolesShape | MaskShape | ArcShape) & Offset;

/** The shapes with an outline to work from. Labels and hole fields have none. */
export type Solid = Exclude<Shape, HolesShape | MaskShape>;

export interface RectOptions {
  radius?: number;
  rotate?: number;
}

export function rect(x: number, y: number, w: number, h: number, o: RectOptions = {}): RectShape {
  return {
    type: 'rect', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2,
    radius: Math.max(Math.min(o.radius ?? 0, w / 2, h / 2), 0), rotate: o.rotate ?? 0, ripple: [0, 0, 0],
  };
}

export interface CircleOptions {
  /** Scallops the edge: [count, depth px]. */
  ripple?: [number, number];
  /** Cuts round scoops into the edge, each taking most of its share, with a narrow flat land between, as on a coin edge: [count, depth px]. */
  scoop?: [number, number];
  /** Cuts sharp vees into the edge, crest to crest, as a knurling wheel rolls them: [count, depth px]. */
  vee?: [number, number];
}

export function circle(cx: number, cy: number, r: number, o: CircleOptions = {}): RectShape {
  const [n, depth, wave] = o.scoop ? [...o.scoop, WAVE.scoop] : o.vee ? [...o.vee, WAVE.vee] : [...(o.ripple ?? [0, 0]), WAVE.sine];
  return { type: 'rect', cx, cy, hw: r, hh: r, radius: r, rotate: 0, ripple: [n, depth, wave] };
}

/** A round-ended stroke along a circle, clockwise from `a0` to `a1`, in radians from up. Cheap to animate. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, width: number): ArcShape {
  const e = r + width / 2;
  return { type: 'arc', cx, cy, hw: e, hh: e, rotate: 0, r, width, mid: (a0 + a1) / 2, half: Math.abs(a1 - a0) / 2 };
}

/** A tapered rod rising from a to b. */
export function capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number): CapsuleShape {
  return { type: 'capsule', ax, ay, bx, by, ra, rb };
}

export interface HolesOptions {
  pitch?: number;
  hole?: number;
  radius?: number;
  /** In straight rows and columns, with a hole on the middle of the box, and not staggered. */
  square?: boolean;
}

/** A field of holes, whole ones only, filling a box. */
export function holes(x: number, y: number, w: number, h: number, o: HolesOptions = {}): HolesShape {
  return {
    type: 'holes', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2,
    radius: o.radius ?? 4, pitch: o.pitch ?? 8, hole: o.hole ?? 2.4, square: o.square ?? false,
  };
}

export const mask = (box: Box): MaskShape => ({ type: 'mask', box });

export interface PathOptions {
  /** minX minY width height of the path's coordinates. Defaults to 0 0 100 100. */
  viewBox?: [number, number, number, number];
  rotate?: number;
  spread?: number;
  /** Set to `evenodd` so that inner subpaths become holes, whichever way they wind. */
  rule?: CanvasFillRule;
}

/** Any SVG path, fitted to a box. */
export function path(d: string, x: number, y: number, w: number, h: number, o: PathOptions = {}): FieldShape {
  const [vx, vy, vw, vh] = o.viewBox ?? [0, 0, 100, 100];
  return {
    type: 'field', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, rotate: o.rotate ?? 0,
    spread: o.spread ?? 16,
    key: `p|${d}|${vx},${vy},${vw},${vh}|${Math.round(w)}x${Math.round(h)}|${o.rule ?? ''}`,
    draw(ctx, cw, ch) {
      ctx.scale(cw / vw, ch / vh);
      ctx.translate(-vx, -vy);
      ctx.fill(new Path2D(d), o.rule);
    },
  };
}

export interface TextOptions {
  font: string;
  letterSpacing?: string;
  wordSpacing?: string;
  align?: 'left' | 'center' | 'right';
  rotate?: number;
  spread?: number;
}

/** A line of text as a solid outline, so it can be bevelled and embossed like any shape. */
export function text(str: string, x: number, y: number, w: number, h: number, o: TextOptions): FieldShape {
  return {
    type: 'field', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, rotate: o.rotate ?? 0,
    spread: o.spread ?? 8,
    key: `t|${str}|${o.font}|${o.letterSpacing ?? ''}|${o.wordSpacing ?? ''}|${o.align ?? ''}|${Math.round(w)}x${Math.round(h)}`,
    draw(ctx, cw, ch) {
      ctx.font = o.font;
      ctx.letterSpacing = o.letterSpacing || '0px';
      ctx.wordSpacing = o.wordSpacing || '0px';
      ctx.textBaseline = 'middle';
      ctx.textAlign = o.align ?? 'center';
      ctx.fillText(str, o.align === 'left' ? 0 : o.align === 'right' ? cw : cw / 2, ch / 2);
    },
  };
}

/** An image as a solid outline, so it can be stamped or raised like any shape. What's see-through in it is outside. */
export function picture(image: HTMLImageElement, x: number, y: number, w: number, h: number, o: { spread?: number } = {}): FieldShape {
  return {
    type: 'field', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, rotate: 0,
    spread: o.spread ?? 4,
    key: `i|${image.currentSrc || image.src}|${Math.round(w)}x${Math.round(h)}`,
    // In whatever colour it's being filled with, as any shape is: the map of who's on top reads parts off these.
    draw(ctx, cw, ch) {
      const sheet = new OffscreenCanvas(Math.ceil(cw), Math.ceil(ch)), g = sheet.getContext('2d')!;
      g.drawImage(image, 0, 0, cw, ch);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = ctx.fillStyle;
      g.fillRect(0, 0, cw, ch);
      ctx.drawImage(sheet, 0, 0);
    },
  };
}

/** A box with its own radius at each corner, clockwise from top left. */
export function outline(x: number, y: number, w: number, h: number, r: [number, number, number, number], o: PathOptions = {}): FieldShape {
  const [a, b, c, d] = r, arc = (k: number, tx: number, ty: number) => (k ? `A${k} ${k} 0 0 1 ${tx} ${ty}` : `L${tx} ${ty}`);
  const line = `M${a} 0H${w - b}${arc(b, w, b)}V${h - c}${arc(c, w - c, h)}H${d}${arc(d, 0, h - d)}V${a}${arc(a, a, 0)}Z`;
  return path(line, x, y, w, h, { viewBox: [0, 0, w, h], ...o });
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, o: PathOptions = {}): FieldShape {
  const line = `M0 ${ry}A${rx} ${ry} 0 1 1 ${2 * rx} ${ry}A${rx} ${ry} 0 1 1 0 ${ry}Z`;
  return path(line, cx - rx, cy - ry, 2 * rx, 2 * ry, { viewBox: [0, 0, 2 * rx, 2 * ry], spread: Math.max(rx, ry), ...o });
}

/** A point of a `poly`, with the radius of its corner. */
export type Point = readonly [x: number, y: number, radius?: number];

const short = (n: number) => +n.toFixed(3);

/** The SVG path of a polygon with its own radius at each corner, for a device's `path`. */
export function polyline(points: readonly Point[]): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y, r = 0] = points[i]!, [px, py] = points[(i + n - 1) % n]!, [nx, ny] = points[(i + 1) % n]!;
    const ax = px - x, ay = py - y, bx = nx - x, by = ny - y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const half = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) / 2;
    // A radius too big for its edges takes all it can get and no more.
    const t = Math.min(r / Math.tan(half), la / 2, lb / 2), k = t * Math.tan(half);
    const from = `${short(x + (ax / la) * t)} ${short(y + (ay / la) * t)}`, to = `${short(x + (bx / lb) * t)} ${short(y + (by / lb) * t)}`;
    d += `${i ? 'L' : 'M'}${from}`;
    if (k > 0) d += `A${short(k)} ${short(k)} 0 0 ${ax * by - ay * bx < 0 ? 1 : 0} ${to}`;
  }
  return `${d}Z`;
}

/** A smooth closed curve through points, as path data. Corners come from putting points close together. */
export function spline(points: readonly (readonly [number, number])[]): string {
  const n = points.length, at = (i: number) => points[(i + n) % n]!;
  let d = `M${short(at(0)[0])} ${short(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at(i - 1), [bx, by] = at(i), [cx, cy] = at(i + 1), [ex, ey] = at(i + 2);
    d += `C${short(bx + (cx - ax) / 6)} ${short(by + (cy - ay) / 6)} ${short(cx - (ex - bx) / 6)} ${short(cy - (ey - by) / 6)} ${short(cx)} ${short(cy)}`;
  }
  return `${d}Z`;
}

/** A polygon with its own radius at each corner, in plain coordinates. */
export function poly(points: readonly Point[], o: PathOptions = {}): FieldShape {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  return path(polyline(points), x, y, w, h, { viewBox: [x, y, w, h], ...o });
}

/** Moves a shape's outline out by `n`, or in if negative: the same key's well, gap, rim or focus ring. */
export function grow<S extends Solid>(s: S, n: number): S;
export function grow(s: Solid, n: number): Solid {
  switch (s.type) {
    case 'rect': return { ...s, hw: Math.max(s.hw + n, 0), hh: Math.max(s.hh + n, 0), radius: Math.max(s.radius + n, 0) };
    case 'capsule': return { ...s, ra: s.ra + n, rb: s.rb + n };
    case 'arc': return { ...s, hw: s.hw + n, hh: s.hh + n, width: s.width + n * 2 };
    case 'field': return { ...s, grow: (s.grow ?? 0) + n, spread: Math.max(s.spread, Math.abs((s.grow ?? 0) + n) + 8) };
  }
}

/** A band `width` wide centred on a shape's outline, for a seam or a line around something. */
export function ring<S extends Solid>(s: S, width: number): S {
  return s.type === 'field' ? { ...s, ring: width, spread: Math.max(s.spread, width + Math.abs(s.grow ?? 0) + 8) } : { ...s, ring: width };
}

export function fill(ctx: CanvasRenderingContext2D, s: Solid): void {
  if (s.grow || s.ring) throw new Error('Combine shapes first, then grow or ring the result.');
  ctx.save();
  if (s.type === 'capsule') {
    const a = Math.atan2(s.by - s.ay, s.bx - s.ax);
    ctx.beginPath();
    ctx.arc(s.ax, s.ay, s.ra, a + Math.PI / 2, a - Math.PI / 2);
    ctx.arc(s.bx, s.by, s.rb, a - Math.PI / 2, a + Math.PI / 2);
    ctx.fill();
  } else {
    ctx.translate(s.cx, s.cy);
    ctx.rotate(s.rotate);
    if (s.type === 'rect') {
      ctx.beginPath();
      ctx.roundRect(-s.hw, -s.hh, s.hw * 2, s.hh * 2, s.radius);
      ctx.fill();
    } else if (s.type === 'arc') {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.r, s.mid - s.half - Math.PI / 2, s.mid + s.half - Math.PI / 2);
      ctx.stroke();
    } else {
      const { hw, hh } = s.source ?? s;
      ctx.scale(s.hw / hw, s.hh / hh);
      ctx.translate(-hw, -hh);
      s.draw(ctx, hw * 2, hh * 2);
    }
  }
  ctx.restore();
}

const spreadless = (s: Solid): Box => bounds(s.type === 'field' ? { ...s, spread: 0 } : s, 0);
const relative = (s: Solid, x: number, y: number): string => {
  const { type: _, draw: __, cx, cy, ax, ay, bx, by, ...rest } = s as Solid & Record<string, unknown>;
  const n = (v: unknown, o: number) => (v as number - o).toFixed(2);
  return `${s.type === 'capsule' ? [n(ax, x), n(ay, y), n(bx, x), n(by, y)] : [n(cx, x), n(cy, y)]}${JSON.stringify(rest)}`;
};

function combined(name: string, box: Box, shapes: Solid[], draw: (ctx: CanvasRenderingContext2D) => void): FieldShape {
  const { x, y, w, h } = box;
  return {
    type: 'field', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, rotate: 0, spread: 16,
    key: `${name}|${Math.round(w)}x${Math.round(h)}|${shapes.map(s => relative(s, x, y)).join('|')}`,
    draw(ctx) {
      ctx.translate(-x, -y);
      draw(ctx);
    },
  };
}

function around(shapes: Solid[]): Box {
  const boxes = shapes.map(spreadless), x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
}

/** Everything inside any of these shapes, as one shape. */
export function union(...shapes: Solid[]): FieldShape {
  return combined('union', around(shapes), shapes, ctx => shapes.forEach(s => fill(ctx, s)));
}

/**
 * Draws on a layer of its own, so what it erases is only its own, whatever is under it and however it's being laid down. The layer is
 * only as big as `box` comes out where it's drawn, and kept for the next, one for each one drawn inside another: made new the size of
 * what it was drawn on, a field atlas's canvas, it was a tenth of the zoom page arriving.
 */
const layers: (OffscreenCanvas | HTMLCanvasElement)[] = [];
let layersIn = 0;
function apart(ctx: CanvasRenderingContext2D, box: Box, draw: (g: CanvasRenderingContext2D) => void): void {
  const m = ctx.getTransform(), xs: number[] = [], ys: number[] = [];
  for (const [x, y] of [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]]) {
    const p = m.transformPoint({ x, y });
    xs.push(p.x); ys.push(p.y);
  }
  const x0 = Math.max(Math.floor(Math.min(...xs)) - 1, 0), y0 = Math.max(Math.floor(Math.min(...ys)) - 1, 0);
  const x1 = Math.min(Math.ceil(Math.max(...xs)) + 1, ctx.canvas.width), y1 = Math.min(Math.ceil(Math.max(...ys)) + 1, ctx.canvas.height), w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const layer = (layers[layersIn] ??= typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : document.createElement('canvas'));
  if (layer.width < w || layer.height < h) { layer.width = Math.max(layer.width, w); layer.height = Math.max(layer.height, h); }
  const g = layer.getContext('2d') as CanvasRenderingContext2D;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  g.fillStyle = ctx.fillStyle;
  layersIn++;
  try { draw(g); } finally { layersIn--; g.restore(); }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0, w, h, x0, y0, w, h);
  ctx.restore();
}

/** The first shape with the others taken out of it. */
export function minus(first: Solid, ...rest: Solid[]): FieldShape {
  const box = spreadless(first);
  return combined('minus', box, [first, ...rest], ctx => apart(ctx, box, g => {
    fill(g, first);
    g.globalCompositeOperation = 'destination-out';
    rest.forEach(s => fill(g, s));
  }));
}

/** What the first shape and the second have in common. */
export function intersect(a: Solid, b: Solid): FieldShape {
  const box = spreadless(a);
  return combined('intersect', box, [a, b], ctx => apart(ctx, box, g => {
    fill(g, a);
    g.globalCompositeOperation = 'destination-in';
    fill(g, b);
  }));
}

/**
 * The first shape, stopped at the second but still measured from its own outline, so a wide bevel
 * can run along one side only: push the other sides of the shape out past `edge`, and they're cut
 * off part way up their slope. The cut itself falls `steep` times as fast as the bevel, a small
 * steep edge rather than a sheer one.
 */
export function within(shape: FieldShape, edge: Solid, steep = 8): FieldShape {
  const { cx, cy, hw, hh } = shape;
  return {
    ...shape, key: `within|${steep}|${shape.key}|${relative(edge, cx - hw, cy - hh)}`,
    within: { steep, draw: ctx => { ctx.translate(hw - cx, hh - cy); fill(ctx, edge); } },
  };
}

/** A round body as `lathe` makes it: how to stand it up, which is what makes its section a true circle. */
export interface Lathe extends FieldShape {
  /** Pass as the surface's `bevel`, with `profile: 'round'`. */
  bevel: number;
  /** Its widest radius, mm: the surface's `zTop` is this above its `zEdge`, and `zEdge` is the height of its axis. */
  radius: number;
}

/** Radius at each distance along, through the points, with no overshoot and no corner: a corner in a section this polished shows as a line. */
function monotone(points: readonly (readonly [number, number])[]): (x: number) => number {
  const n = points.length, slope = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / Math.max(p[0] - points[i]![0], 1e-6));
  const tan = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!, b = slope[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  return x => {
    let i = 0;
    while (i < n - 2 && x > points[i + 1]![0]) i++;
    const [x0, y0] = points[i]!, [x1, y1] = points[i + 1]!, h = Math.max(x1 - x0, 1e-6), t = Math.min(Math.max((x - x0) / h, 0), 1), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * tan[i]! + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * tan[i + 1]!;
  };
}

/**
 * Something turned on an axis, seen side on: a bell, a mouthpiece, a valve cap. It lies along x from \`x\`, centred on \`y\`, and \`profile\` is its radius at each distance along, css px.
 * Across any point its section is a true circle of that radius, however fast the radius changes, so light runs along a flare as it does on the real thing. A bevel from an outline can't do
 * that: its section depends on how far in you are, so it ridges down the middle of whatever is narrower than the bevel, and a capsule's radius has no slope where it starts, which kinks a chain of them.
 * `from` and `to` draw only that stretch of it, in the same place: a long body in two lets its wide end keep more of a field's detail.
 */
export function lathe(x: number, y: number, profile: readonly (readonly [number, number])[], o: { from?: number; to?: number; rotate?: number; spread?: number } = {}): Lathe {
  const radius = monotone(profile), start = o.from ?? profile[0]![0], end = o.to ?? profile[profile.length - 1]![0], L = end - start;
  let most = 0;
  for (let i = 0; i <= 200; i++) most = Math.max(most, radius(start + (L * i) / 200));
  const spread = o.spread ?? 4, widths = new Map<number, number>();
  return {
    type: 'field', cx: x + start + L / 2, cy: y, hw: L / 2, hh: most, rotate: o.rotate ?? 0, spread, bevel: most, radius: most * 0.25,
    key: `l|${start},${end}|${profile.join(';')}`,
    draw(ctx) {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) ctx.lineTo((L * i) / 200, most - radius(start + (L * i) / 200));
      for (let i = 200; i >= 0; i--) ctx.lineTo((L * i) / 200, most + radius(start + (L * i) / 200));
      ctx.fill();
    },
    solve(px, py) {
      const a = py - most;
      let r = widths.get(px);
      if (r === undefined) widths.set(px, (r = radius(start + px)));
      const off = Math.max(Math.abs(a) - r, -px, px - L);
      if (off >= 0) return off;
      // The height the circle has here, as a share of the widest, and the distance in from an edge whose rounded profile comes to that. Sheer at the two cut ends.
      const up = Math.sqrt(Math.max(r * r - a * a, 0)) / most, e = 1 - Math.sqrt(Math.max(1 - up * up, 0));
      return Math.max(-e * most, off * most);
    },
  };
}

/** Flattens a shape vertically about its middle, for flaps and wheels turning away. */
export function squash(s: FieldShape, y: number): FieldShape {
  const { hw, hh } = s.source ?? s;
  return { ...s, hh: hh * y, source: { hw, hh } };
}

/** The same drawing narrower about its middle, as a sheet looks turning over. */
export function squeeze(s: FieldShape, x: number): FieldShape {
  const { hw, hh } = s.source ?? s;
  return { ...s, hw: hw * x, source: { hw, hh } };
}

/** The css px area a shape can touch. */
export function bounds(s: Shape, margin = 2): Box {
  margin += s.ring ?? 0;
  if (s.type === 'mask') {
    return { x: s.box.x - margin, y: s.box.y - margin, w: s.box.w + margin * 2, h: s.box.h + margin * 2 };
  }
  if (s.type === 'capsule') {
    const r = Math.max(s.ra, s.rb) + margin;
    const x = Math.min(s.ax, s.bx) - r, y = Math.min(s.ay, s.by) - r;
    return { x, y, w: Math.abs(s.ax - s.bx) + r * 2, h: Math.abs(s.ay - s.by) + r * 2 };
  }
  const spread = s.type === 'field' ? s.spread : 0;
  const hw = s.hw + spread, hh = s.hh + spread;
  const rotate = s.type === 'holes' ? 0 : s.rotate;
  const c = Math.abs(Math.cos(rotate)), n = Math.abs(Math.sin(rotate));
  const bw = c * hw + n * hh + margin, bh = n * hw + c * hh + margin;
  return { x: s.cx - bw, y: s.cy - bh, w: bw * 2, h: bh * 2 };
}
