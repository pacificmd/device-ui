// The features round controls are built from, each drawn once, in real millimetres. Draw them inside
// `s.group({ ..., scale: MM })` round the part's centre, so a feature keeps its size in mm whatever the part's.
import { capsule, circle, poly, rect, type Point, type Sheet, type Solid, type SurfaceOptions, type Vec3 } from 'device-ui';
import { polar } from './shared.js';

/** How the side of something you turn is made to grip. */
export type Grip = 'smooth' | 'knurled' | 'ribbed' | 'fluted' | 'lobed';

/**
 * Each grip as it's cut, mm: `pitch` from one rib to the next round the rim, `depth` from crest to valley, and `wave` the
 * section of each: a knurl is rolled into sharp vees, flutes are scooped out with lands left between, and moulded ribs are soft.
 * Lobes are counted, not pitched: a lobed knob has a handful whatever its size, and they're as deep as a share of its radius.
 */
export const GRIPS: Record<Grip, { pitch: number; depth: number; wave: 'ripple' | 'vee' | 'scoop'; count?: number; share?: number }> = {
  smooth: { pitch: 0, depth: 0, wave: 'ripple' },
  // A straight knurl on a turned aluminium knob, 0.8mm pitch. Guess, from photos against a ruler.
  knurled: { pitch: 0.8, depth: 0.22, wave: 'vee' },
  // Moulded ribs on a plastic instrument knob, about 1.6mm apart. Guess.
  ribbed: { pitch: 1.6, depth: 0.35, wave: 'ripple' },
  // Wide scallops for fingers, as on a bakelite radio knob, 4–5mm apart. Guess.
  fluted: { pitch: 4.5, depth: 0.7, wave: 'scoop' },
  // Seven deep lobes, as on a big amp or tuning knob. Guess, from photos.
  lobed: { pitch: 0, depth: 0, wave: 'ripple', count: 7, share: 0.13 },
};

export const isGrip = (v: string | null): v is Grip => !!v && v in GRIPS;

/** The outline of a round side `r` mm out with `grip` cut in it, or `count` ribs in place of what the grip's pitch gives. */
export function gripped(r: number, grip: Grip, count = 0): Solid {
  const g = GRIPS[grip];
  if (grip === 'smooth') return circle(0, 0, r);
  const n = count || g.count || Math.max(6, Math.round((Math.PI * 2 * r) / g.pitch));
  return circle(0, 0, r, { [g.wave]: [n, g.share ? r * g.share : g.depth] });
}

/** What shows a control's position. */
export type Indicator = 'line' | 'dot' | 'arrow' | 'slot' | 'none';

export const isIndicator = (v: string | null): v is Indicator => v === 'line' || v === 'dot' || v === 'arrow' || v === 'slot' || v === 'none';

/**
 * The mark on a face `r` mm in radius, pointing up, printed `depth` mm into it in `ink`. A line runs in from
 * near the rim, a dot sits near it, an arrow points out from it, and a slot is a groove right across, as on an encoder's stem.
 * `emit` lights it, as an LED behind it does.
 */
export function indicator(s: Sheet, kind: Indicator, r: number, ink: Vec3, o: { emit?: Vec3; depth?: number; wear?: number } = {}): void {
  const look = { depth: o.depth ?? 0.08, ink, emit: o.emit, wear: o.wear };
  // Printed or filled marks are about 0.8mm wide, and a dot 1.6mm across: the size a finger feels and an eye finds. Guess.
  if (kind === 'line') s.cut(capsule(0, -(r - 0.9), 0, -Math.max(r * 0.35, r - 0.9 - Math.max(r * 0.5, 3)), 0.4, 0.4), look);
  else if (kind === 'dot') s.cut(circle(0, -r * 0.68, Math.min(0.8, r * 0.12)), look);
  else if (kind === 'slot') s.cut(capsule(0, -r * 0.6, 0, r * 0.6, r * 0.18, r * 0.18), { ...look, depth: o.depth ?? 0.25, soft: 0.5 });
  else if (kind === 'arrow') {
    const tip = r - 0.8, w = Math.min(1.4, r * 0.18);
    s.cut(poly([[0, -tip, 0], [w, -tip + w * 1.6, 0], [-w, -tip + w * 1.6, 0]] as Point[]), look);
  }
}

/** Where a printed ring of marks goes: `sweep` degrees each side of straight up, clockwise from up as `polar` counts. */
export const swept = (i: number, n: number, sweep: number) => (n > 1 ? -sweep + (2 * sweep * i) / (n - 1) : 0) * (Math.PI / 180);

