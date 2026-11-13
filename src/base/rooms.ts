// The room around everything, drawn into textures so a reflection is one read at any roughness.
import { clampTexture, createProgram } from './gl.js';
import type { Lighting } from './lighting.js';
import { BRUSH_FS, BRUSH_LEVELS, BRUSH_REACH, BRUSH_SIZE, BRUSH_THIN, BRUSH_TURNS, DFG_FS, DFG_SIZE, FILTER_FS, PANELS, ROOM_FS, ROOM_LEVELS, ROOM_VS } from './shaders/room.js';

const ROOM_SIZE = 512;

export class Rooms {
  /** One room per setup in use, drawn the first time something asks for it. */
  private made = new Map<Lighting, { room: WebGLTexture; brush: WebGLTexture }>();

  // Lost with the context, along with every room, so a restored one starts with a new set.
  constructor(private readonly gl: WebGL2RenderingContext) {
    const table = createProgram(gl, ROOM_VS, DFG_FS), dfg = gl.createTexture(), fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE14);
    gl.bindTexture(gl.TEXTURE_2D, dfg);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16F, DFG_SIZE, DFG_SIZE);
    clampTexture(gl, gl.LINEAR, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dfg, 0);
    gl.viewport(0, 0, DFG_SIZE, DFG_SIZE);
    gl.useProgram(table.program);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteProgram(table.program);
  }

  // Drawn once, so a reflection in the light pass is a single read at any roughness.
  for(l: Lighting): { room: WebGLTexture; brush: WebGLTexture } {
    const made = this.made.get(l), { gl } = this;
    if (made) return made;
    const blending = gl.isEnabled(gl.BLEND), clipped = gl.isEnabled(gl.SCISSOR_TEST);
    const make = (levels: number) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA16F, ROOM_SIZE, ROOM_SIZE);
      clampTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
      return t;
    };
    const scene = createProgram(gl, ROOM_VS, ROOM_FS), blur = createProgram(gl, ROOM_VS, FILTER_FS);
    const source = make(Math.log2(ROOM_SIZE) + 1), room = make(ROOM_LEVELS), fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, source, 0);
    gl.viewport(0, 0, ROOM_SIZE, ROOM_SIZE);
    gl.useProgram(scene.program);
    gl.uniform1f(scene.u.uSize!, ROOM_SIZE);
    gl.uniform1f(scene.u.uDark!, l.dark);
    gl.uniform1f(scene.u.uGlow!, l.glow);
    gl.uniform1f(scene.u.uTent!, l.tent);
    const panels = l.panels.slice(0, PANELS);
    gl.uniform1i(scene.u.uPanels!, panels.length);
    if (panels.length) {
      gl.uniform4fv(gl.getUniformLocation(scene.program, 'uPanelAt'), panels.flatMap(p => [...p.at, ...p.size]));
      gl.uniform2fv(gl.getUniformLocation(scene.program, 'uPanelLight'), panels.flatMap(p => [p.soft, p.power]));
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.useProgram(blur.program);
    gl.uniform1i(blur.u.tRoom!, 0);
    gl.uniform1f(blur.u.uSource!, ROOM_SIZE);
    for (let level = 0; level < ROOM_LEVELS; level++) {
      const size = ROOM_SIZE >> level;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, room, level);
      gl.viewport(0, 0, size, size);
      gl.uniform1f(blur.u.uSize!, size);
      gl.uniform1f(blur.u.uRough!, level / (ROOM_LEVELS - 1));
      gl.uniform1i(blur.u.uSamples!, level ? 32 << Math.min(level, 3) : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    const lobes = createProgram(gl, ROOM_VS, BRUSH_FS), brush = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, brush);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, BRUSH_LEVELS, gl.R16F, BRUSH_SIZE, BRUSH_SIZE, BRUSH_TURNS * BRUSH_REACH.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, room);
    gl.useProgram(lobes.program);
    gl.uniform1i(lobes.u.tRoom!, 0);
    for (let level = 0; level < BRUSH_LEVELS; level++) {
      const size = BRUSH_SIZE >> level;
      gl.viewport(0, 0, size, size);
      gl.uniform1f(lobes.u.uSize!, size);
      gl.uniform1f(lobes.u.uThin!, BRUSH_THIN * 2 ** level);
      for (let reach = 0; reach < BRUSH_REACH.length; reach++) {
        gl.uniform1f(lobes.u.uReach!, BRUSH_REACH[reach]!);
        for (let turn = 0; turn < BRUSH_TURNS; turn++) {
          gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, brush, level, reach * BRUSH_TURNS + turn);
          gl.uniform1f(lobes.u.uTurn!, (turn / BRUSH_TURNS) * Math.PI);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(source);
    gl.deleteProgram(lobes.program);
    gl.deleteProgram(scene.program);
    gl.deleteProgram(blur.program);
    if (blending) gl.enable(gl.BLEND);
    if (clipped) gl.enable(gl.SCISSOR_TEST);
    const out = { room, brush };
    this.made.set(l, out);
    return out;
  }

  get bytes(): number {
    return this.made.size * ((ROOM_SIZE * ROOM_SIZE * 8 * 4) / 3 + (BRUSH_SIZE * BRUSH_SIZE * 2 * BRUSH_TURNS * BRUSH_REACH.length * 4) / 3);
  }
}
