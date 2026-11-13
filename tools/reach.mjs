// Faults only a real click or the finished layout shows. Run in the page, on a device on screen.
// What's drawn and on top has to take the pointer: worked out apart from the engine's own map, from what each control drew.
// The body under everything mustn't show as a thin line past what's meant to cover it. Print has to fit its box. Those are faults. What might be meant starts "maybe: ":
// look only warns of it, since a rim can be a sliver with a purpose, and something can be hidden on purpose too. No one should redraw an object to quiet a check.
export const faults = id => {
  const d = [...window.engine.devices].find(x => x.el.id === id);
  if (!d) return [];
  const STEP = 3, IN = 3, FOCUSABLE = 'a, button, input, select, textarea, [tabindex]';
  const r = d.canvas.getBoundingClientRect(), k = r.width / d.cw;
  const fill = (x, s) => {
    x.save();
    if (s.type === 'capsule') {
      const a = Math.atan2(s.by - s.ay, s.bx - s.ax);
      x.beginPath();
      x.arc(s.ax, s.ay, s.ra, a + Math.PI / 2, a - Math.PI / 2);
      x.arc(s.bx, s.by, s.rb, a - Math.PI / 2, a + Math.PI / 2);
      x.fill();
    } else {
      x.translate(s.cx, s.cy);
      x.rotate(s.rotate);
      if (s.type === 'rect') {
        x.beginPath();
        x.roundRect(-s.hw, -s.hh, s.hw * 2, s.hh * 2, s.radius);
        x.fill();
      } else if (s.type === 'arc') {
        x.strokeStyle = x.fillStyle;
        x.lineWidth = s.width;
        x.lineCap = 'round';
        x.beginPath();
        x.arc(0, 0, s.r, s.mid - s.half - Math.PI / 2, s.mid + s.half - Math.PI / 2);
        x.stroke();
      } else {
        const { hw, hh } = s.source ?? s;
        x.scale(s.hw / hw, s.hh / hh);
        x.translate(-hw, -hh);
        s.draw(x, hw * 2, hh * 2);
      }
    }
    x.restore();
  };
  const drawn = p => (p.commands ?? []).filter(c => (c.op === 'glass' && c.covers) || (c.op === 'surface' && c.zTop >= c.zEdge && (!c.bend || c.bend.k === 0) && !c.shape.ring && c.shape.type !== 'mask' && c.shape.type !== 'holes'));
  const holders = new Set();
  for (const p of d.list) for (let n = p.el.parentElement; n && n !== d.el; n = n.parentElement) holders.add(n);
  const bad = [];
  d.list.forEach((p, i) => {
    if (p.el === d.el || holders.has(p.el) || !(p.def.motion || p.el.matches(FOCUSABLE) || p.el.querySelector(FOCUSABLE))) return;
    const shapes = drawn(p);
    if (!shapes.length) return;
    const c = document.createElement('canvas');
    c.width = d.cw;
    c.height = d.ch;
    const { width: cw, height: ch } = c, x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    shapes.forEach(s => fill(x, s.shape));
    x.globalCompositeOperation = 'destination-out';
    d.list.slice(i + 1).forEach(q => drawn(q).forEach(s => fill(x, s.shape)));
    // A device held in this one is drawn over it, as the face of a lid lying shut over the keys.
    for (const n of d.el.querySelectorAll('d-device')) {
      if (n.contains(p.el) || getComputedStyle(n).visibility !== 'visible') continue;
      const b = n.getBoundingClientRect();
      x.fillRect((b.left - r.left) / k, (b.top - r.top) / k, b.width / k, b.height / k);
    }
    const { data } = x.getImageData(0, 0, cw, ch), on = (px, py) => data[(py * cw + px) * 4 + 3] > 200;
    let seen = 0, missed = 0;
    for (let py = IN; py < ch - IN; py += STEP) for (let px = IN; px < cw - IN; px += STEP) {
      // Well inside, since a cell at the very edge can go either way.
      if (!on(px, py) || !on(px - IN, py) || !on(px + IN, py) || !on(px, py - IN) || !on(px, py + IN)) continue;
      // Past the window nothing answers, in or out of reach.
      const u = r.left + px * k, v = r.top + py * k;
      if (u < 0 || v < 0 || u >= innerWidth || v >= innerHeight) continue;
      seen++;
      const e = document.elementFromPoint(u, v);
      if (!e || !p.el.contains(e)) missed++;
    }
    if (seen && missed / seen > 0.05) bad.push(`drawn and on top but out of reach: ${p.el.getAttribute('aria-label') ?? p.el.querySelector('[aria-label]')?.getAttribute('aria-label') ?? p.el.tagName.toLowerCase()}: ${missed} of ${seen} points`);
  });

  const W = Math.floor(d.cw), H = Math.floor(d.ch), THIN = 4, SMALLEST = 30, base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const x = base.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff';
  // `bare` has a shell for layout, and no body drawn from it to show.
  if (d.shell && d.shell.type !== 'mask' && d.shell.type !== 'holes' && !d.el.hasAttribute('bare')) fill(x, d.shell);
  const whole = x.getImageData(0, 0, W, H).data;
  x.globalCompositeOperation = 'destination-out';
  // A mark is on what it's printed or moulded into, not over it, so body round one is just body.
  d.list.forEach(p => !p.el.matches('[d-mark]') && drawn(p).forEach(s => (s.op === 'surface' || s.op === 'glass') && fill(x, s.shape)));
  const left = x.getImageData(0, 0, W, H).data, on = i => left[i * 4 + 3] > 128, inside = i => whole[i * 4 + 3] > 128;
  let shown = 0, body = 0;
  // A running total, to ask if a square is all exposed body in one read.
  const sum = new Int32Array((W + 1) * (H + 1));
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, v = on(i) ? 1 : 0;
    shown += v;
    body += inside(i) ? 1 : 0;
    sum[(py + 1) * (W + 1) + px + 1] = v + sum[py * (W + 1) + px + 1] + sum[(py + 1) * (W + 1) + px] - sum[py * (W + 1) + px];
  }
  // Where the body is what's on show, its corners and gaps are meant.
  if (body && shown / body < 0.5) {
    const count = (a, b, c, e) => sum[e * (W + 1) + c] - sum[b * (W + 1) + c] - sum[e * (W + 1) + a] + sum[b * (W + 1) + a];
    const room = new Uint8Array(W * H);
    for (let py = 0; py + THIN * 2 < H; py++) for (let px = 0; px + THIN * 2 < W; px++) if (count(px, py, px + THIN * 2, py + THIN * 2) === THIN * THIN * 4) room[(py + THIN) * W + px + THIN] = 1;
    const near = (px, py, r, test) => {
      for (let v = Math.max(py - r, 0); v <= Math.min(py + r, H - 1); v++) for (let u = Math.max(px - r, 0); u <= Math.min(px + r, W - 1); u++) if (test(v * W + u)) return true;
      return false;
    };
    let thin = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      if (!on(py * W + px) || near(px, py, THIN, i => room[i]) || !near(px, py, 3, i => !inside(i))) continue;
      thin++;
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    if (thin >= SMALLEST) bad.push(`maybe: the body shows past what covers it, under ${THIN / 2}mm wide, between ${(x0 - d.x) / 4},${(y0 - d.y) / 4} and ${(x1 - d.x) / 4},${(y1 - d.y) / 4}mm. Fine if that's a rim you meant.`);
  }

  // Print fits its box on one line per line written: running wide, or wrapping onto a line it wasn't given, both mean the font is wider than the real one.
  for (const el of d.el.querySelectorAll('[d-mark~="print"]')) {
    const words = `"${el.textContent.trim().slice(0, 24)}"`, cure = 'a narrower or lighter font, never a bigger box';
    if (el.scrollWidth > el.clientWidth + 1) bad.push(`print runs out of its box: ${words} is ${((el.scrollWidth - el.clientWidth) / 4).toFixed(1)}mm too wide for ${(el.clientWidth / 4).toFixed(1)}mm: ${cure}`);
    else if (el.scrollHeight > el.clientHeight + 1) {
      // Its box is the ink's, which one line's own height can pass, so what spills is news only when it was set on more lines than it was given.
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].filter(r => r.width).map(r => Math.round(r.bottom))).size, given = el.querySelectorAll('br').length + 1;
      if (lines > given) bad.push(`print runs out of its box: ${words} wraps onto ${lines} lines where it was written on ${given}: ${cure}`);
    }
  }

  // Print under something drawn after it can't be seen, whatever the layout says.
  const list = d.list, here = new Map(list.map((p, i) => [p, i]));
  for (const p of list) {
    if (!p.el.matches('[d-mark]') || !p.el.checkVisibility()) continue;
    let ink = p.el.getBoundingClientRect();
    // A drawn print's box says nothing of where its ink is, and a ring round a knob is meant to go under it, so only one wholly covered counts.
    const words = !p.el.childElementCount && !!p.el.textContent.trim();
    if (words) {
      const range = document.createRange();
      range.selectNodeContents(p.el);
      if (range.getBoundingClientRect().width) ink = range.getBoundingClientRect();
    }
    const ix = (ink.left - r.left) / k, iy = (ink.top - r.top) / k, iw = ink.width / k, ih = ink.height / k;
    if (iw < 1 || ih < 1) continue;
    const over = list.slice(here.get(p) + 1).filter(q => !q.el.contains(p.el) && !p.el.contains(q.el) && q.el.checkVisibility() && getComputedStyle(q.el).visibility === 'visible' && q.x < ix + iw && q.x + q.w > ix && q.y < iy + ih && q.y + q.h > iy);
    const shapes = over.flatMap(q => drawn(q).filter(s => s.op === 'surface'));
    if (!shapes.length) continue;
    const c = document.createElement('canvas');
    c.width = Math.ceil(iw);
    c.height = Math.ceil(ih);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    x.translate(-ix, -iy);
    shapes.forEach(s => fill(x, s.shape));
    const { data } = x.getImageData(0, 0, c.width, c.height);
    let hidden = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) hidden++;
    if (hidden / (c.width * c.height) > (words ? 0.6 : 0.98)) bad.push(`maybe: print is under something drawn after it: ${p.el.textContent.trim().slice(0, 24) || p.el.className || p.el.getAttribute('d-mark')} at ${((ix + iw / 2 - d.x) / 4).toFixed(1)},${((iy + ih / 2 - d.y) / 4).toFixed(1)}mm. Put it in what covers it, or after it.`);
  }
  return bad;
};
