// A sewing machine's works, and the controls on its casting. One turn of the handwheel is one stitch: the needle, the take-up and the feed all hang off that shaft through linkages with no give in them. The body is a surface: its outline is the object's own.
import { capsule, circle, definePart, defineStyles, driven, ellipse, FOCUS, light, linear, MM, poly, rect, slide, text, turn, partOf, type LightHandle, type Part, type Sheet, type Vec3 } from 'device-ui';
import { controlStyles, num, nums } from 'device-ui/controls/shared';
import 'device-ui/materials';

defineStyles(`
${controlStyles('[d-wheel~="balance"]', '[d-knob~="tension"]', '[d-slider~="wing"]')}
[d-knob~="tension"], [d-knob~="tension"] input { border-radius: 50%; }
[d-sewing], [d-lamp~="bulb"] { display: block; }
[d-sewing~="foot"] { position: relative; }
`);

const RAD = Math.PI / 180;
const FONT = "600 SIZEpx 'Helvetica Neue', Helvetica, Arial, sans-serif";
const font = (size: number) => FONT.replace('SIZE', String(size));

/** The shaft's angle, clockwise from the top of the wheel as you look at it. A hand pulling the near side down turns it forwards, as it should go. */
const forwards = (a: number) => -a;

const flywheel = turn({ mass: 90, material: 'ball-bearing', input: true, wrap: true, rolled: true, stops: { at: [0, 360] }, travel: p => Math.PI * p.h });

// A handwheel on the end of a shaft that runs across the view, so it's seen nearly edge on: an ellipse, its near side to the right. Pull the near side down to turn it, and it runs on a little, being heavy.
// Its box is the wheel and the rim that stands off it by `rim-off` mm. `lean` is how wide the ellipse is for its height, `holes` how many are cut through the web, `material` the casting and `rim` the ring round it.
definePart({
  selector: '[d-wheel~="balance"]',
  ...flywheel,
  paint(s, p, d) {
    const R = p.h / 2, k = num(p, 'lean', 0.36), rx = k * R, off = num(p, 'rim-off', 8) * MM, cx = p.x + rx, cy = p.y + R;
    const name = p.el.getAttribute('material') || 'japan-black', rim = p.el.getAttribute('rim') || 'chrome', a = forwards(flywheel.angle(p)), holes = num(p, 'holes', 3);
    s.surface(ellipse(cx + off, cy, rx, R), { material: rim, profile: 'round', bevel: 9 * MM, zEdge: 0, zTop: 9 });
    // A join in the plating is what shows a bright rim going round.
    if (Math.sin(a) > -0.3) {
      const y = cy - R * 0.97 * Math.cos(a), x = cx + off + rx * 0.97 * Math.sin(a);
      s.cut(capsule(x - 2.4 * MM, y, x + 1 * MM, y, 0.3 * MM, 0.3 * MM), { depth: 0.2, ink: [0.02, 0.02, 0.02] });
    }
    s.surface(ellipse(cx, cy, rx, R * 0.985), { material: name, profile: 'round', bevel: 5 * MM, zEdge: 0, zTop: 10, over: { wear: d.wear * 0.5 } });
    const wx = cx - 1.5 * MM, web = 0.76 * R;
    s.surface(ellipse(wx, cy, web * k, web), { material: name, profile: 'round', bevel: 2 * MM, zEdge: 10, zTop: 7 });
    for (let i = 0; i < holes; i++) {
      const t = a + (i * Math.PI * 2) / holes, r = web * 0.66, w = web * 0.2;
      s.surface(ellipse(wx + r * k * Math.sin(t), cy - r * Math.cos(t), w * k, w), { material: 'well', bevel: 1.2, zEdge: 7, zTop: 3 });
    }
    if (p.focused) s.glow(ellipse(cx + off / 2, cy, rx + off / 2 + 1.5, R + 1.5), FOCUS);
  },
});

const tensionTurn = turn({ mass: 4, material: 'brass-on-steel', input: true, travel: 200, stops: { at: p => [-num(p, 'sweep', 150), num(p, 'sweep', 150)] } });

