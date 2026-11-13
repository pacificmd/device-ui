// A device whose glass broke in a fall: where each sheet of it cracked, as a map the light reads, and what that did to each screen's
// picture, as a map the screen reads. Both are worked out here from the commands, once, and kept while they draw the same.
//
// One blow, on the body's rim, breaks everything: every cover of glass or clear plastic, each its own way (see fracture.ts), from the
// same place, so the cracks of one layer line up with the next. A screen's own glass cell breaks only under a hard blow, and then what
// it holds leaks out, between the cracks, near where it was struck.
import { random, shatter, struck, type Area, type Crack } from './fracture.js';
import type { Point } from './shapes.js';
import { extent } from './commands.js';
import type { ScreenCommand, ScreenKind } from './sheet.js';
import type { Box, Breaks } from './types.js';

/** Css px a mm. */
const MM = 4;
/** The most a crack map is across, px. */
const MOST = 2048;
/** The most a screen's damage map is across, px. */
const MOST_DAMAGE = 512;
/** The steepest a shard tilts, as the map holds it: ±this over 127. */
export const TILT_RANGE = 0.06;

/** A sheet that breaks: where it is on the canvas, css px, and whether it's brittle glass, which shatters, or a moulded plastic, which splits. */
export interface Cover extends Area {
  breaks: Breaks;
  /** How thick, mm. */
  thick: number;
  /** Where something drawn after it lies over it, canvas css px: its cracks run on under that, but don't show. */
  hidden?: (x: number, y: number) => boolean;
}

/** A screen to break: where it is on the canvas, css px, and what kind. */
export interface Panel extends Area {
  kind: ScreenKind;
  hidden?: (x: number, y: number) => boolean;
}

