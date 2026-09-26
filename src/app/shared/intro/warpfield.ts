interface Star {
  x: number;
  y: number;
  /** Depth: 1 far away, → 0 passing by the camera. */
  z: number;
  color: string;
}

const COUNT = 320;
const COLORS = ['#ffffff', '#fff3cb', '#ffd9a8', '#cfe3ff'];
/** Depth travelled per second at speed 1. */
const CRUISE = 0.08;

/**
 * 3D starfield flying towards the viewer. At high speed the stars stretch into
 * lines: the jump to hyperspace.
 */
export class Warpfield {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly stars: Star[];
  private frame = 0;
  private last = 0;
  private speed = 0;
  private width = 0;
  private height = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly targetSpeed: () => number,
  ) {
    this.ctx = canvas.getContext('2d');
    this.stars = Array.from({ length: COUNT }, () => newStar(Math.random()));
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
  }

  private tick(now: number): void {
    this.frame = requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.resize();
    const ctx = this.ctx;
    if (!ctx) return;

    // Ease towards the stage's speed: the jump builds up and brakes smoothly.
    this.speed += (this.targetSpeed() - this.speed) * Math.min(1, dt * 2.5);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const focal = Math.min(this.width, this.height) * 0.6;
    const step = CRUISE * this.speed * dt;
    const streak = Math.min(0.3, step * 4 + 0.002);

    ctx.fillStyle = 'rgb(10 8 24 / 55%)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.lineCap = 'round';
    for (const star of this.stars) {
      star.z -= step;
      if (star.z <= 0.02) Object.assign(star, newStar(1));
      const x = cx + (star.x / star.z) * focal;
      const y = cy + (star.y / star.z) * focal;
      const tailZ = Math.min(1, star.z + streak);
      const tx = cx + (star.x / tailZ) * focal;
      const ty = cy + (star.y / tailZ) * focal;
      const near = 1 - star.z;
      ctx.globalAlpha = Math.min(1, near * 1.4);
      ctx.strokeStyle = star.color;
      ctx.lineWidth = 0.6 + near * 2.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function newStar(z: number): Star {
  return {
    x: (Math.random() - 0.5) * 2.4,
    y: (Math.random() - 0.5) * 2.4,
    z,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}
