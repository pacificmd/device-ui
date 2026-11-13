// Thin loose sheets in a hand: a stack of them on a table, each one separate. A hand takes the top one, cuts the stack, spreads it round a corner,
// turns one over or the lot, and squares them up again. One part holds them all and draws them in the order they lie, so a stack of fifty costs
// what its top sheet and fifty edges cost, and each sheet is a real button with its own place in the tab order. Moving one touches no layout.
import { clamp, onDrag, reduced, setValue } from './drag.js';
import { getEngine } from './engine.js';
import { mechanism } from './joints.js';
import { MM } from './sheet.js';
import type { Part } from './types.js';

/** One sheet, where it is now: css px from the middle of the part, radians clockwise, how far turned over from 0 to 1, and how high it lies, mm. */
export interface Leaf {
  el: HTMLElement;
  /** Which it is, by its order in the markup. */
  n: number;
  x: number;
  y: number;
  a: number;
  f: number;
  z: number;
  /** Lies exactly under the next, so only its edge shows. */
  covered: boolean;
  /** Still held in the case. */
  cased: boolean;
}

export interface SheafOptions {
  /** How thick one is, mm. */
  thick: number;
  /** What a sheet says it is when its face is up. */
  named(el: HTMLElement): string;
  /** Degrees a whole spread takes, round the pin. */
  spread?: number;
  /** The pin it spreads round, css px from the part's middle. */
  pin?(p: Part): [number, number];
  /** Where the case holds the stack, css px from the part's middle. Without one the stack starts on the table. */
  seat?(p: Part): [number, number] | null;
  /** Whether the case can be got into. */
  open?(p: Part): boolean;
  /** Told when it can't be, and is wanted. */
  opening?(p: Part): void;
  /** Mm a tap's cut carries the top of the stack aside. */
  cut?: number;
}

const X = 0, Y = 1, A = 2, F = 3, Z = 4;
// How quickly each of them gets there, a second. A sheet weighs nothing and goes where it's sent, but turning over takes a flick of the wrist.
const PACE = [20, 20, 20, 12, 26];
// A press that goes this far, css px, is a drag and not a tap.
const TAPPED = 4;
// How far it lifts while a hand has it, and at the top of a turn, mm. A true turn would stand it on its edge, 32mm up, with a shadow to match.
const CARRIED = 2, TURNING = 6;
// How much of its thickness a spread stack still stands, as each one leans on the next rather than lying on it.
const LEANED = 0.2;
// How far a squared stack is out of true, mm, either way. Hands don't square a deck any better, and it's what makes the edges read.
const TRUE = 0.14;
// Let go this near the stack, as a share of a sheet's size, and it goes back on top.
const NEAR = 0.35;
// A sheet spread this far from the next can be picked out of the stack.
const SPREAD = 0.02;

interface Sim extends Leaf {
  to: number[];
  v: number[];
  /** A hand has it. */
  held: boolean;
  /** The bit of a turn it lands with, radians, which nobody deals without. */
  skew: number;
  label: string;
}

interface State {
  leaves: Sim[];
  /** Bottom first. */
  pile: Sim[];
  /** In the order they're drawn. */
  order: Sim[];
  /** Where the stack is, css px from the middle. */
  home: [number, number];
  origin: [number, number];
  fan: number;
  /** How many off the top are in a hand, and where it has them. */
  cut: { n: number; x: number; y: number } | null;
  /** Where they're dealt to, x y pairs, css px from the middle. */
  spots: number[];
  /** Dealt so far. */
  dealt: number;
  cuts: number;
  cased: boolean;
  /** What to do when everything has stopped. */
  then: (() => void) | null;
  grip: Record<string, HTMLElement | undefined>;
}

