import { describe, expect, it } from 'vitest';
import { blackbodyColor, blackbodyLuminance } from '../../src/air/blackbody.js';

// sRGB as stored, 0 to 255, from linear.
const encode = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));

describe('blackbody', () => {
  // Mitchell Charity's table of blackbody colours (2° observer, sRGB, normalised to the brightest channel).
  const table: [number, [number, number, number]][] = [
    [1000, [255, 56, 0]],
    [1500, [255, 109, 0]],
    [2000, [255, 137, 18]],
    [3000, [255, 180, 107]],
    [6500, [255, 249, 253]],
  ];
  it.each(table)('%i K is the colour it is', (kelvin, rgb) => {
    const c = blackbodyColor(kelvin).map(encode);
    c.forEach((v, i) => expect(Math.abs(v - rgb[i]!)).toBeLessThanOrEqual(10));
  });

  it('gets brighter as it gets hotter, steeply where iron glows', () => {
    // Hot iron is dark at 800 K, dull at 1000, bright at 1500: each step hundreds of times the last.
    expect(blackbodyLuminance(1000) / blackbodyLuminance(800)).toBeGreaterThan(100);
    expect(blackbodyLuminance(1500) / blackbodyLuminance(1000)).toBeGreaterThan(1000);
    // At 1500 K a black body is a few thousand cd/m², brighter than any screen.
    expect(blackbodyLuminance(1500)).toBeGreaterThan(3000);
    expect(blackbodyLuminance(1500)).toBeLessThan(15000);
  });
});
