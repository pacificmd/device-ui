import { describe, expect, it } from 'vitest';
import { Spring, contact, onContact, type Contact, type Part } from '../../src/base/index';

const device = { material: 'enamel-cream', w: 300 };
const part = (name?: string) => ({
  el: { closest: () => ({ __d: device }) },
  commands: name ? [{ op: 'surface', name: 'well' }, { op: 'surface', name }, { op: 'cut' }] : undefined,
}) as unknown as Part;

/** Collects what a spring reports while `fn` runs. */
const heard = (fn: (p: Part) => void, p = part('keycap-black')) => {
  const all: Contact[] = [];
  const off = onContact(c => all.push(c));
  fn(p);
  off();
  return all;
};

const spring = (p: Part, def = {}) => {
  const s = new Spring({ stiffness: 1400, damping: 46, through: true, contact: 'press', ...def });
  s.part = p;
  return s;
};
const key = (p: Part) => spring(p);
const toggle = (p: Part) => {
  const s = spring(p, { stiffness: 2600, damping: 62, through: false, contact: 'toggle' });
  s.snap(-1);
  return s;
};
const frames = (s: Spring, n: number, dt = 1 / 60, instant = false) => {
  for (let i = 0; i < n; i++) s.step(dt, instant);
};
const kinds = (all: Contact[]) => all.map(c => c.kind);

describe('what a contact carries', () => {
  const motion = { joint: 'turn', material: 'steel-on-steel', mass: 30, returns: false } as const;

  it('takes the motion of the spring that made it', () => {
    const all = heard(p => {
      const s = spring(p, { motion });
      s.set(1);
      frames(s, 120);
    });
    expect(all[0]!.motion).toBe(motion);
    expect(all[0]!.to).toBe(1);
  });

  it("falls back on the part's own", () => {
    const p = { ...part('keycap-black'), def: { motion } } as unknown as Part;
    expect(heard(q => contact(q, 'stop', 5), p)[0]!.motion).toBe(motion);
  });

  it('has none if nothing declares one', () => {
    expect(heard(p => contact(p, 'press', 5))[0]!.motion).toBeUndefined();
  });
});

describe('a quiet part', () => {
  it('reports nothing, from itself or its springs', () => {
    const p = { ...part('keycap-black'), el: { closest: () => ({ __d: device }), hasAttribute: (n: string) => n === 'quiet' } } as unknown as Part;
    const all = heard(q => {
      contact(q, 'detent', 15);
      const s = key(q);
      s.set(1);
      frames(s, 120);
    }, p);
    expect(all).toEqual([]);
  });
});

describe('contact', () => {
  it('reports who, what and how fast', () => {
    const p = part('keycap-black');
    const [c] = heard(() => contact(p, 'press', 9), p);
    expect(c).toMatchObject({ kind: 'press', part: p, device, material: 'keycap-black', speed: 9 });
  });

  it('falls back on the device before anything is painted', () => {
    const [c] = heard(p => contact(p, 'press', 1), part());
    expect(c!.material).toBe('enamel-cream');
  });

  it('builds nothing when no one is listening', () => {
    let read = 0;
    const p = { get el() {
      read++;
      return { closest: () => null };
    } } as unknown as Part;
    contact(p, 'press', 1);
    expect(read).toBe(0);
  });

  it('stops when told to', () => {
    const all: Contact[] = [];
    const off = onContact(c => all.push(c));
    off();
    contact(part(), 'press', 1);
    expect(all).toHaveLength(0);
  });

  it('survives a listener that throws', () => {
    const quiet = console.error;
    console.error = () => {};
    const off = onContact(() => {
      throw new Error('nope');
    });
    const all = heard(p => contact(p, 'press', 1));
    off();
    console.error = quiet;
    expect(all).toHaveLength(1);
  });
});

