// Things that show a value with something moving.
import { arc, circle, definePart, legendColor, mask, MM, path, rect, spring, text, type Part, type Vec3 } from 'device-ui';
import { font, fraction, lamp, num, polar, scale, sector } from './shared.js';
import { bezel as rim, isNeedle, needle, printRing } from './anatomy.js';

const DEG = Math.PI / 180;
const meter = (p: Part) => p.el.querySelector('meter')!;

const ZONE: Record<string, Vec3> = { red: [0.5, 0.03, 0.02], amber: [0.6, 0.3, 0.03], green: [0.04, 0.3, 0.08], blue: [0.04, 0.12, 0.55] };

const dial = (p: Part) => {
  const R = Math.min(p.w, p.h) / 2;
  return {
    cx: p.x + p.w / 2, cy: p.y + p.h / 2, R,
    a0: num(p, 'start', -135) * DEG, a1: num(p, 'end', 135) * DEG,
  };
};

// A moving-coil needle and nothing else, to swing over a face printed with d-mark="scale": a panel meter's, whatever its scale says. It jumps and overshoots, as a light movement does.
// `pivot` is where it turns, as `x y` in mm from the box's corner, the middle of the box unless it's somewhere else, as one below the window is. `length` is mm from there to the tip, to the box's edge by default,
// `hub` how much of that near the pivot is left out, for a hood to hide, and `from` and `to` are its ends in degrees clockwise from straight up. `width` is how wide it is at its foot and `height` how far it stands, both mm, and `color` overrides its material's.
definePart({
  selector: '[d-meter~="needle"]',
  springs: { pos: spring({ mass: 0.5, return: 0.022, friction: 0.16 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(fraction(meter(p)));
  },
  paint(s, p) {
    const [px = p.w / 8, py = p.h / 8] = (p.el.getAttribute('pivot') ?? '').split(/\s+/).filter(Boolean).map(Number);
    const L = num(p, 'length', Math.min(p.w, p.h) / 8) * 4, hub = num(p, 'hub', 0) * 4, from = num(p, 'from', -45), to = num(p, 'to', 45), top = num(p, 'height', 0.5), color = p.el.getAttribute('color');
    const cx = p.x + px * 4, cy = p.y + py * 4, a = (from + (to - from) * p.springs.pos!.value) * DEG, base = 100 * (1 - hub / L), foot = p.el.hasAttribute('width') ? (num(p, 'width', 0) * 100) / L : 0.6, tip = foot / 4;
    s.surface(path(`M${50 - foot} ${base} L${50 - tip} 0 H${50 + tip} L${50 + foot} ${base} Z`, cx - L, cy - L, L * 2, L * 2, { viewBox: [0, 0, 100, 200], rotate: a, spread: 3 }), {
      material: p.el.getAttribute('material') || 'lacquer-black', zEdge: top - 0.2, zTop: top, bevel: 0.3, ...(color ? { over: { color } } : {}),
    });
  },
});

// `<div d-meter="gauge" ticks="10" zones="80-100 red"><meter min="0" max="100" value="40"></div>`. `flush` sets its bezel
// in flat, chamfered, in place of the rolled rim.
definePart({
  selector: '[d-meter~="gauge"]',
  springs: { pos: spring({ mass: 1, return: 0.0015, friction: 0.056 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(fraction(meter(p)));
  },
  mask(ctx, p) {
    const { cx, cy, R, a0, a1 } = dial(p);
    const m = meter(p), min = +m.min, max = +m.max;
    const n = num(p, 'ticks', 10), sub = num(p, 'minor', 5), r = R * 0.76;
    const labels = !p.el.hasAttribute('nolabels');
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(p, Math.max(R * 0.13, 7.5));
    for (let i = 0; i <= n * sub; i++) {
      const a = a0 + (a1 - a0) * (i / (n * sub)), major = i % sub === 0;
      const [x0, y0] = polar(cx, cy, r - (major ? R * 0.09 : R * 0.05), a), [x1, y1] = polar(cx, cy, r, a);
      ctx.lineWidth = major ? 1.8 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (major && labels) {
        const [tx, ty] = polar(cx, cy, r - R * 0.2, a);
        const v = min + (max - min) * (i / (n * sub));
        ctx.fillText(String(Math.round(v * 10) / 10), tx, ty);
      }
    }
    const label = p.el.getAttribute('label');
    if (label) {
      ctx.font = font(p, Math.max(R * 0.1, 7), 500);
      ctx.fillText(label, cx, cy + R * 0.42);
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const { cx, cy, R, a0, a1 } = dial(p);
    const face = p.el.getAttribute('material') || 'dial-black';
    const bezel = p.el.getAttribute('bezel') || 'chrome';
    const m = meter(p), min = +m.min, span = +m.max - min;
    s.group({ at: [cx, cy], scale: MM }, () => rim(s, { w: (R * 2) / MM, wall: (R * 0.14) / MM, height: 3.4, floor: 0.4, flush: p.el.hasAttribute('flush'), material: bezel, over: { wear: d.wear * 0.4 } }));
    s.surface(circle(cx, cy, R * 0.86), { material: face, profile: 'flat', zEdge: 0.4, zTop: 0.4, over: { wear: 0 } });
    // A pin just short of zero stops the needle falling past it, as on any moving-coil gauge.
    const [px, py] = polar(cx, cy, R * 0.66, a0 - 5 * DEG);
    s.surface(circle(px, py, 0.5 * MM), { material: 'satin-steel', profile: 'dome', zEdge: 0.4, zTop: 1.6 });
    for (const zone of (p.el.getAttribute('zones') ?? '').split(',')) {
      const z = /^\s*(-?[\d.]+)-(-?[\d.]+)\s+(\w+)/.exec(zone);
      if (!z) continue;
      const t0 = (+z[1]! - min) / span, t1 = (+z[2]! - min) / span, a = a0 + (a1 - a0) * t0, b = a0 + (a1 - a0) * t1;
      const c = R, r = R * 0.76;
      s.cut(path(sector(c, c, r - R * 0.045, r, a, b), cx - R, cy - R, R * 2, R * 2, { viewBox: [0, 0, R * 2, R * 2], spread: 3 }), { ink: ZONE[z[3]!] ?? ZONE.red! });
    }
    if (p.mask) s.cut(mask(p.mask), { ink: legendColor(face) });
    const a = a0 + (a1 - a0) * p.springs.pos!.value, L = (R * 0.8) / MM, kind = p.el.getAttribute('needle');
    s.group({ at: [cx, cy], rotate: a, scale: MM }, () => needle(s, isNeedle(kind) ? kind : 'bar', L * 0.92, { tail: L * 0.26, width: L * 0.07, hub: (R * 0.09) / MM }));
    s.glass(circle(cx, cy, R * 0.86), { height: 1.4, bevel: R * 0.7, coat: 0.4 });
  },
});

// A panel meter: a moving coil behind a clear square front, its needle swinging through 90 degrees from a pivot low on a white face.
// `ticks` and `minor` set the scale as on a gauge, `label` prints the unit, and `material` is the face. Spec: a 60mm square
// front with about a 45mm scale radius, as on a common DIN panel ammeter.
definePart({
  selector: '[d-meter~="panel"]',
  springs: { pos: spring({ mass: 1.2, return: 0.0015, friction: 0.07 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(fraction(meter(p)));
  },
  mask(ctx, p) {
    const { cx, py, r } = panelDial(p), m = meter(p), min = +m.min, max = +m.max, n = num(p, 'ticks', 5), sub = num(p, 'minor', 5);
    const labels = Array.from({ length: n + 1 }, (_, i) => String(Math.round((min + ((max - min) * i) / n) * 10) / 10));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, py, r, -Math.PI / 2 - Math.PI / 4, -Math.PI / 2 + Math.PI / 4);
    ctx.stroke();
    printRing(ctx, cx, py, { inner: r, outer: r + r * 0.09, ticks: n * sub + 1, major: sub, sweep: 45, labels, gap: r * 0.03, font: font(p, Math.max(r * 0.1, 7)) });
    const label = p.el.getAttribute('label');
    if (label) {
      ctx.font = font(p, Math.max(r * 0.12, 8), 600);
      ctx.fillText(label, cx, py - r * 0.42);
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const { cx, py, r } = panelDial(p), face = p.el.getAttribute('material') || 'dial-cream', g = 2.5 * MM;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 1.5 * MM }), { material: 'plastic-black', profile: 'chamfer', bevel: 1.5 * MM, zEdge: 0, zTop: 4, over: { wear: d.wear * 0.4 } });
    const window = rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: 0.8 * MM });
    s.surface(window, { material: face, profile: 'flat', zEdge: 0.6, zTop: 0.6, over: { wear: 0 } });
    if (p.mask) s.cut(mask(p.mask), { ink: legendColor(face) });
    const a = -Math.PI / 4 + (Math.PI / 2) * p.springs.pos!.value;
    s.group({ at: [cx, py], rotate: a, scale: MM }, () => needle(s, 'lance', (r * 1.08) / MM, { tail: 2, width: 0.9, z: 1.2, material: 'lacquer-black' }));
    // The coil's cover hides the pivot: a black half-disc along the foot of the face.
    s.surface(circle(cx, py + r * 0.04, r * 0.22), { material: 'plastic-black', profile: 'round', bevel: r * 0.06, zEdge: 0.6, zTop: 2.4 });
    s.surface(rect(p.x + g, py + r * 0.04, p.w - g * 2, p.y + p.h - g - py - r * 0.04), { material: 'plastic-black', bevel: 0.2 * MM, zEdge: 0.6, zTop: 2.4 });
    s.glass(window, { height: 3, bevel: 1.2 * MM, coat: 0.6 });
  },
});

/** Where a panel meter's needle swings from, and how long its scale's radius is. */
const panelDial = (p: Part) => ({ cx: p.x + p.w / 2, py: p.y + p.h * 0.76, r: Math.min(p.h * 0.56, p.w * 0.46) });

// A backlit level meter, its needle swinging from a pivot hidden below the window.
definePart({
  selector: '[d-meter~="vu"]',
  springs: { pos: spring({ mass: 0.5, return: 0.0028, friction: 0.2 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(fraction(meter(p)));
  },
  mask(ctx, p) {
    const cx = p.x + p.w / 2, py = p.y + p.h * 1.08, r = p.h * 0.86, spread = Math.min(0.72, (p.w * 0.46) / r);
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, py, r, -Math.PI / 2 - spread, -Math.PI / 2 + spread * 0.42);
    ctx.stroke();
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = -spread + ((spread * 2) * i) / n;
      const [x0, y0] = polar(cx, py, r, a), [x1, y1] = polar(cx, py, r + (i % 2 ? 4 : 7), a);
      ctx.lineWidth = i % 2 ? 1 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.font = font(p, Math.max(p.h * 0.15, 9), 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.el.getAttribute('label') ?? 'VU', cx, p.y + p.h * 0.56);
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, py = p.y + p.h * 1.08, r = p.h * 0.86, spread = Math.min(0.72, (p.w * 0.46) / r);
    const face = p.el.getAttribute('material') || 'dial-cream';
    const warm: Vec3 = p.el.hasAttribute('dark') ? [0, 0, 0] : [0.2, 0.135, 0.05];
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 4 }), { material: 'black-oxide', bevel: 2.5, zEdge: 0, zTop: 2.2, over: { wear: d.wear * 0.5 } });
    const inset = rect(p.x + 5, p.y + 5, p.w - 10, p.h - 10, { radius: 2 });
    s.surface(inset, { material: face, profile: 'flat', zEdge: -0.8, zTop: -0.8, over: { emit: warm, wear: 0 } });
    const R = p.h * 1.2;
    s.cut(path(sector(R, R, r + 1, r + 4, spread * 0.42, spread), cx - R, py - R, R * 2, R * 2, { viewBox: [0, 0, R * 2, R * 2], spread: 3 }), { ink: ZONE.red! });
    if (p.mask) s.cut(mask(p.mask), { ink: legendColor(face) });
    const a = -spread * 1.08 + spread * 2.16 * p.springs.pos!.value, L = r + 10;
    // It stops short of the pivot, which sits outside the part, so nothing shows under the hood.
    const y0 = 100 * (1 - (p.h * 0.22) / L);
    s.surface(path(`M49.5 ${y0} L49.8 0 H50.2 L50.5 ${y0} Z`, cx - L, py - L, L * 2, L * 2, { viewBox: [0, 0, 100, 200], rotate: a, spread: 3 }), {
      material: 'lacquer-black', zEdge: -0.2, zTop: -0.1, bevel: 0.4,
    });
    s.surface(rect(p.x + 5, p.y + p.h * 0.8, p.w - 10, p.h * 0.2 - 5), { material: 'black-oxide', bevel: 2, zEdge: -0.8, zTop: 1.2 });
    s.glass(inset, { height: 0.5, bevel: 8, coat: 0.8 });
  },
});

