import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PADS, PPQ, RATE, sampled, Sequence, sequencer, swung, unswung, type Drums } from '../../src/sound/drums.js';

describe('the kit', () => {
  it('has sixteen pads, every one of them making a sound', () => {
    expect(PADS).toHaveLength(16);
    for (const pad of PADS) expect(sampled(pad).reduce((top, v) => Math.max(top, Math.abs(v)), 0), pad.name).toBeGreaterThan(0.1);
  });

  it('holds every sample at a whole step of 12 bits', () => {
    for (const v of sampled(PADS[1]!).slice(0, 2000)) expect(Math.abs(v * 2047 - Math.round(v * 2047))).toBeLessThan(1e-3);
  });

  it('ends each sound on nothing, so a hit never clicks off', () => {
    for (const pad of PADS) expect(Math.abs(sampled(pad).at(-1)!), pad.name).toBe(0);
  });

  it('is the same every time', () => {
    expect(sampled(PADS[1]!)).toEqual(sampled(PADS[1]!));
  });

  it('puts the bass well under the snare', () => {
    const crossings = (d: Float32Array) => d.reduce((n, v, i) => n + (i && v * d[i - 1]! < 0 ? 1 : 0), 0) / (d.length / RATE);
    expect(crossings(sampled(PADS[3]!))).toBeLessThan(crossings(sampled(PADS[1]!)) / 4);
  });
});

describe('swing', () => {
  const S = PPQ / 4;

  it('leaves the beat and the first sixteenth of a pair where they are', () => {
    expect(swung(0, 0.66)).toBe(0);
    expect(swung(S * 2, 0.66)).toBe(S * 2);
    expect(swung(PPQ, 0.75)).toBe(PPQ);
  });

  it('pushes the second sixteenth late', () => {
    expect(swung(S, 0.5)).toBe(S);
    expect(swung(S, 0.66)).toBeCloseTo(S * 2 * 0.66);
    expect(swung(S, 0.75)).toBeCloseTo(S * 1.5);
  });

  it('comes back the same way', () => {
    for (let t = 0; t < PPQ * 2; t += 7) expect(unswung(swung(t, 0.62), 0.62)).toBeCloseTo(t);
  });
});

describe('a sequence', () => {
  const S = PPQ / 4;

  it('pulls a late hit onto the grid', () => {
    const s = new Sequence();
    expect(s.add(S + 7, 1, 1).tick).toBe(S);
    expect(s.add(S * 3 - 8, 2, 1).tick).toBe(S * 3);
  });

  it('wraps a hit just before the top of the loop to the top', () => {
    const s = new Sequence(1);
    expect(s.add(s.ticks - 2, 3, 1).tick).toBe(0);
  });

  it('places a hit played with the swing on the sixteenth it swung from', () => {
    expect(new Sequence().add(swung(S, 0.7), 1, 1, S, 0.7).tick).toBe(S);
  });

  it('keeps a hit where it fell with no grid', () => {
    expect(new Sequence().add(S + 7, 1, 1, 0).tick).toBe(S + 7);
  });

  it('holds one hit of a pad to a place', () => {
    const s = new Sequence();
    s.add(0, 1, 0.5);
    s.add(1, 1, 1);
    expect(s.notes).toEqual([{ tick: 0, pad: 1, level: 1 }]);
  });

  it('erases one pad or all of them', () => {
    const s = new Sequence();
    s.add(0, 1, 1);
    s.add(0, 2, 1);
    s.erase(1);
    expect(s.notes.map(n => n.pad)).toEqual([2]);
    s.erase();
    expect(s.notes).toEqual([]);
  });
});

describe('the sequencer', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  const kit = () => {
    const hits: [number, number][] = [];
    const k = {
      volume: 1, decay: 0, now: 0, wake() {}, click() {}, close() {}, scope: () => null,
      hit(pad: number, _level?: number, at = 0) {
        hits.push([pad, at]);
      },
    } satisfies Drums;
    /** Runs the clock on, as the audio would. */
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.025) {
        k.now += 0.025;
        vi.advanceTimersByTime(25);
      }
    };
    return { k, hits, run };
  };

  it('plays each hit in its place, and the off sixteenth late by the swing', () => {
    const { k, hits, run } = kit(), s = new Sequence();
    s.add(0, 0, 1);
    s.add(PPQ / 4, 1, 1);
    s.add(PPQ, 2, 1);
    const seq = sequencer(k, s, 120, 0.75);
    seq.play();
    run(0.8);
    seq.stop();
    const [first, second, third] = hits;
    expect(first![1]).toBeCloseTo(0.05);
    expect(second![1] - first![1]).toBeCloseTo(0.1875, 2);
    expect(third![1] - first![1]).toBeCloseTo(0.5, 2);
  });

  it('comes round the loop', () => {
    const { k, hits, run } = kit(), s = new Sequence(1);
    s.add(0, 0, 1);
    const seq = sequencer(k, s, 120);
    seq.play();
    run(4.5);
    seq.stop();
    expect(hits.map(h => Math.round(h[1] * 100) / 100)).toEqual([0.05, 2.05, 4.05]);
  });

  it('keeps time when a frame is late', () => {
    const { k, hits, run } = kit(), s = new Sequence(1);
    for (let q = 0; q < 4; q++) s.add(q * PPQ, 0, 1);
    const seq = sequencer(k, s, 120);
    seq.play();
    run(0.3);
    k.now += 0.1; // A slow frame, less than it looks ahead.
    run(0.8);
    seq.stop();
    expect(hits[2]![1] - hits[1]![1]).toBeCloseTo(0.5, 3);
  });

  it('knows where the playhead is', () => {
    const { k, run } = kit(), seq = sequencer(k, new Sequence(1), 120);
    seq.play();
    run(0.55);
    expect(seq.tick).toBeCloseTo(PPQ, -1);
    seq.stop();
    expect(seq.playing).toBe(false);
  });
});