// A thread tension seen on its axis: a dished cup, the coil of the check spring, a numbered dial and the thumb nut that turns with it and runs in along the stud as it's tightened. Its input is the setting.
// `count` is the highest number, `sweep` the degrees either side of straight up, `mark` the colour of the numbers, `dial` what the dial is made of, `material` the cup and nut.
definePart({
  selector: '[d-knob~="tension"]',
  ...tensionTurn,
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'satin-chrome', dial = p.el.getAttribute('dial') || 'lacquer-black';
    const sweep = num(p, 'sweep', 150), count = num(p, 'count', 8), mark = linear(p.el.getAttribute('mark') || '#e8e4d8'), a = tensionTurn.angle(p), run = (a / (sweep * RAD) + 1) / 2;
    s.surface(circle(cx, cy, R), { material: name, radial: true, profile: 'round', bevel: R * 0.16, zEdge: 0, zTop: 3 });
    s.surface(circle(cx, cy, R * 0.84), { material: 'black-oxide', bevel: R * 0.05, zEdge: 3, zTop: 3.4 });
    for (const k of [0.8, 0.74]) s.surface(circle(cx, cy, R * k), { material: 'polished-steel', profile: 'round', bevel: R * 0.03, zEdge: 3.4, zTop: 4 });
    s.print(rect(cx - 0.5 * MM, cy - R * 0.92, 1 * MM, R * 0.14), [0.02, 0.02, 0.02]);
    s.group(tensionTurn.place(p), () => {
      s.surface(circle(0, 0, R * 0.68), { material: dial, profile: 'round', bevel: R * 0.05, zEdge: 3.4, zTop: 5 });
      const size = R * 0.2, f = font(size);
      for (let i = 0; i <= count; i++) {
        const t = (sweep - (i * 2 * sweep) / count) * RAD, r = R * 0.53, x = Math.sin(t) * r, y = -Math.cos(t) * r, w = size * 1.8;
        s.cut(text(String(i), x - w / 2, y - w / 2, w, w, { font: f, rotate: t }), { ink: mark });
      }
      s.surface(circle(0, 0, R * 0.34, { ripple: [24, R * 0.012] }), { material: name, radial: true, profile: 'round', bevel: R * 0.05, zEdge: 5, zTop: 8 + run * 1.2 });
      s.surface(circle(0, 0, R * 0.17), { material: 'polished-steel', profile: 'dome', zEdge: 8 + run * 1.2, zTop: 9 + run * 1.2 });
      s.cut(rect(-R * 0.17, -R * 0.03, R * 0.34, R * 0.06), { depth: 0.4, soft: 0.5, ink: [0.03, 0.03, 0.03] });
    });
    if (p.focused) s.glow(circle(cx, cy, R + 1.5), FOCUS);
  },
});

// How far the wing runs up its slot, mm. It starts from the bottom of its input's range.
const slotOf = (p: Part) => (p.h - 2 * num(p, 'ends', 13) * MM) / MM;
const wing = slide({ input: 0, mass: 20, material: 'steel-on-steel', axis: 'y', travel: p => -slotOf(p) });

const legends = (s: Sheet, p: Part, x: number, list: string[], ink: Vec3) => {
  const ends = num(p, 'ends', 13) * MM, size = 3.2 * MM, f = font(size), span = p.h - 2 * ends;
  list.forEach((t, i) => {
    const y = p.y + ends + (span * i) / Math.max(list.length - 1, 1), w = size * 2;
    s.cut(text(t, x - w / 2, y - w / 2, w, w, { font: f }), { ink });
  });
};

