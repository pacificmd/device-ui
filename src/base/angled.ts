// A device set at an `angle` is laid out flat and turned as a whole, so a hand on it has to be seen through the turn.

const RAD = Math.PI / 180;
/** The `angle` on the device round `el`, degrees about its upright and across it. */
export function angleOn(el: Element): [number, number] {
  const [y = 0, x = 0] = (el.closest('d-device[angle]')?.getAttribute('angle') ?? '').trim().split(/\s+/).map(v => parseFloat(v) || 0);
  return [y, x];
}

/** How much of a length on the device round `el` reaches the screen, across and down. 1 for a device set square on. */
export function squashOn(el: Element): [number, number] {
  const [y, x] = angleOn(el);
  return [Math.cos(y * RAD) || 1, Math.cos(x * RAD) || 1];
}
