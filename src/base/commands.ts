// What both sides of the draw commands need to know about one: how far it reaches and how high it stands.
import { bentBox } from './bend.js';
import { bounds } from './shapes.js';
import type { Command } from './sheet.js';
import type { Box } from './types.js';

export const tallest = (c: Extract<Command, { zTop: number }>) => (c.op === 'surface' ? c.reach : c.zTop);
export const rises = (c: Command) => ('zTop' in c ? tallest(c) : 0);

export const extent = (c: Command): Box => {
  const box = bounds(c.shape, c.op === 'glow' ? c.width + 2 : 3);
  return c.bend ? bentBox(box, c.bend) : box;
};

export function join(a: Box | null | undefined, b: Box | null | undefined): Box | null {
  if (!a || !b) return a ?? b ?? null;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
