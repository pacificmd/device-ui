import { getMaterialDef, linear } from 'device-ui';
import { expect, test } from 'vitest';
import { materials as shared } from '../../src/materials/index.js';
import { materials as masonry } from '../../src/packs/masonry';

const materials = { ...shared, ...masonry };

const lum = (hex: string) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

// The default legend is pale, so a pale material that names none prints pale on pale.
test('anything that can take print has a legend that reads on it', () => {
  const faint = Object.keys(materials).filter(name => {
    const m = getMaterialDef(name);
    if (m.text || typeof m.color !== 'string' || typeof m.legend !== 'string') return false;
    return contrast(m.color, m.legend) < 2.5;
  });
  expect(faint).toEqual([]);
});
