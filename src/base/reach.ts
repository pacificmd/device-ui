// What a hand can reach on a device: the part drawn on top, wherever that is, and not the box the page gave it.
import { bentBox, unbent } from './bend.js';
import { bounds, fill, type Solid } from './shapes.js';
import type { Device } from './engine.js';
import type { Part } from './types.js';

/** Size of a cell in the map of what a hand can reach, css px, at a zoom of 1 or more. */
export const REACH = 2;
/** The cell for something shown at `zoom`: as fine as a pointer aims on the screen, in steps of two, so a zoom that hardly moves keeps its map. */
export const reachCell = (zoom: number) => REACH * 2 ** Math.max(Math.round(-Math.log2(zoom)), 0);

// Which part a colour on the map of what's on top belongs to. The check keeps the blends along an edge from reading as a third part.
const paintCode = (n: number) => `rgb(${n & 255} ${(n >> 8) & 255} ${(n * 89) & 255})`;
const readCode = (r: number, g: number, b: number) => {
  const n = r | (g << 8);
  return ((n * 89) & 255) === b ? n : 0;
};

// The cells of a map as a clip path, in px from a corner. A row the same as the last only stretches it.
function cellPath(cells: Uint8Array, w: number, h: number, ox: number, oy: number, cell: number): string {
  let d = '';
  const row = (y: number) => {
    const runs: number[] = [];
    for (let x = 0; x < w; x++) if (cells[y * w + x]) {
      const from = x;
      while (x < w && cells[y * w + x]) x++;
      runs.push(from, x);
    }
    return runs;
  };
  for (let y = 0; y < h;) {
    const runs = row(y), key = runs.join();
    let end = y + 1;
    while (end < h && row(end).join() === key) end++;
    for (let i = 0; i < runs.length; i += 2) d += `M${runs[i]! * cell + ox} ${y * cell + oy}h${(runs[i + 1]! - runs[i]!) * cell}v${(end - y) * cell}h${(runs[i]! - runs[i + 1]!) * cell}z`;
    y = end;
  }
  // Empty isn't a path at all, and would leave it unclipped.
  return d || 'M0 0z';
}

/**
 * A box is what the page laid out, and a part is what it drew. So what's drawn and on top goes to the
 * part it belongs to, wherever that falls, along with whatever of its box isn't under something else.
 * All this does to the page is clip the parts that need it and reach out for what's outside their box.
 */
