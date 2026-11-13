// Records commands: each one's values go into a uniform block, and what to do with them into a list, run once the block is up.
import { extent } from './commands.js';
import type { FieldCache } from './fields.js';
import type { Block } from './gl.js';
import type { Plate } from './plate.js';
import { MODE, PATTERN, PROFILE, SCREEN, SHAPE } from './shaders/material.js';
import type { Command, ScreenCommand } from './sheet.js';
import type { Insets, Rows } from './section.js';
import type { Shape } from './shapes.js';
import type { Box } from './types.js';

export class Recorder {
  /** What a paint will do on the GPU, in order, once its values are uploaded. */
  readonly later: (() => void)[] = [];
  /** The command being drawn, for saying which one threw. */
  drawing: Command | null = null;
  /** Whether finishes raise their pattern out of the surface. Off, they keep its colour and only lose its relief. */
  relief = true;
  /** Screens show nothing: what's drawn on them is the page's, for another renderer to lay over. A coat's print is part of the thing and stays. */
  blank = false;
  /** One screen shows one level all over in place of its picture, at the picture's size: read both ways, black and white, for how much of it comes through what's over it. */
  stand: { source: TexImageSource; level: number } | null = null;
  /** What broke in a screen, on its plate, as a map it reads: see broken.ts. */
  damage: ((plate: Plate, c: ScreenCommand) => WebGLTexture | null) | null = null;
  /**
   * Set while drawing another face's surface as this face sees it edge-on: where on this plate, css px, how that face turns from this
   * one, and where both are. A layer of the body comes with how far its outline reaches, row by row, and is this face's own body.
   */
  aim: { box: Box; seen: [number, number, number, number]; from: [number, number, number]; reach: Box; rows?: Rows; inset?: Insets | null } | null = null;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly block: Block, private readonly fields: FieldCache, private readonly screenTex: WebGLTexture) {}

  private bindShape(shape: Shape, dpr: number, box: Box): void {
    const { gl, block: b } = this, { f, i, at: a } = b;
    b.four(a.uBox!, box.x, box.y, box.x + box.w, box.y + box.h);
    i[a.uShape!] = SHAPE[shape.type];
    f[a.uRot!] = 0;
    f[a.uGrow!] = shape.grow ?? 0;
    f[a.uRing!] = shape.ring ?? 0;
    b.vec(a.uRipple!, [0, 0, 0]);
    i[a.uClipShape!] = -1;
    f[a.uGroundWear!] = 0;
    if (shape.type === 'capsule') {
      b.four(a.uCap!, shape.ax, shape.ay, shape.bx, shape.by);
      b.two(a.uCapR!, shape.ra, shape.rb);
      b.two(a.uHalf!, 1, 1);
      b.two(a.uCenter!, (shape.ax + shape.bx) / 2, (shape.ay + shape.by) / 2);
    } else if (shape.type === 'arc') {
      b.two(a.uCenter!, shape.cx, shape.cy);
      b.two(a.uHalf!, shape.hw, shape.hh);
      b.four(a.uCap!, shape.mid, shape.half, shape.r, shape.width / 2);
    } else if (shape.type === 'mask') {
      b.two(a.uCenter!, shape.box.x, shape.box.y);
    } else {
      b.two(a.uCenter!, shape.cx, shape.cy);
      b.two(a.uHalf!, shape.hw, shape.hh);
      if (shape.type === 'rect') {
        f[a.uRadius!] = shape.radius;
        f[a.uRot!] = shape.rotate;
        b.vec(a.uRipple!, shape.ripple);
      } else if (shape.type === 'holes') {
        f[a.uRadius!] = shape.radius;
        b.vec(a.uHoles!, [shape.pitch, shape.hole, shape.square ? 1 : 0]);
      } else {
        f[a.uRot!] = shape.rotate;
        // A squashed shape squashes its margin too, so the field still lines up.
        b.two(a.uSpread!, shape.spread, shape.spread * (shape.hh / (shape.source?.hh ?? shape.hh)));
        const field = this.fields.get(shape, dpr);
        this.later.push(() => {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, field);
          gl.activeTexture(gl.TEXTURE0);
        });
      }
    }
  }

  /** What a mark lies on, which it stops at. Outlines that are neither a box nor a field hold nothing back. */
  private bindHolder(shape: Shape | undefined, dpr: number): void {
    const { gl, block: b } = this, { f, i, at: a } = b;
    if (shape?.type !== 'rect' && shape?.type !== 'field') return;
    i[a.uClipShape!] = SHAPE[shape.type];
    b.four(a.uClip!, shape.cx, shape.cy, shape.hw, shape.hh);
    f[a.uClipRot!] = shape.rotate;
    if (shape.type === 'rect') {
      f[a.uClipRadius!] = shape.radius;
      return;
    }
    b.two(a.uClipSpread!, shape.spread, shape.spread * (shape.hh / (shape.source?.hh ?? shape.hh)));
    const field = this.fields.get(shape, dpr);
    this.later.push(() => {
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, field);
      gl.activeTexture(gl.TEXTURE0);
    });
  }

  /** Writes a command's values into the block, and notes what's to be done with them. */
  draw(c: Command, plate: Plate): void {
    const d = plate.spec;
    const { gl, block: b, later } = this, { f, i, at: a } = b;
    this.drawing = c;
    const quad = () => {
      const draw = b.keep();
      later.push(() => {
        b.use(draw);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    };
    const over = () => later.push(() => gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA));
    const add = () => later.push(() => gl.blendFunc(gl.ONE, gl.ONE));
    this.bindShape(c.shape, d.dpr, extent(c));
    i[a.uEdge!] = 0;
    const n = c.bend;
    f[a.uBendReach!] = n ? n.reach : 0;
    if (n) {
      b.two(a.uBendDir!, n.dir[0], n.dir[1]);
      b.two(a.uBendAt!, n.at, n.flat);
      f[a.uBendDrop!] = n.drop;
      f[a.uBendK!] = n.k;
      i[a.uBendBoth!] = n.both ? 1 : 0;
    }

    if (c.op === 'screen') {
      later.push(() => {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.screenTex);
        // Nothing is black, but on e-ink, where it's bare paper.
        const stood = this.stand?.source === c.source ? this.stand : null, { width: sw, height: sh } = c.source as { width: number; height: number };
        if (stood) gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(sw * sh * 4).fill(stood.level));
        else if (this.blank && c.kind !== 'coat') gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c.kind === 'eink' ? [255, 255, 255, 255] : [0, 0, 0, 255]));
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, c.source);
        gl.activeTexture(gl.TEXTURE11);
        gl.bindTexture(gl.TEXTURE_2D, this.damage?.(plate, c) ?? null);
        gl.activeTexture(gl.TEXTURE0);
      });
      i[a.uMode!] = MODE.screen;
      i[a.uKind!] = SCREEN[c.kind];
      f[a.uGain!] = c.gain;
      b.vec(a.uColor!, c.color);
      b.vec(a.uInk!, c.ink);
      b.vec(a.uEmit!, c.emit);
      b.two(a.uInset!, c.inset[0], c.inset[1]);
      f[a.uZTop!] = c.zTop;
      f[a.uRough!] = c.rough;
      f[a.uCoat!] = c.coat;
      f[a.uMetal!] = c.metal;
      f[a.uZoom!] = d.fine;
      quad();
      return;
    }
    if (c.op === 'frost') {
      i[a.uMode!] = MODE.frost;
      b.two(a.uSeed!, 0, 0);
      f[a.uBlur!] = c.blur;
      f[a.uZoom!] = c.zoom;
      b.vec(a.uColor!, c.tint);
      f[a.uOpacity!] = c.opacity;
      f[a.uTransmit!] = c.transmit;
      f[a.uZEdge!] = c.zEdge;
      f[a.uZTop!] = c.zTop;
      f[a.uBevel!] = c.bevel;
      f[a.uRough!] = c.rough;
      f[a.uCoat!] = c.coat;
      f[a.uWear!] = c.wear;
      f[a.uPolish!] = c.polish;
      f[a.uAge!] = c.age;
      f[a.uPatinaOn!] = c.patina ? 1 : 0;
      b.vec(a.uPatina!, c.patina ?? [0, 0, 0]);
      over();
      quad();
      return;
    }
    if (c.op === 'glass') {
      // A pane of its own is shaded apart, over what's under it, so it leaves that surface as it was: its texture, its
      // sheen and its own lacquer. Only glass the panes can't hold lies on the surface as a coat.
      if (plate.paned.has(c)) return;
      i[a.uMode!] = MODE.glass;
      f[a.uZTop!] = c.height;
      f[a.uBevel!] = c.bevel;
      f[a.uCoat!] = c.coat;
      later.push(() => {
        gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1, gl.NONE, gl.NONE]);
        gl.blendFunc(gl.ONE, gl.ONE);
      });
      quad();
      later.push(() => {
        gl.drawBuffers([gl.NONE, gl.NONE, gl.COLOR_ATTACHMENT2, gl.NONE]);
        gl.colorMask(false, false, true, false);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      });
      quad();
      later.push(() => {
        gl.colorMask(true, true, true, true);
        gl.drawBuffers(plate.tex!.targets);
      });
      over();
      return;
    }
    if (c.op === 'glow') {
      i[a.uMode!] = MODE.glow;
      b.vec(a.uEmit!, c.color);
      f[a.uWidth!] = c.width;
      add();
      quad();
      over();
      return;
    }
    if (c.op === 'cut') {
      this.bindHolder(c.on, d.dpr);
      if (c.chips) {
        f[a.uGroundWear!] = c.chips.wear;
        b.vec(a.uGroundSeed!, c.chips.seed);
        f[a.uChip!] = c.chips.size;
      }
      b.vec(a.uSeed!, c.seed);
      f[a.uBevel!] = c.soft;
      f[a.uWear!] = c.wear;
      f[a.uSoftLod!] = Math.log2(d.dpr) * 0.75 + 0.1;
      // Both write zero to the channels they leave alone, which blends to nothing, so the render
      // targets can stay as they are. Changing them is slower than the draw.
      if (c.depth) {
        i[a.uMode!] = MODE.cut;
        f[a.uDepth!] = c.depth;
        add();
        quad();
        over();
      }
      if (c.ink) {
        i[a.uMode!] = MODE.ink;
        f[a.uFeather!] = c.feather;
        b.vec(a.uColor!, c.ink);
        b.vec(a.uEmit!, c.emit ?? [0, 0, 0]);
        f[a.uRough!] = c.rough;
        f[a.uMetal!] = c.metal;
        quad();
      } else if (c.emit) {
        // Emit with no ink is a lamp behind it: it only adds light, so its colour never goes dark as the light comes up.
        i[a.uMode!] = MODE.light;
        f[a.uFeather!] = c.feather;
        b.vec(a.uEmit!, c.emit);
        add();
        quad();
        over();
      }
      return;
    }
    const m = c.material;
    i[a.uMode!] = MODE.surface;
    i[a.uProfile!] = PROFILE[c.profile];
    i[a.uRadial!] = c.radial ? 1 : 0;
    f[a.uBevel!] = c.bevel;
    f[a.uZEdge!] = c.zEdge;
    f[a.uZTop!] = c.zTop;
    b.two(a.uDish!, c.dish[0], c.dish[1]);
    f[a.uMid!] = c.mid;
    b.two(a.uCrown!, c.crown[0], c.crown[1]);
    b.two(a.uTilt!, c.tilt[0], c.tilt[1]);
    b.vec(a.uColor!, m.color);
    b.vec(a.uSub!, m.sub);
    b.two(a.uSubRM!, m.subRough, m.subMetal);
    b.vec(a.uBare!, m.bare);
    b.two(a.uBareRM!, m.bareRough, m.bareMetal);
    b.vec(a.uCoatTint!, m.coatTint);
    f[a.uDents!] = m.dents;
    f[a.uFade!] = m.fade;
    f[a.uRings!] = m.rings;
    f[a.uPores!] = m.pores;
    f[a.uFilmVary!] = m.filmVary;
    f[a.uLeak!] = m.leak;
    b.vec(a.uEmit!, m.emit);
    b.vec(a.uGrain!, m.grain);
    f[a.uRough!] = m.rough;
    f[a.uMetal!] = m.metal;
    f[a.uCoat!] = m.coat;
    f[a.uAniso!] = m.aniso;
    f[a.uTangent!] = m.tangent;
    f[a.uPeel!] = m.peel;
    f[a.uWave!] = m.wave;
    f[a.uRelief!] = this.relief ? m.relief : 0;
    f[a.uFeature!] = m.feature;
    f[a.uSlope!] = m.slope;
    f[a.uAcross!] = m.across;
    f[a.uMottle!] = m.mottle;
    f[a.uFleck!] = m.fleck;
    f[a.uWear!] = m.wear;
    f[a.uAge!] = m.age;
    f[a.uPatinaOn!] = m.patina ? 1 : 0;
    b.vec(a.uPatina!, m.patina ?? [0, 0, 0]);
    f[a.uPatinaRough!] = m.patinaRough;
    f[a.uTouch!] = m.touch;
    f[a.uSheen!] = m.sheen;
    f[a.uScatter!] = m.scatter;
    f[a.uMarks!] = m.marks;
    f[a.uPolish!] = m.polish;
    f[a.uChip!] = m.chip;
    f[a.uBroad!] = m.broad;
    f[a.uCoatRough!] = m.coatRough;
    i[a.uPattern!] = m.pattern ? PATTERN[m.pattern] : 0;
    b.vec(a.uColor2!, m.color2);
    f[a.uScale!] = m.scale;
    f[a.uShown!] = d.fine;
    f[a.uFilm!] = m.film;
    b.vec(a.uSeed!, c.seed);
    i[a.uFollow!] = c.bridge ? 3 : c.follow ? 1 : 0;
    f[a.uBlur!] = c.bridge;
    const aim = this.aim;
    if (aim) {
      // Its own outline marches from where it is on its own plate, and the quad covers where it can show on this one.
      const r = aim.reach, x = aim.box;
      i[a.uEdge!] = aim.rows ? 4 : 1;
      const set = aim.inset;
      b.four(a.uOutline!, set?.y0 ?? 0, set?.step ?? 0, set?.n ?? 0, 0);
      if (set) later.push(() => {
        gl.activeTexture(gl.TEXTURE9);
        gl.bindTexture(gl.TEXTURE_2D, set.tex);
        gl.activeTexture(gl.TEXTURE0);
      });
      if (aim.rows) {
        const { tex, y0, step, n } = aim.rows;
        b.four(a.uCap!, y0, step, n, 0);
        later.push(() => {
          gl.activeTexture(gl.TEXTURE9);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.activeTexture(gl.TEXTURE0);
        });
      }
      b.four(a.uBox!, x.x, x.y, x.x + x.w, x.y + x.h);
      b.vec(a.uSeen!, aim.seen);
      b.vec(a.uFrom!, aim.from);
      b.four(a.uReach!, r.x, r.y, r.x + r.w, r.y + r.h);
      quad();
      return;
    }
    quad();
    if (c.follow && !c.bridge) {
      i[a.uFollow!] = 2;
      add();
      quad();
      over();
    }
  }
}
