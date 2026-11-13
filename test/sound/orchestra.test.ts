import { describe, expect, it } from 'vitest';
import { bow, choir, membrane } from '../../src/sound/orchestra.js';

const RATE = 48000;
const peak = (d: Float32Array) => d.reduce((top, v) => Math.max(top, Math.abs(v)), 0);
/** How loud one frequency is in a stretch of sound. */
const at = (d: Float32Array, hz: number, from = 0, len = 9600) => {
  let re = 0, im = 0;
  for (let i = from; i < from + len; i++) {
    re += d[i]! * Math.cos((2 * Math.PI * hz * i) / RATE);
    im += d[i]! * Math.sin((2 * Math.PI * hz * i) / RATE);
  }
  return Math.hypot(re, im) / len;
};

describe('a kettle drum', () => {
  const d = membrane(RATE, { hz: 98 });

  it('sounds its note, louder than the notes either side', () => {
    expect(at(d, 98, 4800)).toBeGreaterThan(at(d, 82, 4800) * 3);
    expect(at(d, 98, 4800)).toBeGreaterThan(at(d, 117, 4800) * 3);
  });

  it('peaks where it was asked, and ends on nothing', () => {
    expect(peak(d)).toBeCloseTo(0.8, 5);
    expect(d.at(-1)).toBe(0);
  });

  it('dies away, and dies sooner with a hand on it', () => {
    const late = (x: Float32Array) => peak(x.subarray(RATE, RATE * 1.2));
    expect(late(d)).toBeLessThan(0.4);
    expect(late(membrane(RATE, { hz: 98, damp: 0.8 }))).toBeLessThan(late(d) / 2.5);
  });

  it('is the same every time', () => {
    expect(membrane(RATE, { hz: 98 })).toEqual(d);
  });
});

describe('a choir', () => {
  const [l, r] = choir(RATE, { notes: [220, 330], seconds: 1.5, vowel: 'a' });

  it('is finite, at its level, and ends on nothing on both sides', () => {
    for (const d of [l, r]) {
      expect(d.every(Number.isFinite)).toBe(true);
      expect(d.at(-1)).toBe(0);
    }
    expect(Math.max(peak(l), peak(r))).toBeCloseTo(0.8, 5);
  });

  it('stands its sections apart', () => {
    // Its singers are never quite on the note, so listen across the band round it.
    const band = (d: Float32Array, hz: number) => [-8, -4, 0, 4, 8].reduce((sum, k) => sum + at(d, hz + k, 24000, 24000), 0);
    expect(band(l, 220)).toBeGreaterThan(band(r, 220) * 1.5);
    expect(band(r, 330)).toBeGreaterThan(band(l, 330) * 1.5);
  });

  it('opens its throat for an ah and closes it for an oo', () => {
    const [u] = choir(RATE, { notes: [220], seconds: 1.5, vowel: 'u' }), [a] = choir(RATE, { notes: [220], seconds: 1.5, vowel: 'a' });
    // The fourth harmonic sits at 880, near an ah's first ring and far above an oo's.
    const bright = (d: Float32Array) => at(d, 880, 24000) / at(d, 220, 24000);
    expect(bright(a)).toBeGreaterThan(bright(u) * 3);
  });
});

describe('a string section', () => {
  const [l, r] = bow(RATE, { notes: [147, 220], seconds: 2 });

  it('is finite, at its level, and ends on nothing on both sides', () => {
    for (const d of [l, r]) {
      expect(d.every(Number.isFinite)).toBe(true);
      expect(d.at(-1)).toBe(0);
    }
    expect(Math.max(peak(l), peak(r))).toBeCloseTo(0.8, 5);
  });

  it('plays its notes', () => {
    const band = (d: Float32Array, hz: number) => [-4, 0, 4].reduce((sum, k) => sum + at(d, hz + k, 48000, 24000), 0);
    expect(band(l, 147) + band(r, 147)).toBeGreaterThan((band(l, 175) + band(r, 175)) * 3);
  });

  it('swells into the end when asked', () => {
    const [s] = bow(RATE, { notes: [147], seconds: 2, swell: 1, release: 0.1 });
    const rms = (d: Float32Array, from: number) => Math.sqrt(d.slice(from, from + 9600).reduce((a, v) => a + v * v, 0) / 9600);
    expect(rms(s, 76800)).toBeGreaterThan(rms(s, 24000) * 2);
  });

  it('is brighter near the bridge', () => {
    const high = (d: Float32Array) => at(d, 147 * 12, 48000, 24000);
    const [dark] = bow(RATE, { notes: [147], seconds: 2, bright: 0 }), [edge] = bow(RATE, { notes: [147], seconds: 2, bright: 1 });
    expect(high(edge)).toBeGreaterThan(high(dark) * 1.5);
  });

  it('is the same every time', () => {
    expect(bow(RATE, { notes: [147, 220], seconds: 2 })[0]).toEqual(l);
  });
});
