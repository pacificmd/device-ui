// What a wound spring drives: a rod swinging on a pin to count time, and the key that winds it.
import { circle, definePart, defineStyles, FOCUS, MM, poly, rect, slide, swing, together, turn, type GroupOptions, type Part } from 'device-ui';
import { controlStyles, num } from 'device-ui/controls/shared';

defineStyles(`${controlStyles('[d-pendulum]', '[d-wheel~="key"]')}
.d-gl [d-pendulum] input { pointer-events: none; }`);

const RAD = Math.PI / 180, ROD = 3.8, WEIGHT_W = 18, WEIGHT_H = 14.5;

/** The marks on the rod, top first: each one's beats a minute and how far it is down the box in mm. */
const marksOf = (p: Part) => (p.el.getAttribute('marks') ?? '60:10,120:20').split(',').map(m => m.split(':').map(Number) as [number, number]);
const first = (p: Part) => marksOf(p)[0]![1], last = (p: Part) => marksOf(p).at(-1)![1];
const pivotOf = (p: Part): [number, number] => [num(p, 'x', p.w / MM / 2), num(p, 'pivot', p.h / MM)];
const reachOf = (p: Part) => num(p, 'reach', pivotOf(p)[1]);
const degrees = (p: Part) => num(p, 'swing', 26);
const notch = (p: Part) => (p.el.querySelector('input') as HTMLInputElement).valueAsNumber;

const rod = swing({
  mass: 30, return: 0.001, friction: 0.6, material: 'steel-on-steel', sound: 'knock',
  beats: p => marksOf(p)[notch(p)]?.[0] ?? 60,
  accepts: (p, e) => !onWeight(p, e) && Math.abs(inFrame(p, e)[0]) < 6,
});
const weight = slide({
  input: 0, axis: 'y', mass: 40, material: 'steel-on-steel',
  travel: p => last(p) - first(p),
  marks: p => marksOf(p).map(([, y]) => (y - first(p)) / (last(p) - first(p))),
  accepts: (p, e) => onWeight(p, e),
});
/** How far down the box the weight's top edge is, mm. */
const weightAt = (p: Part) => first(p) + (last(p) - first(p)) * weight.value(p);
const angleOf = (p: Part) => rod.angle(p) * degrees(p) * RAD;

/** A pointer in the rod's own frame: across it and up it from the pin, mm. */
function inFrame(p: Part, e: MouseEvent): [number, number] {
  const r = p.el.getBoundingClientRect(), k = r.width / p.w, [px, py] = pivotOf(p), a = angleOf(p);
  const x = (e.clientX - r.left) / k / MM - px, y = (e.clientY - r.top) / k / MM - py;
  return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];
}
function onWeight(p: Part, e: MouseEvent) {
  const [x, y] = inFrame(p, e), top = weightAt(p) - pivotOf(p)[1];
  return Math.abs(x) < WEIGHT_W / 2 + 1 && y > top - 1 && y < top + WEIGHT_H + 1;
}

