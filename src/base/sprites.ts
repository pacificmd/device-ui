import type { Camera } from './camera.js';
import { onShown } from './scale.js';

// Many things in a camera's world, shown as pictures of themselves on one canvas behind it. A world of hundreds costs what a few do as its
// camera moves: the page has no element for any of them, so the browser has nothing to lay out, paint or composite for each, and a thing
// only takes up room in the engine once it's brought on as itself. A picture doesn't answer the light or a hand, and it's as sharp as it was made.

export interface Sprite {
  /** What it's turned about, in the world's css px, and how far, in degrees. */
  x: number;
  y: number;
  turn?: number;
  /** Where it lies round that point, in the world's css px: left, top, width, height. */
  box: readonly number[];
  /** Where it lies in the image, px: left, top, width, height. */
  from: readonly number[];
}

export interface Sprites {
  readonly canvas: HTMLCanvasElement;
  /** Which it's not showing at all. */
  readonly hidden: ReadonlySet<number>;
  /** Takes one to all of it showing, or none, over `ms`, as what it's a picture of comes on or goes off, and says when that's done. Another for the same one takes over from it. */
  fade(i: number, to: 0 | 1, ms: number, done?: () => void): void;
}

/** Shows `list`, cut from `image`, behind `world` as `cam` shows it, and from then on wherever it goes. */
export function sprites(cam: Camera, world: HTMLElement, image: CanvasImageSource, list: readonly Sprite[]): Sprites {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')!;
  canvas.dataset.sprites = '';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  world.before(canvas);
  const hidden = new Set<number>(), shares = new Map<number, number>();
  const fades = new Map<number, { from: number; to: 0 | 1; at: number; ms: number; done?: () => void }>();
  // How far each reaches from its point at most, so what's off the window is passed over without turning it.
  const reach = list.map(({ box: [l, t, w, h] }) => Math.hypot(Math.max(Math.abs(l!), Math.abs(l! + w!)), Math.max(Math.abs(t!), Math.abs(t! + h!))));
  const draw = () => {
    const dpr = devicePixelRatio || 1, across = Math.round(innerWidth * dpr), down = Math.round(innerHeight * dpr);
    if (canvas.width !== across || canvas.height !== down) {
      canvas.width = across;
      canvas.height = down;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, across, down);
    ctx.imageSmoothingQuality = 'medium';
    const k = dpr * cam.scale, { deg, x: tx, y: ty } = cam.turned, t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    list.forEach((p, i) => {
      const share = shares.get(i) ?? 1;
      if (!share) return;
      const dx = p.x - tx, dy = p.y - ty, px = (tx + dx * c - dy * s) * k - cam.x * dpr, py = (ty + dx * s + dy * c) * k - cam.y * dpr, r = reach[i]! * k;
      if (px + r < 0 || py + r < 0 || px - r > across || py - r > down) return;
      const a = t + ((p.turn ?? 0) * Math.PI) / 180, kc = k * Math.cos(a), ks = k * Math.sin(a);
      ctx.globalAlpha = share;
      ctx.setTransform(kc, ks, -ks, kc, px, py);
      ctx.drawImage(image, p.from[0]!, p.from[1]!, p.from[2]!, p.from[3]!, p.box[0]!, p.box[1]!, p.box[2]!, p.box[3]!);
    });
  };
  // Once for all that's changed at a time, as a camera's move and its turn come together, and in the same frame as what's drawn over it.
  let due = false;
  const soon = () => {
    if (due) return;
    due = true;
    queueMicrotask(() => {
      due = false;
      draw();
    });
  };
  let fading = 0;
  const step = (now: number) => {
    const over: (() => void)[] = [];
    for (const [i, f] of fades) {
      const t = Math.min(Math.max((now - f.at) / f.ms, 0), 1);
      shares.set(i, f.from + (f.to - f.from) * t);
      if (t < 1) continue;
      fades.delete(i);
      if (f.to) shares.delete(i);
      else hidden.add(i);
      if (f.done) over.push(f.done);
    }
    // Drawn before it's told, so what's over it can go in the same frame this shows all of it.
    draw();
    fading = fades.size ? requestAnimationFrame(step) : 0;
    for (const done of over) done();
  };
  onShown(w => w === world && soon());
  addEventListener('resize', soon);
  soon();
  return {
    canvas,
    hidden,
    fade(i, to, ms, done) {
      const from = shares.get(i) ?? 1;
      fades.delete(i);
      if (from === to) return done?.();
      hidden.delete(i);
      fades.set(i, { from, to, at: performance.now(), ms, done });
      fading ||= requestAnimationFrame(step);
    },
  };
}
