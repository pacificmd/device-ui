// Bench instruments.
import { circle, definePart, defineStyles, FOCUS, input, MM, path, poly, rect, setValue, spring, turn } from 'device-ui';
import { controlStyles, num } from 'device-ui/controls/shared';
import 'device-ui/materials';

defineStyles(`${controlStyles('[d-knob~="selector"]')}
[d-port~="banana"], [d-port~="binding"] { display: block; }
[d-meter~="timer"] { display: block; pointer-events: none; }
[d-port~="bnc"] { display: block; position: relative; }
[d-port~="bnc"] input { position: absolute; inset: 0; margin: 0; width: 100%; height: 100%; }
.d-gl [d-port~="bnc"] input { opacity: 0; cursor: pointer; }
`);

// A panel-mounted BNC socket. The checkbox says whether a cable is plugged in.
definePart({
  selector: '[d-port~="bnc"]',
  springs: { plug: spring({ mass: 40, return: 0.26, friction: 0.36, material: 'brass-on-steel', sound: 'plug' }) },
  update(p) {
    p.springs.plug!.set(p.el.querySelector('input')?.checked ? 1 : 0);
  },
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2 - 2, t = p.springs.plug!.value;
    s.surface(circle(cx, cy, R), { material: 'brushed-steel', bevel: 2, zEdge: 0, zTop: 1.1, over: { aniso: 0 } });
    for (const side of [-1, 1]) {
      s.surface(rect(cx + side * R * 0.74 - 3, cy - 2, 6, 4, { radius: 1.5 }), { material: 'chrome', bevel: 1, zEdge: 1.1, zTop: 2.1 });
    }
    s.surface(circle(cx, cy, R * 0.68), { material: 'chrome', bevel: 1.6, zEdge: 1.1, zTop: 3.8, over: { rough: 0.22 } });
    s.surface(circle(cx, cy, R * 0.47), { material: 'plastic-white', bevel: 1, zEdge: 3.8, zTop: 2.2 });
    s.surface(circle(cx, cy, R * 0.15), { material: 'gold', profile: 'dome', zEdge: 2.2, zTop: 3.4 });
    if (t > 0.01) {
      const top = 3.8 + t * 6;
      s.surface(circle(cx, cy, R * 0.95, { ripple: [28, 0.5] }), { material: 'chrome', bevel: 2, zEdge: 1.1, zTop: top, over: { rough: 0.3 } });
      s.surface(circle(cx, cy, R * 0.56), { material: 'black-oxide', profile: 'dome', zEdge: top, zTop: top + 2.4 });
    }
    if (p.focused) s.glow(circle(cx, cy, R + 2), [1, 0.72, 0.2], 3);
  },
});

const wafer = turn({
  mass: 15, input: true, detents: { strength: 0.9 }, stops: { at: p => [num(p, 'from', -135), num(p, 'to', 135)] },
  tap(p, e) {
    const el = input(p), box = p.el.getBoundingClientRect();
    setValue(el, el.valueAsNumber + (e.clientX < box.left + box.width * 0.45 ? -1 : 1) * (+el.step || 1));
  },
});

// A meter's function switch: a low disc with a bar moulded right across it, its long end past the rim and a white line let into the tip. The ribs run with the bar.
// A wafer switch, so it snaps between its positions, from `from` to `to` degrees clockwise of straight up. A press on either side of the middle clicks it one that way.
// The box is the sweep of the bar's tip. `size` is how much of that the disc fills, `ribs` the mm between ribs, 0 for none, and `height` and `grip` how far disc and bar stand, in mm.
definePart({
  selector: '[d-knob~="selector"]',
  ...wafer,
  paint(s, p, d) {
    const reach = Math.min(p.w, p.h) / 2, R = reach * num(p, 'size', 0.91), material = p.el.getAttribute('material') || 'plastic-black';
    const rise = num(p, 'height', 2.6), top = rise + num(p, 'grip', 6), pitch = num(p, 'ribs', 1) * MM, hw = 0.14 * reach, tip = 0.75 * hw, tail = 0.8 * reach;
    const bar = `M${-tip} ${-reach}H${tip}L${hw} ${tail - hw}Q${hw} ${tail} 0 ${tail}Q${-hw} ${tail} ${-hw} ${tail - hw}Z`;
    s.well(circle(p.x + reach, p.y + reach, R + 0.5 * MM), 0.8, { bevel: 1.5 });
    s.group(wafer.place(p), () => {
      s.surface(circle(0, 0, R), { material, bevel: 0.9 * MM, zEdge: -0.8, zTop: rise, over: { wear: d.wear * 0.4 } });
      if (pitch) {
        for (let x = hw + pitch / 2; x < R - 1.2 * MM; x += pitch) {
          const half = Math.sqrt((R - 1.1 * MM) ** 2 - x * x);
          for (const side of [-1, 1]) s.cut(rect(side * x - 0.17 * MM, -half, 0.34 * MM, half * 2), { depth: 0.22 });
        }
      }
      s.surface(path(bar, -reach, -reach, reach * 2, reach * 2, { viewBox: [-reach, -reach, reach * 2, reach * 2], spread: 10 }), {
        material, profile: 'chamfer', bevel: 1 * MM, zEdge: rise, zTop: top, over: { wear: d.wear * 0.6 },
      });
      s.cut(rect(-0.6 * MM, -reach + 0.9 * MM, 1.2 * MM, 5 * MM, { radius: 1 }), { depth: 0.05, ink: [0.82, 0.82, 0.8] });
    });
    if (p.focused) s.glow(circle(p.x + reach, p.y + reach, R + 2), FOCUS);
  },
});

