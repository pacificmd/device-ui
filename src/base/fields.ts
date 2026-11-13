import { clampTexture, createProgram, type Program } from './gl.js';
import { BOX_VS, FIELD_VS, FLOOD_FS, RESOLVE_FS, SEED_FS, SMOOTH_FS, WITHIN_FS } from './shaders/field.js';
import type { FieldShape } from './shapes.js';
import { FIELD_TIER, type Store } from './store.js';

const MAX_SIZE = 1024;

interface Entry {
  tex: WebGLTexture;
  w: number;
  h: number;
}

/** Working textures for one size class. Bigger than a field, so only the corner it fits in is used. */
interface Scratch {
  a: WebGLTexture;
  b: WebGLTexture;
  raw: WebGLTexture;
}

// One drawing at two spreads is two textures, because each is sampled by its own margin. Two sharpnesses that come out the same size are one.
const drawing = (shape: FieldShape) => `${shape.key}|${shape.spread}`;
const fieldKey = (shape: FieldShape, dpr: number) => {
  const { w, h } = sized(shape, dpr);
  return `${drawing(shape)}|${w}x${h}`;
};

/** A field is made at the next whole power of two up from the sharpness it's drawn at, so a zoom finds the one it made last until it
 * has gone twice as far, and never one softer than it needs. */
function sized(shape: FieldShape, dpr: number) {
  const { hw, hh } = shape.source ?? shape;
  const cssW = (hw + shape.spread) * 2, cssH = (hh + shape.spread) * 2;
  const scale = Math.min(2 ** Math.ceil(Math.log2(dpr) - 1e-6), MAX_SIZE / Math.max(cssW, cssH));
  return { cssW, cssH, w: Math.max(2, Math.round(cssW * scale)), h: Math.max(2, Math.round(cssH * scale)) };
}

/** Distance fields, computed once per drawing and kept. Rotating or moving one costs nothing. */
export class FieldCache {
  private entries = new Map<string, Entry>();
  /** Every size held of each drawing. A field holds distances in css px over its box, so one of another size draws the same shape, as
   * soft as it is: one made at the last level stands in while the next is made. */
  private sizes = new Map<string, Map<string, Entry>>();
  private seed: Program;
  private flood: Program;
  private resolve: Program;
  private smooth: Program;
  private within: Program;
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private fbo: WebGLFramebuffer;
  /** Allocating these was most of what scrolling cost, as a device makes its fields in a run, so they stay until the store wants the room. */
  private scratch = new Map<number, Scratch>();
  generated = 0;
  /** Where each box of a batch is, and how many rows of them it has room for. */
  private table: WebGLTexture | null = null;
  private rows = 0;

  /** Fields are kept in the GPU's store with everything else: a big panel can use hundreds, and one it can't keep is drawn again on every repaint. */
  constructor(private gl: WebGL2RenderingContext, private store: Store) {
    this.seed = createProgram(gl, BOX_VS, SEED_FS);
    this.flood = createProgram(gl, BOX_VS, FLOOD_FS);
    this.resolve = createProgram(gl, BOX_VS, RESOLVE_FS);
    this.smooth = createProgram(gl, FIELD_VS, SMOOTH_FS);
    this.within = createProgram(gl, FIELD_VS, WITHIN_FS);
    this.fbo = gl.createFramebuffer()!;
  }

  /** Its field at this sharpness, or the nearest held while that's made: the next finer, as sharp as it needs, else the finest coarser.
   * Made now only when there's none of it at all. */
  get(shape: FieldShape, dpr: number): WebGLTexture {
    const key = this.near(shape, dpr) ?? (this.make([shape], dpr), fieldKey(shape, dpr));
    this.used(key);
    return this.entries.get(key)!.tex;
  }

  private near(shape: FieldShape, dpr: number): string | null {
    const key = fieldKey(shape, dpr);
    if (this.entries.has(key)) return key;
    const { w } = sized(shape, dpr);
    let finer: [string, Entry] | null = null, coarser: [string, Entry] | null = null;
    for (const [k, e] of this.sizes.get(drawing(shape)) ?? []) {
      if (e.w > w) {
        if (!finer || e.w < finer[1].w) finer = [k, e];
      } else if (!coarser || e.w > coarser[1].w) coarser = [k, e];
    }
    return (finer ?? coarser)?.[0] ?? null;
  }

