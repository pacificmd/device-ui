// How a sheet breaks: the lines a blow leaves in glass or a clear plastic, as geometry. Nothing here draws: the sheet lays these into its
// maps, where the light finds them, and a screen under a break reads them to lose its picture round them.
//
// The rules are those of brittle fracture in general, not of any one thing (fractography of glass, Quinn; forensic glass, the radial and
// concentric pattern; Iben and O'Brien on surface crack patterns):
// - A blow on glass sends radial cracks out from where it landed first. Each runs nearly straight, with small kinks a millimetre or two
//   apart, and forks in two at 35 to 55 degrees where the stress is high, near the blow, and seldom further out.
// - Concentric cracks come second, round the blow, from one radial to the next. A crack ends where it meets one already there, so they
//   end on the radials, in a T, and never cross them.
// - A crack turns to meet a free edge, or a crack it's about to run into, square on: nothing pulls along either.
// - Later cracks start off the side of an earlier one, square to it, and run until they meet another, which cuts the sheet into pieces
//   with corners: a network, densest near the blow.
// - How much breaks is a length in millimetres, set by how hard it landed, not a count a sheet: a watch's small crystal gets a crack or
//   two, a phone's front a web.
// - A moulded clear plastic doesn't shatter. It splits in a few long smooth curves, nearly parallel, that fork at shallow angles like a
//   river and run on to the edge.
// - Thickness sets the scale of all of it. A thin sheet breaks finer, in more cracks with more forks; a thick one in a few long ones,
//   smoother. Each crack's two faces run through the sheet, square to it in the main but never quite: they lean, a little in a
//   radial crack, more in a ring, and in the cone the blow punches out of thick glass far over. Seen through the glass, a leaning
//   face is a band as wide as the sheet is thick times its lean: nothing on a phone's cover, a bright ribbon in a tube's face.
// - What it's made of says how it breaks at all (see `Breaks`): soda-lime glass shatters; sapphire mostly holds, and goes in a few
//   straight cracks; acrylic splits in long curves; polycarbonate gives before it cracks, crazing in fine short lines round the
//   blow, square to the pull, which runs out from it, so the crazes lie round it in rings.
// Every line lies inside the sheet's own outline, which may be any shape: a round crystal cracks inside its circle, not its box.
import type { Point } from './shapes.js';
import type { Breaks } from './types.js';

/** A box in the sheet's own units, and its outline in it if that isn't the whole box. */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Whether a point of the box is on the sheet. */
  inside?: (x: number, y: number) => boolean;
}

export interface Crack {
  /** Its line, from where it starts to where it stops. */
  pts: Point[];
  /** How wide it opens at its start, in the area's units. It closes to nothing along its length unless it ran into another. */
  open: number;
  /** Whether it ends on another crack or the edge, still open, or ran out in the middle and closes there. */
  stopped: boolean;
  /** How far its faces lean off square to the sheet, as a slope: over to its left going along it if positive. */
  lean: number;
  /** A craze, which doesn't go through: it shows, but the sheet's still one piece across it. */
  shallow?: boolean;
}

export interface Break {
  /** Where it was struck, on the sheet. */
  at: Point;
  cracks: Crack[];
}

export interface BreakOptions {
  /** What it's made of, as how it breaks. */
  breaks: Breaks;
  /** How thick it is, mm. */
  thick: number;
  /** How hard it landed, 0 to 1. */
  hard: number;
  seed: number;
  /** How many of the area's units make a millimetre. */
  mm: number;
  /** Where the blow came, if not chosen from the seed: on the sheet's face, on its rim, or outside it, as on a body's corner. */
  at?: Point;
}

/** A small seeded generator, so a device breaks the same way every time it's drawn. */
export function random(seed: number): () => number {
  let n = (Math.floor(seed * 9973) ^ 0x9e3779b9) >>> 0;
  return () => {
    n = (Math.imul(n ^ (n >>> 15), 2246822519) + 0x6d2b79f5) >>> 0;
    return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
  };
}

/**
 * Where a blow lands on a thing that fell: on its rim, as often as not near a corner, and now and then on its face, as when it lands on
 * a stone or something lands on it.
 */
