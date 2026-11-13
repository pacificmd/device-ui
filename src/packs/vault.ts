// Strongroom hardware.
import { capsule, circle, definePart, defineStyles, input, rect, spring, turn, type Part } from 'device-ui';
import { controlStyles, polar } from 'device-ui/controls/shared';

defineStyles(`
${controlStyles('[d-wheel~="spoke"]')}
[d-vault~="door"] { display: block; }
`);

const BOLTS = 10;
const brushed = { aniso: 0.75, grain: [0, 1, 1] as [number, number, number] };

// The door in its frame. `open` runs from 0, bolts home, to 1, bolts drawn in.
definePart({
  selector: '[d-vault~="door"]',
  springs: { bolts: spring({ mass: 5000, return: 0.077, friction: 0.68, material: 'steel-on-steel' }) },
  live: ['open'],
  update(p) {
    p.springs.bolts!.set(+(p.el.getAttribute('open') ?? 0));
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, t = p.springs.bolts!.value;
    const each = (fn: (a: number, i: number) => void, n = BOLTS, offset = Math.PI / BOLTS) => {
      for (let i = 0; i < n; i++) fn(offset + (i * Math.PI * 2) / n, i);
    };
    const bolt = (a: number, tip: number, w: number, l: number, grow = 0) => {
      const [x, y] = polar(cx, cy, tip - l / 2, a);
      return rect(x - w / 2 - grow, y - l / 2 - grow, w + grow * 2, l + grow * 2, { rotate: a, radius: 3 });
    };
    s.surface(circle(cx, cy, R), { material: 'brushed-steel', radial: true, bevel: 9, zEdge: 0, zTop: 3.4, over: { ...brushed, wear: d.wear * 0.7 } });
    each(a => s.surface(bolt(a, R * 0.968, 40, R * 0.12), { material: 'well', bevel: 1.5, zEdge: 3.4, zTop: -1 }));
    s.surface(circle(cx, cy, R * 0.872), { material: 'well', bevel: 2.5, zEdge: 3.4, zTop: -2.4 });
    const tip = R * (0.958 - 0.17 * t);
    each(a => s.surface(bolt(a, tip, 34, R * 0.2), { material: 'chrome', bevel: 15, zEdge: -2, zTop: 3.8, over: { rough: 0.2 } }));
    s.surface(circle(cx, cy, R * 0.846), { material: 'brushed-steel', radial: true, profile: 'chamfer', bevel: 13, zEdge: -2, zTop: 7, over: { ...brushed, wear: d.wear * 0.5 } });
    each(a => {
      const [x, y] = polar(cx, cy, R * 0.79, a);
      s.surface(circle(x, y, 7), { material: 'black-oxide', bevel: 1.5, zEdge: 7, zTop: 6.5 });
      s.surface(circle(x, y, 5.6), { material: 'brushed-steel', profile: 'dome', zEdge: 6.5, zTop: 8.2, over: { aniso: 0, rough: 0.28 } });
    }, 28, 0);
    s.surface(circle(cx, cy, R * 0.742), { material: 'black-oxide', bevel: 6, zEdge: 7, zTop: 0.4 });
    s.surface(circle(cx, cy, R * 0.722), { material: 'cast-iron', bevel: 1.5, zEdge: 0.4, zTop: 0, over: { wear: d.wear } });
  },
});

const handle = turn({
  mass: 1600, material: 'steel-on-steel', input: true, stops: { at: [0, 360] },
  hold(p, by) {
    if (!p.el.hasAttribute('locked')) return false;
    const strain = Math.max(-0.09, Math.min(0.09, ((p.data.strain as number | undefined) ?? 0) + by * 0.2));
    p.data.strain = strain;
    p.springs.turn!.set(strain);
    return true;
  },
  letGo(p) {
    p.data.strain = 0;
    if (p.el.hasAttribute('locked')) p.springs.turn!.set(0);
  },
});

// A handle of five spokes. Held by the lock it gives a little and comes back.
definePart({
  selector: '[d-wheel~="spoke"]',
  ...handle,
  update(p) {
    if (!p.el.hasAttribute('locked') || +input(p).value > 0) handle.update(p);
  },
  paint(s, p: Part) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, a = p.springs.turn!.value;
    s.surface(circle(cx, cy, R * 0.42), { material: 'black-oxide', bevel: 4, zEdge: 0, zTop: 2 });
    for (let i = 0; i < 5; i++) {
      const t = a + (i * Math.PI * 2) / 5, [x, y] = polar(cx, cy, R * 0.8, t);
      s.surface(capsule(cx, cy, x, y, R * 0.105, R * 0.066), { material: 'chrome', zEdge: 2, zTop: 9, over: { rough: 0.2 } });
      s.surface(circle(x, y, R * 0.17), { material: 'chrome', profile: 'dome', zEdge: 4, zTop: 12, over: { rough: 0.18 } });
    }
    s.surface(circle(cx, cy, R * 0.3), { material: 'brushed-steel', radial: true, profile: 'chamfer', bevel: 6, zEdge: 6, zTop: 12, over: { ...brushed, rough: 0.3 } });
    const [mx, my] = polar(cx, cy, R * 0.2, a);
    s.cut(rect(mx - 1.5, my - R * 0.06, 3, R * 0.12, { rotate: a, radius: 1 }), { depth: 0.2, ink: [0.02, 0.02, 0.02] });
  },
});
