// Software on glass. A d-screen shows a canvas, and an app wants HTML: text that wraps, lists that
// scroll, focus, forms, a screen reader. So the HTML goes on the screen for real, in a shadow root the
// engine doesn't watch, and it stays invisible but live. What it looks like is read back off the
// browser's layout and drawn on the screen's canvas, so light and glass fall on it like any picture.
//
// Painted: backgrounds and linear gradients, borders, radii, one box shadow, outlines, opacity, clips,
// scrolling with a thumb, text with one text shadow and ellipsis, text inputs with a caret, canvas,
// img, video, and svg made of paths. Not painted: pseudo-elements, filters, inset shadows, scaled
// text, selections, and checkboxes, radios and ranges, which are drawn by hand from divs. With
// `configure({ strict: true })` each of these says so, once.
import { farOff, getEngine, warnOnce, written } from 'device-ui';
import { present, screenFrame } from 'device-ui/controls/displays';

export interface PageOptions {
  html?: string;
  css?: string;
  /** Canvas pixels per css px of the screen. Under 1 for a tube with a few hundred lines. */
  density?: number;
}

export interface ScreenPage {
  /** Where the app lives: query this and listen on it as you would a document. */
  root: ShadowRoot;
  /** The element the html went into. It fills the screen. */
  page: HTMLElement;
  /** Draws again. Changes to the page do this themselves, so this is for what a canvas in it just drew. */
  refresh(): void;
  stop(): void;
}

// All at no weight, so anything an app writes beats it. What a device's own type sets is inherited, so it stops here.
const BASE = `
:where(.d-page) { position: absolute; overflow: hidden; pointer-events: auto; box-sizing: border-box; color: #fff; font: 400 16px/1.25 system-ui, sans-serif; letter-spacing: normal; text-transform: none; text-align: left; user-select: none; -webkit-user-select: none; }
:where(.d-page *) { box-sizing: border-box; }
:where(.d-page button) { all: unset; box-sizing: border-box; display: block; cursor: pointer; }
:where(.d-page input) { all: unset; box-sizing: border-box; display: block; cursor: text; }
:where(.d-page :focus) { outline: none; }
:where(.d-page :focus-visible) { outline: 2px solid currentColor; outline-offset: -2px; }
`;

type Ctx = CanvasRenderingContext2D;
interface Frame {
  c: Ctx;
  left: number;
  top: number;
  /** Canvas pixels to a pixel of the window, which a zoom on the device makes different from `type`. */
  k: number;
  /** Canvas pixels to a css px of the page, for what computed style says. */
  type: number;
  root: ShadowRoot;
  page: Element;
}

const num = (s: string) => parseFloat(s) || 0;
const clear = (c: string) => !c || c === 'transparent' || /rgba\(.*, 0\)$/.test(c);

function outline(f: Frame, x: number, y: number, w: number, h: number, r: number): void {
  f.c.beginPath();
  f.c.roundRect(x, y, Math.max(w, 0), Math.max(h, 0), Math.max(r, 0));
}

// Only straight gradients: `linear-gradient(<angle>?, <colour> <stop>?, ...)` as computed style writes them.
function gradient(f: Frame, css: string, x: number, y: number, w: number, h: number): CanvasGradient | null {
  const m = /^linear-gradient\((.*)\)$/.exec(css);
  if (!m) return null;
  const parts = m[1]!.split(/,(?![^(]*\))/).map(s => s.trim());
  const dir = /^(-?[\d.]+)deg$/.exec(parts[0]!);
  const a = ((dir ? +dir[1]! : parts[0] === 'to right' ? 90 : parts[0] === 'to left' ? 270 : parts[0] === 'to top' ? 0 : 180) * Math.PI) / 180;
  if (dir || parts[0]!.startsWith('to ')) parts.shift();
  const sin = Math.sin(a), cos = Math.cos(a), half = (Math.abs(w * sin) + Math.abs(h * cos)) / 2, cx = x + w / 2, cy = y + h / 2;
  const g = f.c.createLinearGradient(cx - sin * half, cy + cos * half, cx + sin * half, cy - cos * half);
  parts.forEach((p, i) => {
    const at = /\s(-?[\d.]+)%$/.exec(p);
    g.addColorStop(Math.max(0, Math.min(1, at ? +at[1]! / 100 : i / (parts.length - 1))), at ? p.slice(0, at.index) : p);
  });
  return g;
}

