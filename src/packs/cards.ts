// A deck of playing cards and the box it comes in. The deck is one part and draws every card itself, as they lie, so fifty-two of them cost what one face and fifty-one edges cost.
// The artwork is plain and traditional, drawn here: pips where they're set on any standard card, and courts cut as a woodblock would.
import { nums } from 'device-ui/controls/shared';
import { defineMaterials, definePart, defineStyles, FOCUS, hinge, linear, minus, MM, circle, partOf, rect, sheaf, squash, squeeze, type FieldShape, type MaterialDef, type Part, type Sheet, type Vec3 } from 'device-ui';

// Only a deck uses these, so they come with it. Sizes and colours are guess unless they say otherwise.
export const materials: Record<string, MaterialDef> = {
  'card-linen': { substance: 'paper', finish: 'embossed-linen', color: '#f6f4ec' },
  'carton-board': { substance: 'paper', finish: 'coated-board', color: '#f2f0e8' },
};

defineMaterials(materials);

defineStyles(`
[d-cards~="deck"] { display: block; }
.d-gl [d-cards~="deck"] > [leaf], .d-gl [d-cards~="deck"] > [grip] { opacity: 0; }
[d-cards~="deck"] > [grip] { appearance: none; margin: 0; padding: 0; border: 0; background: none; cursor: grab; outline: none; }
[d-cards~="deck"] > [grip="cut"], [d-cards~="deck"] > [grip="over"], [d-cards~="deck"] > [grip="spread"] { z-index: 80; }
`);

const CARD_W = 63.5, CARD_H = 88.9; // spec, poker size
const CORNER = 3.2; // spec, 1/8in
const THICK = 0.3; // spec, 0.30mm a card
const DEPTH = 20, FOLD = 20, TONGUE = 22; // guess: the box, its end panel and the tongue tucked in behind its front
const NOTCH = 13, NOTCHED = 9; // guess: the half moon a thumb goes in

const RED = linear('#b4202b'), BLACK = linear('#17161a'), BLUE = linear('#1f356e'), YELLOW = linear('#deb03a'), BACK = linear('#a2212c');

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
const SUITS: Record<Suit, { d: string; w: number; h: number; red: boolean }> = {
  // Each fills -50 to 50 both ways. Club 16 by 15.7 measured on a straight-on photo, the others guess to stand the same.
  spades: { w: 14.5, h: 16, red: false, d: 'M0 -50 C8 -30 50 -8 50 18 C50 34 38 42 26 42 C16 42 8 37 4 30 C5 38 9 46 16 50 L-16 50 C-9 46 -5 38 -4 30 C-8 37 -16 42 -26 42 C-38 42 -50 34 -50 18 C-50 -8 -8 -30 0 -50Z' },
  hearts: { w: 14, h: 15, red: true, d: 'M0 48 C-10 26 -50 5 -50 -20 C-50 -38 -36 -48 -24 -48 C-12 -48 -4 -40 0 -30 C4 -40 12 -48 24 -48 C36 -48 50 -38 50 -20 C50 5 10 26 0 48Z' },
  diamonds: { w: 15.6, h: 16, red: true, d: 'M0 -50 Q14 -24 38 0 Q14 24 0 50 Q-14 24 -38 0 Q-14 -24 0 -50Z' },
  clubs: { w: 16, h: 15.7, red: false, d: 'M0 -48 A23 23 0 0 1 19 -12 A23 23 0 1 1 5 24 C6 34 10 44 17 50 L-17 50 C-10 44 -6 34 -5 24 A23 23 0 1 1 -19 -12 A23 23 0 0 1 0 -48Z' },
};

// Where pips sit on a card, mm from its middle. Columns and rows measured on a straight-on eight; the nine and ten's rows are the usual thirds, guess.
const COL = 14.3, OUT = 27.9, IN = 13.95, THIRD = 9.3;
const both = (x: number, ...ys: number[]) => ys.flatMap(y => [[-x, y], [x, y]]);
const LAYOUT: Record<string, number[][]> = {
  A: [[0, 0]],
  2: [[0, -OUT], [0, OUT]],
  3: [[0, -OUT], [0, 0], [0, OUT]],
  4: both(COL, -OUT, OUT),
  5: [...both(COL, -OUT, OUT), [0, 0]],
  6: both(COL, -OUT, 0, OUT),
  7: [...both(COL, -OUT, 0, OUT), [0, -IN]],
  8: [...both(COL, -OUT, 0, OUT), [0, -IN], [0, IN]],
  9: [...both(COL, -OUT, -THIRD, THIRD, OUT), [0, 0]],
  10: [...both(COL, -OUT, -THIRD, THIRD, OUT), [0, -OUT + THIRD], [0, OUT - THIRD]],
};

