// The stage's camera. Everything drawn on the stage is light, as bright as it really is, and the camera makes a picture of it for
// the screen at the end, as a camera does: its glare, its exposure, then the curve that bends what's brighter than white into white.
// So a flash can be brighter than the screen can show and still have the shape of how bright it is, and the eye can adapt to it.

import { clampTexture, link, type Program } from './gl.js';
import { TONE } from './shaders/light.js';

const VS = `#version 300 es
void main() {
  vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  gl_Position = vec4(c * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * How much of the light past white a lens scatters into its glare, and how far, device px. Glare's spread falls off as the square of
 * the distance, so every doubling of it holds the same share of the light: the share is split evenly over sizes from 2 px to 2^LEVELS
 * px. A good camera lens scatters a few percent of what reaches it (Spencer, Shirley, Zimmerman and Greenberg, "Physically-based
 * glare effects for digital images", 1995, for the eye's, which is wider). Only what's past white is spread: the rest's glare is
 * fainter than the screen can show beside it, and it's what the curve can't show that glare is for. guess
 */
const SCATTER = 0.03, LEVELS = 7;

// Light past white, at half size: the four pixels under each, averaged by the filter. Exposed, as glare is measured on the picture.
const PAST_FS = `#version 300 es
precision highp float;
uniform sampler2D tLight;
uniform float uExposure;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 / vec2(textureSize(tLight, 0));
  o = vec4(max(texture(tLight, uv).rgb * uExposure - 1.0, 0.0), 1.0);
}`;

// The glare, at half size: each size of what's past white, softened with four taps so its texels don't show, evenly weighted.
const GLARE_FS = `#version 300 es
precision highp float;
uniform sampler2D tPast;
uniform int uLevels;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(tPast, 0));
  vec3 g = vec3(0);
  for (int i = 0; i < ${LEVELS}; i++) {
    if (i >= uLevels) break;
    vec2 t = 0.75 / vec2(textureSize(tPast, i));
    float l = float(i);
    g += textureLod(tPast, uv + t, l).rgb + textureLod(tPast, uv - t, l).rgb + textureLod(tPast, uv + vec2(t.x, -t.y), l).rgb + textureLod(tPast, uv + vec2(-t.x, t.y), l).rgb;
  }
  o = vec4(g * ${(SCATTER / 4).toFixed(5)} / float(uLevels), 1.0);
}`;

// What's on the stage is light over coverage, premultiplied, as the pictures are. The curve is for light, so it's taken off
// where something covers the pixel and put back after. What adds light over nothing, a spark against the page or the glare
// round it, has no coverage to take it off: it's light added to the page's own, which the canvas adds on top, so it's shown
// as what that sum shows less what the page already does. A faint glare is faint on a white page and plain on a black one.
// What the lens scattered into the glare isn't in the sharp picture any more.
const FS = `#version 300 es
precision highp float;
uniform sampler2D tLight, tGlare;
uniform float uExposure;
uniform vec2 uShift;
uniform vec3 uBack;
out vec4 o;
${TONE}
float rnd(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
void main() {
  vec4 c = texelFetch(tLight, ivec2(gl_FragCoord.xy), 0);
  float a = clamp(c.a, 0.0, 1.0);
  vec3 rgb = max(c.rgb, 0.0) * uExposure;
  rgb += texture(tGlare, gl_FragCoord.xy / vec2(textureSize(tLight, 0))).rgb - max(rgb - 1.0, 0.0) * ${SCATTER.toFixed(5)};
  rgb = a > 0.002 ? encode(neutral(rgb / a)) * a : encode(min(decode(uBack) + neutral(rgb), 1.0)) - uBack;
  // Half a level of noise, so a smooth fall of light doesn't band at 8 bits.
  o = vec4(rgb + (rnd(gl_FragCoord.xy + uShift) - 0.5) / 255.0 * max(a, 0.004), a);
}`;

export class Lens {
  /** Where the stage draws its light: linear, as bright as it is, premultiplied. */
  fbo: WebGLFramebuffer;
  private tex: WebGLTexture | null = null;
  /** What's past white at half size, with its smaller sizes, and the glare made from them. */
  private past: WebGLTexture | null = null;
  private glare: WebGLTexture | null = null;
  private readonly pastFbo: WebGLFramebuffer;
  private readonly glareFbo: WebGLFramebuffer;
  private levels = 1;
  private w = 0;
  private h = 0;
  private readonly show: Program;
  private readonly passes: { past: Program; glare: Program };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.fbo = gl.createFramebuffer()!;
    this.pastFbo = gl.createFramebuffer()!;
    this.glareFbo = gl.createFramebuffer()!;
    this.show = link(gl, VS, FS).finish();
    this.passes = { past: link(gl, VS, PAST_FS).finish(), glare: link(gl, VS, GLARE_FS).finish() };
  }

  /** Bytes it holds on the GPU. */
  get bytes(): number {
    return this.w * this.h * 8 * (1 + (1 / 4) * (4 / 3) + 1 / 4);
  }

  private get half(): [number, number] {
    return [Math.max(this.w >> 1, 1), Math.max(this.h >> 1, 1)];
  }

  /** Makes the light as big as the stage, device px, and clears it. Leaves it bound. */
  begin(w: number, h: number): void {
    const { gl } = this;
    if (w !== this.w || h !== this.h || !this.tex) {
      for (const t of [this.tex, this.past, this.glare]) if (t) gl.deleteTexture(t);
      this.w = w;
      this.h = h;
      const [hw, hh] = this.half;
      this.levels = Math.min(LEVELS, Math.floor(Math.log2(Math.min(hw, hh))) + 1);
      const make = (fbo: WebGLFramebuffer, w: number, h: number, levels: number, min: number) => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA16F, w, h);
        clampTexture(gl, min, gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return t;
      };
      this.tex = make(this.fbo, w, h, 1, gl.LINEAR);
      this.past = make(this.pastFbo, hw, hh, this.levels, gl.LINEAR_MIPMAP_LINEAR);
      this.glare = make(this.glareFbo, hw, hh, 1, gl.LINEAR);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Shows the light on the screen, the canvas's own framebuffer, at an exposure: 1 shows it as the light pass always has. Over
   * the page's colour `backdrop`, as it's shown, 0 to 1. */
  finish(exposure = 1, backdrop: readonly [number, number, number] = [0, 0, 0]): void {
    const { gl } = this, [hw, hh] = this.half;
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.colorMask(true, true, true, true);
    // What's past white, and its glare.
    const { past, glare } = this.passes;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pastFbo);
    gl.viewport(0, 0, hw, hh);
    gl.useProgram(past.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(past.u.tLight!, 0);
    gl.uniform1f(past.u.uExposure!, exposure);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.past);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glareFbo);
    gl.useProgram(glare.program);
    gl.uniform1i(glare.u.tPast!, 0);
    gl.uniform1i(glare.u.uLevels!, this.levels);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // The picture.
    const { program, u } = this.show;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(u.tLight!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glare);
    gl.uniform1i(u.tGlare!, 1);
    gl.uniform1f(u.uExposure!, exposure);
    gl.uniform2f(u.uShift!, 0, 0);
    gl.uniform3f(u.uBack!, ...backdrop);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** The context is gone: nothing made on it is any good. */
  lost(): void {
    this.tex = this.past = this.glare = null;
    this.w = this.h = 0;
  }

  free(): void {
    const { gl } = this;
    for (const t of [this.tex, this.past, this.glare]) if (t) gl.deleteTexture(t);
    for (const f of [this.fbo, this.pastFbo, this.glareFbo]) gl.deleteFramebuffer(f);
    for (const p of [this.show, this.passes.past, this.passes.glare]) gl.deleteProgram(p.program);
    this.lost();
  }
}

const encode = (c: number) => (c < 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** The camera's curve on the CPU, for reading a picture back: TONE's `neutral` then `encode`, the same numbers. */
export function screen(r: number, g: number, b: number): [number, number, number] {
  const K = 0.015, DES = 0.15, S = 0.8 - K;
  const x = Math.min(r, g, b), f = x < 2 * K ? x - (x * x) / (4 * K) : K;
  const m = Math.max(r, g, b), k = m < 2 * K ? (m * 0.25) / K : 1 - K / Math.max(m, 2 * K);
  const t = Math.min(Math.max((m - 0.03) / 0.07, 0), 1), s = t * t * (3 - 2 * t);
  let c = [r, g, b].map(v => v * k * (1 - s) + (v - f) * s);
  const p = Math.max(...c);
  if (p >= S) {
    const d = 1 - S, n = 1 - (d * d) / (p + d - S), w = 1 - 1 / (DES * (p - n) + 1);
    c = c.map(v => (v * n) / p * (1 - w) + n * w);
  }
  return c.map(encode) as [number, number, number];
}