function box(f: Frame, cs: CSSStyleDeclaration, x: number, y: number, w: number, h: number): void {
  const { c, type } = f, r = num(cs.borderTopLeftRadius) * type;
  if (cs.boxShadow !== 'none' && !cs.boxShadow.includes('inset')) {
    const colour = /^(rgba?\([^)]*\)|#\w+)/.exec(cs.boxShadow)?.[0], [ox = 0, oy = 0, blur = 0] = cs.boxShadow.replace(/^rgba?\([^)]*\)\s*/, '').split(/\s+/).map(num);
    if (colour) {
      c.save();
      c.shadowColor = colour;
      c.shadowBlur = blur * type;
      c.shadowOffsetX = ox * type;
      c.shadowOffsetY = oy * type;
      c.fillStyle = '#000';
      outline(f, x, y, w, h, r);
      c.fill();
      c.restore();
    }
  }
  if (!clear(cs.backgroundColor)) {
    c.fillStyle = cs.backgroundColor;
    outline(f, x, y, w, h, r);
    c.fill();
  }
  if (cs.backgroundImage !== 'none') {
    const g = gradient(f, cs.backgroundImage, x, y, w, h);
    if (g) {
      c.fillStyle = g;
      outline(f, x, y, w, h, r);
      c.fill();
    }
  }
  const t = num(cs.borderTopWidth) * type, b = num(cs.borderBottomWidth) * type, l = num(cs.borderLeftWidth) * type, n = num(cs.borderRightWidth) * type;
  if (t && t === b && t === l && t === n && cs.borderTopColor === cs.borderLeftColor) {
    c.strokeStyle = cs.borderTopColor;
    c.lineWidth = t;
    outline(f, x + t / 2, y + t / 2, w - t, h - t, r - t / 2);
    c.stroke();
  } else if (t || b || l || n) {
    const edge = (size: number, colour: string, ex: number, ey: number, ew: number, eh: number) => {
      if (!size) return;
      c.fillStyle = colour;
      c.fillRect(ex, ey, ew, eh);
    };
    edge(t, cs.borderTopColor, x, y, w, t);
    edge(b, cs.borderBottomColor, x, y + h - b, w, b);
    edge(l, cs.borderLeftColor, x, y, l, h);
    edge(n, cs.borderRightColor, x + w - n, y, n, h);
  }
  if (cs.outlineStyle !== 'none' && num(cs.outlineWidth)) {
    const o = num(cs.outlineOffset) * type, width = num(cs.outlineWidth) * type;
    c.strokeStyle = cs.outlineColor;
    c.lineWidth = width;
    outline(f, x - o - width / 2, y - o - width / 2, w + (o + width / 2) * 2, h + (o + width / 2) * 2, r + o);
    c.stroke();
  }
}

const fontOf = (cs: CSSStyleDeclaration, type: number) => `${cs.fontStyle} ${cs.fontWeight} ${num(cs.fontSize) * type}px ${cs.fontFamily}`;

function typeface(f: Frame, cs: CSSStyleDeclaration): void {
  const { c, type } = f, spacing = num(cs.letterSpacing);
  c.font = fontOf(cs, type);
  c.letterSpacing = `${spacing * type}px`;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.fillStyle = cs.color;
  if (cs.textShadow === 'none') {
    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
    return;
  }
  const colour = /^(rgba?\([^)]*\)|#\w+)/.exec(cs.textShadow)?.[0] ?? cs.color;
  c.shadowColor = colour;
  c.shadowBlur = num(cs.textShadow.replace(/^rgba?\([^)]*\)\s*/, '').split(/\s+/)[2] ?? '0') * type;
}

const cased = (s: string, cs: CSSStyleDeclaration) =>
  cs.textTransform === 'uppercase' ? s.toUpperCase() : cs.textTransform === 'lowercase' ? s.toLowerCase() : s;

