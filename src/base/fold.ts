// A body in two halves on a hinge across it, as a flip phone, a compact, a lid on its stays or a door that springs open. The half that swings has two
// faces, and each is a device of its own, drawn flat and lit as it rests: flat on the body, or held part-way open, set at its `angle` about its pin.
// Only the swing between rests is turned by the page, so nothing is ever laid out while it's moving.
import { reduced } from './drag.js';

export interface FoldOptions {
  /** Ms from one end to the other. */
  ms?: number;
  /** Where it comes to rest open, degrees from shut: 180 lies flat, and less is a stop, as a door that springs to 100. */
  open?: number;
  /** Told when it comes to rest, and which way. */
  rested?(folded: boolean): void;
}

export interface Fold {
  /** Whether the outside is up: it's shut, or open less than square. */
  readonly folded: boolean;
  /** Degrees from shut that it's at, or going to: 0 shut, 180 open flat. */
  readonly angle: number;
  open(): void;
  shut(): void;
  toggle(): void;
  /** Swings it to rest this many degrees from shut, as onto one of a lid's stays. */
  to(angle: number): void;
  stop(): void;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';
// For the face seen open: where its pin is, the axis it turns about and which way brings its far edge out toward the viewer. The shut face turns
// from the opposite edge, the other way.
const PIN: Record<Edge, { origin: string; shut: string; axis: 'X' | 'Y'; way: 1 | -1 }> = {
  bottom: { origin: '50% 100%', shut: '50% 0%', axis: 'X', way: -1 },
  top: { origin: '50% 0%', shut: '50% 100%', axis: 'X', way: 1 },
  left: { origin: '0% 50%', shut: '100% 50%', axis: 'Y', way: -1 },
  right: { origin: '100% 50%', shut: '0% 50%', axis: 'Y', way: 1 },
};
// How dark a face gets as it goes edge on: the light it catches falls away, and nobody looks at the back of a hinge.
const DIM = 0.55;
// Degrees it swings past a rest before it settles back, as a stay or a stop takes it.
const PAST = 4;
// The most a face at rest stands off the body, as the renderer sets a device at an angle: past it, it's edge on.
const MOST = 75;

/**
 * Swings the half of `body` that folds. Its two faces are `d-device` children of the body: `fold="open"`, seen while it's open, and `fold="shut"`,
 * the other side of the same half, seen while it's shut, each placed in the box it rests in flat. `pin` on the open face says which of its edges the
 * hinge is on, and the shut face lies across that edge. `folded` on the body shuts it, and setting or removing it swings it there. Between the two,
 * `to()` rests it at any angle, and whichever face is up is set at the angle it stands off the body. Past about 75° from flat a face is edge on.
 */
export function fold(body: HTMLElement, o: FoldOptions = {}): Fold {
  const face = (which: string) => body.querySelector<HTMLElement>(`:scope > d-device[fold="${which}"]`)!;
  const ms = o.ms ?? 260, opened = Math.min(Math.max(o.open ?? 180, 0), 180);
  const pin = () => PIN[(face('open').getAttribute('pin') as Edge) || 'bottom'];
  // Where it is: the angle it rests at or is going to, and the one it came from while it goes.
  let at = body.hasAttribute('folded') ? 0 : opened, from = at, going: Animation[] = [], timer = 0;

  // Which face is up at an angle, how far that face stands off the body, and the turn that sets it there.
  const up = (a: number) => (a < 90 ? face('shut') : face('open'));
  const off = (a: number) => (a < 90 ? a : 180 - a);
  const turn = (a: number, rest = false) => {
    const p = pin(), deg = (a < 90 ? -1 : 1) * p.way * (rest ? Math.min(off(a), MOST) : off(a));
    return { axis: p.axis, deg, origin: a < 90 ? p.shut : p.origin };
  };
  // At rest, the face up is set at its angle, which the renderer draws and lights; the other lies flat.
  const lay = (a: number | null) => {
    for (const f of [face('open'), face('shut')]) {
      const t = turn(a ?? 0, true), held = a !== null && f === up(a) && Math.abs(t.deg) > 0.5;
      if (held) {
        f.style.transformOrigin = t.origin;
        f.setAttribute('angle', t.axis === 'X' ? `0 ${+t.deg.toFixed(2)}` : `${+t.deg.toFixed(2)} 0`);
      } else if (f.hasAttribute('angle')) {
        f.removeAttribute('angle');
        f.style.transformOrigin = '';
      }
    }
  };
  const settle = () => {
    going.forEach(a => a.cancel());
    going = [];
    clearTimeout(timer);
  };
  // Seen from in front, over about four lengths of itself.
  const far = (el: HTMLElement) => `perspective(${Math.max(el.offsetWidth, el.offsetHeight) * 4}px) `;
  const frame = (a: number, offset?: number, rest = false): Keyframe => {
    const el = up(a), t = turn(a, rest);
    return { transform: far(el) + `rotate${t.axis}(${t.deg}deg)`, transformOrigin: t.origin, filter: `brightness(${1 - ((1 - DIM) * Math.min(off(a), 90)) / 90})`, ...(offset !== undefined && { offset }) };
  };
  const swing = (to: number) => {
    // Stopped part-way, it goes on from whichever end's face is up.
    const was = !going.length || body.hasAttribute('folded') === at < 90 ? at : from;
    settle();
    from = was;
    at = to;
    if (reduced() || was === to) {
      body.toggleAttribute('folded', to < 90);
      lay(to);
      from = at;
      o.rested?.(to < 90);
      return;
    }
    // It swings a little past where it rests and settles back. The face going away turns to edge on, and the one arriving comes from there.
    const dir = Math.sign(to - was), past = Math.min(Math.max(to + dir * PAST, -PAST), 180 + PAST);
    const total = (ms * Math.abs(past - was)) / 180, crosses = was < 90 !== to < 90;
    lay(null);
    if (crosses) {
      const edge = 90 - dir * 0.001, beyond = 90 + dir * 0.001, first = (total * Math.abs(90 - was)) / Math.abs(past - was);
      going = [
        up(was).animate([frame(was, undefined, true), frame(edge)], { duration: first, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' }),
        up(to).animate([frame(beyond), frame(past, 0.8), frame(to, undefined, true)], { duration: total - first, delay: first, easing: 'cubic-bezier(0,0,.4,1)', fill: 'both' }),
      ];
      timer = window.setTimeout(() => body.toggleAttribute('folded', to < 90), first);
    } else going = [up(to).animate([frame(was, undefined, true), frame(past, 0.8), frame(to, undefined, true)], { duration: total, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'forwards' })];
    going.at(-1)!.finished.then(() => {
      settle();
      body.toggleAttribute('folded', to < 90);
      lay(to);
      from = at;
      o.rested?.(to < 90);
    }, () => {});
  };
  // Whoever sets the attribute, the body swings to it.
  const watch = new MutationObserver(() => {
    const now = body.hasAttribute('folded');
    if (now === at < 90) return;
    body.toggleAttribute('folded', !now);
    swing(now ? 0 : opened);
  });
  watch.observe(body, { attributes: true, attributeFilter: ['folded'] });
  const to = (a: number) => {
    a = Math.min(Math.max(a, 0), 180);
    if (a !== at || going.length) swing(a);
  };
  lay(at);
  return {
    get folded() {
      return at < 90;
    },
    get angle() {
      return at;
    },
    open: () => to(opened),
    shut: () => to(0),
    toggle: () => to(at < 90 ? opened : 0),
    to,
    stop() {
      watch.disconnect();
      settle();
    },
  };
}
