// A course of strings a hand can catch and let go: a press takes the nearest, a drag pulls it aside until it slips, and a sweep goes
// through them one at a time. Each string says so with a `pluck` event, and rings by itself for as long as it would be seen to.
import { clamp, onPen, reduced } from './drag.js';
import { getEngine } from './engine.js';
import { mechanism } from './joints.js';
import { MM } from './sheet.js';
import type { Part } from './types.js';

/** One string, css px from the part's top left: from the end it's plucked nearest, to the other. */
export type StringLine = readonly [number, number, number, number];

export interface PluckOptions {
  strings(p: Part): readonly StringLine[];
  /** How far a string comes aside before it slips off, mm. */
  pull?: number;
}

/** A `pluck` event's detail. */
export interface Plucked {
  /** Which string, by its order. */
  string: number;
  /** Where along it, 0 at its first end to 1 at the other. */
  at: number;
  /** How hard, 0 to 1. */
  force: number;
}

interface Ringing {
  /** Where it's kinked, along it. */
  at: number;
  /** How far it's aside there now, css px. */
  by: number;
  /** How far it swings, css px, while it rings. */
  swing: number;
  phase: number;
}

interface State {
  ring: Ringing[];
  held: number;
  x: number;
  y: number;
}

// How fast a string is seen to die, a second. It's heard for longer, but by then it's too small to see.
const DIES = 1.7;
// A string goes round far too fast to see. This is what a screen can show of it, Hz: enough to look like a blur.
const SEEN = 27;
const QUIETEST = 0.25;

export function pluck(o: PluckOptions) {
  const motion = mechanism({ mass: 1, material: 'steel-on-steel', contact: false }, 'pluck');
  const states = new WeakMap<Part, State>();
  const stateOf = (p: Part) => {
    let st = states.get(p);
    if (!st) states.set(p, st = { ring: [], held: -1, x: 0, y: 0 });
    return st;
  };
  /** Where a point is against a string: how far along it, and how far aside, signed. */
  const against = ([ax, ay, bx, by]: StringLine, x: number, y: number) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    return { at: clamp(((x - ax) * dx + (y - ay) * dy) / (len * len), 0.02, 0.98), off: ((y - ay) * dx - (x - ax) * dy) / len };
  };
  const wake = () => getEngine().schedule();

  return {
    motion,
    connect(p: Part) {
      const st = stateOf(p), el = p.el, pull = (o.pull ?? 3) * MM;
      const lines = () => o.strings(p);
      const go = (i: number, at: number, by: number, force: number) => {
        st.ring[i] = { at, by, swing: Math.abs(by) || pull * force, phase: 0 };
        el.dispatchEvent(new CustomEvent<Plucked>('pluck', { bubbles: true, detail: { string: i, at, force: clamp(force, 0.05, 1) } }));
        wake();
      };
      const area = () => {
        const w = el.offsetWidth, h = el.offsetHeight;
        return { x: 0, y: 0, w, h, cols: w, rows: h };
      };
      const stop = onPen(el, area, {
        down(x, y) {
          const all = lines();
          let near = -1, best = Infinity;
          all.forEach((l, i) => {
            const d = Math.abs(against(l, x, y).off);
            if (d < best) [near, best] = [i, d];
          });
          if (near < 0) return false;
          st.held = near;
          st.x = x;
          st.y = y;
          const { at, off } = against(all[near]!, x, y);
          st.ring[near] = { at, by: clamp(off, -pull, pull), swing: 0, phase: 0 };
          wake();
          return true;
        },
        move(x, y) {
          const all = lines();
          // Everything this stroke went through, nearest the old point first, as a pick meets them.
          const crossed = all.map((l, i) => ({ i, was: against(l, st.x, st.y).off, now: against(l, x, y).off }))
            .filter(c => c.i !== st.held && c.was * c.now < 0)
            .sort((a, b) => Math.abs(a.was) - Math.abs(b.was));
          if (st.held >= 0) {
            const { at, off } = against(all[st.held]!, x, y);
            if (Math.abs(off) >= pull || crossed.length) {
              go(st.held, at, clamp(off, -pull, pull), 1);
              st.held = -1;
            } else st.ring[st.held] = { at, by: off, swing: 0, phase: 0 };
          }
          const stroke = Math.hypot(x - st.x, y - st.y);
          for (const c of crossed) {
            const { at, off } = against(all[c.i]!, x, y);
            if (stroke < pull && st.held < 0) {
              st.held = c.i;
              st.ring[c.i] = { at, by: off, swing: 0, phase: 0 };
            } else go(c.i, at, Math.sign(off || 1) * pull * 0.8, clamp(stroke / (pull * 4), 0.35, 1));
          }
          st.x = x;
          st.y = y;
          wake();
        },
        up() {
          if (st.held < 0) return;
          const r = st.ring[st.held]!;
          go(st.held, r.at, r.by, clamp(0.55 + Math.abs(r.by) / pull, 0, 1));
          st.held = -1;
        },
      });
      el.style.cursor = 'grab';
      // From the keyboard, each string has a button.
      const keys = new AbortController();
      el.querySelectorAll('button').forEach((b, i) => {
        b.addEventListener('click', e => {
          if (!e.detail) go(i, 0.2, pull * 0.8, 0.7);
        }, { signal: keys.signal });
      });
      return () => {
        stop();
        keys.abort();
      };
    },
    tick(p: Part, dt: number) {
      const st = stateOf(p), still = reduced();
      let going = st.held >= 0;
      st.ring.forEach((r, i) => {
        if (!r || i === st.held) return;
        r.swing *= Math.exp(-dt * DIES);
        r.phase += dt * Math.PI * 2 * (SEEN + i * 3);
        r.by = still || r.swing < QUIETEST ? 0 : r.swing * Math.cos(r.phase);
        if (r.by) going = true;
      });
      return going;
    },
    /** Where a string is kinked and how far aside, for drawing it. */
    shape(p: Part, i: number): { at: number; by: number } {
      const r = stateOf(p).ring[i];
      return r ? { at: r.at, by: r.by } : { at: 0.5, by: 0 };
    },
  };
}
