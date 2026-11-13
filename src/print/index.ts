// Graphics on physical things. Each kind is a process, not a picture: pass your own text or `path`.
import { carried, definePart, defineStyles, grow, legendColor, linear, minus, MM, path, polyline, rect, resolveMaterial, text, type DeviceInfo, type Material, type Part, type Sheet, type Solid, type Vec3 } from 'device-ui';
import 'device-ui/materials';
import { pressed } from './die.js';

interface Mark {
  /** What it's on. */
  under: Material;
  /** The name of what it's made of, for the kinds made of something. */
  material: string;
  ink: Vec3;
  /** Mm. Positive sinks, negative raises. */
  depth: number;
  wear: number;
  /** What a raised mark's tops are rolled with, if it names a material. */
  tip?: Material;
  /** For a spray: how far into its path's outside it comes, and how much of that is solid, mm. */
  reach: number;
  hold: number;
  /** An outline a spray lands only inside. */
  stop?: Solid | null;
}

const blend = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// How much of a part's wear each process lets through, and how deep it goes by default.
const PROCESSES = {
  // Dye from a gun held off the work: no edge at all. It's solid `hold` mm in from the outline of its `path`, then thins out until `reach` mm in, and it lands only inside `stop`. A sunburst is coats of this, darkest last.
  spray: { depth: 0, wear: 0, lay(s: Sheet, m: Solid, o: Mark) {
    const { rough } = o.under, reach = o.reach * MM;
    s.cut(reach ? grow(m, reach) : m, { ink: o.ink, feather: Math.max(reach - o.hold * MM, 1), rough, ...(o.stop && { stop: o.stop }) });
  } },
  // Thin enough to let what's under it show, and picked up off a silicone pad, so its edge isn't clean.
  pad: { depth: 0, wear: 1.5, lay(s: Sheet, m: Solid, o: Mark) {
    s.cut(grow(m, 0.25), { ink: blend(o.ink, o.under.color, 0.3), feather: 1, rough: 0.62, wear: o.wear });
  } },
  // Off a litho plate onto paper or card, as a label is: the ink as mixed, edges as clean as the plate's, and as rough as the stock it soaks into.
  offset: { depth: 0, wear: 0.6, lay(s: Sheet, m: Solid, o: Mark) {
    s.cut(m, { ink: o.ink, rough: Math.max(o.under.rough, 0.5), wear: o.wear });
  } },
  // A thick stencilled film that stands on the surface, with its own sheen.
  silk: { depth: -0.06, wear: 0.35, lay(s: Sheet, m: Solid, o: Mark) {
    s.cut(m, { depth: o.depth, soft: 0.2, ink: o.ink, rough: 0.3, wear: o.wear });
  } },
  // Burns off the finish, and what's left is whatever was under it, gone matte. A laser goes microns in, so it has no edge a light
  // could catch: it shows by its frost alone. A `depth` is for one cut deep enough to have walls.
  etch: { depth: 0, wear: 0, lay(s: Sheet, m: Solid, o: Mark) {
    const { sub, subMetal, metal } = o.under;
    s.cut(m, { ...(o.depth && { depth: o.depth, soft: 0.25 }), ink: sub, rough: 0.72, metal: metal > 0.5 ? subMetal : 0 });
  } },
  // Comes out of the tool with the body: steep draft, crisp shoulders, the same stuff all through.
  mould: { depth: -0.4, wear: 0.5, lay(s: Sheet, m: Solid, o: Mark) {
    if (o.depth > 0) s.cut(m, { depth: o.depth, soft: 0.8 });
    else s.surface(m, { material: o.material, follow: true, rise: -o.depth, bevel: 0.8, profile: 'chamfer', over: { touch: o.wear } });
  } },
  // A skin of metal pressed on: bright, sharp edged, flaking back to what's under it.
  foil: { depth: -0.03, wear: 0.7, lay(s: Sheet, m: Solid, o: Mark) {
    const { color, rough, metal } = o.under;
    s.surface(m, { material: o.material, follow: true, rise: -o.depth, bevel: 0.2, profile: 'flat', over: { wear: o.wear, under: [{ color, rough, metal }] } });
  } },
  // The sheet itself pushed through by a die, so its shoulders are wide and soft. A `material` is foil rolled over the tops, as on a bank card's numbers.
  emboss: { depth: -0.5, wear: 0, lay(s: Sheet, m: Solid, o: Mark) {
    if (!o.tip) return s.cut(m, { depth: o.depth, soft: 2.2 });
    const { color, rough, metal } = o.tip;
    s.cut(m, { depth: o.depth, soft: 0.9, ink: color, rough, metal });
  } },
  deboss: { depth: 0.5, wear: 0, lay(s: Sheet, m: Solid, o: Mark) {
    s.cut(m, { depth: o.depth, soft: 2.2 });
  } },
};