export function reachFor(d: Device, canvas: HTMLCanvasElement): void {
  d.reachDirty = false;
  for (const p of d.list) p.shifted = false;
  const cell = d.reachCell;
  const holders = new Set<Element>();
  for (const p of d.list) for (let n = p.el.parentElement; n && n !== d.el; n = n.parentElement) holders.add(n);
  const w = Math.ceil(d.cw / cell), h = Math.ceil(d.ch / cell);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(1 / cell, 1 / cell);
  const hands = new Map<number, Part>();
  d.list.forEach((p, i) => {
    const cs = getComputedStyle(p.el), order = i + 1;
    p.hit = p.el !== d.el && !holders.has(p.el) && cs.pointerEvents !== 'none' && cs.transform === 'none' && p.w > 0;
    let drew = false;
    ctx.fillStyle = paintCode(order);
    for (const c of p.commands ?? []) {
      // A recess covers nothing.
      if (c.op === 'glass' ? !c.covers : c.op !== 'surface' || c.zTop < c.zEdge || c.shape.type === 'mask' || c.shape.type === 'holes' || c.shape.ring) continue;
      // A bent shape isn't where its flat one is. Bending only draws it back towards where the bend starts, so it's
      // what of the flat shape lies in the box it covers once rolled, as a crown's barrel. A rigid bend moves nothing.
      const bent = c.bend && !unbent(bounds(c.shape, 0), c.bend) ? bentBox(bounds(c.shape, 0), c.bend) : null;
      // Only a hand needs to find its own. The map stacks parts in order and not by height, so a rolled bed nobody
      // works, as a watch's cushion, would cover what stands on it.
      if (bent && !p.hit) continue;
      const { grow: _, ...solid } = c.shape as Solid;
      if (bent) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bent.x, bent.y, bent.w, bent.h);
        ctx.clip();
      }
      fill(ctx, solid as Solid);
      if (bent) ctx.restore();
      drew = true;
    }
    if (p.hit && drew) hands.set(order, p);
    else if (p.el.hasAttribute('d-reach') || p.el.style.clipPath) release(p);
  });
  const { data } = ctx.getImageData(0, 0, w, h), top = new Uint16Array(w * h);
  // How far each part's cells run, in one pass: a pass per part is a pass over a million cells per key on a big panel.
  const ends = new Int32Array((d.list.length + 1) * 4).fill(-1);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    if (data[i * 4 + 3] !== 255) continue;
    const on = readCode(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
    // Where two edges blend, a colour can read as a part that isn't there.
    if (!on || on > d.list.length) continue;
    top[i] = on;
    const e = on * 4;
    if (ends[e]! < 0) {
      ends[e] = ends[e + 2] = x;
      ends[e + 1] = ends[e + 3] = y;
    } else {
      ends[e] = Math.min(ends[e]!, x);
      ends[e + 1] = Math.min(ends[e + 1]!, y);
      ends[e + 2] = Math.max(ends[e + 2]!, x);
      ends[e + 3] = Math.max(ends[e + 3]!, y);
    }
  }
  for (const [order, p] of hands) {
    const x0 = Math.floor(p.x / cell), y0 = Math.floor(p.y / cell), x1 = Math.ceil((p.x + p.w) / cell), y1 = Math.ceil((p.y + p.h) / cell);
    let l = x0, t = y0, r = x1, b = y1, whole = true;
    if (ends[order * 4]! >= 0) {
      l = Math.min(l, ends[order * 4]!);
      t = Math.min(t, ends[order * 4 + 1]!);
      r = Math.max(r, ends[order * 4 + 2]! + 1);
      b = Math.max(b, ends[order * 4 + 3]! + 1);
    }
    const cw = r - l, ch = r > l ? b - t : 0, cells = new Uint8Array(cw * ch);
    const set = (x: number, y: number) => (cells[(y - t) * cw + (x - l)] = 1);
    for (let y = t; y < b; y++) for (let x = l; x < r; x++) {
      const on = top[y * w + x]!, boxed = x >= x0 && x < x1 && y >= y0 && y < y1;
      // What a part holds is its own to give up, as a guard does by going inert: its cover needn't have finished swinging.
      if (on === order || (boxed && (!on || (on < order && !hands.has(on)) || d.list[on - 1]!.el.contains(p.el)))) set(x, y);
      else if (boxed) whole = false;
    }
    const out = l < x0 || t < y0 || r > x1 || b > y1;
    if (whole && !out) {
      release(p);
      continue;
    }
    if (getComputedStyle(p.el).position === 'static') p.el.style.position = 'relative';
    const ox = l * cell - p.x, oy = t * cell - p.y;
    p.el.style.clipPath = `path("${cellPath(cells, cw, ch, +ox.toFixed(2), +oy.toFixed(2), cell)}")`;
    if (out) {
      p.el.setAttribute('d-reach', '');
      p.el.style.setProperty('--reach-x', `${ox}px`);
      p.el.style.setProperty('--reach-y', `${oy}px`);
      p.el.style.setProperty('--reach-w', `${cw * cell}px`);
      p.el.style.setProperty('--reach-h', `${ch * cell}px`);
    } else p.el.removeAttribute('d-reach');
  }
  // These are the engine's own writes. Anything else would have been heard before this frame.
  d.observer.takeRecords();
}

function release(p: Part): void {
  p.el.style.clipPath = '';
  p.el.removeAttribute('d-reach');
}
