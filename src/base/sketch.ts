// What a device looks like before the GPU has drawn it: the edges of everything on it, from the same commands the renderer will draw,
// each in the colour it is. A seam on a white case is a grey line, a key on a black panel a black one, a legend its own ink. No
// shaders, so it can stand on the page while a device waits its turn, and it can't go stale.
import type { Scheme } from './registry.js';
import type { Command } from './sheet.js';
import { bounds, fill, type Shape, type Solid } from './shapes.js';
import type { Vec3 } from './types.js';

/** How wide each kind of edge is, screen px, and how strong: the body's, what stands on it, and what's cut or printed into it. */
const BODY = { width: 1.5, alpha: 1 }, PART = { width: 1, alpha: 0.9 }, CUT = { width: 1, alpha: 0.7 };
/** How much darker an edge is than the face it bounds, as the shadow in a seam is. */
const SEAM = 0.55;
/** On a dark page, the least an edge is lifted toward white, so a black thing still shows. */
const LIFT = 0.35;
/** The most pixels a sketch holds. A device shown bigger than that is drawn softer, not bigger. */
const MOST = 4e6;
/** Shown smaller than this on its longer side, screen px, a device has nothing worth sketching. */
export const LEAST_SHOWN = 64;

type Ctx = OffscreenCanvasRenderingContext2D;
let scratch: { a: OffscreenCanvas; b: OffscreenCanvas; x: Ctx; y: Ctx } | null = null;

function scratchFor(w: number, h: number) {
  if (!scratch || scratch.a.width < w || scratch.a.height < h) {
    const W = Math.max(w, scratch?.a.width ?? 0), H = Math.max(h, scratch?.a.height ?? 0);
    const a = new OffscreenCanvas(W, H), b = new OffscreenCanvas(W, H);
    scratch = { a, b, x: a.getContext('2d')!, y: b.getContext('2d')! };
  }
  return scratch;
}

/** Every whole step within `r` of the middle but the middle: what erodes a shape by `r` px, round. */
const reach = (r: number) => {
  const out: [number, number][] = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if ((x || y) && x * x + y * y <= r * r + 0.5) out.push([x, y]);
  return out;
};
const steps = new Map<number, [number, number][]>();

/** A linear colour as the screen shows it, darkened to a seam's, and on a dark page lifted so a dark one still shows. */
function seam(c: Vec3, scheme: Scheme, dark = SEAM): string {
  const s = c.map(v => Math.min(Math.max(v, 0), 1) ** (1 / 2.2) * dark);
  const lift = scheme === 'dark' ? Math.max(LIFT - Math.max(...s), 0) : 0;
  return `rgb(${s.map(v => Math.round((v + (1 - v) * lift) * 255)).join(' ')})`;
}

/** Fills a shape as the renderer would see its outline. A grown field is drawn as it was drawn: a millimetre or two out at most. */
function solid(ctx: Ctx, s: Shape): boolean {
  if (s.type === 'mask') return false;
  if (s.type === 'holes') {
    const r = s.hole / 2;
    ctx.beginPath();
    for (let y = s.cy - s.hh + s.pitch / 2; y < s.cy + s.hh; y += s.pitch) {
      for (let x = s.cx - s.hw + s.pitch / 2; x < s.cx + s.hw; x += s.pitch) {
        if (s.square) ctx.rect(x - r, y - r, r * 2, r * 2);
        else (ctx.moveTo(x + r, y), ctx.arc(x, y, r, 0, Math.PI * 2));
      }
    }
    ctx.fill();
    return true;
  }
  const { grow: _, ring: __, ...plain } = s as Solid & { grow?: number; ring?: number };
  fill(ctx as unknown as CanvasRenderingContext2D, plain as Solid);
  return true;
}

/** Sets a line `width` canvas px wide, whatever the transform it's drawn under. */
function widen(ctx: CanvasRenderingContext2D, width: number): void {
  const m = ctx.getTransform();
  ctx.lineWidth = width / (Math.hypot(m.a, m.b) || 1);
}

/**
 * A pen: the canvas, with what fills drawn as the line round it. A shape draws itself by filling, so handed this it draws its outline,
 * as one vector path. What it lays in from a layer of its own, as a shape with another taken out does, can't be traced that way: the
 * pen leaves that out, and says so.
 */