const FONT = '"Times New Roman", Times, Georgia, serif';

/** A drawing the size of a card, in mm from its middle. */
const cardField = (key: string, draw: (ctx: CanvasRenderingContext2D) => void, w = CARD_W, h = CARD_H): FieldShape => ({
  type: 'field', cx: 0, cy: 0, hw: (w * MM) / 2, hh: (h * MM) / 2, rotate: 0, spread: 3, key: `cards|${key}`,
  draw(ctx, cw, ch) {
    ctx.scale(cw / w, ch / h);
    ctx.translate(w / 2, h / 2);
    draw(ctx);
  },
});

const pip = (ctx: CanvasRenderingContext2D, suit: Suit, x: number, y: number, w: number, h: number, down = false) => {
  ctx.save();
  ctx.translate(x, y);
  if (down) ctx.rotate(Math.PI);
  ctx.scale(w / 100, h / 100);
  ctx.fill(new Path2D(SUITS[suit].d));
  ctx.restore();
};

// Rank and small pip in two corners, turned for the other hand. Measured: rank at 5.1, 9.3 and 9 tall, pip at 5, 18.4 and 6.5 by 6.8.
const indices = (ctx: CanvasRenderingContext2D, rank: string, suit: Suit) => {
  for (const turn of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(turn);
    ctx.translate(-CARD_W / 2, -CARD_H / 2);
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (rank === '10') {
      ctx.letterSpacing = '-1.2px';
      ctx.scale(0.78, 1);
      ctx.fillText(rank, 5.1 / 0.78, 13.4);
    } else ctx.fillText(rank, 5.1, 13.4);
    ctx.restore();
    ctx.save();
    ctx.rotate(turn);
    pip(ctx, suit, 5 - CARD_W / 2, 18.4 - CARD_H / 2, 6.5, 6.8);
    ctx.restore();
  }
};

const numbered = (rank: string, suit: Suit) => cardField(`${rank}|${suit}`, ctx => {
  indices(ctx, rank, suit);
  const { w, h } = SUITS[suit], k = rank === 'A' ? (suit === 'spades' ? 1.9 : 1.3) : 1;
  for (const [x, y] of LAYOUT[rank]!) pip(ctx, suit, x!, y!, w * k, h * k, y! > 0);
});

// The courts, as a woodblock prints them: one block for each colour and a key block for the black. Half a figure from the waist up, turned for the other half.
// Each piece is painted in order and knocks out what's under it from every other block, so the colours register as the drawing says.
type Ink = 'yellow' | 'blue' | 'red' | 'black';
type Piece = readonly [Ink | 'paper' | 'line', string];
const HW = 19.55, HH = 35.45; // guess, from a straight-on court: the frame round the figure

