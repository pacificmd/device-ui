// The hand working a device by itself. It sends what a browser sends for a real mouse, at real places on the page,
// so sound, haptics and the object's own code run as they would for anyone, and the hand takes its grips as it always does.
import { captured, uncapture, type Part } from 'device-ui';
import { hand, jointOf, moving, POINTERS, spared } from './hand.js';

/** One thing to do to a device. `on` is one control or several in a row, and leave it out to only say something or wait. */
export interface Step {
  on?: string | string[];
  /** One line on what's happening, which stays up until the next one. */
  say?: string;
  /** Where a turn or a slide ends up, 0 to 1 of its range. */
  to?: number;
  /** Degrees to turn it, clockwise, for something with no range. */
  turn?: number;
  /** Where to go, as shares of the control's box: a list goes through each with the button held, unless `hover`. */
  at?: readonly [number, number] | readonly (readonly [number, number])[];
  /** Move without pressing, as over glass. */
  hover?: boolean;
  /** Ms to keep the button down. */
  hold?: number;
  /** Ms to wait afterwards, so that there's time to see what it did. */
  wait?: number;
  /** Watches what `on` picks out for this attribute coming on, then presses them back in the order they lit: anything that shows a run to repeat. */
  copy?: string;
  /** Which hand does it. The right, unless it says. */
  hand?: 'left' | 'right';
  /** What the other hand does while this one holds its press down, as a left hand keeps a note down while the right adds to it. It lets go when they're done, or after `hold` if that's longer. */
  with?: Step[];
}

export interface PilotOptions {
  /** Takes the line of a step, or an empty one at the end. */
  say?(line: string): void;
  /** Where the hand sets off from, window pixels. Under the device if not given. */
  from?: readonly [number, number];
  /** A real mouse here isn't a hand coming back: it's what started the run, or what can be used while it plays. */
  own?: Element;
  size?: number;
  /** Told when a real mouse stops the hand where it is, and when it goes on. */
  paused?(on: boolean): void;
}

export interface Flight {
  stop(): void;
  /** Holds the hand where it is, with whatever it has down, until `resume`. */
  pause(): void;
  resume(): void;
  /** True if it got to the end. */
  done: Promise<boolean>;
}

// Px a real mouse has to go before it counts as somebody taking over, which holds the hand where it is.
const NUDGE = 4;
// Ms after the run starts or goes on that the real mouse can still get out of the way.
const CALM = 900;
// How long the hand takes to get across, ms: a base, then per px, then the longest.
const REACH = [240, 1.1, 900] as const;
// Radians a second round a pin, and px a second along a track.
const SPIN = 2.8, RUN = 170;
// The share of what's left of a slide that the hand goes in one frame once it's close.
const SETTLE = 0.35;
// The most a turn or slide can take before the hand gives up on it, seconds.
const PATIENCE = 4;
// A knob closer to its pin than this, px, takes a straight drag, as the controls' own HUB says.
const SMALL = 24;
const DWELL = 130, PRESS = 110, AFTER = 420;
// Ms with nothing coming on before a run counts as over.
const QUIET = 650;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise(go => setTimeout(go, ms));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** How far along a part is, 0 to 1 on a range and radians on a free knob, if it can be read at all. */
function reading(part: Part): (() => number) | null {
  const el = part.el.querySelector('input');
  if (el?.type === 'range') {
    const min = +el.min || 0, max = el.max === '' ? 100 : +el.max;
    return () => (+el.value - min) / (max - min);
  }
  if (el) return () => +el.checked;
  if (part.el.hasAttribute('turn')) return () => +part.el.getAttribute('turn')!;
  if (part.el.hasAttribute('slide')) return () => +part.el.getAttribute('slide')!;
  return null;
}

/** The pin of a part, css px from its top left, and how far from it there is to go round. */
function pinOf(part: Part) {
  const [x, y] = (part.def as { pin?(p: Part): [number, number] }).pin?.(part) ?? [part.w / 2, part.h / 2];
  return { x, y, reach: Math.min(...[x, part.w - x, y, part.h - y].filter(d => d > 0)) };
}

const ancestors = (el: Element | null) => {
  const all: Element[] = [];
  for (; el; el = el.parentElement) all.push(el);
  return all;
};

