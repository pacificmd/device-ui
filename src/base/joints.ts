// How a part moves, apart from how it looks. A part declares its mechanism and spreads the joint into
// itself, and the joint holds the spring, the hard stops, the pointer and the keyboard, so the part only
// has to draw. Parts of the same size in the same materials feel related without being tuned.
import { gripping } from './springs.js';
import { contact, type ContactMotion } from './contact.js';
import { squashOn } from './angled.js';
import { capture, clamp, Hand, HOLD, input, lean, limits, onDrag, reduced, setValue, stepOf, swept, type Reach } from './drag.js';
import { partOf } from './engine.js';
import { rescale } from './scale.js';
import { MM, type GroupOptions, type Sheet } from './sheet.js';
import type { Carried, DeviceInfo, Part, SpringDef } from './types.js';

/** Fixed, or worked out from the part. */
export type Live<T> = T | ((p: Part) => T);
const read = <T,>(v: Live<T>, p: Part): T => (typeof v === 'function' ? (v as (p: Part) => T)(p) : v);

/** What's touching what. `drag` slows it down, and `start` is what it takes to get it going. */
const CONTACTS = {
  'ball-bearing': { drag: 0.06, start: 0.05 },
  'finger-on-glass': { drag: 0, start: 0 },
  'steel-on-steel': { drag: 0.15, start: 0.3 },
  'brass-on-steel': { drag: 0.16, start: 0.35 },
  'plastic-on-plastic': { drag: 0.2, start: 0.2 },
  'plastic-on-rubber': { drag: 0.15, start: 0.1 },
  'rubber-on-plastic': { drag: 0.3, start: 0.3 },
  'metal-on-grease': { drag: 0.25, start: 0.15 },
  governor: { drag: 0.75, start: 0 },
} as const;
export type ContactPair = keyof typeof CONTACTS;

export interface Detents {
  /** Between them: degrees on a turn, mm on a slide. Without it, an input's own step. */
  every?: Live<number>;
  /** How many positions, counting both ends, in place of `every`. 0 for none. */
  count?: Live<number>;
  /** 0 to 1. How hard it pulls in, which is also how fast it gets there. */
  strength?: number;
}

/** The physical mechanism of a moving part. Every joint takes these. */
export interface Mechanism {
  /** Grams, as felt at the hand. Heavier arrives later, and past a point coasts. */
  mass?: number;
  /** What's touching. It sets the friction, and is what sound reads off a contact's `motion`. */
  material?: ContactPair;
  /** Drag, 0 to 1, or that and what it takes to start moving. Instead of what the material says. */
  friction?: number | { drag?: number; start?: number };
  /** Newtons pushing it home. Without any it stays where it's put. */
  return?: number;
  detents?: boolean | Detents;
  /** A hard knock can be heard. A soft landing gives, and barely can. */
  stops?: { at?: Live<[number, number]>; landing?: 'hard' | 'soft' };
  /**
   * What arriving counts as, for `onContact`. A press going out and back, or a throw. Leave it out and
   * the joint decides: a press presses, a hinge throws, a slide or a turn reports its detents, its stops
   * and being dragged, and a spring with a `material` lands as a press.
   */
  contact?: 'press' | 'toggle' | false;
  /** The recording it makes, by name, when `material`, `mass` and the joint don't already come to it. */
  sound?: string;
  /** A pawl: it only goes this way, 1 up or clockwise and -1 down or back, and a hand going the other way slips. */
  ratchet?: 1 | -1;
}

// Stiffness at one gram, in the units a Spring takes. A key is 3g and a vault wheel over a kilo.
const STIFFNESS = 2000;
// The return a part is tuned at, in newtons: about a keyboard key.
const RETURN = 0.5;
// How fast something coasts, against the root of its mass over its drag. A coast under SHORTEST is no coast.
const COAST = 226, SHORTEST = 0.12;
// A coast dies at this speed, and a flick under it never starts. Radians a second.
const SLOWEST = 0.8, FASTEST = 14;

export interface Motion extends ContactMotion {
  mass: number;
  material: ContactPair;
  drag: number;
  start: number;
  /** Seconds. 0 if it doesn't coast. */
  coast: number;
  strength: number;
  landing: 'hard' | 'soft';
  /** Reports its own arrival, so reaching a stop is that and not a second sound. */
  arrives: boolean;
  returns: boolean;
  ratchet: number;
  /** A press puts it where the hand is, so it's the hand that says where it goes. */
  seats?: boolean;
  spring: SpringDef;
}

// What a hand on a throw or a roller is carried by. It works them from where it is.
const ATREST: Carried = { x: 0, y: 0, rotate: 0, pin: [0, 0] };

/** How hard an ordinary detent holds, 0 to 1. */
const DETENT = 0.35;

/** What a mechanism comes to. */
export function mechanism(o: Mechanism, joint: Motion['joint'] = 'spring', of: Pick<Motion, 'latch' | 'rolled' | 'seats'> = {}): Motion {
  const material = o.material ?? 'plastic-on-plastic', mass = o.mass ?? 10;
  const f = typeof o.friction === 'number' ? { drag: o.friction } : o.friction ?? {};
  const drag = f.drag ?? CONTACTS[material].drag, start = f.start ?? CONTACTS[material].start;
  const strength = o.detents ? (o.detents === true ? DETENT : o.detents.strength ?? DETENT) : 0;
  const stiffness = STIFFNESS * mass ** (-1 / 3) * (1 + strength) * (o.return ? Math.sqrt(o.return / RETURN) : 1);
  const coast = !o.return && !strength && drag ? Math.sqrt(mass) / drag / COAST : 0;
  return {
    ...of, joint, sound: o.sound, arrives: !!o.contact, mass, material, drag, start, strength, returns: !!o.return,
    coast: coast < SHORTEST ? 0 : coast,
    landing: o.stops?.landing ?? 'hard',
    ratchet: o.ratchet ?? 0,
    spring: { stiffness, damping: 2 * Math.min(0.1 + 0.9 * drag ** 0.35, 1) * Math.sqrt(stiffness) },
  };
}

/** The spring of a mechanism, for something a hand isn't on: a needle, a bolt, a hammer. */
export const spring = (o: Mechanism): SpringDef => withContact(mechanism(o), { contact: o.material ? 'press' : undefined, ...o });

/**
 * A motor turning a part, not a hand. Its `rpm` attribute is where it's headed, and it takes its mass's time to get there
 * and to run down. Hand `tick` to the part, and add `angle` to whatever it draws at. `hold` is a hand stopping it dead.
 */
export function motor(o: Mechanism = {}) {
  const held = new WeakSet<Part>();
  const target = (p: Part) => (held.has(p) ? 0 : +(p.el.getAttribute('rpm') ?? 0));
  return {
    springs: { speed: spring(o) } as Record<string, SpringDef>,
    update: (p: Part) => p.springs.speed!.set(target(p)),
    hold(p: Part, on: boolean) {
      if (on) {
        held.add(p);
        p.springs.speed!.snap(0);
      } else held.delete(p);
      p.springs.speed!.set(target(p));
    },
    tick(p: Part, dt: number) {
      const v = p.springs.speed!.value;
      if (Math.abs(v) < 0.02 || reduced()) return false;
      p.data.motor = (((p.data.motor ?? 0) as number) + (v / 60) * dt * Math.PI * 2) % (Math.PI * 2);
      return true;
    },
    angle: (p: Part) => (p.data.motor ?? 0) as number,
  };
}

export interface SwingOptions extends Mechanism {
  /** Beats a minute. There are two to each swing there and back, and it's taken up as soon as it changes, without a jump. */
  beats: Live<number>;
  /** Which of the part's inputs says it has been set going, a checkbox. Otherwise its last. */
  input?: number;
  /** Whether a click here starts or catches it. */
  accepts?(p: Part, e: MouseEvent): boolean;
  /** Where in each swing it beats, as a share of the way from the middle to the end. */
  drop?: number;
}

// A press that wanders this far, px, is a drag and not a tap.
const TAPPED = 3;
// How hard a beat is, for a contact, at full swing. A swing this small makes no sound.
const BEAT = 10, SILENT = 0.15;
// A gap between frames longer than this, seconds, is a page that wasn't looked at.
const ASLEEP = 1;

/**
 * Something swung by a wound spring through an escapement, on a clock of its own: the time of a swing is what the part says, not what a spring comes to.
 * A click sets it going or catches it. Its `wound` attribute is the seconds of spring left, which it counts down and can be topped up; left out, it never runs down. It dies away with none left.
 * Each beat is a `detent` contact, heard in the device's material, as an escapement knocks on the case round it. Hand `tick` to the part. `angle` is where the swing has got to from -1 to 1.
 */
export function swing(o: SwingOptions) {
  const motion = mechanism(o), drop = Math.asin(o.drop ?? 0.9);
  const box = (p: Part) => {
    const all = p.el.querySelectorAll('input');
    return all[o.input ?? all.length - 1]!;
  };
  const sync = (p: Part) => {
    const said = p.el.getAttribute('wound');
    if (said !== p.data.said) {
      p.data.said = said;
      p.data.left = said === null ? Infinity : +said;
    }
    return p.data.left as number;
  };
  const going = (p: Part) => box(p).checked && sync(p) > 0;
  const { material: _heard, ...weight } = o;
  return {
    motion,
    springs: { swing: spring(weight) } as Record<string, SpringDef>,
    update(p: Part) {
      const on = going(p), s = p.springs.swing!;
      if (on && s.value < 0.02) p.data.phase = 0;
      s.set(on ? 1 : 0);
    },
    connect(p: Part) {
      const ac = new AbortController(), { signal } = ac;
      let x = 0, y = 0;
      p.el.addEventListener('pointerdown', e => {
        x = e.clientX;
        y = e.clientY;
      }, { signal });
      p.el.addEventListener('click', e => {
        if (e.target === box(p) || Math.hypot(e.clientX - x, e.clientY - y) > TAPPED || o.accepts?.(p, e) === false) return;
        box(p).click();
      }, { signal });
      return () => ac.abort();
    },
    tick(p: Part, frame: number) {
      const s = p.springs.swing!, on = going(p);
      if (!on && s.value < 0.002) {
        delete p.data.clock;
        return false;
      }
      // It keeps time, so it goes by the clock and not by the frame's step, which the engine holds down on a slow machine. A tab away isn't time it ran.
      const clock = performance.now(), dt = p.data.clock === undefined ? frame : Math.min(ASLEEP, (clock - (p.data.clock as number)) / 1000);
      p.data.clock = clock;
      const was = (p.data.phase ?? 0) as number, now = was + Math.PI * (read(o.beats, p) / 60) * dt;
      p.data.phase = now;
      if (Math.floor((now - drop) / Math.PI) !== Math.floor((was - drop) / Math.PI) && s.value > SILENT) {
        contact(p, 'detent', BEAT * s.value, { motion, heard: 'device' });
      }
      const left = sync(p);
      if (on && left !== Infinity) {
        const next = Math.max(0, left - dt);
        p.data.left = next;
        if (Math.ceil(next) !== Math.ceil(left)) {
          p.data.said = String(Math.ceil(next));
          p.el.setAttribute('wound', p.data.said as string);
          if (!next) s.set(0);
        }
      }
      return true;
    },
    angle: (p: Part) => (reduced() ? 0 : p.springs.swing!.value * Math.sin((p.data.phase ?? 0) as number)),
  };
}