  /** The fields here that aren't made yet, each once. One held up to twice as fine is as good: a zoom out keeps what it had. */
  missing(shapes: FieldShape[], dpr: number): FieldShape[] {
    return [...new Map(shapes.map(s => [fieldKey(s, dpr), s])).entries()].filter(([key, s]) => !this.entries.has(key) && !this.fine(s, dpr)).map(([, s]) => s);
  }

  private fine(shape: FieldShape, dpr: number): boolean {
    const { w } = sized(shape, dpr);
    for (const e of this.sizes.get(drawing(shape))?.values() ?? []) if (e.w > w && e.w <= w * 2 + 1) return true;
    return false;
  }

  /** Whether something of this drawing is held to stand in for its field. */
  held(shape: FieldShape): boolean {
    return !!this.sizes.get(drawing(shape))?.size;
  }

  /** What a field costs the GPU in pixels drawn: the flood goes over every one of them, once a step. */
  cost(shape: FieldShape, dpr: number): number {
    const { w, h } = sized(shape, dpr);
    return w * h * (Math.ceil(Math.log2(Math.max(w, h))) + 3);
  }

  /** Used this frame, so it stays, and when it's not used again, the longest unused goes first. */
  private used(key: string): void {
    this.store.judge(`f|${key}`, FIELD_TIER, -performance.now(), true);
  }

  /** Every field stays this frame, as what's drawing in a run will want them again. */
  use(): void {
    for (const key of this.entries.keys()) this.used(key);
    for (const key of this.scratch.keys()) this.store.judge(`w|${key}`, FIELD_TIER, -performance.now(), true);
  }

  private forget(key: string): void {
    const e = this.entries.get(key);
    this.store.drop(`f|${key}`);
    if (!e) return;
    this.gl.deleteTexture(e.tex);
    this.entries.delete(key);
    const name = key.slice(0, key.lastIndexOf('|')), all = this.sizes.get(name);
    all?.delete(key);
    if (all && !all.size) this.sizes.delete(name);
  }

  /** Gives back what floods work in. The fields stay; making more makes it again. */
  release(): void {
    for (const key of [...this.scratch.keys()]) {
      const s = this.scratch.get(key)!;
      for (const t of [s.a, s.b, s.raw]) this.gl.deleteTexture(t);
      this.scratch.delete(key);
      this.store.drop(`w|${key}`);
    }
  }

  /** Gives back every field too, with what floods work in: nothing is painting, and whatever paints next makes the ones it draws. */
  clear(): void {
    for (const key of [...this.entries.keys()]) this.forget(key);
    this.release();
  }

