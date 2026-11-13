import type { Box } from './types.js';

const MM = 0.25;

export interface BendOptions {
  /** Where the sheet starts to turn away, css px. */
  from: readonly [number, number];
  /** Where it has turned fully away and goes out of sight, css px. */
  to: readonly [number, number];
  /** How far it falls between the two, mm, or below 0, how far it rises. Less than the distance between them squashes the curve, which fits a wide form into the height there is. Left out, the curve is a true circle. */
  drop?: number;
  /** Turns away on the far side as well, mirrored across this point. On `from`, that makes a cylinder. */
  mirror?: readonly [number, number];
  /** Drawn as it looks from the front, so what's on it stays where it is and only falls away. */
  rigid?: boolean;
  /** Rigid, and what stands past `to` stays, at the height the curve ends on. For a body whose ends round off, with lugs beyond them. */
  past?: boolean;
}

export interface Bend {
  dir: [number, number];
  /** Where the mirror sits along `dir`, or the start of the bend if there is none. */
  at: number;
  /** How far past `at` the sheet stays flat. */
  flat: number;
  reach: number;
  drop: number;
  /** How much length the curve holds. 1 is a circle, and a flat curve tends to 0. Below 0 it holds none, and nothing past it is cut. */
  k: number;
  both: boolean;
}

export function resolveBend(o: BendOptions): Bend {
  const x = o.to[0] - o.from[0], y = o.to[1] - o.from[1], reach = Math.hypot(x, y) || 1;
  const dir: [number, number] = [x / reach, y / reach], drop = o.drop ?? reach * MM;
  const start = o.from[0] * dir[0] + o.from[1] * dir[1];
  const at = o.mirror ? o.mirror[0] * dir[0] + o.mirror[1] * dir[1] : start;
  // Close to the true length of a quarter ellipse, without an elliptic integral in the shader.
  return { dir, at, flat: start - at, reach, drop, k: o.past ? -1 : o.rigid ? 0 : (drop / MM / reach) ** 1.5, both: !!o.mirror };
}

/** Distance along the flat sheet of the point that lands `y` past the start of the bend. */
const unrolled = (y: number, b: Bend) => y + b.k * (b.reach * Math.asin(Math.min(y / b.reach, 1)) - y);

/** Where a point on the flat sheet ends up. */
export function bendPoint(x: number, y: number, b: Bend): [number, number] {
  const t = x * b.dir[0] + y * b.dir[1] - b.at, along = b.both && t < 0 ? -1 : 1, s = t * along - b.flat;
  if (s <= 0 || b.k < 0) return [x, y];
  let lo = 0, hi = b.reach;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (unrolled(mid, b) < s) lo = mid;
    else hi = mid;
  }
  const by = (hi - s) * along;
  return [x + b.dir[0] * by, y + b.dir[1] * by];
}

/** Whether a box on the sheet lies wholly where it's still flat, so bending leaves it as it is. */
export function unbent(box: Box, b: Bend): boolean {
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]] as const;
  return corners.every(([x, y]) => {
    const t = x * b.dir[0] + y * b.dir[1] - b.at;
    return (b.both && t < 0 ? -t : t) <= b.flat;
  });
}

/**
 * The area a box on the flat sheet covers once bent. Everything moves back towards the bend's start,
 * so a stitch far along the sheet draws well short of where the sheet alone would put it.
 */
export function bentBox(box: Box, b: Bend): Box {
  if (b.k < 0) return box;
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]] as const;
  const at = corners.map(([x, y]) => bendPoint(x, y, b));
  const x0 = Math.min(...at.map(p => p[0])) - 2, y0 = Math.min(...at.map(p => p[1])) - 2;
  const x1 = Math.max(...at.map(p => p[0])) + 2, y1 = Math.max(...at.map(p => p[1])) + 2;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
