import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineMaterial, defineNames, definePart, hasMaterial, legendColor, linear, parseLength, resolveMaterial, warnOnce, written } from '../../src/base/index';
import { maybePartsSelector, partDefs, partFor, partsSelector, schemed, unknownNames, unknownWords } from '../../src/base/registry';

afterEach(() => vi.restoreAllMocks());

describe('a material that follows the scheme', () => {
  const name = 'light-dark(scheme-pale, scheme-deep)';
  defineMaterial('scheme-pale', { color: '#ffffff' });
  defineMaterial('scheme-deep', { color: '#000000' });
  afterEach(() => { schemed('light'); });

  it('takes the side the scheme says', () => {
    schemed('light');
    expect(resolveMaterial(name).color).toEqual([1, 1, 1]);
    schemed('dark');
    expect(resolveMaterial(name).color).toEqual([0, 0, 0]);
  });

  it('is known by what it stands for', () => {
    expect(hasMaterial(name)).toBe(true);
    expect(hasMaterial('light-dark(scheme-pale, scheme-missing)')).toBe(true);
    schemed('dark');
    expect(hasMaterial('light-dark(scheme-pale, scheme-missing)')).toBe(false);
  });

  it('takes one name for both', () => {
    schemed('dark');
    expect(resolveMaterial('light-dark(scheme-pale)').color).toEqual([1, 1, 1]);
  });

  it('tells a paint that it followed, so the device can repaint when the scheme turns', () => {
    schemed('light');
    resolveMaterial('scheme-pale');
    expect(schemed('light')).toBe(false);
    resolveMaterial(name);
    expect(schemed('light')).toBe(true);
    expect(schemed('light')).toBe(false);
  });
});

