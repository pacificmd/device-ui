// Hand tools: what folds out of a handle on a pin, what pulls out of a slot in one, the ring they hang from, the crank you wind and the screws that hold it all together.
import { arc, circle, definePart, defineStyles, FOCUS, hinge, intersect, minus, MM, poly, rect, ring, setValue, slide, spring, text, turn, type Part, type Point } from 'device-ui';
import { words } from 'device-ui/controls/key';
import { controlStyles, num } from 'device-ui/controls/shared';

defineStyles(`[d-tool~="blade"], [d-tool~="pull"], [d-fixing~="ring"], [d-fixing~="eyelet"], [d-fixing~="socket"] { display: block; }
${controlStyles('[d-wheel~="crank"]')}
.d-gl [d-wheel~="crank"] input { pointer-events: none; }`);

const RAD = Math.PI / 180, TAU = Math.PI * 2;

/** The box is the blade shut, tang to tip, with the pin a blade's half width in from the top. */
const pin = (p: { w: number }) => [p.w * 0.47, p.w * 0.5] as [number, number];
const blade = hinge({ at: pin, stops: { at: [0, 180] }, mass: 14, friction: 0.5, material: 'steel-on-steel' });

// A spear blade on a pin. It lies along its box and swings half a turn in the plane of the face, back first, and the
// handle closes over it. Ground from a line down the middle to the edge, with a nick for a nail by the back. `stamp` is
// what's struck in the tang, with `|` between lines, reading from the tip.
definePart({
  selector: '[d-tool~="blade"]',
  ...blade,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', rise = num(p, 'height', 0.9);
    const [ax, ay] = pin(p), w = p.w, L = p.h - ay, back = -ax, edge = w - ax, tang = L * 0.21;
    const shape = poly([
      [back, -ay, w * 0.36], [edge, -ay, w * 0.44], [edge, tang - 2, 1.5], [edge - 2, tang + 2, 3],
      [edge - 2, L * 0.68, w * 2.4], [w * 0.1, L, 1], [back, L * 0.76, w * 2.6],
    ] satisfies Point[], { spread: 40 });
    const ridge = w * 0.02;
    s.group(blade.place(p), () => {
      s.surface(shape, { material, rise, bevel: edge - ridge, profile: 'blend' });
      s.surface(intersect(shape, rect(back - 1, -ay - 1, ridge - back + 1, L + ay + 2)), { material, rise, bevel: 0.6 });
      s.surface(intersect(shape, rect(back - 1, -ay - 1, w + 2, tang + ay + 1)), { material, rise, bevel: 0.7 });
      s.cut(poly([[back + 5, L * 0.58, 8], [back + 9, L * 0.68, 2], [back + 5, L * 0.82, 8], [back + 3, L * 0.7, 2]]), { depth: 0.4, soft: 1, rough: 0.2 });
      (p.el.getAttribute('stamp') ?? '').split('|').filter(Boolean).forEach((line, i) => {
        const h = 4.6;
        s.engrave(text(line, back + 4, tang - 3 - h * (i + 1), w - 8, h, { font: `600 ${h - 0.8}px Arial, sans-serif`, rotate: Math.PI }), 0.05, { soft: 0.3 });
      });
    });
  },
});

const pull = slide({ axis: 'y', travel: p => num(p, 'travel', 20), mass: 3, friction: 0.4, material: 'steel-on-steel', detents: { count: 2 }, click: true });

// A slim tool living in a slot, which draws out past the end of its box. `d-tool="pull tweezers"`, or `pull pick` for a tapered stick.
// `end` is the radius of its head in mm, so it can take the curve of the handle it finishes.
definePart({
  selector: '[d-tool~="pull"]',
  options: ['tweezers', 'pick'],
  ...pull,
  paint(s, p) {
    const pick = words(p, 'd-tool').includes('pick'), material = p.el.getAttribute('material') || (pick ? 'keycap-ivory' : 'satin-steel');
    const { w, h } = p, rise = num(p, 'height', 0.7), mid = w / 2, end = num(p, 'end', 0.3) * 4;
    s.group(pull.place(p), () => {
      s.surface(pick
        ? poly([[mid, 0, 0.3], [w * 0.8, h * 0.3, 8], [w * 0.8, h - w * 0.8, 1], [w, h - w * 0.6, 1], [w, h, end], [0, h, end], [0, h - w * 0.6, 1], [w * 0.2, h - w * 0.8, 1], [w * 0.2, h * 0.3, 8]], { spread: 12 })
        : poly([[mid - 1.6, 0, 1], [mid + 1.6, 0, 1], [w * 0.84, h * 0.7, 10], [w, h - 2, 2], [w, h, end], [0, h, end], [0, h - 2, 2], [w * 0.16, h * 0.7, 10]], { spread: 12 }),
      { material, rise, bevel: 1 });
      if (!pick) s.cut(rect(mid - 0.3, 0, 0.6, h * 0.72), { depth: 0.7, soft: 0.2 });
    });
  },
});