/**
 * A ring of `ticks` printed on a mask round `cx`, `cy`, css px, from `inner` to `outer`, every `major`th one longer
 * and heavier, and `labels` set `gap` px beyond them. Returns how far the print reaches from the middle, on its widest axis.
 */
export function printRing(ctx: OffscreenCanvasRenderingContext2D, cx: number, cy: number, o: { inner: number; outer: number; ticks: number; major?: number; sweep: number; labels?: string[]; gap?: number; font?: string }): number {
  const major = o.major ?? 5;
  ctx.lineCap = 'butt';
  for (let i = 0; i < o.ticks; i++) {
    const a = swept(i, o.ticks, o.sweep), big = i % major === 0;
    const [x0, y0] = polar(cx, cy, big ? o.inner : o.inner + (o.outer - o.inner) * 0.35, a), [x1, y1] = polar(cx, cy, o.outer, a);
    ctx.lineWidth = big ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  let over = 0;
  if (o.labels?.length) {
    if (o.font) ctx.font = o.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const at = o.outer + (o.gap ?? 0), size = +(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 11);
    o.labels.forEach((label, i) => {
      if (!label) return;
      const a = swept(i, o.labels!.length, o.sweep), [x, y] = polar(cx, cy, at + size * 0.6, a);
      ctx.fillText(label, x, y);
      over = Math.max(over, Math.abs(x - cx) + ctx.measureText(label).width / 2, Math.abs(y - cy) + size / 2);
    });
  }
  return Math.ceil(over);
}

/** How far a ring `reach` px out from the middle stands past a box `w` × `h` px round it, on its widest side. */
export const overhang = (reach: number, w: number, h: number) => Math.ceil(Math.max(0, reach - Math.min(w, h) / 2));

/**
 * A six-sided nut, `flats` mm across its flats, `tall` mm high from `z`. Its corners are rounded by the chamfer
 * a nut is turned with.
 */
export function hexNut(s: Sheet, flats: number, z: number, tall: number, material = 'satin-steel'): void {
  const r = flats / Math.sqrt(3);
  const corners = Array.from({ length: 6 }, (_, i): Point => [r * Math.sin((i * Math.PI) / 3 + Math.PI / 6), r * Math.cos((i * Math.PI) / 3 + Math.PI / 6), 0.3]);
  s.surface(poly(corners, { spread: flats * 0.04 }), { material, bevel: Math.min(0.5, tall * 0.25), zEdge: z, zTop: z + tall, profile: 'chamfer' });
}

/** A round nut `d` mm across with a knurled rim, as holds a toggle or jack where a spanner won't fit. */
export function ringNut(s: Sheet, d: number, z: number, tall: number, material = 'chrome'): void {
  s.surface(gripped(d / 2, 'knurled'), { material, bevel: Math.min(0.4, tall * 0.25), zEdge: z, zTop: z + tall, profile: 'chamfer', over: { rough: 0.22 } });
}

/** A threaded bush `d` mm across standing `tall` mm from `z`, with the hole down its middle `hole` mm across. */
export function bushing(s: Sheet, d: number, z: number, tall: number, o: { hole?: number; material?: string } = {}): void {
  s.surface(circle(0, 0, d / 2), { material: o.material ?? 'chrome', bevel: 0.3, zEdge: z, zTop: z + tall, over: { rough: 0.22 } });
  if (o.hole) s.surface(circle(0, 0, o.hole / 2), { material: 'well', bevel: 0.15, zEdge: z + tall, zTop: z });
}

/** A round collar, a ring `d` mm across with a `wall` mm rim, standing `tall` mm, with its middle a well down to `z`. */
export function collar(s: Sheet, d: number, wall: number, z: number, tall: number, material = 'chrome'): void {
  s.surface(circle(0, 0, d / 2), { material, bevel: Math.min(wall * 0.6, tall), zEdge: z, zTop: z + tall, over: { rough: 0.24 } });
  s.surface(circle(0, 0, d / 2 - wall), { material: 'well', bevel: Math.min(wall * 0.4, 0.6), zEdge: z + tall, zTop: z });
}

/** The gap a round part turns in, cut into the panel round it: `d` mm across and `clear` mm wider, `depth` mm down. */
export function seat(s: Sheet, d: number, o: { clear?: number; depth?: number } = {}): void {
  const clear = o.clear ?? 0.3;
  s.surface(circle(0, 0, d / 2 + clear), { material: 'well', bevel: clear, zEdge: 0, zTop: -(o.depth ?? 0.4) });
}

const ring = (n: number, r: number, turn = 0): Point[] => Array.from({ length: n }, (_, i): Point => [r * Math.sin(turn + (i * Math.PI * 2) / n), -r * Math.cos(turn + (i * Math.PI * 2) / n), 0]);

/** The outline of a bezel or what it holds: a circle `w` mm across, or a `w` × `h` rectangle with `radius` corners. */
const outline = (w: number, h: number, round: boolean, radius: number) => (round ? circle(0, 0, w / 2) : rect(-w / 2, -h / 2, w, h, { radius }));

/**
 * A bezel: the rim that holds a lens, a dial or a lamp in a panel. `w` mm across outside, or `w` × `h` with `square`,
 * with `wall` mm of rim. It stands `height` mm proud, rounded over, or with `flush` is let in level and only chamfered into the
 * opening. The opening is a well down to `floor`, mm. Returns the opening, mm across, to draw what it holds in.
 */
export function bezel(s: Sheet, o: { w: number; h?: number; square?: boolean; wall: number; height?: number; flush?: boolean; radius?: number; floor?: number; material?: string; over?: SurfaceOptions['over'] }): { w: number; h: number } {
  const h = o.h ?? o.w, round = !o.square, radius = o.radius ?? 1, height = o.flush ? 0.15 : o.height ?? 2, wall = o.wall;
  const w2 = o.w - wall * 2, h2 = h - wall * 2;
  s.surface(outline(o.w, h, round, radius), {
    material: o.material ?? 'chrome', profile: o.flush ? 'chamfer' : 'round', bevel: o.flush ? wall * 0.6 : wall * 1.2, zEdge: 0, zTop: height, over: o.over,
  });
  s.surface(outline(w2, h2, round, Math.max(radius - wall, 0.2)), { material: 'well', bevel: 0.25, zEdge: height - 0.2, zTop: o.floor ?? height * 0.3 });
  return { w: w2, h: h2 };
}

/** What a lens is cut like. */
export type Lens = 'dome' | 'flat' | 'jewel' | 'fresnel';
export const isLens = (v: string | null): v is Lens => v === 'dome' || v === 'flat' || v === 'jewel' || v === 'fresnel';

/**
 * A lens `r` mm in radius sitting on `z`, standing `height` mm. A dome swells, a flat one is a plain window, a jewel is cut in
 * facets round a flat table, as on a panel indicator, and a fresnel is flat with its curve stepped down into rings.
 */
export function lens(s: Sheet, kind: Lens, r: number, z: number, o: { height?: number; material?: string; over?: SurfaceOptions['over'] } = {}): void {
  const material = o.material ?? 'glass-red', over = o.over, height = o.height ?? Math.min(r * 0.6, 2.2);
  if (kind === 'dome') s.surface(circle(0, 0, r), { material, profile: 'dome', zEdge: z - 0.2, zTop: z + height, over });
  else if (kind === 'flat') s.surface(circle(0, 0, r), { material, profile: 'flat', bevel: 0.2, zEdge: z + height * 0.3, zTop: z + height * 0.3, over });
  else if (kind === 'jewel') {
    // Two rows of facets: eight round the girdle, and eight more set between them up to the table. Guess, from panel jewels.
    s.surface(poly(ring(8, r, Math.PI / 8)), { material, profile: 'chamfer', bevel: r * 0.45, zEdge: z, zTop: z + height * 0.7, over });
    s.surface(poly(ring(8, r * 0.62)), { material, profile: 'chamfer', bevel: r * 0.3, zEdge: z + height * 0.6, zTop: z + height, over });
  } else {
    // Rings about 0.5mm apart, as on a moulded indicator lens. Guess.
    const n = Math.max(2, Math.round(r / 0.5)), tooth = Math.min(0.3, height * 0.3);
    for (let i = 0; i < n; i++) {
      const ri = r * (1 - i / n);
      s.surface(circle(0, 0, ri), { material, profile: 'chamfer', bevel: r / n, zEdge: z, zTop: z + tooth, over });
    }
  }
}

/**
 * Ticks along a straight line from `a` to `b` on a mask, css px, each running `length` out to one `side` of it, and every `major`th
 * one long, the rest `minor` long. `labels`, if any, go on the major ticks, `gap` px out on the other side. Returns how far the
 * print reaches from the line, either way.
 */
export function printScale(ctx: OffscreenCanvasRenderingContext2D, a: [number, number], b: [number, number], o: { ticks: number; length: number; minor?: number; major?: number; side?: 1 | -1; width?: number; labels?: string[]; gap?: number }): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, side = o.side ?? 1, major = o.major ?? 5;
  const nx = (-dy / len) * side, ny = (dx / len) * side;
  ctx.lineCap = 'butt';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let reach = o.length, label = 0;
  for (let i = 0; i < o.ticks; i++) {
    const t = i / Math.max(o.ticks - 1, 1), x = a[0] + dx * t, y = a[1] + dy * t, long = i % major === 0, l = long ? o.length : o.minor ?? o.length * 0.6;
    ctx.lineWidth = (o.width ?? 1) * (long ? 1.4 : 1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + nx * l, y + ny * l);
    ctx.stroke();
    const text = long ? o.labels?.[label++] : undefined;
    if (text) {
      const g = o.gap ?? 4, size = +(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 11);
      ctx.fillText(text, x - nx * (g + size / 2), y - ny * (g + size / 2));
      reach = Math.max(reach, g + size);
    }
  }
  return reach;
}

