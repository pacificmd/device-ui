import { capsule, circle, limits, MM, outline, path, rect, type Part, type Sheet, type Solid, type SurfaceOptions, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';

export const DIM_FOCUS: Vec3 = [3.85, 1.76, 0.28];

/** What a part's marks are printed on: the nearest surface, else the device. */
export const ground = (p: Part, d: { material: string }) => p.el.closest('d-surface')?.getAttribute('material') ?? d.material;

/**
 * A part with nothing to be mounted in: no device round it and no surface under it, so it lies as it came, with
 * the body and fixings a panel would hide.
 */
export const loose = (p: Part) => {
  const host = p.el.closest('d-device, [data-alone]');
  if (!host || host.localName === 'd-device') return false;
  const under = p.el.parentElement?.closest('d-surface');
  return !under || !host.contains(under);
};

/**
 * Draws `front`, the part as it shows through a panel. Loose, `body` goes under it first and the front stands on that,
 * `tall` mm up, so what a panel hides is there and what shows is drawn once.
 */
export const standing = (s: Sheet, p: Part, tall: number, body: () => void, front: () => void) => {
  if (!loose(p)) return front();
  body();
  s.group({ z: tall }, front);
};

/** The legs a part is soldered by, standing out either side of `x`..`x + w` at `cy`, as a loose one shows them. */
export const legs = (s: Sheet, x: number, w: number, cy: number, o: { wide?: number; long?: number; deep?: number } = {}) => {
  const wide = (o.wide ?? 1) * MM, long = (o.long ?? 1.2) * MM;
  for (const left of [true, false]) s.surface(rect(left ? x - long : x + w, cy - wide / 2, long, wide), { material: 'satin-steel', bevel: 0.4, zEdge: 0, zTop: o.deep ?? 0.3 });
};

export const num = (p: Part, name: string, fallback: number) => {
  const v = p.el.getAttribute(name);
  return v === null || v === '' ? fallback : +v;
};

/** A length attribute in mm, as css px. */
export const mm = (p: Part, name: string, fallback: number) => num(p, name, fallback) * MM;

/** An attribute holding several numbers, such as a point: `at="230 326"`. */
export const nums = (p: Part, name: string, fallback: number[]) => {
  const v = p.el.getAttribute(name);
  return v ? v.trim().split(/[\s,]+/).map(Number) : fallback;
};

const under = (tags: string[], suffix = '') => tags.map(t => `.d-gl ${t}${suffix}`).join(', ');

/** The css every part wrapping an input needs. The input stays usable, and goes out of sight only under the glass. */
export const controlStyles = (...tags: string[]) => `
${tags.join(', ')} { display: block; position: relative; touch-action: none; }
${tags.map(t => `${t} input`).join(', ')} { width: 100%; height: 100%; margin: 0; }
${under(tags)} { cursor: grab; }
${under(tags, ':active')} { cursor: grabbing; }
${under(tags, ' input')} { position: absolute; inset: 0; opacity: 0; appearance: none; cursor: inherit; }
`;

/** The css every key needs: the device's type, and under the glass no button of its own. */
export const keyStyles = (...tags: string[]) => `
:where(${tags.join(', ')}) { font: inherit; letter-spacing: inherit; }
${under(tags)} {
  appearance: none; background: none; border: 0; padding: 0; color: transparent;
  outline: none; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
}
`;

/** Embossing tape: how thick it is, mm, and what a letter punched up out of it looks like, whitened where the plastic stretched. */
export const TAPE_THICK = 0.5;
export const PUNCHED = { material: 'plastic-white', bevel: 0.8 };

/** How far along its range a control or meter sits, 0 to 1. */
export const fraction = (el: { value: string | number; min: string | number; max: string | number }) => {
  const [min, max] = limits(el), span = max - min;
  return span ? Math.min(1, Math.max(0, (+el.value - min) / span)) : 0;
};

/** A setting that belongs to the whole of something: its device's, or that of whatever holds a part that's out on its own, up to the page itself. */
export const inherited = (d: { el: Element }, name: string) => d.el.getAttribute(name) ?? d.el.closest(`[${name}]`)?.getAttribute(name) ?? null;

export const lamp = (p: Part, fallback = 'amber'): Vec3 => lampColours[p.el.getAttribute('color') ?? fallback] ?? lampColours.amber!;

export const scale = (c: Vec3, k: number): Vec3 => [c[0] * k, c[1] * k, c[2] * k];

/** The font a part's mask text should use, sized here but styled by the page. */
export const font = (p: Part, size: number, weight = 600) =>
  `${weight} ${size}px ${getComputedStyle(p.el).fontFamily}`;

/** Clockwise from straight up, as a point on a circle. */
export const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [
  cx + Math.sin(a) * r, cy - Math.cos(a) * r,
];

/** A ring sector as an SVG path, in a part's own css px. */
export function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const [ax, ay] = polar(cx, cy, r1, a0), [bx, by] = polar(cx, cy, r1, a1);
  const [ix, iy] = polar(cx, cy, r0, a1), [jx, jy] = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${ax} ${ay} A${r1} ${r1} 0 ${large} 1 ${bx} ${by} L${ix} ${iy} A${r0} ${r0} 0 ${large} 0 ${jx} ${jy} Z`;
}

/** The box of a key, with its own radius at each corner if `radius` names four, or the edge `path` draws in its `viewbox`, traced off a cap that isn't a box. */
export const keyShape = (p: Part, x: number, y: number, w: number, h: number): Solid => {
  const edge = p.el.getAttribute('path');
  if (edge) return path(edge, x, y, w, h, { viewBox: nums(p, 'viewbox', [0, 0, 100, 100]) as [number, number, number, number], spread: 8 });
  if (p.el.hasAttribute('round')) return circle(x + w / 2, y + h / 2, Math.min(w, h) / 2);
  const [a = 0.5, b = a, c = a, d = a] = nums(p, 'radius', [0.5]).map(r => r * MM);
  return outline(x, y, w, h, [a, b, c, d]);
};

/**
 * Something turned, on an axis lying up and down the view and seen from the side: as deep as it is wide, so it's round from above as well.
 * `axis` is how far over what it sits on its axis lies, mm, and `on` draws on it while it's still round, for knurling.
 */
export function upright(s: Sheet, cx: number, r: number, y: number, h: number, o: SurfaceOptions, axis = 0, on?: () => void): void {
  const R = r / MM;
  s.bend({ from: [cx, y], to: [cx + r, y], mirror: [cx, y], rigid: true, drop: R });
  s.surface(rect(cx - r, y, r * 2, h), { bevel: 1.5, zEdge: axis + R - 0.3, zTop: axis + R, ...o });
  on?.();
  s.bend();
}

/** Something turned, laid along a level axle through `cy` and seen from the side, so it's round from above and below as well. Css px. */
export function lying(s: Sheet, cy: number, r: number, x: number, w: number, o: SurfaceOptions, radius = 0): void {
  const R = r / MM;
  s.bend({ from: [x, cy], to: [x, cy + r], mirror: [x, cy], rigid: true, drop: R });
  s.surface(rect(x, cy - r, w, r * 2, { radius }), { bevel: 1.5, zEdge: R - 0.3, zTop: R, ...o });
  s.bend();
}

/**
 * A body of revolution lying along `cy`, from stations `[x, r]` in mm from `x0`: a run at one radius is a cylinder, and a run between two
 * is a capsule, which is tangent to its wide end and goes on narrowing faster to its narrow one. The capsule's round wide end is under the
 * cylinder that follows it, so a body has to have one at its wide end, and its narrow end is left round. `ends` is how far each outer end
 * of a cylinder rolls over, mm.
 */
export function turned(s: Sheet, x0: number, cy: number, stations: readonly (readonly [number, number])[], o: SurfaceOptions & { ends?: [number, number] } = {}): void {
  const { ends = [0.2, 0.2], ...look } = o, at = (mm: number) => x0 + mm * MM, last = stations.length - 2;
  stations.slice(1).forEach(([b, rb], i) => {
    const [a, ra] = stations[i]!;
    if (ra === rb) return;
    const [wide, rw, thin, rt] = ra > rb ? [a, ra, b, rb] : [b, rb, a, ra];
    s.surface(capsule(at(wide), cy, at(thin), cy, rw * MM, rt * MM), { profile: 'round', zEdge: 0, zTop: 0, ...look });
  });
  stations.slice(1).forEach(([b, rb], i) => {
    const [a, ra] = stations[i]!;
    if (ra !== rb) return;
    // The roll runs round all four sides of what's drawn, so what isn't an end goes back over it.
    const left = i === 0 ? ends[0] : 0, right = i === last ? ends[1] : 0, r = ra * MM, roll = Math.max(left, right);
    if (roll) lying(s, cy, r, at(a), (b - a) * MM, { ...look, bevel: roll * MM, zEdge: ra - roll }, roll * MM);
    lying(s, cy, r, at(a + left), (b - a - left - right) * MM, { ...look, bevel: 0, zEdge: ra });
  });
}