/** What a map holds: RGBA bytes, rows from the top. */
export interface Bytes {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface Broken {
  /** Over the whole canvas: r and g the tilt of the shard here, as 128 ± 127 × its slope over TILT_RANGE, in bytes; b how much of the pixel is crack; a which way the crack runs, as its angle over pi. */
  cracks: Bytes;
  /** Over the whole canvas: r how much of the pixel is the face of a crack, leaning through a thick sheet, g how wide the crack is open
   * there, for the colours a thin gap of air shows. */
  faces: Bytes;
  /** One a screen that broke, over its glass from its top left: r how much has leaked, g how far its row is pulled sideways, 128 ± 127 × that
   * over a quarter of the glass's width, in bytes; b a dead or dark line, a a pale bruise in the backlight. */
  panels: (Bytes | null)[];
}

/** Which screen a damage map is for, by where it is and what kind: the same screen drawn again is the same one. */
export function panelKey(c: ScreenCommand): string {
  const b = extent(c);
  return `${b.x},${b.y},${b.w},${b.h},${c.kind}`;
}

/** How thick a screen's own glass is, mm: a tube's face, two sheets of a liquid crystal cell, an OLED's (guesses). */
const CELL: Record<ScreenKind, number> = { crt: 10, lcd: 1.1, tft: 1.1, oled: 0.6, eink: 1, led: 0, coat: 0 };

/** A slow noise, the same everywhere for the same seed. */
function noise(seed: number): (x: number, y: number) => number {
  const h = (i: number, j: number) => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const one = (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };
  return (x, y) => one(x, y) * 0.5 + one(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + one(x * 4.3 + 31, y * 4.3 + 11) * 0.2;
}

/** Cellular noise: how far a point is from the edge between the two nearest of a scatter of points `size` apart, over `size`, 0 on an edge. */
function cells(seed: number, size: number): (x: number, y: number) => number {
  const h = (i: number, j: number, s: number) => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul((seed | 0) + s, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y) => {
    const fx = x / size, fy = y / size, i0 = Math.floor(fx), j0 = Math.floor(fy);
    let a = Infinity, b = Infinity;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const d = Math.hypot(i + h(i, j, 1) - fx, j + h(i, j, 2) - fy);
      if (d < a) { b = a; a = d; } else if (d < b) b = d;
    }
    return b - a;
  };
}

/** The maps a device's cracks are laid into, over the whole canvas or one screen's glass. */
interface Laid {
  w: number;
  h: number;
  /** How much of each pixel is crack, and which way it runs there. */
  cover: Float32Array;
  angle: Float32Array;
  /** What splits the sheet into pieces: every crack that goes through, seen or not. */
  wall: Float32Array;
  /** How much of each pixel is a crack's face, seen leaning through the sheet, and how wide the crack's gap is there, 0 to 1. */
  face?: Float32Array;
  gap?: Float32Array;
}

/**
 * Lays cracks into the maps, each as wide as it opens there, thinner than a pixel as a share of one, and beside it on the side it leans
 * to, its face, as wide as the sheet's thickness times its lean. Each pixel keeps the most of any crack, and the way that one runs. `k`
 * is map px to one of the cracks' units, `o` where their origin is on the map, and `thick` the sheet's thickness in map px. Where
 * `hidden` says something lies over it, a crack still splits the sheet but doesn't show.
 */
function lay(cracks: Crack[], m: Laid, k: number, ox: number, oy: number, seed: number, thick: number, hidden?: (x: number, y: number) => boolean): void {
  const { w, h, cover, angle, wall, face, gap } = m, wobble = noise(seed), slow = noise(seed + 77);
  for (const c of cracks) {
    let run = 0;
    const total = c.pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - c.pts[i - 1]![0], p[1] - c.pts[i - 1]![1]) : 0), 0);
    for (let i = 1; i < c.pts.length; i++) {
      const [ax, ay] = c.pts[i - 1]!, [bx, by] = c.pts[i]!, len = Math.hypot(bx - ax, by - ay);
      if (len <= 0) continue;
      // Open at its start, and along it by how it wanders. One that ran out closes to nothing at its end.
      const along = (run + len / 2) / Math.max(total, 1e-6), close = c.stopped ? 1 : Math.min(1, (1 - along) * 4);
      const width = c.open * close * (0.55 + 0.9 * wobble(run / MM * 0.7, i * 0.01)) * k;
      // Its face: how far over it leans goes a little up and down along it, as a broken face twists.
      const band = face && !c.shallow ? Math.min(Math.abs(c.lean) * (0.85 + 0.3 * wobble(run / MM * 0.15 + 9, i * 0.01)), 3) * thick * close : 0;
      const side = Math.sign(c.lean) || 1, airy = slow(run / MM * 0.25, i * 0.003);
      run += len;
      const x0 = ax * k + ox, y0 = ay * k + oy, x1 = bx * k + ox, y1 = by * k + oy, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
      const reach = Math.max(width / 2 + 1.2, band > 0.3 ? band + 1 : 0), a = (Math.atan2(dy, dx) + Math.PI) % Math.PI;
      const share = Math.min(width, 1);
      for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - reach)); y <= Math.min(h - 1, Math.ceil(Math.max(y0, y1) + reach)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - reach)); x <= Math.min(w - 1, Math.ceil(Math.max(x0, x1) + reach)); x++) {
          const px = x + 0.5 - x0, py = y + 0.5 - y0, t = Math.min(1, Math.max(0, (px * dx + py * dy) / l2));
          const d = Math.hypot(px - t * dx, py - t * dy), v = share * Math.min(1, Math.max(0, 1 - Math.max(d - width / 2, 0) / 0.8));
          const n = y * w + x;
          if (!c.shallow && v > wall[n]!) wall[n] = v;
          if (hidden?.((x + 0.5 - ox) / k, (y + 0.5 - oy) / k)) continue;
          if (v > cover[n]!) {
            cover[n] = v;
            angle[n] = a;
          }
          // A face belongs to the stretch it's beside, not past its ends: there the next stretch takes over.
          const t0 = (px * dx + py * dy) / l2;
          if (band > 0.3 && t0 >= 0 && t0 < 1) {
            // Across on its side, out to as far as it leans, softening over the last of it.
            const across = ((dx * py - dy * px) / l) * side, f = across < 0 ? 0 : Math.min(1, Math.max(0, (band - across) / Math.max(band * 0.35, 0.8)));
            if (f > face![n]!) {
              face![n] = f;
              gap![n] = airy;
              if (cover[n]! < 0.02) angle[n] = a;
            }
          }
        }
      }
    }
  }
}