/** The spring of a motion. It carries the motion, because a contact is heard for the joint that made it and a part can have two. */
const withContact = (m: Motion, o: Mechanism): SpringDef => ({ ...m.spring, motion: m, ...(o.contact !== undefined && { contact: o.contact }) });

// Marks nested in a turning part are printed on it, so they go round with it. It draws them inside its turn, and they draw nothing of their own.
const CARRIES = '[data-carries]';
let carrying = false;
/** A mark that the part it's on is drawing, which stays out of the way when the engine reaches it. */
export const carried = (p: Part): boolean => !carrying && !!p.el.closest(CARRIES);
/** Says this part carries what's in it, from its `connect`. */
export const carries = (p: Part): void => {
  p.el.toggleAttribute('data-carries', true);
};
/** Draws the marks nested in this part where it is now, from inside its turn, with the origin put back on the device. */
export function carry(s: Sheet, p: Part, d: DeviceInfo): void {
  carrying = true;
  try {
    p.el.querySelectorAll('[d-mark]').forEach(el => {
      const mark = partOf(el);
      if (mark && mark.w && mark.h) mark.def.paint(s, mark, d);
    });
  } finally {
    carrying = false;
  }
}

/**
 * A part carried by another part's joint, as a cam rides a lid. `of`, a selector within the same device,
 * names the one that leads, and the spring goes after its `value`, so it lags and bounces of its own accord. `attr` reads that selector from
 * another attribute, for a part that follows two.
 */
export function follow(o: Mechanism & { name?: string; attr?: string } = {}) {
  const name = o.name ?? 'follow';
  const track = (p: Part) => {
    const of = p.el.getAttribute(o.attr ?? 'of'), lead = of ? p.el.closest('d-device')?.querySelector(of) : null, part = lead ? partOf(lead) : null;
    const value = (part?.def as { value?(q: Part): number } | undefined)?.value;
    if (part && value) p.springs[name]!.set(value(part));
  };
  return {
    springs: { [name]: spring(o) } as Record<string, SpringDef>,
    update: track,
    tick(p: Part) {
      track(p);
      return false;
    },
    value: (p: Part) => clamp(p.springs[name]!.value, 0, 1),
  };
}

/**
 * A part worked by another part's shaft through a rigid linkage, as a needle bar is by a handwheel. `of`, a selector within the same device,
 * names the part that turns, and `angle` is where that shaft has got to, in the same frame and with no give. Draw whatever the linkage does with it.
 * It costs nothing while the shaft is still.
 */
export function driven() {
  const angle = (p: Part) => {
    const of = p.el.getAttribute('of'), lead = of ? p.el.closest('d-device')?.querySelector(of) : null, part = lead ? partOf(lead) : null;
    const turned = (part?.def as { angle?(q: Part): number } | undefined)?.angle;
    return part && turned ? turned(part) : 0;
  };
  return {
    tick(p: Part) {
      const a = angle(p);
      if (a === p.data.driven) return false;
      p.data.driven = a;
      return true;
    },
    angle,
  };
}

// Of its range, how far a part gives against a stop.
const GIVE = { hard: 0.004, soft: 0.02 };
// Of the speed of a part hitting a stop, how much of it can be heard.
const KNOCK = { hard: 1, soft: 0.3 };
// Under this, in ranges a second, a stop is reached and not hit.
const CREEP = 0.25;
// How far a hand in a straight drag can get past a stop, px. Nothing shows where it went, so it can't go far.
const PUSHED = 24;
// Where a part gets to while its hand speeds up or slows down, seconds.
const SMOOTH = 0.05;
// A hand that stopped this long before letting go has stopped, ms.
const STILL = 60;
// Mouse wheel px to the straight-drag px they count as, and to one detent.
const WHEEL = 0.25, CLICK = 60;

/** What a joint is moving. */
interface Track {
  read(p: Part): number;
  write(p: Part, value: number): void;
  reach(p: Part): Reach;
  /** One of these in the units of `read`, for how far the hand leans the part. */
  scale(p: Part): number;
}

interface Drive {
  motion: Motion;
  track: Track;
  /** The spring on the part that this moves. */
  spring: string;
  /** A press: true if the part takes it. */
  accepts?(p: Part, e: PointerEvent): boolean;
  /** Where the press landed, once it's taken. */
  grab(p: Part, e: PointerEvent): void;
  /** How far a pointer event took the hand, in the units of `read`. */
  by(p: Part, e: PointerEvent, dx: number, dy: number): number;
  /** How far a hand can get past a stop, in the units of `read`. */
  past(p: Part): number;
  /** Where a press puts it, if it's not left where it is. */
  seat?(p: Part, e: PointerEvent): number;
  /** Which of the part's leans is this joint's. */
  pull?: string;
  /** What takes the focus, if no input does. */
  focus?(p: Part): HTMLElement;
  /** Radians a second for a value a second. */
  radians?(p: Part): number;
  /** The mouse wheel, px to `read`. Leave it out and the wheel scrolls the page. */
  scroll?(p: Part): number;
  /** Where it goes home to. */
  rest?(p: Part): number;
  /** True to take the movement and not move. */
  hold?(p: Part, by: number): boolean;
  letGo?(p: Part): void;
}

/** How far a part trails a hand on it, in seconds. A finger on glass sees the gap, so it gets almost none. A mouse is further off, and some lag reads as weight. */
export const trail = (mass: number, pointer: string) => (pointer === 'touch' ? 0.01 : Math.min(0.014 + mass * 0.0008, 0.03));

/** Where in `read` the hand on a spring has got to while it's dragging: smooth, where a part with detents jumps between them. */

/** One hand on one joint. No frames are spent unless it's coasting. */
function drive(p: Part, signal: AbortSignal, o: Drive) {
  const { motion: m, track: t } = o, hand = new Hand();
  let stuck = 0, speed = 0, when = 0, frame = 0, scrolled = 0, atStop = false;
  // Nothing hits anything on glass.
  const glass = m.material === 'finger-on-glass';
  const done = { moved: 0 };
  const go = (by: number, past = 0) => {
    if (by * m.ratchet < 0) return;
    const r = { ...t.reach(p), past }, span = r.max - r.min, finite = Number.isFinite(span);
    const value = hand.by(by, r), was = t.read(p);
    t.write(p, value);
    const inside = r.wrap ? hand.at : clamp(hand.at, r.min, r.max), over = hand.at - inside;
    const give = finite && !glass ? GIVE[m.landing] * span : 0;
    const pressed = give && over ? Math.sign(over) * give * (1 - Math.exp(-Math.abs(over) / (give * 4))) : 0;
    // A stiffer detent gives less before it lets go: a rotary switch hardly leans, then snaps.
    lean(p, ((r.step ? HOLD * Math.min(1, (1 - m.strength) / (1 - DETENT)) : 1) * (inside - t.read(p)) + pressed) / t.scale(p), o.pull);
    const stopped = !r.wrap && finite && (value === r.min || value === r.max);
    const ranges = finite ? Math.abs(speed) / span : 0;
    if (stopped && !atStop && ranges > CREEP && !glass && !m.arrives) contact(p, 'stop', Math.min(ranges * 2, 10) * KNOCK[m.landing], { motion: m });
    atStop = stopped;
    if (t.read(p) !== was && !r.step && !glass) contact(p, 'rub', ranges, { motion: m });
  };
  const halt = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    lean(p, 0, o.pull);
  };
  signal.addEventListener('abort', () => cancelAnimationFrame(frame));
  const coast = (from: number) => {
    const radians = o.radians?.(p) ?? 1, slowest = SLOWEST / radians, fastest = FASTEST / radians;
    let v = clamp(from, -fastest, fastest), last = performance.now();
    if (Math.abs(v) < slowest) return;
    const tick = (now: number) => {
      // A frame's time is when it began, which can be before the hand let go.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      v *= Math.exp(-dt / m.coast);
      speed = v;
      go(v * dt);
      frame = Math.abs(v) < slowest || atStop ? 0 : requestAnimationFrame(tick);
      if (!frame) lean(p, 0, o.pull);
    };
    frame = requestAnimationFrame(tick);
  };
  onDrag(p, signal, {
    accepts: o.accepts && (e => o.accepts!(p, e)),
    start(e) {
      halt();
      hand.grab(t.read(p));
      // A detent is felt through the spring, so only what runs freely follows the hand.
      if (!m.strength && !t.reach(p).step) p.springs[o.spring]!.grip(trail(m.mass, e.pointerType));
      o.grab(p, e);
      if (!p.el.querySelector('input')) (o.focus?.(p) ?? p.el).focus({ preventScroll: true });
      // What it takes to start it, in px of hand. More on anything heavy.
      stuck = m.start * 2 * m.mass ** 0.25;
      speed = 0;
      when = e.timeStamp;
      done.moved = 0;
      const seat = o.seat?.(p, e);
      if (seat !== undefined) {
        hand.grab(seat);
        t.write(p, seat);
        stuck = 0;
      }
    },
    move(e, dx, dy) {
      const by = o.by(p, e, dx, dy);
      done.moved += Math.hypot(dx, dy);
      if (stuck > 0 && (stuck -= Math.hypot(dx, dy)) > 0) return;
      if (o.hold?.(p, by)) return;
      const dt = (e.timeStamp - when) / 1000;
      if (dt > 0) speed += (by / dt - speed) * (1 - Math.exp(-dt / SMOOTH));
      when = e.timeStamp;
      go(by, o.past(p));
      const r = t.reach(p);
      p.data[gripping(o.spring)] = r.wrap ? hand.at : clamp(hand.at, r.min, r.max);
    },
    end(e) {
      delete p.data[gripping(o.spring)];
      p.springs[o.spring]!.grip(0);
      o.letGo?.(p);
      const rest = o.rest?.(p);
      if (rest !== undefined) t.write(p, rest);
      lean(p, 0, o.pull);
      hand.grab(t.read(p));
      if (m.coast && e.type === 'pointerup' && e.timeStamp - when < STILL && !reduced()) coast(speed);
    },
  });
  p.el.addEventListener('keydown', () => {
    halt();
    done.moved = 0;
  }, { signal });
  // Only once it has been picked up, or scrolling the page over a panel would catch on every knob.
  if (o.scroll) p.el.addEventListener('wheel', e => {
    const el = p.el.querySelector('input');
    if (!p.el.contains(document.activeElement) || el?.disabled) return;
    e.preventDefault();
    halt();
    const before = t.read(p), { step } = t.reach(p);
    const px = -e.deltaY * (e.deltaMode ? 16 : 1);
    hand.grab(before);
    if (step) {
      scrolled += (px / CLICK) * step;
      const n = Math.trunc(scrolled / step);
      if (n) {
        scrolled -= n * step;
        go(n * step);
      }
    } else {
      scrolled += px * WHEEL * o.scroll!(p);
      go(scrolled);
      if (t.read(p) !== before) scrolled = 0;
    }
    lean(p, 0, o.pull);
  }, { signal, passive: false });
  return done;
}

