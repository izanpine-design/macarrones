/** What the scene should look like this frame (the show's director decides). */
export interface SceneFrame {
  /** Seconds into the show (negative while waiting on the launch pad). */
  t: number;
  dt: number;
  /** How far (px) the camera has risen since liftoff: the ground and smoke drop away. */
  camera: number;
  /** Forward speed through the stars: 1 cruising, 25 hyperspace. */
  speed: number;
  /** 0–1: the fusilli tunnel of hyperspace. */
  tunnel: number;
  /** 0–1: light growing at the vanishing point before arrival. */
  glow: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  color: string;
  sx: number;
  sy: number;
  fresh: boolean;
}

interface Ring {
  z: number;
  color: string;
  turn: 1 | -1;
}

type BitKind = 'smoke' | 'spark' | 'pasta' | 'paper';

interface Bit {
  kind: BitKind;
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
  drag: number;
}

interface Crater {
  x: number;
  depth: number;
  r: number;
}

const STAR_COLORS = ['#ffffff', '#fff3cb', '#ffd9a8', '#cfe3ff'];
const PASTA = ['#f7d48f', '#eaaa5b', '#f2c16b', '#e9b36a'];
const RING_COLORS = ['#f7d48f', '#eaaa5b', '#e2412c', '#fff2cc', '#3fae4f', '#ffcf75'];
const SMOKE = ['#f3ede4', '#ddd4c8', '#c8beb2', '#fff8ee'];
const PAPER = ['#e8589a', '#3f82ea', '#2eab6e', '#f08a24', '#ffcf3d', '#8a5cff', '#e2412c'];
const MAX_BITS = 900;
/** Depth where the tunnel's rings appear (small, far away). */
const RING_FAR = 4;

/**
 * Everything of the presentation that is painted rather than a component, on
 * one canvas: 3D starfield (streaking in hyperspace), the Parmesan moon with
 * the launch pad and searchlights, smoke, the rockets' coloured air-show
 * trails, the fusilli tunnel and the macaroni confetti.
 */
