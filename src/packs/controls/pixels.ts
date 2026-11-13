import { present } from './displays.js';

// Five columns of seven dots for each of ASCII 32 to 126, lowest bit on top.
const FONT = '0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649552250 0005030000 001C224100 0041221C00 14083E0814 08083E0808 0050300000 0808080808 0060600000 2010080402 3E5149453E 00427F4000 4261514946 2141454B31 1814127F10 2745454539 3C4A494930 0171090503 3649494936 064949291E 0036360000 0056360000 0814224100 1414141414 0041221408 0201510906 324979413E 7E1111117E 7F49494936 3E41414122 7F4141221C 7F49494941 7F09090901 3E4149497A 7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F020C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E 7F09192946 4649494931 01017F0101 3F4040403F 1F2040201F 3F4038403F 6314081463 0708700807 6151494543 007F414100 0204081020 0041417F00 0402010204 4040404040 0001020400 2054545478 7F48444438 3844444420 384444487F 3854545418 087E090102 0C5252523E 7F08040478 00447D4000 2040443D00 7F10284400 00417F4000 7C04180478 7C08040478 3844444438 7C14141408 081414187C 7C08040408 4854545420 043F444020 3C4040207C 1C2040201C 3C4030403C 4428102844 0C5050503C 4464544C44 0008364100 00007F0000 0041360800 1008081008'.split(' ')
  .map(g => [0, 1, 2, 3, 4].map(i => parseInt(g.slice(i * 2, i * 2 + 2), 16)));
// Digits three wide and five high, each row its bits, left on top.
const SMALL = ['75557', '26227', '71747', '71717', '55711', '74717', '74757', '71222', '75757', '75717'];

// Letters with an inner stroke close up when struck twice, so they have heavy cuts of their own.
const HEAVY: Record<string, number[]> = {
  M: [0x7f, 0x7f, 0x06, 0x0c, 0x06, 0x7f, 0x7f], W: [0x7f, 0x7f, 0x30, 0x18, 0x30, 0x7f, 0x7f],
  m: [0x7c, 0x7c, 0x04, 0x7c, 0x78, 0x04, 0x7c, 0x78], w: [0x7c, 0x7c, 0x40, 0x7c, 0x40, 0x7c, 0x7c],
};

const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
/** An opaque pixel as the word ImageData holds it. */
const word = (r: number, g: number, b: number) => (LITTLE ? (255 << 24 | b << 16 | g << 8 | r) : (r << 24 | g << 16 | b << 8 | 255)) >>> 0;

