// The player: what lights a device every frame. The engine's own renderer is the maker: it lays out, paints a plate's maps and seats each
// device on the shared canvas, as it always has. Where its own light pass would run, the player's runs: one pass over maps packed for it,
// a millisecond where the maker's takes eight. It reads the plate's textures where they are, on the maker's context, so nothing is read
// back and nothing is made twice.
//
// It lights everything it takes, right or not yet: what it leaves out (a coating's colours on glass, a glow landing on
// what's round it) is simply not there. Its shadows are the engine's march, at half size in a pass of their own. A torch, flashes, flames and the glow of the devices round one it lights by as the maker does. A body seen from off straight-on, turning over or leaning or
// set at an angle, is seen as the maker's pass sees it, by the same code (LIGHT_VIEW) over the pack's heights, but from where the player's
// eye rests: right over every point, so at rest nothing leans. On a stage it gives light for the camera, as the maker does. A debug view is its too: one of the maps, shown as it is.
// The raster is no part of this.
import { blending, link, type Program } from '../gl.js';
import type { Plate, Scene, Textures, Turn } from '../plate.js';
import { FULL_VS } from '../shaders/light.js';
import { panelKey } from '../broken.js';
import { extent } from '../commands.js';
import { OCCLUSION_SEEN, SCREEN } from '../shaders/material.js';
import type { ScreenCommand } from '../sheet.js';
import type { Box } from '../types.js';
import { ALONE_FS, APART_FS, CARRY_FS, COVER_FS, HEIGHT_FS, JUDGE_FS, JUDGE_GLOW_FS, LAY_FS, LIGHT_FS, PACK_FS, PACK_VS, SCREEN_VS, SHADOW_FS, SHOW_FS, THROUGH_FS } from './shaders.js';

/** What the renderer knows of a light that decides who draws it. */
export interface Asked {
  /** Seen from off straight-on: leaning under a hand, or turning over. */
  leaning: boolean;
  torch: boolean;
  /** Flashes and flames lighting it. */
  points: number;
  /** Its picture is light for the stage's camera, not a finished one. */
  linear: boolean;
  /** Relief is kept apart from height. */
  relief: boolean;
}

/** What the player holds for a plate: its maps as a lamp frame reads them. */
interface Pack {
  /** Which pack of its plate this is: a new one holds none of what was read off the last. */
  id: number;
  of: Textures;
  at: number;
  w: number;
  h: number;
  /** Slope, openness and height; the finish with its wear on; heights at half size; which way the grain runs. */
  B: WebGLTexture;
  C: WebGLTexture;
  half: WebGLTexture;
  T: WebGLTexture;
  /**
   * What glows at half size, with its smaller sizes, where the maker keeps it over the maps alone and spreads none of it: the light takes
   * the glow landing round a screen or lamp from these. Made again from the maker's each time that changes, never each frame.
   */
  spread: WebGLTexture | null;
  /**
   * The colour and what glows as they're shown: the maker's, with what the player lays over them, parts moved by their crops and screens'
   * pictures. Only once something is laid in colour; till then the light reads the maker's own. The maker's own hold only its paint, so
   * whatever it paints, and whenever, what's read off them is the plate as painted, with no part moved by the player in it.
   */
  A: WebGLTexture | null;
  E: WebGLTexture | null;
  fbo: WebGLFramebuffer;
  hfbo: WebGLFramebuffer;
  tfbo: WebGLFramebuffer;
  sfbo: WebGLFramebuffer | null;
  most: number;
  relief: boolean;
  /** Parts shown somewhere other than where the plate has them, each by the crops laid over it. */
  moved: Map<unknown, Laid[]>;
  crops: Set<Crop>;
  /** Where a reading has packed the plate again with nothing laid over it, maps px: what's shown moved there is laid again once it's over. */
  bare: { x: number; y: number; w: number; h: number } | null;
  screens: Set<Shown>;
}

/**
 * A box of a plate's packed maps at both ends of one spring: at its far end, and (`B0` and the rest, once the reading is over) where it
 * rests. Map px, even on every side as heights are at half size. `dead` once its plate or the context has gone, and whoever holds it lets go.
 */
/** A spring half way, kept only as far as it's judged: its heights at half size, and its colour and light where those were read. */
export interface Mid {
  half: WebGLTexture;
  A: WebGLTexture | null;
  E: WebGLTexture | null;
}

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
  B: WebGLTexture;
  C: WebGLTexture;
  half: WebGLTexture;
  B0: WebGLTexture | null;
  C0: WebGLTexture | null;
  half0: WebGLTexture | null;
  /**
   * The maker's colour at each end, laid between them into its own, where the light reads it: what covers what changes as a part goes
   * down into the body, whatever it says its colour is. Of a part its joint carries whole, the far end is the body without it, over all it
   * sweeps, and `T` the pack's grain there too. `mask` is where the part is, at rest.
   */
  A: WebGLTexture | null;
  T: WebGLTexture | null;
  A0: WebGLTexture | null;
  T0: WebGLTexture | null;
  /** Of a part that gives light between its ends, a lamp coming on: the maker's light at each end, as its colour is. The colour again on a plate with no light. */
  E: WebGLTexture | null;
  E0: WebGLTexture | null;
  mask: WebGLTexture | null;
  /** Where the body stands over the part and hides it, wherever its joint has it. */
  over: WebGLTexture | null;
  /**
   * Of a part carried whole along a line: the pack (`FB`, `FC`, `FH`) and the maker's colour (`FA`) as the maker painted it at its far
   * end, and where that end is, map px from where it rests. What the part carried there misses of it, the shade where it meets the body and
   * what of it stands past where it was cut out at rest, is laid in.
   */
  FB: WebGLTexture | null;
  FC: WebGLTexture | null;
  FH: WebGLTexture | null;
  FA: WebGLTexture | null;
  toward: [number, number] | null;
  dead: boolean;
}

/** A box and as far round it as a change of height in it changes the shade: see `OCCLUSION_SEEN`. What's the same at both ends of a
 * spring isn't laid, so a part beside it keeps its own. */
const seen = (b: Box): Box => ({ x: b.x - OCCLUSION_SEEN, y: b.y - OCCLUSION_SEEN, w: b.w + 2 * OCCLUSION_SEEN, h: b.h + 2 * OCCLUSION_SEEN });

/** A crop and how far from where its spring rests toward its far end the maps are: 0 at rest, 1 the far end, and on past either. */
export interface Laid {
  crop: Crop;
  f: number;
  /** A part carried whole: how far it's gone from where it rests, canvas css px, how far it's turned, radians, and the pin it turns about. */
  go?: { x: number; y: number; turn: number; pin: [number, number] };
}
const away = (l: Laid) => (l.go ? l.go.x !== 0 || l.go.y !== 0 || l.go.turn !== 0 : l.f !== 0);

/** The maker's colour and light over a box, as textures of their own: a screen being read. `E` is the colour again on a plate with no light. */
export interface Lift { x: number; y: number; w: number; h: number; A: WebGLTexture; E: WebGLTexture; lit: boolean }

/**
 * A screen as read: the maker's colour and light over its box with none of the screen in them, how much of it comes through at each pixel,
 * and its picture. `dead` once its plate or the context has gone.
 */
export interface Shown {
  x: number;
  y: number;
  w: number;
  h: number;
  A: WebGLTexture;
  E: WebGLTexture;
  T: WebGLTexture;
  pic: WebGLTexture;
  cmd: ScreenCommand;
  /** Its picture changes its colour, and not only its light. */
  inked: boolean;
  lit: boolean;
  dead: boolean;
}
/** Asked of the GPU whether a screen read shows its picture as the maker painted it. */
export interface Matching { q: WebGLQuery; dead: boolean }

