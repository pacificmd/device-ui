// A piece that runs along a body on rails, as a phone's keypad cover or a slider's top half. The piece is a device of its own, drawn flat once,
// and only its `translate` moves it, which nothing lays out again for. Drag it or click it, and it runs to the end it's nearer, or the other end.
import { capture, reduced } from './drag.js';

export interface GlideOptions {
  /** Which way it runs. */
  axis?: 'x' | 'y';
  /** How far, css px, down or right from where its style puts it. Negative runs the other way. */
  travel: number;
  /** Ms from one end to the other. */
  ms?: number;
  /** Told when it comes to rest, and at which end. */
  rested?(out: boolean): void;
  /** A click on the piece runs it to the other end. Otherwise only a drag does. */
  click?: boolean;
}

export interface Glide {
  readonly out: boolean;
  open(): void;
  shut(): void;
  toggle(): void;
  stop(): void;
}

// How far a pointer goes before a press is a drag, css px.
const SLOP = 4;

/** Runs `piece`, a `d-device` inside its body, between where its style puts it and `travel` from there. */
export function glide(piece: HTMLElement, o: GlideOptions): Glide {
  const axis = o.axis ?? 'y', ms = o.ms ?? 220, travel = o.travel;
  let at = 0, out = false, raf = 0;
  const put = (t: number) => {
    at = t;
    const go = t * travel;
    piece.style.translate = axis === 'y' ? `0 ${go}px` : `${go}px 0`;
  };
  const rest = (to: boolean) => {
    put(to ? 1 : 0);
    out = to;
    o.rested?.(to);
  };
  const run = (to: boolean) => {
    cancelAnimationFrame(raf);
    if (reduced()) return rest(to);
    const from = at, end = to ? 1 : 0, span = Math.abs(end - from) * ms;
    if (!span) return rest(to);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / span);
      // Pushed, it picks up and then meets its stop.
      put(from + (end - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
      else rest(to);
    };
    raf = requestAnimationFrame(step);
  };

  const stopCatching = catches(piece);
  const ac = new AbortController(), { signal } = ac;
  let down: { x: number; y: number; at: number; id: number } | null = null, dragged = false;
  piece.style.touchAction = 'none';
  piece.addEventListener('pointerdown', e => {
    if (e.button) return;
    cancelAnimationFrame(raf);
    down = { x: e.clientX, y: e.clientY, at, id: e.pointerId };
    dragged = false;
  }, { signal });
  piece.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) return;
    const d = axis === 'y' ? e.clientY - down.y : e.clientX - down.x;
    if (!dragged && Math.abs(d) < SLOP) return;
    if (!dragged) capture(piece, e);
    dragged = true;
    put(Math.max(0, Math.min(1, down.at + d / travel)));
  }, { signal });
  const up = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    down = null;
    if (dragged) run(at > 0.5);
  };
  piece.addEventListener('pointerup', up, { signal });
  piece.addEventListener('pointercancel', up, { signal });
  piece.addEventListener('click', e => {
    if (dragged) {
      dragged = false;
      e.stopImmediatePropagation();
      return;
    }
    if (o.click) run(!out);
  }, { signal });

  return {
    get out() {
      return out;
    },
    open: () => run(true),
    shut: () => run(false),
    toggle: () => run(!out),
    stop() {
      cancelAnimationFrame(raf);
      ac.abort();
      stopCatching();
    },
  };
}

/**
 * Has a piece take the pointer only where it is, and not across its box: a cover that dips round a key leaves that key to be pressed. Its outline,
 * `path` in `viewbox`, goes over it as a shape that catches the pointer and draws nothing, and the piece itself lets the pointer through. Gives back
 * what undoes it. A piece with no outline is its box, and keeps it.
 */
export function catches(piece: HTMLElement) {
  const outline = piece.getAttribute('path'), view = piece.getAttribute('viewbox');
  if (!outline || !view) return () => {};
  const NS = 'http://www.w3.org/2000/svg';
  const hit = document.createElementNS(NS, 'svg');
  hit.setAttribute('viewBox', view);
  hit.setAttribute('preserveAspectRatio', 'none');
  hit.setAttribute('aria-hidden', 'true');
  hit.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
  const shape = document.createElementNS(NS, 'path');
  shape.setAttribute('d', outline);
  shape.setAttribute('fill', 'transparent');
  shape.style.pointerEvents = 'fill';
  hit.append(shape);
  piece.append(hit);
  piece.style.pointerEvents = 'none';
  return () => {
    hit.remove();
    piece.style.pointerEvents = '';
  };
}
