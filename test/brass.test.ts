import { describe, expect, it } from 'vitest';
import { BRASS_CORE } from '../src/sound/brass';

// The lip and the tube, without a browser. What matters is that nothing tells it the pitch: it has to find it.
type Core = { valve(i: number, down: boolean): void; tick(): number; partial: number; partialTo: number; pressureTo: number };
const Make = new Function(`${BRASS_CORE}; return BrassCore;`)() as new (rate: number, length: number, valves: number[]) => Core;
const RATE = 44100, LENGTH = 1.48, VALVES = [0.182, 0.088, 0.28];

const run = (c: Core, n: number) => Float32Array.from({ length: n }, () => c.tick());
const pitch = (b: Float32Array) => {
  const r: number[] = [];
  for (let l = 30; l < 1000; l++) {
    let s = 0;
    for (let i = 0; i + l < b.length; i++) s += b[i]! * b[i + l]!;
    r[l] = s;
  }
  const top = Math.max(...r.slice(30));
  for (let l = 31; l < 999; l++) if (r[l]! > r[l - 1]! && r[l]! >= r[l + 1]! && r[l]! > 0.9 * top) return RATE / (l + (0.5 * (r[l - 1]! - r[l + 1]!)) / (r[l - 1]! - 2 * r[l]! + r[l + 1]!));
  return 0;
};
const blown = (down: number[], partial: number) => {
  const c = new Make(RATE, LENGTH, VALVES);
  down.forEach(v => c.valve(v, true));
  c.partial = c.partialTo = partial;
  c.pressureTo = 0.8;
  return c;
};
const cents = (hz: number, want: number) => 1200 * Math.log2(hz / want);
const NOTE = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

describe('a valved tube and a pair of lips', () => {
  it('speaks the partials of the open tube, as a Bb trumpet does', () => {
    // Bb3 F4 Bb4 D5 F5 Bb5. The fifth partial really is flat of tempered, which is why it's never tuned out here.
    for (const [partial, midi] of [[2, 58], [3, 65], [4, 70], [5, 74], [6, 77], [8, 82]] as const) {
      expect(Math.abs(cents(pitch(run(blown([], partial), 30000).slice(-6000)), NOTE(midi)))).toBeLessThan(25);
    }
  });

  it('comes down the chromatic scale as the valves go down', () => {
    for (const [down, midi] of [[[1], 69], [[0], 68], [[0, 1], 67], [[1, 2], 66]] as const) {
      expect(Math.abs(cents(pitch(run(blown([...down], 4), 30000).slice(-6000)), NOTE(midi)))).toBeLessThan(25);
    }
  });

  it('goes sharp on the long fingerings, from nothing but lengths that add up', () => {
    const sharp = cents(pitch(run(blown([0, 1, 2], 4), 30000).slice(-6000)), NOTE(64));
    expect(sharp).toBeGreaterThan(20);
    expect(sharp).toBeLessThan(70);
  });

  it('every fingering holds every partial, without cracking or falling silent', () => {
    for (const down of [[], [0], [1], [0, 1], [1, 2], [0, 2], [0, 1, 2]]) for (const partial of [2, 3, 4, 5, 6, 8]) {
      const want = (343 / (2 * (LENGTH + down.reduce((a, v) => a + VALVES[v]!, 0)))) * partial;
      expect(Math.abs(cents(pitch(run(blown(down, partial), 30000).slice(-6000)), want)), `${down} on ${partial}`).toBeLessThan(55);
    }
  });

  it('changes note when a valve goes down while it sounds, and comes back', () => {
    const c = blown([], 4);
    run(c, 15000);
    c.valve(0, true);
    run(c, 22000);
    expect(Math.abs(cents(pitch(run(c, 6000)), NOTE(68)))).toBeLessThan(25);
    c.valve(0, false);
    run(c, 22000);
    expect(Math.abs(cents(pitch(run(c, 6000)), NOTE(70)))).toBeLessThan(25);
  });

  it('stops when the player stops', () => {
    const c = blown([], 4);
    run(c, 15000);
    c.pressureTo = 0;
    run(c, 44100);
    expect(Math.max(...run(c, 2000).map(Math.abs))).toBeLessThan(0.002);
  });
  it('holds a note through any jump a hand can make', () => {
    for (const from of [[0, 1, 2], [0], []]) for (const [a, b] of [[4, 8], [8, 2], [2, 8], [3, 6]]) {
      const c = blown(from, a!);
      run(c, 22000);
      from.forEach(v => c.valve(v, false));
      c.partialTo = b!;
      run(c, 22050);
      const tail = run(c, 8000), level = Math.sqrt(tail.reduce((t, x) => t + x * x, 0) / tail.length);
      expect(level, `${from} ${a} to ${b}`).toBeGreaterThan(0.05);
    }
  }, 60000);
});
