// What holds a collection, and what's held. A machine has one shape. A shelf has a rule: what doesn't fit goes on the next one down, so it's as wide as the page it's on.
import { definePart, defineStyles, FOCUS, layOf, MM, offerSeat, press, rect, seatOf, text, type Part } from 'device-ui';
import { words } from 'device-ui/controls/key';
import { font, keyStyles, num } from 'device-ui/controls/shared';

const BOARD = 20, SIDE = 18;

// Room for the boards comes from here, so a shelf needs no styles of its own on any page. `--board` and `--side` follow its attributes.
defineStyles(`${keyStyles('[d-library~="book"]')}
[d-library~="shelf"] {
  --board: ${BOARD * MM}px; --side: ${SIDE * MM}px; --room: 72px;
  display: flex; flex-wrap: wrap; align-items: flex-end; align-content: flex-start;
  gap: calc(var(--board) + var(--room)) 12px; padding: 0 0 var(--board);
}
[d-library~="case"] { padding: calc(var(--board) + var(--room)) calc(var(--side) + 24px) var(--board); }
[d-library~="book"] { display: block; position: relative; flex: none; text-decoration: none; }
.d-gl [d-library~="book"] { color: transparent; }`);

/** Where the browser wrapped a part's children: the top and bottom of each line, css px from the part's top. */
function linesOf(p: Part): { top: number; bottom: number }[] {
  const held = p.el.querySelectorAll(':scope > :not(canvas)'), lines: { top: number; bottom: number }[] = [];
  if (!held.length) return lines;
  const box = p.el.getBoundingClientRect(), zoom = box.height / p.h || 1;
  for (const child of held) {
    const r = child.getBoundingClientRect(), top = (r.top - box.top) / zoom, bottom = (r.bottom - box.top) / zoom, line = lines.at(-1);
    if (line && top < line.bottom) {
      line.top = Math.min(line.top, top);
      line.bottom = Math.max(line.bottom, bottom);
    } else lines.push({ top, bottom });
  }
  return lines;
}

// Boards under whatever stands in it, one to a line, however the page wrapped it, in the gap below that line.
// `case` is a bookcase, with a top and two sides in the padding and empty boards down to the bottom. `wall` is boards alone, as on brackets.
// `board` is how thick one is and `side` how wide the sides are, in mm, and `height` how far they stand off the back.
definePart({
  selector: '[d-library~="shelf"]',
  options: ['wall', 'case'],
  connect(p) {
    p.el.style.setProperty('--board', `${num(p, 'board', BOARD) * MM}px`);
    p.el.style.setProperty('--side', `${num(p, 'side', SIDE) * MM}px`);
  },
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || d.material, inCase = !words(p, 'd-library').includes('wall');
    const board = num(p, 'board', BOARD) * MM, side = num(p, 'side', SIDE) * MM, rise = num(p, 'height', 14), bevel = 1.2 * MM;
    const lines = linesOf(p), boards = lines.map(l => p.y + l.bottom);
    if (inCase) {
      const last = lines.at(-1), pitch = last ? last.bottom - (lines.at(-2)?.bottom ?? 0) : 0, floor = p.y + p.h - board;
      for (let y = (boards.at(-1) ?? p.y) + pitch; pitch && y < floor - board; y += pitch) boards.push(y);
      if ((boards.at(-1) ?? p.y) < floor - 1) boards.push(floor);
      boards.unshift(p.y);
    }
    const seat = seatOf(p), left = inCase ? p.x + side : p.x, wide = inCase ? p.w - side * 2 : p.w;
    const over = { wear: d.wear * 0.5, ...layOf('0') };
    for (const y of boards) s.surface(rect(left, y, wide, board, { radius: 0.6 * MM }), { material, rise, bevel, over });
    if (inCase) for (const x of [p.x, p.x + p.w - side]) s.surface(rect(x, p.y, side, p.h), { material, rise: rise + 0.4, bevel, over: { ...over, ...layOf('90') } });
    offerSeat(p.el, {
      top: seat, crown: [0, 0], x: p.x, y: p.y, w: p.w, h: p.h,
      at: (_, y) => (boards.some(b => y > b && y < b + board) ? seat + rise : seat),
    });
  },
});

const held = press({ mass: 120, rests: 0.5 });
/** How far a book comes off the shelf when it's drawn out, mm. */
const OUT = 14;
const HINGE = 7 * MM, GROOVE = 1.3 * MM, BANDS = 11 * MM;
/** How far a spine falls from its middle to its edges, for each mm it is across. */
const ROUNDED = 0.06;

// A hardback, filling its box. `face` shows its cover, with whatever's stamped on it nested inside, and `spine` stands with its back out and its words up it.
// Pulling it toward you is the press: it comes out a little under a resting hand, and further when it's held. `height` is how far it stands, in mm.
definePart({
  selector: '[d-library~="book"]',
  options: ['spine', 'face'],
  ...held,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'bookcloth-oxblood', foil = p.el.getAttribute('foil') || 'foil-gold';
    const rise = num(p, 'height', 11) + held.value(p) * OUT, over = { wear: d.wear * 0.4 };
    offerSeat(p.el, { top: seatOf(p) + rise, crown: [0, 0], x: p.x, y: p.y, w: p.w, h: p.h });
    if (words(p, 'd-library').includes('spine')) {
      // Round across and cut square at the head and tail, so it swells along one axis only.
      s.surface(rect(p.x, p.y, p.w, p.h, { radius: 0.5 * MM }), { material, rise, bevel: 1.1 * MM, crown: [(p.w / MM) * ROUNDED, 0], over });
      const stamp = { material: foil, follow: true, rise: 0.05, bevel: 0.4, over: { wear: 0 } }, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      for (const y of [p.y + BANDS, p.y + p.h - BANDS - MM]) s.surface(rect(p.x + 0.6 * MM, y, p.w - 1.2 * MM, MM), stamp);
      const words = p.el.textContent?.trim();
      if (words) {
        const size = Math.min(p.w * 0.46, 8 * MM), long = p.h - BANDS * 2 - 6 * MM;
        s.surface(text(words, cx - long / 2, cy - size, long, size * 2, { font: font(p, size, 500), rotate: Math.PI / 2 }), stamp);
      }
    } else {
      s.surface(rect(p.x + HINGE / 2, p.y, p.w - HINGE / 2, p.h, { radius: 0.6 * MM }), { material, rise, bevel: 1.1 * MM, over });
      s.surface(rect(p.x, p.y, HINGE, p.h, { radius: 0.5 * MM }), { material, rise: rise + 0.5, bevel: 1.1 * MM, crown: [1, 0], over });
      s.cut(rect(p.x + HINGE, p.y, GROOVE, p.h), { depth: 0.9, soft: 3 });
    }
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: MM }), FOCUS);
  },
});