function fitted(c: Ctx, s: string, room: number): string {
  if (c.measureText(s).width <= room) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.measureText(`${s.slice(0, mid).trimEnd()}…`).width <= room) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo).trimEnd()}…`;
}

const RANGE = typeof document === 'undefined' ? null : document.createRange();

// The browser has already wrapped it, so this only asks where each line ended up.
function lines(node: Text): { s: string; rect: DOMRect }[] {
  const range = RANGE!;
  range.selectNodeContents(node);
  const rects = range.getClientRects();
  const pre = (node.parentElement && getComputedStyle(node.parentElement).whiteSpace.startsWith('pre')) ?? false;
  const clean = (s: string) => (pre ? s : s.replace(/\s+/g, ' ').trim());
  if (rects.length <= 1) return rects[0] ? [{ s: clean(node.data), rect: rects[0] }] : [];
  const out: { s: string; rect: DOMRect }[] = [];
  let from = 0, first: DOMRect | null = null;
  for (const m of node.data.matchAll(/\S+\s*/g)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].trimEnd().length);
    const r = range.getClientRects()[0];
    if (!r) continue;
    if (first && Math.abs(r.top - first.top) > first.height / 2) {
      out.push({ s: clean(node.data.slice(from, m.index)), rect: first });
      from = m.index;
      first = r;
    }
    first ??= r;
  }
  if (first) out.push({ s: clean(node.data.slice(from)), rect: first });
  return out;
}

function words(f: Frame, node: Text, cs: CSSStyleDeclaration): void {
  if (!node.data.trim()) return;
  typeface(f, cs);
  const { c, k } = f, parent = node.parentElement!;
  const ascent = c.measureText('Mg').fontBoundingBoxAscent;
  for (const { s, rect } of lines(node)) {
    const x = (rect.left - f.left) * k, y = (rect.top - f.top) * k + ascent;
    let shown = cased(s, cs);
    // Ask the browser whether it overflowed: a canvas measures the same text a hair wider.
    if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible' && parent.scrollWidth > parent.clientWidth) {
      const o = parent.getBoundingClientRect();
      shown = fitted(c, shown, (o.right - num(cs.paddingRight) * (k / f.type) - rect.left) * k);
    }
    c.fillText(shown, x, y);
  }
  c.shadowBlur = 0;
  c.shadowColor = 'transparent';
}

function field(f: Frame, el: HTMLInputElement, cs: CSSStyleDeclaration, x: number, y: number, h: number): void {
  const { c, type } = f, hint = !el.value;
  const text = el.value || el.placeholder;
  typeface(f, cs);
  if (hint) c.fillStyle = getComputedStyle(el, '::placeholder').color;
  const m = c.measureText('Mg'), at = x + (num(cs.paddingLeft) + num(cs.borderLeftWidth)) * type;
  const base = y + (h + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
  c.fillText(cased(text, cs), at, base);
  if (f.root.activeElement !== el) return;
  c.fillStyle = cs.caretColor === 'auto' ? cs.color : cs.caretColor;
  c.fillRect(at + c.measureText(cased(el.value.slice(0, el.selectionEnd ?? el.value.length), cs)).width, base - m.fontBoundingBoxAscent, Math.max(type, 1), m.fontBoundingBoxAscent + m.fontBoundingBoxDescent);
}

function vector(f: Frame, svg: SVGSVGElement, cs: CSSStyleDeclaration, x: number, y: number, w: number, h: number): void {
  const { c } = f, view = svg.viewBox.baseVal, vw = view.width || w, vh = view.height || h;
  c.save();
  c.translate(x, y);
  c.scale(w / vw, h / vh);
  c.translate(-view.x, -view.y);
  for (const el of svg.querySelectorAll('path')) {
    const s = getComputedStyle(el), d = new Path2D(el.getAttribute('d') ?? '');
    if (s.fill !== 'none') {
      c.fillStyle = s.fill === 'currentcolor' ? cs.color : s.fill;
      c.fill(d, el.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (s.stroke !== 'none') {
      c.strokeStyle = s.stroke === 'currentcolor' ? cs.color : s.stroke;
      c.lineWidth = num(s.strokeWidth);
      c.lineCap = s.strokeLinecap as CanvasLineCap;
      c.lineJoin = s.strokeLinejoin as CanvasLineJoin;
      c.stroke(d);
    }
  }
  c.restore();
}

function scrollThumb(f: Frame, el: Element, cs: CSSStyleDeclaration, x: number, y: number, w: number, h: number): void {
  if (el.scrollHeight <= el.clientHeight + 1 || cs.scrollbarWidth === 'none') return;
  const { c, type } = f, tall = Math.max((el.clientHeight / el.scrollHeight) * h, 20 * type);
  const at = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * (h - tall);
  c.save();
  c.globalAlpha *= 0.45;
  c.fillStyle = cs.scrollbarColor.split(' ')[0] === 'auto' || !cs.scrollbarColor ? cs.color : cs.scrollbarColor.split(' ')[0]!;
  outline(f, x + w - 4 * type, y + at + type, 3 * type, tall - 2 * type, 1.5 * type);
  c.fill();
  c.restore();
}

/** Whether a computed value is a list, by a comma outside any brackets. */
function several(css: string): boolean {
  let depth = 0;
  for (const c of css) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && !depth) return true;
  }
  return false;
}

/** What this element asks for that `box` and the rest won't draw. Strict only, as asking after pseudo-elements costs per element. */
function unpainted(el: Element, cs: CSSStyleDeclaration): string[] {
  const out: string[] = [], image = cs.backgroundImage;
  if (image !== 'none') {
    if (several(image)) out.push('more than one background image');
    else if (!image.startsWith('linear-gradient(')) out.push(`background-image ${image.slice(0, image.indexOf('('))}`);
  }
  if (cs.boxShadow.includes('inset')) out.push('an inset box-shadow');
  if (several(cs.boxShadow)) out.push('more than one box-shadow');
  if (several(cs.textShadow)) out.push('more than one text-shadow');
  for (const name of ['filter', 'backdropFilter', 'transform', 'clipPath'] as const) if (cs[name] !== 'none') out.push(name);
  if (cs.mixBlendMode !== 'normal') out.push('mix-blend-mode');
  if (cs.textDecorationLine !== 'none') out.push('text-decoration');
  if (cs.borderTopStyle !== 'solid' && cs.borderTopStyle !== 'none' && num(cs.borderTopWidth)) out.push(`a ${cs.borderTopStyle} border`);
  if (new Set([cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius]).size > 1) out.push('a different radius on each corner');
  for (const pseudo of ['::before', '::after']) {
    const { content } = getComputedStyle(el, pseudo);
    if (content !== 'none' && content !== 'normal') out.push(pseudo);
  }
  if (el instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'file', 'color'].includes(el.type)) out.push(`input type=${el.type}`);
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLProgressElement || el instanceof HTMLMeterElement) out.push(`<${el.localName}>`);
  if (el instanceof SVGSVGElement && el.querySelector(':not(path, g, title, desc, defs)')) out.push('svg made of anything but paths');
  return out;
}

function walk(f: Frame, el: Element, alpha: number): void {
  const cs = getComputedStyle(el);
  if (cs.display === 'none') return;
  if (getEngine().strict) for (const what of unpainted(el, cs)) warnOnce(`screenPage doesn't paint ${what}: ${written(el)}`);
  // The page itself is opacity 0 to the browser, and opaque here.
  const a = alpha * (el === f.page ? 1 : +cs.opacity), shown = cs.visibility !== 'hidden' && a > 0;
  const r = el.getBoundingClientRect(), x = (r.left - f.left) * f.k, y = (r.top - f.top) * f.k, w = r.width * f.k, h = r.height * f.k;
  const { c } = f;
  c.globalAlpha = a;
  if (shown) box(f, cs, x, y, w, h);
  if (shown && (el instanceof HTMLCanvasElement ? el.width : el instanceof HTMLVideoElement ? el.readyState >= 2 : el instanceof HTMLImageElement && el.complete && el.naturalWidth)) {
    c.save();
    if (num(cs.borderTopLeftRadius)) {
      outline(f, x, y, w, h, num(cs.borderTopLeftRadius) * f.type);
      c.clip();
    }
    c.drawImage(el as CanvasImageSource, x, y, w, h);
    c.restore();
    return;
  }
  if (el instanceof SVGSVGElement) {
    if (shown) vector(f, el, cs, x, y, w, h);
    return;
  }
  if (el instanceof HTMLInputElement) {
    if (shown && !['checkbox', 'radio', 'range', 'file', 'hidden'].includes(el.type)) field(f, el, cs, x, y, h);
    return;
  }
  const clipped = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  if (clipped) {
    c.save();
    outline(f, x, y, w, h, num(cs.borderTopLeftRadius) * f.type);
    c.clip();
  }
  const kids = [...el.childNodes];
  // Stacking is only this much: what asks to be on top of its siblings goes last.
  const raised = kids.filter(n => n instanceof Element && +getComputedStyle(n).zIndex > 0)
    .sort((p, q) => +getComputedStyle(p as Element).zIndex - +getComputedStyle(q as Element).zIndex);
  for (const n of kids) {
    if (raised.includes(n)) continue;
    if (n instanceof Element) walk(f, n, a);
    else if (n instanceof Text && shown) {
      c.globalAlpha = a;
      words(f, n, cs);
    }
  }
  for (const n of raised) walk(f, n as Element, a);
  if (clipped) c.restore();
  if (shown && (cs.overflowY === 'auto' || cs.overflowY === 'scroll')) {
    c.globalAlpha = a;
    scrollThumb(f, el, cs, x, y, w, h);
  }
}