const trim = (main: Ink, band: Ink): Piece[] => [
  [main, 'M-20 8 L-20 -13 Q-13 -17.5 -6.5 -19 L6.5 -19 Q13 -17.5 20 -13 L20 8Z'],
  ['line', 'M-17 8 L-16 -13 M-13 8 L-12 -15 M17 8 L16 -13 M13 8 L12 -15'],
  [band, 'M-5 -18.5 L5 -18.5 L8 8 L-8 8Z'],
  [main, 'M0 -15 L2 -12.5 L0 -10 L-2 -12.5Z M0 -8.5 L2.6 -5.5 L0 -2.5 L-2.6 -5.5Z M0 -1 L2.8 2 L0 5 L-2.8 2Z'],
  ['paper', 'M-12.5 -18 Q-6 -11.5 0 -11.5 Q6 -11.5 12.5 -18 L8 -20.5 L-8 -20.5Z'],
  ['black', 'M-8 -16.6 l.8 1.6 l.8 -1.6Z M-3.6 -14.4 l.8 1.6 l.8 -1.6Z M2 -14.4 l.8 1.6 l.8 -1.6Z M6.4 -16.6 l.8 1.6 l.8 -1.6Z'],
];
const FACE: Piece[] = [
  ['paper', 'M-5.5 -28 L5.5 -28 Q6 -21 4 -18 Q0 -16 -4 -18 Q-6 -21 -5.5 -28Z'],
  ['line', 'M-3.8 -24.6 Q-2.5 -25.6 -1.2 -24.6 M1.2 -24.6 Q2.5 -25.6 3.8 -24.6 M0 -24.6 L-.8 -21.2 L.6 -21 M-1.6 -19.2 Q0 -18.5 1.6 -19.2'],
];
const king = (main: Ink, band: Ink): Piece[] => [
  ...trim(main, band),
  ['black', 'M-8.5 -17 Q-10.5 -25 -7 -28 L7 -28 Q10.5 -25 8.5 -17 L6 -19 L-6 -19Z'],
  ...FACE,
  ['yellow', 'M-5.6 -23 Q-6.4 -15 0 -12.5 Q6.4 -15 5.6 -23 Q4 -20.4 2 -20.2 Q0 -21 -2 -20.2 Q-4 -20.4 -5.6 -23Z'],
  ['line', 'M-1.6 -19 Q0 -18 1.6 -19 M-2 -16.5 L-1.4 -14.2 M2 -16.5 L1.4 -14.2 M0 -17 L0 -13.6'],
  ['yellow', 'M-7 -27 L-8.4 -35.6 L-4.2 -30.5 L0 -35.8 L4.2 -30.5 L8.4 -35.6 L7 -27Z'],
  [main, 'M-7.2 -29 L7.2 -29 L7 -26.8 L-7 -26.8Z'],
  ['blue', 'M13 -35.6 L15.6 -32 L15.6 -8 L10.4 -8 L10.4 -32Z'],
  ['line', 'M13 -33 L13 -8'],
  ['yellow', 'M8.5 -8 L17.5 -8 L17.5 -6 L8.5 -6Z'],
  ['paper', 'M10.6 -6 L15.4 -6 L16 -1 L10 -1Z'],
];
const queen = (main: Ink, band: Ink): Piece[] => [
  ...trim(main, band),
  ['black', 'M-9.5 -10 Q-12 -22 -7.4 -28 L7.4 -28 Q12 -22 9.5 -10 Q7.6 -14 7 -19 L-7 -19 Q-7.6 -14 -9.5 -10Z'],
  ...FACE,
  ['yellow', 'M-6.4 -27 L-7 -33 L-3.4 -30 L0 -34.4 L3.4 -30 L7 -33 L6.4 -27Z'],
  [main, 'M-6.6 -28.6 L6.6 -28.6 L6.4 -26.8 L-6.4 -26.8Z'],
  ['line', 'M13.4 -22 Q14.6 -14 13 -5'],
  [main, 'M13.4 -30 a3 3 0 1 1 0 .1Z M8.6 -25.6 a3 3 0 1 1 0 .1Z M18.2 -25.6 a3 3 0 1 1 0 .1Z M10.4 -20 a3 3 0 1 1 0 .1Z M16.4 -20 a3 3 0 1 1 0 .1Z'],
  ['yellow', 'M13.4 -26.4 a2.2 2.2 0 1 1 0 .1Z'],
  ['paper', 'M10.4 -7 L16 -7 L16.4 -2 L10 -2Z'],
];
const jack = (main: Ink, band: Ink): Piece[] => [
  ...trim(main, band),
  ['yellow', 'M-8.6 -16.5 Q-10 -24 -7 -28 L7 -28 Q10 -24 8.6 -16.5 Q7 -18 6 -19 L-6 -19 Q-7 -18 -8.6 -16.5Z'],
  ['line', 'M-8 -24 Q-8 -20 -7 -17.5 M8 -24 Q8 -20 7 -17.5'],
  ...FACE,
  [main, 'M-10 -26.8 Q-9 -33 0 -33 Q9 -33 10 -26.8Z'],
  [band, 'M-10.4 -27.6 L10.4 -27.6 L10 -25.8 L-10 -25.8Z'],
  ['blue', 'M6.6 -30 Q11 -36 15.6 -35 Q12.6 -33 11.4 -30 Q9 -29 6.6 -30Z'],
  ['line', 'M7.6 -30 Q11 -33.6 15 -35'],
  ['blue', 'M12.2 -36 L14 -36 L14 -2 L12.2 -2Z'],
  ['yellow', 'M14 -35 Q19 -31.6 19 -26 Q16.6 -28.4 14 -28.4Z'],
  ['paper', 'M10.6 -7.4 L15.6 -7.4 L16 -2.6 L10.2 -2.6Z'],
];
const FIGURE = { K: king, Q: queen, J: jack };