/** Whether two pages hold the same dots, a word at a time. */
function same(a: Uint8Array, b: Uint8Array): boolean {
  const n = a.length >> 2;
  if (!(a.byteOffset & 3) && !(b.byteOffset & 3)) {
    const x = new Uint32Array(a.buffer, a.byteOffset, n), y = new Uint32Array(b.buffer, b.byteOffset, n);
    for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false;
  } else for (let i = 0; i < n << 2; i++) if (a[i] !== b[i]) return false;
  for (let i = n << 2; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** How wide a glyph really is, for setting type tight. */
const glyph = (ch: string, bold?: boolean) => {
  if (bold && HEAVY[ch]) return HEAVY[ch]!;
  const cols = FONT[ch.charCodeAt(0) - 32] ?? FONT[31]!;
  let from = 0, to = 5;
  while (from < to && !cols[from]) from++;
  while (to > from && !cols[to - 1]) to--;
  return cols.slice(from, to);
};

const advance = (ch: string, bold?: boolean) => glyph(ch, bold).length + (bold && !HEAVY[ch] ? 1 : 0) + 1;

/** The panel's five by seven on a fixed pitch, six dots to a letter, as a calculator or a terminal sets its cells. */
export const MONO: Face = {
  height: 7,
  space: 6,
  glyphs: Object.fromEntries(FONT.map((cols, i) => [String.fromCharCode(i + 32), { w: 5, rows: [0, 1, 2, 3, 4, 5, 6].map(r => cols.reduce((row, c, x) => row | ((c >> r & 1) << x), 0)) }])),
};

/** A face of type of one's own: `height` dots to the line, each glyph its width and rows, low bit on the left. */
export interface Face {
  height: number;
  /** Dots of a word space. */
  space: number;
  glyphs: Record<string, { w: number; rows: number[] }>;
}

export interface TextStyle {
  /** Set in this face in place of the panel's own five by seven. */
  face?: Face;
  /** Struck twice, a dot apart. */
  bold?: boolean;
  /** Dots to clear rather than set. */
  clear?: boolean;
  /** Every dot this many dots square. */
  size?: number;
}

/**
 * What a one-bit panel shows: a page of dots to draw on, with the type and shapes small firmware
 * has, and that goes to the panel's canvas only when a dot has changed. A set dot is a dark crystal
 * on an lcd and a lit one on a tube, and given a palette a dot is any of its colours. `Pixels.page` is the same page held in memory, for a window
 * that is drawn once and copied to the screen with `blit`.
 */
export class Pixels {
  readonly w: number;
  readonly h: number;
  /** Which colour of the palette `set` lays down. On a panel with no palette, a set dot. */
  pen = 1;
  /** Which colour clearing lays down, and what `get` reads as empty. */
  paper = 0;
  /** How hard a set dot is driven, 0 to 1, as a contrast setting does. */
  level = 1;
  /** A set dot is dark and the rest lit, for a tube showing ink on paper. */
  reverse = false;
  private dots: Uint8Array;
  private shown: Uint8Array;
  private shownLevel = -1;
  private shownReverse = false;
  private ctx: CanvasRenderingContext2D | null;
  private image: ImageData | null;

  /** `palette` gives a panel colours, as 0xrrggbb, and each dot then holds one of them by number. */
  constructor(private screen: Element | { w: number; h: number }, private palette?: readonly number[]) {
    const canvas = screen instanceof Element ? screen.querySelector('canvas')! : null;
    this.w = canvas?.width ?? (screen as { w: number }).w;
    this.h = canvas?.height ?? (screen as { h: number }).h;
    this.dots = new Uint8Array(this.w * this.h);
    this.shown = canvas ? new Uint8Array(this.w * this.h) : this.dots;
    this.ctx = canvas?.getContext('2d') ?? null;
    this.image = this.ctx?.createImageData(this.w, this.h) ?? null;
  }

  /** A page with no panel behind it. */
  static page(w: number, h: number): Pixels {
    return new Pixels({ w, h });
  }

  clear(): this {
    this.dots.fill(this.paper);
    return this;
  }

  set(x: number, y: number, on = true): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.dots[(y | 0) * this.w + (x | 0)] = on ? this.pen : this.paper;
  }

  get(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.dots[y * this.w + x] !== this.paper;
  }

  /** A filled box. */
  fill(x: number, y: number, w: number, h: number, on = true): this {
    // The dots `set` would reach stepping a dot at a time from (x, y), a row at a time.
    const span = (at: number, n: number, max: number) => [Math.floor(at) + Math.max(0, Math.ceil(-at)), Math.min(Math.floor(at) + Math.ceil(n), max)] as const;
    const [left, right] = span(x, w, this.w), [top, bottom] = span(y, h, this.h), c = on ? this.pen : this.paper;
    if (right > left) for (let j = top; j < bottom; j++) this.dots.fill(c, j * this.w + left, j * this.w + right);
    return this;
  }

  /** Copies a box of another page here, as a bit-block transfer does, cut off at this page's edge. */
  blit(from: Pixels, x = 0, y = 0, sx = 0, sy = 0, w = from.w, h = from.h): this {
    const left = Math.max(x, 0), right = Math.min(x + w, this.w), top = Math.max(y, 0), bottom = Math.min(y + h, this.h);
    if (right <= left) return this;
    for (let j = top; j < bottom; j++) {
      const at = (j - y + sy) * from.w + left - x + sx;
      this.dots.set(from.dots.subarray(at, at + right - left), j * this.w + left);
    }
    return this;
  }

  /** Turns over every dot in a box. */
  flip(x: number, y: number, w: number, h: number): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, !this.get(i, j));
    return this;
  }

  /** The outline of a box, its corners cut `r` dots back. */
  box(x: number, y: number, w: number, h: number, r = 0, on = true): this {
    for (let i = x + r; i < x + w - r; i++) {
      this.set(i, y, on);
      this.set(i, y + h - 1, on);
    }
    for (let j = y + r; j < y + h - r; j++) {
      this.set(x, j, on);
      this.set(x + w - 1, j, on);
    }
    for (let k = 1; k < r; k++) {
      this.set(x + k, y + r - k, on);
      this.set(x + w - 1 - k, y + r - k, on);
      this.set(x + k, y + h - 1 - r + k, on);
      this.set(x + w - 1 - k, y + h - 1 - r + k, on);
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, on = true): this {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
      this.set(x, y, on);
      if (x === x1 && y === y1) return this;
      const e = err * 2;
      if (e >= dy) {
        err += dy;
        x += sx;
      }
      if (e <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** An ellipse: `solid` fills it, and `pen` draws its edge, either of which can be left out. */
  oval(cx: number, cy: number, rx: number, ry: number, o: { solid?: boolean; pen?: boolean } = { pen: true }): this {
    const edge = (x: number, y: number) => (x * x) / (rx * rx) + (y * y) / (ry * ry);
    for (let j = -ry - 1; j <= ry + 1; j++) for (let i = -rx - 1; i <= rx + 1; i++) {
      if (edge(i, j) > 1) continue;
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => edge(i + a!, j + b!) > 1);
      if (o.solid !== undefined) this.set(cx + i, cy + j, !o.solid ? false : !(rim && o.pen === false));
      if (rim && o.pen) this.set(cx + i, cy + j);
    }
    return this;
  }

  /** How wide a string sets. */
  width(str: string, o: TextStyle = {}): number {
    const k = o.size ?? 1, { face } = o;
    if (face) {
      let w = 0;
      for (const ch of str) w += ch === ' ' ? face.space : (face.glyphs[ch]?.w ?? face.space) + (o.bold ? 2 : 1);
      return Math.max(w - 1, 0);
    }
    let w = 0;
    for (const ch of str) w += ch === ' ' ? 3 * k : advance(ch, o.bold) * k;
    return Math.max(w - k, 0);
  }

  /** Sets a line of type from its top left, proportionally, and returns where it ended. */
  text(str: string, x: number, y: number, o: TextStyle = {}): number {
    const k = o.size ?? 1, { face } = o;
    if (face) {
      for (const ch of str) {
        const g = face.glyphs[ch];
        if (!g || ch === ' ') {
          x += face.space;
          continue;
        }
        g.rows.forEach((bits, j) => {
          for (let i = 0; bits >> i; i++) {
            if (!(bits >> i & 1)) continue;
            this.set(x + i, y + j, !o.clear);
            if (o.bold) this.set(x + i + 1, y + j, !o.clear);
          }
        });
        x += g.w + (o.bold ? 2 : 1);
      }
      return x;
    }
    for (const ch of str) {
      if (ch === ' ') {
        x += 3 * k;
        continue;
      }
      const strike = o.bold && !HEAVY[ch] ? 2 : 1;
      glyph(ch, o.bold).forEach((bits, i) => {
        for (let b = 0; b < 8; b++) if (bits >> b & 1) this.fill(x + i * k, y + b * k, k * strike, k, !o.clear);
      });
      x += advance(ch, o.bold) * k;
    }
    return x;
  }

  /** The same, centred on `cx`. */
  centre(str: string, cx: number, y: number, o: TextStyle = {}): this {
    this.text(str, Math.round(cx - this.width(str, o) / 2), y, o);
    return this;
  }

  /** Small digits, three by five. */
  digits(str: string, x: number, y: number, on = true): number {
    for (const ch of str) {
      const rows = SMALL[+ch];
      if (rows && ch !== ' ') {
        for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (+rows[j]! >> (2 - i) & 1) this.set(x + i, y + j, on);
      }
      x += 4;
    }
    return x;
  }

  /** Draws a picture of rows, `#` to set a dot, `-` to clear one and anything else to leave it. */
  sprite(rows: readonly string[], x: number, y: number): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '#') this.set(x + i, y + j);
        else if (row[i] === '-') this.set(x + i, y + j, false);
      }
    });
    return this;
  }

  /** Gives the panel new colours, as a contrast dial does, and shows them at the next `present`. */
  recolour(palette: readonly number[]): this {
    this.palette = palette;
    this.shownLevel = -1;
    return this;
  }

  /** Puts the page on the panel, if anything on it changed. Says whether it did. */
  present(): boolean {
    const { dots, shown, image, palette } = this;
    if (!image) return false;
    if (this.level === this.shownLevel && this.reverse === this.shownReverse && same(dots, shown)) return false;
    shown.set(dots);
    this.shownLevel = this.level;
    this.shownReverse = this.reverse;
    // Each dot's colour as one word, so a page is a lookup and a write a dot, whatever its palette.
    const v = Math.round(this.level * 255), ground = this.reverse ? v : 0, ink = this.reverse ? 0 : v, lut = new Uint32Array(256);
    for (let c = 0; c < 256; c++) {
      const rgb = palette?.[c], on = c ? ink : ground;
      lut[c] = word(rgb === undefined ? on : rgb >> 16, rgb === undefined ? on : rgb >> 8 & 255, rgb === undefined ? on : rgb & 255);
    }
    const out = new Uint32Array(image.data.buffer, image.data.byteOffset, dots.length);
    for (let i = 0; i < dots.length; i++) out[i] = lut[dots[i]!]!;
    this.ctx!.putImageData(image, 0, 0);
    present(this.screen as Element);
    return true;
  }
}