export function struck(a: Area, rand: () => number): Point {
  if (rand() < 0.25) return [a.x + a.w * (0.15 + rand() * 0.7), a.y + a.h * (0.15 + rand() * 0.7)];
  const along = (rand() < 0.5 ? rand() * 0.25 : 0.25 + rand() * 0.5) * (rand() < 0.5 ? 1 : -1) + 0.5;
  switch (Math.floor(rand() * 4)) {
    case 0: return [a.x + a.w * along, a.y];
    case 1: return [a.x + a.w, a.y + a.h * along];
    case 2: return [a.x + a.w * along, a.y + a.h];
    default: return [a.x, a.y + a.h * along];
  }
}

/** Where two segments cross, as how far along the first, or -1. */
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return -1;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t > 1e-6 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

/** The turn from one angle to another, the short way, -pi to pi. */
const turn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Segments laid so far, in a coarse grid, so a crack growing asks only those near it whether it's met one. */
class Laid {
  private cells = new Map<number, number[][]>();
  private readonly size: number;
  constructor(size: number) {
    this.size = size;
  }
  private key(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  add(ax: number, ay: number, bx: number, by: number, owner: number): void {
    const s = this.size, seg = [ax, ay, bx, by, owner];
    for (let i = Math.floor(Math.min(ax, bx) / s); i <= Math.floor(Math.max(ax, bx) / s); i++) {
      for (let j = Math.floor(Math.min(ay, by) / s); j <= Math.floor(Math.max(ay, by) / s); j++) {
        const k = this.key(i, j), c = this.cells.get(k);
        if (c) c.push(seg);
        else this.cells.set(k, [seg]);
      }
    }
  }
  private near(x0: number, y0: number, x1: number, y1: number, each: (g: number[]) => void): void {
    const s = this.size;
    for (let i = Math.floor(x0 / s); i <= Math.floor(x1 / s); i++) {
      for (let j = Math.floor(y0 / s); j <= Math.floor(y1 / s); j++) for (const g of this.cells.get(this.key(i, j)) ?? []) each(g);
    }
  }
  /** How far along a step it first meets a segment of another crack, or -1. `skip` is a crack it may touch, the one it left. */
  meets(ax: number, ay: number, bx: number, by: number, owner: number, skip: number): number {
    let best = -1;
    this.near(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), g => {
      if (g[4] === owner || g[4] === skip) return;
      const t = cross(ax, ay, bx, by, g[0]!, g[1]!, g[2]!, g[3]!);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    });
    return best;
  }
  /** The nearest segment of another crack within `r`: how far, and which way it runs. */
  nearest(x: number, y: number, r: number, owner: number, skip: number): { d: number; a: number } | null {
    let best: { d: number; a: number } | null = null;
    this.near(x - r, y - r, x + r, y + r, g => {
      if (g[4] === owner || g[4] === skip) return;
      const dx = g[2]! - g[0]!, dy = g[3]! - g[1]!, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - g[0]!) * dx + (y - g[1]!) * dy) / l2)) : 0;
      const d = Math.hypot(x - g[0]! - t * dx, y - g[1]! - t * dy);
      if (d < r && (!best || d < best.d)) best = { d, a: Math.atan2(dy, dx) };
    });
    return best;
  }
}

