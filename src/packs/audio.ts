// Things that play: touch keys and light rings, tape, radios, step sequencers.
import { arc, capsule, circle, definePart, defineStyles, hinge, holes, intersect, linear, mask, MM, path, poly, press, rect, reduced, resolveMaterial, ring, spring, text, turn, union, type DeviceInfo, type Part, type Sheet, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';
import { key, legend, words, type KeyCap } from 'device-ui/controls/key';
import { controlStyles, font, ground, lamp, num, nums, polar, scale, sector } from 'device-ui/controls/shared';

defineStyles(`
[d-opening~="cone"], [d-fixing~="corner"] { display: block; position: relative; }
${controlStyles('[d-wheel~="tuning"]', '[d-meter~="hands"]', '[d-turntable~="tonearm"]')}
label[d-key~="edge"] { display: block; cursor: pointer; }
:where(label[d-key~="edge"], label[d-key~="step"]) { position: relative; }
label[d-key~="edge"] input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
[d-lamp~="halo"], [d-tape~="path"], [d-tape~="reel"], [d-opening~="speaker"], [d-meter~="tuner"], [d-readout~="seven"][d-readout~="clock"], [d-glass~="crystal"], [d-tape~="cassette"], [d-turntable~="platter"], [d-meter~="strip"], [d-cover~="clear"] { display: block; }
[d-tape~="reel"] { position: relative; }
[d-glass~="crystal"] { pointer-events: none; }
[d-key~="step"] { cursor: pointer; }
label[d-key~="step"] input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
`);

/** A strobe's rows, each radius:count:dot radius. */
const dots = (spec: string) => spec.split(',').filter(Boolean).map(row => row.split(':').map(Number) as [number, number, number]);
/** Whether a turntable piece has this option word. */
const isWord = (p: Part, word: string) => (p.el.getAttribute('d-turntable') ?? '').split(/\s+/).includes(word);

// A moulded corner on a covered cabinet, as on an amp or a flight case, with a stud through it. `at` says which corner of the box is the cabinet's: `tl`, `tr`, `bl` or `br`. `height` is mm, `stud` the stud's material.
definePart({
  selector: '[d-fixing~="corner"]',
  paint(s, p) {
    const at = p.el.getAttribute('at') || 'tl', right = at.includes('r'), low = at.includes('b'), material = p.el.getAttribute('material') || 'gloss-black', top = num(p, 'height', 5) * MM;
    const R = Math.min(p.w, p.h) * 0.3, r = R * 0.3, x0 = right ? p.x + p.w : p.x, y0 = low ? p.y + p.h : p.y, sx = right ? -1 : 1, sy = low ? -1 : 1;
    const point = (u: number, v: number, radius: number): Vec3 => [x0 + sx * u, y0 + sy * v, radius];
    s.surface(poly([point(0, 0, R), point(p.w, 0, r), point(p.w, p.h * 0.72, r * 2), point(p.w * 0.72, p.h, r * 2), point(0, p.h, r)]), { material, profile: 'round', bevel: R * 0.8, zEdge: 0, zTop: top });
    const stud = Math.min(p.w, p.h) * 0.12, [cx, cy] = point(p.w * 0.62, p.h * 0.62, 0);
    s.surface(circle(cx, cy, stud), { material: p.el.getAttribute('stud') || 'brass', profile: 'dome', rise: 0.5 * MM, zEdge: top, radial: true });
  },
});

const HEADS = [320, 382, 444];
const FM = [88, 92, 96, 100, 104, 108];
const AM = [54, 70, 90, 120, 160];
const LIGHT: Record<string, Vec3> = { amber: [5.5, 2.1, 0.25], green: [0.45, 4.2, 0.6], red: [5.5, 0.35, 0.14], white: [2.2, 2.2, 2.1] };

const ICON = {
  play: 'M8 4.6 L19.4 12 L8 19.4 Z',
  pause: 'M6.6 5 H10.4 V19 H6.6 Z M13.6 5 H17.4 V19 H13.6 Z',
  next: 'M5.4 5 L14.6 12 L5.4 19 Z M15.6 5 H18.8 V19 H15.6 Z',
  mic: 'M12 2.6 A3.4 3.4 0 0 1 15.4 6 V11.6 A3.4 3.4 0 0 1 8.6 11.6 V6 A3.4 3.4 0 0 1 12 2.6 Z M5.6 10.6 H7.4 V11.6 A4.6 4.6 0 0 0 16.6 11.6 V10.6 H18.4 V11.6 A6.4 6.4 0 0 1 12.9 17.9 V20 H16 V21.6 H8 V20 H11.1 V17.9 A6.4 6.4 0 0 1 5.6 11.6 Z',
  link: 'M8.6 6.4 A5.6 5.6 0 1 0 8.6 17.6 A5.6 5.6 0 1 0 8.6 6.4 Z M8.6 8.2 A3.8 3.8 0 1 1 8.6 15.8 A3.8 3.8 0 1 1 8.6 8.2 Z M15.4 6.4 A5.6 5.6 0 1 0 15.4 17.6 A5.6 5.6 0 1 0 15.4 6.4 Z M15.4 8.2 A3.8 3.8 0 1 1 15.4 15.8 A3.8 3.8 0 1 1 15.4 8.2 Z',
};

// A capacitive key with a picture for a legend, printed in the glass and lit from behind. Nothing goes down on glass, so its press is the light coming up, and it still gives a tap.
definePart(key('[d-key~="touch"]', {
  feel: { mass: 64, material: 'finger-on-glass', friction: 0.5 },
  label: false,
  lit: { stiffness: 220, damping: 26 },
  live: ['on', 'color', 'icon'],
  draw(s, p, d, k) {
    const c = lamp(p, 'white'), press = k.down, level = Math.max(p.springs.lit!.value, 0.3, press);
    const picture = ICON[p.el.getAttribute('icon') as keyof typeof ICON] ?? ICON.play;
    const icon = path(picture, p.x + p.w * 0.16, p.y + p.h * 0.16, p.w * 0.68, p.h * 0.68, { viewBox: [0, 0, 24, 24], spread: 3, rule: 'evenodd' });
    s.cut(icon, { ink: scale(c, 0.03), emit: scale(c, 0.2 * level) });
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = p.w / 2;
    if (press > 0.01) s.glow(circle(cx, cy, R), scale(c, 0.4 * press), 1);
    k.focus(circle(cx, cy, R));
  },
}));

// A ring of LEDs under a diffuser. `mode` says what it is doing, `level` how much of it is lit.
definePart({
  selector: '[d-lamp~="halo"]',
  live: ['mode', 'level'],
  springs: { fade: { stiffness: 90, damping: 16 } },
  update(p) {
    p.data.t = 0;
    p.springs.fade!.snap(0);
    p.springs.fade!.set(1);
  },
  tick(p, dt) {
    const mode = p.el.getAttribute('mode');
    if (reduced() || !(mode === 'play' || mode === 'pair' || mode === 'next')) return false;
    p.data.t = ((p.data.t ?? 0) as number) + dt;
    return true;
  },
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = p.w / 2 - 3, n = 72, step = (Math.PI * 2) / n;
    const mode = p.el.getAttribute('mode') ?? 'idle', t = (p.data.t ?? 0) as number, fade = p.springs.fade!.value, level = num(p, 'level', 0);
    const white = lampColours.white!, cyan = lampColours.cyan!, violet = lampColours.violet!, red = lampColours.red!, blue = lampColours.blue!;
    s.cut(arc(cx, cy, R, 0, Math.PI * 2, 5), { ink: [0.012, 0.012, 0.013] });
    for (let i = 0; i < n; i++) {
      const k = i / n, a = i * step;
      let c: Vec3 = white, b = 0;
      if (mode === 'idle') b = 0.07;
      else if (mode === 'mute') {
        c = red;
        b = 0.42;
      } else if (mode === 'pair') {
        c = blue;
        b = reduced() ? 0.5 : 0.18 + 0.4 * Math.sin(t * 3.6) ** 2;
      } else if (mode === 'vol') b = k <= level ? 0.46 : 0.03;
      else if (mode === 'next') {
        const head = reduced() ? 1 : Math.min(t / 0.7, 1);
        b = k <= head ? 0.46 * (1 - (head - k) * 0.7) : 0.03;
      } else {
        const m = Math.sin(k * Math.PI * 2 - t * 1.4) * 0.5 + 0.5;
        c = [cyan[0] + (violet[0] - cyan[0]) * m, cyan[1] + (violet[1] - cyan[1]) * m, cyan[2] + (violet[2] - cyan[2]) * m];
        b = 0.14 + 0.3 * Math.sin(k * Math.PI * 4 - t * 2) ** 2;
      }
      s.cut(arc(cx, cy, R, a - step * 0.56, a + step * 0.56, 3.6), { ink: scale(c, 0.03), emit: scale(c, b * fade) });
    }
  },
});