// A plate with a slot and a scale, and a wing screw that slides along the slot to set a length, as a stitch regulator has. Its input is the setting, its top end up.
// Its box is the plate. `ends` is mm from each end of the box to where the wing can get, `left` and `right` the scales printed down each side of the slot, top first, `mark` their colour, `material` the plate, and `reach` how far the screw's tail hangs, x y in mm.
definePart({
  selector: '[d-slider~="wing"]',
  ...wing,
  paint(s, p) {
    const name = p.el.getAttribute('material') || 'chrome', ink = linear(p.el.getAttribute('mark') || '#121212'), cx = p.x + p.w / 2, ends = num(p, 'ends', 13) * MM, chamfer = p.w * 0.24;
    s.surface(poly([[p.x + chamfer, p.y, chamfer * 0.8], [p.x + p.w - chamfer, p.y, chamfer * 0.8], [p.x + p.w, p.y + chamfer * 1.4, 2], [p.x + p.w, p.y + p.h - chamfer * 1.4, 2], [p.x + p.w - chamfer, p.y + p.h, chamfer * 0.8], [p.x + chamfer, p.y + p.h, chamfer * 0.8], [p.x, p.y + p.h - chamfer * 1.4, 2], [p.x, p.y + chamfer * 1.4, 2]], { spread: 8 }), { material: name, profile: 'round', bevel: 0.9 * MM, zEdge: 0, zTop: 1.4 });
    s.surface(rect(cx - 1.9 * MM, p.y + ends - 4 * MM, 3.8 * MM, p.h - 2 * ends + 8 * MM, { radius: 1.9 * MM }), { material: 'well', bevel: 1, zEdge: 1.4, zTop: -1.5 });
    for (const y of [p.y + 4.4 * MM, p.y + p.h - 4.4 * MM]) {
      s.surface(circle(cx, y, 2.6 * MM), { material: 'polished-steel', profile: 'dome', zEdge: 1.4, zTop: 2.6 });
      s.cut(rect(cx - 2.2 * MM, y - 0.35 * MM, 4.4 * MM, 0.7 * MM, { rotate: 0.5 }), { depth: 0.3, soft: 0.5, ink: [0.03, 0.03, 0.03] });
    }
    const left = p.el.getAttribute('left')?.split(' ') ?? [], right = p.el.getAttribute('right')?.split(' ') ?? [];
    legends(s, p, p.x + p.w * 0.17, left, ink);
    legends(s, p, p.x + p.w * 0.83, right, ink);
    const [tx = 13, ty = 21] = nums(p, 'reach', []);
    // The screw is drawn at the bottom of the slot, and its joint carries it up.
    s.group(wing.place(p), () => s.group({ at: [p.w / 2, p.h - ends] }, () => {
      s.surface(circle(0, 0, 3.8 * MM), { material: name, radial: true, profile: 'round', bevel: 0.8 * MM, zEdge: 0, zTop: 3.4 });
      const ex = tx * MM, ey = ty * MM;
      s.surface(capsule(0, 0, ex * 0.72, ey * 0.72, 1.5 * MM, 1.3 * MM), { material: 'satin-steel', zEdge: 2, zTop: 5.2 });
      for (let i = 1; i < 9; i++) {
        const k = 0.08 * i, x = ex * k, y = ey * k;
        s.cut(capsule(x - 1.3 * MM, y + 0.6 * MM, x + 1.3 * MM, y - 0.6 * MM, 0.15 * MM, 0.15 * MM), { depth: 0.2, soft: 0.3, ink: [0.05, 0.05, 0.05] });
      }
      s.surface(capsule(ex * 0.68, ey * 0.68, ex, ey, 2.2 * MM, 2.8 * MM), { material: name, profile: 'round', bevel: 1.3 * MM, zEdge: 3, zTop: 6.5 });
    }));
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: chamfer }), FOCUS);
  },
});

const WARM: Vec3 = [1, 0.72, 0.42];
const glows = new WeakMap<Part, LightHandle>();
const shine = (p: Part) => {
  const on = p.el.hasAttribute('on'), mm = (p.el.getBoundingClientRect().width / Math.max(p.w, 1)) * MM, gain = num(p, 'gain', 1.4);
  glows.get(p)?.set({ reach: num(p, 'reach', 90) * mm, color: on ? [WARM[0] * gain, WARM[1] * gain, WARM[2] * gain] : [0, 0, 0] });
};

