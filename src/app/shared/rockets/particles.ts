type Kind = 'smoke' | 'spark' | 'pasta' | 'ring' | 'flash';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  grow: number;
  life: number;
  max: number;
  color: string;
  alpha: number;
  rot: number;
  spin: number;
  gravity: number;
}

const MAX_PARTICLES = 700;
const PASTA = ['#f7d48f', '#eaaa5b', '#f2c16b', '#e9b36a'];

/** Smoke trails, sparks and exploding macaroni, drawn on one canvas. */
export class ParticleField {
  private readonly items: Particle[] = [];

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  get count(): number {
    return this.items.length;
  }

  /** Puff of the engine trail, tinted with the pilot's colour now and then. */
  trail(x: number, y: number, color: string, dark = false): void {
    this.add({
      kind: 'smoke', x: x + jitter(3), y: y + jitter(3), vx: jitter(14), vy: jitter(14) - 6,
      size: dark ? 7 : 5, grow: dark ? 26 : 18, max: dark ? 1.3 : 0.9,
      color: dark ? '#3a3340' : Math.random() < 0.3 ? color : '#fff4e2', alpha: dark ? 0.55 : 0.42,
    });
    if (Math.random() < (dark ? 0.7 : 0.45)) {
      this.add({
        kind: 'spark', x, y, vx: jitter(60), vy: jitter(60), size: 2 + Math.random() * 2, grow: 0,
        max: 0.35 + Math.random() * 0.3, color: Math.random() < 0.5 ? '#ffb347' : color, alpha: 1,
      });
    }
  }

  /** Little "pow" where the rocket was tapped. */
  hit(x: number, y: number): void {
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, size: 6, grow: 150, max: 0.35, color: '#fff2cc', alpha: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.add({
        kind: 'spark', x, y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, size: 3, grow: 0, max: 0.3,
        color: '#ffe27a', alpha: 1,
      });
    }
  }

  /** Crash: flash, shock ring, flying macaroni pieces, sparks and smoke. */
  explode(x: number, y: number, color: string): void {
    this.add({ kind: 'flash', x, y, vx: 0, vy: 0, size: 20, grow: 260, max: 0.28, color: '#fff6d8', alpha: 0.95 });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, size: 10, grow: 320, max: 0.5, color: '#ffb347', alpha: 0.9 });
    for (let i = 0; i < 18; i++) {
      this.add({
        kind: 'pasta', x, y, vx: jitter(340), vy: -140 - Math.random() * 420, size: 9 + Math.random() * 6, grow: 0,
        max: 1.4 + Math.random() * 0.6, color: PASTA[i % PASTA.length], alpha: 1, spin: jitter(14), gravity: 1100,
      });
    }
    for (let i = 0; i < 26; i++) {
      this.add({
        kind: 'spark', x, y, vx: jitter(420), vy: jitter(420), size: 2 + Math.random() * 3, grow: 0,
        max: 0.5 + Math.random() * 0.5, color: i % 3 ? '#ffb347' : color, alpha: 1, gravity: 500,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.add({
        kind: 'smoke', x: x + jitter(20), y: y + jitter(12), vx: jitter(60), vy: -30 - Math.random() * 50,
        size: 14, grow: 40, max: 1.6, color: '#40384a', alpha: 0.5,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(): void {
    const ctx = this.ctx;
    for (const p of this.items) {
      const fade = 1 - p.life / p.max;
      ctx.globalAlpha = p.alpha * fade;
      switch (p.kind) {
        case 'smoke':
        case 'flash':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'spark':
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * fade + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'pasta':
          drawMacaroni(ctx, p);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y' | 'max' | 'color'>): void {
    if (this.items.length >= MAX_PARTICLES) this.items.shift();
    this.items.push({ vx: 0, vy: 0, size: 4, grow: 0, alpha: 1, rot: Math.random() * 6, spin: 0, gravity: 0, life: 0, ...p });
  }
}

function drawMacaroni(ctx: CanvasRenderingContext2D, p: Particle): void {
  const w = p.size;
  const h = p.size * 0.45;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = '#a85b39';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a3322';
  ctx.beginPath();
  ctx.ellipse(w / 2 - 1, 0, 1.4, h / 2 - 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function jitter(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}
