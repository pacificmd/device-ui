import { describe, expect, it } from 'vitest';
import { MonoVoice, PATCH, type Patch } from '../../src/sound/mono.js';

const RATE = 48000;
const voice = (patch: Partial<Patch> = {}) => new MonoVoice(RATE, { ...PATCH, ampAttack: 0, ampSustain: 1, amount: 0, ...patch });
const take = (v: MonoVoice, seconds: number) => {
  const out = new Float32Array(Math.round(seconds * RATE));
  v.render(out);
  return out;
};
const rms = (a: Float32Array) => Math.sqrt(a.reduce((n, x) => n + x * x, 0) / a.length);
/** How bright it is: the size of the sample-to-sample change against the signal's own. */
const bright = (a: Float32Array) => rms(a.map((x, i) => x - (a[i - 1] ?? 0))) / rms(a);
/** Hz, from rising zero crossings. */
const pitch = (a: Float32Array) => {
  const up: number[] = [];
  for (let i = 1; i < a.length; i++) if (a[i - 1]! < 0 && a[i]! >= 0) up.push(i);
  return (RATE * (up.length - 1)) / (up.at(-1)! - up[0]!);
};

describe('a monosynth voice', () => {
  it('is silent until a key goes down', () => {
    expect(rms(take(voice(), 0.05))).toBe(0);
  });

  it('plays the note, in tune', () => {
    const v = voice({ wave: [0, 0, 0], cutoff: 1, emphasis: 0 });
    v.press(69);
    take(v, 0.1);
    expect(pitch(take(v, 0.5))).toBeCloseTo(440, -0.5);
  });

  it('darkens as the filter closes, stage by stage', () => {
    const at = (cutoff: number) => {
      const v = voice({ cutoff, emphasis: 0 });
      v.press(45);
      take(v, 0.1);
      return bright(take(v, 0.3));
    };
    expect(at(0.8)).toBeGreaterThan(at(0.5) * 1.5);
    expect(at(0.5)).toBeGreaterThan(at(0.15) * 1.2);
  });

  it('rolls off at four poles: 24dB an octave', () => {
    const level = (hz: number) => {
      const v = voice({ wave: [3, 3, 3], cutoff: Math.log2(200 / 40) / 9, emphasis: 0, level: [0.5, 0, 0] });
      v.press(Math.round(69 + 12 * Math.log2(hz / 440)));
      take(v, 0.1);
      return rms(take(v, 0.3));
    };
    expect(20 * Math.log10(level(1760) / level(880))).toBeLessThan(-14);
  });

  it('sings by itself at the top of its emphasis, at the cutoff', () => {
    const hz = 40 * 2 ** (0.5 * 9);
    const v = voice({ cutoff: 0.5, emphasis: 1, level: [0, 0, 0] });
    v.press(60);
    // A breath of noise starts it, as circuit noise does on the real one.
    v.patch.noiseOn = true;
    v.patch.noise = 0.1;
    take(v, 0.05);
    v.patch.noiseOn = false;
    take(v, 0.4);
    const out = take(v, 0.3);
    expect(rms(out)).toBeGreaterThan(0.02);
    expect(pitch(out) / hz).toBeGreaterThan(0.85);
    expect(pitch(out) / hz).toBeLessThan(1.15);
  });

  it('sounds the lowest key held and does not fire the contours again', () => {
    const v = voice({ wave: [0, 0, 0], cutoff: 1, emphasis: 0, ampSustain: 0.2, ampDecay: 0.2 });
    v.press(72);
    take(v, 0.3);
    const settled = rms(take(v, 0.1));
    v.press(60);
    take(v, 0.05);
    const out = take(v, 0.3);
    expect(pitch(out)).toBeCloseTo(261.6, -0.5);
    expect(rms(out)).toBeLessThan(settled * 1.1);
    v.release(60);
    take(v, 0.05);
    expect(pitch(take(v, 0.3))).toBeCloseTo(523.3, -0.7);
  });

  it('dies away slowly with the decay switch, and at once without it', () => {
    const left = (decay: boolean) => {
      const v = voice({ ampDecay: 0.6, decay });
      v.press(60);
      take(v, 0.1);
      v.release(60);
      take(v, 0.05);
      return rms(take(v, 0.05));
    };
    expect(left(true)).toBeGreaterThan(left(false) * 10);
  });

  it('glides up to the new note', () => {
    const v = voice({ wave: [0, 0, 0], cutoff: 1, emphasis: 0, glide: 0.4, glideOn: true });
    v.press(48);
    take(v, 1.5);
    v.release(48);
    v.press(72);
    const early = pitch(take(v, 0.08));
    take(v, 2.5);
    expect(early).toBeLessThan(400);
    expect(pitch(take(v, 0.2))).toBeGreaterThan(500);
  });

  it('wobbles the filter from a free-running third oscillator through the wheel', () => {
    const spread = (wheel: number) => {
      const v = voice({ wheel, modFilter: true, cutoff: 0.5, thirdFollows: false, range: [3, 3, 0], wave: [2, 2, 0] });
      v.press(48);
      take(v, 0.1);
      let lo = Infinity, hi = 0;
      for (let i = 0; i < 400; i++) {
        take(v, 0.01);
        lo = Math.min(lo, v.hz);
        hi = Math.max(hi, v.hz);
      }
      return hi / lo;
    };
    expect(spread(0)).toBeLessThan(1.01);
    expect(spread(1)).toBeGreaterThan(2);
  });

  it('holds steady when the output is sent back in', () => {
    const v = voice({ loopOn: true, loop: 1, emphasis: 0.9 });
    v.press(40);
    const out = take(v, 1);
    expect(out.every(Number.isFinite)).toBe(true);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(4);
    expect(v.overload).toBeGreaterThan(0);
  });
});