describe('materials', () => {
  it('converts sRGB hex to linear', () => {
    expect(linear('#ffffff')).toEqual([1, 1, 1]);
    expect(linear('#000000')).toEqual([0, 0, 0]);
    expect(linear('#808080')[0]).toBeCloseTo(0.2158, 3);
  });

  it('resolves colours and fills in defaults', () => {
    defineMaterial('registry-test', { color: '#ffffff', sub: [0.1, 0.2, 0.3] });
    expect(resolveMaterial('registry-test')).toMatchObject({
      color: [1, 1, 1], sub: [0.1, 0.2, 0.3], rough: 0.5, metal: 0, emit: [0, 0, 0],
    });
  });

  it('warns on an unknown name and still resolves', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(hasMaterial('registry-missing')).toBe(false);
    expect(resolveMaterial('registry-missing').rough).toBe(0.5);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('reads a material legend colour', () => {
    defineMaterial('registry-legend', { legend: '#000000' });
    expect(legendColor('registry-legend')).toEqual([0, 0, 0]);
  });

  it('prints dark on a pale material that says nothing about its ink, and pale on a dark one', () => {
    defineMaterial('registry-pale', { color: '#e8e8e4' });
    defineMaterial('registry-dark', { color: '#1a1a1a' });
    expect(Math.max(...legendColor('registry-pale'))).toBeLessThan(0.05);
    expect(Math.min(...legendColor('registry-dark'))).toBeGreaterThan(0.5);
  });
});

describe('parseLength', () => {
  it('reads millimetres and centimetres', () => {
    expect(parseLength('2mm', 0)).toBe(2);
    expect(parseLength('0.5cm', 0)).toBe(5);
    expect(parseLength('1.5', 0)).toBe(1.5);
    expect(parseLength('-1mm', 0)).toBe(-1);
  });

  it('falls back on anything else', () => {
    expect(parseLength(null, 3)).toBe(3);
    expect(parseLength('', 3)).toBe(3);
    expect(parseLength('2px', 3)).toBe(3);
  });
});

describe('warnings', () => {
  it('says a thing once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), error = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnOnce('registry test, twice');
    warnOnce('registry test, twice');
    warnOnce('registry test, loud', 'error');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith('[device-ui] registry test, twice');
    expect(error).toHaveBeenCalledOnce();
  });

  it('warns about one unknown material once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveMaterial('registry-test-once');
    resolveMaterial('registry-test-once');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('shows an element as it was written, without what is inside', () => {
    const el = (outerHTML: string) => ({ cloneNode: () => ({ outerHTML }) }) as unknown as Element;
    expect(written(el('<div d-knob id="a"></div>'))).toBe('<div d-knob id="a">');
    expect(written(el(`<div d-knob a="${'x'.repeat(200)}"></div>`))).toHaveLength(121);
  });
});

describe('unknown names', () => {
  const el = (localName: string, ...attributes: string[]) => ({
    localName,
    getAttributeNames: () => attributes.map(a => a.split('=')[0]!),
    getAttribute: (name: string) => attributes.find(a => a.startsWith(`${name}=`))?.split('=')[1] ?? '',
  });

  it('knows what parts are written with, in tags and attributes', () => {
    definePart({ selector: 'd-regtag', paint() {} });
    definePart({ selector: 'label[d-regattr], d-regother[detents], .d-regclass', paint() {} });
    expect(unknownNames(el('d-regtag'))).toEqual([]);
    expect(unknownNames(el('d-regother', 'detents'))).toEqual([]);
    expect(unknownNames(el('button', 'd-regattr'))).toEqual([]);
  });

  it('knows the name is a tag or an attribute, as the other draws nothing', () => {
    definePart({ selector: 'd-regtag2', paint() {} });
    definePart({ selector: '[d-regattr2]', paint() {} });
    expect(unknownNames(el('div', 'd-regtag2'))).toEqual(['[d-regtag2]']);
    expect(unknownNames(el('d-regattr2'))).toEqual(['<d-regattr2>']);
  });

  it('finds what nothing answers to, and leaves other names alone', () => {
    expect(unknownNames(el('d-nothing', 'd-neither', 'w-nor', 'data-d', 'class'))).toEqual(['<d-nothing>', '[d-neither]']);
    expect(unknownNames(el('w-nothing'))).toEqual([]);
    expect(unknownNames(el('div', 'class', 'dir'))).toEqual([]);
  });

  it('checks the words after a form that says which it takes', () => {
    definePart({ selector: '[d-regwords~="side"]', options: ['left', 'right'], paint() {} });
    definePart({ selector: '[d-regwords~="free"]', paint() {} });
    expect(unknownWords(el('div', 'd-regwords=side left'))).toEqual([]);
    expect(unknownWords(el('div', 'd-regwords=side'))).toEqual([]);
    expect(unknownWords(el('div', 'd-regwords=side lfet'))).toEqual(['[d-regwords="side lfet"]']);
    expect(unknownWords(el('div', 'd-regwords=free anything'))).toEqual([]);
  });

  it('knows a form nothing has defined, and leaves what follows a form alone', () => {
    definePart({ selector: '[d-regform=""]', paint() {} });
    definePart({ selector: '[d-regform~="chiclet"]', paint() {} });
    expect(unknownNames(el('button', 'd-regform'))).toEqual([]);
    expect(unknownNames(el('button', 'd-regform=chiclet'))).toEqual([]);
    expect(unknownNames(el('button', 'd-regform=chiclet left'))).toEqual([]);
    expect(unknownNames(el('button', 'd-regform=chiclit'))).toEqual(['[d-regform="chiclit"]']);
  });

  it('reads only the first word as the form, so an option cannot hide a misspelling', () => {
    definePart({ selector: '[d-regform2=""]', paint() {} });
    definePart({ selector: '[d-regform2~="chiclet"]', paint() {} });
    definePart({ selector: '[d-regform2~="left"]', paint() {} });
    expect(unknownNames(el('button', 'd-regform2=chiclit left'))).toEqual(['[d-regform2="chiclit left"]']);
  });

  it('wants a form on a part with no plain one, and leaves a part that takes any value', () => {
    definePart({ selector: '[d-regnoplain~="thumb"]', paint() {} });
    expect(unknownNames(el('div', 'd-regnoplain'))).toEqual(['[d-regnoplain=""]']);
    expect(unknownNames(el('div', 'd-regnoplain=thumb'))).toEqual([]);
    definePart({ selector: '[d-regany]', paint() {} });
    definePart({ selector: '[d-regany~="round"]', paint() {} });
    expect(unknownNames(el('div', 'd-regany=whatever'))).toEqual([]);
  });

  it('knows a value a selector asks for exactly', () => {
    definePart({ selector: '[d-regexact="print"]', paint() {} });
    expect(unknownNames(el('div', 'd-regexact=print'))).toEqual([]);
    expect(unknownNames(el('div', 'd-regexact=prnt'))).toEqual(['[d-regexact="prnt"]']);
  });

  it('leaves what the engine reads, and what a part declares', () => {
    expect(unknownNames(el('d-device', 'd-layer', 'd-reach'))).toEqual([]);
    defineNames('d-regchild', '[d-regflag]');
    expect(unknownNames(el('d-regchild', 'd-regflag'))).toEqual([]);
  });
});

describe('what part an element is', () => {
  // Enough of a selector to stand for any part's: tags, attributes, values and words, in lists.
  let tried = 0;
  const one = (el: { localName: string; attrs: Record<string, string> }, s: string) =>
    [...s.matchAll(/^[a-z][\w-]*|\[([\w-]+)(?:(~?)="([^"]*)")?\]|\.[\w-]+/g)].every(([m, name, word, value]) =>
      m.startsWith('.') ? false : !name ? el.localName === m : name in el.attrs && (value === undefined || (word ? el.attrs[name]!.split(/\s+/).includes(value) : el.attrs[name] === value)));
  const el = (localName: string, attrs: Record<string, string> = {}) => {
    const e = { localName, attrs, getAttributeNames: () => Object.keys(attrs), getAttribute: (n: string) => attrs[n] ?? null, matches: (s: string) => (tried++, s.split(',').some(x => one(e, x.trim()))) };
    return e as unknown as Element;
  };
  const scanned = (e: Element) => partDefs().find(p => e.matches(p.selector));
  const knob = { selector: '[d-regpart~="knob"]', paint() {} }, fluted = { selector: '[d-regpart~="knob"][fluted]', paint() {} };
  const tag = { selector: 'd-regpart', paint() {} }, either = { selector: 'b[d-regany], d-regany', paint() {} };
  definePart(knob);
  definePart(tag);
  definePart(fluted);
  definePart(either);

  it('is the latest defined that matches, as it always was', () => {
    for (const e of [el('div', { 'd-regpart': 'knob' }), el('div', { 'd-regpart': 'knob', fluted: '' }), el('d-regpart', { 'd-regpart': 'knob' }), el('d-regany'), el('b', { 'd-regany': '' }), el('i')])
      expect(partFor(e)).toBe(scanned(e));
    expect(partFor(el('div', { 'd-regpart': 'knob', fluted: '' }))).toBe(fluted);
    expect(partFor(el('d-regpart', { 'd-regpart': 'knob' }))).toBe(tag);
    expect(partFor(el('d-regany'))).toBe(either);
  });

  it('is found by trying only the parts its own names could make it', () => {
    tried = 0;
    partFor(el('div', { 'd-regpart': 'knob', class: 'x' }));
    // The two that need [d-regpart] and those that look past one element, not every part there is.
    const past = partDefs().filter(p => /[\s,>+~:.#]/.test(p.selector.replace(/\[[^\]]*\]/g, ''))).length;
    expect(tried).toBeLessThanOrEqual(2 + past);
    expect(2 + past).toBeLessThan(partDefs().length);
  });

  it('is told from its form by the word alone, of all the forms its attribute has', () => {
    const plain = { selector: '[d-regform=""]', paint() {} }, round = { selector: '[d-regform~="round"]', paint() {} }, wide = { selector: '[d-regform~="round"][wide]', paint() {} };
    for (const p of [plain, round, wide]) definePart(p);
    for (let i = 0; i < 20; i++) definePart({ selector: `[d-regform~="other${i}"]`, paint() {} });
    const cases = [el('div', { 'd-regform': '' }), el('div', { 'd-regform': 'round' }), el('div', { 'd-regform': 'flat round' }), el('div', { 'd-regform': 'round', wide: '' }), el('div', { 'd-regform': 'square' }), el('div', { 'd-regform': 'other3 round' })];
    for (const e of cases) expect(partFor(e)).toBe(scanned(e));
    expect(cases.map(partFor)).toEqual([plain, round, round, wide, undefined, partDefs().find(p => p.selector === '[d-regform~="other3"]')]);
    tried = 0;
    partFor(el('div', { 'd-regform': 'round', class: 'x' }));
    // `wide` needs asking, `round` needs nothing but its word: none of the other twenty-odd forms are tried.
    expect(tried).toBeLessThanOrEqual(1 + partDefs().filter(p => /[\s,>+~:.#]/.test(p.selector.replace(/\[[^\]]*\]/g, ''))).length);
    expect(maybePartsSelector()).toContain('[d-regform]');
  });

  it('is looked for by the names parts need, and matched exactly where it has to be', () => {
    for (const s of ['[d-regpart]', 'd-regpart', 'b[d-regany], d-regany']) expect(maybePartsSelector()).toContain(s);
    expect(maybePartsSelector()).not.toContain('knob');
    expect(partsSelector()).toBe(partDefs().map(p => p.selector).join(','));
  });
});

describe('a colour', () => {
  it('reads every way css writes one', () => {
    expect(linear('#fff')).toEqual([1, 1, 1]);
    expect(linear('#ffffff')).toEqual([1, 1, 1]);
    expect(linear('#f00f')).toEqual([1, 0, 0]);
    expect(linear('#00ff0080')).toEqual([0, 1, 0]);
    expect(linear('rgb(0, 0, 255)')).toEqual([0, 0, 1]);
    expect(linear('rgba(255 255 255 / 0.5)')).toEqual([1, 1, 1]);
    expect(linear('#e33')).toEqual(linear('#ee3333'));
  });

  it("says when it can't, and is grey rather than whatever its digits spell", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grey = linear('#808080');
    expect(linear('#12345')).toEqual(grey);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"#12345" isn\'t a colour'));
  });
});