const line = (x0: number, y0: number, x1: number, y1: number, w: number) => {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  return rect((x0 + x1) / 2 - l / 2, (y0 + y1) / 2 - w / 2, l, w, { rotate: Math.atan2(dy, dx), radius: w / 2 });
};

const roller = (s: Sheet, x: number, y: number, r: number, cap = 'black-oxide') => {
  s.surface(circle(x, y, r), { material: 'chrome', bevel: 2.5, zEdge: 0, zTop: 3, over: { rough: 0.2 } });
  s.surface(circle(x, y, r * 0.46), { material: cap, profile: 'dome', zEdge: 3, zTop: 4 });
};

/** The straight run of tape between a roller and a reel's pack, touching both on their outer side. */
const run = (ax: number, ay: number, ra: number, bx: number, by: number, rb: number, side: number) => {
  const d = Math.hypot(bx - ax, by - ay), base = Math.atan2(by - ay, bx - ax);
  const a = base + side * Math.acos((ra - rb) / d), nx = Math.cos(a), ny = Math.sin(a);
  return { x0: ax + nx * ra, y0: ay + ny * ra, x1: bx + nx * rb, y1: by + ny * rb, clock: Math.atan2(nx, -ny) };
};

// The tape's whole route: tension arms, guides, three heads, the capstan and its pinch roller.
// `reels` is the left x, right x, y and radius of the two reels, and `line` the height of the tape past the heads, all mm
// from the part's corner. `left` and `right` are how full each reel is, and `play` and `moving` what the transport is doing.
definePart({
  selector: '[d-tape~="path"]',
  springs: { pinch: spring({ mass: 20, return: 0.11, friction: 0.32 }), arm: spring({ mass: 30, return: 0.017, friction: 0.14 }) },
  live: ['play', 'moving', 'left', 'right'],
  update(p) {
    p.springs.pinch!.set(p.el.hasAttribute('play') ? 1 : 0);
    p.springs.arm!.set(p.el.hasAttribute('moving') ? 1 : 0);
  },
  paint(s, p) {
    const { x: ox, y: oy } = p, [lx, rx, ry, reel] = nums(p, 'reels', [48, 147, 46, 37.5]).map(v => v * MM) as [number, number, number, number], LINE = num(p, 'line', 100.5) * MM;
    const ROLL = { lx: 62, rx: 718, y: LINE - 12, r: 12 }, GUIDE = { lx: 250, rx: 530, y: LINE + 12, r: 12 }, CAPSTAN = { x: 488, y: LINE - 8 };
    const pack = (name: string) => (+(p.el.getAttribute(name) ?? 0.6)) * reel * 0.92;
    const swing = p.springs.arm!.value * 0.16, pinch = p.springs.pinch!.value;

    const arm = (px: number, side: number) => {
      const a = (side < 0 ? 2.26 : Math.PI - 2.26) + side * swing * -1, L = 76;
      return { px, py: LINE + 46, x: px + Math.cos(a) * L * (side < 0 ? 1 : 1), y: LINE + 46 - Math.abs(Math.sin(a)) * L };
    };
    const al = arm(ROLL.lx + 52, -1), ar = arm(ROLL.rx - 52, 1);

    // Pivoted arms first, so tape and rollers lie over them.
    for (const a of [al, ar]) {
      s.surface(line(ox + a.px, oy + a.py, ox + a.x, oy + a.y, 11), { material: 'brushed-steel', bevel: 2, zEdge: 0, zTop: 1.1, over: { aniso: 0.3 } });
      s.surface(circle(ox + a.px, oy + a.py, 11), { material: 'black-oxide', bevel: 2, zEdge: 0, zTop: 1.9 });
      s.surface(circle(ox + a.px, oy + a.py, 4), { material: 'chrome', profile: 'dome', zEdge: 1.9, zTop: 2.6 });
    }

    const wrap = { material: 'tape', zEdge: 1, zTop: 1.3, bevel: 0.6, profile: 'flat' as const };
    const l = run(ox + al.x, oy + al.y, ROLL.r + 1, ox + lx, oy + ry, pack('left'), -1);
    const r = run(ox + ar.x, oy + ar.y, ROLL.r + 1, ox + rx, oy + ry, pack('right'), 1);
    s.surface(line(l.x0, l.y0, l.x1, l.y1, 2.2), wrap);
    s.surface(line(r.x0, r.y0, r.x1, r.y1, 2.2), wrap);
    s.surface(arc(ox + al.x, oy + al.y, ROLL.r + 1, -Math.PI, l.clock, 2.2), wrap);
    s.surface(arc(ox + ar.x, oy + ar.y, ROLL.r + 1, r.clock, Math.PI, 2.2), wrap);
    s.surface(line(ox + al.x, oy + al.y + ROLL.r + 1, ox + ar.x, oy + ar.y + ROLL.r + 1, 2.2), wrap);

    roller(s, ox + al.x, oy + al.y, ROLL.r);
    roller(s, ox + ar.x, oy + ar.y, ROLL.r);
    roller(s, ox + GUIDE.lx, oy + GUIDE.y, GUIDE.r);
    roller(s, ox + GUIDE.rx, oy + GUIDE.y, GUIDE.r);

    // Three heads, each a chrome shoe with a dark gap, their tops just touching the tape.
    for (const hx of HEADS) {
      const x = ox + hx, y = oy + LINE + 1;
      s.surface(rect(x - 17, y, 34, 30, { radius: 8 }), { material: 'chrome', bevel: 7, zEdge: 1.6, zTop: 4, over: { rough: 0.14 } });
      s.cut(rect(x - 0.6, y + 1, 1.2, 13), { depth: 0.5, ink: [0.01, 0.01, 0.01] });
    }

    // The capstan spins. The pinch roller swings in to trap the tape against it.
    const px = ox + CAPSTAN.x + (1 - pinch) * 16, py = oy + LINE + 18 + (1 - pinch) * 16;
    s.surface(circle(px, py, 18), { material: 'rubber', bevel: 3, zEdge: 0, zTop: 3.4, over: { rough: 0.55 } });
    s.surface(circle(px, py, 6), { material: 'chrome', profile: 'dome', zEdge: 3.4, zTop: 4.2 });
    s.surface(circle(ox + CAPSTAN.x, oy + CAPSTAN.y, 7), { material: 'brushed-steel', profile: 'dome', zEdge: 0, zTop: 5, over: { aniso: 0 } });
  },
});

