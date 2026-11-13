// How far a layer of a body reaches sideways, row by row, for the faces beside it to show it side on. Worked out from the outline
// itself, not its field: a field's edge wanders by half a texel from row to row, and side on each row's wander is a step in depth.
import { clampTexture } from './gl.js';
import { flatten } from './flatten.js';
import type { Shape } from './shapes.js';

/** Each row's rightmost and leftmost point inside the outline, css px on its own plate, from row y0 every step. */
export interface Rows {
  tex: WebGLTexture;
  y0: number;
  step: number;
  n: number;
  /** The rows themselves, two to a row, for what takes them up as numbers. */
  data: Float32Array;
}

/** How far the outline falls short, row by row, of its furthest on each side: on the right, then the left. A row it doesn't reach is `NONE` on both. */
export interface Insets extends Rows {
  /** The most it falls short by on either side, css px. */
  most: number;
}

/** Rows to a css px. Fine enough that a ball rolled along them is smooth at any zoom a side is shown at. */
const PER_PX = 4;
/** How far a path's chords may stray from it, css px. */
const CHORD = 0.001;
/** Across, the raster finds the pixel, and the path the point in it. */
const ACROSS = 2;
const FINE = 12;
/** No row: nothing reaches from either side. */
const NONE = 1e9;

export class Sections {
  private readonly cache = new Map<string, Rows>();
  private readonly insets = new Map<Rows, Insets>();
  private readonly canvas = new OffscreenCanvas(1, 1);
  private readonly ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Null for outlines it can't follow: turned ones, and shapes with no outline to fill. */
  get(shape: Shape): Rows | null {
    if ((shape.type !== 'rect' && shape.type !== 'field') || shape.rotate || shape.grow || shape.ring) return null;
    if (shape.type === 'rect' && shape.ripple[0]) return null;
    const key = shape.type === 'field' ? `${shape.key}|${shape.hw}x${shape.hh}|${shape.cx},${shape.cy}` : `r|${shape.cx},${shape.cy},${shape.hw},${shape.hh},${shape.radius}`;
    let rows = this.cache.get(key);
    if (!rows) {
      rows = this.make(shape);
      this.cache.set(key, rows);
    }
    return rows;
  }

  /**
   * A face's own outline as what's beside it is set in by. Where the body's corners turn away, a part standing off a side turns with
   * them: seen edge on from this face, at each row it stands off the outline there, not off the outline's furthest.
   */
  inset(shape: Shape): Insets | null {
    const rows = this.get(shape);
    if (!rows) return null;
    let made = this.insets.get(rows);
    if (!made) {
      const { data, n } = rows, out = new Float32Array(n * 2);
      let right = -Infinity, left = Infinity, most = 0;
      for (let i = 0; i < n; i++) if (data[i * 2]! > -NONE) { right = Math.max(right, data[i * 2]!); left = Math.min(left, data[i * 2 + 1]!); }
      for (let i = 0; i < n; i++) {
        const r = data[i * 2]!, l = data[i * 2 + 1]!, none = r <= -NONE || r < l;
        out[i * 2] = none ? NONE : right - r;
        out[i * 2 + 1] = none ? NONE : l - left;
        if (!none) most = Math.max(most, out[i * 2]!, out[i * 2 + 1]!);
      }
      made = { ...this.upload(out, n), y0: rows.y0, step: rows.step, n, most };
      this.insets.set(rows, made);
    }
    return made;
  }