/**
 * Puts a page of real HTML on a d-screen. It behaves as HTML: the app is written against `root`, and
 * layout, wrapping, scrolling, focus, typing and a11y are the browser's own.
 */
export function screenPage(screen: HTMLElement, o: PageOptions = {}): ScreenPage {
  const root = screen.shadowRoot ?? screen.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = BASE + (o.css ?? '');
  const page = document.createElement('div');
  page.className = 'd-page';
  page.innerHTML = o.html ?? '';
  root.replaceChildren(style, page);

  const canvas = screen.querySelector('canvas') ?? screen.appendChild(document.createElement('canvas'));
  const c = canvas.getContext('2d', { alpha: false })!;
  // The frame eats into the part, and the page has to sit on the picture.
  page.style.inset = `${screenFrame(screen)}px`;
  const density = o.density ?? 2;

  let queued = 0, gone = false, wide = 0, high = 0;
  const paint = () => {
    queued = 0;
    if (gone) return;
    // Left visible with no renderer, or in forced colours, where the HTML is the interface.
    const gl = document.documentElement.classList.contains('d-gl'), hide = gl ? '0' : '1';
    if (page.style.opacity !== hide) page.style.opacity = hide;
    // Hidden far off in a camera's world, it would come out blank: it's drawn on the way back.
    if (!gl || away.far()) return;
    wide = page.offsetWidth;
    high = page.offsetHeight;
    if (!wide || !high) return;
    const pw = Math.round(wide * density), ph = Math.round(high * density);
    if (canvas.width !== pw || canvas.height !== ph) Object.assign(canvas, { width: pw, height: ph });
    const r = page.getBoundingClientRect();
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, pw, ph);
    walk({ c, left: r.left, top: r.top, k: pw / r.width, type: pw / wide, root, page }, page, 1);
    present(screen);
    // A transition or animation in the page changes what's computed with nothing to say so.
    if (root.getAnimations().some(a => a.playState === 'running')) refresh();
  };
  const refresh = () => {
    queued ||= requestAnimationFrame(paint);
  };

  const ac = new AbortController(), { signal } = ac, away = farOff(screen, refresh);
  const watch = new MutationObserver(refresh);
  watch.observe(page, { subtree: true, childList: true, characterData: true, attributes: true });
  // The device says first, as it's about to draw and this should be on it. What comes here is only what it didn't draw.
  const size = new ResizeObserver(() => {
    if (page.offsetWidth !== wide || page.offsetHeight !== high) refresh();
  });
  size.observe(page);
  screen.closest('d-device')?.addEventListener('resized', () => {
    cancelAnimationFrame(queued);
    paint();
  }, { signal });
  for (const type of ['scroll', 'input', 'change', 'focusin', 'focusout', 'mouseover', 'mouseout', 'mousedown', 'mouseup', 'keyup', 'select']) {
    root.addEventListener(type, refresh, { capture: true, signal });
  }
  // Left to reach the device, each of these asks for the whole thing to be painted again, and nothing outside the glass changed.
  for (const type of ['focusin', 'focusout', 'input', 'change']) root.addEventListener(type, e => e.stopPropagation(), { signal });
  void document.fonts.ready.then(refresh);
  refresh();

  return {
    root, page, refresh,
    stop() {
      gone = true;
      ac.abort();
      watch.disconnect();
      size.disconnect();
      away.stop();
      cancelAnimationFrame(queued);
    },
  };
}