export type PrintKind = keyof typeof PROCESSES;
export const printKinds = Object.keys(PROCESSES) as PrintKind[];

const FOIL = 'foil-gold', STICKER = 'sticker-paper';

/** What a part is on: the sticker or surface it's nested in, else the device. */
const ground = (p: Part, d: DeviceInfo) => p.el.parentElement?.closest('[d-mark~="sticker"], d-surface')?.getAttribute('material') ?? d.material;

/** How worn what a part is printed on is: its sticker's own `wear`, else the device's. */
const worn = (p: Part, d: DeviceInfo) => {
  const v = p.el.parentElement?.closest('[d-mark~="sticker"]')?.getAttribute('wear');
  return v === null || v === undefined || v === '' || Number.isNaN(+v) ? d.wear : +v;
};

const number = (p: Part, name: string, fallback: number) => {
  const v = p.el.getAttribute(name);
  return v === null || v === '' || Number.isNaN(+v) ? fallback : +v;
};

/** Hex, or the legend colour of what it's printed on. */
const inkOf = (p: Part, on: string): Vec3 => {
  const c = p.el.getAttribute('color');
  return c && /^#[\da-f]{6}$/i.test(c) ? linear(c) : legendColor(on);
};

/** The part's `path`, around its middle. */
function drawn(p: Part): Solid | null {
  const d = p.el.getAttribute('path');
  if (!d) return null;
  const viewBox = p.el.getAttribute('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined;
  return path(d, -p.w / 2, -p.h / 2, p.w, p.h, { viewBox, rule: p.el.getAttribute('rule') === 'evenodd' ? 'evenodd' : undefined, ...(p.el.hasAttribute('reach') ? { spread: number(p, 'reach', 0) * MM + 8 } : {}) });
}

/** The part's `stop`, on the same box as its `path`. */
function stopOf(p: Part): Solid | null {
  const d = p.el.getAttribute('stop');
  if (!d) return null;
  const viewBox = p.el.getAttribute('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined;
  return path(d, -p.w / 2, -p.h / 2, p.w, p.h, { viewBox, spread: 8 });
}

/** The part's text, around its middle, as outlines. A label can't turn, and these have an edge to work from. */
function lettered(p: Part): Solid[] {
  // A steel die has its own letters and its own pitch, whatever font the page would set the words in.
  if (p.el.hasAttribute('die')) {
    const pitch = number(p, 'pitch', p.h / MM), box = { x: -p.w / 2, y: -p.h / 2 };
    return [path(pressed(p.el.textContent!.trim(), box.x, box.y, pitch * MM, p.h, p.el.getAttribute('die') === 'mirror'), box.x, box.y, p.w, p.h, { viewBox: [box.x, box.y, p.w, p.h] })];
  }
  if (!p.label) return [];
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, { lines, font, letterSpacing, wordSpacing } = p.label;
  return lines.map(l => text(l.text, l.x - cx, l.y - cy, l.w, l.h, { font, letterSpacing, wordSpacing }));
}

/** How near a point sits to the top of a crowned box, 0 to 1. Anything flat is all top. */
export function crownHeight(x: number, y: number, box: { x: number; y: number; w: number; h: number }, crown: [number, number]): number {
  const all = Math.abs(crown[0]) + Math.abs(crown[1]);
  if (!all) return 1;
  const qx = (x - box.x - box.w / 2) / (box.w / 2), qy = (y - box.y - box.h / 2) / (box.h / 2);
  return 1 - Math.min((Math.abs(crown[0]) * qx * qx + Math.abs(crown[1]) * qy * qy) / all, 1);
}

/** How much rubbing a part gets where it sits: most on the top of a crown, least down its sides. */
function exposure(p: Part): number {
  const under = p.el.closest('d-surface'), crown = under?.getAttribute('crown');
  if (!under || !crown) return 1;
  const [cx = 0, cy = cx] = crown.trim().split(/\s+/).map(parseFloat), a = p.el.getBoundingClientRect(), b = under.getBoundingClientRect();
  return 0.25 + 0.75 * crownHeight(a.x + a.width / 2, a.y + a.height / 2, { x: b.x, y: b.y, w: b.width, h: b.height }, [cx, cy]);
}

const turned = (p: Part) => (number(p, 'rotate', 0) * Math.PI) / 180;

/** `d-mark="print pad"`, or offset, silk, etch, mould, foil, emboss, deboss or spray, around text, or `path` and `viewbox`. */
definePart({
  selector: '[d-mark~="print"]',
  options: ['pad', 'offset', 'silk', 'etch', 'mould', 'foil', 'emboss', 'deboss', 'spray'],
  label: true,
  paint(s, p, d) {
    if (carried(p)) return;
    const on = ground(p, d), kind = ((p.el.getAttribute('d-mark') ?? '').trim().split(/\s+/)[1] ?? 'silk') as PrintKind, process = PROCESSES[kind] ?? PROCESSES.silk;
    const mark: Mark = {
      under: resolveMaterial(on), material: p.el.getAttribute('material') || (kind === 'foil' ? FOIL : on), ink: inkOf(p, on), tip: p.el.hasAttribute('material') ? resolveMaterial(p.el.getAttribute('material')!) : undefined,
      depth: number(p, 'depth', process.depth), wear: Math.min(number(p, 'wear', worn(p, d)) * process.wear * exposure(p), 1), reach: number(p, 'reach', 0), hold: number(p, 'hold', 0), stop: stopOf(p),
    };
    const art = drawn(p);
    const lay = () => s.printing(p.el, () => {
      for (const m of art ? [art, ...lettered(p)] : lettered(p)) process.lay(s, m, mark);
    });
    // What's printed on a sticker went on before it was stuck down, so it lies as the sticker does: turned with it, about its middle.
    const sheet = p.el.parentElement?.closest<HTMLElement>('[d-mark~="sticker"][rotate]');
    let left = 0, top = 0;
    for (let el: HTMLElement | null = p.el; sheet && el && el !== sheet; el = el.offsetParent as HTMLElement | null) (left += el.offsetLeft), (top += el.offsetTop);
    if (!sheet) return void s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], rotate: turned(p) }, lay);
    const cx = p.x - left - sheet.clientLeft + sheet.offsetWidth / 2, cy = p.y - top - sheet.clientTop + sheet.offsetHeight / 2;
    s.group({ at: [cx, cy], rotate: (number({ el: sheet } as Part, 'rotate', 0) * Math.PI) / 180 }, () => s.group({ at: [p.x + p.w / 2 - cx, p.y + p.h / 2 - cy], rotate: turned(p) }, lay));
  },
});