// A row of segments. The top of the range shows amber, then red. `from="end"` fills it from the far end instead.
definePart({
  selector: '[d-meter~="bargraph"]',
  springs: { level: { stiffness: 900, damping: 40 } },
  live: ['value'],
  update(p) {
    p.springs.level!.set(fraction(meter(p)));
  },
  paint(s, p) {
    const n = num(p, 'segments', 12), up = p.h > p.w, level = p.springs.level!.value, end = p.el.getAttribute('from') === 'end';
    const single = p.el.getAttribute('color');
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 2 }), { material: 'black-oxide', bevel: 1, zEdge: 0, zTop: 0.4 });
    const pad = 2.5, len = (up ? p.h : p.w) - pad * 2, gap = 1.5, seg = (len - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const t = i / n, c = single ? lamp(p) : lamp({ el: { getAttribute: () => (t > 0.86 ? 'red' : t > 0.66 ? 'amber' : 'green') } } as unknown as Part);
      const at = pad + (end ? n - 1 - i : i) * (seg + gap), on = Math.min(1, Math.max(0, (level - t) * n));
      const box = up ? rect(p.x + pad, p.y + p.h - at - seg, p.w - pad * 2, seg, { radius: 0.8 }) : rect(p.x + at, p.y + pad, seg, p.h - pad * 2, { radius: 0.8 });
      s.surface(box, {
        material: 'glass-red', profile: 'flat', zEdge: 0.3, zTop: 0.3,
        over: { color: scale(c, 0.006), emit: scale(c, 0.15 * on), rough: 0.3 },
      });
    }
  },
});

