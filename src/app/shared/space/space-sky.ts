import { afterNextRender, Component, DestroyRef, DOCUMENT, ElementRef, inject } from '@angular/core';
import { PastaPlanet } from './pasta-planet';

interface Star {
  /** Position as a fraction of the sky. */
  x: number;
  y: number;
  r: number;
  layer: 0 | 1 | 2;
  speed: number;
  phase: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const COLORS = ['#ffffff', '#fff3cb', '#ffd9a8', '#cfe3ff'];
/** Parallax depth (px at the edge of the screen) and drift (px/s) per layer. */
const DEPTH = [6, 14, 28];
const DRIFT = [2, 5, 10];
const METEOR_LIFE = 0.9;

/**
 * Deep-space background of the welcome hero: three layers of twinkling stars
 * with parallax (mouse or phone tilt), shooting stars and pasta planets.
 */
@Component({
  selector: 'app-space-sky',
  imports: [PastaPlanet],
  templateUrl: './space-sky.html',
  styleUrl: './space-sky.css',
  host: { 'aria-hidden': 'true' },
})
export class SpaceSky {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly still = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  private ctx: CanvasRenderingContext2D | null = null;
  private stars: Star[] = [];
  private meteor: Meteor | null = null;
  private width = 0;
  private height = 0;
  private drift = 0;
  private tilt = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private visible = true;
  private frame = 0;
  private last = 0;
  private nextMeteor = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.start()));
  }

  private start(): () => void {
    const canvas = this.host.querySelector('canvas')!;
    this.ctx = canvas.getContext('2d');
    const resize = (): void => {
      this.width = this.host.clientWidth;
      this.height = this.host.clientHeight;
      const dpr = Math.min(this.window?.devicePixelRatio ?? 1, 2);
      canvas.width = Math.round(this.width * dpr);
      canvas.height = Math.round(this.height * dpr);
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.stars = makeStars(this.width, this.height);
      if (this.still) this.draw(0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(this.host);
    if (this.still) return () => resizeObserver.disconnect();

    const intersection = new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting));
    intersection.observe(this.host);
    const onPointer = (e: PointerEvent): void => {
      this.target = { x: e.clientX / (this.window?.innerWidth || 1) - 0.5, y: e.clientY / (this.window?.innerHeight || 1) - 0.5 };
    };
    const onTilt = (e: DeviceOrientationEvent): void => {
      if (e.gamma === null || e.beta === null) return;
      this.target = { x: clamp(e.gamma / 45, -0.5, 0.5), y: clamp((e.beta - 45) / 45, -0.5, 0.5) };
    };
    this.window?.addEventListener('pointermove', onPointer, { passive: true });
    this.window?.addEventListener('deviceorientation', onTilt, { passive: true });
    this.nextMeteor = performance.now() + 2500;
    this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;

    return () => {
      this.window?.cancelAnimationFrame(this.frame);
      this.window?.removeEventListener('pointermove', onPointer);
      this.window?.removeEventListener('deviceorientation', onTilt);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }

  private tick(now: number): void {
    this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.visible || this.host.ownerDocument.hidden) return;

    this.drift += dt;
    this.tilt.x += (this.target.x - this.tilt.x) * Math.min(1, dt * 3);
    this.tilt.y += (this.target.y - this.tilt.y) * Math.min(1, dt * 3);
    if (!this.meteor && now > this.nextMeteor) this.launchMeteor();
    if (this.meteor) {
      this.meteor.life += dt;
      this.meteor.x += this.meteor.vx * dt;
      this.meteor.y += this.meteor.vy * dt;
      if (this.meteor.life > METEOR_LIFE) {
        this.meteor = null;
        this.nextMeteor = now + 3500 + Math.random() * 5000;
      }
    }
    this.draw(now / 1000);
  }

  private draw(time: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const s of this.stars) {
      const x = mod(s.x * this.width + this.drift * DRIFT[s.layer] + this.tilt.x * DEPTH[s.layer], this.width);
      const y = mod(s.y * this.height + this.tilt.y * DEPTH[s.layer], this.height);
      const alpha = this.still ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      if (s.r < 1.1) {
        ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.8) {
        // Four-point sparkle on the brightest stars.
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillRect(x - s.r * 4, y - 0.5, s.r * 8, 1);
        ctx.fillRect(x - 0.5, y - s.r * 4, 1, s.r * 8);
      }
    }
    const m = this.meteor;
    if (m) {
      const fade = 1 - m.life / METEOR_LIFE;
      const tail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.16, m.y - m.vy * 0.16);
      tail.addColorStop(0, `rgb(255 244 214 / ${fade})`);
      tail.addColorStop(1, 'rgb(255 180 90 / 0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 0.16, m.y - m.vy * 0.16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private launchMeteor(): void {
    const toLeft = Math.random() < 0.5;
    const speed = 700 + Math.random() * 400;
    const angle = ((20 + Math.random() * 18) * Math.PI) / 180;
    this.meteor = {
      x: this.width * (toLeft ? 0.5 + Math.random() * 0.5 : Math.random() * 0.5),
      y: this.height * Math.random() * 0.35,
      vx: Math.cos(angle) * speed * (toLeft ? -1 : 1),
      vy: Math.sin(angle) * speed,
      life: 0,
    };
  }
}

function makeStars(width: number, height: number): Star[] {
  const count = Math.round(clamp((width * height) / 2600, 80, 420));
  return Array.from({ length: count }, () => {
    const roll = Math.random();
    const layer = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
    const [min, max] = [
      [0.5, 0.9],
      [0.9, 1.4],
      [1.4, 2.3],
    ][layer];
    return {
      x: Math.random(),
      y: Math.random(),
      r: min + Math.random() * (max - min),
      layer,
      speed: 0.6 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    } as Star;
  });
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