// A pressed speaker disc: a whole circle of holes, which d-opening="grille" cannot do.
definePart({
  selector: '[d-opening~="speaker"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    s.surface(circle(cx, cy, R), { material: 'chrome', bevel: 6, zEdge: 0, zTop: 1.7, over: { rough: 0.2 } });
    s.surface(circle(cx, cy, R - 7), { material: 'anodised-graphite', bevel: 3, zEdge: 0.7, zTop: 0.3 });
    s.surface(holes(cx - R + 14, cy - R + 14, R * 2 - 28, R * 2 - 28, { pitch: 10, hole: 3, radius: R - 14 }), {
      material: 'well', bevel: 1.2, zEdge: 0.3, zTop: -3.6,
    });
  },
});

// A printed tuning scale on black glass, lit from behind while the radio plays.
definePart({
  selector: '[d-meter~="tuner"]',
  springs: { pos: spring({ mass: 30, return: 0.027, friction: 0.52 }) },
  live: ['lit'],
  update(p) {
    const m = p.el.querySelector('meter');
    p.springs.pos!.set(m ? (m.value - m.min) / (m.max - m.min) : 0);
  },
  mask(ctx, p) {
    const left = p.x + 36, right = p.x + p.w - 14, span = right - left;
    const family = getComputedStyle(p.el).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = (name: string, list: number[], y: number) => {
      ctx.font = `600 11px ${family}`;
      ctx.textAlign = 'left';
      ctx.fillText(name, p.x + 9, y);
      ctx.textAlign = 'center';
      list.forEach((n, i) => {
        const x = left + (span * i) / (list.length - 1);
        ctx.fillText(String(n), x, y);
        ctx.fillRect(x - 0.5, y + 8, 1, 7);
      });
      for (let i = 0; i <= 50; i++) ctx.fillRect(left + (span * i) / 50 - 0.35, y + 11, 0.7, 4);
      ctx.fillRect(left, y + 15, span, 0.8);
    };
    scale('FM', FM, p.y + p.h * 0.24);
    scale('AM', AM, p.y + p.h * 0.62);
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p) {
    const lit = p.el.hasAttribute('lit'), panel = rect(p.x, p.y, p.w, p.h, { radius: 4 });
    const left = p.x + 36, span = p.w - 50, x = left + span * p.springs.pos!.value;
    s.surface(panel, { material: 'smoked-glass', bevel: 2, zEdge: 0, zTop: 0.5 });
    if (p.mask) s.cut(mask(p.mask), { ink: lit ? [0.95, 0.76, 0.42] : [0.5, 0.46, 0.38], emit: lit ? [0.5, 0.3, 0.09] : [0, 0, 0] });
    s.cut(rect(x - 1.2, p.y + 8, 2.4, p.h - 16, { radius: 1 }), { ink: [0.75, 0.05, 0.02], emit: lit ? [0.8, 0.08, 0.02] : [0.1, 0.01, 0] });
    s.glass(panel, { height: 0.4, bevel: 6, coat: 0.7 });
  },
});

const RAD = Math.PI / 180;
const wheel = turn({ mass: 14, material: 'plastic-on-plastic', input: true, stops: { at: p => [num(p, 'from', -135), num(p, 'to', 135)] }, travel: 320 });

// A thumb disc let into a case, nearly flush, on a fixed hub with two pin holes. It carries a pointer and a raised
// pin for each angle in `pins`, degrees either side of it. Wraps a range input, with `from` and `to` its ends in degrees.
definePart({
  selector: '[d-wheel~="tuning"]',
  ...wheel,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || ground(p, d), cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const hub = p.el.hasAttribute('hub') ? num(p, 'hub', 0) * MM : R * 0.31, pin = R * 0.3;
    s.seam(circle(cx, cy, R), { width: 0.7, depth: 3 });
    s.group(wheel.place(p), () => {
      s.surface(circle(0, 0, R - 0.5), { material, bevel: 1, zEdge: -0.3, zTop: -0.15 });
      const tip = -R * 0.87, base = -R * 0.76, half = R * 0.065;
      s.cut(poly([[0, tip], [half, base], [-half, base]]), { ink: [0.012, 0.012, 0.012] });
      for (const a of nums(p, 'pins', [])) {
        s.group({ rotate: a * RAD }, () => s.surface(capsule(0, -R * 0.96, 0, -R * 0.96 + pin, R * 0.018, R * 0.018), { material: 'chrome', profile: 'dome', zEdge: 0, zTop: 1.1 }));
      }
    });
    s.seam(circle(cx, cy, hub + 1.4), { width: 0.7, depth: 1.6 });
    s.surface(circle(cx, cy, hub), { material: p.el.getAttribute('hubmaterial') || 'aluminium-silver', bevel: 1.2, zEdge: 0, zTop: 0.5 });
    for (const a of [12, 192]) {
      const [x, y] = polar(cx, cy, hub * 0.33, a * RAD);
      s.surface(circle(x, y, hub * 0.075), { material: 'well', bevel: 0.4, zEdge: 0.5, zTop: -1 });
    }
  },
});

const alarm = turn({ mass: 3, material: 'plastic-on-plastic', input: true, wrap: true, stops: { at: [0, 360] }, travel: 360 });
const hand = { mass: 5, return: 0.033, friction: 0.63 };
const stick = (a: number, from: number, to: number, r: number) => {
  const [ax, ay] = polar(0, 0, from, a), [bx, by] = polar(0, 0, to, a);
  return capsule(ax, ay, bx, by, r, r);
};

