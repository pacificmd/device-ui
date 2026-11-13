import { describe, expect, it } from 'vitest';
import { PolyVoices, POLY, type PolyPatch } from '../../src/sound/poly.js';

const RATE = 48000;
const voices = (patch: Partial<PolyPatch> = {}) => new PolyVoices(RATE, { ...POLY, chorus: 0, attack: 0, sustain: 1, envAmount: 0, cutoff: 1, resonance: 0, kybd: 0, ...patch });
const take = (v: PolyVoices, seconds: number) => {
  const l = new Float32Array(Math.round(seconds * RATE)), r = new Float32Array(l.length);
  v.render(l, r);
  return [l, r] as const;
};
const rms = (a: Float32Array) => Math.sqrt(a.reduce((n, x) => n + x * x, 0) / a.length);
const bright = (a: Float32Array) => rms(a.map((x, i) => x - (a[i - 1] ?? 0))) / rms(a);
/** Hz, from rising zero crossings. */
const pitch = (a: Float32Array) => {
  const up: number[] = [];
  for (let i = 1; i < a.length; i++) if (a[i - 1]! < 0 && a[i]! >= 0) up.push(i);
  return (RATE * (up.length - 1)) / (up.at(-1)! - up[0]!);
};
const sounding = (v: PolyVoices) => [...v.notes].filter((n, i) => n >= 0 && v.gates[i]);

describe('six voices', () => {
  it('is silent until a key goes down', () => {
    expect(rms(take(voices(), 0.05)[0])).toBe(0);
  });

  it('plays the note, in tune', () => {
    const v = voices();
    v.press(69);
    take(v, 0.1);
    expect(pitch(take(v, 0.5)[0])).toBeCloseTo(440, -0.5);
  });

  it('holds six keys and gives the seventh the oldest voice', () => {
    const v = voices();
    for (let k = 60; k < 66; k++) v.press(k);
    expect(sounding(v).sort()).toEqual([60, 61, 62, 63, 64, 65]);
    v.press(66);
    expect(sounding(v).sort()).toEqual([61, 62, 63, 64, 65, 66]);
  });

  it('gives a new key the voice that has been free longest', () => {
    const v = voices();
    v.press(60);
    v.press(62);
    v.release(60);
    v.release(62);
    v.press(64);
    expect([...v.notes].indexOf(64)).not.toBe([...v.notes].indexOf(62));
  });

  it('dies away after the key comes up', () => {
    const v = voices({ release: 0.2 });
    v.press(60);
    take(v, 0.1);
    v.release(60);
    take(v, 1);
    expect(rms(take(v, 0.05)[0])).toBeLessThan(0.001);
  });

  it('adds a square an octave down', () => {
    const v = voices({ saw: false, sub: true, subLevel: 1, cutoff: 0.8 });
    v.press(69);
    take(v, 0.1);
    expect(pitch(take(v, 0.5)[0])).toBeCloseTo(220, -0.5);
  });

  it('darkens as the filter closes', () => {
    const at = (cutoff: number) => {
      const v = voices({ cutoff });
      v.press(45);
      take(v, 0.1);
      return bright(take(v, 0.3)[0]);
    };
    expect(at(0.8)).toBeGreaterThan(at(0.45) * 1.5);
  });

  it('the high-pass takes the bottom away, step by step', () => {
    const at = (hpf: number) => {
      const v = voices({ hpf, saw: false, sub: true, subLevel: 1, cutoff: 0.6 });
      v.press(36);
      take(v, 0.1);
      return rms(take(v, 0.3)[0]);
    };
    expect(at(3)).toBeLessThan(at(1));
    expect(at(1)).toBeLessThan(at(0));
  });

  it('the chorus makes the two sides differ, and off they match', () => {
    const differ = (chorus: number) => {
      const v = voices({ chorus });
      v.press(57);
      take(v, 0.3);
      const [l, r] = take(v, 0.5);
      return rms(l.map((x, i) => x - r[i]!));
    };
    expect(differ(0)).toBe(0);
    for (const c of [1, 2, 3]) expect(differ(c)).toBeGreaterThan(0.01);
  });

  it('a held key stays down until the next chord, or until hold goes off', () => {
    const v = voices({ hold: true });
    v.press(60);
    v.release(60);
    take(v, 0.05);
    expect(sounding(v)).toEqual([60]);
    v.press(64);
    expect(sounding(v)).toEqual([64]);
    v.release(64);
    v.patch.hold = false;
    take(v, 0.05);
    expect(sounding(v)).toEqual([]);
  });

  const walk = (patch: Partial<PolyPatch>, keys: number[], steps: number) => {
    const v = voices({ arp: true, arpRate: 0, ...patch }), seen: number[] = [];
    for (const k of keys) v.press(k);
    for (let i = 0; i < steps * 40; i++) {
      take(v, 0.0125);
      const n = sounding(v)[0];
      if (n !== undefined && seen.at(-1) !== n) seen.push(n);
    }
    return seen.slice(0, steps);
  };

  it('the arpeggiator walks up, down, and up and back', () => {
    expect(walk({ arpMode: 0 }, [60, 64, 67], 5)).toEqual([60, 64, 67, 60, 64]);
    expect(walk({ arpMode: 2 }, [60, 64, 67], 4)).toEqual([67, 64, 60, 67]);
    expect(walk({ arpMode: 1 }, [60, 64, 67], 6)).toEqual([60, 64, 67, 64, 60, 64]);
  });

  it('runs over its octaves', () => {
    expect(walk({ arpRange: 2 }, [60, 64], 4)).toEqual([60, 64, 72, 76]);
  });

  it('the lever bends the pitch', () => {
    const v = voices({ bend: 1, bendDco: 2 / 12 });
    v.press(69);
    take(v, 0.1);
    expect(pitch(take(v, 0.5)[0])).toBeCloseTo(493.9, -0.5);
  });

  it('the slow oscillator waits out its delay', () => {
    const wobble = (lfoDelay: number) => {
      const v = voices({ dcoLfo: 1, lfoRate: 0.5, lfoDelay });
      v.press(69);
      const [l] = take(v, 0.6), edges = [];
      for (let i = 1; i < l.length; i++) if (l[i - 1]! < 0 && l[i]! >= 0) edges.push(i);
      const gaps = edges.slice(1).map((e, i) => e - edges[i]!);
      return Math.max(...gaps) - Math.min(...gaps);
    };
    expect(wobble(1)).toBeLessThan(wobble(0));
  });

  it('stays bounded with everything up', () => {
    const v = voices({ resonance: 1, cutoff: 0.5, envAmount: 1, pulse: true, sub: true, noise: 1, level: 1, chorus: 3 });
    for (let k = 40; k < 46; k++) v.press(k);
    const [l] = take(v, 1);
    expect(Math.max(...l.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(rms(l)).toBeGreaterThan(0.01);
  });
});
