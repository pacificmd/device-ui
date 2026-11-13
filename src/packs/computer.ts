// Desktop computers: the mouth of a disk drive, a floppy disk's works, a wafer of chips, the plane of a moulded case falling away, and a mouse on the desk.
import { capsule, circle, definePart, defineStyles, FOCUS, minus, MM, outline, path, poly, press, rect, seatBox, slide, together, turn, type Part, type Point } from 'device-ui';
import { controlStyles, ground, keyStyles, num, nums } from 'device-ui/controls/shared';

defineStyles(`[d-port~="disk"], [d-port~="cartridge"], [d-chip~="wafer"], d-slope { display: block; }
${controlStyles('[d-stick~="mouse"]', '[d-disk~="shutter"]', '[d-disk~="hub"]')}
${keyStyles('[d-stick~="mouse"] button')}
[d-stick~="mouse"] button { position: absolute; z-index: 1; }`);

// The mouth of a floppy drive, filling its box. A shallow step in the case with slanted walls, tall at the right end where
// a thumb reaches the disk, a pale door set further back there, the slit running through both, and a pinhole for a paper clip.
definePart({
  selector: '[d-port~="disk"]',
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || ground(p, d), { x, y, w, h } = p, g = h * 0.26, reach = w * 0.39;
    const mouth = poly([
      [x, y + g, 1], [x + w - reach, y + g, 1], [x + w - reach, y, 2], [x + w, y, 2], [x + w, y + h, 2], [x + w - reach, y + h, 2], [x + w - reach, y + h - g, 1], [x, y + h - g, 1],
    ] satisfies Point[], { spread: 8 });
    s.well(mouth, 1.2, { material, bevel: 5, profile: 'chamfer' });
    const door = x + w * 0.685, right = x + w * 0.915, slit = h * 0.11, top = y + h * 0.42;
    s.well(rect(door, y + h * 0.13, right - door, h * 0.72, { radius: 1 }), 1.6, { material, bevel: 2.4, profile: 'chamfer' });
    s.well(rect(x + w * 0.09, top, right - x - w * 0.09 - 3, slit, { radius: 0.5 }), 6, { bevel: 0.5 });
    s.well(rect(door + 4, top + slit * 0.4, right - door - 6, h * 0.24, { radius: 0.5 }), 6, { bevel: 0.5 });
    s.well(circle(x + w * 0.965, y + h * 0.76, 1.6), 3, { bevel: 0.4 });
  },
});

const shutter = slide({ input: 0, mass: 4, material: 'plastic-on-plastic', return: 1.5, axis: 'x', travel: p => num(p, 'travel', 12) });

// The sprung sheet over a floppy disk's head opening, filling its box at rest. A hole through the sheet, `window` in mm from the box's top left as
// `x y w h`, sits over solid case until the sheet runs `travel` mm, negative for leftwards, and the hole comes over an opening onto the film inside.
// Let go, it springs shut. `height` is how far it stands, mm.
definePart({
  selector: '[d-disk~="shutter"]',
  ...shutter,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-steel', run = num(p, 'travel', 12) * MM;
    const [wx = 0, wy = 0, ww = 0, wh = 0] = nums(p, 'window', [0, 0, 0, 0]).map(n => n * MM), hole = (x: number, y: number) => rect(x + wx, y + wy, ww, wh, { radius: 1 });
    s.well(hole(p.x + run, p.y), 0.8, { material: 'film-oxide', bevel: 1 });
    // The sheet is drawn shut, and its joint carries it open.
    s.group(shutter.place(p), () => {
      s.surface(minus(rect(0, 0, p.w, p.h, { radius: 2 }), hole(0, 0)), { material, bevel: 0.6, zEdge: 0, zTop: num(p, 'height', 0.2), over: { wear: d.wear * 0.5, touch: d.age * 0.5 } });
      if (p.focused) s.glow(rect(0, 0, p.w, p.h, { radius: 2 }), FOCUS);
    });
  },
});

const hub = turn({ mass: 8, material: 'ball-bearing', input: true, wrap: true, stops: { at: () => [0, 360] }, travel: p => Math.PI * p.w });

