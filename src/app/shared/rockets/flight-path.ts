export interface Point {
  x: number;
  y: number;
}

const SAMPLES = 160;

/**
 * Cubic Bézier sampled by arc length, so rockets move at a steady speed and
 * can ask for their position and heading at any travelled distance.
 */
export class FlightPath {
  private readonly points: Point[] = [];
  private readonly lengths: number[] = [0];
  readonly length: number;

  constructor(p0: Point, p1: Point, p2: Point, p3: Point) {
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const u = 1 - t;
      this.points.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
      if (i > 0) {
        const a = this.points[i - 1];
        const b = this.points[i];
        this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
      }
    }
    this.length = this.lengths[SAMPLES];
  }

  /** Position and heading (radians) after travelling `distance` px. */
  at(distance: number): { point: Point; angle: number } {
    const d = Math.min(Math.max(distance, 0), this.length);
    let lo = 0;
    let hi = SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.lengths[mid] < d) lo = mid;
      else hi = mid;
    }
    const a = this.points[lo];
    const b = this.points[hi];
    const span = this.lengths[hi] - this.lengths[lo] || 1;
    const f = (d - this.lengths[lo]) / span;
    return {
      point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
}

/**
 * Random path crossing a W×H area from one side to the other, starting and
 * ending `margin` px outside, within the vertical `band` (fractions of H).
 * Sometimes it loops the loop.
 */
export function randomFlightPath(
  width: number,
  height: number,
  margin: number,
  direction: 1 | -1,
  band: readonly [number, number] = [0, 1],
): FlightPath {
  const x = (fraction: number): number =>
    direction > 0 ? -margin + fraction * (width + 2 * margin) : width + margin - fraction * (width + 2 * margin);
  const y = (min: number, max: number): number =>
    height * (band[0] + (band[1] - band[0]) * (min + Math.random() * (max - min)));
  const loop = width > 480 && Math.random() < 0.22;

  const start = { x: x(0), y: y(0.12, 0.88) };
  const end = { x: x(1), y: y(0.12, 0.88) };
  if (loop) {
    // Control points swapped along the travel direction: the curve crosses itself.
    const top = y(0.05, 0.3);
    return new FlightPath(start, { x: x(0.95), y: top }, { x: x(0.05), y: top }, end);
  }
  return new FlightPath(
    start,
    { x: x(0.2 + Math.random() * 0.2), y: y(0.02, 0.98) },
    { x: x(0.6 + Math.random() * 0.2), y: y(0.02, 0.98) },
    end,
  );
}