/** Each piece the cracks leave inside a box of the map, numbered from 1; 0 on a crack. Pieces are only ever inside the box. */
function pieces(cover: Float32Array, w: number, box: { x0: number; y0: number; x1: number; y1: number }, wall: number, out: Int32Array): number {
  let count = 0;
  const stack: number[] = [];
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const n = y * w + x;
      if (out[n] || cover[n]! >= wall) continue;
      out[n] = ++count;
      stack.push(n);
      while (stack.length) {
        const m = stack.pop()!, mx = m % w, my = (m - mx) / w;
        for (const [qx, qy] of [[mx - 1, my], [mx + 1, my], [mx, my - 1], [mx, my + 1]] as const) {
          if (qx < box.x0 || qx >= box.x1 || qy < box.y0 || qy >= box.y1) continue;
          const q = qy * w + qx;
          if (out[q] || cover[q]! >= wall) continue;
          out[q] = count;
          stack.push(q);
        }
      }
    }
  }
  return count;
}

/** A screen's own glass that broke: its cracks, and where the blow came nearest it. */
interface Cell {
  cracks: Crack[];
  near: Point;
}

/**
 * Breaks a device. `body` is its outline's box and `canvas` its canvas, css px; `px` map px a css px, as fine as the cracks are drawn.
 * `hard` is how badly, 0 to 1, and the seed says how.
 */
