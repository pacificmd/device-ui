export interface Program {
  program: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
}

const COMPLETION_STATUS = 0x91b1;

/** How a context blends and whether it clips, as last set. */
export interface Blending { blend: boolean; scissor: boolean; func: [number, number, number, number]; equation: [number, number] }
const blendings = new WeakMap<WebGL2RenderingContext, Blending>();
/**
 * How this context blends, kept as it's set and never asked of the GPU: asking waits for everything sent before it, which is
 * a stall on each draw that has to leave the context as it found it. Everything that sets it goes through the context, so it's
 * followed there, once, the first time it's wanted.
 */
export function blending(gl: WebGL2RenderingContext): Blending {
  let b = blendings.get(gl);
  if (b) return b;
  const on = gl.isContextLost();
  const get = (k: number, or: number) => (on ? or : (gl.getParameter(k) as number));
  const now: Blending = b = {
    blend: !on && gl.isEnabled(gl.BLEND), scissor: !on && gl.isEnabled(gl.SCISSOR_TEST),
    func: [get(gl.BLEND_SRC_RGB, gl.ONE), get(gl.BLEND_DST_RGB, gl.ZERO), get(gl.BLEND_SRC_ALPHA, gl.ONE), get(gl.BLEND_DST_ALPHA, gl.ZERO)],
    equation: [get(gl.BLEND_EQUATION_RGB, gl.FUNC_ADD), get(gl.BLEND_EQUATION_ALPHA, gl.FUNC_ADD)],
  };
  const flag = (cap: number, to: boolean) => (cap === gl.BLEND ? (now.blend = to) : cap === gl.SCISSOR_TEST ? (now.scissor = to) : 0);
  const { enable, disable, blendFunc, blendFuncSeparate, blendEquation, blendEquationSeparate } = gl;
  gl.enable = cap => (flag(cap, true), enable.call(gl, cap));
  gl.disable = cap => (flag(cap, false), disable.call(gl, cap));
  gl.blendFunc = (s, d) => ((now.func = [s, d, s, d]), blendFunc.call(gl, s, d));
  gl.blendFuncSeparate = (s, d, sa, da) => ((now.func = [s, d, sa, da]), blendFuncSeparate.call(gl, s, d, sa, da));
  gl.blendEquation = m => ((now.equation = [m, m]), blendEquation.call(gl, m));
  gl.blendEquationSeparate = (m, a) => ((now.equation = [m, a]), blendEquationSeparate.call(gl, m, a));
  // One that comes back comes back as new.
  (gl.canvas as HTMLCanvasElement).addEventListener?.('webglcontextrestored', () => Object.assign(now, { blend: false, scissor: false, func: [gl.ONE, gl.ZERO, gl.ONE, gl.ZERO], equation: [gl.FUNC_ADD, gl.FUNC_ADD] }));
  blendings.set(gl, b);
  return b;
}

export function link(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!, shaders = [compile(gl.VERTEX_SHADER, vs), compile(gl.FRAGMENT_SHADER, fs)];
  for (const s of shaders) gl.attachShader(program, s);
  gl.linkProgram(program);
  const finish = (): Program => {
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = shaders.map(s => gl.getShaderInfoLog(s)).join('') || gl.getProgramInfoLog(program);
      throw new Error(log || 'link failed');
    }
    const u: Program['u'] = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const { name } = gl.getActiveUniform(program, i)!;
      u[name] = gl.getUniformLocation(program, name)!;
    }
    return { program, u };
  };
  return { program, finish };
}

export function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  return link(gl, vs, fs).finish();
}

/**
 * Links a program without waiting for it, as a big one holds the page for 150ms. Call the result
 * to ask: null until it's done. Where the browser can't link alongside, the first ask waits.
 */
export function laterProgram(gl: WebGL2RenderingContext, vs: string, fs: string): () => Program | null {
  const parallel = gl.getExtension('KHR_parallel_shader_compile'), { program, finish } = link(gl, vs, fs);
  let done: Program | null = null;
  return () => (done ??= !parallel || gl.getProgramParameter(program, COMPLETION_STATUS) ? finish() : null);
}

/**
 * A uniform block with room for every draw of a paint. Values are written in memory and kept per
 * draw, then all sent before the first draw, because writing to a buffer a render pass is using
 * stalls that pass, once per draw. They go in many small buffers, not one big one: Metal's GL
 * layer rewrites a whole uniform buffer each time it's bound, so a draw costs as much as the
 * buffer is long, and a paint costs the square of its draws.
 */
const CHUNK = 16;

export class Block {
  readonly f: Float32Array;
  readonly i: Int32Array;
  /** Where each value lives, in array slots. */
  readonly at: Record<string, number> = {};
  private readonly buffers: WebGLBuffer[] = [];
  private readonly size: number;
  private readonly stride: number;
  private kept = new Float32Array(0);
  private count = 0;

  constructor(private readonly gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
    const index = gl.getUniformBlockIndex(program, name);
    gl.uniformBlockBinding(program, index, 0);
    this.size = gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_DATA_SIZE) as number;
    const align = gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT) as number;
    this.stride = Math.ceil(this.size / align) * align;
    const members = gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES) as Uint32Array;
    const offsets = gl.getActiveUniforms(program, [...members], gl.UNIFORM_OFFSET) as number[];
    members.forEach((m, i) => {
      this.at[gl.getActiveUniform(program, m)!.name] = offsets[i]! / 4;
    });
    const data = new ArrayBuffer(this.size);
    this.f = new Float32Array(data);
    this.i = new Int32Array(data);
  }

  two(at: number, x: number, y: number): void {
    this.f[at] = x;
    this.f[at + 1] = y;
  }

  four(at: number, x: number, y: number, z: number, w: number): void {
    this.two(at, x, y);
    this.two(at + 2, z, w);
  }

  vec(at: number, v: readonly number[]): void {
    for (let i = 0; i < v.length; i++) this.f[at + i] = v[i]!;
  }

  /** Keeps the values as they stand for one draw, and says which. */
  keep(): number {
    const words = this.stride / 4, used = this.count * words;
    if (used + words > this.kept.length) {
      const grown = new Float32Array(Math.max(words * 256, this.kept.length * 2));
      grown.set(this.kept);
      this.kept = grown;
    }
    this.kept.set(this.f, used);
    return this.count++;
  }

  /** Sends everything kept since the last send. */
  send(): void {
    const { gl } = this, words = this.stride / 4;
    for (let from = 0, n = 0; from < this.count; from += CHUNK, n++) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, (this.buffers[n] ??= gl.createBuffer()));
      gl.bufferData(gl.UNIFORM_BUFFER, this.kept, gl.DYNAMIC_DRAW, from * words, Math.min(CHUNK, this.count - from) * words);
    }
    this.count = 0;
  }

  use(draw: number): void {
    this.gl.bindBufferRange(this.gl.UNIFORM_BUFFER, 0, this.buffers[Math.floor(draw / CHUNK)]!, (draw % CHUNK) * this.stride, this.size);
  }
}

export function clampTexture(gl: WebGL2RenderingContext, min: number, mag: number, target: number = gl.TEXTURE_2D): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
