// Phones.
import { capsule, circle, definePart, defineStyles, ellipse, FOCUS, grow, legendColor, linear, minus, MM, path, press, rect, text, type Part, type Sheet, type SurfaceOptions } from 'device-ui';
import { key, words } from 'device-ui/controls/key';
import { keyStyles, lamp, num, nums, scale } from 'device-ui/controls/shared';

defineStyles(`${keyStyles('[d-switch~="seesaw"] button')}
[d-key~="mat"], [d-key~="etched"] { display: block; }
[d-glass~="flash"], [d-switch~="seesaw"] { display: block; }`);

// Slivers of the side rail, coming out from behind the band, which hides the rest. Pressing one pushes it in. `material` is the rail's.
definePart(key('[d-key~="side"]', {
  feel: { mass: 11 },
  options: ['left', 'right', 'top'],
  label: false,
  layer: -1,
  cap: 'titanium-black',
  own: true,
  draw(s, p, d, k) {
    const side = words(p), left = side.includes('left'), out = 2.6 - 1.4 * k.down;
    if (side.includes('top')) {
      const r = (6 + out) / 2, y = p.y + 2.6 - out + r;
      s.surface(capsule(p.x + r, y, p.x + p.w - r, y, r, r), {
        material: k.cap, profile: 'chamfer', bevel: 1.4, zEdge: -3.4, zTop: -0.6, over: { rough: 0.3 },
      });
      return;
    }
    const x = (left ? p.x + p.w - 6 - out : p.x) + (6 + out) / 2, r = (6 + out) / 2;
    s.surface(capsule(x, p.y + r, x, p.y + p.h - r, r, r), {
      material: k.cap, profile: 'chamfer', bevel: 1.4, zEdge: -3.4, zTop: -0.6, over: { rough: 0.3 },
    });
  },
}));

const viewOf = (p: Part) => nums(p, 'viewbox', [0, 0, 100, 100]) as [number, number, number, number];

/** A key's edge, round its own middle: `path` in `viewbox`, or the oval that fills its box. */
const keyShape = (p: Part) => {
  const d = p.el.getAttribute('path'), hw = p.w / 2, hh = p.h / 2;
  return d ? path(d, -hw, -hh, p.w, p.h, { viewBox: viewOf(p), spread: 8 }) : ellipse(0, 0, hw, hh, { spread: 8 });
};

/** The silicone under a phone's cover, standing up through a hole in it. The cover dips to the hole, and the light under the mat leaks round it. */
const moulded = (s: Sheet, p: Part, shape: ReturnType<typeof keyShape>, down: number, lit: boolean, lean: Pick<SurfaceOptions, 'tilt' | 'pivot'> = {}) => {
  const material = p.el.getAttribute('material') || 'rubber-silver';
  s.cut(grow(shape, 2.4), { depth: 0.3, soft: 3.2 });
  s.well(grow(shape, 0.4), 1.2, { bevel: 0.8 });
  if (lit) s.glow(shape, scale(lamp(p, 'lime'), 0.05), 1.4);
  s.surface(shape, { material, bevel: num(p, 'bevel', 1.25) * MM, zEdge: -1.2, zTop: num(p, 'height', 1.1) - 0.8 * down, over: { touch: 0.25 }, ...lean });
  const mark = p.el.getAttribute('mark');
  if (mark) {
    const ink = p.el.getAttribute('markink');
    s.cut(path(mark, -p.w / 2, -p.h / 2, p.w, p.h, { viewBox: viewOf(p), spread: 2 }), {
      ink: ink ? linear(ink) : legendColor(material),
      ...(lit && !ink ? { emit: scale(lamp(p, 'lime'), 0.22) } : {}),
    });
  }
  if (p.focused) s.glow(shape, FOCUS);
};

const keymat = press({ mass: 1.2, material: 'rubber-on-plastic' });

