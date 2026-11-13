// A small thing out of its place and in the hand, as a match from a book. It's a device of its own, drawn flat once, and only the page moves and turns it, so
// nothing is laid out while it goes about. The hand holds it by a point, `grip`, and it turns about that.
import { capture, reduced } from './drag.js';

export interface LooseOptions {
  /** Where the hand holds it, css px from its own top left. */
  grip: [number, number];
  /** Every frame it moves: where the grip is from where its style puts it, css px, and how fast that's going, css px a second, seen unzoomed. */
  moved?(x: number, y: number, vx: number, vy: number): void;
  /** A hand let go of it. */
  dropped?(): void;
  /** How far it can be carried from `home`, css px, across and down, each way: as far as the air and the page go. */
  reach?: [number, number];
  /** Where a reach is measured from. Where its style puts it, by default. */
  home?: [number, number];
}

export interface Loose {
  /** Puts it there, grip first, with no travel. */
  put(x: number, y: number, turn?: number): void;
  /** Sends it there over `ms`, and turns it as it goes. */
  to(x: number, y: number, ms?: number): Promise<void>;
  /** Turns it to this many degrees clockwise, as a wrist does, over what it weighs. */
  turn(degrees: number): void;
  /** A hand takes it, from a press that started anywhere: it carries from here until that pointer lifts. */
  take(e: PointerEvent): void;
  readonly x: number;
  readonly y: number;
  readonly turned: number;
  readonly held: boolean;
  stop(): void;
}

// How soon a wrist turns it: its rate, a second, and how far a hand's pull leans it, degrees for a css px a second across.
const WRIST = 9, LEAN = 0.02, MOST_LEAN = 18;
// A hand brings a grip to itself this much a second, so what it took by anywhere comes to be held by its grip.
const GATHER = 10;

/** Lets `piece`, a `d-device`, be carried about by hand. */
export function loose(piece: HTMLElement, o: LooseOptions): Loose {
  const ac = new AbortController(), { signal } = ac, [gx, gy] = o.grip, [hx, hy] = o.home ?? [0, 0], [rx, ry] = o.reach ?? [Infinity, Infinity];
  let x = 0, y = 0, a = 0, want = 0, vx = 0, vy = 0, grip = -1, offx = 0, offy = 0, startx = 0, starty = 0, frame = 0, last = 0, cancel: (() => void) | null = null, handx = 0, handy = 0, lean = 0;
  piece.style.touchAction = 'none';
  piece.style.transformOrigin = `${gx}px ${gy}px`;
  const zoom = () => piece.parentElement!.getBoundingClientRect().width / (piece.parentElement!.offsetWidth || 1) || 1;
  const show = () => {
    piece.style.translate = `${(x - gx).toFixed(2)}px ${(y - gy).toFixed(2)}px`;
    piece.style.rotate = `${(a + lean).toFixed(2)}deg`;
  };
  const clamp = (v: number, c: number, r: number) => Math.max(c - r, Math.min(c + r, v));
  const step = (now: number) => {
    frame = 0;
    const dt = Math.min((now - last) / 1000 || 1 / 60, 1 / 20);
    last = now;
    if (grip >= 0) {
      offx *= Math.exp(-GATHER * dt);
      offy *= Math.exp(-GATHER * dt);
      const nx = clamp(handx + offx, hx, rx), ny = clamp(handy + offy, hy, ry);
      vx = (nx - x) / dt;
      vy = (ny - y) / dt;
      x = nx;
      y = ny;
      o.moved?.(x, y, vx, vy);
    }
    const leanTo = grip >= 0 ? Math.max(-MOST_LEAN, Math.min(MOST_LEAN, vx * LEAN)) : 0;
    lean += (leanTo - lean) * Math.min(1, 8 * dt);
    a += (want - a) * Math.min(1, WRIST * dt);
    show();
    if (grip >= 0 || Math.abs(want - a) > 0.05 || Math.abs(lean) > 0.05) frame = requestAnimationFrame(step);
  };
  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  };
  const follow = (e: PointerEvent) => {
    if (e.pointerId !== grip) return;
    const k = zoom();
    handx = startx + (e.clientX - start[0]!) / k;
    handy = starty + (e.clientY - start[1]!) / k;
  };
  let start = [0, 0];
  const take = (e: PointerEvent) => {
    cancel?.();
    const k = zoom(), box = piece.parentElement!.getBoundingClientRect();
    grip = e.pointerId;
    // Where the hand is in the frame this moves in. What it took stays where it is, and the grip comes over to the hand.
    start = [e.clientX, e.clientY];
    startx = handx = (e.clientX - box.left) / k;
    starty = handy = (e.clientY - box.top) / k;
    offx = x - handx;
    offy = y - handy;
    capture(piece, e);
    run();
  };
  piece.addEventListener('pointerdown', e => {
    if (e.button || grip >= 0) return;
    take(e);
  }, { signal });
  piece.addEventListener('pointermove', follow, { signal });
  for (const n of ['pointerup', 'pointercancel'] as const) piece.addEventListener(n, e => {
    if (e.pointerId !== grip) return;
    grip = -1;
    vx = vy = 0;
    o.dropped?.();
  }, { signal });
  return {
    put(nx, ny, turn) {
      x = nx;
      y = ny;
      if (turn !== undefined) a = want = turn;
      show();
    },
    to(nx, ny, ms = 300) {
      cancel?.();
      if (reduced() || !ms) {
        x = nx;
        y = ny;
        a = want;
        show();
        return Promise.resolve();
      }
      const fx = x, fy = y, begun = performance.now();
      return new Promise(done => {
        let raf = 0, was = performance.now(), wasx = x, wasy = y;
        const go = (now: number) => {
          const t = Math.min(1, (now - begun) / ms), e = t * t * (3 - 2 * t), dt = Math.max((now - was) / 1000, 1 / 240);
          x = fx + (nx - fx) * e;
          y = fy + (ny - fy) * e;
          o.moved?.(x, y, (x - wasx) / dt, (y - wasy) / dt);
          [was, wasx, wasy] = [now, x, y];
          a += (want - a) * Math.min(1, WRIST * dt);
          show();
          if (t < 1) raf = requestAnimationFrame(go);
          else {
            cancel = null;
            done();
          }
        };
        cancel = () => {
          cancelAnimationFrame(raf);
          cancel = null;
          done();
        };
        raf = requestAnimationFrame(go);
      });
    },
    turn(degrees) {
      want = degrees;
      if (reduced()) {
        a = want;
        show();
      } else run();
    },
    take,
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get turned() {
      return a;
    },
    get held() {
      return grip >= 0;
    },
    stop() {
      ac.abort();
      cancel?.();
      cancelAnimationFrame(frame);
    },
  };
}