// The two hands of an interval timer, on one shaft: a sweep hand going round once a minute, and under it a minute hand going round once an hour. `value` is the time showing, in seconds.
// The box is the sweep of the long hand's tip. `reach` is how far the minute hand gets, of that. `width` is the hands at the hub in mm, `height` how far they stand off the dial in mm, and `lume` paints their outer ends, in that material.
// Hands don't take a pointer: set them through whatever turns the shaft, and go after the scale and before any knob on the shaft.
const TAU = Math.PI * 2;
const timerHand = { mass: 3, return: 0.05, friction: 0.7 };
definePart({
  selector: '[d-meter~="timer"]',
  springs: { sweep: spring(timerHand), minute: spring(timerHand) },
  live: ['value'],
  update(p) {
    const v = num(p, 'value', 0);
    p.springs.sweep!.set((v / 60) * TAU);
    p.springs.minute!.set((v / 3600) * TAU);
  },
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2, steel = p.el.getAttribute('material') || 'satin-steel', lume = p.el.getAttribute('lume') || 'lume';
    const w = num(p, 'width', 4.2) * MM, z = num(p, 'height', 5), over = { rough: 0.45 };
    const blade = (len: number, from: number, wide: number, narrow: number, r: number) => {
      const at = (k: number) => wide + (narrow - wide) * k, a = at(from) / 2, b = narrow / 2;
      return poly([[-a, -len * from, 0], [a, -len * from, 0], [b, -len, r], [-b, -len, r]], { spread: 2 });
    };
    const hand = (angle: number, len: number, bottom: number, narrow: number, painted: number, pin: boolean) => s.group({ at: [p.x + R, p.y + R], rotate: angle }, () => {
      s.surface(blade(len, 0, w, narrow, narrow * 0.2), { material: steel, bevel: 0.3 * MM, zEdge: bottom, zTop: bottom + 0.5, over });
      s.surface(blade(len, painted, w, narrow, narrow * 0.2), { material: lume, bevel: 0.2 * MM, zEdge: bottom + 0.5, zTop: bottom + 0.6 });
      if (pin) s.surface(rect(-narrow * 0.5, -len - 0.2 * MM, narrow * 1.1, 0.7 * MM), { material: steel, bevel: 0.2 * MM, zEdge: bottom + 0.5, zTop: bottom + 1.7, over });
    });
    hand(p.springs.minute!.value, R * num(p, 'reach', 0.97), z, w * 0.72, 0.79, false);
    hand(p.springs.sweep!.value, R, z + 1, w * 0.8, 0.66, true);
  },
});

// A shrouded 4mm socket, as a meter's leads go in: a black collar standing proud, and in it a coloured insert round a deep hole with a brass contact down it. `material` is the insert.
definePart({
  selector: '[d-port~="banana"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    s.surface(circle(cx, cy, R), { material: 'rubber', profile: 'round', bevel: R * 0.26, zEdge: 0, zTop: 1.8 });
    s.surface(circle(cx, cy, R * 0.68), { material: 'well', bevel: R * 0.05, zEdge: 1.8, zTop: 0.6 });
    s.surface(circle(cx, cy, R * 0.6), { material: p.el.getAttribute('material') || 'plastic-red', bevel: R * 0.08, zEdge: 0.6, zTop: 1 });
    s.surface(circle(cx, cy, R * 0.38), { material: 'well', bevel: R * 0.05, zEdge: 1, zTop: -7 });
    s.surface(circle(cx, cy, R * 0.24), { material: 'brass', bevel: 0.6, zEdge: -7, zTop: -5.5 });
    s.surface(circle(cx, cy, R * 0.15), { material: 'well', bevel: 0.6, zEdge: -5.5, zTop: -9 });
  },
});

// A binding post from above: a stem standing `height` mm with a knurled head you screw down on a wire. The box is the head.
definePart({
  selector: '[d-port~="binding"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'brass', top = num(p, 'height', 14);
    s.surface(circle(cx, cy, R, { ripple: [Math.round((R / MM) * 8), 0.5] }), { material, zEdge: top - 3, zTop: top, bevel: 1.5 });
    s.surface(circle(cx, cy, R * 0.72), { material, zEdge: top, zTop: top + 0.5, bevel: 1.2, radial: true });
  },
});
