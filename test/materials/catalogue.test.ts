import { FINISHES, type FinishName } from 'device-ui';
import { expect, test } from 'vitest';
import { finishSheet, recipes } from '../../src/materials/catalogue.js';
import { materials as shared } from '../../src/materials/index.js';
import { materials as masonry } from '../../src/packs/masonry';

const materials = { ...shared, ...masonry };

const all = recipes(materials);
const of = (name: string) => all.find(r => r.colours.includes(name))!;

test('every material is in exactly one recipe', () => {
  expect(all.flatMap(r => r.colours).sort()).toEqual(Object.keys(materials).sort());
});

test('colourways are one recipe whatever they were written as', () => {
  expect(of('keycap-ivory').colours).toContain('keycap-red');
  expect(of('keycap-ivory').name).toBe('keycap');
  expect(of('plastic-red').colours).toContain('plastic-black');
  expect(of('soft-touch-sage').name).toBe('soft-touch');
});

test('the same words with a different process are not a colourway', () => {
  expect(of('aluminium-face')).not.toBe(of('aluminium-space'));
  expect(of('leather-saddle')).not.toBe(of('leather-tan'));
  expect(of('knurled-fine')).not.toBe(of('knurled'));
});

// These share a stem and a finish and differ on purpose. Anything else that does has drifted: one
// colour has been tuned, and a fix to the recipe won't reach it.
const APART = new Set(['lcd', 'glass', 'sticker-vinyl', 'pcb', 'dial', 'titanium', 'rubber', 'knurled', 'carbon', 'brushed']);

test('colourways have not drifted apart', () => {
  const seen = new Map<string, string>(), drifted: string[] = [];
  for (const r of all) {
    const name = r.colours.length === 1 && r.name.includes('-') ? r.name.slice(0, r.name.lastIndexOf('-')) : r.name;
    if (APART.has(name)) continue;
    const key = `${name} ${r.finish}`;
    if (seen.has(key)) drifted.push(`${seen.get(key)} / ${r.colours.join(',')}`);
    seen.set(key, r.colours.join(','));
  }
  expect(drifted).toEqual([]);
});

test('every finish says what it is and marks every value', () => {
  for (const name of Object.keys(FINISHES) as FinishName[]) {
    const sheet = finishSheet(name);
    expect(sheet.what.length, name).toBeGreaterThan(10);
    for (const row of sheet.rows) {
      expect(row.values.length, name).toBe(row.none ? 0 : 2);
      for (const v of row.values) expect(['spec', 'measured', 'guess']).toContain(v.mark);
    }
  }
});

test('a mark lands on the value it names', () => {
  const blast = finishSheet('bead-blast').rows.find(r => r.size === 'fine')!;
  expect(blast.values.find(v => v.label === 'Ra')!.mark).toBe('spec');
  expect(blast.values.find(v => v.label === 'spacing')!.mark).toBe('guess');
  expect(finishSheet('polished-metal').rows.find(r => r.size === 'fine')!.none).toBe(true);
});
