// The air's shaders: one step of a 2D fluid, its pressure, the light that reaches into it, and the drawing of it. Everything
// works in metres and seconds, so a puff is as big as it is whatever the grid. The grid is coarse on purpose: what you see as
// detail comes from the noise the drawing carries along the flow and from the smoke shading itself, not from the cells.

export const MAX_SOURCES = 64, MAX_LIGHTS = 8, MAX_BLOCKS = 32;
/** How many looks at blasts the stage bends by at once: a blast is four, over a shutter's time. */
export const MAX_SHOCKS = 16;
/**
 * How far from 1 the air's refractive index is in the room, for visible light: (n − 1) goes as its density, so this times how much
 * denser than the room a place is, less one, is how far that place's index is off. Spec: 2.72e-4 at 295 K and a standard atmosphere.
 */
const REFRACTIVITY = '2.72e-4';
/** The tile of random values the finest detail reads its noise from, texels a side. */
export const NOISE_TILE = 128;
/**
 * How far past its own size a spark's glare reaches, device pixels, on a canvas of its own. Glare is the lens's, so it's as wide on
 * screen whatever the zoom, and as strong as the light. On the stage the camera has a lens, and the spark draws none.
 */
export const GLARE = 10;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
`;

export const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** A plume's box on the page, in clip space: x0 y0 at the bottom left, x1 y1 at the top right. */
export const RECT_VERTEX = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(mix(uRect.xy, uRect.zw, vUv), 0.0, 1.0); }
`;