/** What a pointer is cut like. */
export type Needle = 'bar' | 'lance' | 'spade' | 'baton';
export const isNeedle = (v: string | null): v is Needle => v === 'bar' || v === 'lance' || v === 'spade' || v === 'baton';

/**
 * A pointer `length` mm from its pivot at the middle, pointing up, with `tail` mm behind the pivot. A bar tapers to a narrow tip,
 * a lance to a point, a spade carries a leaf near its tip, and a baton is a flat bar with round ends. `width` is at the pivot.
 * `hub` caps the pivot with a dome that many mm in radius. It stands from `z` to `z + tall`.
 */
export function needle(s: Sheet, kind: Needle, length: number, o: { tail?: number; width?: number; z?: number; tall?: number; material?: string; over?: SurfaceOptions['over']; hub?: number; hubMaterial?: string } = {}): void {
  const tail = o.tail ?? length * 0.2, w = (o.width ?? Math.min(Math.max(length * 0.05, 0.6), 2)) / 2, z = o.z ?? 1.5, top = z + (o.tall ?? 0.5);
  const look = { material: o.material ?? 'needle', zEdge: z, zTop: top, bevel: Math.min(w * 0.6, 0.3), over: o.over };
  if (kind === 'baton') s.surface(capsule(0, tail, 0, -length, w, w), look);
  else if (kind === 'lance') s.surface(poly([[-w, tail, 0], [0, -length, 0], [w, tail, 0]]), look);
  else {
    const tip = Math.max(w * 0.2, 0.1);
    s.surface(poly([[-w, tail, 0], [-tip, -length, 0], [tip, -length, 0], [w, tail, 0]]), look);
    if (kind === 'spade') {
      const at = length * 0.78, leaf = Math.max(w * 2.6, 1);
      s.surface(poly([[0, -at - leaf * 1.6, 0], [leaf, -at, 0], [0, -at + leaf * 0.9, 0], [-leaf, -at, 0]]), look);
    }
  }
  if (o.hub) s.surface(circle(0, 0, o.hub), { material: o.hubMaterial ?? 'black-oxide', profile: 'dome', zEdge: z - 0.5, zTop: top + o.hub * 0.4 });
}