/** Two questions asked of the GPU about a spring, answered a frame or two on. */
export interface Judging { went: WebGLQuery; bent: WebGLQuery; glow: [WebGLQuery, WebGLQuery] | null; dead: boolean }

export interface PlayerStats {
  /** Lights the player drew. */
  lights: number;
  /** Times a part was moved by laying its crops, with no paint. */
  moves: number;
  /** Times a screen was shown a new picture with no paint. */
  shows: number;
  /** Crops held, and their bytes. */
  crops: number;
  cropBytes: number;
  /** Times a plate's maps were packed again, and what that took. */
  packs: number;
  packMs: number;
}

const levels = (w: number, h: number) => Math.floor(Math.log2(Math.max(w, h))) + 1;
const join = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const meets = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Both ends. */
const bytesOf = (c: { w: number; h: number; A?: WebGLTexture | null; T?: WebGLTexture | null; E?: WebGLTexture | null }) =>
  2 * (c.w * c.h * (8 + (c.A ? 4 : 0) + (c.E ? 4 : 0) + (c.T ? 4 : 0)) + (c.w >> 1) * (c.h >> 1) * 2);
/** What a crop keeps of its far end: its pack, heights and colour. */
const farBytes = (c: { w: number; h: number }) => c.w * c.h * 12 + (c.w >> 1) * (c.h >> 1) * 2;

export class Player {
  readonly stats: PlayerStats = { lights: 0, moves: 0, shows: 0, crops: 0, cropBytes: 0, packs: 0, packMs: 0 };
  private packs = new Map<Plate, Pack>();
  private light: Program | null = null;
  private shadow: Program | null = null;
  /** The shadows of the device being lit, at half its size, in one scratch as big as the biggest so far. */
  private shade: { tex: WebGLTexture; torch: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; at: [number, number] } | null = null;
  private packer: Program | null = null;
  private heights: Program | null = null;
  private layer: Program | null = null;
  private judge: Program | null = null;
  private glowJudge: Program | null = null;
  private carry: Program | null = null;
  private apart: Program | null = null;
  private cover: Program | null = null;
  private alone: Program | null = null;
  private through: Program | null = null;
  private shower: Program | null = null;
  private made = 0;
  /** Somewhere to draw into or copy out of a texture that has no framebuffer of its own. */
  private scratch: WebGLFramebuffer | null = null;
  /** The programs didn't link on this GPU, and nothing is lit. */
  private broken = false;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Whether it can light anything on this GPU: its programs, linked now. Where they don't, the page stays plain, as with no WebGL2. */
  ready(): boolean {
    return this.programs();
  }

  private programs(): boolean {
    if (this.light) return true;
    if (this.broken) return false;
    const { gl } = this;
    try {
      this.light = link(gl, FULL_VS, LIGHT_FS).finish();
      this.shadow = link(gl, FULL_VS, SHADOW_FS).finish();
      this.packer = link(gl, PACK_VS, PACK_FS).finish();
      this.heights = link(gl, PACK_VS, HEIGHT_FS).finish();
      this.layer = link(gl, PACK_VS, LAY_FS).finish();
      this.judge = link(gl, PACK_VS, JUDGE_FS).finish();
      this.glowJudge = link(gl, PACK_VS, JUDGE_GLOW_FS).finish();
      this.carry = link(gl, PACK_VS, CARRY_FS).finish();
      this.apart = link(gl, PACK_VS, APART_FS).finish();
      this.cover = link(gl, PACK_VS, COVER_FS).finish();
      this.alone = link(gl, SCREEN_VS, ALONE_FS).finish();
      this.through = link(gl, PACK_VS, THROUGH_FS).finish();
      this.shower = link(gl, SCREEN_VS, SHOW_FS).finish();
    } catch (e) {
      this.light = this.shadow = this.packer = this.heights = this.layer = this.judge = this.glowJudge = this.carry = this.apart = this.cover = this.alone = this.through = this.shower = null;
      this.broken = true;
      console.warn(`player: its programs didn't link, so the page stays plain: ${(e as Error).message.split('\n')[0]}`);
      return false;
    }
    const names = (p: Program, list: string[]) => { gl.useProgram(p.program); list.forEach((n, i) => p.u[n] && gl.uniform1i(p.u[n]!, i)); };
    names(this.packer!, ['tA', 'tH', 'tS', 'tC', 'tO', 'tM', 'tD', 'tN']);
    names(this.heights!, ['tA', 'tH', 'tD']);
    names(this.layer!, ['tB', 'tC', 'tB0', 'tC0']);
    names(this.judge!, ['tRest', 'tTo', 'tMid']);
    names(this.glowJudge!, ['tRestA', 'tToA', 'tMidA', 'tRestE', 'tToE', 'tMidE']);
    names(this.carry!, ['tU0', 'tR0', 'tU1', 'tR1', 'tMask', 'tOver', 'tF0', 'tF1']);
    names(this.apart!, ['tB', 'tB0', 'tH', 'tH0']);
    names(this.cover!, ['tA', 'tAF', 'tB', 'tBF', 'tC', 'tCF', 'tMask']);
    names(this.alone!, ['uScreen']);
    // What broke in a screen, on a unit of its own: see \`screened\`.
    for (const p of [this.alone!, this.shower!]) { gl.useProgram(p.program); if (p.u.uDamage) gl.uniform1i(p.u.uDamage, 11); }
    names(this.through!, ['tAb', 'tEb', 'tAw', 'tEw', 'tSAb', 'tSEb', 'tSAw', 'tSEw']);
    names(this.shower!, ['uScreen', 'tBaseA', 'tBaseE', 'tT', 'tRealA', 'tRealE']);
    // The plate's heights stay on the unit the maker keeps them on: anywhere else, its next paint into them finds them still bound.
    names(this.light!, ['tA', 'tT', 'tC', 'tHalf', 'tRoom', 'tE', 'tB', 'tShade', 'tTorchShade', 'tSpread']);
    // The room's table of what comes back at a glance, and the room as grooves smear it, are left on these units by `Rooms`.
    gl.uniform1i(this.light!.u.tDFG!, 14);
    gl.uniform1i(this.light!.u.tBrush!, 15);
    // What's under anything standing clear, where the maker's own light has it.
    gl.uniform1i(this.light!.u.tU!, 12);
    // Its broken glass, where the maker has it.
    if (this.light!.u.tCrack) gl.uniform1i(this.light!.u.tCrack, 11);
    if (this.light!.u.tFace) gl.uniform1i(this.light!.u.tFace, 13);
    // The shadows' program declares all the light does, and reads only the heights and cover: each on the unit the light has it on.
    names(this.shadow!, ['tA', 'tT', 'tC', 'tHalf', 'tRoom', 'tE', 'tB', 'tShade', 'tTorchShade', 'tSpread']);
    for (const [n, i] of [['tU', 12], ['tCrack', 11], ['tFace', 13], ['tDFG', 14], ['tBrush', 15]] as const) if (this.shadow!.u[n]) gl.uniform1i(this.shadow!.u[n]!, i);
    return true;
  }

  /** The program to light this plate with, its maps packed, or null with nothing to light. Called before the seat's viewport is set, as
   * packing draws elsewhere. */
  take(plate: Plate, _turn: Turn, _scene: Scene, s: Asked): Program | null {
    if (!plate.tex || !this.programs()) return null;
    this.pack(plate, s.relief);
    this.stats.lights++;
    return this.light;
  }

