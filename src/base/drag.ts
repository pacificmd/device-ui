// What a joint does with a hand: follow a pointer, and work out what that does to a control.
import type { Part } from './types.js';

export const input = (p: Part) => p.el.querySelector('input')!;

/** An input with no `min` or `max` reports them blank, and a range then runs from 0 to 100. */
export const limits = (el: { min: string | number; max: string | number }): [number, number] =>
  [el.min === '' ? 0 : +el.min, el.max === '' ? 100 : +el.max];

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// A browser can only capture a pointer it made. One it didn't, such as the hand's, is kept here, and whatever moves it asks where to send it.
const kept = new Map<number, Element>();

/** Keeps `e`'s pointer on `el` until it lifts, as `setPointerCapture` does, for a pointer the browser didn't make too. */
export function capture(el: Element, e: PointerEvent): void {
  if (e.isTrusted) el.setPointerCapture(e.pointerId);
  else kept.set(e.pointerId, el);
}

/** Whether `el` still has `e`'s pointer. A press two things capture in turn goes to the last, and the first is never told it lost what it never got: so a drag asks, and doesn't wait to hear. */
export const keeps = (el: Element, e: PointerEvent): boolean => (e.isTrusted ? el.hasPointerCapture(e.pointerId) : kept.get(e.pointerId) === el);

/** What has a made-up pointer, if anything. Whatever moves that pointer sends it there until it lifts. */
export const captured = (pointerId: number): Element | undefined => kept.get(pointerId);

/** Lets a made-up pointer go, and says what had it, which is owed a `lostpointercapture`. */
export function uncapture(pointerId: number): Element | undefined {
  const el = kept.get(pointerId);
  kept.delete(pointerId);
  return el;
}

export interface Drag {
  /** Return false to leave a press alone. */
  accepts?(e: PointerEvent): boolean;
  start?(e: PointerEvent): void;
  move(e: PointerEvent, dx: number, dy: number): void;
  end?(e: PointerEvent): void;
}

/** Follows a pointer from press to release, wherever it wanders. Only the main button, and one pointer at a time. */
export function onDrag(p: Part, signal: AbortSignal, o: Drag): void {
  let held = false;
  p.el.addEventListener('pointerdown', e => {
    if (held || e.button || o.accepts?.(e) === false || p.el.querySelector('input')?.disabled) return;
    e.preventDefault();
    p.el.querySelector('input')?.focus({ preventScroll: true });
    capture(p.el, e);
    held = true;
    let x = e.clientX, y = e.clientY;
    o.start?.(e);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      o.move(ev, ev.clientX - x, ev.clientY - y);
      x = ev.clientX;
      y = ev.clientY;
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      held = false;
      p.el.removeEventListener('pointermove', move);
      p.el.removeEventListener('pointerup', up);
      p.el.removeEventListener('pointercancel', up);
      p.el.removeEventListener('lostpointercapture', up);
      o.end?.(ev);
    };
    p.el.addEventListener('pointermove', move);
    p.el.addEventListener('pointerup', up);
    p.el.addEventListener('pointercancel', up);
    // The element can lose the pointer with no up at all, and it mustn't stay stuck to the mouse.
    p.el.addEventListener('lostpointercapture', up);
  }, { signal });
}

/** A pen on glass, in the points of whatever it's drawing on. */
export interface Pen {
  /** The pen meets the glass. Return false to leave this one alone, for something else on the glass to have. */
  down?(x: number, y: number, e: PointerEvent): boolean | void;
  /** Every point of a stroke, coalesced ones included, so a quick line keeps its shape. */
  move?(x: number, y: number, e: PointerEvent): void;
  up?(x: number, y: number, e: PointerEvent): void;
}

/** Where on an element a pen can write, in the element's own px, and how many points across and down that holds. */
export interface PenArea { x: number; y: number; w: number; h: number; cols: number; rows: number }

/**
 * Follows a pen, or a finger or pointer, over an area of an element and reports where it is in that area's points,
 * as a touch panel does. A stroke that starts inside is held at the edge if it runs off. Returns what stops it.
 */