  private make(shape: Shape & { type: 'rect' | 'field' }): Rows {
    const { gl } = this;
    const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 8192);
    const h = shape.hh * 2, y0 = shape.cy - shape.hh, n = Math.min(Math.ceil(h * PER_PX) + 1, max), step = h / (n - 1);
    const out = shape.type === 'rect' ? this.rounded(shape, n, step) : (this.keyed(shape, n, step) ?? this.traced(shape, n, step));
    return { ...this.upload(out, n), y0, step, n };
  }

  private upload(data: Float32Array, n: number): { tex: WebGLTexture; data: Float32Array } {
    const { gl } = this, tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, n, 1, 0, gl.RG, gl.FLOAT, data);
    return { tex, data };
  }

  /**
   * Rows worked out from the outline as it is: a rounded rect's from its corners, a path's from its key, cut into chords that stray from it
   * by a thousandth of a css px. On each row the outline's outermost points are where it reaches, by either rule, as just inside each
   * it's been crossed once. A path with more to its key than `path` gives it, what a group did, has only its own drawing to go by. Found
   * on a canvas, a row was a raster and then its two edges halved down a point at a time, 24 asks of the path: a body side on as the
   * home page scrolled was 40 ms of one frame.
   */
  private rounded(shape: Shape & { type: 'rect' }, n: number, step: number): Float32Array {
    const out = new Float32Array(n * 2), x0 = shape.cx - shape.hw, w = shape.hw * 2, h = shape.hh * 2, r = Math.min(shape.radius, shape.hw, shape.hh);
    for (let i = 0; i < n; i++) {
      const y = i * step, dy = y < r ? r - y : y > h - r ? y - (h - r) : 0, inset = r - Math.sqrt(Math.max(0, r * r - dy * dy));
      out[i * 2] = x0 + w - inset;
      out[i * 2 + 1] = x0 + inset;
    }
    return out;
  }
  private keyed(shape: Shape & { type: 'field' }, n: number, step: number): Float32Array | null {
    const out = new Float32Array(n * 2), x0 = shape.cx - shape.hw;
    // A path as `path` keys it and draws it, at the size of what it was drawn for; any more to its key is what a group did to it.
    const parts = shape.key.split('|');
    if (parts[0] !== 'p' || parts.length !== 5) return null;
    const [vx, vy, vw, vh] = parts[2]!.split(',').map(Number) as [number, number, number, number], { hw, hh } = shape.source ?? shape;
    const kx = (hw * 2) / vw, ky = (hh * 2) / vh, lo = new Float64Array(n).fill(Infinity), hi = new Float64Array(n).fill(-Infinity);
    for (const poly of flatten(parts[1]!, CHORD / Math.max(kx, ky))) {
      const m = poly.length / 2;
      for (let k = 0; k < m; k++) {
        // Rows in css px of the box, from its top. A row meets a segment anywhere along it, ends and all, as only the outermost count:
        // so one that runs along an edge, as the last does along a flat bottom, has all of it.
        const ax = (poly[2 * k]! - vx) * kx, ay = (poly[2 * k + 1]! - vy) * ky, k1 = (k + 1) % m;
        const bx = (poly[2 * k1]! - vx) * kx, by = (poly[2 * k1 + 1]! - vy) * ky, top = Math.min(ay, by), bottom = Math.max(ay, by);
        for (let i = Math.max(0, Math.ceil(top / step)), e = Math.min(n - 1, Math.floor(bottom / step)); i <= e; i++) {
          const y = i * step, at = ay === by ? [ax, bx] : [ax + ((y - ay) * (bx - ax)) / (by - ay)];
          for (const x of at) {
            if (x < lo[i]!) lo[i] = x;
            if (x > hi[i]!) hi[i] = x;
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (hi[i]! < lo[i]!) { out[i * 2] = -NONE; out[i * 2 + 1] = NONE; continue; }
      out[i * 2] = x0 + hi[i]!;
      out[i * 2 + 1] = x0 + lo[i]!;
    }
    return out;
  }

  /** Rows found on a canvas, for an outline only its own drawing knows: each row's raster, and its two edges halved down on the path it filled. */
  private traced(shape: Shape & { type: 'field' }, n: number, step: number): Float32Array {
    const { canvas, ctx } = this;
    const w = shape.hw * 2, x0 = shape.cx - shape.hw, cols = Math.ceil(w * ACROSS) + 1;
    canvas.width = cols;
    canvas.height = n;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cols, n);
    ctx.fillStyle = '#fff';
    // A canvas pixel's centre is half a pixel in, so row i's centre is at y0 + i * step.
    const sx = (cols - 1) / w, sy = 1 / step;
    ctx.setTransform(sx, 0, 0, sy, 0.5, 0.5);
    // The path it fills is the one the rows are found on exactly, under the transform it was filled with.
    let path: Path2D | null = null, rule: CanvasFillRule | undefined, at: DOMMatrix | null = null;
    const fill = ctx.fill.bind(ctx);
    ctx.fill = ((p?: Path2D | CanvasFillRule, r?: CanvasFillRule) => {
      if (p instanceof Path2D) {
        path = p;
        rule = r;
        at = ctx.getTransform();
      }
      fill(p as Path2D, r);
    }) as typeof ctx.fill;
    ctx.save();
    const { hw, hh } = shape.source ?? shape;
    shape.draw(ctx as unknown as CanvasRenderingContext2D, hw * 2, hh * 2);
    ctx.restore();
    ctx.fill = fill;
    const px = ctx.getImageData(0, 0, cols, n).data;
    // Tested in canvas px, on the path as it was when it was filled.
    if (at) ctx.setTransform(at);
    const inside = (cx: number, row: number) => ctx.isPointInPath(path!, cx, row + 0.5, rule);
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      let r = -1, l = -1;
      for (let c = cols - 1; c >= 0; c--) if (px[(i * cols + c) * 4 + 3]! > 127) { r = c; break; }
      for (let c = 0; c < cols; c++) if (px[(i * cols + c) * 4 + 3]! > 127) { l = c; break; }
      if (r < 0) {
        out[i * 2] = -NONE;
        out[i * 2 + 1] = NONE;
        continue;
      }
      // The edge is within a pixel of the last one filled. Halved down on the path, it's exact.
      const edge = (inn: number, out: number) => {
        let a = inn + 0.5, b = out + 0.5;
        if (!path) return (a + b) / 2;
        if (!inside(a, i)) return a;
        for (let k = 0; k < FINE; k++) {
          const m = (a + b) / 2;
          if (inside(m, i)) a = m;
          else b = m;
        }
        return a;
      };
      out[i * 2] = x0 + (edge(r, r + 1) - 0.5) / sx;
      out[i * 2 + 1] = x0 + (edge(l, l - 1) - 0.5) / sx;
    }
    return out;
  }
}