  private pack(plate: Plate, relief: boolean): void {
    const { gl } = this, t = plate.tex!, m = plate.map;
    let p = this.packs.get(plate);
    if (p && (p.of !== t || p.w !== m.w || p.h !== m.h)) { this.drop(plate); p = undefined; }
    if (p && p.at === plate.painted && p.relief === relief) return;
    const t0 = performance.now();
    if (!p) {
      gl.activeTexture(gl.TEXTURE0);
      const B = this.make(gl.RGBA8, m.w, m.h, true), C = this.make(gl.RGBA8, m.w, m.h, false), half = this.make(gl.R16F, Math.max(m.w >> 1, 1), Math.max(m.h >> 1, 1), true), T = this.make(gl.RGBA8, m.w, m.h, false);
      const fbo = gl.createFramebuffer()!, hfbo = gl.createFramebuffer()!, tfbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, B, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, C, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, T, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, hfbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, half, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tfbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T, 0);
      let spread: WebGLTexture | null = null, sfbo: WebGLFramebuffer | null = null;
      if (t.E) {
        spread = this.make(gl.SRGB8_ALPHA8, Math.max(m.w >> 1, 1), Math.max(m.h >> 1, 1), true);
        sfbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, sfbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spread, 0);
      }
      this.packs.set(plate, (p = { id: ++this.made, of: t, at: -1, w: m.w, h: m.h, B, C, half, T, spread, A: null, E: null, fbo, hfbo, tfbo, sfbo, most: 1, relief, moved: new Map(), crops: new Set(), bare: null, screens: new Set() }));
    }
    p.relief = relief;
    // Eight bits of height, over as much as this one stands.
    p.most = Math.max(Math.ceil(plate.peak + 1), 1);
    this.drawing(() => {
      this.draw(plate, p!, null);
      // What's shown is the maker's paint again, and what's moved or shown on a screen is laid over it again.
      this.recolour(plate, p!, null);
      for (const laid of p!.moved.values()) this.lay(plate, p!, laid);
      this.colourMips(p!);
      this.mips(p!);
      this.spreads(plate, p!);
    });
    p.at = plate.painted;
    this.stats.packs++;
    this.stats.packMs += performance.now() - t0;
  }

  private make(format: number, w: number, h: number, mips: boolean): WebGLTexture {
    const { gl } = this, x = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, x);
    gl.texStorage2D(gl.TEXTURE_2D, mips ? levels(w, h) : 1, format, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return x;
  }

  private units(...ts: (WebGLTexture | null)[]): void {
    const { gl } = this;
    ts.forEach((x, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x); });
  }

  /** Runs what draws into the packs, and leaves the context as the maker had it: nothing of a plate's bound, as it paints into those next. */
  private drawing(f: () => void): void {
    // How it blends too, as laying parts moving together adds. It's what the context was last told, not asked of the GPU.
    const { gl } = this, { blend, scissor, func: how, equation } = blending(gl);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    f();
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.blendFuncSeparate(how[0], how[1], how[2], how[3]);
    gl.blendEquationSeparate(equation[0], equation[1]);
    this.units(null, null, null, null, null, null, null, null);
    gl.activeTexture(gl.TEXTURE0);
    if (blend) gl.enable(gl.BLEND);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
  }

  /** The plate's maps into the pack, all of them or a box of them. */
  private draw(plate: Plate, p: Pack, box: { x: number; y: number; w: number; h: number } | null): void {
    const { gl } = this, t = plate.tex!, m = plate.map, d = plate.spec, P = this.packer!, u = P.u;
    // What the maker painted in was given back, which it only is with the pack as the plate last was: the pack is all there is of it,
    // and a paint since was of what glows alone. See `Renderer.spare`.
    if (!t.S) return;
    gl.disable(gl.BLEND);
    if (box) gl.enable(gl.SCISSOR_TEST);
    else gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(P.program);
    this.units(t.A, t.H, t.S, t.C, t.O, t.M, t.D, t.N ?? null);
    gl.uniform4f(u.uMap!, d.pw / m.w, d.ph / m.h, -m.x / m.w, -m.y / m.h);
    gl.uniform1f(u.uMm!, (d.cw / d.pw) * 0.25);
    gl.uniform1f(u.uMost!, p.most);
    gl.uniform1i(u.uRelief!, p.relief && t.D ? 1 : 0);
    gl.uniform1i(u.uSplit!, t.N ? 1 : 0);
    gl.uniform1f(u.uLod!, Math.log2(d.dpr) + 0.5);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
    // The grain and what's only in the finish go into a third map here, and only here: what lays parts over the pack writes two.
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    gl.viewport(0, 0, m.w, m.h);
    if (box) gl.scissor(box.x, box.y, box.w, box.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.useProgram(this.heights!.program);
    gl.uniform1i(this.heights!.u.uRelief!, p.relief && t.D ? 1 : 0);
    this.units(t.A, t.H, t.D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.hfbo);
    gl.viewport(0, 0, Math.max(m.w >> 1, 1), Math.max(m.h >> 1, 1));
    if (box) gl.scissor(box.x >> 1, box.y >> 1, box.w >> 1, box.h >> 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.units(null, null, null, null, null, null, null, null);
  }

  /**
   * Springs' ends over the pack, each as far between them as it's said to be. Nothing read is being written: the ends are crops of their own.
   * Over each, every part shown moved that meets it is laid again with it: the place at rest, and each one's change added, so two moving at
   * once, a hand drawn along a keyboard, sum where both change it, as either's ends alone can't say.
   */
  private lay(plate: Plate, p: Pack, laid: Laid[]): void {
    const { gl } = this, L = this.layer!;
    gl.disable(gl.BLEND);
    gl.enable(gl.SCISSOR_TEST);
    const springs = laid.filter(l => !l.crop.dead && l.crop.B0 && !l.crop.mask);
    for (const l of laid) if (!l.crop.dead && l.crop.B0 && l.crop.mask) this.carried(plate, p, l);
    // Everything shown moved, each as far along as it's laid now.
    const at = new Map<Crop, number>();
    for (const m of p.moved.values()) for (const l of m) if (!l.crop.dead && l.crop.B0 && !l.crop.mask) at.set(l.crop, l.f);
    for (const l of springs) at.set(l.crop, l.f);
    gl.useProgram(L.program);
    const pass = (c: Crop, f: number, mode: number, half: boolean, on: Crop) => {
      gl.uniform1f(L.u.uF!, f);
      gl.uniform1i(L.u.uMode!, mode);
      gl.uniform1i(L.u.uHalf!, half ? 1 : 0);
      if (half) {
        this.units(c.half, null, c.half0, null);
        gl.uniform2i(L.u.uAt!, c.x >> 1, c.y >> 1);
        gl.scissor(on.x >> 1, on.y >> 1, on.w >> 1, on.h >> 1);
      } else {
        this.units(c.B, c.C, c.B0, c.C0);
        gl.uniform2i(L.u.uAt!, c.x, c.y);
        gl.scissor(on.x, on.y, on.w, on.h);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    for (const half of [false, true]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, half ? p.hfbo : p.fbo);
      gl.viewport(0, 0, half ? Math.max(p.w >> 1, 1) : p.w, half ? Math.max(p.h >> 1, 1) : p.h);
      for (const { crop: on } of springs) {
        const meeting = [...at].filter(([c]) => meets(c, on));
        if (meeting.length === 1) { pass(on, at.get(on)!, 0, half, on); continue; }
        gl.disable(gl.BLEND);
        for (const [c] of meeting) pass(c, 0, 1, half, on);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.blendEquation(gl.FUNC_ADD);
        for (const [c, f] of meeting) pass(c, f, 2, half, on);
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        for (const [c, f] of meeting) pass(c, f, 3, half, on);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
    }
    gl.uniform1i(L.u.uMode!, 0);
    for (const l of springs) this.glow(plate, l);
    gl.disable(gl.SCISSOR_TEST);
    this.units(null, null, null, null);
    if (laid.some(l => !l.crop.dead && !l.crop.mask && l.crop.E)) this.spreads(plate, p);
  }

  /**
   * A part's colour and light as far between its ends as its spring is, a lamp coming on: into the maker's own, where the light reads them,
   * and its light on into what glows, over the whole canvas, as a paint of it would have left them.
   */
  private glow(plate: Plate, { crop: c, f }: Laid): void {
    const t = plate.tex, p = this.packs.get(plate);
    if (!t || !p || c.dead || c.mask || !c.A || !c.A0) return;
    const light = !!(c.E && c.E0 && t.E);
    const { A, E } = this.own(plate, p, light);
    const { gl } = this, L = this.layer!, m = plate.map, fbo = (this.scratch ??= gl.createFramebuffer()!);
    gl.useProgram(L.program);
    gl.uniform1f(L.u.uF!, f);
    gl.uniform1i(L.u.uHalf!, 0);
    gl.uniform2i(L.u.uAt!, c.x, c.y);
    this.units(c.A, c.E, c.A0, c.E0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, light ? E : null, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, light ? gl.COLOR_ATTACHMENT1 : gl.NONE]);
    gl.viewport(0, 0, m.w, m.h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(c.x, c.y, c.w, c.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.units(null, null, null, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    this.colourMips(p);
  }

  /**
   * The colour, and what glows if `lit`, that the player lays into and the light reads: made the first time anything is laid in them, as the
   * maker's are then, and kept.
   */
  private own(plate: Plate, p: Pack, lit: boolean): { A: WebGLTexture; E: WebGLTexture | null } {
    const t = plate.tex!, { gl } = this, m = plate.map, all = { x: 0, y: 0, w: m.w, h: m.h };
    if (!p.A) {
      gl.activeTexture(gl.TEXTURE0);
      p.A = this.make(gl.SRGB8_ALPHA8, m.w, m.h, true);
      this.copy(t.A, p.A, all);
    }
    if (lit && t.E && !p.E) {
      gl.activeTexture(gl.TEXTURE0);
      p.E = this.make(gl.SRGB8_ALPHA8, m.w, m.h, false);
      this.copy(t.E, p.E, all);
    }
    return { A: p.A, E: p.E };
  }

  /**
   * The colour and what glows as the maker has them now over `box`, maps px, or all of them: nothing laid there any more, till what's shown
   * moved there is laid again. Screens' pictures are laid again here, as nothing else lays them.
   */
  private recolour(plate: Plate, p: Pack, box: { x: number; y: number; w: number; h: number } | null): void {
    const t = plate.tex!, m = plate.map, at = box ?? { x: 0, y: 0, w: m.w, h: m.h };
    if (p.A) this.copy(t.A, p.A, at);
    if (p.E && t.E) this.copy(t.E, p.E, at);
    for (const s of p.screens) if (!s.dead && meets(s, at)) this.ink(plate, p, s);
  }

  /** A box of one texture into another the same size and format. */
  private copy(from: WebGLTexture, to: WebGLTexture, at: { x: number; y: number; w: number; h: number }): void {
    const { gl } = this, fbo = (this.scratch ??= gl.createFramebuffer()!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, from, 0);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, to);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, at.x, at.y, at.x, at.y, at.w, at.h);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** The colour's smaller sizes, from what's shown. */
  private colourMips(p: Pack): void {
    if (!p.A) return;
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.A);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * A part carried whole, where its joint has it: the body without it over all it sweeps, and the part as it rests moved over that. In the
   * pack, and in the maker's colour, which the light reads where it is and the maker paints again when the part is its own.
   */
  private carried(plate: Plate, p: Pack, { crop: c, go }: Laid): void {
    const { gl } = this, K = this.carry!, t = plate.tex!, d = plate.spec, m = plate.map, k = d.pw / d.cw;
    if (!go || !c.mask || !c.over || !c.A || !c.A0 || !c.T || !c.T0) return;
    gl.useProgram(K.program);
    gl.uniform2f(K.u.uGo!, go.x * k, go.y * k);
    gl.uniform2f(K.u.uPin!, go.pin[0] * k - m.x - c.x, go.pin[1] * k - m.y - c.y);
    gl.uniform1f(K.u.uTurn!, go.turn);
    // As far as it's gone toward its far end, along the line there.
    const to = c.toward, along = to && c.FB ? Math.min(Math.max((go.x * k * to[0] + go.y * k * to[1]) / (to[0] * to[0] + to[1] * to[1]), 0), 1) : 0;
    if (to) gl.uniform2f(K.u.uFar!, to[0], to[1]);
    const pass = (fbo: WebGLFramebuffer, scale: number, kinds: [number, number], u0: WebGLTexture, r0: WebGLTexture, u1: WebGLTexture | null, r1: WebGLTexture | null, d0: WebGLTexture | null = null, d1: WebGLTexture | null = null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const x = scale < 1 ? c.x >> 1 : c.x, y = scale < 1 ? c.y >> 1 : c.y, w = scale < 1 ? c.w >> 1 : c.w, h = scale < 1 ? c.h >> 1 : c.h;
      gl.viewport(0, 0, scale < 1 ? Math.max(p.w >> 1, 1) : p.w, scale < 1 ? Math.max(p.h >> 1, 1) : p.h);
      gl.scissor(x, y, w, h);
      gl.uniform2i(K.u.uAt!, x, y);
      gl.uniform1f(K.u.uScale!, scale);
      gl.uniform2i(K.u.uKind!, kinds[0], kinds[1]);
      gl.uniform1f(K.u.uW!, d0 ? along : 0);
      this.units(u0, r0, u1 ?? u0, r1 ?? r0, c.mask, c.over, d0, d1 ?? d0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    // Slopes turn with it, and the finish it leaves round it goes with it, as its colour does.
    pass(p.fbo, 1, [1, 3], c.B, c.B0!, c.C, c.C0, c.FB, c.FC);
    pass(p.hfbo, 0.5, [0, 0], c.half, c.half0!, null, null, c.FH);
    // Its grain turns with it.
    pass(p.tfbo, 1, [2, 0], c.T, c.T0, null, null);
    const { A } = this.own(plate, p, false);
    gl.useProgram(K.program);
    const fbo = (this.scratch ??= gl.createFramebuffer()!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
    pass(fbo, 1, [3, 0], c.A, c.A0, null, null, c.FA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    this.units(null, null, null, null, null, null, null, null);
    this.colourMips(p);
  }

  /** What the maker painted of a part carried whole at its far end along a line, kept: the light lays toward it as the part goes. */
  private toward(plate: Plate, c: Crop, F: { crop: Crop; go: NonNullable<Laid['go']> }): void {
    const { gl } = this, k = plate.spec.pw / plate.spec.cw, all = { x: 0, y: 0, w: c.w, h: c.h };
    const half = { x: 0, y: 0, w: c.w >> 1, h: c.h >> 1 };
    Object.assign(c, { FB: this.lift(F.crop.B, gl.RGBA8, all), FC: this.lift(F.crop.C, gl.RGBA8, all), FH: this.lift(F.crop.half, gl.R16F, half), FA: this.lift(F.crop.A!, gl.SRGB8_ALPHA8, all), toward: [F.go.x * k, F.go.y * k] });
    this.stats.cropBytes += farBytes(c);
  }

  /** A box of one of the maker's maps, as a texture of its own in the same format. */
  private lift(from: WebGLTexture, format: number, at: { x: number; y: number; w: number; h: number }): WebGLTexture {
    const { gl } = this, fbo = (this.scratch ??= gl.createFramebuffer()!);
    gl.activeTexture(gl.TEXTURE0);
    const x = this.make(format, at.w, at.h, false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, from, 0);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindTexture(gl.TEXTURE_2D, x);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x, at.y, at.w, at.h);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return x;
  }

  /** The pack's grain over a box, as a texture of its own. */
  private grained(p: Pack, at: { x: number; y: number; w: number; h: number }): WebGLTexture {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const x = this.make(gl.RGBA8, at.w, at.h, false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.tfbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindTexture(gl.TEXTURE_2D, x);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x, at.y, at.w, at.h);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return x;
  }

  /** What glows, taken again at half size and spread to its smaller sizes from the maker's, once that has changed. */
  private spreads(plate: Plate, p: Pack): void {
    const t = plate.tex;
    if (!p.spread || !t?.E) return;
    const { gl } = this, read = (this.scratch ??= gl.createFramebuffer()!);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.E ?? t.E, 0);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.sfbo);
    gl.blitFramebuffer(0, 0, p.w, p.h, 0, 0, Math.max(p.w >> 1, 1), Math.max(p.h >> 1, 1), gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.spread);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private mips(p: Pack): void {
    const { gl } = this;
    this.units(p.B, p.half);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /** Whether a part can be moved on this plate by its crops: the player lights it and holds its maps as the plate last had them. */
  plays(plate: Plate): boolean {
    const p = this.packs.get(plate);
    return !!p && !!plate.tex && p.of === plate.tex;
  }

  /** Which pack a plate has, counted from 1, or 0 with none. A new one came with new maps, and every crop of the old one went with it. */
  packed(plate: Plate): number {
    return this.packs.get(plate)?.id ?? 0;
  }

  /** Its heights as the pack has them, mm in `r` at half the maps' size and over the same place, or null with no pack of these maps. */
  stands(plate: Plate): WebGLTexture | null {
    const p = this.packs.get(plate);
    return p && plate.tex && p.of === plate.tex ? p.half : null;
  }

  /** Whether its pack is the plate as last painted, so a spring can be read off it. */
  current(plate: Plate): boolean {
    return this.plays(plate) && this.packs.get(plate)!.at === plate.painted;
  }

  /**
   * Packs a plate it already plays as it's painted now, without lighting it, and says whether the pack is then current: for a maker
   * about to give back what the pack is made from before the plate's next light. See `Renderer.spare`.
   */
  repack(plate: Plate): boolean {
    const p = this.packs.get(plate);
    if (!p || !this.plays(plate) || !plate.tex?.S) return false;
    if (p.at !== plate.painted) this.drawing(() => this.pack(plate, p.relief));
    return this.current(plate);
  }

  /** A box of the canvas, css px, as a box of the maps: grown a little for what reads its neighbours, even on every side, inside the maps. */
  private boxOf(plate: Plate, b: Box): { x: number; y: number; w: number; h: number } | null {
    const d = plate.spec, m = plate.map, k = d.pw / d.cw, pad = Math.ceil(6 * k);
    const x0 = Math.max((Math.floor(b.x * k) - m.x - pad) & ~1, 0), y0 = Math.max((Math.floor(b.y * k) - m.y - pad) & ~1, 0);
    const x1 = Math.min((Math.ceil((b.x + b.w) * k) - m.x + pad + 1) & ~1, m.w & ~1), y1 = Math.min((Math.ceil((b.y + b.h) * k) - m.y + pad + 1) & ~1, m.h & ~1);
    return x1 - x0 >= 2 && y1 - y0 >= 2 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  /**
   * The plate was painted again over `box`, css px, and the pack takes that much of it: a spring being read at its far end, half way and back,
   * which nobody is shown. With `keep`, what the pack then holds there is kept as a crop.
   */
  read(plate: Plate, box: Box, keep: Box | null, whole = false, lit = false): Crop | null {
    const p = this.packs.get(plate), all = this.boxOf(plate, whole ? box : seen(box)), at = keep && this.boxOf(plate, whole ? keep : seen(keep));
    if (!p || !all) return null;
    const { gl } = this;
    let crop: Crop | null = null;
    this.drawing(() => {
      // As the plate has it, with nothing laid over it: a part's ends are of it moved and everything else at rest, as what's shown
      // moved is laid over them by its own. One moving as it's read would leave where it was then in another's crop, and the gap between
      // two keys, a hand drawn along them, in specks of it. What's shown moved there is laid again when the reading is over.
      this.draw(plate, p, all);
      p.bare = p.bare ? join(p.bare, all) : all;
      if (at) {
        const [B, C, half] = this.cut(p, at);
        const t = plate.tex!, glows = lit && !whole;
        const A = this.lift(t.A, gl.SRGB8_ALPHA8, at), T = whole ? this.grained(p, at) : null;
        const E = glows ? this.lift(t.E ?? t.A, gl.SRGB8_ALPHA8, at) : null;
        crop = { ...at, B, C, half, B0: null, C0: null, half0: null, A, T, A0: null, T0: null, E, E0: null, mask: null, over: null, FB: null, FC: null, FH: null, FA: null, toward: null, dead: false };
        p.crops.add(crop);
        this.stats.crops++;
        this.stats.cropBytes += bytesOf(crop) / 2;
      }
    });
    p.at = plate.painted;
    return crop;
  }

  /**
   * As `read`, of a spring half way, which is only there to be judged against: the pack takes the plate over `box`, and of what it then
   * holds over `keep` only what `ask` reads is kept. The crop it's judged against is all that's held at full size.
   */
  readMid(plate: Plate, box: Box, keep: Box, lit = false): Mid | null {
    const p = this.packs.get(plate), all = this.boxOf(plate, seen(box)), at = this.boxOf(plate, seen(keep));
    if (!p || !all || !at) return null;
    const { gl } = this;
    let mid: Mid | null = null;
    this.drawing(() => {
      this.draw(plate, p, all);
      p.bare = p.bare ? join(p.bare, all) : all;
      const t = plate.tex!, half = this.make(gl.R16F, at.w >> 1, at.h >> 1, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, p.hfbo);
      gl.bindTexture(gl.TEXTURE_2D, half);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x >> 1, at.y >> 1, at.w >> 1, at.h >> 1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      const A = lit ? this.lift(t.A, gl.SRGB8_ALPHA8, at) : null;
      mid = { half, A, E: lit ? (t.E ? this.lift(t.E, gl.SRGB8_ALPHA8, at) : A) : null };
    });
    p.at = plate.painted;
    return mid;
  }

  freeMid(mid: Mid): void {
    const { gl } = this;
    gl.deleteTexture(mid.half);
    gl.deleteTexture(mid.A);
    if (mid.E !== mid.A) gl.deleteTexture(mid.E);
  }

  /** What the pack holds over a box, as textures of their own. */
  private cut(p: Pack, at: { x: number; y: number; w: number; h: number }): [WebGLTexture, WebGLTexture, WebGLTexture] {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const B = this.make(gl.RGBA8, at.w, at.h, false), C = this.make(gl.RGBA8, at.w, at.h, false), half = this.make(gl.R16F, at.w >> 1, at.h >> 1, false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindTexture(gl.TEXTURE_2D, B);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x, at.y, at.w, at.h);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.bindTexture(gl.TEXTURE_2D, C);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x, at.y, at.w, at.h);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.hfbo);
    gl.bindTexture(gl.TEXTURE_2D, half);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, at.x >> 1, at.y >> 1, at.w >> 1, at.h >> 1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return [B, C, half];
  }

  /** The reading is over and the plate is as it was: what the pack holds where the crop was cut is its other end, and the pack's smaller sizes catch up. */
  readEnd(plate: Plate, crop: Crop | null, far?: { crop: Crop; go: NonNullable<Laid['go']> } | null): void {
    const p = this.packs.get(plate);
    if (!p) return;
    this.drawing(() => {
      if (crop && !crop.dead) {
        [crop.B0, crop.C0, crop.half0] = this.cut(p, crop);
        this.stats.cropBytes += bytesOf(crop) / 2;
        if (!crop.T && plate.tex) {
          const { gl } = this, t = plate.tex;
          if (crop.A) crop.A0 = this.lift(t.A, gl.SRGB8_ALPHA8, crop);
          if (crop.E) crop.E0 = this.lift(t.E ?? t.A, gl.SRGB8_ALPHA8, crop);
        }
        else if (crop.A && plate.tex) {
          crop.A0 = this.lift(plate.tex.A, this.gl.SRGB8_ALPHA8, crop);
          crop.T0 = this.grained(p, crop);
          // Where the part is: where the device with it isn't the device without.
          const { gl } = this, mask = (crop.mask = this.make(gl.R8, crop.w, crop.h, false));
          gl.bindFramebuffer(gl.FRAMEBUFFER, (this.scratch ??= gl.createFramebuffer()!));
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mask, 0);
          gl.viewport(0, 0, crop.w, crop.h);
          gl.useProgram(this.apart!.program);
          this.units(crop.B, crop.B0, crop.half, crop.half0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          // And where the body stands over it: where it would be at its far end, and the maker shows the body there all the same.
          const over = (crop.over = this.make(gl.R8, crop.w, crop.h, false));
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, over, 0);
          const F = far && !far.crop.dead && far.crop.A && far.crop.w === crop.w && far.crop.h === crop.h ? far : null;
          if (F) {
            const V = this.cover!, k = plate.spec.pw / plate.spec.cw, m = plate.map;
            gl.useProgram(V.program);
            gl.uniform2f(V.u.uGo!, F.go.x * k, F.go.y * k);
            gl.uniform2f(V.u.uPin!, F.go.pin[0] * k - m.x - crop.x, F.go.pin[1] * k - m.y - crop.y);
            gl.uniform1f(V.u.uTurn!, F.go.turn);
            this.units(crop.A, F.crop.A, crop.B, F.crop.B, crop.C, F.crop.C, mask);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          } else { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
          this.units(null, null, null, null, null, null, null);
          // Along a line, what it misses at its far end. Turned about its pin it meets the body the same all the way round.
          if (F && !F.go.turn && (F.go.x || F.go.y)) this.toward(plate, crop, F);
        }
      }
      // Whatever is shown moved where it was read is moved again.
      const bare = p.bare, near = bare ? [...p.moved.values()].flat().filter(l => meets(l.crop, bare)) : [];
      p.bare = null;
      // The maker painted its colour there as it read, which is shown as it has it now.
      if (bare && plate.tex) this.recolour(plate, p, bare);
      if (near.length) this.lay(plate, p, near);
      this.mips(p);
      this.colourMips(p);
    });
  }

  /**
   * Asks whether a spring's maps are a lerp between its ends, the pack holding them at rest: `to` its far end, `mid` half way.
   * `judged` answers once the GPU has.
   */
  ask(plate: Plate, to: Crop, mid: Mid): Judging | null {
    const p = this.packs.get(plate);
    if (!p || to.dead) return null;
    const { gl } = this, J = this.judge!, w = to.w >> 1, h = to.h >> 1;
    const went = gl.createQuery()!, bent = gl.createQuery()!;
    const glow: Judging['glow'] = to.E && mid.E ? [gl.createQuery()!, gl.createQuery()!] : null;
    this.drawing(() => {
      // Somewhere to draw that isn't being read: nothing is kept of it.
      const scratch = gl.createRenderbuffer()!, fbo = gl.createFramebuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, scratch);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.R8, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, scratch);
      gl.viewport(0, 0, w, h);
      gl.useProgram(J.program);
      this.units(p.half, to.half, mid.half);
      gl.uniform2i(J.u.uAt!, to.x >> 1, to.y >> 1);
      [went, bent].forEach((q, i) => {
        gl.uniform1i(J.u.uWhat!, i);
        gl.beginQuery(gl.ANY_SAMPLES_PASSED, q);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.endQuery(gl.ANY_SAMPLES_PASSED);
      });
      // And of its colour and light, where those were read: the maker's own hold them at rest.
      const t = plate.tex;
      if (glow && t && to.A && to.E && mid.A && mid.E) {
        const G = this.glowJudge!;
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.R8, to.w, to.h);
        gl.viewport(0, 0, to.w, to.h);
        gl.useProgram(G.program);
        this.units(t.A, to.A, mid.A, t.E ?? t.A, to.E, mid.E);
        gl.uniform2i(G.u.uAt!, to.x, to.y);
        glow.forEach((q, i) => {
          gl.uniform1i(G.u.uWhat!, i);
          gl.beginQuery(gl.ANY_SAMPLES_PASSED, q);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.endQuery(gl.ANY_SAMPLES_PASSED);
        });
      }
      this.units(null, null, null, null, null, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteRenderbuffer(scratch);
    });
    const j = { went, bent, glow, dead: false };
    this.asked.add(j);
    return j;
  }

  /** True for a spring whose maps lerp, false for one that doesn't or moves nothing, null while the GPU hasn't said. */
  judged(j: Judging): boolean | null {
    const { gl } = this;
    // Asked of a context that has gone: nobody will say.
    if (j.dead || gl.isContextLost()) return false;
    const qs = [j.went, j.bent, ...(j.glow ?? [])];
    if (qs.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) return null;
    const [w, b, gw, gb] = qs.map(q => !!gl.getQueryParameter(q, gl.QUERY_RESULT)), went = w || !!gw, bent = b || !!gb;
    for (const q of qs) gl.deleteQuery(q);
    this.asked.delete(j);
    return went && !bent;
  }

  /**
   * Shows a part where its springs have it, by its crops and no paint: `laid` is every spring of it that has one, and how far along.
   * `rests` says the plate has the part where its springs rest, so with every spring there too nothing is laid at all. `here` says the
   * plate has it where its springs are now, as the maker last drew it, so with nothing laid over that since, there's nothing to lay: a lay
   * is only ever as good as what was read, and the maker's own is what it is.
   * False if the plate isn't the player's to move, and the maker paints it.
   */
  move(plate: Plate, part: unknown, laid: Laid[], rests: boolean, here = false): boolean {
    const p = this.packs.get(plate);
    if (!p || !this.plays(plate) || laid.some(l => l.crop.dead || !l.crop.B0)) return false;
    if (here && !p.moved.has(part)) return true;
    const gone = !rests || laid.some(away);
    if (!gone && !p.moved.has(part)) return true;
    if (gone) p.moved.set(part, laid);
    else p.moved.delete(part);
    this.stats.moves++;
    // Painted since it was packed, it's packed again before it's next lit, and everything moved is laid then.
    if (p.at !== plate.painted) return true;
    this.drawing(() => {
      this.lay(plate, p, laid);
      this.mips(p);
    });
    return true;
  }

  /** A part is the plate's again, as its crops went: where it was laid is packed from the plate. */
  unmove(plate: Plate, part: unknown): void {
    const p = this.packs.get(plate), laid = p?.moved.get(part);
    if (!p || !laid) return;
    p.moved.delete(part);
    if (!plate.tex || p.of !== plate.tex) return;
    // Packed again before it's next lit, colour and all.
    if (p.at !== plate.painted) return;
    this.drawing(() => {
      // Its colour and light are the maker's again where it was laid.
      for (const l of laid) if (!l.crop.dead) this.recolour(plate, p, l.crop);
      // One carried whole was laid in its grain too, which goes back as it was first.
      for (const l of laid) if (l.crop.mask && !l.crop.dead) this.carried(plate, p, { crop: l.crop, f: 0, go: { x: 0, y: 0, turn: 0, pin: [0, 0] } });
      // And one laid between its ends goes back to where it rests by its own crops, as the maker may have nothing left to pack it from.
      this.lay(plate, p, laid.filter(l => !l.crop.mask).map(l => ({ crop: l.crop, f: 0 })));
      for (const l of laid) this.draw(plate, p, l.crop);
      const near = [...p.moved.values()].flat().filter(l => laid.some(m => meets(l.crop, m.crop)));
      if (near.length) this.lay(plate, p, near);
      this.mips(p);
      this.colourMips(p);
    });
  }

  /** All of the plate is being painted again with every part where it is: nothing is shown moved. */
  /**
   * Whether the plate shows a part turned by a lay: the maps it was read off, turned, land between their own texels, and a knurl in a
   * sharp light comes out not quite as the maker paints it there. Along the grid, as a slide goes, and between a spring's ends, it's exact.
   */
  turned(plate: Plate): boolean {
    const p = this.packs.get(plate);
    return !!p && [...p.moved.values()].some(laid => laid.some(l => !!l.go?.turn));
  }

  settle(plate: Plate): void {
    this.packs.get(plate)?.moved.clear();
  }

  /** A crop nobody will lay again. */
  free(crop: Crop): void {
    if (crop.dead) return;
    const { gl } = this;
    crop.dead = true;
    for (const x of [crop.B, crop.C, crop.half, crop.B0, crop.C0, crop.half0, crop.A, crop.T, crop.A0, crop.T0, crop.E, crop.E0, crop.mask, crop.over, crop.FB, crop.FC, crop.FH, crop.FA]) gl.deleteTexture(x);
    this.stats.crops--;
    this.stats.cropBytes -= bytesOf(crop) * (crop.B0 ? 1 : 0.5) + (crop.FB ? farBytes(crop) : 0);
    for (const p of this.packs.values()) if (p.crops.delete(crop)) for (const [k, laid] of p.moved) if (laid.some(l => l.crop === crop)) p.moved.delete(k);
  }

  /** The maker's colour and light over a box of the canvas, css px, as they are now: a screen being read, as it is, all black and all white. */
  lifts(plate: Plate, box: Box): Lift | null {
    const at = this.boxOf(plate, box), t = plate.tex;
    if (!at || !t || !this.packs.has(plate)) return null;
    const { gl } = this;
    let l: Lift | null = null;
    // With no light of its own kept apart, its light is its colour: the one copy stands for both.
    this.drawing(() => {
      const A = this.lift(t.A, gl.SRGB8_ALPHA8, at);
      l = { ...at, A, E: t.E ? this.lift(t.E, gl.SRGB8_ALPHA8, at) : A, lit: !!t.E };
    });
    return l;
  }

  unlift(l: Lift | null): void {
    if (!l) return;
    this.gl.deleteTexture(l.A);
    if (l.E !== l.A) this.gl.deleteTexture(l.E);
  }

  /** A picture to show a screen: the page's own, or one colour all over at the same size. */
  private picture(of: TexImageSource | [number, number, number]): WebGLTexture {
    const { gl } = this, x = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, x);
    if (Array.isArray(of)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, of[0], of[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(of[0] * of[1] * 4).fill(of[2]));
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, of);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return x;
  }

  /**
   * Says where a screen is and what kind, to a program that draws one, and sets it to draw as the maker does: the canvas over the maps,
   * which start some way into it. `at` is where the target's corner is on the maps.
   */
  private screened(P: Program, plate: Plate, c: ScreenCommand, at: [number, number]): void {
    const { gl } = this, u = P.u, d = plate.spec, m = plate.map, s = c.shape as { cx: number; cy: number; hw: number; hh: number; rotate?: number }, b = extent(c);
    gl.useProgram(P.program);
    gl.viewport(-m.x - at[0], -m.y - at[1], d.pw, d.ph);
    gl.uniform4f(u.uBox!, b.x, b.y, b.x + b.w, b.y + b.h);
    gl.uniform2f(u.uCanvas!, d.cw, d.ch);
    gl.uniform1i(u.uKind!, SCREEN[c.kind]);
    gl.uniform3f(u.uInk!, c.ink[0], c.ink[1], c.ink[2]);
    gl.uniform3f(u.uColor!, c.color[0], c.color[1], c.color[2]);
    gl.uniform3f(u.uEmit!, c.emit[0], c.emit[1], c.emit[2]);
    gl.uniform2f(u.uInset!, c.inset[0], c.inset[1]);
    gl.uniform2f(u.uCenter!, s.cx, s.cy);
    gl.uniform2f(u.uHalf!, s.hw, s.hh);
    gl.uniform1f(u.uRot!, s.rotate ?? 0);
    gl.uniform1f(u.uZoom!, d.fine);
    gl.uniform1f(u.uGain!, c.gain);
    gl.uniform1f(u.uMetal!, c.metal);
    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, plate.broken?.panels.get(panelKey(c)) ?? this.whole());
    gl.activeTexture(gl.TEXTURE0);
  }

  /** A screen's picture whole, as its damage map reads where nothing broke. */
  private whole(): WebGLTexture {
    const { gl } = this;
    if (!this.intact) {
      this.intact = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.intact);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 128, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    return this.intact;
  }
  private intact: WebGLTexture | null = null;

  /**
   * Reads a screen so its next picture is no paint: `real` is the maker's colour and light with its picture as it is, `black` and `white`
   * with it all one or the other, the picture `size` px. Kept: those maps with none of the screen in them, and how much of the screen comes
   * through at each pixel. `matched` says, once the GPU has, whether the picture it has now shown that way is what the maker painted.
   */
  screen(plate: Plate, real: Lift, black: Lift, white: Lift, c: ScreenCommand, size: [number, number]): { shown: Shown; matching: Matching | null } | null {
    const p = this.packs.get(plate);
    if (!p || !this.plays(plate) || real.w !== black.w || real.h !== black.h || white.w !== black.w || white.h !== black.h) return null;
    const { gl } = this, { w, h } = real;
    let out: { shown: Shown; matching: Matching | null } | null = null;
    this.drawing(() => {
      const fbo = gl.createFramebuffer()!, tmp: WebGLTexture[] = [];
      // The screen alone is between 0 and 1 and read against lifts kept the same way, so it's kept as they are: half of what floats take.
      const wide = () => { const x = this.make(gl.SRGB8_ALPHA8, w, h, false); tmp.push(x); return x; };
      const into = (...ts: WebGLTexture[]) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        for (let i = 0; i < 3; i++) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, ts[i] ?? null, 0);
        gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
        gl.viewport(0, 0, w, h);
      };
      gl.activeTexture(gl.TEXTURE0);
      const sab = wide(), seb = wide(), saw = wide(), sew = wide();
      // The screen alone, all black and all white, as the maker drew it both ways.
      for (const [level, a, e] of [[0, sab, seb], [255, saw, sew]] as const) {
        const pic = this.picture([size[0], size[1], level]);
        into(a, e);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.screened(this.alone!, plate, c, [real.x, real.y]);
        this.units(pic);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.deleteTexture(pic);
      }
      gl.activeTexture(gl.TEXTURE0);
      const T = this.make(gl.RG8, w, h, false), A = this.make(gl.RGBA16F, w, h, false), E = this.make(gl.RGBA16F, w, h, false);
      into(T, A, E);
      gl.useProgram(this.through!.program);
      this.units(black.A, black.E, white.A, white.E, sab, seb, saw, sew);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const shown: Shown = { x: real.x, y: real.y, w, h, A, E, T, pic: this.picture(c.source), cmd: c, inked: c.kind !== 'crt' && c.kind !== 'oled', lit: real.lit, dead: false };
      p.screens.add(shown);
      // Shown its picture that way, is it what the maker painted? Drawn somewhere that isn't kept.
      const scratch = gl.createRenderbuffer()!, q = gl.createQuery()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, scratch);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.R8, w, h);
      into();
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, scratch);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      this.screened(this.shower!, plate, c, [real.x, real.y]);
      gl.uniform2i(this.shower!.u.uAt!, 0, 0);
      gl.uniform1i(this.shower!.u.uJudge!, 1);
      gl.uniform1i(this.shower!.u.uLit!, real.lit ? 1 : 0);
      this.units(shown.pic, A, E, T, real.A, real.E);
      gl.beginQuery(gl.ANY_SAMPLES_PASSED, q);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endQuery(gl.ANY_SAMPLES_PASSED);
      this.units(null, null, null, null, null, null, null, null);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteRenderbuffer(scratch);
      for (const x of tmp) gl.deleteTexture(x);
      const matching = { q, dead: false };
      this.matching.add(matching);
      out = { shown, matching };
    });
    return out;
  }

  /** True for a screen whose picture the player shows as the maker painted it, false for one it doesn't, null while the GPU hasn't said. */
  matched(j: Matching): boolean | null {
    const { gl } = this;
    if (j.dead || gl.isContextLost()) return false;
    if (!gl.getQueryParameter(j.q, gl.QUERY_RESULT_AVAILABLE)) return null;
    const off = !!gl.getQueryParameter(j.q, gl.QUERY_RESULT);
    gl.deleteQuery(j.q);
    this.matching.delete(j);
    return !off;
  }
  private matching = new Set<Matching>();

  /**
   * A screen's new picture, with no paint: taken as a texture, and what the screen makes of it laid into the maker's colour and light where
   * the light reads them. False if the plate isn't the player's, and the maker paints it.
   */
  show(plate: Plate, s: Shown, source: TexImageSource): boolean {
    const p = this.packs.get(plate), t = plate.tex;
    if (!p || !t || s.dead || !p.screens.has(s) || !this.plays(plate)) return false;
    const { gl } = this;
    this.drawing(() => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.pic);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.ink(plate, p, s);
      this.colourMips(p);
      if (s.lit && t.E) this.spreads(plate, p);
    });
    this.stats.shows++;
    return true;
  }

  /** What a screen makes of its picture, laid into the colour and light the light reads. */
  private ink(plate: Plate, p: Pack, s: Shown): void {
    const t = plate.tex!, lit = s.lit && !!t.E;
    if (!s.inked && !lit) return;
    const { gl } = this, S = this.shower!, { A, E } = this.own(plate, p, lit), fbo = (this.scratch ??= gl.createFramebuffer()!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.inked ? A : null, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, lit ? E : null, 0);
    gl.drawBuffers([s.inked ? gl.COLOR_ATTACHMENT0 : gl.NONE, lit ? gl.COLOR_ATTACHMENT1 : gl.NONE]);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(s.x, s.y, s.w, s.h);
    this.screened(S, plate, s.cmd, [0, 0]);
    gl.uniform2i(S.u.uAt!, s.x, s.y);
    gl.uniform1i(S.u.uJudge!, 0);
    gl.uniform1i(S.u.uLit!, 0);
    this.units(s.pic, s.A, s.E, s.T, null, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
    this.units(null, null, null, null, null, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  }

  /** A screen nobody will show again by what was read of it. */
  unshow(s: Shown): void {
    if (s.dead) return;
    s.dead = true;
    for (const x of [s.A, s.E, s.T, s.pic]) this.gl.deleteTexture(x);
    for (const p of this.packs.values()) p.screens.delete(s);
  }

  /**
   * The lamp frame's shadows, marched at half the size the device is lit at into the scratch the light reads them from. `use` sets on a
   * program what the renderer sets on the light, as it's the same frame. Leaves the scratch's framebuffer bound.
   */
  shadows(plate: Plate, pw: number, ph: number, use: (p: Program) => void): void {
    const { gl } = this, w = Math.ceil(pw / 2), h = Math.ceil(ph / 2);
    let s = this.shade;
    if (!s || s.w < w || s.h < h) {
      if (s) { gl.deleteTexture(s.tex); gl.deleteTexture(s.torch); gl.deleteFramebuffer(s.fbo); }
      gl.activeTexture(gl.TEXTURE0);
      // The lamp's, the page's, the room's and the strongest flash's in one, and a torch's apart.
      const W = Math.max(w, s?.w ?? 0), H = Math.max(h, s?.h ?? 0), tex = this.make(gl.RGBA8, W, H, false), torch = this.make(gl.R8, W, H, false), fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, torch, 0);
      this.shade = s = { tex, torch, fbo, w: W, h: H, at: [1, 1] };
    }
    s.at = [w / s.w, h / s.h];
    this.drawing(() => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, w, h);
      use(this.shadow!);
      gl.uniform2f(this.shadow!.u.uShift!, 0, 0);
      this.maps(plate, this.shadow!, null, null);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  }

  /** Its maps on the units the light reads, and what only the player knows, once the renderer has set the rest. */
  bind(plate: Plate, room: WebGLTexture, dark: WebGLTexture | null): void {
    this.maps(plate, this.light!, room, dark);
    const { gl } = this, u = this.light!.u;
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.shade?.tex ?? null);
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, this.shade?.torch ?? null);
    gl.uniform2f(u.uShadeAt!, ...(this.shade?.at ?? [1, 1]));
  }

  private maps(plate: Plate, prog: Program, room: WebGLTexture | null, dark: WebGLTexture | null): void {
    const { gl } = this, t = plate.tex!, p = this.packs.get(plate)!, d = plate.spec, u = prog.u;
    // What glows is over the maps.
    [p.A ?? t.A, p.T, p.C, p.half, room, p.E ?? t.E ?? dark, p.B].forEach((x, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x); });
    gl.uniform1f(u.uPx!, (d.pw / d.cw) * 4);
    gl.uniform1f(u.uMost!, p.most);
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, p.spread ?? dark);
    gl.uniform1i(u.uGlows!, t.E ? 1 : 0);
  }

  /** What glows on a plate as it's shown, the maker's with what the player laid in it: what the room is lit by. */
  glows(plate: Plate): WebGLTexture | null {
    return this.packs.get(plate)?.E ?? plate.tex?.E ?? null;
  }

  /** Bytes it holds for a plate, on top of the plate's own. */
  bytes(plate: Plate): number {
    const p = this.packs.get(plate);
    return p ? Math.round(p.w * p.h * (4 * (4 / 3) + 4 + 4 + (2 * (4 / 3)) / 4 + (p.spread ? (4 * (4 / 3)) / 4 : 0) + (p.A ? 4 * (4 / 3) : 0) + (p.E ? 4 : 0))) + [...p.crops].reduce((n, c) => n + bytesOf(c) * (c.B0 ? 1 : 0.5), 0) : 0;
  }

  drop(plate: Plate): void {
    const p = this.packs.get(plate);
    if (!p) return;
    const { gl } = this;
    for (const c of [...p.crops]) this.free(c);
    for (const x of [...p.screens]) this.unshow(x);
    gl.deleteTexture(p.B); gl.deleteTexture(p.C); gl.deleteTexture(p.half); gl.deleteTexture(p.T); gl.deleteTexture(p.spread); gl.deleteTexture(p.A); gl.deleteTexture(p.E);
    gl.deleteFramebuffer(p.fbo); gl.deleteFramebuffer(p.hfbo); gl.deleteFramebuffer(p.tfbo); gl.deleteFramebuffer(p.sfbo);
    this.packs.delete(plate);
  }

  /** A plate is closed: nothing of it is kept. */
  close(plate: Plate): void {
    this.drop(plate);
  }

  /** What the GPU has been asked and hasn't said. */
  private asked = new Set<Judging>();

  /** The context went, and all on it: programs and packs are made again as they're asked for. */
  lost(): void {
    for (const p of this.packs.values()) for (const c of p.crops) c.dead = true;
    for (const p of this.packs.values()) for (const x of p.screens) x.dead = true;
    for (const j of this.matching) j.dead = true;
    this.matching.clear();
    for (const j of this.asked) j.dead = true;
    this.asked.clear();
    this.packs.clear();
    this.stats.crops = this.stats.cropBytes = 0;
    this.light = this.shadow = this.packer = this.heights = this.layer = this.judge = this.glowJudge = this.carry = this.apart = this.cover = this.alone = this.through = this.shower = null;
    this.scratch = this.shade = null;
  }

}