export function onPen(el: HTMLElement, area: () => PenArea, o: Pen): () => void {
  const off = new AbortController(), { signal } = off;
  let pen = -1;
  el.style.pointerEvents = 'auto';
  el.style.touchAction = 'none';
  el.style.cursor = 'crosshair';
  const at = (e: PointerEvent) => {
    const r = el.getBoundingClientRect(), k = r.width / (el.offsetWidth || 1), a = area();
    const x = ((e.clientX - r.left) / k - a.x) / a.w, y = ((e.clientY - r.top) / k - a.y) / a.h;
    return { x: x * a.cols, y: y * a.rows, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1, a };
  };
  const held = (v: number, n: number) => clamp(v, 0, n - 0.001);
  el.addEventListener('pointerdown', e => {
    if (e.button || pen >= 0) return;
    const { x, y, inside } = at(e);
    if (!inside || o.down?.(x, y, e) === false) return;
    e.preventDefault();
    pen = e.pointerId;
    capture(el, e);
  }, { signal });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== pen) return;
    for (const c of e.getCoalescedEvents?.() ?? [e]) {
      const { x, y, a } = at(c);
      o.move?.(held(x, a.cols), held(y, a.rows), e);
    }
  }, { signal });
  const lift = (e: PointerEvent) => {
    if (e.pointerId !== pen) return;
    pen = -1;
    const { x, y, a } = at(e);
    o.up?.(held(x, a.cols), held(y, a.rows), e);
  };
  el.addEventListener('pointerup', lift, { signal });
  el.addEventListener('pointercancel', lift, { signal });
  return () => off.abort();
}

export function setValue(el: HTMLInputElement, value: number): void {
  const before = el.value;
  // Past any instance setter, or React takes the change as its own and drops the event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(value));
  if (el.value !== before) el.dispatchEvent(new Event('input', { bubbles: true }));
}

const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Clockwise radians between two points around a centre at 0,0. It adds up, so crossing the seam at
 * 180 degrees is nothing special. Inside `arm` px it turns as a lever that long would, so the middle
 * isn't twitchy and going over it isn't a spin.
 */
export function swept(ax: number, ay: number, bx: number, by: number, arm = 0): number {
  const a = Math.hypot(ax, ay), b = Math.hypot(bx, by);
  if (Math.min(a, b) >= arm) return wrapped(Math.atan2(by, bx) - Math.atan2(ay, ax));
  return (ax * by - ay * bx) / (Math.max(a, b) * arm);
}

/** What a hand can do to a control. Leave a limit infinite for none. */
export interface Reach {
  min: number;
  max: number;
  /** Between detents. 0 for none. */
  step: number;
  /** It goes round, and the top is the bottom. */
  wrap?: boolean;
  /** How far the hand can get past a stop before the part stops waiting for it. */
  past?: number;
}

// Of a step, how far past halfway the hand has to go for a detent to let go, in either direction.
// It clicks over and stays, however much the hand shakes at the crest.
const STICK = 0.12;

/** Where a hand has got to on a control, and where that leaves the control. */
export class Hand {
  /** Can be ahead of the control, or past a stop. */
  at = 0;
  /** In a detent, if it has them. */
  seat = 0;

  grab(value: number): void {
    this.at = this.seat = value;
  }

  by(delta: number, r: Reach): number {
    const { min, max, step, wrap, past = 0 } = r, span = max - min;
    this.at += delta;
    if (wrap && span) {
      const round = Math.floor((this.at - min) / span) * span;
      this.at -= round;
      this.seat -= round;
    } else this.at = clamp(this.at, min - past, max + past);
    const held = wrap ? this.at : clamp(this.at, min, max);
    if (!step) return (this.seat = held);
    const from = Number.isFinite(min) ? min : 0, k = (this.seat - from) / step, h = (held - from) / step;
    const next = h > k ? Math.floor(h + 0.5 - STICK) : Math.ceil(h - 0.5 + STICK);
    if ((next - k) * (h - k) > 0) this.seat = from + next * step;
    return this.seat;
  }
}

/** A stepped input's step, or 0 if it takes anything. */
export const stepOf = (el: HTMLInputElement) => (el.step === 'any' ? 0 : +el.step || 1);

/** A stepped input lags the hand, so what's drawn leans after it. */
export function lean(p: Part, by: number, key = 'pull'): void {
  if (p.data[key] === by) return;
  p.data[key] = by;
  p.def.update?.(p);
}

// How far a detent gives before it lets go, of the half step the hand can get ahead of it.
export const HOLD = 0.4;