export class IntroScene {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly stars: Star[];
  private readonly rings: Ring[] = [];
  private readonly bits: Bit[] = [];
  private craters: Crater[] = [];
  private width = 0;
  private height = 0;
  private lastCamera = 0;
  private ringClock = 0;
  private ringCount = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    /** Reduced motion: fewer particles. */
    private readonly calm = false,
  ) {
    this.ctx = canvas.getContext('2d');
    this.stars = Array.from({ length: 280 }, () => newStar(0.05 + Math.random() * 0.95));
  }

  /** Engine exhaust: smoke in the pilot's colour (an air-show trail) and sparks. */
  exhaust(x: number, y: number, angle: number, color: string, power = 1): void {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const puffs = this.calm ? 1 : Math.max(1, Math.round(2 * power));
    for (let i = 0; i < puffs; i++) {
      const speed = 50 + Math.random() * 90;
      this.add({
        kind: 'smoke', x: x + jitter(3), y: y + jitter(3), vx: dx * speed + jitter(18), vy: dy * speed + jitter(18),
        size: 5 + Math.random() * 3, grow: 20 + Math.random() * 16, max: 1 + Math.random() * 0.6,
        color: Math.random() < 0.65 ? color : '#fff4e2', alpha: 0.5, drag: 1.4,
      });
    }
    if (Math.random() < 0.6 * power) {
      const speed = 160 + Math.random() * 180;
      this.add({
        kind: 'spark', x, y, vx: dx * speed + jitter(60), vy: dy * speed + jitter(60), size: 2 + Math.random() * 2,
        max: 0.25 + Math.random() * 0.25, color: Math.random() < 0.5 ? '#ffb347' : '#fff2a8', alpha: 1,
      });
    }
  }

  /** Billowing clouds rolling out along the launch pad. */
  groundSmoke(x: number, y: number, power: number): void {
    const count = this.calm ? 1 : Math.max(1, Math.round(power * 2));
    for (let i = 0; i < count; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.add({
        kind: 'smoke', x: x + jitter(20), y: y + jitter(6), vx: side * (60 + Math.random() * 260 * power),
        vy: -(10 + Math.random() * 60), size: 10 + Math.random() * 14, grow: 30 + Math.random() * 50 * power,
        max: 1.8 + Math.random() * 1.6, color: SMOKE[Math.floor(Math.random() * SMOKE.length)], alpha: 0.6, drag: 0.9,
      });
    }
  }

  /** A burst of macaroni and paper confetti. */
  confetti(x: number, y: number, count: number): void {
    for (let i = 0; i < (this.calm ? count / 3 : count); i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 220 + Math.random() * 620;
      const pasta = i % 3 === 0;
      this.add({
        kind: pasta ? 'pasta' : 'paper', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 220,
        size: pasta ? 12 + Math.random() * 8 : 7 + Math.random() * 6, max: 2.4 + Math.random() * 1.2,
        color: pasta ? PASTA[i % PASTA.length] : PAPER[i % PAPER.length], alpha: 1,
        spin: jitter(12), gravity: 520, drag: 0.8,
      });
    }
  }

  /** Confetti drifting down from the top of the screen. */
  rain(count: number): void {
    for (let i = 0; i < count; i++) {
      const pasta = Math.random() < 0.35;
      this.add({
        kind: pasta ? 'pasta' : 'paper', x: Math.random() * this.width, y: -20, vx: jitter(40), vy: 60 + Math.random() * 120,
        size: pasta ? 11 + Math.random() * 6 : 6 + Math.random() * 6, max: 4 + Math.random() * 2,
        color: pasta ? PASTA[i % PASTA.length] : PAPER[Math.floor(Math.random() * PAPER.length)], alpha: 1,
        spin: jitter(8), gravity: 40, drag: 0.2,
      });
    }
  }

  render(frame: SceneFrame): void {
    this.resize();
    const ctx = this.ctx;
    if (!ctx) return;
    const rise = frame.camera - this.lastCamera;
    this.lastCamera = frame.camera;
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawStars(ctx, frame, rise);
    this.drawTunnel(ctx, frame);
    this.drawGlow(ctx, frame.glow);
    this.drawSearchlights(ctx, frame);
    this.drawGround(ctx, frame);
    this.updateBits(frame.dt, rise, frame.speed);
    this.drawBits(ctx);
  }

  private drawStars(ctx: CanvasRenderingContext2D, frame: SceneFrame, rise: number): void {
    const { width: w, height: h } = this;
    const focal = Math.min(w, h) * 0.6;
    const cx = w / 2;
    const cy = h * 0.45;
    const forward = 0.08 * frame.speed * frame.dt;
    // The camera going up: near stars slide down past it faster than far ones.
    const lift = (rise / focal) * 0.35;
    const maxStreak = h * 0.4;
    ctx.lineCap = 'round';
    for (const star of this.stars) {
      star.z -= forward;
      star.y += lift;
      if (star.z <= 0.03) Object.assign(star, newStar(1));
      let x = cx + (star.x / star.z) * focal;
      let y = cy + (star.y / star.z) * focal;
      if (y > h + 40) {
        star.y -= ((h + 80) / focal) * star.z;
        y = cy + (star.y / star.z) * focal;
        star.fresh = true;
      }
      if (star.fresh) {
        star.sx = x;
        star.sy = y;
        star.fresh = false;
      }
      let tx = star.sx;
      let ty = star.sy;
      const length = Math.hypot(x - tx, y - ty);
      if (length > maxStreak) {
        tx = x - ((x - tx) / length) * maxStreak;
        ty = y - ((y - ty) / length) * maxStreak;
      }
      const near = 1 - star.z;
      ctx.globalAlpha = Math.min(1, 0.25 + near * 1.3);
      ctx.strokeStyle = star.color;
      ctx.lineWidth = 0.7 + near * 2.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
      star.sx = x;
      star.sy = y;
      if (x < -w || x > 2 * w) Object.assign(star, newStar(1));
    }
    ctx.globalAlpha = 1;
  }

  /** Hyperspace: rings of pasta colours rushing past, dashed so they seem to twist like fusilli. */
  private drawTunnel(ctx: CanvasRenderingContext2D, frame: SceneFrame): void {
    const { width: w, height: h } = this;
    if (frame.tunnel > 0) {
      // The tunnel opens already full, from far away right up to the camera.
      if (this.ringCount === 0) {
        for (let z = 0.3; z < RING_FAR; z += 0.13) this.rings.push(this.ring(z));
      }
      this.ringClock += frame.dt;
      while (this.ringClock > 0.045) {
        this.ringClock -= 0.045;
        this.rings.push(this.ring(RING_FAR));
      }
    }
    if (this.rings.length === 0) return;
    const focal = Math.min(w, h) * 0.6;
    const cx = w / 2;
    const cy = h * 0.45;
    const reach = Math.max(w, h) * 1.6;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.z -= 0.13 * Math.max(frame.speed, 16) * frame.dt;
      const r = (0.62 / Math.max(ring.z, 0.01)) * focal;
      if (ring.z <= 0.02 || r > reach) {
        this.rings.splice(i, 1);
        continue;
      }
      // Fading in far away, out as they rush past the camera.
      const fade = Math.min(1, (RING_FAR - ring.z) * 1.5) * Math.min(1, ring.z * 5);
      ctx.globalAlpha = frame.tunnel * fade * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.min(26, 1.5 + 5 / ring.z);
      ctx.setLineDash([r * 0.24, r * 0.1]);
      ctx.lineDashOffset = ring.turn * frame.t * r * 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private ring(z: number): Ring {
    const n = this.ringCount++;
    return { z, color: RING_COLORS[n % RING_COLORS.length], turn: n % 2 ? 1 : -1 };
  }

  private drawGlow(ctx: CanvasRenderingContext2D, glow: number): void {
    if (glow <= 0) return;
    const { width: w, height: h } = this;
    const r = (0.04 + glow * 0.55) * Math.min(w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, r);
    g.addColorStop(0, 'rgba(255, 255, 245, 1)');
    g.addColorStop(0.3, 'rgba(255, 220, 150, 0.7)');
    g.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.globalAlpha = Math.min(1, glow * 1.4);
    ctx.fillStyle = g;
    ctx.fillRect(w / 2 - r, h * 0.45 - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /** Two beams sweeping the sky from the launch site. */
  private drawSearchlights(ctx: CanvasRenderingContext2D, frame: SceneFrame): void {
    const { width: w, height: h } = this;
    const base = h * 0.8 + frame.camera;
    if (base > h * 1.6) return;
    for (const side of [-1, 1]) {
      const x = w / 2 + side * Math.min(w * 0.42, 460);
      const swing = side * 0.35 + Math.sin(frame.t * 0.7 + side) * 0.32;
      ctx.save();
      ctx.translate(x, base);
      ctx.rotate(swing);
      const g = ctx.createLinearGradient(0, 0, 0, -h);
      g.addColorStop(0, 'rgba(255, 244, 214, 0.28)');
      g.addColorStop(1, 'rgba(255, 244, 214, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-h * 0.14, -h * 1.1);
      ctx.lineTo(h * 0.14, -h * 1.1);
      ctx.lineTo(6, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The Parmesan moon's horizon with the launch pad, gantries and blinking lights. */
  private drawGround(ctx: CanvasRenderingContext2D, frame: SceneFrame): void {
    const { width: w, height: h } = this;
    const horizon = h * 0.8 + frame.camera;
    if (horizon > h + 60) return;
    const radius = Math.max(w, h) * 1.8;
    const cx = w / 2;
    const cy = horizon + radius;

    const haze = ctx.createLinearGradient(0, horizon - h * 0.25, 0, horizon);
    haze.addColorStop(0, 'rgba(255, 190, 110, 0)');
    haze.addColorStop(1, 'rgba(255, 190, 110, 0.3)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - h * 0.25, w, h * 0.25);

    const moon = ctx.createRadialGradient(cx, horizon + h * 0.05, 10, cx, cy, radius);
    moon.addColorStop(0, '#f8e19a');
    moon.addColorStop(0.06, '#ebc86e');
    moon.addColorStop(0.18, '#c9994a');
    moon.addColorStop(1, '#8a6128');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Holes of the cheese.
    for (const crater of this.craters) {
      const x = crater.x * w;
      const y = horizon + crater.depth;
      const drop = Math.hypot(x - cx, y - cy) - radius;
      if (drop > -crater.r * 0.4) continue;
      ctx.fillStyle = 'rgba(140, 96, 34, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, crater.r, crater.r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 190, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + crater.r * 0.12, crater.r * 0.8, crater.r * 0.2, 0, 0, Math.PI);
      ctx.fill();
    }

    // Launch deck with hazard stripes.
    const deckW = Math.min(w * 0.94, 940);
    const x0 = (w - deckW) / 2;
    const deckY = horizon - 8;
    ctx.fillStyle = '#3b3346';
    ctx.fillRect(x0, deckY, deckW, 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, deckY, deckW, 6);
    ctx.clip();
    for (let x = x0 - 12, n = 0; x < x0 + deckW + 12; x += 12, n++) {
      ctx.fillStyle = n % 2 ? '#1d1626' : '#ffcf3d';
      ctx.beginPath();
      ctx.moveTo(x, deckY);
      ctx.lineTo(x + 12, deckY);
      ctx.lineTo(x + 6, deckY + 6);
      ctx.lineTo(x - 6, deckY + 6);
      ctx.fill();
    }
    ctx.restore();

    // Gantry towers, with a beacon on top.
    const tower = Math.min(h * 0.24, 190);
    for (const x of [x0 + 26, x0 + deckW - 26]) {
      ctx.strokeStyle = '#6d6378';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, deckY);
      ctx.lineTo(x - 10, deckY - tower);
      ctx.moveTo(x + 10, deckY);
      ctx.lineTo(x + 10, deckY - tower);
      for (let y = deckY; y > deckY - tower + 14; y -= 18) {
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y - 18);
        ctx.moveTo(x + 10, y);
        ctx.lineTo(x - 10, y - 18);
      }
      ctx.stroke();
      const on = Math.floor(frame.t * 2 + (x > w / 2 ? 1 : 0)) % 2 === 0;
      ctx.fillStyle = on ? '#ff4d3d' : '#6a2020';
      ctx.beginPath();
      ctx.arc(x, deckY - tower - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(x, deckY - tower - 6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Runway lights running along the deck.
    const step = 34;
    const running = Math.floor(frame.t * 10);
    for (let i = 0, x = x0 + 50; x < x0 + deckW - 40; x += step, i++) {
      const lit = (i + running) % 6 === 0;
      ctx.fillStyle = lit ? '#fff2a8' : i % 2 ? '#3fae4f' : '#e2412c';
      ctx.globalAlpha = lit ? 1 : 0.55;
      ctx.beginPath();
      ctx.arc(x, deckY + 11, lit ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private updateBits(dt: number, rise: number, speed: number): void {
    // In hyperspace everything left behind is flung out from the vanishing point.
    const warp = Math.max(0, speed - 3) * 0.15;
    const cx = this.width / 2;
    const cy = this.height * 0.45;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const bit = this.bits[i];
      if (warp) {
        bit.vx += (bit.x - cx) * warp * dt;
        bit.vy += (bit.y - cy) * warp * dt;
      }
      bit.life += dt;
      if (bit.life >= bit.max) {
        this.bits.splice(i, 1);
        continue;
      }
      const keep = Math.exp(-bit.drag * dt);
      bit.vx *= keep;
      bit.vy = bit.vy * keep + bit.gravity * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt + rise;
      bit.size += bit.grow * dt;
      bit.rot += bit.spin * dt;
    }
  }

  private drawBits(ctx: CanvasRenderingContext2D): void {
    for (const bit of this.bits) {
      const fade = 1 - bit.life / bit.max;
      ctx.globalAlpha = bit.alpha * (bit.kind === 'smoke' ? fade : Math.min(1, fade * 3));
      switch (bit.kind) {
        case 'smoke':
          ctx.fillStyle = bit.color;
          ctx.beginPath();
          ctx.arc(bit.x, bit.y, bit.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'spark':
          ctx.fillStyle = bit.color;
          ctx.fillRect(bit.x - bit.size / 2, bit.y - bit.size / 2, bit.size, bit.size);
          break;
        case 'pasta':
          drawMacaroni(ctx, bit);
          break;
        case 'paper': {
          // Tumbling: it narrows and widens as it turns over.
          const flip = Math.cos(bit.rot * 1.7);
          ctx.save();
          ctx.translate(bit.x, bit.y);
          ctx.rotate(bit.rot);
          ctx.fillStyle = bit.color;
          ctx.fillRect((-bit.size / 2) * flip, -bit.size / 4, bit.size * flip, bit.size / 2);
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private add(bit: Partial<Bit> & Pick<Bit, 'kind' | 'x' | 'y' | 'max' | 'color'>): void {
    if (this.bits.length >= MAX_BITS) this.bits.shift();
    this.bits.push({
      vx: 0, vy: 0, size: 4, grow: 0, alpha: 1, rot: Math.random() * 6, spin: 0, gravity: 0, drag: 0, life: 0, ...bit,
    });
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
    // Cheese holes scattered over the visible band of the moon.
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    this.craters = Array.from({ length: 18 }, () => ({
      x: random(),
      depth: 18 + random() * height * 0.2,
      r: 10 + random() * 34,
    }));
  }
}

/** An elbow macaroni: a curved tube with a dark hole at one end. */
function drawMacaroni(ctx: CanvasRenderingContext2D, bit: Bit): void {
  const r = bit.size * 0.5;
  ctx.save();
  ctx.translate(bit.x, bit.y);
  ctx.rotate(bit.rot);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a85b39';
  ctx.lineWidth = r * 0.9 + 2.5;
  ctx.beginPath();
  ctx.arc(0, r * 0.6, r, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.strokeStyle = bit.color;
  ctx.lineWidth = r * 0.9;
  ctx.stroke();
  ctx.fillStyle = '#5a3322';
  const end = Math.PI * 1.85;
  ctx.beginPath();
  ctx.ellipse(Math.cos(end) * r, r * 0.6 + Math.sin(end) * r, r * 0.22, r * 0.34, end, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function newStar(z: number): Star {
  return {
    x: (Math.random() - 0.5) * 2.4,
    y: (Math.random() - 0.5) * 2.4,
    z,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    sx: 0,
    sy: 0,
    fresh: true,
  };
}

function jitter(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}
