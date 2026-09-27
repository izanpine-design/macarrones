/**
 * The presentation's choreography as pure functions of time, so every rocket
 * moves continuously from one part of the show to the next (no jumps between
 * stages) and any moment can be drawn on its own.
 */

/** Moments of the show, in seconds after pressing "¡Despegar!". */
export const CUE = {
  two: 0.8,
  one: 1.6,
  lift: 2.4,
  loop: 4.6,
  bail: 7.05,
  dive: 7.4,
  flash: 9.4,
  flyby: 10.5,
  play: 11.9,
  end: 15.5,
} as const;

export type Stage = 'ready' | 'countdown' | 'liftoff' | 'stunt' | 'warp' | 'arrive' | 'leaving';

export function stageAt(t: number): Exclude<Stage, 'leaving'> {
  if (t < 0) return 'ready';
  if (t < CUE.lift) return 'countdown';
  if (t < CUE.loop) return 'liftoff';
  if (t < CUE.dive) return 'stunt';
  if (t < CUE.flash) return 'warp';
  return 'arrive';
}

export interface Screen {
  width: number;
  height: number;
}

/** A rocket at one moment: centre (px), size and look. */
export interface Pose {
  x: number;
  y: number;
  scale: number;
  /** Stretched along its length while diving into hyperspace. */
  stretch: number;
  alpha: number;
  /** -1 when it flies to the left (drawn mirrored). */
  facing: 1 | -1;
}

/**
 * Formation spots: the lead (your rocket) in front, the rest in a V behind it.
 * dx in formation steps, dy in fractions of the screen height.
 */
const SPOTS = [
  { dx: 0, dy: 0, scale: 1 },
  { dx: -1, dy: -0.07, scale: 0.86 },
  { dx: 1, dy: -0.07, scale: 0.86 },
  { dx: -1.85, dy: -0.15, scale: 0.74 },
  { dx: 1.85, dy: -0.15, scale: 0.74 },
  { dx: 0, dy: -0.22, scale: 0.62 },
] as const;

/** Liftoff order: the lead first, then pairs further back. */
const RANK = [0, 1, 1, 2, 2, 3] as const;

/** Direction each rocket shoots off in at the end, past the camera (degrees, y down). */
export const FLY_OUT = [-18, 198, -62, 242, 24, 156] as const;

/** Width of a rocket at scale 1 (px). */
export function rocketWidth(screen: Screen): number {
  return Math.min(210, Math.max(96, screen.width * 0.24));
}

function formationStep(screen: Screen): number {
  return screen.width < 600 ? screen.width * 0.21 : Math.min(screen.width * 0.18, 240);
}

/**
 * Where rocket `i` is `t` seconds into the show (t < 0: waiting on the launch
 * pad; `idle` seconds since the show opened, for a gentle hover).
 */
export function pose(i: number, t: number, screen: Screen, idle = 0): Pose {
  const { width: w, height: h } = screen;
  const spot = SPOTS[i % SPOTS.length];
  let x = w / 2 + spot.dx * formationStep(screen);
  let y = h * 0.7 + spot.dy * h;
  const formY = h * 0.52 + spot.dy * h;
  let scale: number = spot.scale;
  let stretch = 1;
  let alpha = 1;

  // Hovering while it waits; the hover fades out during the countdown.
  y += Math.sin(idle * 2.4 + i * 1.3) * 4 * (1 - smoothstep(0, 1.2, t));

  // Liftoff, the lead first: slow off the pad, fast in the middle, easing into formation.
  const lift = clamp01((t - (CUE.lift + RANK[i % RANK.length] * 0.12)) / 1.9);
  if (lift > 0) {
    const rise = smootherstep(lift);
    y += (formY - y) * rise;
    // Drifting outwards a little on the way up (starting and ending gently).
    x += Math.sign(spot.dx) * Math.sin(Math.PI * rise) * w * 0.03;
  }

  // Air show: every rocket loops the loop, one after another.
  const loop = clamp01((t - (CUE.loop + i * 0.12)) / 1.7);
  if (loop > 0 && loop < 1) {
    const turn = Math.PI * 2 * smootherstep(loop);
    const radius = Math.min(w, h) * 0.12 * spot.scale;
    x += radius * Math.sin(turn);
    y -= radius * (1 - Math.cos(turn));
  }

  // Hyperspace: spiralling into the vanishing point, stretched by the speed.
  const dive = clamp01((t - (CUE.dive + i * 0.09)) / 1);
  if (dive > 0) {
    const e = dive ** 3;
    const cx = w / 2;
    const cy = h * 0.45;
    const spin = (i % 2 ? -1 : 1) * e * Math.PI * 1.4;
    const rx = x - cx;
    const ry = y - cy;
    x = cx + (rx * Math.cos(spin) - ry * Math.sin(spin)) * (1 - e);
    y = cy + (rx * Math.sin(spin) + ry * Math.cos(spin)) * (1 - e);
    scale *= 1 - 0.96 * e;
    stretch = 1 + 1.8 * e;
    alpha = 1 - smoothstep(0.8, 1, dive);
  }
  if (t < CUE.flash) return { x, y, scale, stretch, alpha, facing: 1 };

  // Arrival: out of the new planet and past the camera, growing as they come.
  const fly = clamp01((t - (CUE.flyby + i * 0.16)) / 1.3);
  const angle = (FLY_OUT[i % FLY_OUT.length] * Math.PI) / 180;
  const e = fly * fly;
  const reach = Math.max(w, h) * 0.8;
  return {
    x: w / 2 + Math.cos(angle) * reach * e,
    y: h * 0.5 + Math.sin(angle) * reach * e,
    scale: spot.scale * (0.05 + 2.4 * e),
    stretch: 1,
    alpha: fly <= 0 ? 0 : smoothstep(0, 0.1, fly) * (1 - smoothstep(0.92, 1, fly)),
    facing: Math.cos(angle) >= 0 ? 1 : -1,
  };
}