// A split ring, two turns of flat wire seen from above, filling its box. `from` and `to` are degrees clockwise from the
// right, for a ring that passes through something: draw it twice, either side of what it goes through.
definePart({
  selector: '[d-fixing~="ring"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', rise = num(p, 'height', 0.8), R = p.w / 2, cx = p.x + R, cy = p.y + R, wire = 3.4;
    const from = num(p, 'from', 0) * RAD, to = num(p, 'to', 360) * RAD;
    const turn = (x: number, y: number, r: number, width: number) => (to - from >= TAU - 0.001 ? ring(circle(x, y, r), width) : arc(x, y, r - width / 2, from, to, width));
    s.surface(turn(cx, cy, R, wire), { material, rise: rise * 0.7, bevel: 1 });
    s.surface(turn(cx - 1.6, cy + 1.2, R, wire * 0.9), { material, rise, bevel: 1 });
  },
});

// A flat tab of steel with a hole through it, standing out of whatever it's riveted into. Its hole is at the far end of its box.
definePart({
  selector: '[d-fixing~="eyelet"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', rise = num(p, 'height', 0.5), R = p.h / 2, hole = p.el.hasAttribute('hole') ? num(p, 'hole', 0) * MM : R * 0.55;
    s.group({ at: [p.x + p.w / 2, p.y + R], rotate: (num(p, 'rotate', 0) * RAD) }, () => {
      const x = p.w / 2 - R;
      s.surface(minus(rect(-p.w / 2, -R, p.w, p.h, { radius: R }), circle(x, 0, hole)), { material, rise, bevel: 0.8 });
    });
  },
});

// A socket head sunk in a steel collar, as a shell is screwed together from the front.
definePart({
  selector: '[d-fixing~="socket"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'aluminium-pale', hole = p.el.hasAttribute('hole') ? num(p, 'hole', 0) * MM : R * 0.26;
    s.surface(circle(cx, cy, R), { material, zEdge: -0.4, zTop: 0.05, bevel: R * 0.16 });
    s.surface(circle(cx, cy, hole * 1.35), { material, profile: 'chamfer', zEdge: 0.05, zTop: -0.3, bevel: hole * 0.35 });
    s.surface(circle(cx, cy, hole), { material: 'well', zEdge: -0.3, zTop: -1.4, bevel: 0.5 });
  },
});

// All mm. The shaft runs out sideways, so seen from the front the arm swings towards and away from you and only ever moves up and down.
const SHAFT = 4.8, SHAFT_OUT = 5.4, ARM = 2.4, ARM_WIDE = 9, GRIP = 15, GRIP_WIDE = 8.4, GRIP_THICK = 5;
// How far the shaft sits under the face, in a case it comes out of the side of, and how far under the case the grip's hinge goes when folded.
const AXLE = -4.5, TUCK = 4;
const inputs = (p: Part) => p.el.querySelectorAll('input');
const isOut = (p: Part) => inputs(p)[1]!.checked;
const reachOf = (p: Part) => num(p, 'reach', 22);
const pivotOf = (p: Part) => num(p, 'pivot', p.h / MM / 2);

/** Where the arm is drawn, for this much folded out, 0 to 1. */
const armAt = (f: number) => -ARM + 1.2 + f * (SHAFT_OUT + ARM - 1.2);

const setOut = (p: Part, out: boolean) => {
  const box = inputs(p)[1]!;
  if (box.checked === out) return;
  box.checked = out;
  for (const n of ['input', 'change']) box.dispatchEvent(new Event(n, { bubbles: true }));
};