/** A screw's head, by the standard it's made to, and what turns it. */
export type ScrewHead = 'pan' | 'countersunk' | 'button' | 'cheese';
export type Drive = 'slot' | 'cross' | 'hex' | 'star';
export type ScrewSize = 'M2' | 'M3' | 'M4';
export const isScrewHead = (v: string | null): v is ScrewHead => v === 'pan' || v === 'countersunk' || v === 'button' || v === 'cheese';
export const isDrive = (v: string | null): v is Drive => v === 'slot' || v === 'cross' || v === 'hex' || v === 'star';
export const isScrewSize = (v: string | null): v is ScrewSize => v === 'M2' || v === 'M3' || v === 'M4';

/**
 * Each size's heads as [across, tall] in mm, and its drives across: the slot's width, the cross's span, the hex key's flats and
 * the star's points. Spec: ISO 1580 pan, ISO 2009 countersunk, ISO 7380 button, ISO 1207 cheese, with PH0/1/2, hex 1.3/2/2.5
 * and T6/T10/T20. The M2 button head is a guess, as ISO 7380 starts at M3.
 */
export const SCREWS: Record<ScrewSize, { heads: Record<ScrewHead, [number, number]>; slot: number; cross: number; hex: number; star: number }> = {
  M2: { heads: { pan: [4, 1.3], countersunk: [3.8, 1.2], button: [3.5, 1.1], cheese: [3.8, 1.3] }, slot: 0.5, cross: 1.9, hex: 1.3, star: 1.75 },
  M3: { heads: { pan: [5.6, 1.8], countersunk: [5.5, 1.65], button: [5.7, 1.65], cheese: [5.5, 2] }, slot: 0.8, cross: 3, hex: 2, star: 2.74 },
  M4: { heads: { pan: [8, 2.4], countersunk: [8.4, 2.2], button: [7.6, 2.2], cheese: [7, 2.6] }, slot: 1.2, cross: 4.4, hex: 2.5, star: 3.86 },
};

