import { FINISHES, atTexel, defineMaterial, getMaterialDef, levelled, resolveMaterial, roughOf } from 'device-ui';
import { expect, test } from 'vitest';
import { materials as shared } from '../../src/materials/index.js';
import { materials as masonry } from '../../src/packs/masonry';

const materials = { ...shared, ...masonry };

test('every material says what it is', () => {
  const missing = Object.entries(materials).filter(([, m]) => !m.substance).map(([name]) => name);
  expect(missing).toEqual([]);
});

test('every material says how it was made', () => {
  const missing = Object.entries(materials).filter(([, m]) => !m.finish).map(([name]) => name);
  expect(missing).toEqual([]);
});

test('no recipe sets structure by hand', () => {
  const set = Object.entries(materials).filter(([, m]) => 'grain' in m || 'peel' in m).map(([name]) => name);
  expect(set).toEqual([]);
});

// `none` is a claim about the surface. Anything else that says it has to earn a place here.
const BARE = {
  broad: ['still'],
  pattern: ['polished-mould', 'flowed-film', 'clear-lacquer', 'lacquered-metal', 'polished-metal', 'float-glass', 'still'],
  fine: ['polished-metal', 'float-glass', 'still'],
};

test('every finish states all three sizes, and only mirrors and glass say none', () => {
  for (const size of ['broad', 'pattern', 'fine'] as const) {
    const bare = Object.entries(FINISHES).filter(([, f]) => f[size] === 'none').map(([name]) => name);
    expect(bare.sort(), size).toEqual([...BARE[size]].sort());
    for (const f of Object.values(FINISHES)) expect(f[size], size).toBeDefined();
  }
});

test('a material with no finish takes its substance\'s', () => {
  defineMaterial('test-board', { substance: 'wood', color: '#806040' });
  defineMaterial('test-oiled', { substance: 'wood', finish: 'oiled-wood', color: '#806040' });
  const m = resolveMaterial('test-board');
  expect(m).toEqual(resolveMaterial('test-oiled'));
  expect(m.relief).toBeGreaterThan(0);
  expect(m.rough).toBeCloseTo(roughOf(FINISHES['oiled-wood'].fine));
});

test('a recipe can still say its own roughness', () => {
  defineMaterial('test-worn', { substance: 'metal', finish: 'bead-blast', rough: 0.7 });
  expect(resolveMaterial('test-worn').rough).toBe(0.7);
});

test('grain and peel still override a finish', () => {
  const plain = resolveMaterial('brushed-steel');
  expect(plain.grain[0]).toBeGreaterThan(0);
  const off = resolveMaterial('brushed-steel', { grain: [0, 1, 1] });
  expect(off.grain[0]).toBe(0);
  expect(off.slope).toBe(0);
  expect(off.relief).toBe(0);
  expect(resolveMaterial('brushed-steel', { peel: 0 }).peel).toBe(0);
  expect(resolveMaterial('brushed-steel', { peel: 0.02 }).peel).toBeCloseTo(0.01);
});

test('sound reads a finish\'s metal, roughness and pattern from the plain definition', () => {
  const def = getMaterialDef('brushed-steel');
  expect(def.metal).toBe(1);
  expect(def.rough).toBeCloseTo(roughOf(FINISHES['brushed-metal'].fine));
  expect(def.pattern).toBe('lines');
});

test('fine structure is slope: the same Ra is rougher packed closer', () => {
  expect(roughOf({ ra: 0.001, spacing: 0.02 })).toBeGreaterThan(roughOf({ ra: 0.001, spacing: 0.2 }));
  expect(roughOf('none')).toBeLessThan(0.1);
});

test('below a texel a pattern stops being height and becomes roughness', () => {
  const m = resolveMaterial('shell-black');
  const sharp = atTexel(m, 0.01), oneX = atTexel(m, 4), threeX = atTexel(m, 4 / 3);
  expect(sharp.height).toBeCloseTo(m.grain[0]);
  expect(sharp.rough).toBeCloseTo(m.rough);
  expect(oneX.height).toBeLessThan(threeX.height);
  expect(threeX.height).toBeLessThan(sharp.height);
  expect(oneX.rough).toBeGreaterThan(threeX.rough);
  expect(threeX.rough).toBeGreaterThan(m.rough);
  const far = atTexel(m, 400);
  expect(far.height).toBeLessThan(sharp.height * 0.02);
  expect(far.rough).toBeLessThanOrEqual(1);
});

test('a pattern a texel can hold keeps its height and roughness', () => {
  const m = resolveMaterial('leather-tan');
  expect(atTexel(m, 1).height).toBeCloseTo(m.relief);
  expect(atTexel(m, 1).rough).toBeCloseTo(m.rough);
});

test('a shape that is not noise fades out and pays in roughness', () => {
  const m = resolveMaterial('grip-black');
  const gone = atTexel(m, 100);
  expect(gone.height).toBe(0);
  expect(gone.rough).toBeGreaterThan(m.rough);
});

test('a coat lets long waves through and levels short ones', () => {
  expect(levelled(50, 1)).toBeGreaterThan(0.99);
  expect(levelled(3, 1)).toBeGreaterThan(0.9);
  expect(levelled(0.5, 1)).toBeLessThan(0.01);
  expect(levelled(0.5, 0)).toBe(1);
  expect(levelled(1.5, 0.2)).toBeGreaterThan(levelled(1.5, 1));
});

test('a coat levels any material it lands on', () => {
  const bare = resolveMaterial('leather-tan'), coated = resolveMaterial('leather-tan', { coat: 1 });
  expect(coated.relief).toBeLessThan(bare.relief * 0.1);
  const stipple = resolveMaterial('shell-black', { coat: 1 });
  expect(stipple.grain[0]).toBeLessThan(0.001);
});

test('chrome and foil keep what is under them', () => {
  expect(resolveMaterial('foil-gold').relief).toBeCloseTo(resolveMaterial('foil-gold', { coat: 0 }).relief);
});

test('a liquid takes no marks and no wear', () => {
  defineMaterial('test-coffee', { substance: 'liquid', color: '#1c0f08', rough: 0.08 });
  const m = resolveMaterial('test-coffee', { wear: 1 });
  expect(m.marks).toBe(0);
  expect(m.wear).toBe(0);
});

test('soft finishes burnish and painted ones chip', () => {
  expect(resolveMaterial('soft-touch-white').polish).toBe(1);
  expect(resolveMaterial('soft-touch-white').sheen).toBeGreaterThan(0);
  expect(resolveMaterial('enamel-cream').polish).toBe(0);
});

test('nothing wears unless its substance says how', () => {
  defineMaterial('test-unknown', { color: '#808080' });
  const m = resolveMaterial('test-unknown', { wear: 1 });
  expect(m.wear).toBe(0);
  expect(m.marks).toBe(0);
});
