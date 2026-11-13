import { describe, expect, it } from 'vitest';
import { PROFILES, ROWS, SCREWS } from '../../src/packs/controls/anatomy';

// The anatomy is drawn in mm. A px number slipped into one of its tables is four times too big, and these catch it.
describe('the anatomy', () => {
  const sizes = ['M2', 'M3', 'M4'] as const;

  it('keeps screw heads to their ISO sizes', () => {
    for (const size of sizes) for (const [head, [across, tall]] of Object.entries(SCREWS[size].heads)) {
      expect(across, `${size} ${head}`).toBeGreaterThan(3);
      expect(across, `${size} ${head}`).toBeLessThan(9);
      expect(tall, `${size} ${head}`).toBeLessThan(across / 2);
    }
  });

  it('grows every head with its thread', () => {
    for (const head of Object.keys(SCREWS.M2.heads) as (keyof typeof SCREWS.M2.heads)[]) {
      const across = sizes.map(s => SCREWS[s].heads[head][0]);
      expect(across, head).toEqual([...across].sort((a, b) => a - b));
    }
  });

  it('fits every drive inside its head', () => {
    for (const size of sizes) {
      const { heads, slot, cross, hex, star } = SCREWS[size], least = Math.min(...Object.values(heads).map(h => h[0]));
      expect(slot).toBeLessThan(least * 0.25);
      for (const d of [cross, hex, star]) expect(d, size).toBeLessThan(least * 0.8);
    }
  });

  it('keeps keycaps to a 1u cap on an 18mm foot', () => {
    for (const [name, f] of Object.entries(PROFILES)) {
      expect(f.height, name).toBeGreaterThan(5);
      expect(f.height, name).toBeLessThan(14);
      expect(f.top, name).toBeGreaterThan(10);
      expect(f.top, name).toBeLessThan(18);
      expect(f.depth, name).toBeLessThan(1.5);
    }
    for (const [tilt, rise] of ROWS) {
      expect(Math.abs(tilt)).toBeLessThan(15);
      expect(rise).toBeLessThan(2);
    }
  });
});