// The hands of a travel clock, in a box as wide as the dial. Follows the computer's clock, or `time="10:08:30"`.
// Wraps a range input of minutes round twelve hours, which sets the alarm hand: drag it round.
definePart({
  selector: '[d-meter~="hands"]',
  ...alarm,
  springs: { ...alarm.springs, h: spring(hand), m: spring(hand), s: spring({ mass: 1, return: 0.1, friction: 0.021 }) },
  live: [...alarm.live, 'time'],
  update(p) {
    alarm.update(p);
    const fixed = p.el.getAttribute('time')?.split(':').map(Number), now = new Date();
    const [h, m, sec] = fixed ?? [now.getHours(), now.getMinutes(), now.getSeconds()];
    const s = sec ?? 0, min = (m ?? 0) + s / 60, hour = ((h ?? 0) % 12) + min / 60, last = (p.data.s ?? -1) as number;
    // The second hand runs on through twelve, and doesn't swing all the way back.
    p.data.laps = ((p.data.laps ?? 0) as number) + (s < last ? 1 : 0);
    p.data.s = s;
    p.springs.h!.set(hour * 30 * RAD);
    p.springs.m!.set(min * 6 * RAD);
    p.springs.s!.set((s + 60 * (p.data.laps as number)) * 6 * RAD);
  },
  connect(p) {
    const done = alarm.connect(p), id = setInterval(() => p.def.update!(p), 1000);
    return () => {
      clearInterval(id);
      done();
    };
  },
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'dial-white', tick = p.el.getAttribute('tick') || 'plastic-yellow';
    const lume = p.el.getAttribute('lume') || '#c9d6ae', tip = linear(p.el.getAttribute('alarm') || '#2f9e3c');
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2] }, () => {
      s.surface(circle(0, 0, R * 0.14), { material: 'plastic-black', bevel: 1, zEdge: 0, zTop: 0.3 });
      // The alarm hand is what its joint turns, drawn pointing up. The others follow the clock on springs of their own.
      s.group({ rotate: alarm.carried(p).rotate, carried: true }, () => {
        s.surface(stick(0, 0, R * 0.76, R * 0.018), { material: 'plastic-black', bevel: 0.5, zEdge: 0.3, zTop: 0.7 });
        s.cut(stick(0, R * 0.69, R * 0.75, R * 0.016), { ink: tip });
      });
      const baton = (a: number, len: number, z: number) => {
        s.surface(stick(a, 0, len, R * 0.034), { material, bevel: 0.8, zEdge: z, zTop: z + 0.5 });
        s.cut(stick(a, len * 0.8, len * 0.95, R * 0.018), { ink: linear(lume) });
      };
      baton(p.springs.h!.value, R * 0.69, 0.8);
      baton(p.springs.m!.value, R * 0.88, 1.4);
      const a = p.springs.s!.value, top = 2.1;
      s.surface(poly([polar(0, 0, R * 0.88, a), polar(0, 0, R * 0.03, a + 1.3), polar(0, 0, R * 0.03, a - 1.3)]), { material: tick, bevel: 0.3, zEdge: top, zTop: top + 0.3 });
      s.surface(stick(a + Math.PI, 0, R * 0.15, R * 0.024), { material: tick, bevel: 0.4, zEdge: top, zTop: top + 0.3 });
      s.surface(circle(0, 0, R * 0.084), { material: tick, profile: 'dome', zEdge: top, zTop: top + 0.8 });
    });
  },
});

// A clear round dome over what's under it, as wide as its box. Goes after what it covers.
definePart({
  selector: '[d-glass~="crystal"]',
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2;
    s.glass(circle(p.x + p.w / 2, p.y + p.h / 2, R), { height: num(p, 'height', 1.4), bevel: R * num(p, 'dome', 0.7), curve: num(p, 'curve', 0.6), rim: 1, coat: num(p, 'coat', 0.7) });
  },
});

// A tape reel. `spin` is turns per second and `fill` how much tape it holds, 0 to 1.
definePart({
  selector: '[d-tape~="reel"]',
  live: ['spin', 'fill'],
  tick(p, dt) {
    const spin = num(p, 'spin', 0);
    if (!spin || reduced()) return false;
    p.data.angle = (((p.data.angle ?? 0) as number) + spin * dt * Math.PI * 2) % (Math.PI * 2);
    return true;
  },
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const name = p.el.getAttribute('material') || 'brushed-aluminium', a = (p.data.angle ?? 0) as number;
    const fill = Math.max(0.3, num(p, 'fill', 0.7) * 0.92);
    s.well(circle(cx, cy, R), 0.4, { bevel: 2 });
    s.surface(circle(cx, cy, R * fill), { material: 'tape', profile: 'flat', zEdge: 0.5, zTop: 0.5 });
    let windows = '';
    for (let i = 0; i < 3; i++) {
      const c = (i * Math.PI * 2) / 3;
      windows += ` ${sector(100, 100, 34, 88, c - 0.72, c + 0.72)}`;
    }
    const disc = `M100 2 A98 98 0 1 1 99.99 2 Z${windows}`;
    s.surface(path(disc, cx - R, cy - R, R * 2, R * 2, { viewBox: [0, 0, 200, 200], rotate: a, rule: 'evenodd', spread: 3 }), {
      material: name, radial: true, bevel: 2, zEdge: 1, zTop: 1.8, over: { aniso: 0.6 },
    });
    s.surface(circle(cx, cy, R * 0.15), { material: 'black-oxide', bevel: 3, zEdge: 1.8, zTop: 3.6 });
    for (let i = 0; i < 3; i++) {
      const t = a + (i * Math.PI * 2) / 3, x = cx + Math.sin(t) * R * 0.09, y = cy - Math.cos(t) * R * 0.09;
      s.cut(rect(x - 1.5, y - R * 0.035, 3, R * 0.07, { rotate: t }), { depth: 1, ink: [0.01, 0.01, 0.01] });
    }
  },
});