export function sheaf(o: SheafOptions) {
  const motion = mechanism({ mass: 2, material: 'plastic-on-plastic', contact: false }, 'sheaf');
  const states = new WeakMap<Part, State>();
  const wake = () => getEngine().schedule();
  const swing = ((o.spread ?? 95) * Math.PI) / 180;

  const stateOf = (p: Part): State => {
    let st = states.get(p);
    if (st) return st;
    const leaves = [...p.el.querySelectorAll<HTMLElement>(':scope > [leaf]')].map((el, n): Sim => ({
      el, n, x: 0, y: 0, a: 0, f: 0, z: 0, covered: false, cased: false, to: [0, 0, 0, 0, 0], v: [0, 0, 0, 0, 0], held: false,
      skew: ((((n * 7919) % 13) / 12 - 0.5) * 3 * Math.PI) / 180, label: '',
    }));
    const grip: State['grip'] = {};
    p.el.querySelectorAll<HTMLElement>(':scope > [grip]').forEach(el => (grip[el.getAttribute('grip')!] = el));
    states.set(p, st = { leaves, pile: [...leaves], order: [...leaves], home: [0, 0], origin: [0, 0], fan: 0, cut: null, spots: [], dealt: 0, cuts: 0, cased: false, then: null, grip });
    return st;
  };

  /** Where the next one goes. The last place takes all that's left, and with none it goes just off to one side. */
  const spot = (p: Part, i: number): [number, number] => {
    const { spots } = stateOf(p), count = Math.floor(spots.length / 2);
    if (!count) return [p.w * 1.2, 0];
    const at = Math.min(i, count - 1);
    return [spots[at * 2]!, spots[at * 2 + 1]!];
  };

  /** Sends everything where it should now be, and says who a hand can get at. */
  const lay = (p: Part) => {
    const st = stateOf(p), { pile, order, fan, cut } = st, [ox, oy] = st.origin, [px, py] = o.pin?.(p) ?? [0, 0], n = pile.length;
    const lifted = n - (cut?.n ?? 0);
    pile.forEach((l, i) => {
      const inHand = i >= lifted && cut, t = n > 1 ? i / (n - 1) : 0, a = fan * swing * t, c = Math.cos(a), s = Math.sin(a);
      const out = (1 - fan) * MM * TRUE, wx = (((l.n * 37) % 7) / 3 - 1) * out, wy = (((l.n * 53) % 5) / 2 - 1) * out;
      l.to[X] = (inHand ? cut.x : ox) + px - c * px + s * py + wx;
      l.to[Y] = (inHand ? cut.y : oy) + py - s * px - c * py + wy;
      l.to[A] = a;
    });
    // What each lies on, as it comes: the highest thing it overlaps that's already down.
    const down: { x: number; y: number; top: number }[] = [];
    const under = (x: number, y: number) => down.reduce((top, d) => (Math.abs(d.x - x) < p.w * 0.95 && Math.abs(d.y - y) < p.h * 0.95 ? Math.max(top, d.top) : top), 0);
    const inPile = new Set<Sim>(pile), thick = o.thick;
    let base = -1;
    for (const l of order) {
      if (inPile.has(l)) {
        if (base < 0) {
          base = st.cased ? 0 : under(ox, oy);
          const each = thick * (1 - fan * (1 - LEANED)), low = pile.slice(0, lifted);
          low.forEach((q, i) => (q.to[Z] = base + i * each + (q.held ? CARRIED : 0)));
          const on = cut ? under(cut.x, cut.y) + CARRIED : 0;
          pile.slice(lifted).forEach((q, i) => (q.to[Z] = on + i * each));
          down.push({ x: ox, y: oy, top: base + lifted * each });
        }
      } else {
        const z = under(l.to[X]!, l.to[Y]!);
        l.to[Z] = z + (l.held ? CARRIED : 0);
        down.push({ x: l.to[X]!, y: l.to[Y]!, top: z + thick });
      }
    }
    const top = pile[n - 1], spreading = fan > SPREAD;
    order.forEach((l, i) => {
      l.cased = st.cased && inPile.has(l);
      const free = !st.cased && (!inPile.has(l) || l === top || spreading || (cut && pile.indexOf(l) === lifted - 1));
      const b = l.el.style, shift = `translate(${l.to[X]!.toFixed(2)}px, ${l.to[Y]!.toFixed(2)}px)`, turn = `rotate(${l.to[A]!.toFixed(4)}rad)`;
      if (b.transform !== `${shift} ${turn}`) b.transform = `${shift} ${turn}`;
      if (b.zIndex !== String(i + 1)) b.zIndex = String(i + 1);
      const pe = free ? 'auto' : 'none';
      if (b.pointerEvents !== pe) b.pointerEvents = pe;
      const tab = free ? 0 : -1;
      if (l.el.tabIndex !== tab) l.el.tabIndex = tab;
      const label = l.to[F]! > 0.5 ? o.named(l.el) : 'A card, face down';
      if (l.label !== label) l.el.setAttribute('aria-label', l.label = label);
    });
    // What a hand grips the stack by follows it, and only what can be done now can be got at.
    const set = (name: string, on: boolean, x = 0, y = 0) => {
      const g = st.grip[name];
      if (!g) return;
      const b = g.style, want = on ? 'auto' : 'none', at = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      if (b.pointerEvents !== want) b.pointerEvents = want;
      if (b.transform !== at) b.transform = at;
      if (g.tabIndex !== (on ? 0 : -1)) g.tabIndex = on ? 0 : -1;
    };
    const has = n > 1, squared = !spreading && !cut && !st.cased;
    set('cut', has && squared, ox, oy);
    set('over', has && squared, ox, oy);
    set('spread', has && !st.cased && !cut, ox, oy);
    set('take', st.cased, 0, 0);
    set('away', !st.cased, 0, 0);
    wake();
  };

  const raise = (st: State, ...ones: Sim[]) => {
    const going = new Set(ones);
    st.order = [...st.order.filter(l => !going.has(l)), ...ones];
  };
  const raisePile = (st: State) => raise(st, ...st.pile);

  const deal = (p: Part, l: Sim) => {
    const st = stateOf(p), at = st.pile.indexOf(l);
    if (at >= 0) st.pile.splice(at, 1);
    raise(st, l);
    const [x, y] = spot(p, st.dealt++);
    l.to[X] = x;
    l.to[Y] = y;
    l.to[A] = l.skew;
    lay(p);
  };

  const overturn = (l: Sim) => {
    l.to[F] = l.to[F]! > 0.5 ? 0 : 1;
  };

  /** Takes off the top half or so, wherever the hand caught it: `share` of the way down the stack. */
  const startCut = (p: Part, share: number) => {
    const st = stateOf(p), n = st.pile.length;
    if (n < 2 || st.cased) return;
    raisePile(st);
    const take = clamp(Math.round(n * (0.3 + 0.4 * share)), 1, n - 1);
    st.cut = { n: take, x: st.origin[0], y: st.origin[1] };
    lay(p);
  };
  const finishCut = (p: Part) => {
    const st = stateOf(p), { cut } = st;
    if (!cut) return;
    const n = st.pile.length, lower = st.pile.slice(0, n - cut.n), upper = st.pile.slice(n - cut.n);
    // What was underneath goes on what came off, where that was put, and the lot goes back.
    st.pile = [...upper, ...lower];
    st.order = [...st.order.filter(l => !st.pile.includes(l)), ...st.pile];
    st.origin = [cut.x, cut.y];
    st.cut = null;
    st.cuts++;
    lay(p);
    st.then = () => {
      st.origin = [...st.home];
      lay(p);
    };
  };
  /** A tap on the side of it: the top comes off to one side by itself. */
  const tapCut = (p: Part) => {
    const st = stateOf(p);
    startCut(p, 0.35 + ((st.cuts * 5) % 7) / 20);
    if (!st.cut) return;
    st.cut.x = st.origin[0] + (o.cut ?? p.w / MM + 8) * MM;
    st.cut.y = st.origin[1];
    lay(p);
    st.then = () => finishCut(p);
  };

  const setFan = (p: Part, v: number) => {
    const st = stateOf(p), to = clamp(v, 0, 1);
    if (to === st.fan) return;
    if (st.fan === 0) raisePile(st);
    st.fan = to;
    const input = st.grip.spread as HTMLInputElement | undefined;
    if (input && input.valueAsNumber !== to) setValue(input, to);
    lay(p);
  };

  const turnOver = (p: Part) => {
    const st = stateOf(p);
    if (st.pile.length < 2 || st.cased) return;
    raisePile(st);
    st.pile.reverse();
    st.order = [...st.order.filter(l => !st.pile.includes(l)), ...st.pile];
    for (const l of st.pile) overturn(l);
    lay(p);
  };

  const take = (p: Part) => {
    const st = stateOf(p);
    if (!st.cased) return;
    if (o.open && !o.open(p)) return o.opening?.(p);
    st.origin = [...st.home];
    lay(p);
    // It stays under the front of the case until it's clear of it.
    st.then = () => {
      st.cased = false;
      lay(p);
    };
  };

  const away = (p: Part) => {
    const st = stateOf(p), seat = o.seat?.(p);
    if (st.cased || !seat) return;
    if (o.open && !o.open(p)) o.opening?.(p);
    st.fan = 0;
    st.cut = null;
    st.dealt = 0;
    const input = st.grip.spread as HTMLInputElement | undefined;
    if (input && input.valueAsNumber) setValue(input, 0);
    // All of it, back in the order it lies, face down.
    st.pile = [...st.pile, ...st.order.filter(l => !st.pile.includes(l))];
    st.order = [...st.pile];
    st.origin = [...st.home];
    for (const l of st.pile) l.to[F] = 0;
    lay(p);
    st.then = () => {
      st.cased = true;
      st.origin = [...seat];
      lay(p);
    };
  };

  return {
    motion,
    // A grip or a button moving is no reason to lay anything out, and neither is anything a hand does here.
    live: ['style', 'aria-label', 'tabindex', 'value', 'aria-valuenow'],
    connect(p: Part) {
      const ac = new AbortController(), { signal } = ac, st = stateOf(p), seat = o.seat?.(p);
      p.el.style.pointerEvents = 'none';
      for (const l of st.leaves) l.el.style.cssText = 'position:absolute;inset:0;appearance:none;background:none;border:0;padding:0;outline:none;cursor:grab;transform-origin:50% 50%';
      for (const g of Object.values(st.grip)) if (g) g.style.pointerEvents = 'auto';
      if (seat) {
        st.cased = true;
        st.origin = [...seat];
        for (const l of st.leaves) {
          l.x = seat[0];
          l.y = seat[1];
        }
      }
      lay(p);
      for (const l of st.leaves) {
        l.x = l.to[X]!;
        l.y = l.to[Y]!;
        l.z = l.to[Z]!;
      }
      const zoom = () => p.el.getBoundingClientRect().width / p.w || 1;
      let hand: { kind: string; leaf?: Sim; moved: number; x: number; y: number; fan: number } | null = null;
      onDrag(p, signal, {
        accepts(e) {
          const el = (e.target as Element).closest?.('[leaf], [grip]');
          return !!el && el.parentElement === p.el;
        },
        start(e) {
          const el = (e.target as Element).closest<HTMLElement>('[leaf], [grip]')!, kind = el.getAttribute('grip') ?? 'leaf';
          hand = { kind, moved: 0, x: 0, y: 0, fan: st.fan };
          if (kind === 'leaf') hand.leaf = st.leaves.find(l => l.el === el);
          st.then = null;
          if (kind === 'cut') {
            const r = el.getBoundingClientRect();
            hand.fan = clamp((e.clientY - r.top) / r.height, 0, 1);
          }
        },
        move(e, dx, dy) {
          if (!hand) return;
          const k = zoom(), mx = dx / k, my = dy / k;
          hand.moved += Math.hypot(dx, dy);
          hand.x += mx;
          hand.y += my;
          if (hand.moved < TAPPED) return;
          if (hand.kind === 'leaf' && hand.leaf) {
            const l = hand.leaf, at = st.pile.indexOf(l);
            if (!l.held) {
              if (at >= 0) st.pile.splice(at, 1);
              l.held = true;
              raise(st, l);
              l.to[A] = l.a;
            }
            l.to[X] = l.x += mx;
            l.to[Y] = l.y += my;
            lay(p);
          } else if (hand.kind === 'cut') {
            if (!st.cut) startCut(p, hand.fan);
            if (st.cut) {
              st.cut.x = st.origin[0] + hand.x;
              st.cut.y = st.origin[1] + hand.y;
              lay(p);
            }
          } else if (hand.kind === 'spread') setFan(p, hand.fan + hand.x / (p.w * 1.1));
        },
        end() {
          if (!hand) return;
          const { kind, leaf: l, moved } = hand, tap = moved < TAPPED;
          hand = null;
          if (kind === 'leaf' && l) {
            if (tap) {
              if (st.pile.includes(l)) deal(p, l);
              else {
                raise(st, l);
                overturn(l);
                lay(p);
              }
              return;
            }
            l.held = false;
            const near = Math.abs(l.x - st.origin[0]) < p.w * NEAR && Math.abs(l.y - st.origin[1]) < p.h * NEAR;
            if (near && !st.cased && !st.fan) {
              st.pile.push(l);
              raisePile(st);
            }
            lay(p);
          } else if (kind === 'cut') {
            if (tap) tapCut(p);
            else if (st.cut && Math.hypot(st.cut.x - st.origin[0], st.cut.y - st.origin[1]) > p.w / 2) finishCut(p);
            else {
              st.cut = null;
              lay(p);
            }
          } else if (kind === 'spread') {
            if (tap) setFan(p, st.fan > 0.5 ? 0 : 1);
          } else if (tap && kind === 'over') turnOver(p);
          else if (tap && kind === 'take') take(p);
          else if (tap && kind === 'away') away(p);
        },
      });
      // From the keyboard, or anything else that clicks with no pointer.
      for (const l of st.leaves) l.el.addEventListener('click', e => {
        if (e.detail) return;
        if (st.pile.includes(l)) deal(p, l);
        else {
          overturn(l);
          lay(p);
        }
      }, { signal });
      const clicks: Record<string, () => void> = { cut: () => tapCut(p), over: () => turnOver(p), take: () => take(p), away: () => away(p) };
      for (const [name, fn] of Object.entries(clicks)) st.grip[name]?.addEventListener('click', e => {
        if (!e.detail) fn();
      }, { signal });
      st.grip.spread?.addEventListener('input', e => setFan(p, (e.target as HTMLInputElement).valueAsNumber), { signal });
      return () => ac.abort();
    },
    tick(p: Part, dt: number) {
      const st = stateOf(p), still = reduced();
      let going = false;
      const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
      for (const l of st.leaves) {
        const now = [l.x, l.y, l.a, l.f, l.z];
        let moved = false;
        for (let c = 0; c < 5; c++) {
          let v = now[c]!, u = l.v[c]!;
          const to = l.to[c]!;
          if (v === to && !u) continue;
          moved = true;
          if (still || (l.held && c !== Z)) {
            v = to;
            u = 0;
          } else {
            // Critically damped: nothing a hand lets go of rings.
            const w = PACE[c]!;
            for (let i = 0; i < n; i++) {
              u += (w * w * (to - v) - 2 * w * u) * h;
              v += u * h;
            }
            if (Math.abs(to - v) < (c === A || c === F ? 0.0008 : 0.02) && Math.abs(u) < 0.5) {
              v = to;
              u = 0;
            }
          }
          now[c] = v;
          l.v[c] = u;
        }
        if (moved) {
          [l.x, l.y, l.a, l.f, l.z] = now as [number, number, number, number, number];
          going = true;
        }
      }
      if (!going && st.then) {
        const next = st.then;
        st.then = null;
        next();
        return true;
      }
      return going;
    },
    /** All of them in the order they lie, bottom first, each saying if it's under the next. */
    leaves(p: Part): readonly Leaf[] {
      const { order } = stateOf(p);
      order.forEach((l, i) => {
        const next = order[i + 1];
        l.covered = !!next && next.cased === l.cased && Math.abs(next.x - l.x) < MM && Math.abs(next.y - l.y) < MM && Math.abs(next.a - l.a) < 0.002 && Math.abs(next.f - l.f) < 0.002 && (l.f === 0 || l.f === 1);
      });
      return order;
    },
    /** Says where they're dealt to, x y pairs, mm from the middle. */
    deals(p: Part, mm: readonly number[]) {
      stateOf(p).spots = mm.map(n => n * MM);
    },
    /** How high it stands on top of a turn, mm, for a sheet turned `f` of the way over. */
    lift: (f: number) => Math.sin(Math.PI * f) * TURNING,
    /** Where the stack lies, css px from the middle, and how many are in it. */
    stack(p: Part) {
      const st = stateOf(p);
      return { x: st.origin[0], y: st.origin[1], n: st.pile.length, cased: st.cased };
    },
  };
}