// Real stock is about 0.1mm, which no lamp would pick out at this size, so this stands a little proud of that.
const STOCK = 0.16, CARD = 0.2;
const MARGIN = 'sticker-vinyl', PER_MM = 4;
// Paper this thin still won't drop into a seam: it goes across, and over a step in about this many css px, or further on a big sheet.
const bridge = (w: number, h: number) => Math.max(14, Math.min(w, h) * 0.35);
const CORNERS: Record<string, [number, number]> = { tl: [-1, -1], tr: [1, -1], br: [1, 1], bl: [-1, 1] };

/** A triangle with its base along the fold, around the fold's middle, running out to a tip along +y. */
const flap = (half: number, tip: number, radius: number, x: number, y: number, rotate: number) =>
  path(polyline([[-half, 0, 0], [half, 0, 0], [0, tip, radius]]), x - half, y - half, half * 2, half * 2, { viewBox: [-half, -half, half * 2, half * 2], rotate, spread: 6 });

/** `<div d-mark="sticker" material lift corner rotate border>`: a thin sheet stuck on, with its text in `color`. `d-mark="sticker card"` is stiff card instead: it lies flat on the highest thing under it and can hang past the edge, and `rim` runs a band of its own material round the outside of `border`, in mm. `path` die-cuts it, and `lift` needs a plain rectangle. `border` is the white margin a die leaves round the print, in mm: what's printed is then ink on the sheet, not the sheet. */
definePart({
  selector: '[d-mark~="sticker"]',
  options: ['card'],
  label: true,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || STICKER, wear = number(p, 'wear', d.wear), lift = Math.min(Math.max(number(p, 'lift', 0), 0), 1);
    const { w, h } = p, span = bridge(w, h), radius = number(p, 'radius', 3), ink = inkOf(p, material), cut = drawn(p), edge = number(p, 'border', 0) * PER_MM, rim = number(p, 'rim', 0) * PER_MM;
    const stock = { material, follow: true, bevel: 0.5, over: { wear: wear * 0.7 } };
    s.group({ at: [p.x + w / 2, p.y + h / 2], rotate: turned(p) }, () => {
      const sheet = cut ?? rect(-w / 2, -h / 2, w, h, { radius });
      if (/\bcard\b/.test(p.el.getAttribute('d-mark') ?? '')) {
        s.surface(grow(sheet, edge + rim), { material: edge && !rim ? MARGIN : material, rest: true, rise: CARD, bevel: 0.3, over: stock.over });
        if (edge && rim) s.surface(grow(sheet, edge), { ...stock, material: MARGIN, bevel: 0.1, rise: 0.02 });
        if (edge) s.surface(sheet, { ...stock, bevel: 0.1, rise: 0.02 });
        s.ground(p.el);
      }
      else if (lift && !cut) {
        // It comes away along a fold across the corner, and curls up towards the tip, which draws it in a little.
        const [sx, sy] = CORNERS[p.el.getAttribute('corner') ?? 'tr'] ?? CORNERS.tr!, leg = Math.min(w, h) * (0.2 + 0.35 * lift), half = leg / Math.SQRT2;
        const x = (sx * (w - leg)) / 2, y = (sy * (h - leg)) / 2, angle = Math.atan2(-sx, sy);
        s.surface(minus(sheet, flap(half, half, 0, x, y, angle)), { ...stock, bridge: span, rise: STOCK });
        s.ground(p.el);
        s.surface(flap(half, half * (1 - 0.2 * lift), radius / 2, x, y, angle), { ...stock, bridge: span, zEdge: STOCK, zTop: STOCK, profile: 'flat', crown: [0, -half * 0.25 * lift] });
      } else if (edge) {
        // One sheet, printed to within its margin: the colour has no edge of its own to catch a light.
        s.surface(grow(sheet, edge), { ...stock, bridge: span, material: MARGIN, rise: STOCK });
        s.surface(sheet, { ...stock, bevel: 0, rise: 0.005 });
        s.ground(p.el);
      } else (s.surface(sheet, { ...stock, bridge: span, rise: STOCK }), s.ground(p.el));
      // Its print is on the sheet, so where the sheet's face has come away the print went with it.
      s.printing(p.el, () => { for (const m of lettered(p)) s.cut(m, { ink, rough: 0.42, wear: wear * 0.5 }); }, true);
    });
  },
});

defineStyles(`
[d-mark~="print"], [d-mark~="sticker"] { display: inline-block; position: relative; }
[d-mark~="print"][path], [d-mark~="sticker"][path] { width: 40px; height: 40px; }
[d-mark~="sticker"] { padding: 6px 10px; }
.d-gl [d-mark~="print"], .d-gl [d-mark~="sticker"] { color: transparent; user-select: none; }
`);
