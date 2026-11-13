// Everything a device prints, measured where the page put it and drawn into one mask.
import type { Device } from './engine.js';
import { partsSelector } from './registry.js';
import type { Box, Part } from './types.js';

/** How far a part is turned with what it's on, by `twist` degrees on a surface or device holding it, and the middle it turns about, css px. */
export function twistOf(d: Device, p: Part): { at: [number, number]; rotate: number } | null {
  const el = p.el.closest<HTMLElement>('d-surface[twist], d-device[twist]'), rotate = el && d.el.contains(el) ? (+el.getAttribute('twist')! * Math.PI) / 180 : 0;
  if (!rotate) return null;
  const q = el === d.el ? null : d.parts.get(el!);
  return { at: q ? [q.x + q.w / 2, q.y + q.h / 2] : [d.x + d.w / 2, d.y + d.h / 2], rotate };
}

/** A surface's text is its own, not that of the surfaces nested inside it: what's under another part is that part's. `parts` says
 * what's a part, which a device that knows its own parts answers without asking the browser. */
export function ownText(p: Part, parts: (el: Element) => boolean = el => el.matches(partsSelector())): Text[] {
  const walk = document.createTreeWalker(p.el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeType === Node.TEXT_NODE ? ((n as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) : parts(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP),
  });
  const found: Text[] = [];
  while (walk.nextNode()) found.push(walk.currentNode as Text);
  return found;
}

// A line measured off the real thing runs as wide as its part, whatever font the page falls back to: `fit` spaces
// its letters to fill the width, on the page as well as in the drawing, since the drawing follows where the page put them.
function fit(el: HTMLElement, nodes: Text[], ctx: OffscreenCanvasRenderingContext2D): void {
  const cs = getComputedStyle(el), raw = nodes.map(n => n.data).join('').replace(/\s+/g, ' ').trim();
  const text = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.letterSpacing = '0px';
  ctx.wordSpacing = cs.wordSpacing;
  const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // Into the gaps between letters. The browser adds one after the last letter too, which hangs past the end of a line
  // set from the left, so a fitted line is set from the left and its ink spans the part.
  const natural = ctx.measureText(text).width;
  ctx.wordSpacing = '0px';
  const spacing = (room - natural) / Math.max([...text].length - 1, 1);
  // Only when it changes: the page watches its parts, and a write each paint would lay it out for ever.
  if (Math.abs(parseFloat(el.style.letterSpacing || 'NaN') - spacing) > 0.01 || !el.style.letterSpacing) el.style.letterSpacing = `${spacing.toFixed(2)}px`;
  if (el.style.textAlign !== 'left') el.style.textAlign = 'left';
}

/** How a label is set, as the page laid it out: its font, and each word with its box in the window. Kept while nothing could have moved
 * it, so a device laid out again only for a bigger margin draws its labels without asking the browser where each word is. */
export interface Lettered {
  font: string;
  letterSpacing: string;
  wordSpacing: string;
  asc: number;
  desc: number;
  words: { text: string; left: number; top: number; width: number; height: number }[];
}

/** How the page set a part's label, read off it now: null when it has no text. Spaces a fitted line first, as the page shows it. */
export function lettered(p: Part, textOf: (p: Part) => Text[], ctx: OffscreenCanvasRenderingContext2D, range = document.createRange()): Lettered | null {
  const nodes = textOf(p);
  if (!nodes.length) return null;
  if (p.el.hasAttribute('fit')) fit(p.el, nodes, ctx);
  const cs = getComputedStyle(p.el);
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
  const m = ctx.measureText('Hg'), upper = cs.textTransform === 'uppercase';
  const set: Lettered = { font, letterSpacing, wordSpacing: cs.wordSpacing === 'normal' ? '0px' : cs.wordSpacing, asc: m.fontBoundingBoxAscent, desc: m.fontBoundingBoxDescent, words: [] };
  // Word by word, from where the browser put them, so wrapping and alignment come for free.
  for (const node of nodes) {
    for (const word of node.data.matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const r = range.getBoundingClientRect();
      if (r.width) set.words.push({ text: upper ? word[0].toUpperCase() : word[0], left: r.left, top: r.top, width: r.width, height: r.height });
    }
  }
  return set;
}