const handle = turn({
  mass: 5, material: 'ball-bearing', input: true, wrap: true, hubless: true, stops: { at: [0, 360] },
  at: p => [0, pivotOf(p) * MM],
  travel: p => reachOf(p) * MM * Math.PI * 2,
  // Folded, a press anywhere on it will do. Out, it's the shaft or the grip, wherever the grip has got to.
  accepts(p, e) {
    if (!isOut(p)) return true;
    const r = p.el.getBoundingClientRect(), k = r.width / p.w, x = (e.clientX - r.left) / k / MM, y = (e.clientY - r.top) / k / MM, py = pivotOf(p);
    return (x < SHAFT_OUT + ARM + 2 && Math.abs(y - py) < SHAFT + 3) || Math.abs(y - (py - reachOf(p) * Math.cos(p.springs.turn!.value))) < GRIP_WIDE;
  },
  // A hand pulling on it folded brings it out, as a press does.
  hold(p, radians) {
    if (isOut(p)) return false;
    p.data.pulled = ((p.data.pulled as number | undefined) ?? 0) + Math.abs(radians);
    if ((p.data.pulled as number) > 0.15) setOut(p, true);
    return true;
  },
  tap: p => setOut(p, !isOut(p)),
});

// A crank on a shaft coming out of the side of a case, turned round and round. Two inputs: a range holds the angle from 0 to 360, 0 with the arm laid up the side, and a checkbox whether it's folded out.
// A hand goes round the shaft, and how far it is to the right of it stands for how far the grip has come towards you.
// Folding it away takes the arm home first. `reach` is the arm and `pivot` the shaft's height in the box, both mm. The box starts at the side of the case and has to take the swing.
definePart({
  selector: '[d-wheel~="crank"]',
  layer: -1,
  local: MM,
  ...handle,
  springs: { ...handle.springs, fold: spring({ mass: 4, material: 'steel-on-steel' }) },
  update(p) {
    handle.update(p);
    if (isOut(p)) p.data.pulled = 0;
    p.springs.fold!.set(isOut(p) ? 1 : 0);
  },
  connect(p) {
    const ac = new AbortController(), { signal } = ac, [angle, box] = inputs(p);
    const holdStill = (e: Event) => {
      if (isOut(p)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    box!.addEventListener('change', () => {
      if (!box!.checked) setValue(angle!, 0);
    }, { signal });
    angle!.addEventListener('keydown', e => {
      if (e.key.startsWith('Arrow')) holdStill(e);
    }, { signal, capture: true });
    p.el.addEventListener('wheel', holdStill, { signal, capture: true, passive: false });
    const off = handle.connect(p);
    return () => {
      ac.abort();
      off();
    };
  },
  paint(s, p) {
    const f = Math.max(Math.min(p.springs.fold!.value, 1), 0), a = p.springs.turn!.value, c = Math.cos(a), n = Math.sin(a);
    const grip = p.el.getAttribute('material') || 'plastic-yellow', steel = p.el.getAttribute('arm') || 'aluminium-pale';
    const R = reachOf(p), py = pivotOf(p), x = armAt(f), lift = num(p, 'depth', 0.35);
    // The arm's corners, as they fall on the view.
    const ys = [[-ARM_WIDE / 2, -1], [-ARM_WIDE / 2, 1], [R + ARM_WIDE / 2, -1], [R + ARM_WIDE / 2, 1]].map(([r, t]) => -r! * c + t! * (ARM_WIDE / 2) * n);
    const top = Math.min(...ys), low = Math.max(...ys), near = AXLE + (Math.max(0, R * n) + (ARM_WIDE / 2) * Math.abs(c)) * lift;
    if (f > 0.01) {
      s.surface(rect(-2, py - SHAFT, x + 2 + ARM * 0.5, SHAFT * 2, { radius: 0.5 }), { material: steel, zEdge: AXLE - SHAFT, zTop: AXLE + SHAFT, bevel: SHAFT * 0.5 });
      const hx = x + ARM - (1 - f) * TUCK, hy = py - R * c, hz = AXLE + R * n * lift, half = (GRIP_WIDE / 2) * Math.abs(n) + (GRIP_THICK / 2) * Math.abs(c);
      s.group({ at: [hx, hy], rotate: (1 - f) * Math.PI * 0.5 }, () => {
        s.surface(rect(0, -half, GRIP, half * 2, { radius: 1.4 }), { material: grip, zEdge: hz - half, zTop: hz + half * 0.5, bevel: half * 0.7 });
      });
    }
    s.surface(rect(x, py + top, ARM, low - top, { radius: 0.9 }), { material: steel, zEdge: AXLE - ARM_WIDE / 2, zTop: near, bevel: 0.7 });
    if (p.focused) s.glow(rect(0, py - SHAFT - 1, x + ARM + 1, SHAFT * 2 + 2, { radius: 1 }), FOCUS);
  },
});