/** Noise: a hash with no sine in it, value noise, crumpled creases, and curl noise for swirls. */
const NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
// Crumpled-paper creases: four octaves of (1 - n^2) of a signed noise, each turned and scaled.
float crumple(vec2 p) {
  float sum = 0.0, amp = 0.55;
  for (int k = 0; k < 4; k++) {
    float n = valueNoise(p) * 0.65 + valueNoise(p * 2.03 + 11.0) * 0.35;
    sum += (1.0 - (n * 2.0 - 1.0) * (n * 2.0 - 1.0)) * amp;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1;
    amp *= 0.5;
  }
  return clamp(sum / 1.03, 0.0, 1.0);
}
// The curl of a noise, which has no divergence, so it stirs without piling anything up. Scale in metres.
vec2 curlNoise(vec2 w, float scale, float t) {
  float e = 0.1;
  vec2 p = w / scale + vec2(t * 0.13, -t * 0.09);
  float n1 = valueNoise(p + vec2(0, e)), n2 = valueNoise(p - vec2(0, e)), n3 = valueNoise(p + vec2(e, 0)), n4 = valueNoise(p - vec2(e, 0));
  return vec2(n1 - n2, n4 - n3) / (2.0 * e);
}
// Slow swirls at about 1 m and 30 cm; fast small eddies at 15 and 7 cm, which tear flames into tongues.
vec2 swirl(vec2 w, float t) { return curlNoise(w, 1.0, t) + 0.5 * curlNoise(w + 3.7, 0.3, t * 1.7); }
vec2 flicker(vec2 w, float t) { return curlNoise(w, 0.15, t * 6.0) + 0.6 * curlNoise(w + 9.1, 0.07, t * 9.0); }
`;

/** The room's light, in page metres: all through it, from the page's own screens and lamps, and from lights placed in it. */
const LIGHT = `
uniform sampler2D uShine;
uniform float uShineGain, uShineCell;
uniform vec2 uPageSpan;
uniform vec3 uAmbient;
uniform vec4 uLightAt[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
uniform int uLightCount;
// What the page gives off, drawn small and blurred by distance: haze right in front of a screen shows a soft copy of its
// picture, and further off only its colour.
vec3 shineAt(vec2 pw) {
  vec2 uv = pw / uPageSpan;
  // Spread over about 17, 48 and 190 css px, whatever size it was read at.
  float l = log2(uShineCell);
  return (textureLod(uShine, uv, 4.1 - l).rgb * 0.45 + textureLod(uShine, uv, 5.6 - l).rgb * 0.35 + textureLod(uShine, uv, 7.6 - l).rgb * 0.5) * uShineGain;
}
vec3 roomLight(vec2 pw) {
  vec3 l = uAmbient + shineAt(pw);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec4 a = uLightAt[i];
    float d = distance(pw, a.xy) / max(a.z, 1e-3);
    l += uLightColor[i] / (1.0 + d * d * 4.0);
  }
  return l;
}
`;

/**
 * What glows for being hot, from a table of Planck's law through the eye (see blackbody.ts), already divided by what the room is
 * exposed for. A unit of heat in the air is HEAT_KELVIN over the room.
 */
export const HEAT_KELVIN = 450, TABLE_FROM = 798, TABLE_TO = 3000;
const HOT = `
uniform sampler2D uBlackbody;
vec3 hotLight(float heat) {
  float k = 295.0 + heat * ${HEAT_KELVIN}.0;
  if (k < ${TABLE_FROM}.0) return vec3(0);
  return texture(uBlackbody, vec2(clamp((k - ${TABLE_FROM}.0) / ${TABLE_TO - TABLE_FROM}.0, 0.0, 1.0), 0.5)).rgb;
}
`;

/** The grid: its size in cells, how big a cell is, and where it sits, in metres. */
const GRID = `
uniform vec2 uCells;
uniform float uCell;
vec2 span() { return uCells * uCell; }
vec2 worldOf(vec2 uv) { return uv * span(); }
vec2 uvOf(vec2 w) { return w / span(); }
// What blocks the air: a list of boxes, in metres, x0 y0 x1 y1. Inside one there's no air.
uniform vec4 uBlocks[${MAX_BLOCKS}];
uniform int uBlockCount;
float airOpen(vec2 w) {
  for (int i = 0; i < ${MAX_BLOCKS}; i++) {
    if (i >= uBlockCount) break;
    vec4 b = uBlocks[i];
    if (w.x > b.x && w.y > b.y && w.x < b.z && w.y < b.w) return 0.0;
  }
  return 1.0;
}
`;

/**
 * One step, writing velocity and dye in one draw.
 * vel: vx, vy (m/s, y down the screen), heat, the share that's steam. dye: colour times thickness, and thickness.
 * The pressure from the step before is taken off as it's read, so projection rides along a step late, and needs no pass of its own.
 */
export const STEP = HEAD + GRID + NOISE + `
uniform sampler2D uVel, uDye, uP, uSources;
uniform float uDt, uTime, uSourceCount, uMixing, uVorticity, uSwirl, uFlicker, uDrag, uHeatLife, uSmokeLife, uSteamLife, uRise;
uniform vec2 uWind;
// Where the plume's box sits on the page, metres from its top left, so no two plumes stir alike.
uniform vec2 uOrigin;
layout(location = 0) out vec4 oVel;
layout(location = 1) out vec4 oDye;
vec4 velAt(vec2 w) { return texture(uVel, uvOf(w)); }
vec4 dyeAt(vec2 w) { return texture(uDye, uvOf(w)); }
float pAt(vec2 w) { return texture(uP, uvOf(w)).r; }
vec2 gradP(vec2 w) { float h = uCell; return vec2(pAt(w + vec2(h, 0)) - pAt(w - vec2(h, 0)), pAt(w + vec2(0, h)) - pAt(w - vec2(0, h))) / (2.0 * h); }
float curl(vec2 w) { float h = uCell; return ((velAt(w + vec2(h, 0)).y - velAt(w - vec2(h, 0)).y) - (velAt(w + vec2(0, h)).x - velAt(w - vec2(0, h)).x)) / (2.0 * h); }
void main() {
  vec2 w = worldOf(vUv);
  float h = uCell, open = airOpen(w);
  // Its eddies come at the size of the plume, as a wisp off a lamp curls at millimetres and a sheet of dust at centimetres,
  // and they move as fast as eddies that size do.
  float size = max(span().x, span().y) / 0.25, scale = 1.0 / size;
  vec2 wn = w + uOrigin;
  // Carried along: trace back along the flow to where this came from.
  vec2 v = velAt(w).xy - gradP(w);
  vec2 back = w - v * uDt;
  vec4 vel = velAt(back);
  vel.xy -= gradP(back);
  // A plume takes in the still air round it, at a tenth of its speed across its edge (Morton, Taylor and Turner's
  // entrainment), so it's diluted at 2·α·speed over its half-width, which is how far its heat takes to fall off. Eddies the
  // plume's own size stir what they take in all through it, so that's read across a few cells as well as one, and the middle
  // of a broad column is diluted as its edge is. Heat and momentum are shared out with what it took in alike: a jet of flame
  // slows and cools within its own height.
  {
    float fall = 0.0;
    for (int k = 0; k < 2; k++) {
      float r = k == 0 ? h : 4.0 * h;
      vec2 g = vec2(velAt(back + vec2(r, 0)).z - velAt(back - vec2(r, 0)).z, velAt(back + vec2(0, r)).z - velAt(back - vec2(0, r)).z);
      fall = max(fall, length(g) / (2.0 * r));
    }
    vel.xyz *= exp(-2.0 * 0.1 * length(vel.xy) * fall / max(vel.z, 1e-3) * uDt);
  }
  // Carried back and forth again, the dye comes out softer than it went in; MacCormack takes back half of what the round trip
  // lost, held between the four cells it came from so it can't ring. Edges stay as sharp as the cells allow.
  vec4 dye = dyeAt(back);
  vec4 again = dyeAt(back + (velAt(back).xy - gradP(back)) * uDt);
  vec2 cellAt = uvOf(back) * uCells - 0.5;
  ivec2 c0 = clamp(ivec2(floor(cellAt)), ivec2(0), ivec2(uCells) - 2);
  vec4 d00 = texelFetch(uDye, c0, 0), d10 = texelFetch(uDye, c0 + ivec2(1, 0), 0), d01 = texelFetch(uDye, c0 + ivec2(0, 1), 0), d11 = texelFetch(uDye, c0 + ivec2(1, 1), 0);
  dye = clamp(dye + 0.5 * (dyeAt(w) - again), min(min(d00, d10), min(d01, d11)), max(max(d00, d10), max(d01, d11)));
  // Mixed a little toward its neighbours, so it softens instead of drawing out into threads.
  float hc = h * 0.5;
  vec4 round_ = (dyeAt(back + vec2(hc, 0)) + dyeAt(back - vec2(hc, 0)) + dyeAt(back + vec2(0, hc)) + dyeAt(back - vec2(0, hc))) * 0.25;
  dye = mix(dye, round_, clamp(uDt * uMixing, 0.0, 1.0));
  // Air that comes in from past the edge is the room's own: still and clean, not the edge's smoke smeared inward.
  vec2 ub = uvOf(back);
  if (ub.x < 0.0 || ub.y < 0.0 || ub.x > 1.0 || ub.y > 1.0) dye = vec4(0);
  // What the sources put in, each five texels: x y radius rate | vx vy heat steam | r g b grip | blast, half its opening across
  // and down, its turn | whether only the opening's edge leaks.
  for (int i = 0; i < ${MAX_SOURCES}; i++) {
    if (i >= int(uSourceCount + 0.5)) break;
    vec4 a = texelFetch(uSources, ivec2(i * 5, 0), 0);
    vec4 e = texelFetch(uSources, ivec2(i * 5 + 3, 0), 0);
    // How far from its opening: a box, turned, or only its outline, as smoke leaks out of a seam round a lamp. A point if it
    // has no opening. Where it's pushed out is away from the nearest part of the opening.
    vec2 rel = w - a.xy, ax = vec2(cos(e.w), sin(e.w));
    vec2 q = vec2(dot(rel, ax), dot(rel, vec2(-ax.y, ax.x)));
    vec2 near = clamp(q, -e.yz, e.yz);
    float inside = min(max(abs(q.x) - e.y, abs(q.y) - e.z), 0.0);
    float d = length(q - near) + inside;
    if (texelFetch(uSources, ivec2(i * 5 + 4, 0), 0).x > 0.5) d = abs(d);
    else d = max(d, 0.0);
    if (d > a.z) continue;
    vec2 outward = rel - (near.x * ax + near.y * vec2(-ax.y, ax.x));
    vec4 b = texelFetch(uSources, ivec2(i * 5 + 1, 0), 0);
    vec4 c = texelFetch(uSources, ivec2(i * 5 + 2, 0), 0);
    // Put in through a drifting crumpled mask, so what comes out is folded already.
    float f = exp(-3.0 * d * d / (a.z * a.z)) * (0.3 + 1.4 * crumple(wn * scale * 6.0 + vec2(uTime * 0.6, -uTime * 0.9) + float(i) * 3.3));
    // Fire burns in tongues.
    if (b.z > 2.0) f *= 0.2 + 1.6 * valueNoise(wn * scale * 7.0 + vec2(0, uTime * 4.0)) * valueNoise(wn * scale * 3.0 + vec2(uTime * 1.3, 0));
    float add = a.w * uDt * f;
    // Soot forms in gas as it burns, so the higher it's risen through the flame the more there is: a flame's foot, where it
    // takes in the air, is clear, and it's sootiest at its top.
    if (b.z > 2.0) add *= clamp(0.5 - q.y / (2.0 * max(e.z, a.z)), 0.0, 1.0);
    vel.w = (vel.w * dye.a + b.w * add) / max(dye.a + add, 1e-5);
    dye += vec4(c.rgb * add, add);
    // The air in its opening is as hot as the source: it's where the burning is, not something fed in a little a frame, which
    // the air carries off faster than it warms. A place is burning or it isn't, so its tongues are all at flame heat.
    vel.z = max(vel.z, b.z * smoothstep(0.15, 0.45, f));
    // A jet, or a blast, pushes the air its way; a blast pushes it out from its middle.
    vec2 push = b.xy + (length(outward) > 1e-6 ? normalize(outward) : vec2(0)) * e.x;
    vel.xy = mix(vel.xy, push, clamp(c.w * f * uDt * 10.0, 0.0, 1.0));
  }
  // Put back the small swirls the grid smooths away.
  float cu = curl(w);
  vec2 grad = vec2(abs(curl(w + vec2(h, 0))) - abs(curl(w - vec2(h, 0))), abs(curl(w + vec2(0, h))) - abs(curl(w - vec2(0, h)))) / (2.0 * h);
  vec2 n = grad / (length(grad) + 1e-4);
  vel.xy += uVorticity * h * vec2(n.y, -n.x) * cu * uDt;
  vel.xy += swirl(wn * scale, uTime) * size * uSwirl * uDt * clamp(vel.z + dye.a, 0.0, 2.0);
  vel.xy += flicker(wn * scale, uTime) * size * uFlicker * uDt * smoothstep(0.5, 2.5, vel.z);
  // Hot air rises, which on a page held upright is up the screen.
  vel.y -= uRise * vel.z * uDt;
  vel.xy = mix(vel.xy, uWind, 1.0 - exp(-uDt * 0.3));
  vel.xy *= exp(-uDt * uDrag);
  float speed = length(vel.xy);
  if (speed > 8.0) vel.xy *= 8.0 / speed;
  vel.z *= exp(-uDt / uHeatLife);
  dye *= exp(-uDt / mix(uSmokeLife, uSteamLife, clamp(vel.w, 0.0, 1.0)));
  // The edges of the screen are a window, not a wall: what reaches them goes on out of the picture.
  vel.xyz *= open;
  dye *= open;
  oVel = vel;
  oDye = max(dye, 0.0);
}
`;

/**
 * A plume's air carried onto new cells when its size on screen changes. Four taps, so going to fewer cells averages what it
 * leaves out instead of picking from it.
 */
export const COPY = HEAD + `
uniform sampler2D uVel, uDye;
uniform vec2 uFrom, uTo;
layout(location = 0) out vec4 oVel;
layout(location = 1) out vec4 oDye;
void main() {
  vec2 o = 0.25 / uTo * step(uTo, uFrom);
  vec2 a = vUv + vec2(-o.x, -o.y), b = vUv + vec2(o.x, -o.y), c = vUv + vec2(-o.x, o.y), d = vUv + vec2(o.x, o.y);
  oVel = (texture(uVel, a) + texture(uVel, b) + texture(uVel, c) + texture(uVel, d)) * 0.25;
  oDye = (texture(uDye, a) + texture(uDye, b) + texture(uDye, c) + texture(uDye, d)) * 0.25;
}
`;

/** One sweep of the pressure: the Laplacian of p is the divergence of the flow, less what heat adds, as hot air spreads. */
export const PRESSURE = HEAD + GRID + `
uniform sampler2D uVel, uP;
uniform float uExpand, uRetain;
out vec4 oP;
void main() {
  vec2 w = worldOf(vUv);
  float h = uCell;
  vec4 c = texture(uVel, vUv);
  float div = (texture(uVel, uvOf(w + vec2(h, 0))).x - texture(uVel, uvOf(w - vec2(h, 0))).x + texture(uVel, uvOf(w + vec2(0, h))).y - texture(uVel, uvOf(w - vec2(0, h))).y) / (2.0 * h) - c.z * uExpand;
  float p = texture(uP, vUv).r, sum = 0.0;
  vec2 dirs[4] = vec2[](vec2(h, 0), vec2(-h, 0), vec2(0, h), vec2(0, -h));
  // A wall next door counts as this cell's own pressure, so nothing flows through it. Past the edge of the picture is open
  // air, at no pressure, so the flow leaves through it as freely as it moves inside.
  for (int k = 0; k < 4; k++) {
    vec2 n = w + dirs[k], u = uvOf(n);
    bool out_ = u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0;
    sum += out_ ? 0.0 : airOpen(n) > 0.5 ? texture(uP, u).r : p;
  }
  oP = vec4((sum - div * h * h) * 0.25 * uRetain, 0, 0, 1);
}
`;

/**
 * The light that gets into a plume, at each of its cells: the room's, the page's and each light's, each dimmed by the smoke it
 * has to come through to get there, and what the plume's own fire gives off. So thick smoke is dark in its middle and bright on
 * the side a light is on, and smoke over a fire is lit from under. Light comes in across the page; the smoke is taken to be as
 * deep as uDepth, so how much a line through it dims is its thickness over that.
 */
export const LIT = HEAD + GRID + LIGHT + HOT + `
uniform sampler2D uVel, uDye;
uniform float uExtinction, uDepth;
uniform vec2 uOrigin;
out vec4 oLit;
float thicknessAt(vec2 w) {
  vec2 u = uvOf(w);
  return u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0 ? 0.0 : texture(uDye, u).a;
}
// How much light gets through smoke this thick. Smoke scatters light on as well as stopping it, so a thick cloud isn't black
// inside: Wrenninge's octaves, each scattering further and dimming less.
float passes(float tau) { return (exp(-tau) + 0.5 * exp(-0.5 * tau) + 0.25 * exp(-0.25 * tau)) / 1.75; }
// How much of what comes from \`to\` gets through to \`w\`.
float through(vec2 w, vec2 to) {
  vec2 d = to - w;
  float len = length(d), tau = 0.0, ds = len / 10.0;
  for (int i = 1; i <= 10; i++) tau += thicknessAt(w + d * (float(i) - 0.5) / 10.0) * ds;
  return passes(tau * uExtinction / uDepth);
}
void main() {
  vec2 w = worldOf(vUv), pw = w + uOrigin;
  float reach = 0.3 * max(span().x, span().y);
  // From all round, eight ways: the room's light, and what the plume's own heat gives off along each way in.
  float open = 0.0;
  vec3 fire = vec3(0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.7853982 + 0.39;
    vec2 dir = vec2(cos(a), sin(a));
    float tau = 0.0, ds = reach / 8.0;
    for (int i = 0; i < 8; i++) {
      vec2 at = w + dir * (float(i) + 0.5) * ds;
      vec2 u = uvOf(at);
      if (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) break;
      float th = texture(uDye, u).a * ds * uExtinction / uDepth;
      // Fire seen from here: as bright as it's hot, as much of it as is thick enough to glow, dimmed by what's between.
      fire += hotLight(texture(uVel, u).z) * (1.0 - exp(-th)) * passes(tau);
      tau += th;
    }
    open += passes(tau);
  }
  open /= 8.0;
  fire /= 8.0;
  // The page's own light comes from behind as much as from the side, so only part of it is shaded. Its side comes from the way
  // the page is brighter.
  vec3 page = shineAt(pw);
  vec2 g = vec2(dot(shineAt(pw + vec2(0.04, 0)) - shineAt(pw - vec2(0.04, 0)), vec3(1)), dot(shineAt(pw + vec2(0, 0.04)) - shineAt(pw - vec2(0, 0.04)), vec3(1)));
  float side = length(g) > 1e-4 ? through(w, w + normalize(g) * reach) : open;
  vec3 l = uAmbient * open + page * mix(side, 1.0, 0.35);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec4 a = uLightAt[i];
    vec2 at = a.xy - uOrigin;
    float d = distance(pw, a.xy) / max(a.z, 1e-3);
    l += uLightColor[i] / (1.0 + d * d * 4.0) * through(w, at);
  }
  oLit = vec4(l + fire, 1.0);
}
`;

/**
 * The drawing, straight onto the page over everything, premultiplied: what the smoke scatters of the light it's in, and what
 * glows. The page is seen through it by exp(-thickness), as light through any haze is.
 */
export const DRAW = HEAD + GRID + NOISE + HOT + `
uniform sampler2D uVel, uDye, uLit, uNoise;
uniform float uTime, uExtinction, uPixel;
// How many octaves of detail below the cells this device draws.
uniform int uOctaves;
// Where the plume's box sits on the page, metres from its top left.
uniform vec2 uOrigin;
// Which of the box's edges fade, left right top bottom: not those on the screen's own edge, which cuts it there anyway.
uniform vec4 uFade;
// On the stage: how high what's under each pixel stands, mm, and how high the plume is held, from its foot to its top, and
// whether it's held at all. What stands prouder than its top hides it; what stands within it hides the part below.
uniform sampler2D uHeights;
uniform vec2 uViewPx;
uniform vec3 uSlab;
// On the stage, where light is drawn as bright as it is and the camera exposes it. On a canvas of its own there's no camera.
uniform bool uLinear;
out vec4 oColor;
vec4 flowDetail(vec2 w, vec2 v, float t) {
  vec4 sum = vec4(0);
  for (int k = 0; k < 2; k++) {
    float phase = fract(t * 0.5 + float(k) * 0.5);
    float weight = 1.0 - abs(phase * 2.0 - 1.0);
    vec2 p = w - v * phase * 2.0 + float(k) * 37.3;
    sum += vec4(crumple(p * 4.0), valueNoise(p * 9.0 + 5.0) * 0.6 + valueNoise(p * 23.0 + 2.0) * 0.4, valueNoise(p * 4.0 + 17.0), valueNoise(p * 4.0 + 53.0)) * weight;
  }
  return vec4(sum.xy, (sum.zw - 0.5) * 0.035);
}
// What the cells can't hold: eddies from two cells across down to the pixel, each half the last, carried by the flow and turning
// over faster the smaller they are, as eddies do (Kolmogorov: in time as size to the two thirds). Each fades out as it falls
// below a couple of pixels, so it neither blurs nor shimmers. xy: how far it moves what's seen, metres. z: where in a cell its smoke
// lies, 0 to 1, evenly spread so a cell covered a third is covered a third. w: how much room the zoom leaves for it, 0 to 1.
vec4 cellDetail(vec2 w, vec2 v, float t) {
  vec2 warp = vec2(0);
  float fold = 0.0, total = 0.0, there = 0.0, size = 2.0 * uCell;
  for (int o = 0; o < 5; o++) {
    if (o >= uOctaves) break;
    float a = smoothstep(1.5, 4.0, size / uPixel);
    if (a <= 0.0) break;
    float turn = 2.0 * pow(size / (0.25 * max(span().x, span().y)), 0.667);
    vec2 d = vec2(0);
    float f = 0.0;
    for (int k = 0; k < 2; k++) {
      float phase = fract(t / turn + float(k) * 0.5 + float(o) * 0.37), weight = 1.0 - abs(phase * 2.0 - 1.0);
      vec2 p = (w - v * phase * turn) / size + float(k) * 19.1 + float(o) * 7.3;
      // Value noise read from a tile of random values, three at once: two for the way it moves, one for the fold.
      vec3 n = texture(uNoise, p / ${NOISE_TILE}.0).rgb - 0.5;
      d += n.xy * weight;
      f += n.z * weight;
    }
    warp += d * size * 0.45 * a;
    fold += f * a * pow(0.6, float(o));
    total += a * a * pow(0.36, float(o));
    there = max(there, a);
    size *= 0.5;
  }
  // The octaves add up to something about normal; through its distribution it's even from 0 to 1. Two phases blended at about
  // 0.7 each and value noise's own spread give about 0.2 of spread for each octave.
  float sd = 0.2 * sqrt(max(total, 1e-6));
  return vec4(warp, 0.5 + 0.5 * tanh(fold / sd * 0.8), there);
}
void main() {
  // The grid runs down the page, as the page does; the canvas runs up.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y), w = worldOf(uv);
  vec4 flow = texture(uVel, uv);
  // Detail at the size of the plume, whatever that is: a wisp off a lamp creases at millimetres, a sheet of dust at centimetres.
  float scale = 0.25 / max(span().x, span().y);
  vec4 fine = flowDetail((w + uOrigin) * scale, flow.xy * scale, uTime);
  vec2 base = w + fine.zw / scale;
  vec4 dye = texture(uDye, uvOf(base));
  // A cell holds how much smoke is in it, not where. Smoke has edges, so where the cells show a front, a cell thinner than smoke
  // gets is read as how much of it the smoke covers, and the noise below the cells says which part: as much in all, edges as
  // sharp as the pixel. Smooth smoke inside stays smooth, thin wisps stay soft, and an edge is steepened, not cut, as smoke mixes
  // into the air over a little way, not at a line. Only fronts need it, so only fronts pay for it.
  float hc = uCell;
  float front = abs(texture(uDye, uvOf(base + vec2(hc, 0))).a - texture(uDye, uvOf(base - vec2(hc, 0))).a) + abs(texture(uDye, uvOf(base + vec2(0, hc))).a - texture(uDye, uvOf(base - vec2(0, hc))).a);
  float edgy = smoothstep(0.15, 0.5, front / (dye.a + 0.15)) * smoothstep(0.02, 0.3, dye.a + front);
  vec4 sub = edgy > 0.0 && uOctaves > 0 ? cellDetail(w + uOrigin, flow.xy, uTime) : vec4(0, 0, 0.5, 0);
  vec2 seen = base + sub.xy * edgy;
  if (edgy > 0.0) dye = texture(uDye, uvOf(seen));
  // Creases where it's thin, smooth where it's thick.
  float fold = mix(mix(0.6 + 0.8 * fine.x, 0.5 + 1.0 * fine.y, flow.w), 1.0, smoothstep(0.6, 2.5, dye.a));
  float thick = dye.a * fold;
  float full = 0.9, e = thick / full - sub.z, aa = max(fwidth(e), 0.35);
  thick = mix(thick, thick < full ? full * clamp(e / aa * 0.5 + 0.5, 0.0, 1.0) : thick, sub.w * edgy * smoothstep(0.02, 0.3, thick));
  vec3 tint = dye.rgb / max(dye.a, 1e-4);
  float through = exp(-thick * uExtinction);
  // What it scatters of the light that got in, and what it gives off for being hot: soot glows as thick as it is.
  vec3 scatter = tint * (1.0 - through) * texture(uLit, uvOf(seen)).rgb;
  // On a canvas of its own, too bright for the room's exposure goes to white, as a flame's core does, not to a flat plateau of
  // its colour. On the stage that's the camera's to do.
  vec3 glow = hotLight(flow.z * (0.75 + 0.5 * fine.y)) * (1.0 - through);
  if (!uLinear) glow = 1.0 - exp(-glow);
  // The box's edges fade out, so no plume is ever seen to stop at a line.
  vec4 near = vec4(uv.x, 1.0 - uv.x, uv.y, 1.0 - uv.y) + (1.0 - uFade);
  float edge = smoothstep(0.0, 0.3, min(near.x, near.y)) * smoothstep(0.0, 0.16, min(near.z, near.w));
  float shown = 1.0;
  if (uSlab.z > 0.5) shown = clamp((uSlab.y - texture(uHeights, gl_FragCoord.xy / uViewPx).r) / max(uSlab.y - uSlab.x, 1e-3), 0.0, 1.0);
  oColor = vec4(scatter + glow, 1.0 - through) * edge * shown;
}
`;

/**
 * The haze all through the room: no flow to it, only a density that drifts and turns slowly, lit by everything the room is
 * lit by. On its own it's next to nothing; in front of a lit screen it's that screen's light, hanging in the air.
 */
export const HAZE = HEAD + NOISE + LIGHT + `
uniform float uTime, uHaze;
// Where it's drawn on the page, metres: its corner and size.
uniform vec4 uView;
out vec4 oColor;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y), w = uView.xy + uv * uView.zw;
  float t = uTime;
  // Layers at 30, 12 and 5 cm, each drifting its own way and rising a little, as warm air off the equipment does.
  vec2 drift = vec2(0.0, t * 0.012);
  float n = valueNoise(w * 3.3 + vec2(t * 0.021, 0) + drift * 3.3) * 0.5
          + valueNoise(w * 8.0 + vec2(-t * 0.035, 3.1) + drift * 8.0) * 0.3
          + crumple(w * 6.0 + vec2(t * 0.05, -t * 0.03)) * 0.35;
  float d = uHaze * (0.25 + n * n * 1.1);
  // Haze is thin: the room's general light only lifts it a little, where a screen or lamp right behind it lights it up.
  oColor = vec4((roomLight(w) - uAmbient * 0.85) * d, d * 0.04);
}
`;

/**
 * Sparks: drops of hot metal, each a streak as long as it travels while the eye takes it in, as bright as its temperature makes
 * it, spread along its length. What's too bright for the room saturates to white, as a hot spark's core does in any photo.
 */
export const SPARK_VERTEX = `#version 300 es
in vec4 aSpark;
in vec2 aShape;
in vec3 aLight;
uniform vec2 uSpan;
out vec2 vAt;
out vec2 vShape;
out vec3 vLight;
out float vY;
void main() {
  vAt = aSpark.zw;
  vY = aSpark.y;
  vShape = aShape;
  vLight = aLight;
  gl_Position = vec4(aSpark.x / uSpan.x * 2.0 - 1.0, 1.0 - aSpark.y / uSpan.y * 2.0, 0.0, 1.0);
}
`;
export const SPARK_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vAt;
in vec2 vShape;
in vec3 vLight;
in float vY;
// Where the floor is, device px: a streak that bounced doesn't show the part of it that went under.
uniform float uFloor;
uniform bool uLinear;
out vec4 oColor;
void main() {
  if (vY > uFloor + 0.5) discard;
  // How far from the line it draws, device px.
  float d = length(vec2(vAt.x - clamp(vAt.x, 0.0, vShape.x), vAt.y)), r = vShape.y;
  // The drop covers what it covers, however bright. On the stage that's all: the camera's lens glares and its curve takes it to
  // white. On a canvas of its own the spark does both: saturating mustn't fatten it, and round it is the lens's glare, a spread a
  // pixel wide at its heart and falling off as the square, carrying a share of all the light the drop gives, faint enough that
  // only a very hot spark's reaches past the drop.
  float core = clamp(r + 0.5 - d, 0.0, 1.0);
  if (uLinear) {
    oColor = vec4(vLight * core, 0.0);
    return;
  }
  float glare = 0.003 * r * r / (d * d + 1.0) * (1.0 - smoothstep(${(GLARE * 0.6).toFixed(1)}, ${GLARE.toFixed(1)}, d));
  oColor = vec4(1.0 - exp(-vLight * (core + glare)), 0.0);
}
`;

