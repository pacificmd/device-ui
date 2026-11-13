// What something gives off for being hot: Planck's law seen through the eye's colour matching functions. A spark, a flame's
// soot and a glowing ember are all this one curve at different temperatures, so they're coloured and as bright as each other.

type Rgb = [number, number, number];

// The CIE 1931 2° colour matching functions, as fitted by Wyman, Sloan and Shirley (JCGT 2013), within a percent or so.
const lobe = (l: number, mu: number, below: number, above: number) => {
  const t = (l - mu) / (l < mu ? below : above);
  return Math.exp(-0.5 * t * t);
};
const xBar = (l: number) => 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
const yBar = (l: number) => 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
const zBar = (l: number) => 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);

/** Spectral radiance of a black body, W/(sr·m²·m), at a wavelength in nm. */
const planck = (nm: number, kelvin: number) => {
  const l = nm * 1e-9, h = 6.62607015e-34, c = 2.99792458e8, k = 1.380649e-23;
  return (2 * h * c * c) / (l ** 5 * Math.expm1((h * c) / (l * k * kelvin)));
};

/** CIE XYZ of a black body, Y in cd/m² (683 lm/W), summed over 380 to 780 nm. */
export function blackbodyXYZ(kelvin: number): Rgb {
  let x = 0, y = 0, z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const b = planck(nm, kelvin) * 5e-9;
    x += b * xBar(nm);
    y += b * yBar(nm);
    z += b * zBar(nm);
  }
  return [x * 683, y * 683, z * 683];
}

/** Linear sRGB (D65) from XYZ. */
const toRgb = ([x, y, z]: Rgb): Rgb => [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z];

/** Its colour alone, linear sRGB with the largest channel 1. Out of gamut is clipped, as a screen can't show deeper red. */
export function blackbodyColor(kelvin: number): Rgb {
  const c = toRgb(blackbodyXYZ(kelvin)).map(v => Math.max(0, v)) as Rgb, m = Math.max(...c);
  return c.map(v => v / m) as Rgb;
}

/** How bright it is, cd/m². */
export const blackbodyLuminance = (kelvin: number) => blackbodyXYZ(kelvin)[1];

/** The coolest a thing is drawn at: the Draper point, where hot iron first glows in the dark. */
export const DRAPER = 798;

/**
 * A table for shaders: `n` steps from `from` to `to` kelvin, each linear sRGB colour times luminance over `white`, the cd/m² that
 * shows as white, so the shader only has to say how hot.
 */
export function blackbodyTable(n: number, from: number, to: number, white: number): Float32Array {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / (n - 1), c = blackbodyColor(t), lum = blackbodyLuminance(t) / white;
    out.set([c[0] * lum, c[1] * lum, c[2] * lum, 1], i * 4);
  }
  return out;
}
