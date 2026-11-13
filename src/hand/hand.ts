// The pointer as a gloved hand: flat like a system cursor, with fingers on joints so that it moves between grips
// instead of swapping pictures. What it's holding comes from the part under it, so no object has to ask for a grip.
import { getEngine, partOf, type Part } from 'device-ui';

type Point = readonly [x: number, y: number];

// A right hand seen from the back, fingers up, with the middle of the palm at 0,0.
// The thumb starts by the wrist, because that's where a thumb starts: its first bone is inside the hand. `wide` starts at its first knuckle.
const THUMB = { at: [-11, 22] as Point, long: [26, 13, 10], wide: [9.6, 8.4, 7.2] };
// `bow` is how far each joint leans towards the middle finger, since no real finger is straight.
const FINGERS = [
  { at: [-19.5, -19] as Point, long: [15, 10.5, 8], wide: [7.4, 7, 6.5, 5.8], bow: 3 },
  { at: [-4.8, -22] as Point, long: [17, 11.5, 8], wide: [7.5, 7.1, 6.6, 5.9], bow: 1 },
  { at: [9.8, -21] as Point, long: [15.5, 10.5, 8], wide: [7.3, 6.9, 6.4, 5.7], bow: -2 },
  { at: [23, -16] as Point, long: [12, 8.5, 7], wide: [6.5, 6.1, 5.7, 5.1], bow: -5 },
];
// Where the hand stops, and how round the corners of that are.
const WRIST = { left: -19, right: 22, y: 33, round: 7 };

/** Degrees. `turn` is the whole hand. `hold` goes from pinning the tip of the index finger, at 0, to pinning the point between it and the thumb, at 1. */
export interface Pose {
  turn: number;
  hold: number;
  /** Swing, then the bend at each joint in the plane of the hand. */
  thumb: readonly [number, number, number];
  /** Index to little finger. Spread, then how far each joint curls under the hand. */
  fingers: readonly (readonly [number, number, number, number])[];
}

const FOLDED = [[2, 72, 96, 56], [4, 76, 96, 56], [8, 78, 96, 56]] as const;
export const POSES = {
  /** Hanging over nothing, half closed, as a hand is when it's doing nothing. */
  rest: { turn: -10, hold: 0, thumb: [-60, 22, 14], fingers: [[-6, 14, 20, 12], [-2, 16, 22, 12], [3, 20, 24, 14], [9, 24, 26, 14]] },
  /** A key, a link, a screen. */
  point: { turn: -12, hold: 0, thumb: [-50, 24, 16], fingers: [[-3, 0, 6, 4], ...FOLDED] },
  /** The same finger, pushing. */
  push: { turn: -12, hold: 0, thumb: [-50, 24, 16], fingers: [[-3, 24, 38, 18], ...FOLDED] },
  /** Thumb and finger closed on something thin. */
  pinch: { turn: 18, hold: 1, thumb: [-66, 30, 34], fingers: [[-38, 30, 46, 30], [-1, 26, 34, 20], [7, 30, 36, 20], [15, 34, 38, 20]] },
  /** Thumb and fingers open round something as wide as they go. */
  span: { turn: 18, hold: 1, thumb: [-78, 22, 18], fingers: [[-8, 16, 28, 16], [1, 24, 34, 18], [8, 30, 38, 18], [16, 36, 40, 20]] },
} satisfies Record<string, Pose>;

const flat = (p: Pose) => [p.turn, p.hold, ...p.thumb, ...p.fingers.flat()];
const pose = (v: readonly number[]): Pose => ({
  turn: v[0]!, hold: v[1]!, thumb: [v[2]!, v[3]!, v[4]!],
  fingers: [0, 1, 2, 3].map(i => [v[5 + i * 4]!, v[6 + i * 4]!, v[7 + i * 4]!, v[8 + i * 4]!] as const),
});

const RAD = Math.PI / 180;
const n = (v: number) => +v.toFixed(2);
const circle = ([x, y]: Point, r: number) => `M${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x - r)} ${n(y)}Z`;

