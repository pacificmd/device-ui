// What's on a device, in words: run in the page, on a device on screen. Agents read geometry from text far better than from a picture.
// Each part with its box in mm, how high it stands, what holds it, what it runs into and what may shade it. All of it is what the engine
// laid out and drew, so it can't disagree with the sheet. The shading is worked out from the lamp's direction, so it says "may".
export const scene = id => {
  const d = [...window.engine.devices].find(x => x.el.id === id);
  if (!d) return null;
  // The studio's lamp, and how many times its height a thing's shadow reaches at most. Another setup's lamp hangs near enough, for a "may".
  // The face is as high as the body stands, its `height` in mm, 4 by default (TOP in sheet.ts), and what's on it counts from there.
  const MM = 4, BASE = parseFloat(d.el.getAttribute('height') ?? '') || 4, r = d.el.getBoundingClientRect(), [lx, ly] = [-0.96, -3.15], REACH = 1 / 0.6;
  const round = v => Math.round(v * 10) / 10;
  const name = el => {
    const own = el.getAttributeNames().find(a => a.startsWith('d-') && a !== 'd-layer' && a !== 'd-reach');
    const what = own ? `${own}${el.getAttribute(own) ? `="${el.getAttribute(own)}"` : ''}` : el.localName;
    const said = el.getAttribute('aria-label') ?? (el.childElementCount ? '' : el.textContent.trim().slice(0, 24));
    return said ? `${what} "${said}"` : `${what}${el.classList[0] ? `.${el.classList[0]}` : ''}`;
  };
  const holds = (a, b) => a.el !== b.el && a.el.contains(b.el);
  // A label's box is often wider than what's printed in it, and a print with no words fills whatever box it's given, so neither says where the ink is.
  const ink = (el, box) => {
    if (el.childElementCount || !el.textContent.trim()) return box;
    const range = document.createRange();
    range.selectNodeContents(el);
    const b = range.getBoundingClientRect();
    return b.width ? b : box;
  };
  const per = r.width / d.w || 1;
  const parts = d.list.filter(p => p.el !== d.el && p.el.checkVisibility()).map(p => {
    // A surface that follows what's under it, as a sticker, a sheet or a well does, has its heights from that, not from the bare device.
    const box = p.el.getBoundingClientRect(), printed = ink(p.el, box), surfaces = (p.commands ?? []).filter(c => c.op === 'surface' && typeof c.zTop === 'number');
    const tops = surfaces.filter(c => !c.follow).map(c => c.zTop), rides = surfaces.filter(c => c.follow).map(c => c.zTop);
    return { el: p.el, name: name(p.el), material: p.el.getAttribute('material'), text: !!(p.label || p.el.textContent.trim()), print: p.el.matches('[d-mark]'),
      // Its canvas runs past the device by its margin, and place measures from the device.
      x: (p.x - d.x) / MM, y: (p.y - d.y) / MM, w: p.w / MM, h: p.h / MM, top: tops.length ? Math.max(...tops) : null, rides: rides.length ? Math.max(...rides) : null,
      ink: { x: (printed.left - r.left) / per / MM, y: (printed.top - r.top) / per / MM, w: printed.width / per / MM, h: printed.height / per / MM },
      pixels: { x: box.left - r.left, y: box.top - r.top, w: box.width, h: box.height } };
  });
  // Its commands' heights already count from the bare device, its face BASE up, so what it stands is the difference from what holds it. Print has none of its own and lies on its holder, and a seam's is a depth, cut into it.
  // What follows lies on its own body if it has one, else on its holder. Holders come first, so each one's height is known by the time what's on it is.
  for (const p of parts) {
    p.under = parts.filter(q => holds(q, p) && q.z !== undefined && (q.top !== null || q.rides !== null)).at(-1);
    const on = p.under?.z ?? BASE, cut = p.top !== null && p.top < 0, own = p.top === null ? on : cut ? on + p.top : p.top;
    p.z = p.rides === null ? own : p.top === null || cut ? on + p.rides : Math.max(own, own + p.rides);
    p.stands = p.z - on;
  }
  const across = Math.hypot(lx, ly) || 1, shade = [lx / across, ly / across];
  for (const p of parts) {
    p.holder = parts.filter(q => holds(q, p)).at(-1)?.name ?? null;
    p.into = [];
    p.shaded = [];
    for (const q of parts) {
      if (q === p || holds(q, p) || holds(p, q)) continue;
      const a = p.ink, b = q.ink, wide = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), high = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (!(p.print && !p.text) && !(q.print && !q.text) && wide > 0.1 && high > 0.1 && parts.indexOf(q) > parts.indexOf(p)) p.into.push(`${q.name} ${round(wide * high)}mm²`);
      // A thing throws its shadow away from the lamp, in proportion to how far it stands over what it falls on.
      const over = q.z - p.z;
      if (over < 0.3) continue;
      const fromX = q.x - shade[0] * over * REACH, fromY = q.y - shade[1] * over * REACH;
      if (Math.min(p.x + p.w, fromX + q.w) - Math.max(p.x, fromX) > 0.1 && Math.min(p.y + p.h, fromY + q.h) - Math.max(p.y, fromY) > 0.1) p.shaded.push(`${q.name} (${round(over)}mm over it)`);
    }
    if (p.holder) {
      const h = parts.filter(q => holds(q, p)).at(-1), past = Math.max(h.x - p.x, h.y - p.y, p.x + p.w - h.x - h.w, p.y + p.h - h.y - h.h);
      p.past = past > 0.1 ? round(past) : 0;
    }
  }
  const lines = parts.map(p => [
    `${p.name}`, `at ${round(p.x + p.w / 2)},${round(p.y + p.h / 2)}`, `${round(p.w)}×${round(p.h)}mm`, `stands ${round(p.stands)} (${round(p.z - BASE)} up)`,
    p.material, p.holder && `on ${p.holder}`, p.past && `${p.past}mm past its holder`,
    p.into.length && `runs into ${p.into.slice(0, 4).join(', ')}${p.into.length > 4 ? ` and ${p.into.length - 4} more` : ''}`,
    p.shaded.length && `may be shaded by ${p.shaded.slice(0, 2).join(', ')}${p.shaded.length > 2 ? ` and ${p.shaded.length - 2} more` : ''}`,
  ].filter(Boolean).join('  '));
  return {
    size: [round(d.w / MM), round(d.h / MM)], lines,
    counts: { parts: parts.length, into: parts.filter(p => p.into.length).length, shaded: parts.filter(p => p.shaded.length).length, past: parts.filter(p => p.past).length },
    // The biggest thing on it is what everything else sits on, and a close-up of that is a picture of nothing.
    close: parts.filter(p => !parts.some(q => holds(p, q)) && p.pixels.w > 2 && p.pixels.h > 2).map(p => ({ name: p.name, kind: p.name.split(/[ .]/)[0], print: p.print, text: p.text, ...p.pixels })),
  };
};