/** Whether two settings of a label put the same ink in the same place, each from where its device was then (`a` from `ao`, `b` from `bo`).
 * Where is to a 64th of a page px, as a layout compares boxes: a device moved, as a translate does, reads each word and itself a hair
 * apart in the last bits, and a word in the same place on it would be set again. */
export function sameLettering(a: Lettered | undefined, ao: [number, number], b: Lettered | undefined, bo: [number, number]): boolean {
  if (!a || !b) return a === b;
  if (a.font !== b.font || a.letterSpacing !== b.letterSpacing || a.wordSpacing !== b.wordSpacing || a.asc !== b.asc || a.desc !== b.desc || a.words.length !== b.words.length) return false;
  const same = (x: number, y: number) => Math.round(x * 64) === Math.round(y * 64);
  return a.words.every((w, i) => {
    const v = b.words[i]!;
    return w.text === v.text && w.width === v.width && w.height === v.height && same(w.left - ao[0], v.left - bo[0]) && same(w.top - ao[1], v.top - bo[1]);
  });
}

// Labels go into a mask with Canvas 2D, so any font the page can use works. `kept` holds how each label was set last time, for as long
// as the caller knows nothing has moved: what's there is drawn as it was, and what isn't is read and kept.
export function paintMask(d: Device, c: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D, ox: number, oy: number, z: number, blame: (el: Element) => void, textOf: (p: Part) => Text[] = p => ownText(p), kept?: Map<Element, Lettered>): void {
  // One canvas for every device's mask, which only grows, each drawn in its corner: a canvas given a new size is a new image on the GPU.
  if (c.width < d.pw) c.width = d.pw;
  if (c.height < d.ph) c.height = d.ph;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, d.pw, d.ph);
  ctx.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  const range = document.createRange();
  for (const p of d.list) {
    blame(p.el);
    p.label = null;
    p.mask = null;
    // What's printed on a turned part turns with it, about the same middle the drawing does.
    const twist = twistOf(d, p);
    const turned = () => {
      ctx.save();
      if (!twist) return;
      ctx.translate(...twist.at);
      ctx.rotate(twist.rotate);
      ctx.translate(-twist.at[0], -twist.at[1]);
    };
    if (p.def.mask) {
      turned();
      p.mask = p.def.mask(ctx, p) ?? null;
      ctx.restore();
    }
    if (!p.def.label) continue;
    turned();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    let set = kept?.get(p.el);
    if (!set) {
      set = lettered(p, textOf, ctx, range) ?? undefined;
      if (!set) {
        ctx.restore();
        continue;
      }
      kept?.set(p.el, set);
    }
    ctx.font = set.font;
    ctx.letterSpacing = set.letterSpacing;
    const { font, letterSpacing, wordSpacing, asc, desc } = set;
    const lines = new Map<number, Box & { text: string }>();
    for (const word of set.words) {
      const w = word.width / z, h = word.height / z;
      if (!w) continue;
      const { text } = word, x = (word.left - ox) / z, y = (word.top - oy) / z;
      ctx.fillText(text, x, y + (h - asc - desc) / 2 + asc);
      const line = lines.get(Math.round(y));
      if (line) {
        line.text += ` ${text}`;
        line.w = x + w - line.x;
      } else lines.set(Math.round(y), { x, y, w, h, text });
    }
    ctx.restore();
    const all = [...lines.values()];
    if (!all.length) continue;
    const x = Math.min(...all.map(l => l.x)), y = all[0]!.y;
    const right = Math.max(...all.map(l => l.x + l.w)), bottom = all[all.length - 1]!.y + all[all.length - 1]!.h;
    p.label = {
      x: x - 2, y: y - 2, w: right - x + 4, h: bottom - y + 4, text: all.map(l => l.text).join(' '), font, letterSpacing, wordSpacing,
      lines: all.map(l => ({ ...l, x: l.x - 2, y: l.y - 2, w: l.w + 4, h: l.h + 4 })),
    };
  }
}