  private working(w: number, h: number): Scratch {
    const { gl } = this, cw = 2 ** Math.ceil(Math.log2(w)), ch = 2 ** Math.ceil(Math.log2(h)), key = cw * 4096 + ch;
    this.store.judge(`w|${key}`, FIELD_TIER, -performance.now(), true);
    const made = this.scratch.get(key);
    if (made) return made;
    // Of another size, what the last batch worked in goes first, so two are never held at once.
    this.release();
    this.store.room(cw * ch * 18);
    this.store.hold(`w|${key}`, 'field', () => cw * ch * 18, () => {
      const s = this.scratch.get(key);
      this.store.drop(`w|${key}`);
      if (!s) return;
      for (const t of [s.a, s.b, s.raw]) gl.deleteTexture(t);
      this.scratch.delete(key);
    });
    const make = (format: number, filter: number) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, cw, ch);
      clampTexture(gl, filter, filter);
      return t;
    };
    // Half floats hold a pixel's centre exactly up to MAX_SIZE, and the flood goes through these many times over.
    const out = { a: make(gl.RGBA16F, gl.NEAREST), b: make(gl.RGBA16F, gl.NEAREST), raw: make(gl.R16F, gl.LINEAR) };
    this.scratch.set(key, out);
    return out;
  }

  /** Makes these fields, those not made yet. A field alone cost its own upload and a dozen passes, each to a target of its own,
   * and a panel has a hundred: so they're made together, on one atlas, with one upload and one flood over all of them, and each
   * copied out to its own texture at the end. */
  make(shapes: FieldShape[], dpr: number): void {
    const fresh = [...new Map(shapes.map(s => [fieldKey(s, dpr), s])).entries()].filter(([key]) => !this.entries.has(key));
    // What's worked out needs no flood, and no flood could give it: it isn't a distance from anything.
    for (const [key, s] of fresh) if (s.solve) this.keep(key, s, this.solved(s, dpr));
    const todo = fresh.filter(([, s]) => !s.solve);
    if (!todo.length) return;
    // One cut off at another outline needs that outline's field too, made with the rest.
    const all = todo.flatMap(([, s]) => s.within ? [s, { ...s, draw: s.within.draw, within: undefined }] : [s]);
    const made = this.atlas(all, dpr);
    let i = 0;
    for (const [key, s] of todo) {
      const field = made[i++]!;
      this.keep(key, s, s.within ? this.cut(field, made[i++]!, s.within.steep) : field);
    }
  }

  private keep(key: string, s: FieldShape, entry: Entry): void {
    this.entries.set(key, entry);
    const name = drawing(s);
    if (!this.sizes.has(name)) this.sizes.set(name, new Map());
    this.sizes.get(name)!.set(key, entry);
    this.store.hold(`f|${key}`, 'field', () => entry.w * entry.h * 2, () => this.forget(key));
    this.used(key);
  }

  /** A field worked out at each of its texels, in the same form as a flooded one. */
  private solved(shape: FieldShape, dpr: number): Entry {
    const { gl } = this, { cssW, cssH, w, h } = sized(shape, dpr), data = new Float32Array(w * h), kx = cssW / w, ky = cssH / h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = shape.solve!((i + 0.5) * kx - shape.spread, (j + 0.5) * ky - shape.spread);
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, w, h);
    clampTexture(gl, gl.LINEAR, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED, gl.FLOAT, data);
    this.generated += 1;
    return { tex, w, h };
  }

  /** Lays fields out in rows on atlases of MAX_SIZE square, tallest first, and makes each atlas's fields. Gives them back in order. */
  private atlas(shapes: FieldShape[], dpr: number): Entry[] {
    const sizes = shapes.map(s => sized(s, dpr)), order = sizes.map((_, i) => i).sort((i, j) => sizes[j]!.h - sizes[i]!.h);
    const at: { x: number; y: number }[] = [], out: Entry[] = [];
    let batch: number[] = [], x = 0, y = 0, row = 0;
    const flush = () => {
      if (batch.length) this.together(batch.map(i => ({ shape: shapes[i]!, ...sizes[i]!, ...at[i]! })), y + row).forEach((e, k) => (out[batch[k]!] = e));
      batch = [];
      x = y = row = 0;
    };
    for (const i of order) {
      const { w, h } = sizes[i]!;
      if (x + w > MAX_SIZE) {
        x = 0;
        y += row;
        row = 0;
      }
      if (y + h > MAX_SIZE) flush();
      at[i] = { x, y };
      batch.push(i);
      x += w;
      row = Math.max(row, h);
    }
    flush();
    return out;
  }

  private together(boxes: { shape: FieldShape; cssW: number; cssH: number; w: number; h: number; x: number; y: number }[], tall: number): Entry[] {
    const { gl, canvas, ctx } = this, wide = Math.max(...boxes.map(b => b.x + b.w));

    // It only grows, and each atlas is drawn in its corner: a canvas given a new size is a new image on the GPU, and a page of 30
    // made 780 of them as it loaded.
    if (canvas.width < wide) canvas.width = wide;
    if (canvas.height < tall) canvas.height = tall;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, wide, tall);
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    // Each is drawn inside its own box, as it was on a canvas of its own size.
    for (const { shape, cssW, cssH, w, h, x, y } of boxes) {
      const { hw, hh } = shape.source ?? shape;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.setTransform(w / cssW, 0, 0, h / cssH, x + (w / cssW) * shape.spread, y + (h / cssH) * shape.spread);
      shape.draw(ctx, hw * 2, hh * 2);
      ctx.restore();
    }

    const mask = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mask);
    clampTexture(gl, gl.NEAREST, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, wide, tall, 0, gl.RED, gl.UNSIGNED_BYTE, canvas);

    // Where each box is, read by the instance that draws it.
    const n = boxes.length, rows = Math.ceil((n * 2) / 1024), data = new Float32Array(1024 * rows * 4);
    boxes.forEach(({ x, y, w, h, cssW }, i) => {
      data.set([x, y, w, h, w / cssW], i * 8);
    });
    // It's kept, and only grows: making a texture for each batch cost a field alone a third more.
    gl.activeTexture(gl.TEXTURE2);
    if (this.rows < rows) {
      gl.deleteTexture(this.table);
      this.table = gl.createTexture()!;
      this.rows = rows;
      gl.bindTexture(gl.TEXTURE_2D, this.table);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 1024, rows);
      clampTexture(gl, gl.NEAREST, gl.NEAREST);
    } else gl.bindTexture(gl.TEXTURE_2D, this.table);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, rows > 1 ? 1024 : n * 2, rows, gl.RGBA, gl.FLOAT, data);
    gl.activeTexture(gl.TEXTURE0);

    const work = this.working(wide, tall), { raw } = work;
    let { a, b } = work;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);

    const into = (t: WebGLTexture) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    // The working textures are bigger than the atlas, and a box is drawn where it sits on them.
    const size = 2 ** Math.ceil(Math.log2(wide)), high = 2 ** Math.ceil(Math.log2(tall));
    gl.viewport(0, 0, size, high);
    const use = (p: Program) => {
      gl.useProgram(p.program);
      gl.uniform1i(p.u.uBoxes!, 2);
      gl.uniform2f(p.u.uAtlas!, size, high);
    };
    const draw = () => gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);

    use(this.seed);
    gl.uniform1i(this.seed.u.uMask!, 0);
    gl.bindTexture(gl.TEXTURE_2D, mask);
    into(a);
    draw();

    use(this.flood);
    gl.uniform1i(this.flood.u.uSeeds!, 0);
    gl.uniform1i(this.flood.u.uMask!, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mask);
    gl.activeTexture(gl.TEXTURE0);
    // A step bigger than a box only looks past its edge, so the biggest box sets them all, and a small one comes out as alone.
    let step = 1 << Math.ceil(Math.log2(Math.max(...boxes.map(b => Math.max(b.w, b.h)))));
    while (step >= 1) {
      step >>= 1;
      gl.uniform1i(this.flood.u.uStep!, Math.max(step, 1));
      gl.bindTexture(gl.TEXTURE_2D, a);
      into(b);
      draw();
      [a, b] = [b, a];
      if (step === 0) break;
    }

    use(this.resolve);
    gl.uniform1i(this.resolve.u.uSeeds!, 0);
    gl.uniform1i(this.resolve.u.uMask!, 1);
    gl.bindTexture(gl.TEXTURE_2D, a);
    into(raw);
    draw();

    gl.useProgram(this.smooth.program);
    gl.uniform1i(this.smooth.u.uField!, 0);
    gl.bindTexture(gl.TEXTURE_2D, raw);
    const out = boxes.map(({ w, h, x, y, cssW }) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, w, h);
      clampTexture(gl, gl.LINEAR, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, raw);
      gl.uniform1f(this.smooth.u.uScale!, w / cssW);
      gl.uniform2i(this.smooth.u.uSize!, w, h);
      gl.uniform2i(this.smooth.u.uAt!, x, y);
      gl.viewport(0, 0, w, h);
      into(tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return { tex, w, h };
    });

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(mask);
    this.generated += n;
    return out;
  }

  /** A field cut off at another outline drawn on the same box. Both go, and what's left replaces them. */
  private cut(field: Entry, edge: Entry, steep: number): Entry {
    const { gl } = this, { w, h } = field, tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, w, h);
    clampTexture(gl, gl.LINEAR, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, w, h);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.useProgram(this.within.program);
    gl.uniform1i(this.within.u.uField, 0);
    gl.uniform1i(this.within.u.uEdge, 1);
    gl.uniform1f(this.within.u.uSteep, steep);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, edge.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, field.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(field.tex);
    gl.deleteTexture(edge.tex);
    return { tex, w, h };
  }

  /** Reads a field back, for tests. Returns css px distances, with y running down. */
  read(shape: FieldShape, dpr: number): { w: number; h: number; data: Float32Array } {
    const { gl } = this;
    this.make([shape], dpr);
    const e = this.entries.get(fieldKey(shape, dpr))!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, e.tex, 0);
    const rgba = new Float32Array(e.w * e.h * 4);
    gl.readPixels(0, 0, e.w, e.h, gl.RGBA, gl.FLOAT, rgba);
    const data = rgba.filter((_, i) => i % 4 === 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { w: e.w, h: e.h, data };
  }
}