function pen(ctx: CanvasRenderingContext2D, width: number): { ctx: CanvasRenderingContext2D; layered: () => boolean } {
  let layered = false;
  const proxy = new Proxy(ctx, {
    get(t, k) {
      if (k === 'fill') return (...a: unknown[]) => (widen(t, width), t.stroke(...(a.filter(v => typeof v !== 'string') as [Path2D])));
      if (k === 'fillRect') return (x: number, y: number, w: number, h: number) => (widen(t, width), t.strokeRect(x, y, w, h));
      if (k === 'stroke') return (...a: [Path2D]) => (widen(t, width), t.stroke(...a));
      if (k === 'drawImage') return () => void (layered = true);
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
    // Its colour and how it lays down are the pen's, whatever the shape asks for.
    set: (t, k, v) => k === 'fillStyle' || k === 'strokeStyle' || k === 'globalCompositeOperation' || k === 'lineWidth' || Reflect.set(t, k, v),
  });
  return { ctx: proxy, layered: () => layered };
}

/** The edge of one shape, `line.width` canvas px wide, as a path stroked round it, or for one that can't be, traced. */
function outline(out: CanvasRenderingContext2D, s: Shape, k: number, ink: string, line: { width: number; alpha: number }): void {
  if (s.type === 'mask') return;
  out.save();
  out.setTransform(k, 0, 0, k, 0, 0);
  out.globalAlpha = line.alpha;
  out.fillStyle = out.strokeStyle = ink;
  const p = pen(out, line.width);
  if (s.type === 'holes') {
    const r = s.hole / 2;
    out.beginPath();
    for (let y = s.cy - s.hh + s.pitch / 2; y < s.cy + s.hh; y += s.pitch) {
      for (let x = s.cx - s.hw + s.pitch / 2; x < s.cx + s.hw; x += s.pitch) {
        if (s.square) out.rect(x - r, y - r, r * 2, r * 2);
        else (out.moveTo(x + r, y), out.arc(x, y, r, 0, Math.PI * 2));
      }
    }
    p.ctx.fill();
  } else {
    const { grow: _, ring: __, ...plain } = s as Solid & { grow?: number; ring?: number };
    fill(p.ctx, plain as Solid);
  }
  out.restore();
  if (p.layered()) edge(out, s, k, ink, line);
}

/**
 * The edge of one shape, `line.width` px wide, laid onto `out`: filled, then what's still filled that far in every direction taken
 * away. Any shape the renderer takes works, traced paths and text among them, since all it needs is to be filled. Only its own box
 * is worked on, so a small part on a big device costs what a small part does.
 */
function edge(out: CanvasRenderingContext2D, s: Shape, k: number, ink: string, line: { width: number; alpha: number }): void {
  const r = bounds(s, 2), L = Math.max(0, Math.floor(r.x * k)), T = Math.max(0, Math.floor(r.y * k));
  const W = Math.min(out.canvas.width, Math.ceil((r.x + r.w) * k)) - L, H = Math.min(out.canvas.height, Math.ceil((r.y + r.h) * k)) - T;
  if (W <= 0 || H <= 0) return;
  const sc = scratchFor(W, H), { x: a, y: b } = sc;
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.clearRect(0, 0, W + 2, H + 2);
  a.setTransform(k, 0, 0, k, -L, -T);
  a.fillStyle = '#000';
  if (!solid(a, s)) return;
  a.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'copy';
  b.drawImage(sc.a, 0, 0, W, H, 0, 0, W, H);
  b.globalCompositeOperation = 'destination-in';
  for (const [dx, dy] of steps.get(line.width) ?? steps.set(line.width, reach(line.width)).get(line.width)!) b.drawImage(sc.a, 0, 0, W, H, dx, dy, W, H);
  a.globalCompositeOperation = 'destination-out';
  a.drawImage(sc.b, 0, 0, W, H, 0, 0, W, H);
  a.globalCompositeOperation = 'source-in';
  a.fillStyle = ink;
  a.fillRect(0, 0, W, H);
  a.globalCompositeOperation = 'source-over';
  out.globalAlpha = line.alpha;
  out.drawImage(sc.a, 0, 0, W, H, L, T, W, H);
  out.globalAlpha = 1;
}

export interface SketchSpec {
  commands: readonly Command[];
  /** Where the device is on its canvas, and the canvas, css px. */
  x: number;
  y: number;
  cw: number;
  ch: number;
  dpr: number;
  /** Screen px to the css px it's shown at, so every line is the same on the screen however big the device is shown. */
  zoom: number;
  scheme: Scheme;
}

/** Draws a device's sketch onto a canvas of its own, sized and placed as the device's canvas is. */
export function drawSketch(canvas: HTMLCanvasElement, b: SketchSpec): void {
  const z = b.zoom || 1, k = Math.min(b.dpr * z, Math.sqrt(MOST / Math.max(b.cw * b.ch, 1)));
  canvas.width = Math.max(1, Math.round(b.cw * k));
  canvas.height = Math.max(1, Math.round(b.ch * k));
  Object.assign(canvas.style, { left: `${-b.x}px`, top: `${-b.y}px`, width: `${b.cw}px`, height: `${b.ch}px` });
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // A line px wide on the screen is that many of the canvas's.
  const px = (line: { width: number; alpha: number }) => ({ width: Math.max(1, Math.round(line.width * b.dpr)), alpha: line.alpha });
  // What's cut or printed with no ink of its own is a groove in what it's cut into: the last face drawn under it.
  let under: Vec3 = [0.2, 0.2, 0.2];
  for (const c of b.commands) {
    if (c.op === 'surface') {
      under = c.material.color;
      outline(ctx, c.shape, k, seam(under, b.scheme), px(c.body ? BODY : PART));
    } else if (c.op === 'cut' && (c.ink || c.depth)) {
      // Printed, it's its ink, as it is: not darkened. Light alone has no edge to draw.
      outline(ctx, c.shape, k, c.ink ? seam(c.ink, b.scheme, 1) : seam(under, b.scheme), px(CUT));
    } else if (c.op === 'screen') outline(ctx, c.shape, k, seam(c.color, b.scheme), px(PART));
    else if (c.op === 'glass' || c.op === 'frost') outline(ctx, c.shape, k, seam(c.tint, b.scheme), px(CUT));
  }
}
