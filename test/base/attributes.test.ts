import { describe, expect, it } from 'vitest';
import { closest, unknownAttributes } from '../../src/base/attributes';
import { definePart } from '../../src/base/index';
import { READS } from '../../src/base/reads';

const el = (localName: string, ...attributes: string[]) => ({
  localName,
  getAttributeNames: () => attributes,
  getAttribute: () => '',
  hasAttribute: (name: string) => attributes.includes(name),
  matches: (selector: string) => selector === localName,
}) as unknown as Element;

describe('attributes nothing reads', () => {
  it('finds one on a part the catalogue lists', () => {
    expect(unknownAttributes(el('d-surface', 'hieght', 'height')).map(a => a.name)).toEqual(['hieght']);
  });

  it('says what the form reads', () => {
    const [wrong] = unknownAttributes(el('d-surface', 'hieght'));
    expect(wrong!.form).toBe('d-surface');
    expect(wrong!.reads).toContain('height');
  });

  it('takes what any part reads, and what any element may carry', () => {
    expect(unknownAttributes(el('d-surface', 'fixed', 'scale', 'class', 'role', 'aria-label', 'data-x', 'd-layer'))).toEqual([]);
  });

  it('takes what a device reads for the parts on it', () => {
    expect(READS['d-device']).toContain('keycap');
    expect(unknownAttributes(el('d-device', 'keycap', 'keycapp')).map(a => a.name)).toEqual(['keycapp']);
  });

  it('takes what a device reads on a part with no device round it', () => {
    expect(unknownAttributes(el('d-surface', 'lighting')).map(a => a.name)).toEqual(['lighting']);
    expect(unknownAttributes(el('d-surface', 'lighting', 'data-alone'))).toEqual([]);
  });

  it("leaves alone a part someone made, whose reads it can't know", () => {
    definePart({ selector: 'd-attrs-own', paint() {} });
    expect(unknownAttributes(el('d-attrs-own', 'anything'))).toEqual([]);
  });

  it('leaves alone what is no part', () => {
    expect(unknownAttributes(el('div', 'anything'))).toEqual([]);
  });
});

describe('what it was probably meant to be', () => {
  it('finds a near name', () => {
    expect(closest('hieght', ['material', 'height'])).toBe('height');
    expect(closest('colour', ['color', 'material'])).toBe('color');
  });

  it("doesn't guess when nothing is near", () => {
    expect(closest('altogether', ['height', 'color'])).toBeUndefined();
    expect(closest('at', ['height', 'color'])).toBeUndefined();
  });
});
