// Keys with a lamp under them.
import { circle, definePart, MM, path, rect } from 'device-ui';
import { key, legend } from 'device-ui/controls/key';
import { lamp, num, nums, scale } from 'device-ui/controls/shared';

// A big translucent pad over a lamp, on a pivot, in any outline: `path` and `viewbox` fill the box. `on` or a press lights it from
// behind, brightest over the lamp at `lamp`, mm from the box's top left. `pivot` is the way to the hinged side, degrees clockwise from
// up, and the far side drops `travel` mm. Leave it off and the whole pad goes straight down. `height` is mm above what it's on.
// Without a `path` it's its box with `radius` mm corners, as an illuminated pushbutton is, and the text inside is its legend.
definePart(key('[d-key~="lamp"]', {
  feel: { mass: 26, material: 'plastic-on-plastic', friction: 0.1 },
  cap: 'plastic-white',
  own: true,
  lit: { stiffness: 900, damping: 60 },
  live: ['on'],
  draw(s, p, d, k) {
    const viewBox = p.el.getAttribute('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined;
    const outline = (spread: number) =>
      p.el.hasAttribute('path') ? path(p.el.getAttribute('path')!, p.x, p.y, p.w, p.h, { viewBox, spread }) : rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 1.5) * MM });
    const material = k.cap, down = k.down, c = lamp(p, 'white');
    const on = Math.max(p.springs.lit!.value, 0), height = num(p, 'height', 2), travel = num(p, 'travel', 1.6), pivot = p.el.getAttribute('pivot');
    const [lx = p.w / MM / 2, ly = p.h / MM / 2] = nums(p, 'lamp', []), R = Math.max(p.w, p.h) * 0.62;
    s.well(outline(12), 1, { bevel: 1.2 });
    s.surface(outline(12), { material, zEdge: -0.8, zTop: height - (pivot === null ? travel * down : 0), bevel: num(p, 'bevel', 1.75) * MM, profile: 'round', over: { emit: scale(c, 0.03 * on), touch: d.age * 0.5 } }, () => {
      if (on > 0.01) s.cut(circle(p.x + lx * MM, p.y + ly * MM, R), { emit: scale(c, num(p, 'gain', 0.26) * on), feather: R * 0.8 });
      legend(s, p, material, { depth: 0.04, wear: d.wear * 0.25 });
      if (pivot !== null && down > 0.001) {
        const a = (+pivot * Math.PI) / 180, nx = -Math.sin(a), ny = Math.cos(a), run = Math.abs(nx) * p.w + Math.abs(ny) * p.h, far = run * 4;
        const cx = p.x + p.w / 2 + nx * (far - run / 2), cy = p.y + p.h / 2 + ny * (far - run / 2);
        s.cut(rect(cx - far, cy - far, far * 2, far * 2, { rotate: a }), { depth: travel * down, soft: run });
      }
    });
    k.focus(outline(12));
  },
}));
