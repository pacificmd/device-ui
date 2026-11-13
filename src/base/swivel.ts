// A piece that turns half round on a pin through its face, flat over the body the whole way, as a phone's screen swings up off its keyboard.
// The piece is a device of its own, drawn flat once. Turned over, it rests where the half turn puts it, and only its `translate` takes it there,
// which nothing lays out again for. Only the turn between is turned, by the page, so nothing is ever laid out while it's turned.
import { capture, reduced } from './drag.js';
import { catches } from './glide.js';

export interface SwivelOptions {
  /** The pin, css px from the piece's top left. */
  pivot: readonly [number, number];
  /** Which way it goes round to turn over: 1 clockwise, -1 the other way. It comes back the way it went. */
  way?: 1 | -1;
  /** Ms for the half turn. */
  ms?: number;
  /** Told when it comes to rest, and whether it's turned. */
  rested?(turned: boolean): void;
  /** A click on the piece turns it. Otherwise only a drag round the pin does. */
  click?: boolean;
}

export interface Swivel {
  readonly turned: boolean;
  open(): void;
  shut(): void;
  toggle(): void;
  stop(): void;
}

// How far a pointer goes, degrees round the pin, before a press is a drag.
const SLOP = 6;

/**
 * Turns `piece`, a `d-device` inside its body, half round on `pivot`. At rest turned, it carries `swung`, and is drawn as it then looks: a piece
 * turned half round in its own plane is the same shape, so the drawing only needs what's printed on it to show the other way up.
 */
export function swivel(piece: HTMLElement, o: SwivelOptions): Swivel {
  const ms = o.ms ?? 420, way = o.way ?? 1, [px, py] = o.pivot;
  let at = 0, turned = piece.hasAttribute('swung'), raf = 0, spin: Animation | null = null;
  // The turn, as one animation the page holds still at any point of it: 0 flat as drawn, 1 half round.
  const hold = () => {
    if (spin) return spin;
    const origin = `${px}px ${py}px`;
    // Turning, it's the piece as drawn, half round, and not the drawing of it turned over.
    piece.style.translate = '';
    piece.removeAttribute('swung');
    spin = piece.animate([{ transform: 'rotate(0deg)', transformOrigin: origin }, { transform: `rotate(${way * 180}deg)`, transformOrigin: origin }], { duration: 1000, fill: 'both', easing: 'linear' });
    spin.pause();
    return spin;
  };
  const put = (t: number) => {
    at = t;
    hold().currentTime = t * 1000;
  };
  const rest = (to: boolean) => {
    cancelAnimationFrame(raf);
    at = to ? 1 : 0;
    // Half round on a pin is the same as moved by twice the pin, less the piece.
    piece.style.translate = to ? `${2 * px - piece.offsetWidth}px ${2 * py - piece.offsetHeight}px` : '';
    spin?.cancel();
    spin = null;
    piece.toggleAttribute('swung', to);
    turned = to;
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
      // It goes easily on its detent and drops into the other one.
      put(from + (end - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
      else rest(to);
    };
    raf = requestAnimationFrame(step);
  };

  const stopCatching = catches(piece);
  const ac = new AbortController(), { signal } = ac;
  // The pin on the page, where the piece is now.
  const pin = () => {
    const r = piece.offsetParent?.getBoundingClientRect(), x0 = (r?.left ?? 0) + piece.offsetLeft, y0 = (r?.top ?? 0) + piece.offsetTop;
    const k = (piece.offsetParent as HTMLElement | null)?.offsetWidth ? r!.width / (piece.offsetParent as HTMLElement).offsetWidth : 1;
    return [x0 + px * k, y0 + py * k] as const;
  };
  const angle = (e: PointerEvent, [x, y]: readonly [number, number]) => (Math.atan2(e.clientY - y, e.clientX - x) * 180) / Math.PI;
  let down: { a: number; at: number; id: number; pin: readonly [number, number] } | null = null, dragged = false;
  piece.style.touchAction = 'none';
  piece.addEventListener('pointerdown', e => {
    if (e.button) return;
    cancelAnimationFrame(raf);
    const p = pin();
    down = { a: angle(e, p), at, id: e.pointerId, pin: p };
    dragged = false;
  }, { signal });
  piece.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) return;
    let d = angle(e, down.pin) - down.a;
    d = ((d + 540) % 360) - 180;
    if (!dragged && Math.abs(d) < SLOP) return;
    if (!dragged) capture(piece, e);
    dragged = true;
    put(Math.max(0, Math.min(1, down.at + (way * d) / 180)));
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
    if (o.click) run(!turned);
  }, { signal });
  if (turned) requestAnimationFrame(() => rest(true));

  return {
    get turned() {
      return turned;
    },
    open: () => run(true),
    shut: () => run(false),
    toggle: () => run(!turned),
    stop() {
      cancelAnimationFrame(raf);
      ac.abort();
      spin?.cancel();
      stopCatching();
    },
  };
}