const handOf = (cx: number, cy: number, a: number, len: number, tail: number, w: number) => {
  const mid = (len - tail) / 2, [x, y] = polar(cx, cy, mid, a), l = len + tail;
  return rect(x - w / 2, y - l / 2, w, l, { rotate: a, radius: w / 2 });
};

// A wall clock. Follows the computer's clock, or `time="10:08:30"` if set.
definePart({
  selector: '[d-meter~="clock"]',
  springs: { h: spring({ mass: 5, return: 0.033, friction: 0.63 }), m: spring({ mass: 5, return: 0.033, friction: 0.63 }), s: spring({ mass: 1, return: 0.1, friction: 0.021 }) },
  live: ['time'],
  update(p) {
    const fixed = p.el.getAttribute('time')?.split(':').map(Number);
    const now = new Date();
    const [h, m, s] = fixed ?? [now.getHours(), now.getMinutes(), now.getSeconds()];
    const sec = s ?? 0, min = (m ?? 0) + sec / 60, hour = ((h ?? 0) % 12) + min / 60;
    const last = (p.data.s ?? -1) as number;
    // The second hand runs on through twelve, it does not swing all the way back.
    p.data.laps = ((p.data.laps ?? 0) as number) + (sec < last ? 1 : 0);
    p.data.s = sec;
    p.springs.h!.set(hour * 30 * DEG);
    p.springs.m!.set(min * 6 * DEG);
    p.springs.s!.set((sec + 60 * (p.data.laps as number)) * 6 * DEG);
  },
  connect(p) {
    const id = setInterval(() => p.def.update!(p), 1000);
    return () => clearInterval(id);
  },
  mask(ctx, p) {
    const { cx, cy, R } = dial(p), r = R * 0.8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(p, R * 0.18);
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * DEG, big = i % 5 === 0;
      const [x0, y0] = polar(cx, cy, r, a), [x1, y1] = polar(cx, cy, r - (big ? R * 0.07 : R * 0.03), a);
      ctx.lineWidth = big ? 2 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (big) {
        const [tx, ty] = polar(cx, cy, r - R * 0.19, a);
        ctx.fillText(String(i / 5 || 12), tx, ty);
      }
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const { cx, cy, R } = dial(p);
    const face = p.el.getAttribute('material') || 'dial-white';
    const bezel = p.el.getAttribute('bezel') || 'brass';
    s.surface(circle(cx, cy, R), { material: bezel, bevel: R * 0.1, zEdge: 0, zTop: 3.6, over: { wear: d.wear * 0.4 } });
    s.surface(circle(cx, cy, R * 0.88), { material: face, profile: 'flat', zEdge: 0.4, zTop: 0.4, over: { wear: 0 } });
    if (p.mask) s.cut(mask(p.mask), { ink: legendColor(face) });
    const hand = { material: 'lacquer-black', bevel: 0.8 };
    s.surface(handOf(cx, cy, p.springs.h!.value, R * 0.46, R * 0.08, Math.max(R * 0.05, 2.5)), { ...hand, zEdge: 1, zTop: 1.3 });
    s.surface(handOf(cx, cy, p.springs.m!.value, R * 0.68, R * 0.1, Math.max(R * 0.035, 2)), { ...hand, zEdge: 1.4, zTop: 1.7 });
    s.surface(handOf(cx, cy, p.springs.s!.value, R * 0.72, R * 0.16, 1.7), { material: 'needle', bevel: 0.5, zEdge: 1.8, zTop: 2 });
    s.surface(circle(cx, cy, R * 0.05), { material: 'chrome', profile: 'dome', zEdge: 1.8, zTop: 2.6 });
    s.glass(circle(cx, cy, R * 0.88), { height: 1.4, bevel: R * 0.72 });
  },
});