/**
 * A screw head at the middle, as it shows from the front: `head` of `size` with its `drive` turned `angle` radians. A countersunk
 * head lies flush and the rest stand their height. `sunk` mm sets it down a counterbore that deep.
 */
export function screwHead(s: Sheet, o: { head?: ScrewHead; size?: ScrewSize; drive?: Drive; angle?: number; sunk?: number; material?: string; over?: SurfaceOptions['over'] }): void {
  const head = o.head ?? 'pan', size = SCREWS[o.size ?? 'M3'], drive = o.drive ?? 'slot', [across, tall] = size.heads[head], r = across / 2, sunk = o.sunk ?? 0;
  if (sunk) s.surface(circle(0, 0, r + 0.25), { material: 'well', bevel: 0.25, zEdge: 0, zTop: -sunk });
  const base = -sunk, top = head === 'countersunk' ? base + 0.05 : base + tall, material = o.material ?? 'satin-steel', over = { rough: 0.3, ...o.over };
  if (head === 'countersunk') s.surface(circle(0, 0, r), { material, profile: 'flat', bevel: 0.15, zEdge: base - 0.2, zTop: top, radial: true, over });
  else if (head === 'button') s.surface(circle(0, 0, r), { material, profile: 'dome', zEdge: base, zTop: top, radial: true, over });
  else if (head === 'cheese') s.surface(circle(0, 0, r), { material, profile: 'chamfer', bevel: 0.25, zEdge: base, zTop: top, radial: true, over });
  else s.surface(circle(0, 0, r), { material, profile: 'round', bevel: r * 0.45, zEdge: base, zTop: top, crown: tall * 0.15, radial: true, over });
  const cut = { depth: Math.min(tall * 0.5, 1), ink: [0.06, 0.06, 0.062] as Vec3, rough: 0.6, soft: 0.5 }, turn = o.angle ?? 0;
  s.group({ at: [0, 0], rotate: turn }, () => {
    if (drive === 'slot') s.cut(rect(-r, -size.slot / 2, r * 2, size.slot), cut);
    else if (drive === 'cross') {
      const l = size.cross / 2, w = size.cross * 0.11;
      s.cut(capsule(-l, 0, l, 0, w, w), cut);
      s.cut(capsule(0, -l, 0, l, w, w), cut);
      s.cut(circle(0, 0, w * 2.2), cut);
    } else if (drive === 'hex') s.cut(poly(ring(6, size.hex / Math.sqrt(3), Math.PI / 6)), cut);
    else s.cut(circle(0, 0, size.star / 2, { ripple: [6, size.star * 0.14] }), cut);
  });
}

/** How a keycap's top is hollowed: not at all, across like a trough, or all round like a bowl. */
export type Dish = 'flat' | 'cylindrical' | 'spherical';
export const isDish = (v: string | null): v is Dish => v === 'flat' || v === 'cylindrical' || v === 'spherical';

/**
 * How each row of a sculpted board leans and stands, top row first: degrees the top faces you, and mm taller than the home row.
 * Guess, from an OEM-profile set side on.
 */
export const ROWS: [tilt: number, rise: number][] = [[10, 1.2], [5, 0.5], [0, 0], [-6, 0.3]];

/** How a legend is put on a cap. Pad print sits on top and rubs off; two-shot is moulded through and never goes; laser darkens it; engraved is cut in and filled. */
export type Legend = 'pad' | 'twoshot' | 'laser' | 'engraved';
export const isLegend = (v: string | null): v is Legend => v === 'pad' || v === 'twoshot' || v === 'laser' || v === 'engraved';

