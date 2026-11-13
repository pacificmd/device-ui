import { describe, expect, it } from 'vitest';
import { Spring } from '../../src/base/index';

const run = (s: Spring, dt: number, limit = 2000) => {
  let frames = 0;
  while (s.step(dt) && frames < limit) frames++;
  return frames;
};

describe('Spring', () => {
  it('starts at rest', () => {
    const s = new Spring({ stiffness: 100, damping: 20, value: 3 });
    expect(s.value).toBe(3);
    expect(s.active).toBe(false);
    expect(s.step(1 / 60)).toBe(false);
  });

  it('settles on its target and stops', () => {
    const s = new Spring({ stiffness: 420, damping: 30 });
    s.set(1);
    expect(run(s, 1 / 60)).toBeLessThan(600);
    expect(s.value).toBe(1);
    expect(s.velocity).toBe(0);
    expect(s.active).toBe(false);
  });

  it('stays stable when stiff and stepped slowly', () => {
    const s = new Spring({ stiffness: 2600, damping: 62, value: -1 });
    s.set(1);
    run(s, 1 / 30);
    expect(s.value).toBe(1);
  });

  it('still wants drawing after a snap, once', () => {
    const s = new Spring({ stiffness: 100, damping: 10 });
    s.snap(1);
    expect(s.active).toBe(true);
    expect(s.step(1 / 60)).toBe(false);
    expect(s.active).toBe(false);
  });

  it('jumps with snap', () => {
    const s = new Spring({ stiffness: 100, damping: 20 });
    s.set(1);
    s.step(1 / 60);
    s.snap(0.5);
    expect(s.value).toBe(0.5);
    s.step(1 / 60);
    expect(s.value).toBe(0.5);
    expect(s.active).toBe(false);
  });

  it('skips the motion when told to', () => {
    const s = new Spring({ stiffness: 100, damping: 20 });
    s.set(1);
    expect(s.step(1 / 60, true)).toBe(false);
    expect(s.value).toBe(1);
  });

  describe('through', () => {
    const key = () => new Spring({ stiffness: 1400, damping: 46, through: true });

    it('finishes a press when the release comes straight away', () => {
      const s = key();
      s.set(1);
      s.step(1 / 60);
      s.set(0);
      let deepest = 0;
      for (let i = 0; i < 60; i++) {
        s.step(1 / 60);
        deepest = Math.max(deepest, s.value);
      }
      expect(deepest).toBeGreaterThan(0.9);
      expect(run(s, 1 / 60)).toBe(0);
      expect(s.value).toBe(0);
    });

    it('takes a release at once when the press has already arrived', () => {
      const s = key();
      s.set(1);
      run(s, 1 / 60);
      s.set(0);
      expect(s.target).toBe(0);
    });

    it('can be pressed again on the way back up', () => {
      const s = key();
      s.set(1);
      run(s, 1 / 60);
      s.set(0);
      s.step(1 / 60);
      s.set(1);
      expect(s.target).toBe(1);
    });

    it('keeps holding if the key is pressed again before it arrives', () => {
      const s = key();
      s.set(1);
      s.set(0);
      s.set(1);
      run(s, 1 / 60);
      expect(s.value).toBe(1);
    });

    it('leaves other springs alone', () => {
      const s = new Spring({ stiffness: 1400, damping: 46 });
      s.set(1);
      s.step(1 / 60);
      s.set(0);
      expect(s.target).toBe(0);
    });
  });
});