// A compass card floating on a heading, in degrees.
definePart({
  selector: '[d-meter~="compass"]',
  springs: { heading: spring({ mass: 2, return: 0.00018, friction: 0.016 }) },
  live: ['value'],
  update(p) {
    p.springs.heading!.set(num(p, 'value', 0) * DEG);
  },
  paint(s, p) {
    const { cx, cy, R } = dial(p);
    const a = -p.springs.heading!.value;
    s.surface(circle(cx, cy, R), { material: 'brass', bevel: R * 0.12, zEdge: 0, zTop: 3.8 });
    s.surface(circle(cx, cy, R * 0.86), { material: 'dial-black', profile: 'flat', zEdge: 0.3, zTop: 0.3, over: { wear: 0 } });
    const r = R * 0.8;
    for (let i = 0; i < 36; i++) {
      const t = a + i * 10 * DEG, big = i % 9 === 0, l = big ? R * 0.13 : R * 0.07;
      const [x, y] = polar(cx, cy, r - l / 2, t);
      s.cut(rect(x - 0.6, y - l / 2, 1.2, l, { rotate: t }), { ink: [0.75, 0.74, 0.68] });
    }
    (['N', 'E', 'S', 'W'] as const).forEach((c, i) => {
      const t = a + (i * Math.PI) / 2, [x, y] = polar(cx, cy, r - R * 0.25, t), b = R * 0.3;
      s.cut(text(c, x - b / 2, y - b / 2, b, b, { font: `600 ${R * 0.17}px Helvetica, Arial, sans-serif`, rotate: t, spread: 2 }), { ink: i ? [0.75, 0.74, 0.68] : [0.6, 0.05, 0.03] });
    });
    const needle = path('M100 18 L108 100 H92 Z', cx - r, cy - r, r * 2, r * 2, { viewBox: [0, 0, 200, 200], rotate: a, spread: 3 });
    s.surface(needle, { material: 'needle', bevel: 2, zEdge: 1, zTop: 1.6 });
    const back = path('M92 100 H108 L100 182 Z', cx - r, cy - r, r * 2, r * 2, { viewBox: [0, 0, 200, 200], rotate: a, spread: 3 });
    s.surface(back, { material: 'chrome', bevel: 2, zEdge: 1, zTop: 1.6 });
    s.surface(circle(cx, cy, R * 0.07), { material: 'brass', profile: 'dome', zEdge: 1.4, zTop: 2.6 });
    s.glass(circle(cx, cy, R * 0.86), { height: 1.6, bevel: R * 0.72, coat: 0.4 });
  },
});


// A ring that closes as the value rises.
definePart({
  selector: '[d-meter~="ring"]',
  springs: { pos: spring({ mass: 1, return: 0.0021, friction: 0.66 }) },
  live: ['value'],
  update(p) {
    p.springs.pos!.set(fraction(meter(p)));
  },
  paint(s, p) {
    const { cx, cy, R } = dial(p), width = p.el.hasAttribute('width') ? num(p, 'width', 0) * MM : R * 0.14, c = lamp(p, 'green');
    const a0 = num(p, 'start', 0) * DEG, a1 = num(p, 'end', 360) * DEG, r = R - width / 2, t = p.springs.pos!.value;
    s.cut(arc(cx, cy, r, a0, a1, width), { ink: scale(c, 0.012), emit: scale(c, 0.012) });
    if (t > 0.002) s.cut(arc(cx, cy, r, a0, a0 + (a1 - a0) * t, width), { ink: scale(c, 0.05), emit: scale(c, num(p, 'gain', 0.12)) });
  },
});