/**
 * Rotation for rocket `i` (radians, for CSS): the nose follows its flight,
 * and it settles back to a gentle tilt whenever it slows down.
 */
export function heading(i: number, t: number, screen: Screen, idle = 0): number {
  const step = 1 / 120;
  const now = pose(i, t, screen, idle);
  const before = pose(i, t - step, screen, idle - step);
  const vx = (now.x - before.x) / step;
  const vy = (now.y - before.y) / step;
  const rest = -0.2 + 0.08 * smoothstep(CUE.lift, CUE.lift + 1, t);
  let nose = Math.atan2(vy, vx);
  if (now.facing === -1) nose -= Math.PI;
  const follow = smoothstep(25, 140, Math.hypot(vx, vy));
  return rest + wrapAngle(nose - rest) * follow;
}

/**
 * A pet bailing out before the jump to hyperspace (from CUE.bail on): off its
 * seat on the rocket, up and out towards the side, under its parachute.
 */
export function jumper(i: number, t: number, screen: Screen): { x: number; y: number; scale: number; tilt: number; alpha: number } {
  const w = rocketWidth(screen);
  const start = pose(i, CUE.bail, screen);
  // Their seat: behind the pilot, on top of the tube.
  const seatX = start.x - 0.2 * w * start.scale;
  const seatY = start.y - 0.12 * w * start.scale;
  const since = Math.max(0, t - CUE.bail);
  const side = i === 0 || SPOTS[i % SPOTS.length].dx < 0 ? -1 : 1;
  return {
    x: seatX + side * screen.width * 0.4 * (1 - Math.exp(-1.1 * since)),
    y: seatY - 150 * (1 - Math.exp(-2.6 * since)) + 55 * since * since,
    scale: start.scale * (1 + since * 0.35),
    tilt: Math.sin(since * 3.2 + i) * 0.22,
    alpha: 1 - smoothstep(1.9, 2.5, since),
  };
}

/** How far (px) the camera has risen following the liftoff: the ground drops away. */
export function cameraRise(t: number, screen: Screen): number {
  return screen.height * 1.4 * smootherstep((t - CUE.lift - 0.15) / 2.2);
}

/** Speed through the stars: cruising, then hyperspace, then braking on arrival. */
export function starSpeed(t: number): number {
  if (t >= CUE.flash) return 0.5 + 25 * (1 - smoothstep(CUE.flash, CUE.flash + 0.8, t));
  const cruise = 0.35 + 1.05 * smoothstep(CUE.lift, CUE.lift + 1.5, t);
  return cruise + 24 * smoothstep(CUE.dive - 0.2, CUE.dive + 1.2, t) ** 2;
}

/** 0–1: the fusilli tunnel, while in hyperspace. */
export function tunnelAt(t: number): number {
  return smoothstep(CUE.dive + 0.1, CUE.dive + 0.7, t) * (1 - smoothstep(CUE.flash - 0.15, CUE.flash, t));
}

/** 0–1: light at the end of the tunnel, growing until the arrival flash. */
export function glowAt(t: number): number {
  return t >= CUE.flash ? 0 : smoothstep(CUE.dive + 0.4, CUE.flash, t) ** 2;
}

/** 0–1: white flash, a small one at liftoff and a big one dropping out of hyperspace. */
export function flashAt(t: number): number {
  const liftoff = t >= CUE.lift ? 0.35 * (1 - smoothstep(CUE.lift, CUE.lift + 0.5, t)) : 0;
  const arrival = t >= CUE.flash ? 1 - smoothstep(CUE.flash, CUE.flash + 0.9, t) : 0;
  return Math.max(liftoff, arrival);
}

/** Screen shake (px): the countdown rumble, the liftoff and the arrival boom. */
export function shakeAt(t: number): number {
  if (t < 0) return 0;
  if (t < CUE.lift) return 1 + (3 * t) / CUE.lift;
  if (t < CUE.flash) return 9 * (1 - smoothstep(CUE.lift, CUE.lift + 1.8, t));
  return 12 * (1 - smoothstep(CUE.flash, CUE.flash + 0.7, t));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(from: number, to: number, value: number): number {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
}

/** Smooth in and out, with no sudden change of speed at either end. */
export function smootherstep(x: number): number {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
