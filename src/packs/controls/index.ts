// The controls pack: each part declares its surfaces on a Sheet, from a DOM rect and live state.
// Everything here goes through the public API, so anyone can write a part like these.
// Other packs are parts for particular kinds of object. Each has its own entry and none is imported here.
import { defineStyles } from 'device-ui';
import { controlStyles, keyStyles } from './shared.js';
import './icons.js';
import './keys.js';
import './knob.js';
import './rotary.js';
import './switches.js';
import './sliders.js';
import './lamps.js';
import './meters.js';
import './displays.js';
import './touch.js';
import './hardware.js';

export { key, legend, words, type KeyCap, type KeyForm } from './key.js';
export { letter, onTouch, present } from './displays.js';
export { MONO, Pixels, type Face } from './pixels.js';
export { haptics } from './haptics.js';
export { icon, icons, type IconOptions } from './icons.js';
export {
  bezel, bushing, collar, gripped, GRIPS, hexNut, indicator, isDish, isDrive, isKeyProfile, isLegend, isLens, isNeedle, isScrewHead, isScrewSize, keycap, legendLook, lens, lowCap, needle, overhang, profiledCap, PROFILES, printRing, printScale, ringNut, ROWS, screwHead, SCREWS, seat, swept,
  type Dish, type Drive, type Grip, type Indicator, type KeyProfile, type Legend, type Lens, type Needle, type ScrewHead, type ScrewSize } from './anatomy.js';
export { controlStyles, fraction, ground, keyStyles, lamp, scale } from './shared.js';

const CONTROLS = ['[d-switch~="toggle"]', '[d-switch~="spring"]', '[d-switch~="throw"]', '[d-slider~="fader"]', '[d-slider~="lever"]', '[d-slider~="pull"]', '[d-slider~="handle"]', '[d-knob~="pointer"]', '[d-wheel~="thumb"]', '[d-knob~="jog"]', '[d-switch~="rocker"]', '[d-slider~="nub"]', '[d-switch~="key"]', '[d-wheel~="rotary"]', '[d-stick=""]', '[d-stick~="analog"]', '[d-stick~="gimbal"]', '[d-stick~="hat"]', '[d-stick~="slide"]', '[d-stick~="paddle"]', '[d-slider~="strip"]', '[d-wheel~="click"]', '[d-stick~="pad"]', '[d-knob~="knurled"]'];
const METERS = ['[d-meter~="gauge"]', '[d-meter~="panel"]', '[d-meter~="vu"]', '[d-meter~="needle"]', '[d-meter~="bargraph"]', '[d-meter~="ring"]'];
const KEYS = ['[d-stick~="dpad"] button', '[d-wheel~="click"] button', '[d-wheel~="scroll"] button', '[d-wheel~="pad"] button'];
const TEXT = ['[d-readout~="seven"]:not([d-readout~="clock"])', '[d-readout~="starburst"]', '[d-readout~="nixie"]', '[d-readout~="flip"]', '[d-readout~="odometer"]', '[d-readout~="matrix"]'];
// The sockets and panes, and the indicator: the rest of those parts' forms bring their own.
const PORT = ':is([d-port~="usbc"], [d-port~="usba"], [d-port~="hdmi"], [d-port~="jack"], [d-port~="sd"], [d-port~="modular"]):not([d-port~="edge"])';
const PANE = ':is([d-glass~="frosted"], [d-glass~="smoked"], [d-glass~="clear"])';
const LAMP = ':is([d-lamp=""], [d-lamp~="led"], [d-lamp~="pin"], [d-lamp~="window"], [d-lamp~="bar"], [d-lamp~="neon"])';
const each = (tags: string[], suffix = '') => tags.map(t => `${t}${suffix}`).join(', ');
const gl = (tags: string[], suffix = '') => tags.map(t => `.d-gl ${t}${suffix}`).join(', ');
const BLOCK = [...METERS, ...TEXT, LAMP, '[d-readout~="lcd"]', '[d-readout~="segments"]', '[d-opening~="grille"]', '[d-cover~="guard"]', 'd-screen', '[d-fixing~="screw"]', '[d-mark~="scale"]', '[d-meter~="clock"]', '[d-meter~="compass"]', '[d-glass~="lens"]', PORT, '[d-opening~="vent"]', '[d-meter~="lightbar"]', PANE, '[d-stick~="dpad"]', '[d-port~="header"]'];

