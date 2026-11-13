// Gamepads and handhelds: the shoulder rockers and triggers, the lit button in the middle, rubber pills and the switch on the top edge.
import { circle, definePart, defineStyles, FOCUS, MM, path, poly, press, rect, slide, turn, type Part, type Point, type Vec3 } from 'device-ui';
import { key, legend, words } from 'device-ui/controls/key';
import { controlStyles, ground, num, nums } from 'device-ui/controls/shared';

defineStyles(`
${controlStyles('[d-slider~="trigger"]', '[d-slider~="edge"]', '[d-wheel~="edge"]')}
[d-key~="bumper"], [d-key~="guide"], [d-key~="pill"] { display: block; }
`);

const FLOOR = -3.5;
const WHITE: Vec3 = [0.86, 0.86, 0.84];
const tilt = (p: Part, left: boolean) => ((left ? -1 : 1) * num(p, 'angle', 33) * Math.PI) / 180;

/** How big a moulded bumper is, mm. */
export const BUMPER_W = 33, BUMPER_H = 17;
const BUMPER: Point[] = [[0.4, 13, 2], [7.4, 4, 9], [16, 0.4, 7], [24, 0.2, 5], [29, 2.2, 4], [33, 4.5, 2], [33, BUMPER_H, 0], [0.4, BUMPER_H, 0]];
/** A moulded bumper's outline, mm, for a shell that wants its shadow and edge to run round it too. */
export const bumperLine = (dx: number, flip: boolean) => BUMPER.map(([x, y, r]) => [flip ? dx + BUMPER_W - x : dx + x, y, r ?? 0] as Point);
const BUMPERS = { left: poly(bumperLine(0, false), { spread: 8 }), right: poly(bumperLine(0, true).reverse(), { spread: 8 }) };

const push = press({ mass: 3 });

// A rocker on the shoulder, tucked under the edge of the shell. `d-key="bumper left"` or `"bumper right"`.
// Plain, it's a straight bar set at an angle. `moulded` follows the shoulder, drawn in millimetres.
definePart(key('[d-key~="bumper"]', {
  ...push,
  options: ['left', 'right'],
  cap: 'soft-touch-black',
  own: true,
  draw(s, p, d, k) {
    const left = !words(p).includes('right'), material = k.cap, down = push.value(p);
    if (p.el.hasAttribute('moulded')) {
      s.group({ at: [p.x, p.y], scale: MM }, () => s.surface(BUMPERS[left ? 'left' : 'right'], { material, rise: 5.5 - 1.4 * down, bevel: 6 }));
      return;
    }
    const shape = rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 3.75) * MM, rotate: tilt(p, left) });
    s.surface(shape, { material, bevel: num(p, 'bevel', 1.75) * MM, zEdge: FLOOR, zTop: 0.6 - 1.6 * down });
    legend(s, p, material, { depth: 0.05 });
    k.focus(shape);
  },
}));

// An analog trigger behind the rocker. It travels with a drag and springs back on release.
definePart({
  selector: '[d-slider~="trigger"]',
  ...slide({ input: 0, name: 'pull', mass: 11, return: 0.5, seat: 0.5, axis: 'y', travel: 20, stops: { landing: 'soft' } }),
  paint(s, p) {
    const t = p.springs.pull!.value, dy = t * 9, left = p.el.getAttribute('side') === 'left', dir = left ? 1 : -1;
    const shape = rect(p.x + dir * dy * 0.5, p.y + dy, p.w, p.h, { radius: 18, rotate: tilt(p, left) });
    s.surface(shape, { material: 'gloss-black', bevel: 10, zEdge: FLOOR, zTop: -0.6 - 1.5 * t });
    if (p.focused) s.glow(shape, FOCUS);
  },
});

