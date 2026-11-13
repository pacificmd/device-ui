import { contact, type ContactMotion } from './contact.js';
import type { Part, SpringDef } from './types.js';

// How much of the way counts as there. The last of it is a long tail that would read as a pause.
const ARRIVED = 0.92;
// A press is felt where it snaps, part way down, not where it stops. Wait for the stop and the sound comes too late.
const SNAP = 0.4;
// How much of a detent counts as over it. Under 1, so a control a force curve holds short of one still clicks.
const OVER = 0.5;
// How fast a spring is going as it arrives, per root of stiffness and unit of travel, for one that jumps there.
const SWIFT = 0.3;
// The same at a snap, where it's going about as fast as it ever does.
const SWIFTEST = 0.75;

let wake: (s: Spring) => void = () => {};
/** Told of each spring given somewhere new to go, so whatever draws it can draw it moving. */
export const onSpringChange = (fn: (s: Spring) => void): void => {
  wake = fn;
};

/** Everything that moves is a spring, so nothing animates unless it has somewhere to go. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  /** The part this moves, which is who a contact gets reported for. */
  part: Part | null = null;
  private stiffness: number;
  private damping: number;
  private through: boolean;
  private rest: number;
  private from: number;
  private after: number | undefined;
  private contact: 'press' | 'toggle' | null;
  private motion: ContactMotion | undefined;
  /** False from the start of a move until it has been reported. */
  private landed = true;
  private notch = 0;
  /** Seconds it trails a hand by, while one has hold of it. 0 for none. */
  private held = 0;
  /** Jumped, so it has nowhere left to go and still needs drawing. */
  private jumped = false;
  /** The detent it last clicked into. */
  private seat: number;

  constructor(def: SpringDef) {
    this.stiffness = def.stiffness;
    this.damping = def.damping;
    this.through = def.through ?? false;
    this.contact = def.contact || null;
    this.motion = def.motion;
    this.rest = this.from = this.value = this.target = this.seat = def.value ?? 0;
  }

  /** Animate to a value. */
  set(target: number): void {
    // A tap is over before a key reaches the bottom, and it still goes all the way down.
    if (this.through && target === this.rest && this.target !== this.rest && this.active) {
      this.after = target;
      return;
    }
    this.after = undefined;
    if (target === this.target) return;
    this.go(target);
    wake(this);
  }

  /** Jump to a value. */
  snap(value: number): void {
    this.value = this.target = this.seat = value;
    this.velocity = 0;
    this.after = undefined;
    this.landed = true;
    this.jumped = true;
    wake(this);
  }

  /** A hand has it, so it follows at this lag and not at the spring's own. 0 lets go. */
  grip(lag: number): void {
    this.held = lag;
  }

  /** Reports a detent every `size` of travel, counted from where it sits. 0 for none. */
  notches(size: number): void {
    if (size === this.notch) return;
    this.notch = size;
    this.seat = this.value;
  }

  get active(): boolean {
    return this.jumped || this.moving;
  }

  private get moving(): boolean {
    return this.value !== this.target || this.velocity !== 0;
  }

  /** Advances the spring. Returns true if it needs another frame. */
  step(dt: number, instant = false): boolean {
    this.jumped = false;
    if (!this.moving) return false;
    if (instant) {
      // Nothing moved, but it still arrived, and something listening should still hear it.
      const speed = (this.contact === 'toggle' ? SWIFT : SWIFTEST) * Math.sqrt(this.stiffness) * Math.abs(this.target - this.from);
      this.value = this.target;
      this.feel(speed);
      if (this.after !== undefined) {
        this.go(this.after);
        this.value = this.target;
        this.feel(speed);
      }
      this.seat = this.value;
      this.velocity = 0;
      this.after = undefined;
      return false;
    }
    // Stiff springs blow up at large steps, so a slow frame is taken in small pieces.
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (this.held) this.velocity = (this.target - this.value) / this.held;
      else this.velocity += (this.stiffness * (this.target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
      if (!this.landed || this.notch) this.feel(Math.abs(this.velocity));
    }
    if (this.after !== undefined && this.arrived) {
      this.go(this.after);
      this.after = undefined;
    }
    if (Math.abs(this.velocity) < 0.01 && Math.abs(this.target - this.value) < 0.001) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }

  private past(share: number): boolean {
    return (this.value - this.from) / (this.target - this.from) >= share;
  }

  private get arrived(): boolean {
    return this.past(ARRIVED);
  }

  private go(target: number): void {
    this.from = this.value;
    this.target = target;
    this.landed = !this.contact;
  }

  // Each move lands once, however long it then rings around its target.
  private feel(speed: number): void {
    // A throw goes over its centre and bangs into the far end, so that end is what's felt.
    if (!this.landed && this.past(this.contact === 'toggle' ? ARRIVED : SNAP)) {
      this.landed = true;
      contact(this.part, this.contact === 'toggle' ? 'toggle' : this.target === this.rest ? 'release' : 'press', speed, { to: this.target, motion: this.motion });
    }
    if (!this.notch) return;
    const over = (this.value - this.seat) / this.notch;
    if (Math.abs(over) < OVER) return;
    this.seat += Math.sign(over) * this.notch;
    contact(this.part, 'detent', speed / Math.abs(this.notch), { motion: this.motion });
  }
}

/** Where a part's data holds a hand's own hold on one of its springs, which its joint goes by over the spring while it has it. */
export const gripping = (spring: string) => `grip:${spring}`;