// A device takes the type of panel lettering, and it isn't themed. A page sets its own face with `font-family`.
defineStyles(`
d-device {
  font: 600 12px/1 system-ui, sans-serif; letter-spacing: .09em; text-transform: uppercase;
  color: #26241f; color-scheme: light; font-synthesis: weight style small-caps; text-rendering: auto;
  --ink: #26241f;
}
[d-mark~="label"], [d-mark~="stamp"] { display: block; }
${each(BLOCK)} { display: block; position: relative; }
${LAMP} { width: 26px; height: 26px; border-radius: 50%; background: #555; }
${LAMP}[on] { background: #e8a33d; }
${controlStyles(...CONTROLS)}
${each(METERS, ' meter')} { width: 100%; height: 100%; }
d-screen :is(canvas, video, img) { display: block; width: 100%; height: 100%; letter-spacing: normal; }
d-screen[pointer] { pointer-events: auto; cursor: none; }
d-screen:has(> :not(canvas, video, img)) > canvas { display: none; }
/* A page, not a legend: a device's type stops here. */
:where(d-screen > :not(canvas, video, img)) { font: 14px/1.4 system-ui, sans-serif; letter-spacing: normal; text-transform: none; text-align: start; }
[d-readout~="lcd"] input { width: 100%; box-sizing: border-box; font: inherit; background: #111; color: #ffb340; border: 0; }
[d-seam] { height: 2px; }
[d-key~="tab"], [d-key~="mushroom"] { display: block; position: relative; text-align: center; }
[d-cover~="guard"] { min-height: 60px; }
d-seg { display: none; }
.d-gl ${LAMP} { background: none; }
${keyStyles(...KEYS)}
.d-gl :is([d-key~="tab"], [d-key~="mushroom"]) input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
.d-gl [d-mark~="label"], .d-gl [d-mark~="stamp"], .d-gl [d-mark~="plate"], .d-gl [d-mark~="dymo"], .d-gl [d-lamp~="annunciator"], .d-gl [d-readout=""] { color: transparent; }
.d-gl img[d-mark~="stamp"] { opacity: 0; }
[d-stick~="dpad"] { display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); }
[d-stick~="dpad"] button:nth-of-type(1) { grid-area: 1 / 2; }
[d-stick~="dpad"] button:nth-of-type(2) { grid-area: 2 / 1; }
[d-stick~="dpad"] button:nth-of-type(3) { grid-area: 2 / 3; }
[d-stick~="dpad"] button:nth-of-type(4) { grid-area: 3 / 2; }
[d-stick~="dpad"] button:nth-of-type(5) { grid-area: 2 / 2; }
[d-wheel~="click"] button { position: absolute; inset: 32%; border-radius: 50%; }
[d-wheel~="click"] button[rim] { pointer-events: none; }
[d-wheel~="scroll"] button, [d-wheel~="pad"] button { position: absolute; inset: 0; border-radius: 0; }
[d-wheel~="scroll"] button:not([rim]), [d-wheel~="pad"] button:not([rim]) { border-radius: 50%; }
.d-gl [d-readout~="lcd"] input {
  background: none; outline: none; caret-color: currentColor; color: var(--d-lcd-ink, #ffb340);
}
${gl(METERS, ' meter')} { position: absolute; inset: 0; opacity: 0; }
${gl(TEXT)} { color: transparent; overflow: hidden; user-select: none; }
.d-gl d-screen :is(canvas, video, img) { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
/* What a screen draws is lit into the device's picture, and a canvas draws and is read as well unrendered. Rendered, unseen, each was a layer the browser kept, and everything over it another. */
.d-gl d-screen > canvas { display: none; }
.d-gl d-screen > :not(canvas, video, img) { position: absolute; inset: 0; opacity: 0; color: #000; }
.d-gl d-screen:is([kind="crt"], [kind="led"], [kind="oled"], :not([kind])) > :not(canvas, video, img) { color: #fff; }
.d-gl [d-cover~="guard"] > input { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; opacity: 0; z-index: 1; cursor: pointer; }
.d-gl [d-cover~="guard"] > input:checked { height: 14px; }
`);