/**
 * On the stage: how high each picture stands, mm, where it's drawn, into a target the size of the stage in css px. Where two
 * meet, the taller is kept. A picture whose heights are let go for now is flat at its face.
 */
export const HEIGHTS = `#version 300 es
precision highp float;
uniform sampler2D uH;
uniform vec4 uToMap;
uniform float uRows, uFace;
uniform int uFlat;
out vec4 o;
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRows - gl_FragCoord.y), m = px * uToMap.xy + uToMap.zw;
  if (any(lessThan(m, vec2(0))) || any(greaterThan(m, vec2(1)))) discard;
  float h = uFlat == 1 ? uFace : texture(uH, m).r;
  if (h <= 0.0) discard;
  o = vec4(h, 0, 0, 1);
}
`;

/**
 * How far a plume's heat moves what's seen through it, mm across and down the page. Hot air is thinner, so its index is nearer
 * 1, and a line of sight through it turns toward the denser, cooler air, by the index's slope times the depth it crosses. What's
 * behind it is moved by that turn times how far behind it is: the integral of the slope times the height over what's seen, through
 * the plume's depth. On a surface right under it, very little; across a gap, more.
 */
export const BEND = HEAD + GRID + `
uniform sampler2D uVel, uHeights;
uniform vec2 uViewPx;
uniform vec3 uSlab;
uniform vec4 uFade;
out vec4 oBend;
// How much denser than the room the air here is, less one: as the room's temperature over its own.
float denser(vec2 uv) { return 295.0 / (295.0 + max(texture(uVel, uv).z, 0.0) * ${HEAT_KELVIN}.0) - 1.0; }
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y), ex = vec2(uCell / span().x, 0), ey = vec2(0, uCell / span().y);
  // Its slope across and down the page, per mm.
  vec2 g = vec2(denser(uv + ex) - denser(uv - ex), denser(uv + ey) - denser(uv - ey)) / (2.0 * uCell) * 0.001;
  float h = texture(uHeights, gl_FragCoord.xy / uViewPx).r, deep = uSlab.y - uSlab.x;
  // Held at a height, or lying on what's under it.
  float foot = uSlab.z > 0.5 ? uSlab.x : h, top = foot + deep, lo = max(foot, h);
  float through = top > lo ? 0.5 * ((top - h) * (top - h) - (lo - h) * (lo - h)) : 0.0;
  vec4 near = vec4(uv.x, 1.0 - uv.x, uv.y, 1.0 - uv.y) + (1.0 - uFade);
  float edge = smoothstep(0.0, 0.3, min(near.x, near.y)) * smoothstep(0.0, 0.16, min(near.z, near.w));
  oBend = vec4(${REFRACTIVITY} * g * through * edge, 0, 0);
}
`;

