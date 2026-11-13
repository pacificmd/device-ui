// Where a page's 2D canvases keep their pixels. Anything a screen shows is read by the engine: drawn into another canvas, looked at to see
// whether it changed, taken up as a texture. A canvas on the GPU has to be read back for each of those, and the read waits behind all the
// GPU has on: on eva that was a quarter of a frame, every frame (p95 25-31 ms against 19-20 with them on the CPU). A screen draws from
// whatever canvases its page made, which nothing can tell at the moment they're made, so every 2D canvas starts on the CPU from the moment
// the library loads, whoever draws it. What the engine draws itself and never reads asks for the GPU with `ON_GPU`, and anything else that
// says what it wants gets it. An OffscreenCanvas, as print's mask is, stays where the browser puts it: on the GPU it goes up as a texture
// with no copy, and through the CPU that was 505 ms.

/** Context settings for a canvas that's drawn and shown, never read. */
export const ON_GPU: CanvasRenderingContext2DSettings = { willReadFrequently: false };

if (typeof HTMLCanvasElement !== 'undefined') {
  const made = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: CanvasRenderingContext2DSettings) {
    return made.call(this, kind, kind === '2d' ? { willReadFrequently: true, ...options } : options);
  } as typeof made;
}
