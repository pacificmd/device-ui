// Keyboards: keys that read one light under the whole board, and the ports along a laptop's edge.
import { circle, definePart, defineStyles, legendColor, MM, press, rect, text, type Part, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';
import { key, legend, words } from 'device-ui/controls/key';
import { num, scale } from 'device-ui/controls/shared';
import { isKeyProfile, lowCap, profiledCap } from 'device-ui/controls/anatomy';

defineStyles(`
[d-key~="screen"] canvas { display: none; }
[d-lamp~="backlight"] { display: none; }
[d-port~="edge"] { display: block; }
`);

const PLATE = -3;
const WHITE = lampColours.white!;

const hue = (h: number): Vec3 => {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return Math.max(0, 1 - Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5) ** 2.2, f(3) ** 2.2, f(1) ** 2.2];
};

const lights = new WeakMap<object, { level: number; mode: string; phase: number }>();
const light = (d: { el: object }) => lights.get(d.el) ?? { level: 0.6, mode: 'wave', phase: 0 };

// The light under a board of keys, one element in the device. `level` eases to its brightness, 0 to 1.
// `mode` is `wave`, `pulse`, `solid` or `off`, and `phase` is how far the colours have run.
// Paints first, so the keys read it as they paint.
definePart({
  selector: '[d-lamp~="backlight"]',
  layer: -1,
  spreads: true,
  springs: { level: { stiffness: 90, damping: 16 } },
  live: ['level', 'mode', 'phase'],
  update(p) {
    p.springs.level!.set(num(p, 'level', 0.6));
  },
  paint(_, p, d) {
    lights.set(d.el, { level: p.springs.level!.value, mode: p.el.getAttribute('mode') ?? 'wave', phase: num(p, 'phase', 0) });
  },
});

const switchkey = press({
  mass: 6, friction: 0.1,
  down: p => p.springs.flare!.snap(1),
  up: p => p.springs.flare!.set(0),
});

// A sculpted cap on a tall switch, whose LED follows the board's backlight and flares when it's hit. `profile` and `row` cut the cap as on `d-key="mech"`.
definePart(key('[d-key~="switch"]', {
  ...switchkey,
  cap: 'keycap-black',
  springs: { ...switchkey.springs, flare: { stiffness: 26, damping: 9 } },
  draw(s, p: Part, d, k) {
    const cap = k.cap, press = k.down;
    const t = (p.x + p.w / 2) / d.w, hit = Math.max(p.springs.flare!.value, 0);
    const glow = light(d), beat = glow.mode === 'pulse' ? 0.5 + 0.5 * Math.sin(glow.phase * 2.4) : 1;
    const base = glow.mode === 'off' ? [0, 0, 0] as Vec3 : hue(glow.mode === 'solid' ? 0.52 : t * 0.9 - glow.phase * 0.12 + 2);
    const level = glow.level * beat * 0.8;
    const c: Vec3 = [base[0] * level + hit * 0.9, base[1] * level + hit * 0.9, base[2] * level + hit * 0.9];
    const box = rect(p.x, p.y, p.w, p.h, { radius: 4 });
    s.surface(box, { material: 'well', bevel: 1, zEdge: PLATE + 0.4, zTop: PLATE - 1.4, over: { emit: c, leak: 3 } });
    const g = 0.55 * MM, profile = p.el.getAttribute('profile');
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => profiledCap(s, isKeyProfile(profile) ? profile : 'oem', (p.w - g * 2) / MM, (p.h - g * 2) / MM, {
      material: cap, z: PLATE + 1 - 2.4 * press, row: num(p, 'row', 0),
    }));
    legend(s, p, cap, { depth: 0.04 });
    k.focus(box);
  },
}));

// A low key on a scissor, whose legend and edge light follow the board's backlight.
definePart(key('[d-key~="scissor"]', {
  feel: { mass: 2 },
  live: ['on'],
  draw(s, p, d, k) {
    const cap = 'soft-touch-black', L = light(d).level;
    const box = rect(p.x, p.y, p.w, p.h, { radius: 5 });
    s.surface(box, { material: 'well', bevel: 1, zEdge: 0, zTop: -0.8, over: { emit: scale(WHITE, 0.026 * L) } });
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => lowCap(s, p.w / MM, p.h / MM, k.down, cap, { touch: d.age * 0.7 }));
    legend(s, p, cap, { ink: L > 0.02 ? scale(WHITE, 0.03) : undefined, emit: scale(WHITE, 0.24 * L) });
    if (p.el.hasAttribute('on')) s.cut(circle(p.x + p.w - 7, p.y + 7, 1.5), { ink: [0.05, 0.3, 0.1], emit: [0.2, 1.6, 0.4] });
  },
}));