// A phone key: silicone in the shape of its hole, with `num` big and `sub` small on it. `flip` sets them from the right,
// `inline` side by side, and `mark` is any other legend, in the key's `viewbox`. `on` turns the keypad light on under the mat.
definePart(key('[d-key~="mat"]', {
  ...keymat,
  label: false,
  cap: 'rubber-silver',
  own: true,
  live: ['on'],
  draw(s, p, d, k) {
    const shape = keyShape(p), hw = p.w / 2, hh = p.h / 2, flip = p.el.hasAttribute('flip') ? -1 : 1, inline = p.el.hasAttribute('inline');
    const big = p.el.getAttribute('num'), sub = p.el.getAttribute('sub'), material = k.cap, lit = p.el.hasAttribute('on');
    s.group({ at: [p.x + hw, p.y + hh], rotate: (num(p, 'rotate', 0) * Math.PI) / 180 }, () => {
      moulded(s, p, shape, keymat.value(p), lit);
      const legend = { ink: lit ? scale(lamp(p, 'lime'), 0.02) : legendColor(material), ...(lit ? { emit: scale(lamp(p, 'lime'), 0.22) } : {}) };
      const type = (str: string, x: number, y: number, size: number, weight: number) =>
        s.cut(text(str, x - hw, y - size * 0.7, hw * 2, size * 1.4, { font: `${weight} ${size}px Verdana, Helvetica, Arial, sans-serif`, align: 'center' }), legend);
      if (big) type(big, flip * hw * (inline ? -0.42 : -0.5), inline ? 0 : -hh * 0.3, 2.9 * MM, 700);
      if (sub) type(sub, flip * hw * (inline ? 0.34 : 0.18), inline ? hh * 0.1 : hh * 0.46, 1.75 * MM, 500);
      // Plain text on a key is one word across its middle, `legend` mm tall.
      const word = p.el.textContent?.trim();
      if (word) type(word, 0, 0, num(p, 'legend', 2) * MM, 500);
    });
  },
}));

const dome = press({ mass: 0.8, material: 'rubber-on-plastic', sound: 'dome' });

// A key that is a patch of one etched metal sheet over a snap dome, the sheet being whatever it sits on: no gap and no cap, only a groove etched
// through round it, and its legend, lit from under the sheet when `on`. `path` in `viewbox` is the groove's line, or a rounded box. `num`, `sub` and `mark` as on a phone key, `color` the light.
definePart(key('[d-key~="etched"]', {
  ...dome,
  label: false,
  live: ['on'],
  draw(s, p, _d, k) {
    const hw = p.w / 2, hh = p.h / 2, lit = p.el.hasAttribute('on'), light = scale(lamp(p, 'blue'), 0.3);
    const d0 = p.el.getAttribute('path'), line = d0 ? path(d0, -hw, -hh, p.w, p.h, { viewBox: viewOf(p), spread: 4 }) : rect(-hw, -hh, p.w, p.h, { radius: Math.min(hw, hh) * 0.45 });
    const groove = minus(grow(line, 0.6 * MM), grow(line, 0.2 * MM));
    const ink = (o: { depth: number }) => ({ ...o, ink: lit ? scale(lamp(p, 'blue'), 0.03) : [0.05, 0.05, 0.055] as [number, number, number], ...(lit ? { emit: light } : {}) });
    s.group({ at: [p.x + hw, p.y + hh] }, () => {
      s.cut(groove, ink({ depth: 0.12 }));
      // The dome under the sheet takes it down where the finger is, and nowhere else.
      if (k.down > 0.001) s.cut(ellipse(0, 0, hw * 0.6, hh * 0.6), { depth: 0.25 * k.down, soft: Math.min(hw, hh) * 0.8 });
      const big = p.el.getAttribute('num'), sub = p.el.getAttribute('sub'), mark = p.el.getAttribute('mark');
      const type = (str: string, x: number, y: number, size: number, weight: number, align: 'left' | 'center') =>
        s.cut(text(str, align === 'left' ? x : x - hw, y - size * 0.7, hw * 2, size * 1.4, { font: `${weight} ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`, align }), ink({ depth: 0.05 }));
      if (big) type(big, -hw + 1.6 * MM, sub ? hh * 0.05 : 0, 3.2 * MM, 400, 'left');
      if (sub) type(sub, -hw + 4.6 * MM, -hh * 0.3, 1.3 * MM, 400, 'left');
      if (mark) s.cut(path(mark, -hw, -hh, p.w, p.h, { viewBox: viewOf(p), spread: 2 }), ink({ depth: 0.05 }));
      if (p.focused) s.glow(line, FOCUS);
    });
  },
}));