const everyStep = (m: Mechanism): Detents => (typeof m.detents === 'object' ? m.detents : {});

/** An input of any kind, as a joint sees it. A checkbox is a range from 0 to 1. */
const ticked = (el: HTMLInputElement) => el.type === 'checkbox' || el.type === 'radio';
const inputRange = (el: HTMLInputElement): [number, number] => (ticked(el) ? [0, 1] : limits(el));
const inputValue = (el: HTMLInputElement) => (ticked(el) ? +el.checked : +el.value);
// A real click, because that is what a framework's checkbox is listening for.
let throwing = false;
const inputSet = (el: HTMLInputElement, v: number) => {
  if (!ticked(el)) return setValue(el, v);
  if (el.checked === v >= 0.5) return;
  throwing = true;
  el.click();
  throwing = false;
};
/** How far along an input sits, leaning after the hand. */
export const seatedOn = (p: Part, el: HTMLInputElement) => {
  const [min, max] = inputRange(el);
  return (max > min ? clamp((inputValue(el) - min) / (max - min), 0, 1) : 0) + ((p.data.pull as number | undefined) ?? 0);
};

// Px a press can wander and still be a click.
const CLICK_PX = 3;

/** A click that wasn't a drag does `act`. One that reached a checkbox has already done it. */
function clicks(p: Part, signal: AbortSignal, done: { moved: number }, act: (e: MouseEvent) => void, accepts?: (p: Part, e: PointerEvent) => boolean, range = false) {
  p.el.addEventListener('click', e => {
    if (throwing || accepts?.(p, e as PointerEvent) === false) return;
    const dragged = done.moved > CLICK_PX;
    done.moved = 0;
    if (dragged) e.preventDefault();
    // A checkbox clicks by itself, from the keyboard too. A range never does, so a click on one is a press on the part.
    else if (range || !(e.target instanceof HTMLInputElement) || e.target.type === 'range') act(e);
  }, { signal });
}

const inputTrack = (m: Mechanism, el: (p: Part) => HTMLInputElement, wrap?: Live<boolean>): Track => ({
  read: p => inputValue(el(p)),
  // A disabled input is held where it is by something else, as a screwed-down crown can't be pulled. A hand on it strains and nothing moves.
  write(p, v) {
    if (!el(p).disabled) inputSet(el(p), v);
  },
  reach(p) {
    const e = el(p), [min, max] = inputRange(e), wraps = wrap ? read(wrap, p) : false;
    return { min, max, step: m.detents ? (ticked(e) ? 1 : stepOf(e)) : 0, wrap: wraps };
  },
  scale(p) {
    const [min, max] = inputRange(el(p));
    return max - min;
  },
});

/** Spacing from a count, written onto the input so the keyboard steps with the hand. */
const spaceDetents = (p: Part, m: Mechanism, el: HTMLInputElement) => {
  const n = read(everyStep(m).count ?? 0, p);
  if (!n || ticked(el)) return;
  const [min, max] = limits(el);
  el.step = String((max - min) / Math.max(n - 1, 1));
};

export interface TurnOptions extends Mechanism {
  /** Where it turns, css px from the element's top left. Defaults to its middle. */
  at?: Live<[number, number]>;
  /** Drive this part's input, with `stops.at` the angles at each end of its range. Otherwise its `turn` attribute holds the angle. */
  input?: boolean;
  /** Seen edge on, so it's rolled and not turned around anything. Up and down, or 'x' for a drum on its end. */
  rolled?: boolean | 'x';
  /** The ends meet. */
  wrap?: Live<boolean>;
  /** Px of straight drag across the whole range. */
  travel?: Live<number>;
  /** A click moves it on. */
  click?: boolean;
  /** Degrees between ticks it makes but doesn't sit in. */
  ticks?: Live<number>;
  /** A press that went nowhere, for a ring with switches under it. */
  tap?(p: Part, e: MouseEvent): void;
  /** Only presses this accepts. */
  accepts?(p: Part, e: PointerEvent): boolean;
  /** Something other than an input or attribute. */
  track?: Track & { radians(p: Part): number };
  /** No straight drag from the middle. */
  hubless?: boolean;
  /** Px or radians the hand can get past a stop before the part stops waiting for it. */
  past?: Live<number>;
  /** Moves that don't turn it, in radians. Return true for one taken here, such as a locked handle straining. */
  hold?(p: Part, radians: number): boolean;
  letGo?(p: Part): void;
  /** The spring, and the attribute that holds the angle without an input, for a part that turns more than one way. */
  name?: string;
  /** What each detent passed fires. */
  event?: string;
  /** The keys that turn it, and which way. */
  keys?: Record<string, number>;
}

const RAD = Math.PI / 180;
// Of a part's radius, a press this close to the middle is a straight drag. Up and right turn it on.
const HUB = 0.45;
// There's no turning anything round a pin this close, px.
const NEAREST = 18;
// Inside this many px the turn is geared down to a lever this long, for the sake of a mouse.
const ARM = 36;

/**
 * A part you spin by dragging around its pin, or with the arrow keys. It stays where you took hold of
 * it, and goes round as often as its stops let it. The hand can pass a stop, and the part waits for it
 * to come back. A press on the middle is a straight drag. The part's element is the control. Each detent
 * passed fires a bubbling `detent` event, with the number of steps in `detail`, so a click wheel can
 * scroll a list.
 */