describe('landing', () => {
  it('fires one press and one release for a press that is held', () => {
    const all = heard(p => {
      const s = key(p);
      s.set(1);
      frames(s, 60);
      s.set(0);
      frames(s, 60);
    });
    expect(kinds(all)).toEqual(['press', 'release']);
    expect(all[0]!.speed).toBeGreaterThan(5);
  });

  for (const [name, dt] of [['60fps', 1 / 60], ['30fps', 1 / 30], ['120fps', 1 / 120]] as const) {
    it(`fires one press and one release for a quick tap at ${name}`, () => {
      for (let held = 0; held < 8; held++) {
        const all = heard(p => {
          const s = key(p);
          s.set(1);
          frames(s, held, dt);
          s.set(0);
          frames(s, 90, dt);
          expect(s.active).toBe(false);
        });
        expect(kinds(all)).toEqual(['press', 'release']);
      }
    });
  }

  it('fires them when the release comes before a single frame', () => {
    const all = heard(p => {
      const s = key(p);
      s.set(1);
      s.set(0);
      frames(s, 60);
    });
    expect(kinds(all)).toEqual(['press', 'release']);
  });

  it('fires both, in order, when the spring only jumps', () => {
    const all = heard(p => {
      const s = key(p);
      s.set(1);
      s.set(0);
      frames(s, 2, 1 / 60, true);
      s.set(1);
      frames(s, 2, 1 / 60, true);
      s.set(0);
      frames(s, 2, 1 / 60, true);
    });
    expect(kinds(all)).toEqual(['press', 'release', 'press', 'release']);
    for (const c of all) expect(c.speed).toBeGreaterThan(5);
  });

  it('lets go at the snap, so a second press on the way back up is softer', () => {
    const all = heard(p => {
      const s = key(p);
      s.set(1);
      frames(s, 60);
      s.set(0);
      frames(s, 2);
      s.set(1);
      frames(s, 60);
    });
    expect(kinds(all)).toEqual(['press', 'release', 'press']);
    expect(all[2]!.speed).toBeLessThan(all[0]!.speed);
  });

  it('says nothing for a spring that is put somewhere', () => {
    const all = heard(p => {
      const s = key(p);
      s.snap(1);
      frames(s, 10);
      s.snap(0);
      frames(s, 10);
    });
    expect(all).toHaveLength(0);
  });

  it('throws a toggle either way', () => {
    const all = heard(p => {
      const s = toggle(p);
      s.set(1);
      frames(s, 60);
      s.set(-1);
      frames(s, 60);
    });
    expect(kinds(all)).toEqual(['toggle', 'toggle']);
    expect(all[0]!.speed).toBeGreaterThan(15);
  });

  it('only counts the last throw when a toggle is thrown back at once', () => {
    const all = heard(p => {
      const s = toggle(p);
      s.set(1);
      frames(s, 1);
      s.set(-1);
      frames(s, 60);
    });
    expect(kinds(all)).toEqual(['toggle']);
  });

  it('leaves a spring with no contact alone', () => {
    const all = heard(p => {
      const s = spring(p, { contact: undefined });
      s.set(1);
      frames(s, 60);
    });
    expect(all).toHaveLength(0);
  });
});

describe('detents', () => {
  const knob = (p: Part) => {
    const s = spring(p, { stiffness: 900, damping: 34, through: false, contact: undefined });
    s.notches(0.5);
    return s;
  };
  const dial = (s: Spring, to: number) => {
    s.set(to);
    frames(s, 90);
  };

  it('clicks once for each detent it goes past', () => {
    const all = heard(p => dial(knob(p), 2));
    expect(kinds(all)).toEqual(['detent', 'detent', 'detent', 'detent']);
  });

  it('counts the same going back', () => {
    const all = heard(p => {
      const s = knob(p);
      dial(s, 1.5);
      dial(s, 0);
    });
    expect(all).toHaveLength(6);
  });

  it('stays quiet inside a detent', () => {
    const all = heard(p => {
      const s = knob(p);
      for (const to of [0.1, -0.1, 0.2, -0.2, 0.1]) dial(s, to);
    });
    expect(all).toHaveLength(0);
  });

  it('clicks when held just short of the next one', () => {
    const all = heard(p => dial(knob(p), 0.45));
    expect(all).toHaveLength(1);
  });

  it('reports speed in detents a second', () => {
    const all = heard(p => dial(knob(p), 2));
    const peak = Math.max(...all.map(c => c.speed));
    expect(peak).toBeGreaterThan(30);
    expect(peak).toBeLessThan(80);
  });

  it('counts from a spring that was put somewhere', () => {
    const all = heard(p => {
      const s = knob(p);
      s.snap(1.3);
      dial(s, 1.8);
    });
    expect(all).toHaveLength(1);
  });

  it('clicks once when the spring only jumps', () => {
    const all = heard(p => {
      const s = knob(p);
      s.set(2);
      frames(s, 2, 1 / 60, true);
    });
    expect(all).toHaveLength(1);
  });
});
