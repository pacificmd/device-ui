// A two-tone klaxon, the kind bolted to a wall: notes on the monosynth, worked out ahead of time into one whole cycle, then
// laid end to end for as long as it sounds.
import { MonoVoice, PATCH, type Patch } from './mono.js';

/** Plays the monosynth into a buffer: `drive` runs every 128 samples, with the seconds so far, to hold keys and turn knobs. */
export function bounce(rate: number, patch: Partial<Patch>, seconds: number, drive: (v: MonoVoice, t: number) => void): Float32Array {
  const v = new MonoVoice(rate, { ...PATCH, ...patch }), out = new Float32Array(Math.ceil(seconds * rate)), block = 128;
  for (let i = 0; i < out.length; i += block) {
    drive(v, i / rate);
    v.render(out.subarray(i, Math.min(i + block, out.length)));
  }
  return out;
}

// Three oscillators a hair apart, a saw, a square and a saw an octave up, through a filter wound up near singing.
const SIREN: Partial<Patch> = {
  range: [3, 3, 4], wave: [2, 3, 2], detune: [0, 0.09, -0.07], level: [1, 0.8, 0.55], on: [true, true, true],
  cutoff: 0.55, emphasis: 0.55, amount: 0.25, filterAttack: 0.15, filterDecay: 0.5, filterSustain: 0.75, ampAttack: 0.2, ampSustain: 1,
};

/** One whole cycle of the two tones, high then low, each `half` seconds, taken from the third so the filter has settled. */
export function siren(rate: number, half: number): Float32Array {
  const cycle = half * 2, slide = 0.025;
  const all = bounce(rate, SIREN, cycle * 3, (v, t) => {
    if (t === 0) v.press(79);
    // A fourth down for the second half, bent quickly rather than switched, as a horn's driver can't jump.
    const k = t % cycle, down = k < half ? Math.max(0, 1 - k / slide) * (k < slide ? 1 : 0) : Math.min(1, (k - half) / slide);
    v.patch.bend = -down;
  });
  return all.slice(Math.round(cycle * 2 * rate), Math.round(cycle * 3 * rate));
}

export interface KlaxonOptions {
  /** How long each tone lasts, seconds. 0.36 is a slow alarm, 0.17 a fast one. */
  half?: number;
  /** How loud, as a gain. */
  level?: number;
  /** How long it sounds before it stops by itself, seconds. Unset, it runs until stopped. */
  seconds?: number;
}

/** Sounds a klaxon into `to`, from now. Returns how to stop it, at a time on the context's clock or now. */
export function klaxon(c: BaseAudioContext, to: AudioNode, o: KlaxonOptions = {}): (at?: number) => void {
  const data = siren(c.sampleRate, o.half ?? 0.36), cycle = c.createBuffer(1, data.length, c.sampleRate);
  cycle.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return wail(c, to, cycle, o.level ?? 0.16, o.seconds);
}

/** Lays a buffer end to end. Each cycle is its own note, overlapping the last by a few ms, so the seams can't click. */
export function wail(c: BaseAudioContext, to: AudioNode, cycle: AudioBuffer, level = 0.16, seconds?: number): (at?: number) => void {
  const len = cycle.duration, fade = 0.006, out = c.createGain();
  out.gain.value = level;
  out.connect(to);
  let next = c.currentTime + 0.02, stopAt = seconds === undefined ? Infinity : next + seconds;
  const fill = (until: number) => {
    while (next < Math.min(until, stopAt)) {
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = cycle;
      g.gain.setValueAtTime(0, next);
      g.gain.linearRampToValueAtTime(1, next + fade);
      g.gain.setValueAtTime(1, next + len - fade);
      g.gain.linearRampToValueAtTime(0, next + len + fade);
      s.connect(g).connect(out);
      s.start(next);
      s.stop(next + len + fade * 2);
      next += len;
    }
    if (next >= stopAt) clearInterval(timer);
  };
  // A little ahead while it plays, or all of it at once offline.
  let timer = 0;
  if (c instanceof AudioContext) {
    fill(c.currentTime + 0.4);
    timer = window.setInterval(() => fill(c.currentTime + 0.4), 100);
  } else fill((c as OfflineAudioContext).length / c.sampleRate);
  return (at = c.currentTime) => {
    stopAt = at;
    clearInterval(timer);
    out.gain.setTargetAtTime(0, at, 0.06);
  };
}