const sculpted = press({ mass: 6, friction: 0.1 });
const FRONT = 2.2 * MM; // how tall a legend on a cap's front is, px

// A sculpted home-computer keycap: a dished top set back on a skirt, so a long front face looks up at you and carries a second legend. The label sits where a button's text would,
// so pad the button to lift it onto the top. `front` is the second legend, `height` how far the top stands up in mm, and `travel` how far it goes.
definePart(key('[d-key~="sculpt"]', {
  ...sculpted,
  cap: 'keycap-black',
  live: ['front'],
  draw(s, p, d, k) {
    const cap = k.cap, height = num(p, 'height', 4.6), travel = num(p, 'travel', 2.4);
    const down = sculpted.value(p), g = 0.45 * MM, side = 1.6 * MM, rear = 1 * MM, nose = 4.6 * MM, top = height - travel * down, shoulder = top * 0.62;
    s.well(rect(p.x, p.y, p.w, p.h, { radius: 2 }), 1.2, { bevel: 1 });
    s.surface(rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: 3 * MM / 2 }), {
      material: cap, profile: 'chamfer', bevel: 1.2 * MM, zEdge: -1, zTop: shoulder, over: { touch: d.age * 0.4 },
    });
    s.surface(rect(p.x + side, p.y + rear, p.w - side * 2, p.h - rear - nose, { radius: 2 * MM }), {
      material: cap, bevel: 1.1 * MM, zEdge: shoulder, zTop: top, dish: 0.5, over: { touch: d.age * 0.8 },
    });
    legend(s, p, cap, { depth: 0.04, wear: d.wear * 0.3 });
    const front = p.el.getAttribute('front');
    if (front) s.cut(text(front, p.x, p.y + p.h - nose + 0.6 * MM, p.w, FRONT * 1.3, { font: `600 ${FRONT}px 'Helvetica Neue', Arial, sans-serif`, letterSpacing: '0.5px', align: 'center' }), { depth: 0.03, ink: legendColor(cap), wear: d.wear * 0.2 });
    k.focus(rect(p.x, p.y, p.w, p.h, { radius: 3 }));
  },
}));

// A port seen from above, cut into the very edge of the case.
definePart({
  selector: '[d-port~="edge"]',
  options: ['jack', 'usbc', 'usba'],
  paint(s, p) {
    const kind = words(p, 'd-port')[1], r = kind === 'jack' ? p.w / 2 : kind === 'usba' ? 1.5 : p.w / 2;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: r }), { material: 'well', bevel: 1, zEdge: 0, zTop: -2 });
    if (kind === 'jack') return;
    s.surface(rect(p.x + p.w * 0.36, p.y + 3, p.w * 0.28, p.h - 6, { radius: 1 }), { material: 'plastic-black', zEdge: -2, zTop: -1 });
  },
});

const screenkey = press({ mass: 3, material: 'rubber-on-plastic' });

// A key with a screen under it: a small panel fixed in the board, and a clear cap over it that goes down when pressed while the panel stays.
// A `<canvas>` inside is the panel, one canvas pixel to one of its pixels: draw on it and call `present`. `panel` is the side of what shows in mm,
// `radius` the corner of the hole, `gap` how far the cap stands off the hole's wall, `height` how far the cap stands proud and `travel` how far it goes, all in mm.
definePart(key('[d-key~="screen"]', {
  ...screenkey,
  label: false,
  live: ['aria-label'],
  draw(s, p, d, k) {
    const source = p.el.querySelector('canvas'), radius = num(p, 'radius', 3) * MM, gap = num(p, 'gap', 0.4) * MM, side = num(p, 'panel', 13) * MM;
    const down = screenkey.value(p), height = num(p, 'height', 0.5), travel = num(p, 'travel', 1);
    const hole = rect(p.x, p.y, p.w, p.h, { radius }), cap = rect(p.x + gap, p.y + gap, p.w - gap * 2, p.h - gap * 2, { radius: radius - gap });
    s.well(hole, 1.8, { material: 'gloss-black', bevel: gap }, () => {
      if (source?.width) {
        // The cap is a thick lens, so as it nears the panel the picture under it looks a little smaller.
        const shown = side * (1 - 0.07 * down);
        s.screen(rect(p.x + (p.w - shown) / 2, p.y + (p.h - shown) / 2, shown, shown, { radius: 0.5 * MM }), source, {
          // Down in its hole the cap sits in the wall's shadow, so the panel under it looks dimmer.
          kind: 'oled', gain: num(p, 'gain', 1) * (1 - 0.24 * down), color: [0.004, 0.004, 0.005], zTop: 0, rough: 0.3, coat: 0.2,
        });
      }
    });
    s.glass(cap, { height: height - travel * down, bevel: 1.2 * MM, curve: 0.5, rim: 0.7, coat: 0.5 });
    k.focus(hole);
  },
}));
