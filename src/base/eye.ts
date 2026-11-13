// How the eye on a stage is exposed. It meters the light falling on the world, not the things in it, as a photographer's incident
// meter does: a black object in a bright room is still in a bright room. What the world gives off itself, its screens and lamps,
// counts as what it is, as the eye sees it straight. It adapts to that over time, as the eye does, so a flash overexposes and the
// eye takes a moment to come back, and a dark room is seen brighter once the eye has settled in it, though never as bright as a lit one.

/** What a white in the light pass's units stands for, cd/m²: white paper under an office lamp, about 500 lux, which is also a
 * screen's white. 120, as the air takes it. guess */
export const WHITE = 120;
/** What the eye takes a lit world's luminance to be: an 18% grey in its light. spec (the grey card) */
const GREY = 0.18;
/** The luminance the light pass is exposed for, cd/m²: a grey in the studio, the room every page is lit for. Exposure is 1 here. */
const REFERENCE = GREY * WHITE;
/**
 * Ward's contrast-based scale factor, against the reference: how much brighter or darker than at the reference a world adapted to
 * `L` cd/m² is shown, so a just-noticeable difference there is one on the screen. It compensates in part: a room ten times darker
 * is shown about 2.3 times darker. Ward, "A contrast-based scalefactor for luminance display", Graphics Gems IV (1994).
 */
const ward = (L: number) => ((1.219 + REFERENCE ** 0.4) / (1.219 + Math.max(L, 1e-4) ** 0.4)) ** 2.5;
/** How fast the eye follows, seconds: cones 0.1, rods 0.4, mixed by how far into the dark it is. Durand and Dorsey, "Interactive
 * tone mapping" (2000), as Krawczyk, Myszkowski and Seidel take it for real time (2005). */
const CONES = 0.1, RODS = 0.4;
const tau = (L: number) => {
  const rods = 0.04 / (0.04 + L);
  return rods * RODS + (1 - rods) * CONES;
};

/** What a world is lit by and gives off, for the eye to meter: each in the light pass's units, where 1 shows white as white. */
export interface Metered {
  /** The room's light, lamp and all: 1 in the studio. */
  room: number;
  /** Lights in the room, flashes and flames, as much as they add on average over what's seen. */
  lights: number;
  /** What's seen glowing, on average over what's seen: a screen's white is 1 where it covers the view. */
  glow: number;
}

export class Eye {
  /** The luminance it's adapted to, cd/m², or null before it's seen anything. */
  adapted: number | null = null;
  private at = 0;
  private settled = true;

  /** The luminance it would settle to, cd/m². */
  static target(m: Metered): number {
    return WHITE * (GREY * (m.room + m.lights) + m.glow);
  }

  /** Looks at the world for the time since it last did. Whether it's still adapting. A settled eye isn't looked at until the world
   * changes, so the time since then isn't time it spent adapting: it starts from where it was, as the change is seen. */
  look(m: Metered, now = performance.now()): boolean {
    const L = Eye.target(m);
    const dt = this.adapted === null || this.settled ? 0 : Math.min(Math.max((now - this.at) / 1000, 0), 0.25);
    this.at = now;
    if (this.adapted === null) this.adapted = L;
    else this.adapted += (L - this.adapted) * (1 - Math.exp(-dt / tau(L)));
    if (Math.abs(this.adapted - L) <= L * 0.002) this.adapted = L;
    this.settled = this.adapted === L;
    return !this.settled;
  }

  /** How it's exposed against the light pass: 1 at the studio's light. */
  get exposure(): number {
    return this.adapted === null ? 1 : ward(this.adapted);
  }
}