export function turn(o: TurnOptions = {}) {
  const name = o.name ?? 'turn', keys = o.keys ?? { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  const motion = mechanism(o, 'turn', { rolled: !!o.rolled });
  const stops = (p: Part): [number, number] | null => (o.stops?.at ? read(o.stops.at, p) : null);
  const box = (p: Part) => {
    const a = stops(p)!;
    return [a[0] * RAD, a[1] * RAD] as const;
  };
  const sweep = (p: Part) => {
    const [a, b] = box(p);
    return b - a;
  };
  const middle = (p: Part): [number, number] => (o.at ? read(o.at, p) : [p.w / 2, p.h / 2]);
  const notch = (p: Part): number => {
    if (o.ticks) return read(o.ticks, p) * RAD;
    if (!o.detents) return 0;
    if (!o.input) return (read(everyStep(o).every ?? 0, p) as number) * RAD;
    const el = input(p), [min, max] = inputRange(el);
    return ((ticked(el) ? 1 : stepOf(el)) / (max - min)) * sweep(p);
  };
  const attr = (p: Part) => +(p.el.getAttribute(name) ?? 0);
  const attrTrack: Track = {
    read: attr,
    write(p, next) {
      const was = attr(p), step = notch(p);
      if (next === was) return;
      p.el.setAttribute(name, String(next));
      if (step) p.el.dispatchEvent(new CustomEvent(o.event ?? 'detent', { bubbles: true, detail: Math.round((next - was) / step) }));
    },
    reach(p) {
      const s = stops(p);
      return { min: s ? s[0] * RAD : -Infinity, max: s ? s[1] * RAD : Infinity, step: notch(p) };
    },
    scale: () => 1,
  };
  const track = o.track ?? (o.input ? inputTrack(o, input, o.wrap) : attrTrack);
  const radius = (p: Part) => Math.min(p.w, p.h) / 2;
  const travel = (p: Part) => (o.travel ? read(o.travel, p) : o.input ? sweep(p) * ARM : 0);
  const perRadian = (p: Part) => o.track?.radians(p) ?? (o.input ? track.scale(p) / sweep(p) : 1);
  const perPixel = (p: Part) => (o.input ? track.scale(p) / travel(p) : 1 / Math.max(radius(p), ARM));
  const grips = new WeakMap<Part, { k: number; x: number; y: number; arm: number; straight: boolean; last: [number, number]; tall: number }>();
  return {
    motion,
    springs: { [name]: withContact(motion, o) } as Record<string, SpringDef>,
    live: [name, 'style'],
    update(p: Part) {
      const spring = p.springs[name]!;
      spring.notches(notch(p));
      if (o.track) return;
      if (!o.input) return spring.set(attr(p) + ((p.data.pull as number | undefined) ?? 0));
      const [from] = box(p), full = sweep(p), a = from + full * seatedOn(p, input(p));
      // Over the wrap, go on to the nearest matching angle and not back the long way.
      spring.set(o.wrap && read(o.wrap, p) ? a + Math.round((spring.target - a) / full) * full : a);
    },
    connect(p: Part) {
      const ac = new AbortController(), { signal } = ac;
      if (o.input) spaceDetents(p, o, input(p));
      if (!o.input && !o.track) p.el.style.cursor = 'grab';
      const done = drive(p, signal, {
        motion, track, spring: name, accepts: o.accepts, hold: o.hold && ((q, by) => o.hold!(q, by / perRadian(q))), letGo: o.letGo,
        grab(q, e) {
          // On a device set at an angle a round thing is seen as an ellipse, so a hand going round it is measured in the device's own plane.
          const [wide, tall] = squashOn(q.el), r = q.el.getBoundingClientRect(), k = r.width / wide / q.w || 1, [x, y] = middle(q);
          const cx = r.left + x * k * wide, cy = r.top + y * k * tall, hub = Math.max(HUB * Math.min(r.width, r.height) / 2, NEAREST);
          const straight = !!o.rolled || (!o.hubless && Math.hypot(e.clientX - cx, e.clientY - cy) < hub);
          grips.set(q, { k, x: cx, y: cy, arm: Math.max(hub, ARM), straight, last: [e.clientX, e.clientY], tall });
          if (!o.input && !o.track) q.el.style.cursor = 'grabbing';
        },
        by(q, e, dx, dy) {
          const g = grips.get(q)!, [ax, ay] = g.last;
          g.last = [e.clientX, e.clientY];
          if (g.straight) return ((o.rolled === 'x' ? dx : (o.rolled ? 0 : dx) - dy) / g.k) * perPixel(q);
          return swept(ax - g.x, (ay - g.y) / g.tall, e.clientX - g.x, (e.clientY - g.y) / g.tall, g.arm) * perRadian(q);
        },
        past(q) {
          const g = grips.get(q);
          if (o.past !== undefined) return read(o.past, q);
          return g?.straight ? PUSHED * perPixel(q) : Math.PI * perRadian(q);
        },
        radians: q => 1 / perRadian(q),
        scroll: o.track && !o.input ? undefined : perPixel,
      });
      if (!o.input && !o.track) {
        const up = () => (p.el.style.cursor = 'grab');
        for (const n of ['pointerup', 'pointercancel']) p.el.addEventListener(n, up, { signal });
      }
      const by = (k: number) => {
        const r = track.reach(p), next = track.read(p) + k * (r.step || 0.1), wrapped = r.wrap ? next : clamp(next, r.min, r.max);
        track.write(p, o.input && ticked(input(p)) ? 1 - track.read(p) : wrapped);
      };
      // A range stops at its ends, so one whose ends meet is taken over them here.
      if (o.input && o.wrap) p.el.addEventListener('keydown', e => {
        const k = keys[e.key], r = track.reach(p), now = track.read(p);
        if (!k || !read(o.wrap!, p) || !r.step || (k > 0 ? now < r.max : now > r.min)) return;
        e.preventDefault();
        track.write(p, (k > 0 ? r.min : r.max) + k * r.step);
      }, { signal, capture: true });
      // Ahead of any input, which would otherwise step back on its own.
      if (motion.ratchet) p.el.addEventListener('keydown', e => {
        const k = keys[e.key];
        if (k && k * motion.ratchet < 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, { signal, capture: true });
      if (!o.input && !o.track) p.el.addEventListener('keydown', e => {
        const k = keys[e.key];
        if (!k) return;
        e.preventDefault();
        by(k);
      }, { signal });
      if (o.click) clicks(p, signal, done, () => by(1), o.accepts);
      if (o.tap) clicks(p, signal, done, e => o.tap!(p, e), o.accepts);
      return () => ac.abort();
    },
    angle(p: Part) {
      const a = p.springs[name]!.value, s = stops(p);
      if (!s) return a;
      const lo = s[0] * RAD, hi = s[1] * RAD, slack = GIVE[motion.landing] * (hi - lo);
      return o.input ? a : clamp(a, lo - slack, hi + slack);
    },
    carried(p: Part): Carried {
      if (o.rolled) return ATREST;
      const at = p.data[gripping(name)] as number | undefined, [min, max] = o.input ? inputRange(input(p)) : [0, 1];
      const rotate = o.track ? (at ?? o.track.read(p)) / o.track.radians(p) : at === undefined ? this.angle(p) : o.input ? box(p)[0] + (sweep(p) * (at - min)) / (max - min) : at;
      return { ...ATREST, rotate, pin: middle(p) };
    },
    ends(p: Part): [number, number] | null {
      return stops(p) ? [...box(p)] : null;
    },
    /** Where the pin is, css px from the top left of the part. */
    pin: middle,
    /** The group the part draws in, with its origin on the pin. */
    place(p: Part): GroupOptions {
      const [x, y] = middle(p);
      return { at: [p.x + x, p.y + y], rotate: o.rolled ? this.angle(p) : this.carried(p).rotate, carried: true };
    },
  };
}

export interface PressOptions extends Mechanism {
  /** Stays down while its input is checked, and the input takes the clicks. */
  latch?: boolean;
  /** What holds a latching key down, for one with no input to ask. A key like that still moves under the finger. On a key that doesn't latch, what holds it
   * in for a while, as a release is while what it lets go is turned: it stays in while this says so, and sounds as it always does. */
  held?: (p: Part) => boolean;
  /** A push-push cam, as in a retractable pen: each press goes to the bottom and swaps it between out and caught, and caught sits at this share of its travel. `aria-pressed` on what's pressed says which it's in. */
  catches?: number;
  /** The buttons inside that press it, if it isn't a button itself. */
  of?: string;
  /** It rocks: where each of those buttons tips it. Its springs are then `x` and `y`, and `z` for any that pushes it straight in as `[0, 0, 1]`. */
  rocks?: ([number, number] | [number, number, number])[];
  /** The spring it moves, for a part with several keys. */
  name?: string;
  /** How much of its travel a finger resting on it takes up, as a share. */
  rests?: number;
  down?(p: Part): void;
  up?(p: Part): void;
}

// Ms a two-stage press stays all the way in once it gets there, and that a click without a hand holds its first stage.
const STAGE_FIRED = 120, STAGE_HELD = 480;
// A pen pressing harder than this goes past the first stage while it's held.
const STAGE_FORCE = 0.6;
// Keys a held hand can slide onto, and how each one takes it: whatever press made them, as a keyboard's naturals and sharps are two forms.
const gliders = new WeakMap<HTMLElement, (pointer: number) => void>();
// What a script holding a key down sends it, so the key takes it as it would a hand: the same stage, bank and latch.
const HELD = 'd-held';

/**
 * Holds a key down from a script, or lets it up, as a hand would: the computer's keyboard or a gamepad playing the keys drawn on the page. The key goes
 * down and makes its sound, and nothing else is told, so what the key does stays with whoever is holding it. A latching key goes in or out on the way down.
 */
export function hold(el: Element, on: boolean): void {
  el.dispatchEvent(new CustomEvent(HELD, { detail: on }));
}
const scripted = (el: HTMLElement, fn: (on: boolean) => void, signal: AbortSignal) =>
  el.addEventListener(HELD, e => fn((e as CustomEvent<boolean>).detail), { signal });

/**
 * A part that goes down while held, by pointer or keyboard. `value(p)` runs 0 to 1. The part's element is the button.
 * `stage` on it, a share of its travel, makes it two-stage, as a camera's shutter: held, it stops there, at a firmer step, and letting go takes it the
 * rest of the way before it comes back up. Sliding off, or losing focus, lets it up from the step without going on. A pen pressing hard goes on while
 * it's held. It fires a bubbling `stage` with `detail.stage` 1 at the step, 2 all the way in and 0 back out.
 * `bank` on it names a bank of keys in its device: one that latches lets the rest out as it goes in, and one that doesn't lets them all out.
 * `run` on it names a run of keys in its device, as a keyboard: a hand held down slides from one to the next, by mouse, pen or finger, and the next
 * goes down before the last comes up. The key it leaves fires a bubbling `run` with `detail.to`, the key it went on to, or null off the run.
 */
export function press(o: PressOptions = {}) {
  const { name = 'press' } = o, motion = mechanism({ return: RETURN, ...o }, 'press', { latch: o.latch }), feel = withContact(motion, o);
  const latched = o.held ?? ((p: Part) => input(p).checked), kept = new WeakSet<Part>();
  // A finger resting on a key takes up a little of its travel before it's pressed.
  const resting = new WeakSet<Part>();
  const caught = (p: Part) => !!o.catches && (o.of ? p.el.querySelector(o.of) : p.el)?.getAttribute('aria-pressed') === 'true';
  const pressing = new WeakSet<Part>();
  const rest = (p: Part) => (caught(p) ? o.catches! : o.rests && resting.has(p) ? o.rests : 0);
  const set = (p: Part, on: boolean, i: number) => {
    if (o.rocks) {
      const [x, y, z = 0] = o.rocks[i] ?? [0, 0];
      p.springs.x!.set(on ? x : 0);
      p.springs.y!.set(on ? y : 0);
      p.springs.z?.set(on ? z : 0);
    } else p.springs[name]!.set(on ? 1 : rest(p));
    (on ? o.down : o.up)?.(p);
  };
  // Two stages: where it is, 0 out, 1 at the step and 2 all the way in, and the timer that brings it on from there.
  const staged = (p: Part, step: number, signal: AbortSignal) => {
    const el = p.el;
    let at = 0, timer = 0;
    const go = (to: 0 | 1 | 2) => {
      clearTimeout(timer);
      if (to === at) return;
      const was = at;
      at = to;
      p.springs[name]!.set(to === 2 ? 1 : to === 1 ? step : rest(p));
      if (to && !was) o.down?.(p);
      if (!to) o.up?.(p);
      el.dispatchEvent(new CustomEvent('stage', { bubbles: true, detail: { stage: to } }));
    };
    const fire = () => {
      go(2);
      timer = window.setTimeout(() => go(0), STAGE_FIRED);
    };
    const off = () => !(el as HTMLButtonElement).disabled && !el.querySelector('input')?.disabled;
    el.addEventListener('pointerdown', e => {
      if (!e.button && off()) go(1);
    }, { signal });
    el.addEventListener('pointermove', e => {
      if (at === 1 && e.pointerType === 'pen' && e.pressure > STAGE_FORCE) go(2);
    }, { signal });
    el.addEventListener('pointerup', () => (at === 1 ? fire() : go(0)), { signal });
    for (const n of ['pointercancel', 'pointerleave', 'blur'] as const) el.addEventListener(n, () => at === 1 && go(0), { signal });
    el.addEventListener('keydown', e => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && off()) go(1);
    }, { signal });
    el.addEventListener('keyup', e => {
      if ((e.key === ' ' || e.key === 'Enter') && at === 1) fire();
    }, { signal });
    scripted(el, on => (on ? off() && go(1) : at === 1 ? fire() : go(0)), signal);
    // A click with no hand or key behind it, as from a screen reader, holds the step a moment and goes on.
    el.addEventListener('click', e => {
      if (e.detail || at || !off()) return;
      go(1);
      timer = window.setTimeout(fire, STAGE_HELD);
    }, { signal });
  };
  return {
    motion,
    springs: (o.rocks ? {
      x: { ...feel, through: true, contact: 'press' }, y: { ...feel, through: true, contact: 'press' },
      ...(o.rocks.some(r => r.length > 2) && { z: { ...feel, contact: 'press' } }),
    } : { [name]: feel }) as Record<string, SpringDef>,
    update(p: Part) {
      if (o.latch) p.springs[name]!.set(latched(p) ? 1 : rest(p));
      else if (o.held) {
        // Only as it starts or stops being held, so a finger on it isn't undone by anything else changing.
        const on = o.held(p);
        if (on === kept.has(p)) return;
        if (on) kept.add(p);
        else kept.delete(p);
        p.springs[name]!.set(on ? 1 : rest(p));
      }
      else if (o.catches && !pressing.has(p)) p.springs[name]!.set(rest(p));
    },
    connect(p: Part) {
      const ac = new AbortController(), { signal } = ac;
      if (o.rests) {
        const rested = (e: PointerEvent, on: boolean) => {
          if (e.pointerType !== 'mouse' || (p.el as HTMLButtonElement).disabled || p.el.querySelector('input')?.disabled) return;
          if (on) resting.add(p);
          else resting.delete(p);
          if (p.springs[name]!.target < 1) p.springs[name]!.set(rest(p));
        };
        p.el.addEventListener('pointerenter', e => rested(e, true), { signal });
        p.el.addEventListener('pointerleave', e => rested(e, false), { signal });
      }
      // A bank of keys, as on a tape deck: one going in lets the others out, and one that doesn't stay in lets them all out.
      const bank = p.el.getAttribute('bank');
      if (bank) {
        const others = () => [...(p.el.closest('d-device') ?? document).querySelectorAll<HTMLElement>(`[bank="${CSS.escape(bank)}"]`)].filter(k => k !== p.el);
        const out = () => {
          for (const k of others()) {
            const i = k.querySelector('input');
            if (!i?.checked) continue;
            i.checked = false;
            i.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };
        const own = o.latch ? input(p) : null;
        if (own) own.addEventListener('change', () => own.checked && out(), { signal });
        else p.el.addEventListener('pointerdown', e => !e.button && out(), { signal });
        if (!own) p.el.addEventListener('keydown', e => (e.key === ' ' || e.key === 'Enter') && out(), { signal });
        if (!own) scripted(p.el, on => on && out(), signal);
      }
      if (o.latch && input(p)) {
        scripted(p.el, on => on && !input(p).disabled && input(p).click(), signal);
        return () => ac.abort();
      }
      const step = parseFloat(p.el.getAttribute('stage') ?? '');
      if (!o.rocks && !o.of && step > 0 && step < 1) {
        staged(p, step, signal);
        return () => ac.abort();
      }
      const run = !o.rocks && !o.of ? p.el.getAttribute('run') : null;
      (o.of ? [...p.el.querySelectorAll<HTMLElement>(o.of)] : [p.el]).forEach((el, i) => {
        // Held long, it says so once, and a key that repeats says so again and again until it's let go.
        const long = parseFloat(el.getAttribute('long') ?? ''), [first = NaN, every = first] = (el.getAttribute('repeat') ?? '').trim().split(/\s+/).map(Number);
        let timers: number[] = [], longed = false;
        const tell = (name: string) => el.dispatchEvent(new CustomEvent(name, { bubbles: true }));
        const time = (on: boolean) => {
          if (on === timers.length > 0) return;
          timers.forEach(clearTimeout);
          timers = [];
          if (!on) return;
          longed = false;
          if (long > 0) timers.push(window.setTimeout(() => {
            longed = true;
            tell('long');
          }, long));
          if (first > 0) {
            const again = () => {
              tell('repeat');
              timers.push(window.setTimeout(again, Math.max(every, 16)));
            };
            timers.push(window.setTimeout(again, first));
          }
          if (!timers.length) timers.push(0);
        };
        signal.addEventListener('abort', () => time(false));
        // A key held long has done what holding it does, so letting it go isn't a press as well.
        if (long > 0) el.addEventListener('click', e => {
          if (!longed) return;
          longed = false;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, { signal, capture: true });
        const down = () => {
          if ((el as HTMLButtonElement).disabled || el.querySelector('input')?.disabled) return;
          pressing.add(p);
          set(p, true, i);
          time(true);
        };
        const up = () => {
          time(false);
          // The cam moves on at the bottom of the stroke, so only a press that was down swaps it.
          if (o.catches && pressing.delete(p)) el.setAttribute('aria-pressed', String(!caught(p)));
          set(p, (!!o.latch || !!o.held) && latched(p), i);
        };
        el.addEventListener('pointerdown', e => {
          if (!e.button) down();
        }, { signal });
        for (const n of ['pointerup', 'pointercancel', 'blur']) el.addEventListener(n, up, { signal });
        // A pointer pressing it can slide off, and one only passing over leaves a key held from the keyboard alone.
        el.addEventListener('pointerleave', e => {
          if (e.buttons) up();
        }, { signal });
        // Only the key that pressed it lets it up: another finger coming off another key doesn't.
        el.addEventListener('keyup', e => {
          if (e.key === ' ' || e.key === 'Enter') up();
        }, { signal });
        el.addEventListener('keydown', e => {
          if (e.key === ' ' || e.key === 'Enter') down();
        }, { signal });
        scripted(el, on => (on ? down() : up()), signal);
        if (run === null) {
          el.addEventListener('pointerleave', up, { signal });
          return;
        }
        // A key in a run: a held hand slides on to the next, which goes down before this one comes up.
        const hands = new Set<number>();
        gliders.set(el, pointer => {
          if ((el as HTMLButtonElement).disabled) return;
          hands.add(pointer);
          down();
        });
        el.addEventListener('pointerdown', e => {
          if (e.button) return;
          hands.add(e.pointerId);
          // A finger is held by what it lands on; let it go, so it can find the next key.
          if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        }, { signal });
        for (const n of ['pointerup', 'pointercancel'] as const) el.addEventListener(n, e => hands.delete(e.pointerId), { signal });
        el.addEventListener('pointerleave', e => {
          if (!hands.delete(e.pointerId)) return up();
          // Where the hand is, not what the event says it went to, which a finger doesn't always say.
          const next = (e.relatedTarget as Element | null ?? document.elementFromPoint(e.clientX, e.clientY))?.closest<HTMLElement>(`[run="${CSS.escape(run)}"]`);
          const to = next && next !== el && next.closest('d-device') === el.closest('d-device') && e.buttons ? next : null;
          if (to) gliders.get(to)?.(e.pointerId);
          up();
          el.dispatchEvent(new CustomEvent('run', { bubbles: true, detail: { to } }));
        }, { signal });
      });
      return () => ac.abort();
    },
    value: (p: Part) => clamp(p.springs[name]!.value, 0, 1),
  };
}

/** Several joints in one part: a stick's two axes, or a ring round a button. */
export function together(...joints: { motion?: Motion; springs: Record<string, SpringDef>; update?(p: Part): void; tick?(p: Part, frame: number): boolean; connect?(p: Part): void | (() => void); carried?(p: Part): Carried }[]) {
  const ticks = joints.filter(j => j.tick);
  return {
    // What keeps going of its own accord keeps going for all of them, and what doesn't costs nothing.
    ...(ticks.length && { tick: (p: Part, frame: number) => ticks.reduce((going, j) => j.tick!(p, frame) || going, false) }),
    motion: joints.find(j => j.motion)?.motion,
    springs: Object.assign({}, ...joints.map(j => j.springs)) as Record<string, SpringDef>,
    update(p: Part) {
      for (const j of joints) j.update?.(p);
    },
    connect(p: Part) {
      const off = joints.map(j => j.connect?.(p));
      return () => off.forEach(f => f?.());
    },
    carried: (p: Part) => joints.reduce<Carried>((sum, j) => {
      const c = j.carried?.(p) ?? ATREST;
      return { x: sum.x + c.x, y: sum.y + c.y, rotate: sum.rotate + c.rotate, pin: c.pin[0] || c.pin[1] ? c.pin : sum.pin };
    }, ATREST),
  };
}

export interface ThreadOptions extends Mechanism {
  /** Mm it goes in for each turn. */
  pitch: Live<number>;
  /** Turns from catching the thread to screwed home. */
  turns: Live<number>;
  /** The checkbox, by its order among the part's inputs, ticked while it's on the thread. Ticking it screws it home and clearing it lets it off. */
  input: Live<number>;
  /** Which way screws it on: 1 the way the turn it's on counts up. */
  on?: 1 | -1;
  /** Whether a free thread catches as it's turned on. A crown has to be pushed in for it to. Always, without it. */
  catches?(p: Part): boolean;
  /** The inputs it holds while it's on, by their order, as a screwed-down crown can't be pulled out. */
  locks?: Live<number[]>;
  name?: string;
}

/**
 * A thread a part screws on and off, as a lid or a screw-down crown. It rides on the part's `turn`: put its `hold`
 * in that turn's, and the turning goes into the thread while it's on, and to the turn once it comes off.
 * Its spring is how far in it is, in turns, and `angle` what that turned it by, to add to the turn's own.
 * It fires a bubbling `change` from its checkbox when it catches or comes off.
 */
export function thread(o: ThreadOptions) {
  const name = o.name ?? 'thread', on = o.on ?? 1, motion = mechanism({ material: 'steel-on-steel', ...o });
  const box = (p: Part) => p.el.querySelectorAll('input')[read(o.input, p)]!;
  const turns = (p: Part) => read(o.turns, p);
  const depth = (p: Part) => (p.data[name] as number | undefined) ?? (box(p).checked ? turns(p) : 0);
  const sync = (p: Part) => {
    const els = p.el.querySelectorAll('input'), held = box(p).checked;
    for (const i of o.locks ? read(o.locks, p) : []) if (els[i]) els[i].disabled = held;
  };
  // Its own ticks, which the checkbox's listener mustn't take for a hand on it.
  let ticking = false;
  const tick = (p: Part, checked: boolean) => {
    const el = box(p);
    if (el.checked === checked) return;
    el.checked = checked;
    ticking = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    ticking = false;
  };
  return {
    motion,
    springs: { [name]: withContact(motion, o) } as Record<string, SpringDef>,
    update(p: Part) {
      p.springs[name]!.set(depth(p));
      sync(p);
    },
    connect(p: Part) {
      const ac = new AbortController();
      // A hand screws it by turning it, so only the keyboard ticks it.
      box(p).addEventListener('click', e => {
        if (e.detail) e.preventDefault();
      }, { signal: ac.signal });
      box(p).addEventListener('change', () => {
        if (ticking) return;
        p.data[name] = box(p).checked ? turns(p) : 0;
        p.def.update?.(p);
      }, { signal: ac.signal });
      sync(p);
      return () => ac.abort();
    },
    /** For the turn's `hold`: takes the turning while the thread is on, or catches it. */
    hold(p: Part, radians: number): boolean {
      const by = (radians * on) / (2 * Math.PI), was = depth(p), all = turns(p);
      if (!box(p).checked && (by <= 0 || !(o.catches?.(p) ?? true))) return false;
      const next = clamp(was + by, 0, all);
      if (next === was) return true;
      p.data[name] = next;
      if (next === all && by > 0) contact(p, 'stop', Math.min(Math.abs(by) * 20, 10) * KNOCK[motion.landing], { motion });
      tick(p, next > 0);
      p.def.update?.(p);
      return true;
    },
    /** 0 off the thread to 1 screwed home. */
    value: (p: Part) => clamp(p.springs[name]!.value / (turns(p) || 1), 0, 1),
    /** Mm it has gone in. */
    depth: (p: Part) => Math.max(p.springs[name]!.value, 0) * read(o.pitch, p),
    /** Radians the thread has turned it, the way the turn counts. */
    angle: (p: Part) => p.springs[name]!.value * 2 * Math.PI * on,
  };
}

interface Run extends Mechanism {
  joint: 'slide' | 'hinge';
  /** The spring it moves, which is also what a part reads. */
  name: string;
  /** What that spring runs over, end to end. */
  range: [number, number];
  /** Which of the part's inputs it drives, in place of `track`. */
  input?: number;
  track?: Track;
  axis?: Live<'x' | 'y'>;
  /** Mm of hand from end to end. */
  travel: Live<number>;
  touch?: boolean;
  seat?: number;
  home?: number;
  catches?: number;
  click?: boolean;
  jump?: Live<boolean>;
  /** No mouse wheel, whatever else is true of it. */
  noWheel?: boolean;
  accepts?(p: Part, e: PointerEvent): boolean;
  /** The pin, for a hand going round it, css px from the top left. With the radians from end to end. */
  pin?: { at: Live<[number, number]>; sweep: Live<number> };
  /** Sets up the part's button, if it has one and no input. */
  dress?(p: Part, signal: AbortSignal): void;
}

/** A hand along a straight run. Slides and hinges differ in how they're drawn, not in how they're held. */
function run(o: Run) {
  const motion = mechanism(o, o.joint, { seats: !!o.touch || o.seat !== undefined }), { name } = o, [lo, hi] = o.range, pull = `pull:${name}`;
  const el = (p: Part) => p.el.querySelectorAll('input')[o.input ?? 0]!;
  const track = o.track ?? inputTrack(o, el);
  const across = (p: Part) => (o.axis ? read(o.axis, p) : 'x') === 'x';
  const perPixel = (p: Part) => track.scale(p) / (read(o.travel, p) * MM);
  const span = (p: Part) => {
    const { min, max } = track.reach(p);
    return [min, max - min] as const;
  };
  const grips = new WeakMap<Part, { k: number; x: number; y: number; last: [number, number] }>();
  return {
    motion,
    springs: { [name]: withContact(motion, o) } as Record<string, SpringDef>,
    update(p: Part) {
      const s = p.springs[name]!, [min, size] = span(p), { step } = track.reach(p);
      s.notches(step && size / step > 1.5 ? (step / size) * (hi - lo) : 0);
      s.set(lo + (hi - lo) * ((track.read(p) - min) / size + ((p.data[pull] as number | undefined) ?? 0)));
    },
    ends: (): [number, number] => [lo, hi],
    carried(p: Part): Carried {
      const at = p.data[gripping(name)] as number | undefined, [min, size] = at === undefined ? [0, 1] : span(p);
      const t = at === undefined ? clamp((p.springs[name]!.value - lo) / (hi - lo), 0, 1) : (at - min) / size;
      if (o.pin) return { ...ATREST, rotate: t * read(o.pin.sweep, p), pin: read(o.pin.at, p) };
      if (o.joint === 'hinge') return ATREST;
      const go = read(o.travel, p) * MM * t;
      return { ...ATREST, x: across(p) ? go : 0, y: across(p) ? 0 : go };
    },
    connect(p: Part) {
      const ac = new AbortController(), { signal } = ac;
      if (o.input !== undefined) spaceDetents(p, o, el(p));
      o.dress?.(p, signal);
      const atPointer = (e: MouseEvent) => {
        const r = p.el.getBoundingClientRect(), [min, size] = span(p);
        const t = clamp(across(p) ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height, 0, 1);
        return min + (read(o.travel, p) < 0 ? 1 - t : t) * size;
      };
      const caught = () => {
        const [min, size] = span(p);
        return o.catches !== undefined && (track.read(p) - min) / size >= o.catches;
      };
      const home = () => {
        const [min, size] = span(p);
        return caught() ? min + size : min + (o.home ?? 0) * size;
      };
      const done = drive(p, signal, {
        motion, track, spring: name, pull, accepts: o.accepts,
        focus: q => q.el.querySelector('button') ?? q.el,
        grab(q, e) {
          // On a device set at an angle a move along the track reaches the screen shorter than it is.
          const [wide, tall] = squashOn(q.el), r = q.el.getBoundingClientRect(), k = r.width / wide / q.w || 1, [x, y] = o.pin ? read(o.pin.at, q) : [0, 0];
          grips.set(q, { k: k * (across(q) ? wide : tall), x: r.left + x * k, y: r.top + y * k, last: [e.clientX, e.clientY] });
        },
        by(q, e, dx, dy) {
          const g = grips.get(q)!, [ax, ay] = g.last;
          g.last = [e.clientX, e.clientY];
          if (o.pin) return (swept(ax - g.x, ay - g.y, e.clientX - g.x, e.clientY - g.y, ARM) / read(o.pin.sweep, q)) * track.scale(q);
          return ((across(q) ? dx : dy) / g.k) * perPixel(q);
        },
        seat: o.touch ? (_, e) => atPointer(e) : o.seat === undefined ? undefined : q => {
          const [min, size] = span(q);
          return min + o.seat! * size;
        },
        past: q => (o.touch ? Infinity : PUSHED * Math.abs(perPixel(q))),
        hold: o.catches === undefined ? undefined : (_, by) => by < 0 && caught(),
        radians: q => 1 / (Math.abs(perPixel(q)) * ARM),
        scroll: o.return || o.touch || o.noWheel ? undefined : q => Math.abs(perPixel(q)),
        rest: o.return ? home : undefined,
      });
      if (o.return && o.input !== undefined) el(p).addEventListener('keyup', () => track.write(p, home()), { signal });
      if (o.catches !== undefined && o.input !== undefined) el(p).addEventListener('keydown', e => {
        if (caught() && e.key !== 'Tab') e.preventDefault();
      }, { signal });
      if (o.click) clicks(p, signal, done, e => {
        const [min, size] = span(p);
        if (o.input === undefined || ticked(el(p))) track.write(p, track.read(p) < min + size / 2 ? min + size : min);
        else track.write(p, atPointer(e));
      }, o.accepts);
      if (o.jump && read(o.jump, p)) clicks(p, signal, done, e => track.write(p, atPointer(e)), o.accepts, true);
      return () => ac.abort();
    },
  };
}

// The button a slide or hinge moves and answers on. Without one it still draws, and just can't be worked.
const button = (p: Part) => p.el.querySelector('button');
const fill = (p: Part, css: string) => {
  const b = button(p);
  if (!b) return;
  p.el.style.pointerEvents = 'none';
  b.style.cssText = `position:absolute;inset:0;appearance:none;background:none;border:0;padding:0;outline:none;pointer-events:auto;${css}`;
};

// How hard a slide catches on each of its marks, in detents a second.
const MARK = 15;

export interface SlideOptions extends Mechanism {
  axis?: Live<'x' | 'y'>;
  /** How far it runs, mm. Negative runs the other way, so a part with its top end up gives a negative `y`. */
  travel: Live<number>;
  /** Drive one of the part's inputs, by its order inside the part. Otherwise a `slide` attribute holds where it is from 0 to 1, and a button that fills the part moves with it. */
  input?: number;
  /** The spring it moves, for a part with two. */
  name?: string;
  /** It goes where the finger is, and doesn't wait to be dragged. */
  touch?: boolean;
  /** Where a press puts it, 0 to 1. */
  seat?: number;
  /** Where a `return` takes it, 0 to 1. */
  home?: number;
  /** A pawl: past this of its run it can't come back, and let go it runs on to the end and stays. Setting its input back resets it. */
  catches?: number;
  /** A click runs it to the other end, or to the place clicked if it's a range. */
  click?: boolean;
  /** A click on its input, which covers it, goes to the place clicked. A hardware slider doesn't, and a seek bar has to. */
  jump?: Live<boolean>;
  /** Whether a press is on the thing itself, for a part that doesn't fill its box. */
  accepts?(p: Part, e: PointerEvent): boolean;
  /** Where it catches, as shares of its travel from 0 to 1, for a scale that isn't even. Its input holds which one, counted from its `min`. A hand follows freely, each one passed clicks, and letting go seats it in the nearest. */
  marks?: Live<number[]>;
}

/** A part you push along a track. The spring runs 0 to 1. */
export function slide(o: SlideOptions) {
  const { axis = 'x', name = 'slide' } = o, bound = o.input !== undefined;
  const moved = new WeakMap<Part, number>();
  const spot = (p: Part) => +(p.el.getAttribute('slide') ?? 0);
  const track: Track = {
    read: spot,
    write(p, v) {
      p.el.setAttribute('slide', String(v));
      button(p)?.setAttribute('aria-valuenow', String(v));
    },
    reach(p) {
      const n = read(everyStep(o).count ?? 0, p), every = read(everyStep(o).every ?? 0, p);
      return { min: 0, max: 1, step: !o.detents ? 0 : n > 1 ? 1 / (n - 1) : every / Math.abs(read(o.travel, p)) };
    },
    scale: () => 1,
  };
  const held = (p: Part) => p.el.querySelectorAll('input')[o.input ?? 0]!;
  const marked: Track | undefined = o.marks && {
    read: p => read(o.marks!, p)[held(p).valueAsNumber - limits(held(p))[0]] ?? 0,
    write(p, v) {
      const marks = read(o.marks!, p), to = marks.reduce((best, m, i) => (Math.abs(m - v) < Math.abs(marks[best]! - v) ? i : best), 0) + limits(held(p))[0];
      if (to === held(p).valueAsNumber) return;
      setValue(held(p), to);
      contact(p, 'detent', MARK);
    },
    reach: () => ({ min: 0, max: 1, step: 0 }),
    scale: () => 1,
  };
  const joint = run({
    ...o, joint: 'slide', name, axis, range: [0, 1], click: o.click ?? !bound, ...(marked && { track: marked }), ...(!bound && {
      track,
      dress(p, signal) {
        const b = button(p);
        if (!b) return;
        fill(p, 'cursor:grab');
        b.setAttribute('role', 'slider');
        b.setAttribute('aria-valuemin', '0');
        b.setAttribute('aria-valuemax', '1');
        b.setAttribute('aria-valuenow', p.el.getAttribute('slide') ?? '0');
        b.addEventListener('keydown', e => {
          const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!k) return;
          e.preventDefault();
          track.write(p, clamp(spot(p) + k * (track.reach(p).step || 0.1), 0, 1));
        }, { signal });
      },
    }),
  });
  // It catches on the next mark, so it doesn't run on past them when it's let go.
  if (marked) joint.motion.coast = 0;
  return {
    ...joint,
    // The button's own writes must not cost a layout on every frame of the run.
    ...(!bound && { live: ['slide', 'style', 'aria-valuenow'] }),
    value: (p: Part) => clamp(p.springs[name]!.value, 0, 1),
    /** The group the part draws in, with its origin on the part's top left: where its joint carries it, so the maker and the player have it in one place. */
    place(p: Part): GroupOptions {
      const { x: dx, y: dy } = joint.carried(p), go = dx + dy;
      if (moved.get(p) !== go) {
        moved.set(p, go);
        const b = button(p);
        if (b) b.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      return { at: [p.x + dx, p.y + dy], carried: true };
    },
  };
}

export interface HingeOptions extends Mechanism {
  /** The pin, css px from the top left, or worked out from the part. A hand goes round it. Without one, a drag along `axis` throws it. */
  at?: Live<[number, number]>;
  /** Drive the part's checkbox. Otherwise an `open` attribute holds it, and a button that fills the part turns with it. */
  input?: boolean;
  axis?: Live<'x' | 'y'>;
  /** Mm of hand from one end to the other. Negative the other way. */
  travel?: Live<number>;
  /** Only presses this accepts. */
  accepts?(p: Part, e: PointerEvent): boolean;
}

/**
 * A part that throws between two ends and stays at the one you left it. The spring runs -1 to 1, and
 * `stops.at` is the degrees it's drawn at, each way. It goes over the crest and not before. A click throws it.
 */
export function hinge(o: HingeOptions = {}) {
  const ends = (p: Part) => read(o.stops?.at ?? [0, 90], p).map(a => a * RAD) as [number, number];
  const pin = (p: Part) => (o.at ? read(o.at, p) : [0, 0] as [number, number]);
  const turned = new WeakMap<Part, number>();
  const track: Track = {
    read: p => +p.el.hasAttribute('open'),
    write(p, v) {
      const open = p.el.toggleAttribute('open', v >= 0.5);
      button(p)?.setAttribute('aria-pressed', String(open));
    },
    reach: () => ({ min: 0, max: 1, step: 1 }),
    scale: () => 1,
  };
  const joint = run({
    detents: true, contact: 'toggle', travel: 10, ...o, joint: 'hinge', name: 'hinge', range: [-1, 1], input: o.input ? 0 : undefined, click: true, noWheel: true,
    ...(o.at && {
      pin: {
        at: o.at,
        sweep: (p: Part) => {
          const [closed, open] = ends(p);
          return open - closed;
        },
      },
    }),
    ...(!o.input && {
      track,
      dress(p) {
        fill(p, 'cursor:pointer');
        button(p)?.setAttribute('aria-pressed', String(p.el.hasAttribute('open')));
      },
    }),
  });
  return {
    ...joint,
    // The button's own writes must not cost a layout on every frame of the swing.
    ...(!o.input && { live: ['open', 'style', 'aria-pressed'] }),
    /** 0 shut, 1 open. */
    value: (p: Part) => clamp((p.springs.hinge!.value + 1) / 2, 0, 1),
    /** The group the part draws in, with its origin on the pin. */
    place(p: Part): GroupOptions {
      const [closed, open] = ends(p), rotate = closed + (open - closed) * clamp((p.springs.hinge!.value + 1) / 2, 0, 1), [x, y] = pin(p);
      if (turned.get(p) !== rotate) {
        turned.set(p, rotate);
        const b = button(p)?.style;
        if (b) {
          b.transformOrigin = `${x}px ${y}px`;
          b.transform = `rotate(${rotate - closed}rad)`;
        }
      }
      return { at: [p.x + x, p.y + y], rotate, carried: true };
    },
  };
}

/** A socket that things come out of and go back into. */
export interface PlugOptions {
  /** The way it comes out. */
  axis?: 'x' | 'y';
  /** Mm it stays on its rails, signed the way out. Past that it's loose. */
  run?: number;
  /** Degrees it turns on its seat to come free, signed the way it turns off, for a thing that comes out toward you, as a lens off a bayonet. In place of rails.
   * It turns, and comes off, only while `release` is in or once it's already turned off its lock; otherwise what's on it has the hand. Back in its seat, it
   * sits turned until a hand turns it home. */
  twist?: number;
  /** What has to be in before it turns, as a lens's release button. A click keeps it in a few seconds, and a hand on the thing keeps it in until it lets go.
   * It says so with `aria-pressed`. */
  release?: HTMLElement;
  /** Mm from the way in that a loose thing is caught. */
  near?: number;
  /** What it sits in. While it's in, it's drawn there as part of the body, so it turns and lights with it. */
  seat: HTMLElement;
}

// Mm between the body and its shelf, and between the places on it.
const SHELF_GAP = 8;
// Seconds a click keeps a release in, and degrees short of home that a twisted thing locks.
const RELEASE_HOLD = 4, LOCKS = 2;
// Mm a locked thing gives on its rails before what holds it stops it.
const LOCKED_GIVE = 0.4;

interface Shelved {
  el: HTMLElement;
  /** Where it lies on the shelf, mm from where it sits when seated, or null while it has no place. */
  place: [number, number] | null;
  /** Whether it's on the shelf or on its way there, so it moves when the places do. */
  out(): boolean;
  /** When it came out, which keeps its place on the shelf while others come and go. */
  since: number;
  rest(): void;
}

/** One shelf to a body, shared by everything that comes out of it. */
const shelves = new WeakMap<HTMLElement, { things: Shelved[]; places: Map<Shelved, HTMLElement>; lay(): void }>();

/** Whether the window stands taller than it's wide, where a shelf beside a body would leave the two of them shown small. */
const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;

/**
 * Flat places beside a body for what comes out of it, one for each thing that's out: down a column on its right, or along a row under
 * it in a window taller than it's wide, which is where the room is. The body keeps room for them as a margin, so whatever frames it
 * frames them together. They're in the body's own mm, so they're as big as it's shown.
 */
function shelfOf(body: HTMLElement) {
  const had = shelves.get(body);
  if (had) return had;
  const things: Shelved[] = [], places = new Map<Shelved, HTMLElement>();
  const lay = () => {
    const outs = things.filter(t => t.out()).sort((a, b) => a.since - b.since), gap = SHELF_GAP * MM, W = body.offsetWidth, H = body.offsetHeight;
    const under = !!portrait?.matches;
    const keep = `${Math.max(0, ...things.map(t => under ? t.el.offsetHeight : t.el.offsetWidth)) + gap * 2}px`;
    const [right, bottom] = under ? ['', keep] : [keep, ''];
    if (body.style.marginRight !== right || body.style.marginBottom !== bottom) {
      body.style.marginRight = right;
      body.style.marginBottom = bottom;
      rescale(body);
    }
    for (const [t, p] of places) if (!outs.includes(t)) {
      p.remove();
      places.delete(t);
    }
    // The last out lies on top.
    for (const t of things) t.el.style.zIndex = outs.includes(t) ? String(outs.indexOf(t) + 1) : '';
    const k = body.getBoundingClientRect().width / W || 1;
    // From the top, or the left under it, in the order they came out, and fanned over each other when there are more than the body is long.
    const room = outs.length > 1 ? ((under ? W - outs.at(-1)!.el.offsetWidth : H - outs.at(-1)!.el.offsetHeight)) / (outs.length - 1) : 0;
    let along = 0;
    for (const t of outs) {
      const w = t.el.offsetWidth, h = t.el.offsetHeight;
      let p = places.get(t);
      if (!p) {
        p = document.createElement('div');
        p.dataset.place = '';
        p.setAttribute('aria-hidden', 'true');
        places.set(t, p);
        body.append(p);
      }
      const radius = parseFloat(t.el.getAttribute('radius') ?? '') || 2;
      const [x, y] = under ? [along, H + gap] : [W + gap, along];
      p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;border:${1 / k}px solid currentColor;border-radius:${radius * MM}px;opacity:.25;pointer-events:none`;
      t.place = [(x - t.el.offsetLeft) / MM, (y - t.el.offsetTop) / MM];
      t.rest();
      along += Math.min((under ? w : h) + gap, room);
    }
  };
  const made = { things, places, lay };
  shelves.set(body, made);
  return made;
}

/**
 * One seat for any number of loose devices, each a `d-device loose` directly inside the one that holds the seat, set where it sits when seated.
 * `seated` says which is in. The others lie on the body's shelf, flat places beside it, and so does anything a hand lets go of anywhere but the way in.
 * A hand pulls one along the rails and clear, and it's free while it's held. Let go near the way in, with the seat empty, and it springs home.
 * It fires a bubbling `plug` with `seated` true or false. `aria-disabled="true"` on one locks it where it is, as a power switch's tab holds a cartridge:
 * seated, a hand moves it a hair and no further, and out, it can't go in.
 */
export function plug(things: HTMLElement[], o: PlugOptions) {
  const off = new AbortController(), { signal } = off, axis = o.axis ?? 'y', out = Math.sign(o.run ?? 0), reach = Math.abs(o.run ?? 0), near = o.near ?? 10, twist = o.twist ?? 0;
  const body = things[0]!.parentElement!, shelf = shelfOf(body);
  let frame = 0, last = 0;
  const all = things.map(el => {
    const t = {
      el, x: 0, y: 0, vx: 0, vy: 0, grip: -1, from: [0, 0, 0, 0], home: false, turn: +(el.getAttribute('twist') ?? 0), turning: false, shelved: false, drawn: null as HTMLElement | null, place: null as [number, number] | null, since: 0,
      out: () => !el.hasAttribute('seated') && !t.home,
      // On the shelf, it goes where its place is.
      rest: () => {
        if (!t.shelved || t.grip >= 0 || !t.place) return;
        last = performance.now();
        frame ||= requestAnimationFrame(step);
      },
    };
    return t;
  });
  type Thing = (typeof all)[number];
  shelf.things.push(...all);
  // Turned off, the way out is toward the eye, so lined up is right over the seat and it's on its way in at once.
  const along = (t: Thing) => (twist ? 0 : out * (axis === 'y' ? t.y : t.x)), across = (t: Thing) => (twist ? Math.hypot(t.x, t.y) : axis === 'y' ? t.x : t.y);
  const k = (t: Thing) => (t.el.parentElement!.getBoundingClientRect().width / t.el.parentElement!.offsetWidth || 1) * MM;
  // Its own surface and what's on it, in the seat. Taking it away is a repaint, so that happens once, as it leaves.
  const draw = (t: Thing) => {
    const { el } = t, up = el.parentElement!, s = document.createElement('d-surface');
    let x = el.offsetLeft, y = el.offsetTop;
    for (let n: HTMLElement | null = o.seat; n && n !== up; n = n.offsetParent as HTMLElement | null) {
      x -= n.offsetLeft;
      y -= n.offsetTop;
    }
    for (const a of ['material', 'radius', 'height', 'bevel', 'path', 'viewbox', 'rule', 'shape', 'twist']) if (el.hasAttribute(a)) s.setAttribute(a, el.getAttribute(a)!);
    s.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px`;
    s.append(...[...el.children].filter(c => c.localName !== 'canvas').map(c => c.cloneNode(true)));
    // Only a picture: the thing itself still takes the hand and the keys, and what it's set to shows here too.
    s.inert = true;
    s.setAttribute('aria-hidden', 'true');
    match(el, s);
    o.seat.append(s);
    return s;
  };
  // Once a device's canvas shows what it now holds, or soon anyway.
  const lit = (el: Element, then: () => void) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      clearTimeout(late);
      el.removeEventListener('lit', go);
      then();
    };
    const late = setTimeout(go, 400);
    el.addEventListener('lit', go, { signal });
  };
  const holder = o.seat.closest('d-device')!;
  // Which face of the body it goes into, so a hand only finds it there while that face is up.
  const face = holder.hasAttribute('reverse') ? 'back' : holder.getAttribute('side') || 'front';
  for (const t of all) t.el.dataset.face = face;
  // What's on it that a hand can set, a lens's rings say, set the same on the picture of it in the seat.
  const match = (from: HTMLElement, to: HTMLElement) => {
    const ins = to.querySelectorAll('input');
    from.querySelectorAll('input').forEach((i, n) => {
      const j = ins[n];
      if (!j || (j.value === i.value && j.checked === i.checked)) return;
      j.value = i.value;
      j.checked = i.checked;
      j.dispatchEvent(new Event('input'));
    });
  };
  // On the rails it's part of the body, drawn in the seat and sliding there, under whatever covers the way in. Clear of them it's itself.
  // The two pictures hand over without a gap: it goes on showing itself until the body draws it in the seat. The other way
  // needs no wait, since it's lit all along.
  const sync = (t: Thing) => {
    const in_ = t.el.hasAttribute('seated');
    if (in_ && !t.drawn) {
      t.drawn = draw(t);
      lit(holder, () => {
        if (t.drawn) t.el.removeAttribute('moving');
      });
    }
    if (!in_) {
      t.el.toggleAttribute('moving', true);
      t.drawn?.remove();
      t.drawn = null;
    }
    if (t.drawn) {
      t.drawn.style.translate = t.el.style.translate;
      if (t.drawn.getAttribute('twist') !== t.el.getAttribute('twist')) t.drawn.setAttribute('twist', t.el.getAttribute('twist') ?? '0');
    }
  };
  // A release stays in for a while after a click, or for as long as a hand is turning what it lets go.
  let released = false, hold = 0;
  const press = (on: boolean, s = 0) => {
    clearTimeout(hold);
    released = on;
    o.release?.setAttribute('aria-pressed', String(on));
    if (on && s) hold = window.setTimeout(() => press(false), s * 1000);
  };
  if (o.release) {
    o.release.setAttribute('aria-pressed', 'false');
    o.release.addEventListener('click', () => press(true, RELEASE_HOLD), { signal });
  }
  const turnTo = (t: Thing, deg: number) => {
    t.turn = Math.abs(deg) < 0.05 ? 0 : deg;
    if (t.turn) t.el.setAttribute('twist', t.turn.toFixed(1));
    else t.el.removeAttribute('twist');
    sync(t);
  };
  // Degrees round the middle of the thing, clockwise, from straight up.
  const bearing = (t: Thing, e: PointerEvent) => {
    const r = t.el.getBoundingClientRect();
    return (Math.atan2(e.clientX - r.x - r.width / 2, -(e.clientY - r.y - r.height / 2)) * 180) / Math.PI;
  };
  const locked = (t: Thing) => t.el.getAttribute('aria-disabled') === 'true';
  const place = (t: Thing) => {
    t.el.style.translate = t.x || t.y ? `${(t.x * MM).toFixed(2)}px ${(t.y * MM).toFixed(2)}px` : '';
    sync(t);
  };
  const seat = (t: Thing, on: boolean) => {
    if (t.el.hasAttribute('seated') === on) return;
    t.el.toggleAttribute('seated', on);
    sync(t);
    t.el.dispatchEvent(new CustomEvent('plug', { bubbles: true, detail: { seated: on } }));
  };
  const step = (now: number) => {
    frame = 0;
    const dt = Math.min((now - last) / 1000 || 1 / 60, 1 / 30);
    last = now;
    for (const t of all) {
      const to = t.home ? [0, 0] : t.shelved && t.grip < 0 ? t.place : null;
      if (!to) continue;
      t.vx += (-HOME * (t.x - to[0]!) - DAMP * t.vx) * dt;
      t.vy += (-HOME * (t.y - to[1]!) - DAMP * t.vy) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      // Lined up with the way in, it's on the rails, and slides the rest of the way inside the body.
      if (t.home && !t.el.hasAttribute('seated') && Math.abs(across(t)) < 0.5 && along(t) < reach) {
        if (axis === 'y') t.x = t.vx = 0;
        else t.y = t.vy = 0;
        seat(t, true);
      }
      if (reduced() || Math.hypot(t.x - to[0]!, t.y - to[1]!) < 0.05) {
        [t.x, t.y] = to as [number, number];
        t.vx = t.vy = 0;
        if (t.home) {
          t.home = false;
          seat(t, true);
          t.el.style.zIndex = '';
        }
        place(t);
        continue;
      }
      place(t);
      frame ||= requestAnimationFrame(step);
    }
  };
  addEventListener('resize', shelf.lay, { signal });
  for (const t of all) {
    const { el } = t;
    el.addEventListener('pointerdown', e => {
      if (e.button || t.grip >= 0) return;
      // Locked on, with the release out, it's what's on it that turns.
      const turning = !!twist && el.hasAttribute('seated');
      if (turning && (locked(t) || (!released && !t.turn))) return;
      t.turning = turning;
      if (turning) {
        press(true);
        t.from = [bearing(t, e), t.turn, 0, 0];
      }
      e.preventDefault();
      e.stopPropagation();
      capture(el, e);
      // What's in a hand is above everything it's carried over, once it's out.
      if (!el.hasAttribute('seated')) el.style.zIndex = String(shelf.things.length + 1);
      t.grip = e.pointerId;
      t.home = false;
      if (!turning) t.from = [e.clientX, e.clientY, t.x, t.y];
    }, { capture: !!twist, signal });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== t.grip) return;
      if (t.turning) {
        const by = ((bearing(t, e) - t.from[0]! + 540) % 360) - 180, to = t.from[1]! + by, way = Math.sign(twist);
        // It turns between its lock and where it comes free, and past that it's off, in the hand.
        turnTo(t, way * Math.min(Math.max(to * way, 0), Math.abs(twist)));
        if (Math.abs(t.turn) >= Math.abs(twist)) {
          t.turning = false;
          press(false);
          el.style.zIndex = String(shelf.things.length + 1);
          seat(t, false);
          t.since = performance.now();
          shelf.lay();
          t.from = [e.clientX, e.clientY, t.x, t.y];
        } else {
          // Each turn round the middle is counted from where it is, so a hand going all the way round doesn't jump.
          t.from = [bearing(t, e), t.turn, 0, 0];
        }
        return;
      }
      t.x = t.from[2]! + (e.clientX - t.from[0]!) / k(t);
      t.y = t.from[3]! + (e.clientY - t.from[1]!) / k(t);
      // It can only leave along the rails, and once it's clear it has a place on the shelf to go back to.
      if (el.hasAttribute('seated')) {
        if (along(t) >= reach && !locked(t)) {
          el.style.zIndex = String(shelf.things.length + 1);
          seat(t, false);
          t.since = performance.now();
          shelf.lay();
        } else {
          const on = Math.min(Math.max(along(t), 0), locked(t) ? LOCKED_GIVE : reach) * out;
          t.x = axis === 'x' ? on : 0;
          t.y = axis === 'y' ? on : 0;
        }
      }
      place(t);
    }, { signal });
    for (const n of ['pointerup', 'pointercancel'] as const) el.addEventListener(n, e => {
      if (e.pointerId !== t.grip) return;
      t.grip = -1;
      if (t.turning) {
        t.turning = false;
        press(false);
        // Nearly home, it snaps onto its lock.
        if (Math.abs(t.turn) < LOCKS) turnTo(t, 0);
        return;
      }
      const empty = !all.some(q => q !== t && (q.el.hasAttribute('seated') || q.home));
      // Anywhere but the way in, it goes back on the shelf. Nothing is left lying on the page, or on the body, which would turn over without it.
      t.home = el.hasAttribute('seated') || (empty && !locked(t) && Math.abs(across(t)) < near && along(t) > -near && along(t) < reach + near);
      t.shelved = !t.home;
      shelf.lay();
      last = performance.now();
      frame ||= requestAnimationFrame(step);
    }, { signal });
  }
  // What's out starts on the shelf.
  for (const t of all) t.shelved = !t.el.hasAttribute('seated');
  shelf.lay();
  // Turning the window moves the shelf to where the room is, and what's on it goes along.
  portrait?.addEventListener('change', () => shelf.lay(), { signal });
  for (const t of all) {
    if (t.shelved && t.place) [t.x, t.y] = t.place;
    place(t);
  }
  return () => {
    off.abort();
    cancelAnimationFrame(frame);
    for (const t of all) {
      t.drawn?.remove();
      shelf.places.get(t)?.remove();
      shelf.places.delete(t);
      shelf.things.splice(shelf.things.indexOf(t), 1);
    }
  };
}