// A cassette behind a window, with its hubs one above the other. `spin` is turns a second at the fuller hub, and
// it gets there and stops the way a tape does, not at once. `axle` is how far in from the left the hubs sit.
definePart({
  selector: '[d-tape~="cassette"]',
  springs: { speed: spring({ mass: 24, return: 0.02, friction: 0.5 }) },
  live: ['spin'],
  update(p) {
    p.springs.speed!.set(num(p, 'spin', 0));
  },
  tick(p, dt) {
    const v = p.springs.speed!.value;
    if (Math.abs(v) < 0.002 || reduced()) return false;
    p.data.angle = (((p.data.angle ?? 0) as number) + v * dt * Math.PI * 2) % (Math.PI * 2);
    return true;
  },
  paint(s, p) {
    const pane = rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 1.5) * MM }), a = (p.data.angle ?? 0) as number;
    const x = p.x + (p.el.hasAttribute('axle') ? num(p, 'axle', 0) * MM : p.w / 2), mid = p.y + p.h / 2, apart = p.h * 0.3, R = Math.min(p.w, p.h) * 0.183;
    s.surface(pane, { material: 'well', bevel: 1, zEdge: 0, zTop: -2.4 });
    s.surface(rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, { radius: 4 }), { material: 'glass-black', bevel: 1, zEdge: -2.4, zTop: -2.2 });
    // The fuller pack turns slower, and both are cut off by the window.
    ([[-apart, 2.5, 1], [apart, 1.7, 1.45]] as const).forEach(([dy, pack, gear]) => {
      const y = mid + dy, turned = a * gear;
      s.surface(intersect(circle(x, y, R * pack), rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2)), { material: 'tape', profile: 'flat', zEdge: -2.1, zTop: -2.1 });
      s.surface(circle(x, y, R), { material: 'brass', bevel: 1.2, zEdge: -2.1, zTop: -1.2 });
      s.surface(circle(x, y, R * 0.8), { material: 'plastic-black', bevel: 1, zEdge: -2, zTop: -1.6 });
      s.group({ at: [x, y], rotate: turned }, () => {
        for (let k = 0; k < 3; k++) s.surface(stick((k * Math.PI * 2) / 3, R * 0.14, R * 0.6, R * 0.055), { material: 'plastic-white', bevel: 0.4, zEdge: -1.6, zTop: -1.3 });
      });
    });
    const w = p.w * 0.615, h = p.h * 0.35, plate = rect(x - w / 2, mid - h / 2, w, h, { radius: 2 });
    s.surface(plate, { material: 'aluminium-silver', bevel: 0.8, zEdge: -2.1, zTop: -1.2 });
    s.surface(holes(x - w / 2 + 1, mid - h / 2 + 1, w - 2, h - 2, { pitch: 2.6, hole: 0.7, radius: 1, square: true }), { material: 'well', bevel: 0.3, zEdge: -1.2, zTop: -1.5 });
    s.glass(pane, { height: 0.4, bevel: 4, coat: 0.6 });
  },
});

/** How far an edge key has gone in, css px: its `travel` in mm, or most of what stands out. */
const inward = (p: Part) => p.springs.press!.value * (p.el.hasAttribute('travel') ? num(p, 'travel', 0) * MM : (words(p).includes('top') ? p.h : p.w) * 0.7);

// It goes in whole, sideways, and the case hides what's gone in.
const edgeIn = (p: Part) => {
  const down = inward(p);
  return words(p).includes('top') ? { x: 0, y: down, rotate: 0, pin: [0, 0] as [number, number] } : { x: -down, y: 0, rotate: 0, pin: [0, 0] as [number, number] };
};

const edgekey = (o: { latch?: boolean }) => ({
  ...press({ mass: 16, material: 'steel-on-steel', sound: o.latch ? 'transport' : undefined, ...o }),
  label: false,
  options: ['right', 'top'],
  cap: 'satin-steel',
  own: true,
  carried: edgeIn,
  draw(s: Sheet, p: Part, d: DeviceInfo, k: KeyCap) {
    const top = words(p).includes('top'), material = k.cap, c = edgeIn(p);
    const along = top ? p.w : p.h, out = top ? p.h : p.w, under = 10, r = Math.min(out * 0.3, 2.5);
    // Drawn out, from the part's top left, in the group its joint carries in.
    s.group({ at: [p.x + c.x, p.y + c.y], carried: true }, () => {
      s.surface(top ? rect(0, 0, p.w, p.h + under, { radius: r }) : rect(-under, 0, p.w + under, p.h, { radius: r }), {
        material, bevel: 1.6, zEdge: -3, zTop: 0.6,
      });
      const ribs = num(p, 'ribs', Math.floor(along / 4));
      for (let i = 1; i < ribs; i++) {
        const at = (i * along) / ribs, l = out * 0.7;
        s.cut(top ? rect(at - 0.5, 1, 1, l) : rect(p.w - l - 1, at - 0.5, l, 1), { depth: 0.2, ink: [0.03, 0.03, 0.03] });
      }
    });
    k.focus(rect(p.x, p.y, p.w, p.h, { radius: r }));
  },
});

// A key that stands out of the edge of a case and goes in sideways, ribbed across its end. `d-key="edge right"` or
// `"edge top"`, and the box is as much of it as stands out. On a label round a checkbox it stays in, as a tape key does.
definePart(key('label[d-key~="edge"]', edgekey({ latch: true })));
definePart(key('button[d-key~="edge"]', edgekey({})));

