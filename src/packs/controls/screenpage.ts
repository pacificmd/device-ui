// Real elements on a screen. They stay where the browser laid them out, live and unseen, and this draws what it finds there on the
// panel's canvas, so the shader treats a page as it does any picture: an lcd's pixels and their shadows, a tube's scanlines, e-ink's greys.
// It draws what a page of text and rules is made of, in document order: backgrounds, borders, text, images, fields, selection and focus. Generated content, list
// markers and shadows aren't, and nothing eases between two looks, because a panel gets a new picture and it's the panel that lags, so `transition` means nothing here.
import { farOff, MM, type ScreenKind } from 'device-ui';

/** On these a page is dark on light, as on paper. On the rest it's light on dark, because they give the light. */
const PAPER: readonly ScreenKind[] = ['lcd', 'eink', 'coat'];
const FIELD = /^(text|search|email|url|tel|number)$/;
const BLINK = 530;
const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;

type Field = HTMLInputElement | HTMLTextAreaElement;
const isField = (el: Element): el is Field => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && FIELD.test(el.type));

/** Takes a run of words as it fell on its line, from the text's own layout: what's on the line, and where it starts. */
function lines(node: Text, preserved: boolean, at: (start: number, end: number) => DOMRect | undefined): { text: string; left: number; top: number }[] {
  const out: { text: string; left: number; top: number }[] = [];
  let line: { start: number; end: number; left: number; top: number } | null = null;
  const flush = () => {
    if (!line) return;
    const s = node.data.slice(line.start, line.end);
    out.push({ text: preserved ? s : s.replace(/\s+/g, ' '), left: line.left, top: line.top });
  };
  for (const word of node.data.matchAll(/\S+/g)) {
    const r = at(word.index, word.index + word[0].length);
    if (!r) continue;
    if (line && Math.abs(r.top - line.top) < 1) {
      line.end = word.index + word[0].length;
      continue;
    }
    flush();
    line = { start: word.index, end: word.index + word[0].length, left: r.left, top: r.top };
  }
  flush();
  return out;
}

const shaped = (text: string, how: string) => (how === 'uppercase' ? text.toUpperCase() : how === 'lowercase' ? text.toLowerCase() : text);