const courtBlock = (rank: 'K' | 'Q' | 'J', suit: Suit, block: Ink) => cardField(`${rank}|${suit}|${block}`, ctx => {
  const { red } = SUITS[suit], ink: Ink = red ? 'red' : 'black', pieces = FIGURE[rank](red ? 'red' : 'blue', 'yellow');
  if (block === ink) indices(ctx, rank, suit);
  const line = () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 0.28;
    ctx.lineJoin = 'round';
  };
  for (const turn of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(turn);
    ctx.beginPath();
    ctx.rect(-HW, -HH, HW * 2, HH);
    ctx.moveTo(-HW, 2.6);
    ctx.lineTo(HW, -2.6);
    ctx.lineTo(HW, 0);
    ctx.lineTo(-HW, 0);
    ctx.clip();
    for (const [what, d] of pieces) {
      const shape = new Path2D(d);
      if (what === 'line') {
        if (block === 'black') {
          line();
          ctx.stroke(shape);
        }
        continue;
      }
      ctx.globalCompositeOperation = what === block ? 'source-over' : 'destination-out';
      ctx.fill(shape);
      if (block === 'black' && what !== 'black') {
        line();
        ctx.stroke(shape);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // What suit it is, up in the corner of the frame.
    if (block === ink) pip(ctx, suit, -14.2, -29.6, 7.4, 7.8);
    ctx.restore();
  }
  if (block === 'black') {
    line();
    ctx.strokeRect(-HW, -HH, HW * 2, HH * 2);
    ctx.beginPath();
    ctx.moveTo(-HW, 2.6);
    ctx.lineTo(HW, -2.6);
    ctx.stroke();
  }
});

// The back, the same both ways up so it says nothing: a lattice reversed out of one red, a border of bare card round it, and a rosette in the middle.
const BORDER = 4;
const back = cardField('back', ctx => {
  const w = CARD_W / 2 - BORDER, h = CARD_H / 2 - BORDER;
  ctx.beginPath();
  ctx.roundRect(-w, -h, w * 2, h * 2, 1.4);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-out';
  // The frame inside the edge, then the lattice inside that.
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.roundRect(-w + 1.3, -h + 1.3, w * 2 - 2.6, h * 2 - 2.6, 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-w + 2.2, -h + 2.2, w * 2 - 4.4, h * 2 - 4.4);
  ctx.clip();
  const pitch = 5.2, rise = 1.25;
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  for (let i = -24; i <= 24; i++) {
    const c = i * pitch;
    ctx.moveTo(-40, c - 40 * rise);
    ctx.lineTo(40, c + 40 * rise);
    ctx.moveTo(-40, c + 40 * rise);
    ctx.lineTo(40, c - 40 * rise);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
    // Each crossing is at a whole number of half pitches along both lines; the middle of each lozenge is half a pitch on.
    const x = ((i + j) * pitch) / (2 * rise), y = ((i - j + 1) * pitch) / 2;
    ctx.moveTo(x, y - 0.8);
    ctx.lineTo(x + 0.6, y);
    ctx.lineTo(x, y + 0.8);
    ctx.lineTo(x - 0.6, y);
    ctx.closePath();
  }
  ctx.fill();
  // The rosette, bare card with red on it.
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.4, 11.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.scale(1, 1.24);
    ctx.rotate((i * Math.PI) / 6);
    ctx.beginPath();
    ctx.moveTo(0, -1.3);
    ctx.quadraticCurveTo(1.8, -4.8, 0, -8.2);
    ctx.quadraticCurveTo(-1.8, -4.8, 0, -1.3);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
});

const box = (w: number, h: number) => cardField(`box|${w}|${h}`, ctx => {
  const x = w / 2 - 3.5, y = h / 2 - 3.5;
  ctx.beginPath();
  ctx.roundRect(-x, -y, x * 2, y * 2, 1);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-x + 1.6, -y + 1.6, x * 2 - 3.2, y * 2 - 3.2);
  ctx.beginPath();
  ctx.ellipse(0, 3, 15, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 4.6px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0.5px';
  ctx.fillText('PLAYING CARDS', 0, 31);
  ctx.font = `400 2.5px ${FONT}`;
  ctx.letterSpacing = '0.35px';
  ctx.fillText('POKER SIZE', 0, 36.2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.ellipse(0, 3, 13.4, 17.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  pip(ctx, 'spades', 0, 3, 16, 20);
  ctx.restore();
}, w, h);

const flapArt = (w: number) => ({
  type: 'field' as const, cx: 0, cy: 0, hw: (w * MM) / 2, hh: ((FOLD + TONGUE) * MM) / 2, rotate: 0, spread: 3, key: `cards|flap|${w}`,
  // From the hinge at the bottom: the end panel, printed solid, then the tongue, bare but for a line.
  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    ctx.scale(cw / w, ch / (FOLD + TONGUE));
    ctx.fillRect(0, TONGUE + 0.6, w, FOLD - 1.2);
    ctx.fillRect(4, 3, w - 8, 0.4);
  },
});

const flapBody = (x: number, y: number, w: number, h: number): FieldShape => {
  const r = 6;
  return {
    type: 'field', cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, rotate: 0, spread: 8, key: `cards|flapbody|${Math.round(w)}|${Math.round(h)}`,
    draw(ctx, cw, ch) {
      ctx.beginPath();
      ctx.roundRect(0, 0, cw, ch, [r * MM, r * MM, 0, 0]);
      ctx.fill();
    },
  };
};

const flapJoint = hinge({ mass: 6, material: 'plastic-on-plastic', travel: 4, contact: 'toggle' });

const boxOf = (p: Part) => p.el.querySelectorAll<HTMLElement>(':scope > [d-cards~="box"]')[0];
const flapOf = (p: Part) => boxOf(p)?.querySelectorAll<HTMLElement>(':scope > [d-cards~="flap"]')[0];

// What a card is called, from its `card`: "Q hearts".
const CALLED: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

const hand = sheaf({
  thick: THICK,
  named(el) {
    const [rank = '', suit = ''] = (el.getAttribute('card') ?? '').split(' ');
    return `${CALLED[rank] ?? rank} of ${suit}`;
  },
  seat(p) {
    const b = boxOf(p);
    return b ? [b.offsetLeft + b.offsetWidth / 2 - p.el.offsetWidth / 2, b.offsetTop + b.offsetHeight / 2 - p.el.offsetHeight / 2] : null;
  },
  open: p => !flapOf(p) || flapOf(p)!.hasAttribute('open'),
  opening(p) {
    flapOf(p)?.querySelector('button')?.click();
  },
  // Round the lower left, where a thumb holds them. Guess.
  pin: p => [-p.w / 2 + 8 * MM, p.h / 2 - 10 * MM],
});

function paintFlap(s: Sheet, x: number, y: number, w: number, v: number) {
  const reach = FOLD + TONGUE, long = reach * MM * Math.sin((v * Math.PI) / 2);
  if (long < 1) return;
  const body = squash(flapBody(0, 0, w, reach * MM), long / (reach * MM));
  s.group({ at: [x + w / 2 - body.cx, y - long / 2 - body.cy] }, () => {
    s.surface(body, { material: 'carton-board', zEdge: DEPTH * (1 - v), rise: 0.5, bevel: 0.6 }, () => {
      s.group({ at: [body.cx, body.cy] }, () => s.print(squash(flapArt(w / MM), long / (reach * MM)), BACK));
    });
  });
}

function paintBox(s: Sheet, x: number, y: number, w: number, h: number) {
  const notch = circle(x + w / 2, y + NOTCHED * MM - NOTCH * MM, NOTCH * MM);
  s.surface(minus(rect(x, y, w, h, { radius: 1.5 }), notch), { material: 'carton-board', zEdge: 0, rise: DEPTH, bevel: 0.6 }, () => {
    s.group({ at: [x + w / 2, y + h / 2] }, () => s.print(box(w / MM, h / MM), BACK));
  });
}

function paintCard(s: Sheet, x: number, y: number, a: number, f: number, z: number, card: string, covered: boolean, w: number, h: number) {
  const narrow = Math.max(Math.abs(Math.cos(Math.PI * f)), 0.02), wide = w * narrow;
  s.group({ at: [x, y], rotate: a }, () => {
    s.surface(rect(-wide / 2, -h / 2, wide, h, { radius: Math.min(CORNER * MM, wide / 2) }), { material: 'card-linen', zEdge: z, rise: THICK, bevel: 0.5 }, covered ? undefined : () => {
      if (f < 0.5) return void s.print(squeeze(back, narrow), BACK);
      const [rank = 'A', suit = 'spades'] = card.split(' '), kind = suit as Suit;
      if (rank === 'K' || rank === 'Q' || rank === 'J') for (const [block, ink] of [['yellow', YELLOW], ['blue', BLUE], ['red', RED], ['black', BLACK]] as const) s.print(squeeze(courtBlock(rank, kind, block), narrow), ink);
      else s.print(squeeze(numbered(rank, kind), narrow), SUITS[kind].red ? RED : BLACK);
    });
  });
}

// A whole deck, in `card="Q hearts"` buttons in the order they lie, bottom first, with the `grip`s a hand takes the stack by. The top card takes a tap and it's dealt to the next of `deal`, x y pairs in mm from the deck's middle, the last of them taking the rest.
// A loose one turns over at a tap and goes where it's dragged, and back on the stack if it's let go over it. `grip="cut"` lifts the top off, `grip="spread"` fans them, a range from 0 to 1, `grip="over"` turns the lot, and `grip="take"` and `grip="away"` get them out of the box and back in.
// With a `d-cards="box"` inside, it starts in that, and draws it. Size it to one card. `material` is left to the pack: a card is what it is.
definePart({
  selector: '[d-cards~="deck"]',
  ...hand,
  paint(s, p) {
    hand.deals(p, nums(p, 'deal', []));
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, boxEl = boxOf(p), boxed = boxEl ? partOf(boxEl) : undefined, flapEl = flapOf(p), flap = flapEl ? partOf(flapEl) : undefined;
    const v = flap ? flapJoint.value(flap) : 1, focus = p.el.querySelector(':focus-visible');
    const leaves = hand.leaves(p);
    const one = (l: (typeof leaves)[number]) => {
      paintCard(s, cx + l.x, cy + l.y, l.a, l.f, l.z + hand.lift(l.f), l.el.getAttribute('card') ?? '', l.covered, p.w, p.h);
      if (focus === l.el) s.group({ at: [cx + l.x, cy + l.y], rotate: l.a }, () => s.glow(rect(-p.w / 2 - 1.5, -p.h / 2 - 1.5, p.w + 3, p.h + 3, { radius: CORNER * MM + 1.5 }), FOCUS));
    };
    if (boxed) {
      // The inside of the back, under whatever's in it.
      s.surface(rect(boxed.x, boxed.y, boxed.w, boxed.h, { radius: 1.5 }), { material: 'carton-board', zEdge: 0, rise: 0.5, bevel: 0.4 });
      paintFlap(s, boxed.x, boxed.y, boxed.w, v);
      for (const l of leaves) if (l.cased) one(l);
      // The tongue, tucked in between the cards and the front until it's pulled out.
      const tucked = TONGUE * MM * Math.max(1 - v * 2, 0);
      if (tucked > 1) s.surface(rect(boxed.x + 2, boxed.y, boxed.w - 4, tucked), { material: 'carton-board', zEdge: DEPTH - 1, rise: 0.4, bevel: 0.4 });
      paintBox(s, boxed.x, boxed.y, boxed.w, boxed.h);
    }
    for (const l of leaves) if (!l.cased) one(l);
  },
});

// The carton a deck comes in. Inside a deck, the deck draws it, as the cards go in and out of it; on its own it draws itself.
definePart({
  selector: '[d-cards~="box"]',
  paint(s, p) {
    if (!p.el.closest('[d-cards~="deck"]')) paintBox(s, p.x, p.y, p.w, p.h);
  },
});

// The box's end, tucked in. A tap pulls it out, or shuts it again. Sits along the top of a `d-cards="box"`, and draws upwards out of it.
definePart({
  selector: '[d-cards~="flap"]',
  ...flapJoint,
  spreads: true,
  paint(s, p) {
    if (!p.el.closest('[d-cards~="deck"]')) paintFlap(s, p.x, p.y, p.w, flapJoint.value(p));
  },
});