// A turntable platter, with a three armed spindle and marks to see it turn by. `rpm` is where it's headed, and it's
// heavy, so it takes its time to get there and to stop, unless `rise` gives the seconds its motor takes.
// `d-turntable="platter strobe"` is a deck's platter instead: rows of strobe dots round a dark band, a bright chamfer, a ribbed
// mat, and a record on it with `label` for the material of its label and `words` the two lines printed on that. `strobe` is each row's radius:count:dot radius, in mm.
definePart({
  selector: '[d-turntable~="platter"]',
  springs: { speed: spring({ mass: 300, return: 0.012, friction: 0.5 }) },
  live: ['rpm'],
  update(p) {
    p.springs.speed!.set(num(p, 'rpm', 0));
  },
  tick(p, dt) {
    const rise = num(p, 'rise', 0);
    if (rise) p.data.speed = (((p.data.speed ?? 0) as number) + (num(p, 'rpm', 0) - ((p.data.speed ?? 0) as number)) * (1 - Math.exp((-3 * dt) / rise)));
    const v = rise ? (p.data.speed as number) : p.springs.speed!.value;
    if (Math.abs(v) < 0.02 || reduced()) return false;
    p.data.angle = (((p.data.angle ?? 0) as number) + (v / 60) * dt * Math.PI * 2) % (Math.PI * 2);
    return true;
  },
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, angle = (p.data.angle ?? 0) as number;
    if (isWord(p, 'strobe')) {
      const TOP = 16, inner = num(p, 'mat', 149) * MM, label = p.el.getAttribute('label'), rows = dots(p.el.getAttribute('strobe') ?? '');
      s.surface(circle(cx, cy, R + 1.2 * MM), { material: 'well', bevel: 1, zEdge: 0, zTop: -1.2 });
      s.group({ at: [cx, cy], rotate: angle }, () => {
        s.surface(circle(0, 0, R), { material: p.el.getAttribute('material') || 'anodised-graphite', bevel: 3, zEdge: 0, zTop: TOP });
        s.surface(ring(circle(0, 0, R - 0.5 * MM), 1 * MM), { material: 'satin-chrome', bevel: 0.8, zEdge: TOP, zTop: TOP + 0.5 });
        for (const [r, n, hole] of rows) {
          const row = Array.from({ length: n }, (_, i) => circle(...polar(0, 0, r * MM, (i * Math.PI * 2) / n), hole * MM));
          s.surface(union(...row), { material: 'satin-chrome', bevel: 0.8, zEdge: TOP, zTop: TOP + 0.5 });
        }
        s.surface(ring(circle(0, 0, inner + 2.5 * MM), 5 * MM), { material: 'aluminium-silver', bevel: 3, zEdge: TOP, zTop: TOP + 1.6 });
        s.surface(circle(0, 0, inner), { material: 'rubber', bevel: 2, zEdge: TOP, zTop: TOP + 2.4 });
        if (label) {
          const R2 = inner + 2 * MM;
          s.surface(circle(0, 0, R2), { material: 'gloss-black', bevel: 1.5, zEdge: TOP + 2.4, zTop: TOP + 3.2 });
          for (let r = 55; r < 146; r += 17) s.cut(ring(circle(0, 0, r * MM), 0.5 * MM), { depth: 0.2, ink: [0.03, 0.03, 0.03], soft: 0.6 });
          s.surface(circle(0, 0, 50 * MM), { material: label, bevel: 0.8, zEdge: TOP + 3.2, zTop: TOP + 3.3 });
          const [top = '', bottom = ''] = (p.el.getAttribute('words') ?? '').split(',');
          s.cut(ring(circle(0, 0, 44 * MM), 0.5 * MM), { ink: [0.02, 0.02, 0.02] });
          s.cut(text(top, -36 * MM, -30 * MM, 72 * MM, 14 * MM, { font: `700 ${10 * MM}px Georgia, serif`, align: 'center' }), { ink: [0.02, 0.02, 0.02] });
          s.cut(text(bottom, -30 * MM, 16 * MM, 60 * MM, 9 * MM, { font: `500 ${6 * MM}px Helvetica, sans-serif`, align: 'center' }), { ink: [0.02, 0.02, 0.02] });
        } else for (let r = 60; r < 146; r += 17) s.surface(ring(circle(0, 0, r * MM), 1.4 * MM), { material: 'rubber', bevel: 1, zEdge: TOP + 2.4, zTop: TOP + 3 });
        s.surface(circle(0, 0, 3.6 * MM), { material: 'polished-steel', profile: 'dome', zEdge: TOP + 3, zTop: TOP + 10 });
      });
      return;
    }
    const material = p.el.getAttribute('material') || 'hull-white', n = num(p, 'marks', 5);
    s.surface(circle(cx, cy, R + 1.2), { material: 'well', bevel: 1, zEdge: 0, zTop: -0.6 });
    s.group({ at: [cx, cy], rotate: angle }, () => {
      s.surface(circle(0, 0, R), { material, bevel: 3, zEdge: 0, zTop: 1.4 });
      for (let i = 0; i < n; i++) s.cut(stick((i * Math.PI * 2) / n, R * 0.83, R * 0.91, R * 0.012), { ink: [0.012, 0.012, 0.012] });
      for (let i = 0; i < 3; i++) s.surface(stick((i * Math.PI * 2) / 3, 0, R * 0.14, R * 0.035), { material: 'aluminium-space', bevel: 1.5, zEdge: 1.4, zTop: 3.6 });
      s.surface(circle(0, 0, R * 0.05), { material: 'aluminium-space', profile: 'dome', zEdge: 3, zTop: 5 });
    });
  },
});

// In mm from the pin, along an arm 200mm long, for its left and right edges: wide at the pin, thin, then the head.
const ARM: [number, number, number?][] = [[-7, -12, 7], [7, -12, 7], [6, 20, 30], [4.5, 60, 60], [4, 150, 30], [3.5, 172, 8], [9, 190, 5], [8, 206, 5], [-8, 208, 6], [-7, 188, 6], [-4, 172, 8], [-4, 150, 30], [-4.5, 60, 60], [-6, 20, 30]];
const arm = turn({
  mass: 20, material: 'ball-bearing', input: true, hubless: true, stops: { at: p => [0, num(p, 'sweep', 62)] },
  at: p => {
    const [x = p.w, y = 0] = nums(p, 'pivot', []).map(v => v * MM);
    return [x, y];
  },
});

// The centre line of an S arm in mm from the pin, 228 mm from pin to stylus, as it lies at rest.
const TUBE: [number, number][] = [[-3, 0], [-3, 34], [0.5, 67], [11, 115], [12, 138], [1.6, 161], [-12, 184]];
/** Round a line through points into a band of half width w. */
const band = (points: readonly (readonly [number, number])[], w: number) => {
  const line: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b, c, d] = [points[Math.max(i - 1, 0)]!, points[i]!, points[i + 1]!, points[Math.min(i + 2, points.length - 1)]!];
    for (let t = 0; t < 1; t += 0.25) {
      const at = (n: 0 | 1) => 0.5 * (2 * b[n] + (c[n] - a[n]) * t + (2 * a[n] - 5 * b[n] + 4 * c[n] - d[n]) * t * t + (3 * b[n] - a[n] - 3 * c[n] + d[n]) * t * t * t);
      line.push([at(0), at(1)]);
    }
  }
  line.push([...points[points.length - 1]!]);
  const side = (sign: number) => line.map(([x, y], i) => {
    const [ax, ay] = line[Math.max(i - 1, 0)]!, [bx, by] = line[Math.min(i + 1, line.length - 1)]!, l = Math.hypot(bx - ax, by - ay) || 1;
    return [x + (sign * w * (by - ay)) / l, y - (sign * w * (bx - ax)) / l] as [number, number];
  });
  return [...side(1), ...side(-1).reverse()];
};