/** What a legend made by `process` is, as a cut in `ink`, with `wear` from the device. */
export function legendLook(process: Legend, ink: Vec3, wear = 0): { depth: number; ink: Vec3; rough?: number; wear?: number; soft?: number } {
  if (process === 'twoshot') return { depth: 0, ink, wear: 0 };
  if (process === 'laser') return { depth: 0.02, ink: ink.map(v => v * 0.6) as Vec3, rough: 0.7, wear: wear * 0.1 };
  if (process === 'engraved') return { depth: 0.18, ink, soft: 0.25, wear: wear * 0.2 };
  return { depth: 0.04, ink, wear: wear * 0.6 };
}

/** A family of mechanical keycaps, each cut to one set of sizes. */
export type KeyProfile = 'cherry' | 'oem' | 'sa' | 'dsa' | 'xda';
export const isKeyProfile = (v: string | null): v is KeyProfile => !!v && v in PROFILES;

/**
 * Each profile at 1u, mm: `height` of the home-row cap from its foot, `top` across its top where the foot is 18, how its top is
 * dished and how deep, and `sculpt`, how much of the row sculpt in `ROWS` it takes: 0 for a uniform set, where every row is the
 * same cap. Guess, from makers' side drawings: Cherry is low and cylindrical, SA tall and spherical, XDA flat with a wide top.
 */
export const PROFILES: Record<KeyProfile, { height: number; top: number; dish: Dish; depth: number; sculpt: number }> = {
  cherry: { height: 7.8, top: 12.4, dish: 'cylindrical', depth: 0.6, sculpt: 1 },
  oem: { height: 9.2, top: 12.2, dish: 'cylindrical', depth: 0.7, sculpt: 1 },
  sa: { height: 11.9, top: 12.7, dish: 'spherical', depth: 1, sculpt: 2 },
  dsa: { height: 7.6, top: 12.7, dish: 'spherical', depth: 0.8, sculpt: 0 },
  xda: { height: 9.1, top: 15.6, dish: 'spherical', depth: 0.6, sculpt: 0 },
};

/**
 * A keycap `w` × `h` mm at the middle: a skirt `skirt` mm wide falling from its top to its foot, and a top hollowed by `dish`,
 * `depth` mm deep. `row` sculpts it as that row of a board, 1 at the top, leaning its top and standing it taller, `sculpt` times
 * as much as `ROWS` says. Its foot is at `z` and its top at `z + height`.
 */
export function keycap(s: Sheet, w: number, h: number, o: { height: number; z?: number; dish?: Dish; depth?: number; row?: number; sculpt?: number; skirt?: number; radius?: number; material: string; over?: SurfaceOptions['over'] }): void {
  const k = o.sculpt ?? 1, [lean, rise] = o.row && k ? ROWS[Math.min(Math.max(o.row, 1), ROWS.length) - 1]!.map(v => v * k) as [number, number] : [0, 0];
  const z = o.z ?? 0, depth = o.depth ?? 0.6, dish = o.dish ?? 'cylindrical', skirt = o.skirt ?? Math.min(w, h) * 0.14;
  s.surface(rect(-w / 2, -h / 2, w, h, { radius: o.radius ?? 1 }), {
    material: o.material, profile: 'chamfer', bevel: skirt, zEdge: z, zTop: z + o.height + rise,
    dish: dish === 'flat' ? 0 : dish === 'cylindrical' ? [depth, 0] : depth,
    tilt: [0, 2 * Math.tan((lean * Math.PI) / 180) * (h / 2 - skirt)], over: o.over,
  });
}

/** A cap of `profile` on a foot `w` × `h` mm, scaled from its 18mm foot, standing `height` (its own unless said) from `z`. */
export function profiledCap(s: Sheet, profile: KeyProfile, w: number, h: number, o: { z?: number; height?: number; row?: number; dish?: Dish; material: string; over?: SurfaceOptions['over'] }): void {
  const f = PROFILES[profile], skirt = (Math.min(w, h) * (18 - f.top)) / 36;
  keycap(s, w, h, { z: o.z, height: o.height ?? f.height, dish: o.dish ?? f.dish, depth: f.depth, row: o.row, sculpt: f.sculpt, skirt: Math.max(skirt, 0.6), material: o.material, over: o.over });
}

/** A laptop's low cap on a scissor, in a hole `w` × `h` mm: flat topped, 1mm proud, with 1mm of travel. Guess, from a side photo. */
export function lowCap(s: Sheet, w: number, h: number, down: number, material: string, over?: SurfaceOptions['over']): void {
  keycap(s, w - 0.6, h - 0.6, { material, z: -0.2, height: 1.1 - down, dish: 'flat', skirt: 0.4, radius: 1, over });
}
