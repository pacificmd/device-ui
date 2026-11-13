import { onContact, type ContactKind } from 'device-ui';

// Ms of motor at full speed, and the speed that counts as full.
// A rub has none: a motor can't go on as long as a drag does.
const PULSES: Partial<Record<ContactKind, readonly [ms: number, full: number]>> = {
  press: [12, 25],
  release: [6, 25],
  toggle: [18, 25],
  detent: [4, 30],
  stop: [12, 10],
};

/** iOS has no vibrate, but Safari ticks the motor when a switch flips. Clicking its hidden label does that, in a gesture only. */
function tapper(): (() => void) & { stop(): void } {
  let label: HTMLLabelElement | null = null;
  const tap = () => {
    if (!navigator.userActivation?.isActive) return;
    if (!label) {
      label = document.createElement('label');
      label.hidden = true;
      label.innerHTML = '<input type="checkbox" switch>';
      // It's nobody's click but this function's.
      label.addEventListener('click', e => e.stopPropagation());
      document.body.append(label);
    }
    label.click();
  };
  return Object.assign(tap, { stop: () => label?.remove() });
}

const canTap = () => typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype && navigator.maxTouchPoints > 1;

/** Buzzes on every contact, where the device has a motor. On an iPhone it's one tick of one strength, unverified on the real thing. Returns what stops it. */
export function haptics(): () => void {
  if (typeof navigator === 'undefined') return () => {};
  if (!navigator.vibrate) {
    if (!canTap()) return () => {};
    const tap = tapper();
    const off = onContact(c => {
      if (PULSES[c.kind]) tap();
    });
    return () => {
      off();
      tap.stop();
    };
  }
  return onContact(c => {
    // Before the page has been touched the browser refuses, and says so in the console.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const pulse = PULSES[c.kind];
    if (!pulse) return;
    const [ms, full] = pulse;
    navigator.vibrate(Math.ceil(ms * Math.min(1, c.speed / full)));
  });
}
