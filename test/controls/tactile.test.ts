import { afterEach, describe, expect, it, vi } from 'vitest';
import { Spring, contact, onContact, type Contact, type Part } from 'device-ui';
import { haptics } from '../../src/packs/controls/index';
import { Hand, HOLD, swept, type Reach } from '../../src/base/drag';
import { hinge, mechanism, press, trail, seatedOn, slide, spring, together, turn } from '../../src/base/joints';

afterEach(() => vi.unstubAllGlobals());

describe('haptics on iOS', () => {
  // Enough of Safari: no vibrate, the switch attribute, and a label whose clicks can be counted.
  const safari = (active: boolean, points = 5) => {
    const label = { hidden: false, innerHTML: '', click: vi.fn(), remove: vi.fn(), addEventListener: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('navigator', { maxTouchPoints: points, userActivation: { isActive: active } });
    vi.stubGlobal('HTMLInputElement', { prototype: { switch: false } });
    vi.stubGlobal('document', { createElement: () => label, body: { append } });
    return { label, append };
  };
  const touch = (kind: Contact['kind'] = 'press') => contact({ el: { closest: () => ({ __d: { material: 'plastic-black' } }) } } as unknown as Part, kind, 10);

  it('flips a hidden switch on a contact, inside a gesture', () => {
    const { label, append } = safari(true), stop = haptics();
    touch();
    touch('detent');
    stop();
    expect(label.click).toHaveBeenCalledTimes(2);
    expect(label.innerHTML).toContain('switch');
    expect(label.hidden).toBe(true);
    expect(append).toHaveBeenCalledTimes(1);
    expect(label.remove).toHaveBeenCalled();
  });

  it('does nothing outside a gesture', () => {
    const { label, append } = safari(false), stop = haptics();
    touch();
    stop();
    expect(label.click).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('stays out of a rub, which a motor cannot follow', () => {
    const { label } = safari(true), stop = haptics();
    touch('rub');
    stop();
    expect(label.click).not.toHaveBeenCalled();
  });

  it('does nothing on a Mac, which has the switch and no touch', () => {
    const { label } = safari(true, 0), stop = haptics();
    touch();
    stop();
    expect(label.click).not.toHaveBeenCalled();
  });

  it('does nothing where there is no switch either', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 5, userActivation: { isActive: true } });
    vi.stubGlobal('HTMLInputElement', { prototype: {} });
    expect(() => haptics()()).not.toThrow();
  });

  it('leaves a phone with a motor to its motor', () => {
    const vibrate = vi.fn(), { label } = safari(true);
    vi.stubGlobal('navigator', { maxTouchPoints: 5, vibrate, userActivation: { hasBeenActive: true, isActive: true } });
    const stop = haptics();
    touch();
    stop();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(label.click).not.toHaveBeenCalled();
  });
});

const part = (pull?: number) => ({
  el: { closest: () => ({ __d: { material: 'plastic-black' } }), querySelector: () => ({ value: '50', min: '0', max: '100' }) },
  data: { pull },
}) as unknown as Part;
const seated = (p: Part) => seatedOn(p, { type: 'range', value: '50', min: '0', max: '100' } as HTMLInputElement);

describe('seated', () => {
  it('sits in the notch with no hand on it', () => {
    expect(seated(part())).toBe(0.5);
  });

  it('leans after the hand but never reaches it', () => {
    const lean = seated(part(HOLD * 0.04));
    expect(lean).toBeGreaterThan(0.5);
    expect(lean).toBeLessThan(0.54);
  });

  it('holds a click back until it snaps over', () => {
    const step = 0.1, clicks: Contact[] = [], off = onContact(c => clicks.push(c));
    const s = new Spring({ stiffness: 1100, damping: 44, value: 0.5 });
    s.notches(step);
    s.part = part();
    const go = (to: number) => {
      s.set(to);
      for (let i = 0; i < 40; i++) s.step(1 / 60);
    };
    // The hand gets half a step ahead of the notch, then the input jumps to the next one and it drags behind.
    go(seated(part(HOLD * step / 2)));
    expect(clicks).toHaveLength(0);
    go(seated(part(HOLD * -step / 2)) + step);
    expect(clicks).toHaveLength(1);
    go(0.6);
    off();
    expect(clicks).toHaveLength(1);
  });
});