/**
 * How far blasts move what's seen, mm. Each front is a shell of air denser than the room, thickest at its front and thinning
 * behind it, over the surface it went off on: a line of sight through it is turned by the slope of its density, so what's under
 * it moves out or in by that turn times its height over what's seen. Each look is weighted for its share of the shutter.
 */
export const SHOCK = HEAD + `
uniform sampler2D uHeights;
uniform vec2 uViewPx;
uniform float uMmPerPx;
// Each look: where it went off, css px from the stage's corner, how far its front has gone, mm, and how much denser it is
// there; then how thick its shell is, mm, and its share of the shutter.
uniform vec4 uShock[${MAX_SHOCKS}];
uniform vec2 uShockShell[${MAX_SHOCKS}];
uniform int uShockCount;
out vec4 oBend;
float heightAt(vec2 px) { return texture(uHeights, vec2(px.x, uViewPx.y - px.y) / uViewPx).r; }
float denser(float r, float R, float A, float th) {
  float w = 0.25 * th;
  return r > R + w ? 0.0 : A * exp(-max(R - r, 0.0) / th) * (1.0 - smoothstep(R - w, R + w, r));
}
// How much denser the air is along a line of sight s mm from where it went off, times its height over what's seen there, mm².
// Only where the shell is: further in it's thinned to nothing.
float column(float s, float h, float zc, float R, float A, float th) {
  float rin = max(R - 6.0 * th, 0.0), rout = R + 0.25 * th;
  if (s >= rout) return 0.0;
  float lo = max(max(h, zc), zc + sqrt(max(rin * rin - s * s, 0.0))), hi = zc + sqrt(rout * rout - s * s);
  if (hi <= lo) return 0.0;
  float dz = (hi - lo) / 24.0, sum = 0.0;
  for (int k = 0; k < 24; k++) {
    float z = lo + (float(k) + 0.5) * dz;
    sum += denser(length(vec2(s, z - zc)), R, A, th) * (z - h);
  }
  return sum * dz;
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uViewPx.y - gl_FragCoord.y), d = vec2(0);
  float h = heightAt(px);
  for (int i = 0; i < ${MAX_SHOCKS}; i++) {
    if (i >= uShockCount) break;
    vec4 a = uShock[i];
    vec2 b = uShockShell[i], q = (px - a.xy) * uMmPerPx;
    float s = length(q);
    if (s > a.z + b.x || s < 1e-3) continue;
    float zc = heightAt(a.xy), e = max(0.25 * b.x, 0.01);
    float g = (column(s + e, h, zc, a.z, a.w, b.x) - column(max(s - e, 0.0), h, zc, a.z, a.w, b.x)) / (2.0 * e);
    d += ${REFRACTIVITY} * g * q / s * b.y;
  }
  oBend = vec4(d, 0, 0);
}
`;