// A moulded pickup arm on a pin, resting along +y. `pivot` is the pin's x, y in mm from the top left and `length` is
// pin to stylus in mm. Wraps a range input, whose ends are the rest and the end of the record, `sweep` degrees on.
// `d-turntable="tonearm s"` is a deck's arm: a bent tube with a headshell and cartridge, a gimbal, and a counterweight behind the pin.
definePart({
  selector: '[d-turntable~="tonearm"]',
  ...arm,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'gloss-white', reach = p.el.hasAttribute('length') ? num(p, 'length', 0) * MM : p.h;
    if (isWord(p, 's')) {
      const k = reach / (228 * MM), mm = (n: number) => n * k, Z = 34;
      s.group(arm.place(p), () => {
        const cylinder = (x: number, y0: number, y1: number, half: number, name: string, z = Z) => s.surface(rect(mm(x - half), mm(y0), mm(half * 2), mm(y1 - y0), { radius: 1 }), { material: name, profile: 'round', bevel: mm(half), zEdge: z, zTop: z + half * 0.8 });
        // Behind the pin: the stem, then the weight on it, ringed by grooves and its knurled ends.
        cylinder(3, -36 * 4, -14 * 4, 5 * 4, material);
        s.surface(rect(mm(3 * 4 - 40), mm(-66 * 4), mm(80), mm(8 * 4), { radius: mm(6) }), { material: 'polished-steel', profile: 'round', bevel: mm(14), zEdge: Z, zTop: Z + 6 });
        s.surface(rect(mm(-12 * 4), mm(-61 * 4), mm(30 * 4), mm(26 * 4), { radius: mm(6) }), { material, profile: 'round', bevel: mm(30), zEdge: Z, zTop: Z + 12 });
        for (const [from, to] of [[-61, -54], [-40, -35]] as const) for (let y = from + 0.8; y < to; y += 1.2) s.cut(rect(mm(-12 * 4), mm(y * 4), mm(30 * 4), mm(1.6)), { depth: 0.5, ink: [0.02, 0.02, 0.02], soft: 0.5 });
        s.surface(poly([[-14, -16, 3], [12, -16, 3], [18, 2, 4], [6, 12, 3], [-10, 8, 3]].map(([x, y, r]) => [mm(x! * 4), mm(y! * 4), mm(r! * 4)])), { material: 'anodised-graphite', bevel: mm(6), zEdge: Z - 8, zTop: Z });
        s.surface(poly(band(TUBE.map(([x, y]) => [x * 4, y * 4] as [number, number]), 4.2 * 4).map(([x, y]) => [mm(x), mm(y), mm(14)])), { material, profile: 'round', bevel: mm(4.2 * 4), zEdge: Z, zTop: Z + 6 });
        s.surface(circle(mm(8 * 4), mm(-8 * 4), mm(3 * 4)), { material: 'polished-steel', profile: 'dome', zEdge: Z, zTop: Z + 3 });
        // The collar, then the headshell, along the tube's end.
        const u = Math.atan2(23, -14); // the way the tube leaves its last bend
        s.group({ at: [mm(-12 * 4), mm(184 * 4)], rotate: u - Math.PI / 2 }, () => {
          cylinder(0, -2 * 4, 11 * 4, 7.5 * 4, 'knurled', Z - 2);
          s.surface(poly([[-8.5, 10, 2], [8.5, 10, 2], [8.5, 50, 3], [-8.5, 50, 3]].map(([x, y, r]) => [mm(x! * 4), mm(y! * 4), mm(r! * 4)])), { material: 'anodised-graphite', bevel: mm(3), zEdge: Z - 4, zTop: Z });
          s.surface(rect(mm(-6.5 * 4), mm(20 * 4), mm(13 * 4), mm(22 * 4), { radius: mm(4) }), { material: 'gloss-black', bevel: mm(3), zEdge: Z, zTop: Z + 3 });
          for (const x of [-5.5, 5.5]) s.surface(circle(mm(x * 4), mm(16 * 4), mm(1.2 * 4)), { material: 'foil-gold', profile: 'dome', zEdge: Z, zTop: Z + 1 });
          s.surface(capsule(mm(7 * 4), mm(14 * 4), mm(22 * 4), mm(5 * 4), mm(1.4 * 4), mm(2 * 4)), { material: 'satin-chrome', profile: 'round', bevel: mm(4), zEdge: Z, zTop: Z + 2 });
        });
      });
      return;
    }
    const k = reach / 200;
    s.group(arm.place(p), () => {
      s.surface(poly(ARM.map(([x, y, r]) => [x * k, y * k, r === undefined ? 0 : r * k])), { material, profile: 'round', bevel: 6 * k, zEdge: 5, zTop: 10 });
      s.surface(capsule(7 * k, 198 * k, 15 * k, 199 * k, 1.5 * k, 1.8 * k), { material: 'keycap-ivory', bevel: 1, zEdge: 5, zTop: 7 });
      s.surface(circle(0, 0, 3 * k), { material: 'hull-white', profile: 'dome', zEdge: 10, zTop: 10.4 });
    });
  },
});

// A paper tuning scale behind a narrow window, running down it, and a needle that follows `value`, 0 to 1.
// `d-meter="strip open"` has no paper: the needle and pane run over a scale printed on the recess it sits in. `needle` is the needle's material.
definePart({
  selector: '[d-meter~="strip"]',
  options: ['open'],
  springs: { pos: spring({ mass: 30, return: 0.027, friction: 0.52 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(num(p, 'value', 0.5));
  },
  paint(s, p) {
    const pane = rect(p.x, p.y, p.w, p.h, { radius: 2 }), n = num(p, 'rows', 13), needle = p.el.getAttribute('needle') || 'plastic-red';
    const y = p.y + 5 + p.springs.pos!.value * (p.h - 11);
    // Open, the scale is whatever lies under it, printed on a recess: only the needle and the pane over it are its own.
    if (words(p, 'd-meter').includes('open')) {
      s.surface(rect(p.x + 1, y, p.w - 2, 1), { material: needle, zEdge: 0, zTop: 0.3 });
      s.glass(pane, { height: num(p, 'height', 1.6), bevel: 3, coat: 0.6 });
      return;
    }
    s.surface(pane, { material: 'well', bevel: 1, zEdge: 0, zTop: -1.6 });
    s.surface(rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, { radius: 1 }), { material: p.el.getAttribute('material') || 'keycap-ivory', profile: 'flat', zEdge: -1.5, zTop: -1.5 });
    const ink: Vec3 = [0.1, 0.09, 0.08];
    for (let i = 0; i < n; i++) {
      const y = p.y + 6 + (i * (p.h - 12)) / (n - 1), left = i % 2 ? p.w * 0.25 : p.w * 0.15;
      s.cut(rect(p.x + left, y - 0.3, p.w - left * 2, 0.6), { ink });
    }
    s.surface(rect(p.x + 2, y, p.w - 4, 1), { material: needle, zEdge: -1.5, zTop: -1.2 });
    s.glass(pane, { height: 0.3, bevel: 3, coat: 0.6 });
  },
});

const clearlid = hinge({ mass: 900, material: 'plastic-on-plastic', axis: 'y', travel: -40, sound: 'tapedoor' });

// A clear acrylic lid hinged along the top of its box, seen from above, so opening it closes it up towards the hinge
// until it stands past upright, edge on, and leaves nothing over what it covered.
// Put a button in it, last of all. Shut, it's in the way. Open, only the strip of it standing up can be reached.
definePart({
  selector: '[d-cover~="clear"]',
  layer: 2,
  ...clearlid,
  update(p) {
    clearlid.update?.(p);
    // What stands up is all that's left to take hold of. The button is the joint's, and doesn't turn or shrink by itself.
    p.el.querySelector('button')!.style.clipPath = p.el.hasAttribute('open') ? `inset(0 0 ${p.h - 28}px 0)` : '';
  },
  paint(s, p) {
    const t = clearlid.value(p), h = Math.max(p.h * Math.cos(t * 1.62), 5);
    s.glass(rect(p.x, p.y, p.w, h, { radius: 2 }), { height: 0.4, bevel: 3, coat: 0.5, curve: 0.08, covers: t < 0.5 });
    if (t > 0.02) s.surface(rect(p.x, p.y + h - 1.2, p.w, 1.2), { material: 'glass-black', over: { color: '#dfe6e8' }, bevel: 0.5, zEdge: 2, zTop: 3 });
  },
});

const SEG: Record<string, string> = {
  a: 'M7 3H53L45 12H15Z', b: 'M55 6V46L50 49L46 44V14Z', c: 'M55 94V54L50 51L46 56V86Z', d: 'M7 97H53L45 88H15Z',
  e: 'M5 94V54L10 51L14 56V86Z', f: 'M5 6V46L10 49L14 44V14Z', g: 'M12 50L17 45H43L48 50L43 55H17Z',
};
const DIGIT: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};
const shapeOf = (segments: string) => [...segments].map(k => SEG[k]!).join('');
const RED: Vec3 = [1, 0.1, 0.03];
const tint = (k: number): Vec3 => [RED[0] * k, RED[1] * k, RED[2] * k];