const rocker = press({ mass: 1.6, material: 'rubber-on-plastic', of: 'button', rocks: [[0, -1], [0, 1]] });

// Mm one end of a seesaw goes down as the other comes up, from one dip to the other. A guess.
const SEESAW = 1;

// A moulded key on a pivot with two ends, each a real button placed in its box. `path`, `viewbox`, `mark` as on a phone key, and `dips` the two ends, as x y pairs in the viewbox.
// It turns on the point halfway between them.
definePart({
  selector: '[d-switch~="seesaw"]',
  ...rocker,
  paint(s, p) {
    const hw = p.w / 2, hh = p.h / 2, [vx = 0, vy = 0, vw = 100, vh = 100] = viewOf(p), [ax = vx + vw / 2, ay = vy, bx = ax, by = vy + vh] = nums(p, 'dips', []);
    // The dips as shares of the key from its middle, -1 to 1, which is how a tilt is laid across it.
    const qa = [((ax - vx) / vw) * 2 - 1, ((ay - vy) / vh) * 2 - 1], qb = [((bx - vx) / vw) * 2 - 1, ((by - vy) / vh) * 2 - 1];
    const ux = qb[0]! - qa[0]!, uy = qb[1]! - qa[1]!, k = (2 * SEESAW * p.springs.y!.value) / Math.max(ux * ux + uy * uy, 1e-6);
    s.group({ at: [p.x + hw, p.y + hh] }, () => {
      moulded(s, p, keyShape(p), 0, p.el.hasAttribute('lit'), { tilt: [ux * k, uy * k], pivot: [(qa[0]! + qb[0]!) / 2, (qa[1]! + qb[1]!) / 2] });
    });
  },
});

// A camera flash: a stepped plastic lens over a yellow phosphor, behind a flush window.
definePart({
  selector: '[d-glass~="flash"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = p.w / 2, material = p.el.getAttribute('material') || 'keycap-ivory';
    s.surface(circle(cx, cy, R), { material, bevel: 2, rise: 0.05 });
    [0.8, 0.62, 0.44].forEach((k, i) => s.surface(circle(cx, cy, R * k), { material, profile: 'chamfer', bevel: 1.2, zEdge: 0.1 * i, zTop: 0.1 * (i + 1), over: { color: [0.82, 0.76, 0.58] } }));
    s.surface(rect(cx - R * 0.17, cy - R * 0.17, R * 0.34, R * 0.34, { radius: 1 }), { material, profile: 'flat', zEdge: 0.3, zTop: 0.3, over: { color: [0.8, 0.58, 0.12] } });
    s.glass(circle(cx, cy, R), { height: 0.5, bevel: R * 0.3 });
  },
});

// With `bar` it's a compact camera's xenon flash: a long window ribbed into a fresnel, over a reflector with the tube lying along it.
definePart({
  selector: '[d-glass~="flash"][d-glass~="bar"]',
  paint(s, p) {
    const { x, y, w, h } = p, material = p.el.getAttribute('material') || 'keycap-ivory', r = Math.min(h / 2, 1.2 * MM);
    s.surface(rect(x, y, w, h, { radius: r }), { material, bevel: 1.5, rise: 0.05, over: { color: [0.86, 0.85, 0.8] } });
    s.surface(rect(x + w * 0.08, y + h * 0.42, w * 0.84, h * 0.16, { radius: h * 0.08 }), { material, profile: 'flat', zEdge: 0.15, zTop: 0.15, over: { color: [0.92, 0.9, 0.82] } });
    const n = Math.max(3, Math.round(w / (1.2 * MM)));
    for (let i = 1; i < n; i++) s.surface(rect(x + (w * i) / n - 0.15 * MM, y + 0.6, 0.3 * MM, h - 1.2), { material, profile: 'chamfer', bevel: 0.6, zEdge: 0.2, zTop: 0.3 });
    s.glass(rect(x, y, w, h, { radius: r }), { height: 0.5, bevel: Math.min(h * 0.25, 2 * MM) });
  },
});