/** One bone: a circle at each end and the band between them, all wound the same way so that they fill as one shape. */
function bone(a: Point, b: Point, ra: number, rb: number): string {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  if (d < 0.01) return circle(a, Math.max(ra, rb));
  const nx = -dy / d, ny = dx / d;
  const corners: Point[] = [[a[0] + nx * ra, a[1] + ny * ra], [a[0] - nx * ra, a[1] - ny * ra], [b[0] - nx * rb, b[1] - ny * rb], [b[0] + nx * rb, b[1] + ny * rb]];
  return `${circle(a, ra)}${circle(b, rb)}M${corners.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
}

const chain = (joints: readonly Point[], wide: readonly number[]) => joints.slice(1).map((p, i) => bone(joints[i]!, p, wide[i]!, wide[i + 1]!)).join('');

/** Follows a finger out from its knuckle. A joint curled past square comes back towards the palm, which is how it looks from behind. */
function finger(at: Point, long: readonly number[], bow: number, [spread, ...curls]: readonly number[]): Point[] {
  const joints = [at];
  let curl = 0, [x, y] = at;
  long.forEach((l, i) => {
    curl += curls[i]!;
    const seen = l * Math.cos(curl * RAD), lean = (spread! + bow * i) * RAD;
    joints.push([(x += Math.sin(lean) * seen), (y -= Math.cos(lean) * seen)]);
  });
  return joints;
}

/** The thumb moves across the hand, so it stays in the plane of the drawing. */
function thumb([swing, ...bends]: readonly number[]): Point[] {
  const joints = [THUMB.at];
  let angle = swing!, [x, y] = THUMB.at;
  THUMB.long.forEach((l, i) => {
    joints.push([(x += Math.sin(angle * RAD) * l), (y -= Math.cos(angle * RAD) * l)]);
    angle += bends[i] ?? 0;
  });
  return joints;
}

const pt = ([x, y]: Point) => `${n(x)} ${n(y)}`;
const along = (a: Point, way: Point, by: number): Point => [a[0] + way[0] * by, a[1] + way[1] * by];
const back = (way: Point): Point => [-way[0], -way[1]];

/** A curve from `a`, leaving along `from`, to `b`, arriving along `to`. */
const curve = (a: Point, from: Point, b: Point, to: Point, pull = 1 / 3) => {
  const reach = Math.hypot(b[0] - a[0], b[1] - a[1]) * pull;
  return `C${pt(along(a, from, reach))} ${pt(along(b, to, -reach))} ${pt(b)}`;
};

/** The palm and thumb as one line, clockwise from the root of the index finger. The fingers go on top of it. */
function palm(t: readonly Point[], p: Pose): string {
  const lean = (i: number): Point => [Math.sin(p.fingers[i]![0] * RAD), -Math.cos(p.fingers[i]![0] * RAD)];
  const root = (i: number, side: number): Point => along(FINGERS[i]!.at, [-lean(i)[1], lean(i)[0]], side * FINGERS[i]!.wide[0]!);
  const first = root(0, -1), last = root(3, 1), { left, right, y, round } = WRIST, down: Point = [0, 1];

  // Each knuckle of the thumb has a point on either side of it, and the way the thumb is going there.
  const way = t.slice(1).map((j, i): Point => {
    const from = t[i]!, to = t[i + 2] ?? j, d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
  });
  const outer = way.map((w, i) => along(t[i + 1]!, [w[1], -w[0]], THUMB.wide[i]!));
  const inner = way.map((w, i) => along(t[i + 1]!, [-w[1], w[0]], THUMB.wide[i]!));
  const [o0, o1, o2] = outer as [Point, Point, Point], [i0, i1, i2] = inner as [Point, Point, Point];
  const [w0, w1, w2] = way as [Point, Point, Point], tip = THUMB.wide[2]!;
  const heel: Point = [left, y], gap = Math.hypot(o0[0] - left, o0[1] - y), rise: Point = [(o0[0] - left) / gap, (o0[1] - y) / gap];
  const web = along(i0, w0, 6);

  // Across the top it goes a little way up each finger, since an edge lying exactly on the end of a bone leaves a hairline between them.
  return `M${pt(first)}${FINGERS.map((f, i) => `L${pt(along(f.at, lean(i), 4))}`).join('')}L${pt(last)}`
    + curve(last, down, [right, y - round], down, 0.42)
    + `A${round} ${round} 0 0 1 ${right - round} ${y}L${left + round} ${y}Q${pt(heel)} ${pt(along(heel, rise, round))}`
    // The heel and the outside of the thumb are one edge.
    + curve(along(heel, rise, round), rise, o0, w0, 0.4) + curve(o0, w0, o1, w1) + curve(o1, w1, o2, w2)
    + `A${n(tip)} ${n(tip)} 0 0 1 ${pt(i2)}`
    + curve(i2, back(w2), i1, back(w1)) + curve(i1, back(w1), web, back(w0))
    // The web: off the end of the thumb, round, and up the side of the index finger.
    + curve(web, back(w0), first, lean(0), 0.42) + 'Z';
}

/** What a pose draws: the shape of the hand, and what has to sit on the pointer. */
export function drawn(p: Pose): { body: string; hot: Point } {
  const t = thumb(p.thumb), fs = FINGERS.map((f, i) => finger(f.at, f.long, f.bow, p.fingers[i]!));
  const tip = fs[0]![3]!, end = t[3]!;
  const hot: Point = [tip[0] + ((end[0] - tip[0]) / 2) * p.hold, tip[1] + ((end[1] - tip[1]) / 2) * p.hold];
  return { body: palm(t, p) + fs.map((f, i) => chain(f, FINGERS[i]!.wide)).join(''), hot };
}

let gloves = 0;
/** A glove's colours: its face, the shade down its far side, and the line round it. */
export interface GloveColors { face?: string; shade?: string; line?: string }
/** The markup of a hand, without a pose in it yet. The shade is the same shape left showing down its far side, which is all the form a flat hand needs. */
export function glove(size: number, { face = '#fdfcf8', shade = '#c9c4b6', line = '#1d1c20' }: GloveColors = {}): string {
  const id = `d-glove-${gloves++}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-56 -56 112 112" style="display:block;overflow:visible" aria-hidden="true">
<clipPath id="${id}"><path/></clipPath>
<g stroke-linejoin="round"><path fill="none" stroke="${line}" stroke-width="3.6"/><g clip-path="url(#${id})"><path fill="${shade}"/><path fill="${face}" transform="translate(-1.5 -2)"/></g></g></svg>`;
}

/** Puts `p` into the markup `glove` made, with the point that matters at the middle of the drawing. */
export function place(svg: SVGSVGElement, p: Pose): void {
  const { body, hot } = drawn(p);
  svg.querySelector('g')!.setAttribute('transform', `rotate(${n(p.turn)}) translate(${n(-hot[0])} ${n(-hot[1])})`);
  for (const path of svg.querySelectorAll('path')) path.setAttribute('d', body);
}

const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t);

// How far `span` opens, as a share of the hand's size.
const REACH = 0.4;
// A wrist goes so far, so a hand goes some of the way round with what it's turning, in degrees.
const WRIST_FOLLOWS = 0.6, WRIST_TURNS = 34;
const clicked = 'a, button, label, summary, select, [role="button"], [tabindex], input, d-screen';
const typed = 'input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"]), textarea, [contenteditable]';

// Glass that draws its own pointer. A second one on top of it would only get in the way.
const ownPointer = 'd-screen[pointer]';

export const jointOf = (part?: Part) => (part?.def.motion as { joint?: string } | undefined)?.joint;

/** The part with a joint at or above `el`. */
export function moving(el: Element | null): Part | undefined {
  for (; el; el = el.parentElement) {
    const part = partOf(el);
    if (jointOf(part)) return part;
  }
  return undefined;
}

const within = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How to stay on what a press has hold of, if it's something that moves: from where the pointer is to where the hand is, and how far it has turned.
 * The pointer only says what the hand is trying to do. What's in the hand says where it can go, so it stops at the end of a run and goes round a pin.
 */
function holding(el: Element | null, x: number, y: number): ((px: number, py: number) => [x: number, y: number, turned: number]) | null {
  if (el?.matches('d-device[carried]')) {
    const at = el.getBoundingClientRect(), dx = x - at.left, dy = y - at.top;
    return () => {
      const r = el.getBoundingClientRect();
      return [r.left + dx, r.top + dy, 0];
    };
  }
  const part = moving(el), carried = part?.def.carried;
  if (!part || !carried) return null;
  if ((part.def.motion as { seats?: boolean }).seats) return (px, py) => {
    const r = part.el.getBoundingClientRect();
    return [within(px, r.left, r.right), within(py, r.top, r.bottom), 0];
  };
  const a = carried.call(part.def, part), at = part.el.getBoundingClientRect(), k = at.width / part.w || 1;
  const dx = (x - at.left) / k - a.pin[0] - a.x, dy = (y - at.top) / k - a.pin[1] - a.y;
  const { joint, material } = part.def.motion as { joint?: string; material?: string };
  // Nothing on a touch ring moves, and nothing stops a finger going round one. It only keeps the finger on the ring.
  if (joint === 'turn' && material === 'finger-on-glass') {
    if (el?.closest('button')) return null;
    const ring = Math.hypot(dx, dy);
    return (px, py) => {
      const r = part.el.getBoundingClientRect(), s = r.width / part.w || 1, cx = r.left + a.pin[0] * s, cy = r.top + a.pin[1] * s;
      const round = Math.atan2(py - cy, px - cx);
      return [cx + Math.cos(round) * ring * s, cy + Math.sin(round) * ring * s, 0];
    };
  }
  return () => {
    const r = part.el.getBoundingClientRect(), s = r.width / part.w || 1, c = carried.call(part.def, part), turned = c.rotate - a.rotate;
    const cos = Math.cos(turned), sin = Math.sin(turned);
    return [r.left + (c.pin[0] + c.x + dx * cos - dy * sin) * s, r.top + (c.pin[1] + c.y + dx * sin + dy * cos) * s, turned];
  };
}

/** How a hand takes hold of `el`. Wide things it opens round, thin ones it pinches, and the rest it pushes with a finger. */
export function gripFor(el: Element | null, down: boolean, size: number): number[] {
  const part = moving(el), joint = jointOf(part);
  if (joint === 'turn' || joint === 'slide') {
    const box = part!.el.getBoundingClientRect();
    return mix(flat(POSES.pinch), flat(POSES.span), Math.min(1, Math.min(box.width, box.height) / (size * REACH)) * (down ? 0.88 : 1));
  }
  if (part || el?.closest(clicked)) return flat(down ? POSES.push : POSES.point);
  return flat(POSES.rest);
}

// How far past the middle of a pane the lamp waits, as a share of the way to its edge.
const PAST = 1.12;
/** Off the glass and in line with the pointer, because a lamp over a pointer on glass would lay its glare right on it. */
function aside(glass: Element, x: number, y: number): [number, number] {
  const r = glass.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = x - cx, dy = y - cy;
  const k = PAST / Math.max((Math.abs(dx) * 2) / r.width, (Math.abs(dy) * 2) / r.height, 0.01);
  return [cx + dx * k, cy + dy * k];
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const gone = (el: Element | null) => !!el?.closest?.(ownPointer) || (!!el?.closest?.(typed) && !el.closest('d-device'));

/** What a pilot in flight leaves to the real mouse, which sees its own arrow there and the glove doesn't follow. */
export const spared: { el: Element | null } = { el: null };
const beside = (e: PointerEvent) => e.isTrusted && !!spared.el && e.composedPath().includes(spared.el);

const style = (only: string) => `${only ? `.d-handed :is(${only}), .d-handed :is(${only}) *` : '.d-handed, .d-handed *'} { cursor: none !important; }
.d-handed :not(d-device *):is(${typed}) { cursor: text !important; }
.d-handed .d-spared, .d-handed .d-spared * { cursor: auto !important; }
.d-hand { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; will-change: transform; filter: drop-shadow(0 3px 5px rgb(0 0 0 / .32)); }
.d-hand[hidden] { display: none; }`;

/** The pointers a pilot moves its hands with, which no browser hands out. The left one gets a glove of its own, and every other pointer shares the first. */
export const POINTERS = { right: 0x7fff_fff0, left: 0x7fff_fff1 } as const;

let up = false;
/** Puts a gloved hand in place of the pointer, unless one is there. Without a mouse it does nothing, or with `always` it waits for a `pilot`. With `only`, a selector, it's a hand over those and the ordinary pointer everywhere else, though a pilot's hand goes where it likes. `colors` dresses the glove for the page. Returns a function that takes it away. */
export function hand({ size = 136, always = false, only = '', colors = {} as GloveColors } = {}): () => void {
  if (up || typeof matchMedia === 'undefined' || matchMedia('(forced-colors: active)').matches || !(always || matchMedia('(hover: hover) and (pointer: fine)').matches)) return () => {};
  up = true;
  const sheet = document.createElement('style');
  sheet.textContent = style(only);
  document.head.append(sheet);
  document.documentElement.classList.add('d-handed');

  /** One glove and everything it's doing. A left one is the right one in a mirror, so a wrist that follows a turn goes the other way. */
  const make = (left: boolean) => {
    const box = document.createElement('div');
    box.className = 'd-hand';
    box.hidden = true;
    box.innerHTML = glove(size, colors);
    document.body.append(box);
    const svg = box.firstElementChild as unknown as SVGSVGElement, side = left ? -1 : 1;

    let now = flat(POSES.rest), want = now, last = 0, frame = 0, over: Element | null = null, down = false, lamp = false;
    let held: ReturnType<typeof holding> = null, twist = 0;
    // Where the pointer is, where the hand is, and how far apart a hand let go of something still is.
    let px = 0, py = 0, shownX = 0, shownY = 0, gapX = 0, gapY = 0;

    const show = (x: number, y: number) => {
      shownX = x;
      shownY = y;
      box.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)${left ? ' scaleX(-1)' : ''}`;
    };
    const step = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (held) {
        const [x, y, turned] = held(px, py);
        show(x, y);
        twist = within((turned / RAD) * WRIST_FOLLOWS, -WRIST_TURNS, WRIST_TURNS) * side;
      } else if (gapX || gapY) {
        const keep = reduced() ? 0 : Math.exp(-dt * 18);
        gapX *= keep;
        gapY *= keep;
        if (Math.hypot(gapX, gapY) < 0.5) gapX = gapY = 0;
        show(px + gapX, py + gapY);
      }
      const goal = want.map((v, i) => (i ? v : v + twist));
      now = mix(now, goal, reduced() ? 1 : 1 - Math.exp(-dt * 20));
      place(svg, pose(now));
      frame = held || gapX || gapY || now.some((v, i) => Math.abs(v - goal[i]!) > 0.05) ? requestAnimationFrame(step) : 0;
    };
    const aim = (next: number[]) => {
      want = next;
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const move = (e: PointerEvent) => {
      const el = e.target as Element;
      const glass = (down ? over : el)?.closest?.(ownPointer);
      const on = down ? over : el;
      box.hidden = gone(on) || (!!only && e.isTrusted && !on?.closest?.(only));
      if (glass || lamp) {
        lamp = !!glass;
        getEngine().lampHeld = lamp;
        if (glass) getEngine().aim(...aside(glass, e.clientX, e.clientY));
      }
      px = e.clientX;
      py = e.clientY;
      if (!held) show(px + gapX, py + gapY);
      if (!down) over = el;
      aim(gripFor(over, down, size));
    };
    const press = (e: PointerEvent) => {
      down = true;
      over = e.target as Element;
      px = e.clientX;
      py = e.clientY;
      held = holding(over, px, py);
      aim(gripFor(over, true, size));
    };
    const free = (e: PointerEvent) => {
      down = false;
      if (held) {
        held = null;
        twist = 0;
        gapX = shownX - e.clientX;
        gapY = shownY - e.clientY;
      }
      move(e);
    };
    const remove = () => {
      cancelAnimationFrame(frame);
      if (lamp) getEngine().lampHeld = false;
      box.remove();
    };
    place(svg, pose(now));
    return { move, press, free, remove, hide: () => (box.hidden = true) };
  };

  const gloves = new Map<boolean, ReturnType<typeof make>>([[false, make(false)]]);
  const of = (e: PointerEvent) => {
    const left = e.pointerId === POINTERS.left;
    let g = gloves.get(left);
    if (!g) gloves.set(left, (g = make(left)));
    return g;
  };
  const mouse = (e: PointerEvent) => e.pointerType === 'mouse' && !beside(e);

  const off = new AbortController(), o = { signal: off.signal, capture: true, passive: true };
  addEventListener('pointermove', e => mouse(e) && of(e).move(e), o);
  addEventListener('pointerdown', e => mouse(e) && of(e).press(e), o);
  for (const n of ['pointerup', 'pointercancel']) addEventListener(n, e => !beside(e as PointerEvent) && of(e as PointerEvent).free(e as PointerEvent), o);
  // A pilot's second hand leaves the page this way when it's done with it.
  document.documentElement.addEventListener('pointerleave', e => of(e).hide(), { signal: off.signal });
  return () => {
    up = false;
    off.abort();
    for (const g of gloves.values()) g.remove();
    sheet.remove();
    document.documentElement.classList.remove('d-handed');
  };
}
