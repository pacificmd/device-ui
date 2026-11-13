import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packs = new URL('../../src/packs/', import.meta.url);

describe('the one-file script', () => {
  it('holds every pack', () => {
    const all = readFileSync(new URL('../../src/script/all.ts', import.meta.url), 'utf8');
    for (const file of readdirSync(packs).filter(f => f.endsWith('.ts'))) expect(all).toContain(`import 'device-ui/${file.slice(0, -3)}';`);
  });
});