/** A whole device in the hand. */
export interface HeldOptions {
  /** Each time it changes direction, with how hard, 0 to 1. */
  jolt(hard: number): void;
  /** Mm from where it rests that it can be carried. */
  reach?: number;
}

// Speed that counts as a hard shake, mm a second, the slowest that counts at all, the spring that brings it home, and a shake with no hand on it.
const HARD = 500, SLOW = 30, HOME = 180, DAMP = 16, SHAKE_HZ = 5, SHAKE_MM = 7;

/**
 * Lets a device be picked up by its body: drag where no control is, and it moves with the hand and settles back when let go.
 * Every sharp change of direction fires `jolt`, which is all a thing with loose insides needs to know. `shake` does the same with no hand on it, for a key.
 */
export function held(device: HTMLElement, o: HeldOptions) {
  const reach = o.reach ?? 40, off = new AbortController(), { signal } = off, sign = [0, 0];
  device.toggleAttribute('carried', true);
  let x = 0, y = 0, vx = 0, vy = 0, grip = -1, frame = 0, last = 0, from = [0, 0, 0, 0], shaking = 0, wasX = 0, wasY = 0;
  const size = () => device.getBoundingClientRect().width / device.offsetWidth || 1;
  const place = () => {
    device.style.transform = reduced() || (!x && !y) ? '' : `translate(${(x * MM).toFixed(2)}px,${(y * MM).toFixed(2)}px) rotate(${(x * 0.05).toFixed(3)}deg)`;
  };
  // A reversal along either axis is a jolt, as hard as the speed it lost.
  const sense = (dt: number) => {
    [(x - wasX) / dt, (y - wasY) / dt].forEach((v, i) => {
      const was = sign[i]!;
      if (Math.abs(v) < SLOW) return;
      if (was && Math.sign(v) !== Math.sign(was)) o.jolt(Math.min((Math.abs(v) + Math.abs(was)) / HARD, 1));
      sign[i] = v;
    });
    wasX = x;
    wasY = y;
  };
  const step = (now: number) => {
    frame = 0;
    const dt = Math.min((now - last) / 1000 || 1 / 60, 1 / 30), turn = now * 0.001 * SHAKE_HZ * Math.PI * 2;
    last = now;
    if (shaking > now) {
      const a = SHAKE_MM * Math.min(((shaking - now) / 1000) * 3, 1);
      x = a * Math.sin(turn);
      y = a * 0.45 * Math.sin(turn + 1);
    } else if (grip < 0) {
      vx += (-HOME * x - DAMP * vx) * dt;
      vy += (-HOME * y - DAMP * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      if (Math.hypot(x, y) < 0.02 && Math.hypot(vx, vy) < 0.2) x = y = vx = vy = 0;
    }
    sense(dt);
    place();
    if (grip >= 0 || shaking > now || x || y) frame = requestAnimationFrame(step);
  };
  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  };
  device.addEventListener('pointerdown', e => {
    if (e.target !== device || e.button || grip >= 0) return;
    e.preventDefault();
    device.focus({ preventScroll: true });
    capture(device, e);
    grip = e.pointerId;
    from = [e.clientX, e.clientY, x, y];
    vx = vy = 0;
    run();
  }, { signal });
  device.addEventListener('pointermove', e => {
    if (e.pointerId !== grip) return;
    const k = size() * MM, carry = (v: number) => reach * Math.tanh(v / reach);
    x = carry(from[2]! + (e.clientX - from[0]!) / k);
    y = carry(from[3]! + (e.clientY - from[1]!) / k);
  }, { signal });
  for (const n of ['pointerup', 'pointercancel'] as const) device.addEventListener(n, e => {
    if (e.pointerId === grip) grip = -1;
  }, { signal });
  return {
    /** Shakes it for this long with nothing holding it. */
    shake(ms = 1200) {
      shaking = performance.now() + ms;
      run();
    },
    stop() {
      off.abort();
      cancelAnimationFrame(frame);
      device.removeAttribute('carried');
      device.style.transform = '';
    },
  };
}