// A glass bulb in a hood, seen from the side. `on` lights it, and what's near it is lit too, out to `reach` mm, as strong as `gain`. `material` is the hood, whose lip is the top of its box.
definePart({
  selector: '[d-lamp~="bulb"]',
  springs: { lit: { stiffness: 60, damping: 14 } },
  live: ['on'],
  connect(p) {
    glows.set(p, light({ at: p.el, reach: 1, color: [0, 0, 0] }));
    shine(p);
    return () => {
      glows.get(p)?.remove();
      glows.delete(p);
    };
  },
  update(p) {
    p.springs.lit!.set(p.el.hasAttribute('on') ? 1 : 0);
    shine(p);
  },
  paint(s, p) {
    const lit = Math.max(p.springs.lit!.value, 0), cx = p.x + p.w / 2, name = p.el.getAttribute('material') || 'chrome', lip = 3 * MM, top = p.y + lip;
    const emit: Vec3 = [WARM[0] * 3 * lit, WARM[1] * 3 * lit, WARM[2] * 3 * lit];
    s.surface(ellipse(cx, top, p.w * 0.17, p.h - lip), { material: 'gloss-white', profile: 'dome', zEdge: 0, zTop: 3, over: { emit, rough: 0.2 } });
    s.surface(rect(p.x, p.y, p.w, lip, { radius: lip / 2 }), { material: name, profile: 'round', bevel: 0.7 * MM, zEdge: 0, zTop: 3.4 });
    if (lit > 0.01) s.glow(ellipse(cx, top, p.w * 0.17, p.h - lip), emit, 1.6);
  },
});

const needleDrive = driven();
/** How far down a crank has pushed its bar, 0 to 1, with the short rod's bit more speed through the top. */
const crank = (a: number) => {
  const c = Math.cos(a);
  return 0.5 - 0.5 * c + 0.06 * (1 - c * c);
};
const lineOf = (s: Sheet, x0: number, y0: number, x1: number, y1: number, material: string, z: number) =>
  s.surface(capsule(x0, y0, x1, y1, 0.75, 0.75), { material, profile: 'round', bevel: 0.75, zEdge: z - 0.2, zTop: z });

// A needle bar coming down out of the head, its clamp and the needle in it. `of` names what turns it, and it's at the top of its stroke with the shaft at 0. It stops at `plate`, mm below its box's top, where the needle goes through.
// `stroke` is how far it runs, `bar` how much of it shows at the top, `length` the needle, all mm. `thread` is where the thread comes down from, x y in mm from its top left, and `cotton` what the thread is.
definePart({
  selector: '[d-sewing~="needle"]',
  ...needleDrive,
  paint(s, p) {
    const stroke = num(p, 'stroke', 30) * MM, bar = num(p, 'bar', 12) * MM, length = num(p, 'length', 36) * MM, floor = p.y + num(p, 'plate', p.h / MM) * MM, cx = p.x + p.w / 2;
    const a = forwards(needleDrive.angle(p)), end = p.y + bar + stroke * crank(a), tip = end + 3 * MM + length, stop = Math.min(tip, floor), eye = tip - 2.4 * MM;
    const [tx, ty] = nums(p, 'thread', []), cotton = p.el.getAttribute('cotton') || 'plastic-white';
    s.surface(rect(cx - 2.6 * MM, p.y, 5.2 * MM, end - p.y, { radius: 0.4 }), { material: 'polished-steel', profile: 'round', bevel: 2.4 * MM, zEdge: 0, zTop: 7 });
    s.surface(rect(cx - 3.3 * MM, end - 7 * MM, 6.6 * MM, 10 * MM, { radius: 0.8 * MM }), { material: 'chrome', profile: 'round', bevel: 3 * MM, zEdge: 0, zTop: 8 });
    s.surface(rect(cx - 5.8 * MM, end - 3.6 * MM, 3 * MM, 2.6 * MM, { radius: 0.5 * MM }), { material: 'satin-steel', profile: 'round', bevel: 1 * MM, zEdge: 4, zTop: 8 });
    s.surface(rect(cx - 0.95 * MM, end + 3 * MM, 1.9 * MM, Math.min(9 * MM, stop - end - 3 * MM), { radius: 0.2 }), { material: 'polished-steel', profile: 'round', bevel: 0.9 * MM, zEdge: 0, zTop: 6 });
    if (stop > end + 12 * MM) s.surface(capsule(cx, end + 12 * MM, cx, stop, 0.75 * MM, stop < tip ? 0.6 * MM : 0.2 * MM), { material: 'polished-steel', zEdge: 1, zTop: 6 });
    if (tx !== undefined && ty !== undefined) {
      const hx = p.x + tx * MM, hy = p.y + ty * MM, gx = cx + 1 * MM, gy = end + 2 * MM;
      lineOf(s, hx, hy, gx, gy, cotton, 8.6);
      lineOf(s, gx, gy, cx, Math.min(eye, floor), cotton, 8.6);
      if (eye < floor) s.cut(rect(cx - 0.5 * MM, eye - 0.8 * MM, 1 * MM, 1.6 * MM, { radius: 0.5 * MM }), { depth: 0.2, soft: 0.2, ink: [0.03, 0.03, 0.03] });
    }
  },
});

