import { describe, expect, it } from 'vitest';
import { bounds, capsule, circle, holes, mask, path, rect, text, within } from '../../src/base/index';

describe('shapes', () => {
  it('stores rects by centre and half size', () => {
    expect(rect(10, 20, 100, 40)).toMatchObject({ cx: 60, cy: 40, hw: 50, hh: 20, radius: 0, rotate: 0 });
  });

  it('caps a radius at half the short side', () => {
    expect(rect(0, 0, 100, 40, { radius: 99 }).radius).toBe(20);
  });

  it('makes circles from rounded rects, with optional scallops', () => {
    expect(circle(5, 6, 7)).toMatchObject({ cx: 5, cy: 6, hw: 7, hh: 7, radius: 7, ripple: [0, 0, 0] });
    expect(circle(0, 0, 7, { ripple: [48, 0.5] }).ripple).toEqual([48, 0.5, 0]);
    expect(circle(0, 0, 7, { vee: [48, 0.5] }).ripple).toEqual([48, 0.5, 1]);
    expect(circle(0, 0, 7, { scoop: [12, 0.5] }).ripple).toEqual([12, 0.5, 2]);
  });

  it('keys fields by what they draw, not where', () => {
    const a = path('M0 0', 0, 0, 40, 40), b = path('M0 0', 90, 90, 40, 40), c = path('M1 1', 0, 0, 40, 40);
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(path('M0 0', 0, 0, 80, 40).key).not.toBe(a.key);
    expect(text('A', 0, 0, 9, 9, { font: '12px a' }).key).not.toBe(text('A', 0, 0, 9, 9, { font: '12px b' }).key);
  });

  it('keeps a field the same when only the rotation changes', () => {
    expect(path('M0 0', 0, 0, 40, 40, { rotate: 1 }).key).toBe(path('M0 0', 0, 0, 40, 40).key);
  });
});

describe('bounds', () => {
  it('adds a margin', () => {
    expect(bounds(rect(10, 10, 20, 20), 2)).toEqual({ x: 8, y: 8, w: 24, h: 24 });
    expect(bounds(mask({ x: 1, y: 2, w: 3, h: 4 }), 1)).toEqual({ x: 0, y: 1, w: 5, h: 6 });
  });

  it('grows to hold a rotated rect', () => {
    const b = bounds(rect(-50, -5, 100, 10, { rotate: Math.PI / 2 }), 0);
    expect(b.w).toBeCloseTo(10);
    expect(b.h).toBeCloseTo(100);
    const d = bounds(rect(-10, -10, 20, 20, { rotate: Math.PI / 4 }), 0);
    expect(d.w).toBeCloseTo(20 * Math.SQRT2);
  });

  it('holds both ends of a capsule, at the wider radius', () => {
    expect(bounds(capsule(0, 0, 0, -30, 3, 6), 0)).toEqual({ x: -6, y: -36, w: 12, h: 42 });
  });

  it('includes a field spread, which is where its distances run out', () => {
    expect(bounds(path('M0 0', 0, 0, 40, 40, { spread: 10 }), 0)).toEqual({ x: -10, y: -10, w: 60, h: 60 });
  });

  it('keeps a stopped shape as its own drawing, on the same box', () => {
    const wide = path('M-5 -5 H45 V40 H-5 Z', 0, 0, 40, 40, { viewBox: [0, 0, 40, 40], spread: 20 }), stopped = within(wide, rect(0, 0, 40, 40));
    expect(stopped.key).not.toBe(wide.key);
    expect(stopped.key).not.toBe(within(wide, rect(0, 0, 30, 40)).key);
    expect(bounds(stopped, 0)).toEqual(bounds(wide, 0));
  });

  it('ignores rotation on holes', () => {
    expect(bounds(holes(0, 0, 40, 20), 1)).toEqual({ x: -1, y: -1, w: 42, h: 22 });
  });
});
