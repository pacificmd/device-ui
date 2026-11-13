// A path's outline as closed polylines, in its own units: every curve and arc cut into chords that stray from it by at most
// `tol`. A fill closes every subpath, so these are all closed.
export function flatten(d: string, tol: number): number[][] {
  const out: number[][] = [], NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', px = 0, py = 0, poly: number[] | null = null; // px, py: the last control point
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const more = () => { ws(); return i < d.length && /[-+.\d]/.test(d[i]); };
  const num = () => { ws(); NUM.lastIndex = i; const m = NUM.exec(d); i = NUM.lastIndex; return +m![0]; };
  const flag = () => { ws(); return d[i++] === '1'; };
  const to = (nx: number, ny: number) => { poly!.push(nx, ny); x = nx; y = ny; };
  const curve = (n: number, at: (t: number) => [number, number]) => { for (let k = 1; k <= n; k++) to(...at(k / n)); };
  while (i < d.length) {
    ws(); if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (poly && poly.length > 2) out.push(poly); poly = null; x = sx; y = sy; px = x; py = y; continue; }
    if (C === 'M') { if (poly && poly.length > 2) out.push(poly); x = num() + ox; y = num() + oy; sx = x; sy = y; poly = [x, y]; cmd = rel ? 'l' : 'L'; px = x; py = y; continue; }
    poly ??= [x, y];
    if (C === 'L') to(num() + ox, num() + oy);
    else if (C === 'H') to(num() + ox, y);
    else if (C === 'V') to(x, num() + oy);
    else if (C === 'C' || C === 'S') {
      const [x1, y1] = C === 'C' ? [num() + ox, num() + oy] : [2 * x - px, 2 * y - py];
      const x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy, x0 = x, y0 = y;
      // Wang's bound: chords this many never stray further than tol.
      const m = Math.max(Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3)), n = Math.max(1, Math.ceil(Math.sqrt(0.75 * m / tol)));
      curve(n, t => { const u = 1 - t; return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]; });
      px = x2; py = y2; continue;
    } else if (C === 'Q' || C === 'T') {
      const [x1, y1] = C === 'Q' ? [num() + ox, num() + oy] : [2 * x - px, 2 * y - py];
      const x2 = num() + ox, y2 = num() + oy, x0 = x, y0 = y, n = Math.max(1, Math.ceil(Math.sqrt(0.25 * Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2) / tol)));
      curve(n, t => { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]; });
      px = x1; py = y1; continue;
    } else if (C === 'A') {
      let rx = Math.abs(num()), ry = Math.abs(num());
      const phi = num() * Math.PI / 180, large = flag(), sweep = flag(), x2 = num() + ox, y2 = num() + oy, x1 = x, y1 = y;
      if (!rx || !ry) to(x2, y2);
      else {
        // The SVG spec's endpoint to centre conversion.
        const co = Math.cos(phi), si = Math.sin(phi), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = co * dx + si * dy, yp = -si * dx + co * dy;
        const L = xp * xp / (rx * rx) + yp * yp / (ry * ry);
        if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
        const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (rx * rx * yp * yp + ry * ry * xp * xp)));
        const cxp = k * rx * yp / ry, cyp = -k * ry * xp / rx, cx = co * cxp - si * cyp + (x1 + x2) / 2, cy = si * cxp + co * cyp + (y1 + y2) / 2;
        const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
        let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
        if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
        const R = Math.max(rx, ry), n = Math.max(1, Math.ceil(Math.abs(dt) / (2 * Math.acos(Math.max(-1, 1 - tol / R)))));
        curve(n, t => { const a = t1 + dt * t, ex = rx * Math.cos(a), ey = ry * Math.sin(a); return [cx + co * ex - si * ey, cy + si * ex + co * ey]; });
        x = x2; y = y2;
      }
    }
    px = x; py = y;
    if (!more() && i < d.length && !/[a-zA-Z]/.test(d[i])) i++; // something it doesn't read: past it
  }
  if (poly && poly.length > 2) out.push(poly);
  return out;
}