/** Breaks an area. Every line it gives lies inside it. */
export function shatter(area: Area, o: BreakOptions): Break {
  const rand = random(o.seed), mm = o.mm, hard = Math.min(Math.max(o.hard, 0), 1), crystal = o.breaks === 'crystal', glass = o.breaks === 'glass' || crystal;
  // How thick, against a millimetre: what everything that scales with it goes by.
  const thick = Math.min(Math.max(o.thick, 0.2), 25);
  const inside = (x: number, y: number) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h && (area.inside?.(x, y) ?? true);
  const middle: Point = [area.x + area.w / 2, area.y + area.h / 2], span = Math.hypot(area.w, area.h), size = span / mm;
  const laid = new Laid(3 * mm), cracks: Crack[] = [];
  const gauss = () => rand() + rand() + rand() - 1.5;

  // Where the blow reaches the sheet: where it landed, if that's on it, or else the nearest of it on the way in.
  let at: Point = o.at ?? struck(area, rand);
  if (!inside(at[0], at[1])) {
    const into = Math.atan2(middle[1] - at[1], middle[0] - at[0]);
    let x = at[0], y = at[1];
    for (let run = 0; run < span * 2 && !inside(x, y); run += mm * 0.25) {
      x += Math.cos(into) * mm * 0.25;
      y += Math.sin(into) * mm * 0.25;
    }
    if (!inside(x, y)) return { at, cracks };
    at = [x, y];
  }

  // Which way is out, if an edge is within r: the mean of the ways that leave the sheet.
  const edge = (x: number, y: number, r: number): number | null => {
    let sx = 0, sy = 0;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (!inside(x + Math.cos(a) * r, y + Math.sin(a) * r)) { sx += Math.cos(a); sy += Math.sin(a); }
    }
    return sx || sy ? Math.atan2(sy, sx) : null;
  };
  // How close to the blow, 1 there and falling away: where cracks fork and new ones start.
  const nearBlow = (x: number, y: number) => Math.exp(-Math.hypot(x - at[0], y - at[1]) / (span * 0.25));

  interface Grow { x: number; y: number; a: number; far: number; open: number; skip: number; depth: number; bend: number; lean: number }
  const queue: Grow[] = [];
  /**
   * One crack, a step at a time. Glass runs straight between kinks; plastic curves smoothly. Each turns square to an edge or crack as it
   * nears it, and ends there, or at its length. Returns its index, or -1 if it went nowhere.
   */
  const grow = (g: Grow): number => {
    const id = cracks.length, step = 0.4 * mm, look = (glass ? 1.2 : 2.5) * mm, pts: Point[] = [[g.x, g.y]];
    // Thick glass kinks further apart, and a crystal hardly at all: it cleaves.
    const apart = Math.sqrt(thick), jag = crystal ? 0.07 : 0.3;
    let { x, y, a, bend } = g, stopped = false, run = 0, kink = (0.6 + rand() * 2) * mm * apart, off = 0;
    if (!inside(x, y)) return -1;
    while (run < g.far) {
      if (glass) {
        // Straight on its way, but kinked: every millimetre or two it zigzags off its line and back, where it found a weaker way
        // through. The kinks don't add up, so it keeps its heading.
        a += bend * (step / mm) + (rand() - 0.5) * 0.008;
        if ((kink -= step) <= 0) {
          const was = off;
          off = gauss() * jag;
          a += off - was;
          kink = (0.5 + rand() * 1.8) * mm * apart;
        }
      } else {
        bend += (rand() - 0.5) * 0.02 - bend * 0.03;
        a += bend * (step / mm);
      }
      // Square on to what's ahead: the edge, or a crack it's about to meet.
      const e = edge(x, y, look);
      if (e !== null) {
        const off = turn(a, e);
        if (Math.abs(off) < Math.PI / 2) a += off * 0.35;
      }
      const n = run < look ? null : laid.nearest(x + Math.cos(a) * look * 0.5, y + Math.sin(a) * look * 0.5, look, id, g.skip);
      if (n) {
        const toward = Math.abs(turn(a, n.a + Math.PI / 2)) < Math.PI / 2 ? n.a + Math.PI / 2 : n.a - Math.PI / 2;
        a += turn(a, toward) * 0.3 * (1 - n.d / look) * (glass ? 1 : 0.6);
      }
      let nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      const t = laid.meets(x, y, nx, ny, id, g.skip);
      if (t >= 0) {
        nx = x + (nx - x) * t;
        ny = y + (ny - y) * t;
        stopped = true;
      }
      if (!inside(nx, ny)) {
        // Onto the edge itself, by halves.
        let lo = 0, hi = 1;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          if (inside(x + (nx - x) * mid, y + (ny - y) * mid)) lo = mid;
          else hi = mid;
        }
        nx = x + (nx - x) * lo;
        ny = y + (ny - y) * lo;
        stopped = true;
      }
      laid.add(x, y, nx, ny, id);
      pts.push([(x = nx), (y = ny)]);
      run += step;
      if (stopped) break;
      if (g.depth >= (glass ? 3 : 4)) continue;
      if (glass) {
        // It forks in two where the stress is high: a pair of cracks, between them 35 to 55 degrees.
        if (rand() < (0.004 + 0.05 * hard * nearBlow(x, y)) / Math.sqrt(thick) * (crystal ? 0.15 : 1) * (step / mm)) {
          const half = (0.3 + rand() * 0.18) * (rand() < 0.5 ? 1 : -1), left = (g.far - run) * (0.5 + rand() * 0.5);
          queue.push({ x, y, a: a + half, far: left, open: g.open * 0.8, skip: id, depth: g.depth + 1, bend: 0, lean: g.lean + gauss() * 0.1 });
          a -= half * (0.3 + rand() * 0.4);
        }
      } else if (rand() < (0.01 + 0.04 * hard * nearBlow(x, y)) * (step / mm)) {
        // A river's fork: off at a shallow angle, and running on near the first.
        queue.push({ x, y, a: a + (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.25), far: (g.far - run) * (0.4 + rand() * 0.6), open: g.open * 0.75, skip: id, depth: g.depth + 1, bend: bend * 0.5, lean: g.lean });
      }
    }
    if (pts.length < 2) return -1;
    cracks.push({ pts, open: g.open, stopped, lean: g.lean });
    return id;
  };
  const drain = () => { while (queue.length) grow(queue.shift()!); };

  // Which ways from the blow lie on the sheet: all round on its face, half on an edge, a quarter in a corner.
  const ways: number[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    if (inside(at[0] + Math.cos(a) * 2 * mm, at[1] + Math.sin(a) * 2 * mm)) ways.push(a);
  }
  if (!ways.length) return { at, cracks };
  // A fan of the ways on the sheet, spread unevenly.
  const fan = (count: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push(ways[Math.min(ways.length - 1, Math.floor(((i + 0.15 + rand() * 0.7) / count) * ways.length))]!);
    return out;
  };

  const all = ways.length === 72;
  if (crystal) {
    // Sapphire takes a blow that would shatter glass, and when it goes, it's in a few straight cracks from the blow and a chip there.
    const count = hard < 0.35 ? 0 : Math.max(1, Math.round(1 + (hard - 0.35) * 3 + gauss()));
    for (const a of fan(count)) grow({ x: at[0], y: at[1], a: a + gauss() * 0.1, far: span * (0.4 + rand() * 0.8), open: (0.05 + rand() * 0.04) * mm, skip: -1, depth: 2, bend: 0, lean: gauss() * 0.4 });
    drain();
    for (const a of fan(Math.round(hard * 3))) grow({ x: at[0], y: at[1], a: a + gauss() * 0.3, far: (0.3 + rand() * 0.8) * mm * Math.sqrt(thick), open: 0.04 * mm, skip: -1, depth: 3, bend: 0, lean: (0.5 + rand() * 0.5) * (rand() < 0.5 ? 1 : -1) });
  } else if (glass) {
    // Radials: more the harder it landed and the bigger the sheet, a little over one each 15 mm across it at full force, in a
    // millimetre's glass; fewer in thicker.
    const count = Math.max(1, Math.round((1 + size / 15) * (0.3 + hard * 0.9) * (all ? 1.3 : ways.length > 30 ? 1 : 0.7) / thick ** 0.35 + gauss() * 0.8));
    const angles = fan(count).map(a => a + gauss() * 0.06), radials: number[] = [];
    for (const a of angles) {
      radials.push(grow({ x: at[0], y: at[1], a, far: span * (0.3 + rand() * 0.4 + hard * 0.9), open: (0.06 + rand() * 0.05) * mm, skip: -1, depth: 0, bend: gauss() * 0.004, lean: gauss() * 0.3 }));
    }
    drain();
    // Concentric: chords between neighbouring radials, round the blow, further apart further out, fewer the further. Each ends on a radial.
    const on = (id: number, r: number): Point | null => {
      if (id < 0) return null;
      const p = cracks[id]!.pts;
      for (let i = 1; i < p.length; i++) {
        const d0 = Math.hypot(p[i - 1]![0] - at[0], p[i - 1]![1] - at[1]), d1 = Math.hypot(p[i]![0] - at[0], p[i]![1] - at[1]);
        if (d1 >= r && d0 < r) {
          const t = (r - d0) / Math.max(d1 - d0, 1e-6);
          return [p[i - 1]![0] + (p[i]![0] - p[i - 1]![0]) * t, p[i - 1]![1] + (p[i]![1] - p[i - 1]![1]) * t];
        }
      }
      return null;
    };
    const order = radials.map((id, i) => [id, angles[i]!] as const).filter(([id]) => id >= 0).sort((p, q) => p[1] - q[1]);
    const pairs = order.map((p, i) => [p[0], order[(i + 1) % order.length]![0], turn(p[1], order[(i + 1) % order.length]![1])] as const)
      .filter(([a, b, gap]) => a !== b && gap > 0.05 && gap < Math.PI * 0.9 && (all || order.length > 1));
    for (let r = (2 + rand() * 2) * mm; r < span * 0.6; r *= 1.5 + rand() * 0.7) {
      const chance = (hard * hard * 1.4 * Math.exp(-r / (span * 0.12)) + 0.05 * hard) / Math.sqrt(thick);
      for (const [ia, ib] of pairs) {
        if (rand() > chance) continue;
        const p = on(ia, r * (0.85 + rand() * 0.3)), q = on(ib, r * (0.85 + rand() * 0.3));
        if (!p || !q) continue;
        // A chord, kinked once or twice, bowing out from the blow a little as a ring round it would.
        const id = cracks.length, pts: Point[] = [p], bits = 1 + Math.floor(rand() * 3);
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, out = Math.atan2(my - at[1], mx - at[0]), bow = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.08;
        for (let j = 1; j <= bits; j++) {
          const t = j / (bits + 1), s = Math.sin(t * Math.PI) * bow + gauss() * 0.3 * mm;
          pts.push([p[0] + (q[0] - p[0]) * t + Math.cos(out) * s, p[1] + (q[1] - p[1]) * t + Math.sin(out) * s]);
        }
        pts.push(q);
        // It ends on the first crack it meets, which may not be the radial it was making for.
        const kept: Point[] = [pts[0]!];
        for (let j = 1; j < pts.length; j++) {
          const [x0, y0] = kept[kept.length - 1]!, [x1, y1] = pts[j]!, t = laid.meets(x0, y0, x1, y1, id, ia);
          if (!inside(x1, y1)) break;
          if (t >= 0 && !(j === pts.length - 1 && t > 0.98)) { kept.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); break; }
          kept.push(pts[j]!);
        }
        if (kept.length < 2) continue;
        for (let j = 1; j < kept.length; j++) laid.add(kept[j - 1]![0], kept[j - 1]![1], kept[j]![0], kept[j]![1], id);
        // A ring leans more than a radial, out from the blow or in.
        cracks.push({ pts: kept, open: (0.03 + rand() * 0.03) * mm, stopped: true, lean: (0.3 + rand() * 0.5) * (rand() < 0.5 ? 1 : -1) });
      }
    }
    // The network: cracks off the side of one already there, square to it, until they meet the next, densest near the blow.
    const fill = Math.min(80, Math.round(hard * hard * (area.w / mm) * (area.h / mm) / 140 / thick));
    for (let i = 0, tries = 0; i < fill && tries < fill * 6 && cracks.length; tries++) {
      const c = cracks[Math.floor(rand() * cracks.length)]!, j = 1 + Math.floor(rand() * (c.pts.length - 1));
      const [x0, y0] = c.pts[j - 1]!, [x1, y1] = c.pts[j]!, t = rand(), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (rand() > nearBlow(x, y) * 1.3 + 0.08) continue;
      const host = cracks.indexOf(c), side = Math.atan2(y1 - y0, x1 - x0) + (rand() < 0.5 ? 1 : -1) * (Math.PI / 2 + gauss() * 0.25);
      grow({ x, y, a: side, far: span * 0.5, open: (0.025 + rand() * 0.03) * mm, skip: host, depth: 3, bend: 0, lean: gauss() * 0.25 });
      i++;
    }
    // Where it landed, the glass is crushed: tiny cracks every way that lies on it, and round them the cone the blow punched out, a
    // ring on the face whose wall flares out through the sheet, so seen from the front it's a bright annulus as wide as the sheet is
    // thick: nothing in a phone's cover, a bullseye in a tube's face.
    const crush = Math.round(hard * (3 + rand() * 4));
    for (const a of fan(crush)) grow({ x: at[0], y: at[1], a: a + gauss() * 0.2, far: (0.4 + rand() * 1.4) * mm * Math.sqrt(thick), open: 0.04 * mm, skip: -1, depth: 3, bend: 0, lean: gauss() * 0.3 });
    if (hard > 0.3) {
      // Round the ring increasing in angle, a face's left is in: so it leans right, out.
      const r = (0.3 + rand() * 0.5) * mm * Math.sqrt(thick), lean = -(0.8 + rand() * 0.6);
      let run: [number, number][] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2, rr = r * (1 + gauss() * 0.04), x = at[0] + Math.cos(a) * rr, y = at[1] + Math.sin(a) * rr;
        if (inside(x, y)) run.push([x, y]);
        else {
          if (run.length > 2) cracks.push({ pts: run, open: 0.03 * mm, stopped: true, lean });
          run = [];
        }
      }
      if (run.length > 2) cracks.push({ pts: run, open: 0.03 * mm, stopped: true, lean });
    }
  } else if (o.breaks === 'craze') {
    // Crazes round the blow, square to the pull that runs out from it, so each lies along a ring round it: short, fine, and thick
    // near it, thinning out. They don't go through.
    const reach = (3 + hard * 10) * mm * (1 + gauss() * 0.3), count = Math.min(600, Math.round(30 + 500 * hard * hard));
    for (let i = 0; i < count; i++) {
      const r = reach * rand() ** 0.8, way = ways[Math.floor(rand() * ways.length)]! + gauss() * 0.05;
      const x = at[0] + Math.cos(way) * r, y = at[1] + Math.sin(way) * r;
      if (!inside(x, y)) continue;
      const a = way + Math.PI / 2 + gauss() * 0.12, len = (0.3 + rand() * 2.2) * mm * (1 - (r / reach) * 0.6);
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
      if (!inside(x1, y1)) continue;
      cracks.push({ pts: [[x, y], [(x + x1) / 2 + Math.cos(way) * len * 0.04, (y + y1) / 2 + Math.sin(way) * len * 0.04], [x1, y1]], open: (0.006 + rand() * 0.01) * mm, stopped: false, lean: 0, shallow: true });
    }
    // Only a hard blow cracks it through, and then in a smooth crack or two from the blow, a short way.
    for (let i = 0, n = hard < 0.7 ? 0 : hard < 0.9 ? 1 : 2; i < n; i++) {
      grow({ x: at[0], y: at[1], a: ways[Math.floor(ways.length * (0.25 + rand() * 0.5))]!, far: span * (0.1 + (hard - 0.7) * 1.4), open: (0.04 + rand() * 0.04) * mm, skip: -1, depth: 3, bend: gauss() * 0.08, lean: gauss() * 0.2 });
    }
    drain();
  } else {
    // A few long smooth curves from the blow, starting near one another and running the same way, nearly parallel.
    const count = Math.max(1, Math.round((1 + size / 25) * (0.4 + hard * 0.9) + gauss() * 0.6));
    const main = ways[Math.floor(ways.length / 2)]!, spread = Math.min(0.8, ways.length / 72 * Math.PI * 0.4);
    for (let i = 0; i < count; i++) {
      const a = main + (i / Math.max(count - 1, 1) - 0.5) * spread + gauss() * 0.15;
      const s = gauss() * 1.5 * mm, x = at[0] + Math.cos(a + Math.PI / 2) * s, y = at[1] + Math.sin(a + Math.PI / 2) * s;
      grow({ x: inside(x, y) ? x : at[0], y: inside(x, y) ? y : at[1], a, far: span * (0.4 + rand() * 0.6 + hard * 0.5), open: (0.04 + rand() * 0.05) * mm, skip: -1, depth: 0, bend: gauss() * 0.06, lean: gauss() * 0.25 });
    }
    drain();
  }
  drain();
  return { at, cracks };
}