// The steel hub of a floppy disk in its round opening in the case, which fills the box, and turns with a hand. A spindle goes in the square hole at its middle
// and a drive pin in the oblong one off to the side. `hub` is the steel's diameter, mm.
definePart({
  selector: '[d-disk~="hub"]',
  ...hub,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-steel', R = num(p, 'hub', 23.5) * MM / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    s.well(circle(cx, cy, p.w / 2), 0.5, { material: 'film-oxide', bevel: 1 });
    s.surface(circle(cx, cy, R), { material, radial: true, bevel: 1.2, zEdge: -0.5, zTop: -0.15, over: { wear: d.wear * 0.5 } });
    // The steel is round, so only its holes show it turning, and they're drawn as at rest round the middle.
    const pit = (x: number, y: number, w: number, h: number, q: number) => rect(x - w / 2, y - h / 2, w, h, { radius: 1.6, rotate: q });
    s.group(hub.place(p), () => {
      s.well(pit(0, 0, 4 * MM, 4 * MM, 0), 2, { bevel: 0.6 });
      s.well(pit(-6.4 * MM, 2.6 * MM, 7 * MM, 5 * MM, 0.7), 2, { bevel: 0.6 });
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

// The chips on a wafer before it's sawn, as many whole ones as fit a disc as wide as the box and inside the box, so a flat cut across the wafer takes its row off.
// Each is a sheet of oxide, in `material`, with memory arrays ruled so fine they split a lamp into its colours (`array`), a block of logic (`logic`) and pads
// round its edge (`pads`). `die` is a chip's `w h`, `street` the gap sawn away between them and `edge` how far in from the rim they stop, all mm.
definePart({
  selector: '[d-chip~="wafer"]',
  paint(s, p) {
    const a = (name: string, fallback: string) => p.el.getAttribute(name) || fallback;
    const [dw = 8, dh = dw] = nums(p, 'die', [8, 8]), street = num(p, 'street', 0.2), edge = num(p, 'edge', 3), W = p.w / MM, H = p.h / MM, R = W / 2 - edge;
    const px = dw + street, py = dh + street, dies: string[] = [], arrays: string[] = [], logic: string[] = [], pads: string[] = [];
    const box = (x: number, y: number, w: number, h: number) => `M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`;
    const across = Math.ceil(W / px) + 1, down = Math.ceil(H / py) + 1, pad = 0.26, every = 0.62, n = Math.floor((dw - 0.8) / every), m = Math.floor((dh - 0.8) / every);
    for (let j = -down; j <= down; j++) for (let i = -across; i <= across; i++) {
      const x = W / 2 + i * px - dw / 2, y = W / 2 + j * py - dh / 2, far = Math.max(Math.hypot(x - W / 2, y - W / 2), Math.hypot(x + dw - W / 2, y - W / 2), Math.hypot(x - W / 2, y + dh - W / 2), Math.hypot(x + dw - W / 2, y + dh - W / 2));
      if (far > R || y < 0 || y + dh > H - edge) continue;
      dies.push(box(x, y, dw, dh));
      const m1 = Math.min(dw, dh) * 0.1, gap = m1 * 0.4, left = (dw - m1 * 2 - gap) * 0.62, right = dw - m1 * 2 - gap - left, tall = (dh - m1 * 2 - gap) / 2;
      arrays.push(box(x + m1, y + m1, left, tall), box(x + m1, y + m1 + tall + gap, left, tall), box(x + m1 + left + gap, y + m1, right, tall * 0.7));
      logic.push(box(x + m1 + left + gap, y + m1 + tall * 0.7 + gap, right, dh - m1 * 2 - tall * 0.7 - gap));
      for (let k = 0; k < n; k++) pads.push(box(x + 0.4 + k * every, y + 0.2, pad, pad), box(x + 0.4 + k * every, y + dh - 0.2 - pad, pad, pad));
      for (let k = 0; k < m; k++) pads.push(box(x + 0.2, y + 0.4 + k * every, pad, pad), box(x + dw - 0.2 - pad, y + 0.4 + k * every, pad, pad));
    }
    const layer = (d: string[]) => path(d.join(''), p.x, p.y, p.w, p.h, { viewBox: [0, 0, W, H], spread: 2 });
    const on = { follow: true, rise: 0.004, bevel: 0.2 };
    s.surface(layer(dies), { ...on, material: a('material', 'thermal-oxide') });
    s.surface(layer(arrays), { ...on, material: a('array', 'silicon-array') });
    s.surface(layer(logic), { ...on, material: a('logic', 'silicon') });
    s.surface(layer(pads), { ...on, material: a('pads', 'aluminium-silver') });
  },
});

// The mouth of a cartridge slot, filling its box: a square-cut step in the case with a slit along the middle of its floor. There's nothing to press, since a cartridge is pushed straight in.
definePart({
  selector: '[d-port~="cartridge"]',
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || ground(p, d), { x, y, w, h } = p;
    s.well(rect(x, y, w, h, { radius: 1 }), 1.4, { material, bevel: 3, profile: 'chamfer' });
    s.well(rect(x + w * 0.03, y + h * 0.36, w * 0.94, h * 0.28, { radius: 0.5 }), 6, { bevel: 0.5 });
  },
});

// A plane of a case falling away towards one edge of its box, `drop` mm by the time it gets there, and staying down past it to the edge of
// the surface it's nested in, if it is. `side` is `top`, `right`, `bottom` or `left`.
definePart({
  selector: 'd-slope',
  paint(s, p) {
    const side = p.el.getAttribute('side') || 'top', drop = num(p, 'drop', 2), far = (p.w + p.h) * 2;
    const run = side === 'top' || side === 'bottom' ? p.h : p.w;
    const shape = side === 'top' ? rect(p.x - far, p.y - far, p.w + far * 2, far + p.h)
      : side === 'bottom' ? rect(p.x - far, p.y, p.w + far * 2, far + p.h)
        : side === 'left' ? rect(p.x - far, p.y - far, far + p.w, p.h + far * 2) : rect(p.x, p.y - far, far + p.w, p.h + far * 2);
    const seat = seatBox(p);
    s.cut(shape, { depth: drop, soft: run, ...(seat && { stop: rect(seat.x, seat.y, seat.w, seat.h) }) });
  },
});


/** The mouse's body and where in its box it has got to, css px. */
const mouseAt = (p: Part) => {
  const [bw = 60, bh = 88] = nums(p, 'size', []), w = bw * MM, h = bh * MM;
  return { w, h, x: (p.w - w) * p.springs.x!.value, y: (p.h - h) * p.springs.y!.value };
};
const onMouse = (p: Part, e: PointerEvent) => {
  const r = p.el.getBoundingClientRect(), k = r.width / p.w, m = mouseAt(p), x = (e.clientX - r.left) / k - m.x, y = (e.clientY - r.top) / k - m.y;
  return x >= 0 && y >= 0 && x <= m.w && y <= m.h;
};
const mouseAxis = (input: number, name: string, axis: 'x' | 'y') => slide({
  input, name, axis, mass: 7, material: 'plastic-on-plastic', friction: 0.5, accepts: onMouse,
  travel: p => {
    const m = mouseAt(p);
    return (axis === 'x' ? p.w - m.w : p.h - m.h) / MM;
  },
});
const mouseKey = (name: string, i: number) => press({ name, of: `button:nth-of-type(${i + 1})`, mass: 3, material: 'plastic-on-plastic' });
const KEYS = ['key0', 'key1', 'key2'] as const;
const CORD = 24;

const mouse = together(mouseAxis(0, 'x', 'x'), mouseAxis(1, 'y', 'y'), ...KEYS.map(mouseKey));

// A mouse that rolls about its box under the hand, the body filling only part of that box. Holds two range inputs, across then down, 0 to 1, and a button for each
// of its three keys. `size` is the body in mm, `key-material` its keys, and `cord` the point the wire runs off to, in mm from the box's corner.
definePart({
  selector: '[d-stick~="mouse"]',
  ...mouse,
  live: ['style'],
  paint(s, p) {
    const { x, y, w, h } = mouseAt(p), mx = p.x + x, my = p.y + y, body = p.el.getAttribute('material') || 'shell-cream', cap = p.el.getAttribute('key-material') || 'keycap-grey';
    const [cx, cy] = nums(p, 'cord', []), kw = w * 0.23, kh = h * 0.27, left = (w - kw * KEYS.length) / 2, top = h * 0.07;
    p.el.querySelectorAll<HTMLElement>('button').forEach((b, i) => {
      const box = `left:${x + left + i * kw}px;top:${y + top}px;width:${kw}px;height:${kh}px`;
      if (b.dataset.at !== box) {
        b.dataset.at = box;
        b.style.cssText = box;
      }
    });
    if (cx !== undefined && cy !== undefined) {
      const ax = mx + w / 2, ay = my, bx = p.x + cx * MM, by = p.y + cy * MM, sag = (ax + bx) / 2, lift = Math.min(ay, by) - 18 * MM;
      for (let i = 0; i < CORD; i++) {
        const t = (i + 0.5) / CORD, q = 1 - t;
        const px = q * q * ax + 2 * q * t * sag + t * t * bx, py = q * q * ay + 2 * q * t * lift + t * t * by;
        const tx = 2 * q * (sag - ax) + 2 * t * (bx - sag), ty = 2 * q * (lift - ay) + 2 * t * (by - lift), long = Math.hypot(tx, ty) / CORD + 2;
        s.surface(rect(px - long / 2, py - 2, long, 4, { radius: 2, rotate: Math.atan2(ty, tx) }), { material: 'rubber', profile: 'round', bevel: 2, zEdge: 0, zTop: 1.4 });
      }
    }
    // The body is drawn where it rests, in the box's top left, and its joints carry it about. The cord bends as it goes, so it isn't carried.
    const { x: gx, y: gy } = mouse.carried(p);
    s.group({ at: [p.x + gx, p.y + gy], carried: true }, () => {
      s.surface(outline(0, 0, w, h, [h * 0.14, h * 0.14, h * 0.06, h * 0.06]), { material: body, profile: 'chamfer', bevel: h * 0.24, zEdge: 0, zTop: 14 });
      KEYS.forEach((name, i) => {
        const cx = left + kw * (i + 0.5), r = kw * 0.46, down = Math.max(0, Math.min(1, p.springs[name]!.value)), a = top + r, b = top + kh - r;
        s.well(capsule(cx, a, cx, b, r, r), 0.8, { bevel: 1, zEdge: 14, zTop: 13.2 });
        s.surface(capsule(cx, a, cx, b, r - 1, r - 1), { material: cap, bevel: r * 0.5, profile: 'round', zEdge: 13.2, zTop: 15.4 - 1.6 * down });
      });
    });
  },
});
