import { describe, expect, it } from 'vitest';
import { Eye } from '../../src/base/eye';

const studio = { room: 1, lights: 0, glow: 0 };
const flash = { room: 1, lights: 3, glow: 0 };

describe('eye', () => {
  it('is exposed at 1 in the studio, and shows a room ten times darker brighter but not ten times', () => {
    const eye = new Eye();
    eye.look(studio, 0);
    expect(eye.exposure).toBeCloseTo(1, 6);
    const dark = new Eye();
    dark.look({ room: 0.1, lights: 0, glow: 0 }, 0);
    expect(dark.exposure).toBeGreaterThan(3.8);
    expect(dark.exposure).toBeLessThan(4.8);
  });

  it('follows a change at the cones’ pace, from when it sees it, however long it sat settled before', () => {
    const eye = new Eye();
    eye.look(studio, 0);
    // Settled, so nothing looks for ten seconds. The flash is seen then, and the eye starts from where it was.
    expect(eye.look(flash, 10_000)).toBe(true);
    expect(eye.exposure).toBeCloseTo(1, 6);
    // A tenth of a second on, it's most of the way, two thirds and more, and not all of it.
    eye.look(flash, 10_100);
    const settledAt = Eye.target(flash), from = Eye.target(studio);
    const moved = (eye.adapted! - from) / (settledAt - from);
    expect(moved).toBeGreaterThan(0.6);
    expect(moved).toBeLessThan(0.7);
    for (let t = 10_100; eye.look(flash, t); t += 16);
    expect(eye.adapted).toBe(settledAt);
  });
});