const takeDrive = driven();

// A thread take-up seen edge on: the lever nodding in a slot in the head, ahead of the needle. Its box is the slot. `of` names what turns it, `lead` how far ahead it runs, degrees, `reach` how far its eye stands out of the slot's left side, mm.
// `from` and `to` are where the thread comes from and goes to, x y in mm from its top left, `cotton` what the thread is, and `material` the lever.
definePart({
  selector: '[d-sewing~="takeup"]',
  ...takeDrive,
  paint(s, p) {
    const lead = num(p, 'lead', 60) * RAD, reach = num(p, 'reach', 6) * MM, name = p.el.getAttribute('material') || 'chrome', cotton = p.el.getAttribute('cotton') || 'plastic-white', pad = p.w * 0.7;
    const a = forwards(takeDrive.angle(p)), y = p.y + pad + (p.h - 2 * pad) * crank(a + lead), cx = p.x + p.w / 2, ex = p.x - reach;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: p.w / 2 }), { material: 'well', bevel: 1.5, zEdge: 0, zTop: -2 });
    s.surface(capsule(cx, y, ex, y - 1.6 * MM, 1.1 * MM, 0.8 * MM), { material: name, zEdge: -1, zTop: 3 });
    s.surface(circle(ex, y - 1.6 * MM, 1.7 * MM), { material: name, profile: 'round', bevel: 0.7 * MM, zEdge: 1, zTop: 3 });
    const [fx, fy] = nums(p, 'from', []), [ox, oy] = nums(p, 'to', []);
    if (fx !== undefined && fy !== undefined) lineOf(s, p.x + fx * MM, p.y + fy * MM, ex, y - 1.6 * MM, cotton, 3.6);
    if (ox !== undefined && oy !== undefined) lineOf(s, ex, y - 1.6 * MM, p.x + ox * MM, p.y + oy * MM, cotton, 3.6);
  },
});

const feedDrive = driven();
const feedShare = (p: Part) => {
  const by = p.el.getAttribute('by'), lead = by ? p.el.closest('d-device')?.querySelector(by) : null, part = lead ? partOf(lead) : null;
  const value = (part?.def as { value?(q: Part): number } | undefined)?.value;
  return part && value ? value(part) : 0;
};

// The toothed feed that walks the cloth along: up through its slot, along, down and back, with the needle out of the way. Its box is the slot. `of` names what turns it and `by` what sets how far it walks, whose top end is the shortest stitch.
// `walk` is how far it goes at the longest setting, as it shows, mm, and `teeth` how many rows it has.
definePart({
  selector: '[d-sewing~="feed"]',
  tick(p) {
    const share = feedShare(p), moved = feedDrive.tick(p);
    if (share === p.data.share) return moved;
    p.data.share = share;
    return true;
  },
  paint(s, p) {
    const a = forwards(feedDrive.angle(p)), walk = num(p, 'walk', 3.2) * MM * (1 - 0.85 * feedShare(p)), rows = num(p, 'teeth', 6), up = Math.max(Math.cos(a - Math.PI), 0), dy = walk * Math.sin(a) * 0.5;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 1 }), { material: 'well', bevel: 0.6, zEdge: 0, zTop: -1.5 });
    const inset = 0.5 * MM, tall = (p.h - walk - inset * 2) / rows;
    for (let i = 0; i < rows; i++) {
      const y = p.y + p.h / 2 - (tall * rows) / 2 + i * tall + dy;
      s.surface(rect(p.x + inset, y + tall * 0.1, p.w - inset * 2, tall * 0.8, { radius: 0.4 }), { material: 'satin-steel', profile: 'round', bevel: tall * 0.3, zEdge: -1.5, zTop: -0.6 + up * 1.2 });
    }
  },
});