// A rod on a pin below it, going from side to side, with a weight clipped to it that sets how fast. Two inputs: a range for which mark the weight is on and a checkbox for whether it's going.
// `marks` is beats a minute and mm down the box for each, top first, which is how an uneven scale reads. The weight's top edge is what points at them. `x` and `pivot` place the pin in mm, `reach` is the rod's length, and `swing` its degrees each way.
// Set it going with a click on the rod. `wound` is the seconds of spring left, or it runs for ever. `height` is how far the rod stands off what it's on, in mm. Put what hides its foot after it.
definePart({
  selector: '[d-pendulum]',
  local: MM,
  live: ['wound'],
  ...together(weight, rod),
  tick: rod.tick,
  paint(s, p) {
    const steel = p.el.getAttribute('material') || 'polished-steel', metal = p.el.getAttribute('weight') || 'satin-steel', z = num(p, 'height', 10);
    const [px, py] = pivotOf(p), L = reachOf(p), top = first(p) - py, w = WEIGHT_W / 2, h = WEIGHT_H;
    // The weight is drawn on the top mark, and its joint carries it down the rod from there: straight down, which is down the rod while it hangs still.
    const along: GroupOptions = { at: [0, weight.carried(p).y / MM], carried: true };
    s.group({ at: [px, py], rotate: angleOf(p) }, () => {
      s.surface(rect(-ROD / 2, -L, ROD, L + 4, { radius: 0.3 }), { material: steel, zEdge: z, zTop: z + 0.5, bevel: 0.25 });
      // One notch in the rod's edges for each mark, which is what the weight's clip catches on.
      for (const [, y] of marksOf(p)) s.cut(rect(-ROD / 2, y - py - 1.2, ROD, 0.45), { depth: 0.25 });
      s.group(along, () => {
        s.surface(poly([[-w, top, 0.2], [w, top, 0.2], [w - 0.7, top + 0.9, 0.3], [w - 2.4, top + h, 1.4], [2.4 - w, top + h, 1.4], [0.7 - w, top + 0.9, 0.3]], { spread: 1 }), { material: metal, zEdge: z + 0.5, zTop: z + 2.2, bevel: 0.5, profile: 'chamfer' });
        for (const x of [-2.5, 2.5]) s.cut(rect(x - 0.2, top, 0.4, 10, { radius: 0.2 }), { depth: 0.5 });
        s.surface(rect(-ROD / 2 + 0.1, top + 0.8, ROD - 0.2, 2.4, { radius: 0.6 }), { material: 'gloss-white', zEdge: z + 2.2, zTop: z + 2.9, bevel: 0.4 });
        for (const x of [-5.3, 5.3]) {
          s.surface(circle(x, top + 5, 1.8), { material: 'chrome', zEdge: z + 2.2, zTop: z + 2.7, bevel: 0.5 });
          s.cut(circle(x, top + 5, 0.7), { depth: 0.4 });
        }
      });
    });
    if (p.focused) s.group(along, () => s.glow(rect(px - w - 1, py + top - 1, w * 2 + 2, h + 2, { radius: 1 }), FOCUS));
  },
});

// All mm. The shaft comes out of the side, so from the front the thumbpiece goes round towards and away from you and only ever gets taller and shorter.
const COLLAR = 1.6, THUMB = 5, THUMB_THICK = 1.5;

// A winding key seen from the front, coming out of the side of a case: a collar, a shaft, and a flat thumbpiece across the end of it. Drag up or down to wind it, one way only, against its pawl.
// The box starts at the side of the case and is as tall as the thumbpiece. A range holds the angle, 0 to 360.
definePart({
  selector: '[d-wheel~="key"]',
  local: MM,
  ...turn({ mass: 8, material: 'brass-on-steel', sound: 'crown', input: true, rolled: true, wrap: true, ratchet: 1, stops: { at: [0, 360] }, travel: p => p.h * 4 }),
  paint(s, p) {
    const a = p.springs.turn!.value, w = p.w / MM, h = p.h / MM, cy = h / 2, material = p.el.getAttribute('material') || 'brass', r = h * 0.17;
    s.surface(rect(0, cy - r * 1.7, COLLAR, r * 3.4, { radius: 0.3 }), { material, zEdge: -2, zTop: 1.4, bevel: 0.5 });
    s.surface(rect(COLLAR, cy - r, w - COLLAR - THUMB / 2, r * 2), { material, profile: 'flat', zEdge: -1, zTop: 1, crown: [0, r], over: { tangent: 0 } });
    const half = Math.max((h / 2) * Math.abs(Math.cos(a)) + (THUMB_THICK / 2) * Math.abs(Math.sin(a)), THUMB_THICK / 2), lift = (h / 2) * Math.sin(a) * 0.3;
    s.surface(rect(w - THUMB, cy - half, THUMB, half * 2, { radius: 0.6 }), { material, zEdge: lift - 0.6, zTop: lift + 1.6, bevel: 0.6 });
    if (p.focused) s.glow(rect(0, 0, w, h, { radius: 1 }), FOCUS);
  },
});