// d-readout="seven" lights too hard for numerals this tall: the bloom comes back as blocks around each digit.
definePart({
  selector: '[d-readout~="seven"][d-readout~="clock"]',
  live: ['#text'],
  paint(s, p) {
    const panel = rect(p.x, p.y, p.w, p.h, { radius: 4 });
    const text = (p.el.textContent ?? '').trim(), pm = text.endsWith('.'), colon = text.includes(':');
    const digits = text.replace(/[^\d]/g, '').padStart(4, ' ');
    const pad = p.h * 0.17, h = p.h - pad * 2, w = h * 0.54, gap = h * 0.16, mid = gap * 1.3;
    let x = p.x + (p.w - (w * 4 + gap * 2 + mid + gap)) / 2;
    s.surface(panel, { material: 'smoked-glass', bevel: 2, zEdge: 0, zTop: 0.5 });
    const lit = { ink: tint(0.5), emit: tint(1.3) };
    [...digits].forEach((ch, i) => {
      const seg = (d: string) => path(d, x, p.y + pad, w, h, { viewBox: [0, 0, 60, 100], spread: 3 });
      s.cut(seg(shapeOf(DIGIT[8]!)), { ink: tint(0.012) });
      if (DIGIT[ch]) s.cut(seg(shapeOf(DIGIT[ch]!)), lit);
      if (i === 1) {
        if (colon) for (const k of [0.3, 0.7]) s.cut(circle(x + w + mid * 0.75, p.y + pad + h * k, h * 0.05), lit);
        x += mid + gap;
      }
      x += w + gap;
    });
    if (pm) s.cut(circle(x - gap * 0.45, p.y + pad + h * 0.93, h * 0.045), lit);
    s.glass(panel, { height: 0.4, bevel: 6, coat: 0.7 });
  },
});

const pad = press({ mass: 11, material: 'rubber-on-plastic', friction: 0.1 });

// A silicone key that glows from under the rubber. A checkbox inside makes it latch. `material` is its rubber and `height`
// how far it stands, mm, `radius` its corners, mm, and `gap` the mm to what holds it. With `through` the LED lights the whole of a pale key, and not a slit, and `level`, 0 to 1, dims it.
definePart(key('[d-key~="step"]', {
  ...pad,
  cap: 'silicone-black',
  own: true,
  springs: { ...pad.springs, on: { stiffness: 300, damping: 26 }, beat: { stiffness: 700, damping: 40 } },
  live: ['beat', 'on', 'level'],
  update(p) {
    const box = p.el.querySelector('input'), level = p.el.getAttribute('level');
    p.springs.on!.set(level !== null ? +level : box ? (box.checked ? 1 : 0) : p.el.hasAttribute('on') ? 1 : 0);
    p.springs.beat!.set(p.el.hasAttribute('beat') ? 1 : 0);
  },
  draw(s, p, d, k) {
    const c = LIGHT[p.el.getAttribute('color') ?? 'amber']!, press = k.down, cap = k.cap, tall = num(p, 'height', 3);
    const on = p.springs.on!.value, beat = p.springs.beat!.value, through = p.el.hasAttribute('through'), level = on * 0.004 + beat * (0.03 + 0.07 * on);
    const r = num(p, 'radius', 2.25) * MM, g = num(p, 'gap', 0.5) * MM, box = rect(p.x, p.y, p.w, p.h, { radius: r }), top = tall - 0.6 * tall * press;
    s.surface(box, { material: 'well', bevel: 1.5, zEdge: 0, zTop: -1.2, over: { emit: scale(c, (through ? on * 0.03 : level) * 0.5) } });
    // Lit through, the rubber is all the light of the LED, and what the room puts on it stops mattering.
    const pale = resolveMaterial(cap).color, tinted = through ? pale.map((v, i) => v + (scale(c, 0.1)[i]! - v) * Math.min(on * 1.6, 1)) as Vec3 : undefined;
    s.surface(rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: Math.max(r - g, 0) }), {
      material: cap, bevel: num(p, 'bevel', 1.75) * MM, zEdge: -0.8, zTop: top, dish: 0.25, over: { emit: scale(c, through ? on * (0.05 + 0.2 * on) : level), ...(tinted && { color: tinted }) },
    });
    legend(s, p, cap, { depth: 0.03 });
    if (through) {
      // Hottest over the LED, and falling off through the rubber.
      if (on > 0.004) s.cut(circle(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.5), { emit: [c[0] * on * on * 0.4, c[1] * on * on * 1.1, c[2] * on * on * 1.6], feather: p.w * 0.42 });
    } else {
      const w = p.w * 0.36, slit = rect(p.x + (p.w - w) / 2, p.y + p.h - 13 + press, w, 3, { radius: 1.5 });
      s.cut(slit, { ink: scale(c, 0.03 + on * 0.04), emit: scale(c, 0.012 + on * 0.5 + beat * 0.4) });
    }
    k.focus(box);
  },
}));

// A speaker cone. `level` pushes it out, 0 to 1.
definePart({
  selector: '[d-opening~="cone"]',
  springs: { level: spring({ mass: 20, return: 0.33, friction: 0.12 }) },
  live: ['level'],
  update(p) {
    p.springs.level!.set(num(p, 'level', 0));
  },
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, out = p.springs.level!.value * 2;
    s.surface(circle(cx, cy, R), { material: 'black-oxide', bevel: 3, zEdge: 0, zTop: 1 });
    s.surface(circle(cx, cy, R * 0.92), { material: 'rubber', bevel: R * 0.07, zEdge: 1, zTop: 0.2 + out * 0.5 });
    s.surface(circle(cx, cy, R * 0.82), {
      material: 'paper-black', profile: 'chamfer', bevel: R * 0.6, zEdge: 0.2 + out * 0.5, zTop: -3 + out,
    });
    s.surface(circle(cx, cy, R * 0.25), { material: 'rubber', profile: 'dome', zEdge: -3 + out, zTop: -0.6 + out, over: { rough: 0.5 } });
  },
});