describe('a hand on a control', () => {
  const reach: Reach = { min: 0, max: 10, step: 0 };
  const held = (at: number, r = reach) => {
    const h = new Hand();
    h.grab(at);
    return h;
  };

  it('moves it by what the hand did, wherever it took hold', () => {
    const h = held(4);
    expect(h.by(0.5, reach)).toBe(4.5);
    expect(h.by(-1, reach)).toBe(3.5);
  });

  it('keeps going past a stop and has to come back', () => {
    const h = held(9), r = { ...reach, past: 5 };
    expect(h.by(3, r)).toBe(10);
    expect(h.at).toBe(12);
    expect(h.by(-1, r)).toBe(10);
    expect(h.by(-2, r)).toBe(9);
  });

  it('only goes so far past a stop', () => {
    const h = held(10), r = { ...reach, past: 1 };
    h.by(100, r);
    expect(h.by(-2, r)).toBe(9);
  });

  it('goes round when it wraps', () => {
    const h = held(9.5), r = { ...reach, wrap: true };
    expect(h.by(1, r)).toBeCloseTo(0.5);
    expect(h.by(-1, r)).toBeCloseTo(9.5);
  });

  describe('with detents', () => {
    const r = { ...reach, step: 1 };

    it('stays in one until past the crest', () => {
      const h = held(3);
      expect(h.by(0.5, r)).toBe(3);
      expect(h.by(0.1, r)).toBe(3);
      expect(h.by(0.05, r)).toBe(4);
    });

    it('does not chatter on the crest', () => {
      const h = held(3);
      h.by(0.65, r);
      for (const shake of [-0.1, 0.1, -0.15, 0.15, -0.1]) expect(h.by(shake, r)).toBe(4);
    });

    it('takes as many as the hand went over', () => {
      expect(held(1).by(3, r)).toBe(4);
      expect(held(5).by(-3, r)).toBe(2);
    });
  });
});