/** Draws `page`, which fills the panel, onto `canvas`. */
export function paintPage(page: HTMLElement, canvas: HTMLCanvasElement, kind: ScreenKind): void {
  const ctx = canvas.getContext('2d')!;
  const box = page.getBoundingClientRect();
  // A device may be zoomed. What the browser reports is on the glass of the display, and a font's size isn't.
  const zoom = box.width / page.offsetWidth || 1, sx = canvas.width / page.offsetWidth, sy = canvas.height / page.offsetHeight;
  const x = (client: number) => (client - box.left) / zoom, y = (client: number) => (client - box.top) / zoom;
  const range = document.createRange();
  const onRange = (node: Text, start: number, end: number) => {
    range.setStart(node, start);
    range.setEnd(node, end);
    return range.getClientRects();
  };
  let dx = 0, dy = 0;

  const flip = (rects: Iterable<DOMRect>) => {
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#fff';
    for (const r of rects) ctx.fillRect(x(r.left) + dx, y(r.top) + dy, r.width / zoom, r.height / zoom);
    ctx.globalCompositeOperation = 'source-over';
  };

  const words = (node: Text, cs: CSSStyleDeclaration, color: string) => {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    const ascent = ctx.measureText('x').fontBoundingBoxAscent;
    for (const l of lines(node, cs.whiteSpace.startsWith('pre'), (a, b) => onRange(node, a, b)[0])) {
      ctx.fillText(shaped(l.text, cs.textTransform), x(l.left) + dx, y(l.top) + dy + ascent);
    }
  };

  // A field keeps its text to itself, so the same text in the same box says how it fell. This sits beside the page, which stays the author's.
  const mirrorOf = () => {
    const holder = page.parentElement!, found = holder.querySelector<HTMLElement>(':scope > [data-mirror]');
    if (found) return found;
    const made = document.createElement('div');
    made.dataset.mirror = '';
    made.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;';
    return holder.appendChild(made);
  };

  const field = (el: Field, cs: CSSStyleDeclaration) => {
    const area = el instanceof HTMLTextAreaElement, r = el.getBoundingClientRect(), mirror = mirrorOf();
    const pad = (side: 'Left' | 'Right') => parseFloat(cs[`padding${side}`]);
    Object.assign(mirror.style, {
      width: `${el.clientWidth - pad('Left') - pad('Right')}px`, font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
      letterSpacing: cs.letterSpacing, whiteSpace: area ? 'pre-wrap' : 'pre', overflowWrap: 'break-word',
    });
    const shown = el.value || el.placeholder;
    mirror.textContent = `${shown}​`;
    const node = mirror.firstChild as Text, m = mirror.getBoundingClientRect();
    dx = (r.left - m.left) / zoom + el.clientLeft + pad('Left') - el.scrollLeft;
    dy = (r.top - m.top) / zoom + el.clientTop + parseFloat(cs.paddingTop) - el.scrollTop;
    const mirrored = getComputedStyle(mirror);
    words(node, mirrored, el.value ? cs.color : getComputedStyle(el, '::placeholder').color);
    if (document.activeElement === el && el.selectionStart !== null) {
      const from = el.selectionStart, to = el.selectionEnd ?? from;
      if (from !== to) flip(onRange(node, from, to));
      else if (Math.floor(performance.now() / BLINK) % 2 === 0) {
        const c = onRange(node, from, Math.min(from + 1, shown.length + 1))[0];
        if (c) {
          ctx.fillStyle = cs.color;
          ctx.fillRect(x(c.left) + dx, y(c.top) + dy, 1.5, c.height / zoom);
        }
      }
    }
    dx = dy = 0;
    mirror.textContent = '';
  };

  const outOfSight = (r: DOMRect) => r.bottom < box.top || r.top > box.bottom || r.right < box.left || r.left > box.right;

  const walk = (el: Element, alpha: number) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (outOfSight(r) && cs.display !== 'contents') return;
    const a = alpha * (el === page ? 1 : +cs.opacity);
    ctx.globalAlpha = a;
    const left = x(r.left), top = y(r.top), w = r.width / zoom, h = r.height / zoom, round = parseFloat(cs.borderTopLeftRadius) || 0;
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
      ctx.fillStyle = cs.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(left, top, w, h, round);
      ctx.fill();
    }
    SIDES.forEach((side, i) => {
      const width = parseFloat(cs[`border${side}Width`]);
      if (!width || cs[`border${side}Style`] === 'none') return;
      ctx.fillStyle = cs[`border${side}Color`];
      ctx.fillRect(i === 1 ? left + w - width : left, i === 2 ? top + h - width : top, i % 2 ? width : w, i % 2 ? h : width);
    });
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) ctx.drawImage(el, left, top, w, h);
    const clipped = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    if (clipped) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(left + (el as HTMLElement).clientLeft, top + (el as HTMLElement).clientTop, (el as HTMLElement).clientWidth, (el as HTMLElement).clientHeight);
      ctx.clip();
    }
    if (isField(el)) field(el, cs);
    else {
      for (const child of el.childNodes) {
        if (child instanceof Text) words(child, cs, cs.color);
        else if (child instanceof Element) walk(child, a);
        ctx.globalAlpha = a;
      }
    }
    if (clipped) ctx.restore();
    if (el.matches(':focus-visible') && cs.outlineStyle !== 'none') {
      const width = parseFloat(cs.outlineWidth), off = parseFloat(cs.outlineOffset) || 0;
      ctx.strokeStyle = cs.outlineColor;
      ctx.lineWidth = width;
      ctx.strokeRect(left - off - width / 2, top - off - width / 2, w + (off + width / 2) * 2, h + (off + width / 2) * 2);
    }
  };

  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER.includes(kind) ? '#fff' : '#000';
  ctx.fillRect(0, 0, page.offsetWidth, page.offsetHeight);
  walk(page, 1);
  ctx.globalAlpha = 1;
  const chosen = getSelection();
  if (chosen?.rangeCount && !chosen.isCollapsed && page.contains(chosen.anchorNode) && !isField(document.activeElement as Element)) flip(chosen.getRangeAt(0).getClientRects());
  // A crystal shows bright on the canvas when it's dark on the panel, so an lcd's picture is the page's negative.
  if (kind === 'lcd') flip([box]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** What can change a page without changing its markup. A panel has no idea where a hand is, so `:hover` and `:active` aren't among them. */
const CHANGES = ['input', 'scroll', 'focusin', 'focusout', 'keyup'];

/** Keeps a canvas drawn from `page` from now on, and calls `shown` after each new picture. Returns what stops it. With a `pitch`, in mm, the canvas has as many pixels as fit the panel at that spacing, however big the panel gets. */
export function watchPage(page: HTMLElement, canvas: HTMLCanvasElement, kind: ScreenKind, shown: () => void, pitch = 0): () => void {
  let due = 0, wide = 0, high = 0;
  const draw = () => {
    due = 0;
    // Hidden far off in a camera's world, it would come out blank: it's drawn on the way back.
    if (away.far()) return;
    wide = page.offsetWidth;
    high = page.offsetHeight;
    if (pitch) {
      const width = Math.round(wide / MM / pitch), height = Math.round(high / MM / pitch);
      if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height });
    }
    paintPage(page, canvas, kind);
    shown();
  };
  const queue = () => {
    due ||= requestAnimationFrame(draw);
  };
  const away = farOff(page, queue);
  const changes = new MutationObserver(queue);
  changes.observe(page, { subtree: true, childList: true, characterData: true, attributes: true });
  // The device says first, as it's about to draw and this should be on it. What comes here is only what it didn't draw.
  const off = new AbortController(), resized = new ResizeObserver(() => {
    if (page.offsetWidth !== wide || page.offsetHeight !== high) queue();
  });
  for (const name of CHANGES) page.addEventListener(name, queue, { capture: true, signal: off.signal });
  document.addEventListener('selectionchange', queue, { signal: off.signal });
  const device = page.closest('d-device');
  device?.addEventListener('fitted', queue, { signal: off.signal });
  device?.addEventListener('resized', () => {
    cancelAnimationFrame(due);
    draw();
  }, { signal: off.signal });
  resized.observe(page);
  void document.fonts?.ready.then(queue);
  const caret = setInterval(() => {
    if (page.contains(document.activeElement) && isField(document.activeElement as Element)) queue();
  }, BLINK);
  queue();
  return () => {
    cancelAnimationFrame(due);
    off.abort();
    changes.disconnect();
    resized.disconnect();
    away.stop();
    clearInterval(caret);
  };
}
