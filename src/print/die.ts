// The steel characters a card embosser presses with: every one the same width and weight, square-shouldered so it stands up to being pressed, and
// open enough for a shop to take a clean rubbing. Our own letters, drawn on a grid, each stroke the width of one square.
type Stroke = [number, number][];

const W = 4, H = 6;
const SIX: Stroke = [[3.5, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.5], [3, 2.5], [0, 2.5]];

const GLYPHS: Record<string, Stroke[]> = {
  0: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  1: [[[0.8, 1.2], [2, 0], [2, 6]], [[0.6, 6], [3.4, 6]]],
  2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2.4], [0, 6], [4, 6]]],
  3: [[[0, 0], [4, 0], [1.8, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [1, 6], [0, 5]]],
  4: [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  5: [[[3.8, 0], [0, 0], [0, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [0, 6]]],
  6: [SIX],
  7: [[[0, 0], [4, 0], [1.4, 6]]],
  8: [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]]],
  9: [SIX.map(([x, y]) => [W - x, H - y])],
  A: [[[0, 6], [0, 1.4], [1, 0], [3, 0], [4, 1.4], [4, 6]], [[0, 3.6], [4, 3.6]]],
  B: [[[0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6], [0, 0]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0, 6], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.2], [2.2, 3.2]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[0.8, 0], [3.2, 0]], [[2, 0], [2, 6]], [[0.8, 6], [3.2, 6]]],
  J: [[[1.6, 0], [4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.4]], [[1.4, 2.4], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 2.8], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.4, 4.2], [4, 6]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]], [[2, 3.4], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [0.8, 6], [2, 2.8], [3.2, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '/': [[[4, 0], [0, 6]]],
  '-': [[[0.6, 3], [3.4, 3]]],
  '.': [[[1.6, 6], [2.4, 6]]],
};

/** Round a square nib moved from a to b, always the same way round, so that strokes crossing add up. */
function swept([ax, ay]: [number, number], [bx, by]: [number, number], n: number): string {
  const points = [[-n, -n], [n, -n], [n, n], [-n, n]].flatMap(([x, y]) => [[ax + x!, ay + y!], [bx + x!, by + y!]]).sort((p, q) => p[0]! - q[0]! || p[1]! - q[1]!);
  const side = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const half = (from: number[][]) => from.reduce<number[][]>((h, p) => {
    while (h.length > 1 && side(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
    return [...h, p];
  }, []).slice(0, -1);
  const hull = [...half(points), ...half([...points].reverse())];
  return `M${hull.map(([x, y]) => `${+x!.toFixed(3)} ${+y!.toFixed(3)}`).join('L')}Z`;
}

/** The characters of `text` as one path, from `x`, each `pitch` along and `tall` high, all in the same units. `mirror` is the same line as seen from behind. */
export function pressed(text: string, x: number, y: number, pitch: number, tall: number, mirror = false): string {
  const unit = tall / (H + 1), chars = [...text.toUpperCase()], d: string[] = [];
  chars.forEach((c, i) => {
    const slot = mirror ? chars.length - 1 - i : i, left = x + slot * pitch + (pitch - (W + 1) * unit) / 2 + unit / 2, top = y + unit / 2;
    for (const stroke of GLYPHS[c] ?? []) stroke.slice(1).forEach(([bx, by], k) => {
      const [ax, ay] = stroke[k]!;
      const at = (px: number, py: number): [number, number] => [left + (mirror ? W - px : px) * unit, top + py * unit];
      d.push(swept(at(ax, ay), at(bx, by), unit / 2));
    });
  });
  return d.join('');
}