export function breakDevice(body: Box, canvas: { w: number; h: number }, px: number, covers: Cover[], panels: Panel[], hard: number, seed: number): Broken {
  const rand = random(seed + 0.5), at = struck(body, rand);
  const k = Math.min(px, MOST / Math.max(canvas.w, canvas.h)), w = Math.max(1, Math.round(canvas.w * k)), h = Math.max(1, Math.round(canvas.h * k));
  const n2 = w * h, cover = new Float32Array(n2), angle = new Float32Array(n2), owner = new Int32Array(n2), wall = new Float32Array(n2);
  const face = new Float32Array(n2), gap = new Float32Array(n2), m: Laid = { w, h, cover, angle, wall, face, gap };
  const data = new Uint8Array(n2 * 4);
  // The blow travels through the body to each sheet, and what gets there fades with how far it went. A sheet breaks from the point of
  // it nearest the blow: on its rim, or where it was struck if that's on it.
  const reach = Math.hypot(body.w, body.h), toward = (a: Area): { near: Point; hard: number } => {
    const near: Point = [Math.min(Math.max(at[0], a.x), a.x + a.w), Math.min(Math.max(at[1], a.y), a.y + a.h)];
    return { near, hard: hard * (1 - 0.55 * Math.min(1, Math.hypot(near[0] - at[0], near[1] - at[1]) / (reach * 0.6))) };
  };
  covers.forEach((c, i) => {
    const t = toward(c), b = shatter(c, { breaks: c.breaks, thick: c.thick, hard: t.hard, seed: seed * 7 + i * 13 + 1, mm: MM, at: t.near });
    lay(b.cracks, m, k, 0, 0, seed + i, c.thick * MM * k, (x, y) => !(c.inside?.(x, y) ?? true) || !!c.hidden?.(x, y));
  });
  // A screen is glass of its own, under whatever covers it: a tube's face, a cell of liquid crystal between two sheets, an OLED's.
  // Bare, the blow lands on it and it breaks with the rest. Under a cover, only a hard one gets through. An LED's lamps sit behind a
  // window and have no glass of their own, and a coat is a window already.
  const sheets: Cover[] = [...covers];
  const cells = panels.map((p, i): Cell | null => {
    if (p.kind === 'led' || p.kind === 'coat') return null;
    const r = random(seed * 11 + i * 5 + 3), mx = p.x + p.w / 2, my = p.y + p.h / 2;
    const covered = covers.some(c => mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h);
    const { near, hard: got } = toward(p);
    // A tube's face is the glass over it: if that broke, it's broken already.
    if (covered && (p.kind === 'crt' || got < 0.3 + r() * 0.3)) return null;
    const thick = CELL[p.kind], b = shatter(p, { breaks: 'glass', thick, hard: covered ? got * 0.8 : got, seed: seed * 11 + i * 5 + 3, mm: MM, at: near });
    // Seen through a cover, a cell's cracks are fine lines: what shows of it is mostly what leaked.
    lay(covered ? b.cracks.map(c => ({ ...c, open: c.open * 0.5 })) : b.cracks, m, k, 0, 0, seed + 50 + i, thick * MM * k, (x, y) => !(p.inside?.(x, y) ?? true) || !!p.hidden?.(x, y));
    if (!covered) sheets.push({ ...p, breaks: 'glass', thick });
    return { cracks: b.cracks, near };
  });
  // Each piece sits a little off the plane of the sheet, more near the blow, and glass more than plastic: what it mirrors jumps across a crack.
  sheets.forEach((c, i) => {
    const box = { x0: Math.max(0, Math.floor(c.x * k)), y0: Math.max(0, Math.floor(c.y * k)), x1: Math.min(w, Math.ceil((c.x + c.w) * k)), y1: Math.min(h, Math.ceil((c.y + c.h) * k)) };
    // Off the sheet's own outline counts as a crack: nothing there is a piece of it.
    const on = new Float32Array(wall);
    if (c.inside) for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) if (!c.inside((x + 0.5) / k, (y + 0.5) / k)) on[y * w + x] = 1;
    const ids = new Int32Array(w * h), n = pieces(on, w, box, 0.08, ids), tilts = new Float32Array((n + 1) * 2), r = random(seed * 3 + i + 0.25);
    const sum = new Float64Array((n + 1) * 3);
    for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
      const id = ids[y * w + x]!;
      if (!id) continue;
      sum[id * 3] += x;
      sum[id * 3 + 1] += y;
      sum[id * 3 + 2] += 1;
    }
    const span = Math.hypot(c.w, c.h) * k;
    let whole = 0;
    for (let id = 1; id <= n; id++) whole += sum[id * 3 + 2]!;
    for (let id = 1; id <= n; id++) {
      const count = sum[id * 3 + 2]!, cx = sum[id * 3]! / count / k, cy = sum[id * 3 + 1]! / count / k;
      // The piece that is most of the sheet is the sheet, still flat in its frame.
      if (count * 4 > whole * 3 && n > 1) continue;
      const near = 1 - Math.min(1, Math.hypot(cx - at[0], cy - at[1]) * k / span), most = (c.breaks === 'glass' || c.breaks === 'crystal' ? 0.012 : 0.005) * (0.5 + hard) * (0.5 + near * 1.5);
      const a = r() * Math.PI * 2, m = most * (0.3 + r() * 0.7);
      tilts[id * 2] = Math.cos(a) * m;
      tilts[id * 2 + 1] = Math.sin(a) * m;
    }
    for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
      const n0 = y * w + x, id = ids[n0]!;
      if (!id || c.hidden?.((x + 0.5) / k, (y + 0.5) / k)) continue;
      owner[n0] = id + i * 65536 + 1;
      const tx = tilts[id * 2]!, ty = tilts[id * 2 + 1]!;
      data[n0 * 4] = 128 + Math.round(Math.max(-1, Math.min(1, tx / TILT_RANGE)) * 127);
      data[n0 * 4 + 1] = 128 + Math.round(Math.max(-1, Math.min(1, ty / TILT_RANGE)) * 127);
    }
  });
  for (let n = 0; n < w * h; n++) {
    if (!data[n * 4] && !data[n * 4 + 1]) data[n * 4] = data[n * 4 + 1] = 128;
    data[n * 4 + 2] = Math.round(Math.min(1, cover[n]!) * 255);
    data[n * 4 + 3] = Math.round((angle[n]! / Math.PI) * 255);
  }
  const faces = new Uint8Array(n2 * 4);
  for (let n = 0; n < n2; n++) {
    faces[n * 4] = Math.round(Math.min(1, face[n]!) * 255);
    faces[n * 4 + 1] = Math.round(Math.min(1, gap[n]!) * 255);
    faces[n * 4 + 3] = 255;
  }
  return { cracks: { w, h, data }, faces: { w, h, data: faces }, panels: panels.map((p, i) => (cells[i] ? panel(p, cells[i]!, hard, seed * 11 + i * 5 + 3) : null)) };
}