const lift = slide({ axis: 'y', travel: p => -num(p, 'lift', 6), mass: 14, material: 'steel-on-steel', click: true, detents: { count: 2, strength: 0.7 } });

// A presser foot on its bar: down on the plate, up off it. Click it, or push it. Its box runs from where the bar leaves the head down to the plate.
// `bar` is how far the bar sits along the box, `shank` how far the foot's shank, `shin` how far down the box the bar stops and `sole` where the sole begins, all mm, and `lift` how far it comes up. `material` is the foot.
definePart({
  selector: '[d-sewing~="foot"]',
  ...lift,
  paint(s, p) {
    const name = p.el.getAttribute('material') || 'satin-chrome', bx = p.x + num(p, 'bar', 22) * MM, sx = p.x + num(p, 'shank', 12) * MM, shin = num(p, 'shin', 26) * MM, sole = num(p, 'sole', 56) * MM;
    const up = lift.place(p).at![1] - p.y, foot = p.h - sole;
    // The bar slides up into the head, so what shows of it gets shorter.
    s.surface(rect(bx - 2.8 * MM, p.y, 5.6 * MM, Math.max(shin + up, 1), { radius: 0.3 }), { material: 'polished-steel', profile: 'round', bevel: 2.6 * MM, zEdge: 0, zTop: 6 });
    s.group({ at: [0, up] }, () => {
      const y = p.y + shin;
      s.surface(poly([[bx + 3.4 * MM, y - 4 * MM, 1], [bx + 3.4 * MM, y + 3 * MM, 1], [sx + 4.4 * MM, y + 8 * MM, 1], [sx - 4.4 * MM, y + 8 * MM, 1], [sx - 4.4 * MM, y + 1 * MM, 1], [bx - 3.4 * MM, y - 4 * MM, 1]], { spread: 3 }), { material: 'satin-steel', profile: 'round', bevel: 1 * MM, zEdge: 1, zTop: 6.4 });
      s.surface(rect(sx - 4.4 * MM, y + 7 * MM, 8.8 * MM, sole - shin - 6 * MM, { radius: 0.8 * MM }), { material: name, profile: 'round', bevel: 2.4 * MM, zEdge: 0, zTop: 5 });
      // The thumb screw holding the shank on, its knurled head to the left and seen from the side.
      const ky = y + 16 * MM, kx = sx - 8.4 * MM;
      s.surface(rect(kx + 3.4 * MM, ky - 1.8 * MM, 3 * MM, 3.6 * MM), { material: 'satin-steel', zEdge: 1, zTop: 5 });
      s.surface(rect(kx - 3 * MM, ky - 6 * MM, 6.4 * MM, 12 * MM, { radius: 1.6 * MM }), { material: 'knurled-fine', profile: 'round', bevel: 2.6 * MM, zEdge: 1, zTop: 6.4 });
      // The sole coming towards you, in two toes either side of the needle.
      const top = p.y + sole, toe = 4.8 * MM, gap = 0.9 * MM;
      for (const k of [-1, 1]) {
        const i = sx + k * gap, o = i + k * toe;
        s.surface(poly([[i, top, 0.5], [o, top, 0.5], [o + k * 1 * MM, top + foot - 1.5 * MM, 3], [i + k * 1 * MM, top + foot, 3]], { spread: 3 }), { material: name, profile: 'round', bevel: 1.1 * MM, zEdge: 0.1, zTop: 2.4 });
      }
    });
    if (p.focused) s.glow(rect(sx - 8 * MM, p.y + sole - 2 * MM + up, 16 * MM, foot + 2 * MM, { radius: 2 * MM }), FOCUS);
  },
});
