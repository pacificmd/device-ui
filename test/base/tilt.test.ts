import { describe, expect, it } from 'vitest';
import { upFrom } from '../../src/base/tilt.js';

describe('upFrom', () => {
  const near = ([x, y]: [number, number], wantX: number, wantY: number) => {
    expect(x).toBeCloseTo(wantX, 5);
    expect(y).toBeCloseTo(wantY, 5);
  };

  it('is the middle of a phone lying flat', () => near(upFrom(0, 0), 0, 0));

  it('leans towards whichever edge is raised', () => {
    expect(upFrom(0, 30)[0]).toBeLessThan(0);
    expect(upFrom(0, -30)[0]).toBeGreaterThan(0);
    expect(upFrom(30, 0)[1]).toBeGreaterThan(0);
    expect(upFrom(-30, 0)[1]).toBeLessThan(0);
  });

  it('is off the top of the screen for a phone held upright', () => near(upFrom(90, 0), 0, 1));

  it('stays steady upright, where gamma stops meaning anything', () => near(upFrom(90, 70), 0, 1));

  it('follows the screen round when the phone is turned', () => {
    // Anticlockwise, the phone's top edge is the left of the screen and its right edge the top.
    near(upFrom(90, 0, 90), -1, 0);
    near(upFrom(0, -90, 90), 0, 1);
    // Clockwise, the other way about.
    near(upFrom(90, 0, -90), 1, 0);
    near(upFrom(0, 90, -90), 0, 1);
    // Upside down.
    near(upFrom(90, 0, 180), 0, -1);
  });
});