describe('swept', () => {
  it('is the angle between two points, clockwise on screen', () => {
    expect(swept(10, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
    expect(swept(0, 10, 10, 0)).toBeCloseTo(-Math.PI / 2);
  });

  it('crosses the seam as if it were not there', () => {
    expect(swept(-10, 1, -10, -1)).toBeCloseTo(0.2, 1);
    expect(swept(-10, -1, -10, 1)).toBeCloseTo(-0.2, 1);
  });

  it('is geared down close in', () => {
    const near = swept(10, 0, 10, 1, 40), far = swept(40, 0, 40, 1, 40);
    expect(near).toBeCloseTo(far, 3);
  });

  it('does not spin going over the middle', () => {
    expect(Math.abs(swept(-1, 0, 1, 0.01, 36))).toBeLessThan(0.01);
  });
});

describe('how soon a press is felt', () => {
  const felt = (mass: number) => {
    const contacts: Contact[] = [], off = onContact(c => contacts.push(c)), s = new Spring({ ...mechanism({ return: 0.5, mass }).spring, contact: 'press' });
    s.part = part();
    s.set(1);
    let ms = 0;
    while (!contacts.length && ms < 300) {
      s.step(1 / 240);
      ms += 1000 / 240;
    }
    off();
    return ms;
  };

  it('is inside the time a sound has to start', () => {
    for (const mass of [3, 6, 11, 15]) expect(felt(mass)).toBeLessThan(45);
  });

  it('comes later on something heavy', () => {
    expect(felt(150)).toBeGreaterThan(felt(3));
  });
});

describe('a hand on a free part', () => {
  it('stays close however heavy the part is', () => {
    expect(trail(3, 'mouse')).toBeLessThan(trail(15, 'mouse'));
    expect(trail(500, 'mouse')).toBeLessThanOrEqual(0.03);
    expect(trail(500, 'touch')).toBeLessThanOrEqual(0.01);
  });

  it('follows at that lag, and the spring takes over when it lets go', () => {
    const s = new Spring({ stiffness: 400, damping: 40 });
    s.grip(0.01);
    s.set(1);
    s.step(0.03);
    expect(s.value).toBeGreaterThan(0.9);
    s.grip(0);
    s.set(0);
    s.step(0.03);
    expect(s.value).toBeGreaterThan(0.5);
  });
});

describe('a mechanism', () => {
  it('arrives later the heavier it is', () => {
    expect(mechanism({ mass: 3 }).spring.stiffness).toBeGreaterThan(mechanism({ mass: 150 }).spring.stiffness);
  });

  it('feels the same given the same size and contact', () => {
    expect(mechanism({ mass: 15, material: 'brass-on-steel' }).spring).toEqual(mechanism({ mass: 15, material: 'brass-on-steel' }).spring);
  });

  it('takes its friction from what is touching', () => {
    expect(mechanism({ material: 'ball-bearing' }).drag).toBeLessThan(mechanism({ material: 'rubber-on-plastic' }).drag);
    expect(mechanism({ material: 'ball-bearing', friction: 0.5 }).drag).toBe(0.5);
  });

  it('coasts on a bearing and not on a small knob', () => {
    expect(mechanism({ mass: 150, material: 'ball-bearing' }).coast).toBeGreaterThan(0.5);
    expect(mechanism({ mass: 15, material: 'metal-on-grease' }).coast).toBe(0);
  });

  it('says which joint it is, for whatever hears it', () => {
    expect(press({ mass: 3 }).motion.joint).toBe('press');
    expect(turn({ rolled: true }).motion).toMatchObject({ joint: 'turn', rolled: true });
    expect(slide({ travel: 10 }).motion.joint).toBe('slide');
    expect(hinge().motion.joint).toBe('hinge');
    expect(press({ latch: true }).motion.latch).toBe(true);
    expect(turn({ sound: 'bezel' }).motion.sound).toBe('bezel');
  });

  it('carries its motion on the spring, so two joints in a part are heard apart', () => {
    const both = together(turn({ material: 'finger-on-glass' }), press({ mass: 11 }));
    const of = (s: unknown) => (s as { motion: { joint: string } }).motion.joint;
    expect(of(both.springs.turn)).toBe('turn');
    expect(of(both.springs.press)).toBe('press');
  });

  it('leaves a missing contact to the joint', () => {
    expect(hinge().springs.hinge!.contact).toBe('toggle');
    expect(press({ contact: false }).springs.press!.contact).toBe(false);
    expect(spring({ material: 'steel-on-steel' }).contact).toBe('press');
    expect(spring({ mass: 1, friction: 0.1 }).contact).toBeUndefined();
    expect(spring({ material: 'steel-on-steel', contact: false }).contact).toBe(false);
  });

  it('gives a part of the same size in the same materials the same feel', () => {
    expect(press({ mass: 3 }).springs.press).toEqual(press({ mass: 3, down() {} }).springs.press);
    expect(spring({ mass: 3, return: 0.5 })).toMatchObject(mechanism({ mass: 3, return: 0.5 }).spring);
  });

  it('is settled by what a needle is hung on, not only by a hand', () => {
    expect(spring({ mass: 1, return: 0.001 }).stiffness).toBeLessThan(spring({ mass: 1, return: 0.5 }).stiffness);
  });

  it('never coasts against a return or a detent', () => {
    expect(mechanism({ mass: 150, material: 'ball-bearing', return: 0.5 }).coast).toBe(0);
    expect(mechanism({ mass: 150, material: 'ball-bearing', detents: true }).coast).toBe(0);
  });
});

describe('haptics', () => {
  const stub = (active = true) => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: active } });
    return vibrate;
  };

  it('does nothing where there is no motor', () => {
    vi.stubGlobal('navigator', {});
    const off = haptics();
    contact(part(), 'press', 10);
    off();
  });

  it('buzzes harder for a harder hit', () => {
    const vibrate = stub(), off = haptics();
    contact(part(), 'press', 25);
    contact(part(), 'press', 2);
    contact(part(), 'detent', 30);
    off();
    const [hard, soft, detent] = vibrate.mock.calls.map(c => c[0] as number);
    expect(hard).toBe(12);
    expect(soft).toBeLessThan(hard!);
    expect(detent).toBeLessThan(hard!);
  });

  it('waits for the page to be touched', () => {
    const vibrate = stub(false), off = haptics();
    contact(part(), 'toggle', 25);
    off();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('stops when told to', () => {
    const vibrate = stub(), off = haptics();
    off();
    contact(part(), 'press', 10);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
