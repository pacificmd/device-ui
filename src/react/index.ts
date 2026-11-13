// Parts with props. A wrapper writes the same markup you would write by hand, so anything
// not listed here still works as plain markup in JSX, `<div d-knob="skirt">`.
import 'device-ui/controls';
import { createElement, useEffect, useRef, type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [tag: `d-${string}`]: Record<string, unknown>;
    }
  }
}

/** Any attribute a part takes passes straight through. */
export interface PartProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  [attribute: string]: unknown;
}

export interface RangeProps extends PartProps {
  /** The control's accessible name. */
  name: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?(value: number): void;
}

export interface CheckProps extends PartProps {
  name: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?(checked: boolean): void;
}

export interface MeterProps extends PartProps {
  name: string;
  value: number;
  min?: number;
  max?: number;
}

export interface KeyProps extends PartProps {
  /** The cap's material. */
  cap?: string;
  onClick?(): void;
}

export interface PadProps extends PartProps {
  /** The two accessible names, across then up. */
  names: [string, string];
  value?: [number, number];
  defaultValue?: [number, number];
  min?: number;
  max?: number;
  step?: number;
  onChange?(value: [number, number]): void;
}

export interface SensorProps extends PartProps {
  /** Fires when the ring closes. */
  onHold?(): void;
}

export interface ScreenProps extends PartProps {
  width: number;
  height: number;
  kind?: 'crt' | 'led' | 'lcd' | 'oled' | 'eink';
  /** Draws the canvas: every frame while `live`, otherwise once. `t` is in seconds. */
  draw?(ctx: CanvasRenderingContext2D, t: number): void;
  /** Repaints the device every frame, so turn it off when nothing is moving. */
  live?: boolean;
}

const box = (tag: string) => (props: PartProps): ReactElement => createElement(tag, props);

/** One form of a part with nothing inside it to speak of. */
const form = (tag: string, value: string) => (props: PartProps): ReactElement =>
  createElement('div', { ...written(tag, value), ...props });

/** A part that leaves the form to `kind`, and `plain` when there is none. */
const chosen = (tag: string, plain = '') => ({ kind = plain, ...rest }: PartProps): ReactElement =>
  createElement('div', { ...written(tag, kind as string), ...rest });

/** A part written as an attribute on a plain element. An empty form is the plain one, and React needs it said as a string. */
const written = (tag: string, value = '') => ({ [tag]: value });

const range = (tag: string, form?: string, type = 'range') => ({ name, value, defaultValue, min, max, step, onChange, ...rest }: RangeProps): ReactElement =>
  createElement('div', { ...written(tag, form), ...rest }, createElement('input', {
    type, 'aria-label': name, value, defaultValue, min, max, step,
    onChange: onChange && ((e: ChangeEvent<HTMLInputElement>) => onChange(e.target.valueAsNumber)),
  }));

const check = (tag: string, form?: string) => ({ name, checked, defaultChecked, onChange, ...rest }: CheckProps): ReactElement =>
  createElement('div', { ...written(tag, form), ...rest }, createElement('input', {
    type: 'checkbox', 'aria-label': name, checked, defaultChecked,
    onChange: onChange && ((e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)),
  }));

const meter = (tag: string, kind: string) => ({ name, value, min, max, ...rest }: MeterProps): ReactElement =>
  createElement('div', { ...written(tag, kind), ...rest }, createElement('meter', { 'aria-label': name, value, min, max }));

const key = (form = '') => ({ cap, ...rest }: KeyProps): ReactElement =>
  createElement('button', { type: 'button', 'd-key': form, material: cap, ...rest });

export const Device = box('d-device');
export const Surface = box('d-surface');
export const Lamp = chosen('d-lamp');
export const Glass = chosen('d-glass', 'frosted');
export const Lens = form('d-glass', 'lens');
export const Port = chosen('d-port', 'usbc');
export const Vent = form('d-opening', 'vent');
export const Lightbar = form('d-meter', 'lightbar');
export const Grille = form('d-opening', 'grille');
export const Seven = form('d-readout', 'seven');
export const Nixie = form('d-readout', 'nixie');
export const Flip = form('d-readout', 'flip');
export const Odometer = form('d-readout', 'odometer');
export const Matrix = form('d-readout', 'matrix');

export const Knob = range('d-knob');
export const Selector = range('d-knob', 'pointer');
export const Thumbwheel = range('d-wheel', 'thumb');
export const Jog = range('d-knob', 'jog');
export const Slide = range('d-slider', 'nub');
export const Fader = range('d-slider', 'fader');
export const Lever = range('d-slider', 'lever');
export const Touchstrip = range('d-slider', 'strip');
const cap = range('d-knob', 'cap');
/** An encoder is a cap knob that clicks, knurled with a spun top and a dot. */
export const Encoder = (p: RangeProps): ReactElement => cap({ detents: '', grip: 'knurled', top: 'spun', mark: 'dot', ...p });
export const SpringToggle = range('d-switch', 'spring');

export const Toggle = check('d-switch', 'toggle');
export const Rocker = check('d-switch', 'rocker');
export const Keyswitch = check('d-switch', 'key');

export const Gauge = meter('d-meter', 'gauge');
export const Vu = meter('d-meter', 'vu');
export const Bargraph = meter('d-meter', 'bargraph');
export const Ring = meter('d-meter', 'ring');

export const Key = key();
export const Arcade = key('arcade');
export const Softkey = key('soft');
export const Chiclet = key('chiclet');
export const Mech = key('mech');
export const Face = key('face');

export function Xypad({ names, value, defaultValue, min, max, step, onChange, ...rest }: PadProps): ReactElement {
  const axis = (i: 0 | 1) => createElement('input', {
    type: 'range', 'aria-label': names[i], value: value?.[i], defaultValue: defaultValue?.[i], min, max, step,
    onChange: onChange && ((e: ChangeEvent<HTMLInputElement>) => {
      const both = [...e.target.parentElement!.querySelectorAll('input')].map(el => el.valueAsNumber);
      onChange([both[0]!, both[1]!]);
    }),
  });
  return createElement('div', { ...written('d-stick', 'pad'), ...rest }, axis(0), axis(1));
}

export function Sensor({ onHold, ...rest }: SensorProps): ReactElement {
  const el = useRef<HTMLButtonElement>(null);
  const latest = useRef(onHold);
  latest.current = onHold;
  useEffect(() => {
    const fire = () => latest.current?.();
    const node = el.current!;
    node.addEventListener('hold', fire);
    return () => node.removeEventListener('hold', fire);
  }, []);
  return createElement('button', { type: 'button', 'd-key': 'sensor', ref: el, ...rest });
}

export function Screen({ width, height, draw, live = false, ...rest }: ScreenProps): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(draw);
  latest.current = draw;
  const moving = live && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    latest.current?.(ctx, performance.now() / 1000);
    if (!moving) return;
    let frame = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      latest.current?.(ctx, now / 1000);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [moving]);

  return createElement('d-screen', { ...rest, live: moving }, createElement('canvas', { ref: canvas, width, height }));
}