/**
 * What a screen's broken glass did to its picture. A cell's liquid leaks near the blow, in blots that often stop at a crack. A colour panel's rows are pulled sideways beside it, and a line or two dies. A tube has nothing to leak
 * and an LED's lamps stand alone, so they keep their picture: only the cover over them breaks.
 */
function panel(p: Panel, cell: Cell, hard: number, seed: number): Bytes | null {
  if (p.kind === 'crt') return null;
  const rand = random(seed + 0.75);
  const k = Math.min(2, MOST_DAMAGE / Math.max(p.w, p.h)), w = Math.max(2, Math.round(p.w * k)), h = Math.max(2, Math.round(p.h * k));
  const at = cell.near, b = cell;
  const cover = new Float32Array(w * h), angle = new Float32Array(w * h), wall = new Float32Array(w * h), ids = new Int32Array(w * h);
  lay(b.cracks, { w, h, cover, angle, wall }, k, -p.x * k, -p.y * k, seed, 0);
  const n = pieces(wall, w, { x0: 0, y0: 0, x1: w, y1: h }, 0.15, ids);
  const ax = (at[0] - p.x) * k, ay = (at[1] - p.y) * k, diag = Math.hypot(w, h);
  // The liquid pools in a blot or a few near the blow: round but lumpy, and dense, with a mottled skin inside it (reference/cracked-touch/17,
  // cracked-tft/01). Where a crack of the cell runs through a blot it often stops there, in a straight edge: each piece lets it in or not.
  const unit = MM * k, blots: [number, number, number][] = [];
  for (let i = 0, count = 1 + Math.round(hard * 2 + rand() * 1.5); i < count; i++) {
    const r = (2.5 + rand() * 4 + hard * 5) * unit * (i ? 0.45 + rand() * 0.4 : 1), off = i ? diag * (0.06 + rand() * 0.25) * hard : r * 0.3;
    const into = Math.atan2(h / 2 - ay, w / 2 - ax) + (rand() - 0.5) * 2;
    blots.push([ax + Math.cos(into) * off, ay + Math.sin(into) * off, r]);
  }
  const let_in = new Float32Array(n + 1);
  for (let id = 1; id <= n; id++) let_in[id] = rand() < 0.3 ? 0 : 0.75 + rand() * 0.25;
  // The pieces under a blot's middle always take it.
  for (const [bx, by] of blots) {
    const x = Math.min(w - 1, Math.max(0, Math.round(bx))), y = Math.min(h - 1, Math.max(0, Math.round(by))), id = ids[y * w + x]!;
    if (id) let_in[id] = 1;
  }
  const lump = noise(seed + 9), fine = noise(seed + 23), skin = cells(seed + 31, 1.1 * unit), data = new Uint8Array(w * h * 4), leak = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, id = ids[i]!;
    // On a crack, the leak's on both sides.
    const own = id || ids[i - 1] || ids[i + 1] || ids[i - w] || ids[i + w] || 0;
    if (!let_in[own]) continue;
    // A lumpy edge: where it reaches wanders with a slow noise, softened over a fraction of a millimetre.
    const wx = x + (lump(x / (3 * unit), y / (3 * unit)) - 0.5) * 4 * unit, wy = y + (lump(x / (3 * unit) + 7, y / (3 * unit) + 3) - 0.5) * 4 * unit;
    let most = 0;
    for (const [bx, by, r] of blots) most = Math.max(most, (r - Math.hypot(wx - bx, wy - by)) / (0.5 * unit));
    if (most <= 0) continue;
    const edge = Math.min(1, most), body = edge * edge * (3 - 2 * edge);
    // Inside, a skin of cells a millimetre across with paler veins between them, and a slow cloud over that.
    const vein = skin(x, y), cloud = fine(x / (2 * unit), y / (2 * unit));
    leak[i] = let_in[own]! * body * (0.97 - 0.16 * Math.max(0, 1 - vein / 0.12) * cloud * 2 - 0.2 * cloud * cloud);
  }
  const colour = p.kind === 'tft' || p.kind === 'oled', lines: [boolean, number, number][] = [];
  // A line or two that dies, through the break: a row or a column whose drivers it cut.
  for (let i = 0, count = rand() < hard - 0.2 ? 1 + Math.floor(rand() * 2.5 * hard) : 0; i < count; i++) {
    const across = rand() < 0.5;
    lines.push([across, Math.round((across ? ay : ax) + (rand() - 0.5) * diag * 0.25), 1 + Math.floor(rand() * 2 * k)]);
  }
  // Beside the leak a colour panel pulls its rows sideways, a band of them at a time, each by its own amount.
  const band = new Float32Array(h), torn = new Float32Array(h);
  if (colour) {
    let y = 0;
    while (y < h) {
      const tall = Math.max(1, Math.round((1 + rand() * 4) * k)), shift = rand() < 0.35 ? 0 : (rand() - 0.5) * 0.14;
      for (let j = y; j < Math.min(h, y + tall); j++) band[j] = shift;
      y += tall;
    }
    for (let j = 0; j < h; j++) {
      let most = 0;
      for (let x = 0; x < w; x++) most = Math.max(most, leak[j * w + x]!);
      torn[j] = most;
    }
  }
  // How far along its row each pixel is from the leak, both ways.
  const gaps = new Float32Array(w * h).fill(Infinity);
  if (colour) for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) { if (leak[y * w + x]! > 0.3) last = x; gaps[y * w + x] = x - last; }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) { if (leak[y * w + x]! > 0.3) last = x; gaps[y * w + x] = Math.min(gaps[y * w + x]!, last - x); }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let dead = 0;
    for (const [across, at0, thick] of lines) if (Math.abs((across ? y : x) - at0) < thick) dead = 1;
    let pull = 0, dark = dead;
    if (colour && torn[y]! > 0.2) {
      // From the leak's edge out along the row, fading.
      const gap = gaps[i]!, along = Math.exp(-gap / (w * (0.04 + hard * 0.1)));
      pull = band[y]! * along * torn[y]!;
      dark = Math.max(dark, along * torn[y]! * Math.min(1, Math.abs(band[y]!) * 12) * 0.7 * (leak[i]! < 0.3 ? 1 : 0));
    }
    // A colour panel's backlight shows a pale ring where the cell was pressed.
    const r = Math.hypot(x - ax, y - ay) / (diag * (0.08 + hard * 0.1)), bruise = colour ? Math.exp(-(r - 1) * (r - 1) * 6) * 0.6 * hard : 0;
    data[i * 4] = Math.round(Math.min(1, leak[i]!) * 255);
    data[i * 4 + 1] = 128 + Math.round(Math.max(-1, Math.min(1, pull / 0.25)) * 127);
    data[i * 4 + 2] = Math.round(Math.min(1, dark) * 255);
    data[i * 4 + 3] = Math.round(Math.min(1, bruise) * 255);
  }
  return { w, h, data };
}