// The button in the middle: smoked black, with `logo`, an SVG path on a 2 by 2 box round 0, lit from behind while it's on.
definePart(key('[d-key~="guide"]', {
  ...push,
  label: false,
  local: MM,
  live: ['aria-pressed'],
  draw(s, p) {
    const D = p.w / MM, R = D / 2, C = R, on = p.el.getAttribute('aria-pressed') === 'true', down = 0.5 * push.value(p), logo = p.el.getAttribute('logo');
    s.well(circle(C, C, R), 0.5, { bevel: 0.25 });
    s.surface(circle(C, C, R - 0.4), { material: 'gloss-black', follow: true, zEdge: 0.5 - down, zTop: 1.4 - down, bevel: 1.2, crown: 0.2 });
    if (logo) s.cut(path(logo, C - R + 0.6, C - R + 0.6, D - 1.2, D - 1.2, { viewBox: nums(p, 'viewbox', [-1, -1, 2, 2]) as [number, number, number, number], spread: 1 }), { ink: on ? [1, 1, 1] : WHITE, soft: 0.12, ...(on ? { emit: [1.4, 1.4, 1.35] as Vec3 } : {}) });
  },
}));

const pill = press({ mass: 1.6, material: 'rubber-on-plastic' });

// A rubber pill coming up through a slot in a shallow dish in the shell. It fills its box before `rotate`, degrees.
definePart(key('[d-key~="pill"]', {
  ...pill,
  label: false,
  cap: 'rubber',
  own: true,
  draw(s, p, d, k) {
    const material = k.cap, hw = p.w / 2, hh = p.h / 2, lip = 5, down = pill.value(p);
    const box = (g: number) => rect(-hw - g, -hh - g, p.w + 2 * g, p.h + 2 * g, { radius: hh + g });
    s.group({ at: [p.x + hw, p.y + hh], rotate: (num(p, 'rotate', 0) * Math.PI) / 180 }, () => {
      s.cut(box(lip), { depth: 0.7, soft: lip });
      s.well(box(0), 1, { bevel: 1 });
      s.surface(box(-0.6), { material, bevel: hh * 0.5, zEdge: -1.8, zTop: 0.1 - 0.9 * down, over: { touch: d.age * 0.6 } });
      k.focus(box(lip));
    });
  },
}));

const edge = slide({
  input: 0, mass: 5, friction: 0.45, detents: true, contact: 'toggle', click: true, travel: p => (p.w / MM) * 0.5,
});

const EDGE_RIBS = 56;
const wheel = turn({
  mass: 3, material: 'rubber-on-plastic', input: true, rolled: 'x', ticks: 360 / EDGE_RIBS,
  stops: { at: p => [0, num(p, 'turns', 2) * 360] }, travel: p => num(p, 'turns', 2) * Math.PI * p.w,
});

// A knurled wheel with most of itself behind the edge of a case, rolled along that edge with a thumb. `angle` is how far the edge slopes, degrees.
definePart({
  selector: '[d-wheel~="edge"]',
  layer: -1,
  ...wheel,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'anodised-graphite', w = p.w / 2, h = p.h / 2, phase = p.springs.turn!.value;
    s.group({ at: [p.x + w, p.y + h], rotate: (num(p, 'angle', 0) * Math.PI) / 180 }, () => {
      s.surface(rect(-w, -h, w * 2, h * 2, { radius: 1 }), { material, bevel: h * 0.7, zEdge: -3.4, zTop: -0.4 });
      for (let i = 0; i < EDGE_RIBS; i++) {
        const t = (i / EDGE_RIBS) * Math.PI * 2 + phase;
        if (Math.cos(t) < 0.15) continue;
        s.cut(rect(Math.sin(t) * w * 0.98 - 0.45, -h, 0.9, h * 2), { depth: 0.3, ink: [0.008, 0.008, 0.008] });
      }
    });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 1 }), FOCUS);
  },
});

// A ribbed nub coming out of the top edge of a case, which closes over the rest of it. A checkbox holds which end it's at, and its box is the slot it runs in.
definePart({
  selector: '[d-slider~="edge"]',
  layer: -1,
  ...edge,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || ground(p, d), out = num(p, 'out', 1) * MM, w = p.w * 0.5;
    // Drawn at the left end of its slot, and its joint carries it the other half of the way.
    s.group(edge.place(p), () => {
      s.surface(rect(0, 0, w, out * 3, { radius: 2 }), { material, bevel: 2, zEdge: -3.4, zTop: -0.6 });
      for (let i = 1; i < 4; i++) s.engrave(rect((w * i) / 4 - 0.5, 0, 1, out * 2), 0.3, { soft: 0.5 });
      if (p.focused) s.glow(rect(0, 0, w, out, { radius: 2 }), FOCUS);
    });
  },
});