/** Runs `steps` on `device`. Moving the real pointer holds the hand where it is until `resume`. Pressing anything, scrolling or Esc takes it back for good, except inside `own`. */
export function pilot(device: HTMLElement, steps: readonly Step[], o: PilotOptions = {}): Flight {
  const off = new AbortController(), { signal } = off;
  const b = device.getBoundingClientRect();
  const gone = hand({ always: true, size: o.size ?? Math.min(136, innerWidth * 0.26) });
  let stopped = false, mouse: [number, number] | null = null, calm = performance.now() + CALM;
  type Side = keyof typeof POINTERS;

  // The hand's own time, which doesn't go on while it's held, so nothing it was doing jumps when it's let go.
  let still: { at: number; go(): void; on: Promise<void> } | null = null, lost = 0;
  const clock = () => (still?.at ?? performance.now()) - lost;
  const frame = async () => {
    await still?.on;
    await new Promise(requestAnimationFrame);
    await still?.on;
    return clock();
  };
  // A stop doesn't wait out a pause, so what ends it can put things right at once.
  const halted = new Promise<void>(go => signal.addEventListener('abort', () => go()));
  const pause = async (ms: number) => {
    for (const end = clock() + ms; !stopped && clock() < end;) {
      await still?.on;
      await Promise.race([sleep(end - clock()), halted]);
    }
  };

  /** One hand: its own pointer, where it is, and what it's over and pressing. */
  const reach = (side: Side, from: readonly [number, number]) => {
    const id = POINTERS[side];
    let [x, y] = from;
    let under: Element | null = null, held: Element | null = null, used = false;

    const init = (bubbles = true, buttons = held ? 1 : 0): PointerEventInit => ({
      bubbles, cancelable: bubbles, composed: bubbles, view: window, clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons, pointerId: id, pointerType: 'mouse', isPrimary: side === 'right', width: 1, height: 1, pressure: buttons ? 0.5 : 0,
    });
    // A browser folds the moves of a frame into one and lists them on it, and that list always has at least the one in it.
    const pointer = (name: string, to: Element, bubbles = true) => to.dispatchEvent(new PointerEvent(name, {
      ...init(bubbles), ...(name === 'pointermove' && { coalescedEvents: [new PointerEvent(name, init(bubbles))] }),
    }));
    const both = (name: string, to: Element) => {
      pointer(`pointer${name}`, to);
      to.dispatchEvent(new MouseEvent(`mouse${name}`, init()));
    };

    /** Takes the hand to a place, going in and out of what's under it on the way as a browser would. Pressed on something that captured it, it stays on that. */
    const put = (nx: number, ny: number) => {
      used = true;
      x = nx;
      y = ny;
      const kept = held && captured(id);
      if (kept) return both('move', kept);
      const next = document.elementFromPoint(x, y);
      if (!next) return;
      if (next !== under) {
        const left = ancestors(under), entered = ancestors(next);
        if (under?.isConnected) both('out', under);
        for (const el of left) if (!entered.includes(el) && el.isConnected) pointer('pointerleave', el, false);
        both('over', next);
        for (const el of entered.reverse()) if (!left.includes(el)) pointer('pointerenter', el, false);
        under = next;
      }
      both('move', next);
    };
    const glide = async (tx: number, ty: number, ms = Math.min(REACH[0] + Math.hypot(tx - x, ty - y) * REACH[1], REACH[2])) => {
      if (reduced()) return put(tx, ty);
      const fx = x, fy = y, from = clock();
      for (let t = 0; t < 1 && !stopped;) {
        t = Math.min((await frame() - from) / ms, 1);
        if (!stopped) put(fx + (tx - fx) * ease(t), fy + (ty - fy) * ease(t));
      }
    };
    const press = () => {
      if (!under) return;
      held = under;
      both('down', held);
    };
    /** Lifts where a browser would: on what captured it, or else on what's under it, and clicks what those two share. */
    const release = (click = true) => {
      if (!held) return;
      const was = held, kept = uncapture(id), to = kept ?? under ?? was;
      held = null;
      both('up', to);
      kept?.dispatchEvent(new PointerEvent('lostpointercapture', init()));
      const shared = ancestors(was).find(el => el.contains(to));
      if (click && shared) shared.dispatchEvent(new MouseEvent('click', { ...init(true, 0), detail: 1 }));
    };
    const box = (el: Element) => el.getBoundingClientRect();
    const spot = (el: Element, [fx, fy]: readonly [number, number]): [number, number] => {
      const r = box(el);
      return [r.left + r.width * fx, r.top + r.height * fy];
    };

    /** Goes round, or straight up and across for a knob too small to get round, until it reads `goal` or has gone `sweep` radians. */
    const turn = async (part: Part, step: Step) => {
      const r = box(part.el), read = reading(part), range = !!part.el.querySelector('input');
      const k = r.width / part.w || 1, pin = pinOf(part), radius = pin.reach * k, cx = r.left + pin.x * k, cy = r.top + pin.y * k;
      const free = read && !range ? read() + ((step.turn ?? 0) * Math.PI) / 180 : null;
      const goal = free ?? step.to, sweep = ((step.turn ?? 0) * Math.PI) / 180;
      const way = goal !== undefined && read ? Math.sign(goal - read()) || 1 : Math.sign(sweep) || 1;
      const round = radius >= SMALL, out = radius * 0.72;
      // A pin off the middle has an arm on it, so the hand takes the arm wherever that's got to, or the nearest of it inside the part's box.
      let a = pin.x * 2 === part.w && pin.y * 2 === part.h ? -Math.PI / 4 : (part.springs.turn?.value ?? 0) - Math.PI / 2, gone = 0;
      const ax = Math.min(Math.max(cx + Math.cos(a) * out, r.left + 2), r.right - 2), ay = Math.min(Math.max(cy + Math.sin(a) * out, r.top + 2), r.bottom - 2);
      a = Math.atan2(ay - cy, ax - cx);
      await glide(...(round ? [ax, ay] as const : [cx, cy] as const));
      await pause(DWELL);
      if (stopped) return;
      press();
      for (let last = clock(), from = last; !stopped && (last - from) / 1000 < PATIENCE;) {
        const now = await frame(), dt = (now - last) / 1000;
        last = now;
        if (stopped) break;
        a += way * SPIN * dt;
        gone += SPIN * dt;
        if (round) put(cx + Math.cos(a) * out, cy + Math.sin(a) * out);
        else put(x + way * RUN * dt * 0.7, y - way * RUN * dt * 0.7);
        if (goal !== undefined && read ? (goal - read()) * way <= 0.004 : gone >= Math.abs(sweep)) break;
      }
      await pause(DWELL);
      release(false);
    };

    /** Pushes along the long side of the part until it reads `to`, or goes past it, turning back if that was the wrong way. */
    const slide = async (part: Part, to: number) => {
      const r = box(part.el), across = r.width >= r.height, read = reading(part);
      // Inside the box, since a slide at either end would put the hand on its very edge, which is whatever is next to it.
      const at = Math.min(Math.max(read?.() ?? 0, 0.02), 0.98), start = across ? r.left + r.width * at : r.top + r.height * (1 - at);
      await glide(across ? start : r.left + r.width / 2, across ? r.top + r.height / 2 : start);
      await pause(DWELL);
      if (stopped) return;
      press();
      const first = read?.() ?? to, side = Math.sign(to - first), span = across ? r.width : r.height;
      let way = side * (across ? 1 : -1) || 1, left = Math.abs(to - first);
      for (let last = clock(), from = last, far = left; !stopped && (last - from) / 1000 < PATIENCE;) {
        const now = await frame(), dt = (now - last) / 1000;
        last = now;
        if (stopped) break;
        // It slows as it comes up to the mark, as a hand does, guessing the travel is the length of the box. A slow frame would otherwise jump right past.
        const by = way * Math.min(RUN * dt, Math.max(1, left * span * SETTLE));
        put(x + (across ? by : 0), y + (across ? 0 : by));
        // A coarse control can step right over the mark, and that's as near as it goes.
        const v = read?.() ?? to;
        left = Math.abs(to - v);
        if (left <= 0.01 || Math.sign(to - v) !== side) break;
        if (left > far + 0.02) {
          way = -way;
          far = left;
        }
      }
      await pause(DWELL);
      release(false);
    };

    const tap = async (el: Element, step: Step) => {
      const [fx, fy] = (step.at ?? [0.5, 0.5]) as readonly [number, number];
      await glide(...spot(el, [fx, fy]));
      await pause(DWELL);
      if (stopped) return;
      press();
      await Promise.all([pause(step.hold ?? PRESS), step.with && run(step.with, side === 'right' ? 'left' : 'right')]);
      release();
    };

    /** A route over a control, pressed or not. */
    const route = async (el: Element, step: Step) => {
      const [first, ...rest] = step.at as readonly (readonly [number, number])[];
      await glide(...spot(el, first!));
      await pause(DWELL);
      if (stopped) return;
      if (!step.hover) press();
      for (const point of rest) if (!stopped) await glide(...spot(el, point));
      await pause(step.hold ?? 0);
      release();
    };

    /**
     * A control on a face that isn't showing is got at as a hand would: the body is turned over to that face first, and the hand
     * goes on once it's there. A face is a `reverse` or `side` device in its body, and anything else is on the front.
     */
    const face = async (el: Element) => {
      if (getComputedStyle(el).visibility !== 'hidden') return;
      const own = el.closest('d-device'), body = own?.parentElement?.closest('d-device');
      const [turned, want] = own && body && (own.hasAttribute('reverse') || own.hasAttribute('side'))
        ? [body, own.hasAttribute('reverse') ? '' : own.getAttribute('side')]
        : [own, null];
      // Hidden with that face already asked for is hidden for some other reason, as a device too small to work is.
      if (!turned || turned.getAttribute('turned') === want) return;
      if (want === null) turned.removeAttribute('turned');
      else turned.setAttribute('turned', want);
      for (const end = clock() + PATIENCE * 1000; !stopped && clock() < end && getComputedStyle(el).visibility === 'hidden';) await frame();
      await pause(DWELL);
    };

    const copy = async (selector: string, name: string) => {
      const lit: Element[] = [];
      let last = 0;
      const eyes = new MutationObserver(changes => {
        for (const { target, oldValue } of changes) {
          if (oldValue !== null || !(target as Element).hasAttribute(name)) continue;
          lit.push(target as Element);
          last = clock();
        }
      });
      for (const el of device.querySelectorAll(selector)) eyes.observe(el, { attributeFilter: [name], attributeOldValue: true });
      while (!stopped && !(lit.length && clock() - last > QUIET)) await pause(40);
      eyes.disconnect();
      for (const el of lit) if (!stopped) await tap(el, {});
    };

    const work = async (selector: string, step: Step) => {
      if (step.copy) return copy(selector, step.copy);
      const el = selector ? device.querySelector(selector) : device;
      if (!el) throw new Error(`pilot: nothing matches ${selector} in #${device.id}`);
      await face(el);
      if (stopped) return;
      const part = moving(el), joint = jointOf(part);
      if (Array.isArray(step.at?.[0])) return route(el, step);
      if (joint === 'turn' && (step.to !== undefined || step.turn !== undefined)) return turn(part!, step);
      if (joint === 'slide' && step.to !== undefined) return slide(part!, step.to);
      return tap(el, step);
    };

    /** Lets go, and with `away` takes the hand off the page too, if it ever came on. */
    const done = (away: boolean) => {
      release(false);
      if (away && used) pointer('pointerleave', document.documentElement, false);
    };
    return { work, done };
  };
  const hands = {
    right: reach('right', o.from ?? [b.left + b.width / 2, b.bottom + 20]),
    left: reach('left', [b.left + b.width * 0.2, b.bottom + 20]),
  };

  async function run(list: readonly Step[], side: Side): Promise<boolean> {
    for (const step of list) {
      if (stopped || !device.isConnected) return false;
      if (step.say !== undefined) o.say?.(step.say);
      const one = hands[step.hand ?? side];
      for (const selector of [step.on ?? []].flat()) {
        if (stopped) return false;
        await one.work(selector, step);
        await pause(step.wait === undefined ? AFTER * 0.5 : 0);
      }
      await pause(step.wait ?? AFTER);
    }
    return !stopped;
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    off.abort();
    // The right hand is the mouse's, which takes it back from where it is. The left was only ever the pilot's.
    hands.right.done(false);
    hands.left.done(true);
    spared.el = null;
    document.body.classList.remove('d-spared');
    still?.go();
  };
  const hold = () => {
    if (stopped || still) return;
    let go!: () => void;
    const on = new Promise<void>(done => (go = done));
    still = { at: performance.now(), go, on };
    o.paused?.(true);
  };
  const resume = () => {
    if (stopped || !still) return;
    lost += performance.now() - still.at;
    const was = still;
    still = null;
    mouse = null;
    calm = performance.now() + CALM;
    was.go();
    o.paused?.(false);
  };
  // The glove is the hand's while it flies, and the real mouse keeps its own arrow, so moving it never drags the glove off what it's doing.
  spared.el = document.body;
  document.body.classList.add('d-spared');
  const o2 = { signal, capture: true, passive: true };
  const mine = (e: Event) => !!o.own && e.composedPath().includes(o.own);
  addEventListener('pointermove', e => {
    if (!e.isTrusted || e.pointerType !== 'mouse' || still) return;
    // The mouse that started it, or let it go on, still has to get out of the way.
    if (mine(e) || performance.now() < calm) return void (mouse = [e.clientX, e.clientY]);
    mouse ??= [e.clientX, e.clientY];
    if (Math.hypot(e.clientX - mouse[0], e.clientY - mouse[1]) >= NUDGE) hold();
  }, o2);
  addEventListener('pointerdown', e => {
    if (e.isTrusted && !mine(e)) stop();
  }, o2);
  addEventListener('wheel', stop, o2);
  addEventListener('touchmove', stop, o2);
  addEventListener('keydown', e => {
    if (e.key === 'Escape') stop();
  }, o2);

  const done = run(steps, 'right').catch((e: unknown) => {
    console.error(e);
    return false;
  }).then(end => {
    stop();
    o.say?.('');
    gone();
    return end;
  });
  return { stop, pause: hold, resume, done };
}
