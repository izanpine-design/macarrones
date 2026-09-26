import { afterNextRender, Component, DestroyRef, DOCUMENT, ElementRef, inject, signal } from '@angular/core';
import { CREW, CrewMember } from '../crew/crew';
import { PetService } from '../pets/pet.service';
import { Pet, PET_BY_ID } from '../pets/pets';
import { SfxService } from '../sfx/sfx.service';
import { FlightPath, Point, randomFlightPath } from './flight-path';
import { ParticleField } from './particles';
import { RocketShip, ShipMode } from './rocket-ship';

/** Size of the rocket drawing (viewBox of RocketShip). */
const ART_W = 240;
const ART_H = 150;
/** Points of the drawing: engine exhaust and the pet's seat. */
const EXHAUST: Point = { x: 44, y: 92 };
const PET_SEAT: Point = { x: 80, y: 58 };
/** Chance that a tapped rocket dodges and shows you the finger. */
const DODGE_CHANCE = 0.1;
const GRAVITY = 1250;
const ROLL_MS = 650;
const MOBILE_BAND = [0.04, 0.4] as const;
const TAUNT_MS = 1100;

interface ShipView {
  rid: number;
  crew: CrewMember;
  pet: Pet | null;
  mode: ShipMode;
  flipped: boolean;
}

interface Flight {
  rid: number;
  crew: CrewMember;
  pet: Pet | null;
  el: HTMLElement | null;
  w: number;
  h: number;
  path: FlightPath;
  dir: 1 | -1;
  speed: number;
  boost: number;
  dist: number;
  falling: boolean;
  x: number;
  y: number;
  /** Degrees. */
  rot: number;
  /** Vertical scale: -1..1 during the dodge barrel roll. */
  roll: number;
  vx: number;
  vy: number;
  spin: number;
  /** Sideways offset from the path (dodges push it away from your finger). */
  offset: number;
  dodge: { at: number; from: number; to: number } | null;
  /** Travelled distance at which the pet jumps off, or -1. */
  dropAt: number;
  phase: number;
}

/**
 * Macaroni rockets crossing the welcome hero at random: each crew member in
 * turn, riding with their pet until it parachutes down. Tap one to shoot it
 * down… unless it dodges.
 */
@Component({
  selector: 'app-rocket-sky',
  imports: [RocketShip],
  template: `
    <canvas class="sky__trail"></canvas>
    @for (ship of ships(); track ship.rid) {
      <div class="sky__ship" [attr.data-rid]="ship.rid" (pointerdown)="hit(ship.rid, $event)">
        <app-rocket-ship [crew]="ship.crew" [pet]="ship.pet" [mode]="ship.mode" [flipped]="ship.flipped" [uid]="ship.rid" />
      </div>
    }
  `,
  styleUrl: './rocket-sky.css',
  host: { 'aria-hidden': 'true' },
})
export class RocketSky {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly petService = inject(PetService);
  private readonly sfx = inject(SfxService);

  protected readonly ships = signal<ShipView[]>([]);

  private readonly flights = new Map<number, Flight>();
  private particles: ParticleField | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private visible = true;
  private frame = 0;
  private last = 0;
  private nextSpawn = 0;
  private nextId = 1;
  private bag: CrewMember[] = [];
  private readonly timers = new Set<number>();
  private readonly still = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor() {
    this.petService.skyOpened();
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const cleanup = this.start();
      destroyRef.onDestroy(cleanup);
    });
    destroyRef.onDestroy(() => this.petService.skyClosed());
  }

  protected hit(rid: number, event: PointerEvent): void {
    const f = this.flights.get(rid);
    if (!f || f.falling || this.still) return;
    event.stopPropagation();
    const now = performance.now();
    if (f.dodge && now - f.dodge.at < ROLL_MS + TAUNT_MS) return; // Showing off: untouchable.

    const rect = this.host.getBoundingClientRect();
    this.particles?.hit(event.clientX - rect.left, event.clientY - rect.top);
    this.sfx.play('hit');
    this.vibrate(25);

    if (Math.random() < DODGE_CHANCE) {
      this.dodge(f, event.clientX - rect.left, event.clientY - rect.top, now);
    } else {
      this.shootDown(f);
    }
  }

  private start(): () => void {
    const canvas = this.host.querySelector('canvas')!;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) this.particles = new ParticleField(this.ctx);

    const resize = (): void => {
      this.width = this.host.clientWidth;
      this.height = this.host.clientHeight;
      const dpr = Math.min(this.window?.devicePixelRatio ?? 1, 2);
      canvas.width = Math.round(this.width * dpr);
      canvas.height = Math.round(this.height * dpr);
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(this.host);
    const intersection = new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting));
    intersection.observe(this.host);

    if (this.still) {
      this.petService.landAll();
      this.showParked();
    } else {
      this.nextSpawn = performance.now() + 500;
      this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
    }

    return () => {
      this.window?.cancelAnimationFrame(this.frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      this.timers.forEach((id) => this.window?.clearTimeout(id));
    };
  }

  private tick(now: number): void {
    this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.visible || this.host.ownerDocument.hidden) return;

    if (now >= this.nextSpawn) {
      this.spawn();
      this.nextSpawn = now + 1500 + Math.random() * 1900;
    }
    for (const f of this.flights.values()) {
      if (f.falling) this.updateFall(f, dt);
      else this.updateFlight(f, now, dt);
    }
    if (this.particles && this.ctx) {
      this.particles.update(dt);
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.particles.draw();
    }
  }

  private spawn(): void {
    const small = this.width < 600;
    const flying = [...this.flights.values()].filter((f) => !f.falling);
    if (flying.length >= (small ? 2 : 3) || this.width === 0) return;

    const crew = this.nextCrew(new Set(flying.map((f) => f.crew.id)));
    if (!crew) return;
    const w = small ? 132 : 190;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    // On phones the nickname card fills the middle: fly over the title instead.
    const path = randomFlightPath(this.width, this.height, w, dir, small ? MOBILE_BAND : [0, 1]);
    const pet = this.petService.isAboard(crew.mascota) ? (PET_BY_ID.get(crew.mascota) ?? null) : null;
    const flight: Flight = {
      rid: this.nextId++,
      crew,
      pet,
      el: null,
      w,
      h: (w * ART_H) / ART_W,
      path,
      dir,
      speed: small ? 115 + Math.random() * 50 : 160 + Math.random() * 80,
      boost: 1,
      dist: 0,
      falling: false,
      x: -9999,
      y: -9999,
      rot: 0,
      roll: 1,
      vx: 0,
      vy: 0,
      spin: 0,
      offset: 0,
      dodge: null,
      dropAt: pet ? path.length * (0.3 + Math.random() * 0.3) : -1,
      phase: Math.random() * 10,
    };
    this.flights.set(flight.rid, flight);
    this.ships.update((ships) => [...ships, { rid: flight.rid, crew, pet, mode: 'fly', flipped: dir < 0 }]);
  }

  /** Crew members come out in random order, everybody once before repeating. */
  private nextCrew(busy: Set<string>): CrewMember | null {
    for (let tries = 0; tries < CREW.length * 2; tries++) {
      if (this.bag.length === 0) this.bag = shuffle([...CREW]);
      const crew = this.bag.pop()!;
      if (!busy.has(crew.id)) return crew;
      this.bag.unshift(crew);
    }
    return null;
  }

  private updateFlight(f: Flight, now: number, dt: number): void {
    f.dist += f.speed * f.boost * dt;
    if (f.dist >= f.path.length) {
      this.remove(f);
      return;
    }
    const { point, angle } = f.path.at(f.dist);
    if (f.dodge) {
      // Barrel roll, then hover a second to show the finger, then zoom off.
      const since = now - f.dodge.at;
      f.boost = since < ROLL_MS ? 1.1 : since < ROLL_MS + TAUNT_MS ? 0.25 : 2;
      const k = Math.min(1, since / ROLL_MS);
      const eased = 1 - (1 - k) ** 3;
      f.offset = f.dodge.from + (f.dodge.to - f.dodge.from) * eased;
      f.roll = Math.cos(k * Math.PI * 2);
    }
    const side = Math.sin(f.dist / 70 + f.phase) * 5 + f.offset;
    f.x = point.x - Math.sin(angle) * side;
    f.y = point.y + Math.cos(angle) * side;
    const degrees = (angle * 180) / Math.PI;
    f.rot = f.dir > 0 ? degrees : degrees - 180;

    const exhaust = this.toSky(f, EXHAUST);
    this.particles?.trail(exhaust.x, exhaust.y, f.crew.color);
    if (f.pet && f.dropAt >= 0 && f.dist >= f.dropAt && f.x > f.w * 0.6 && f.x < this.width - f.w * 0.6) {
      this.dropPet(f);
    }
    this.render(f);
  }

  private updateFall(f: Flight, dt: number): void {
    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.rot += f.spin * dt;
    const exhaust = this.toSky(f, EXHAUST);
    this.particles?.trail(exhaust.x, exhaust.y, f.crew.color, true);
    if (f.y > this.height - f.h * 0.3) {
      this.crash(f);
    } else if (f.x < -f.w * 2 || f.x > this.width + f.w * 2) {
      this.remove(f);
    } else {
      this.render(f);
    }
  }

  private dodge(f: Flight, x: number, y: number, now: number): void {
    const { angle } = f.path.at(f.dist);
    // Move to the side of the path away from the finger.
    const away = Math.sign(-(x - f.x) * Math.sin(angle) + (y - f.y) * Math.cos(angle)) || 1;
    f.dodge = { at: now, from: f.offset, to: f.offset - away * 90 };
    this.setMode(f.rid, 'taunt');
    this.later(ROLL_MS - 100, () => this.sfx.play('taunt'));
    this.later(ROLL_MS + TAUNT_MS + 200, () => this.flights.has(f.rid) && !f.falling && this.setMode(f.rid, 'fly'));
  }

  private shootDown(f: Flight): void {
    const { angle } = f.path.at(f.dist);
    const speed = f.speed * f.boost * 0.7;
    f.falling = true;
    f.roll = 1;
    // Keep the crash on screen: limited drift, pointing inwards near the edges.
    const drift = Math.max(-170, Math.min(170, Math.cos(angle) * speed));
    const inwards = f.x < this.width * 0.25 ? 1 : f.x > this.width * 0.75 ? -1 : Math.sign(drift) || 1;
    f.vx = Math.abs(drift) * inwards;
    f.vy = Math.sin(angle) * speed - 220;
    f.spin = (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 320);
    this.sfx.play('fall');
    if (f.pet) this.dropPet(f);
    this.setMode(f.rid, 'fall');
  }

  private crash(f: Flight): void {
    this.particles?.explode(f.x, Math.min(f.y, this.height - 12), f.crew.color);
    this.sfx.play('boom');
    this.vibrate([30, 40, 70]);
    this.remove(f);
  }

  private dropPet(f: Flight): void {
    if (!f.pet) return;
    const seat = this.toSky(f, PET_SEAT);
    const rect = this.host.getBoundingClientRect();
    this.petService.drop(f.pet.id, rect.left + seat.x, rect.top + seat.y);
    f.pet = null;
    this.ships.update((ships) => ships.map((s) => (s.rid === f.rid ? { ...s, pet: null } : s)));
  }

  private remove(f: Flight): void {
    this.flights.delete(f.rid);
    this.ships.update((ships) => ships.filter((s) => s.rid !== f.rid));
  }

  private setMode(rid: number, mode: ShipMode): void {
    this.ships.update((ships) => ships.map((s) => (s.rid === rid ? { ...s, mode } : s)));
  }

  /** Point of the rocket drawing → sky coordinates, following its transform. */
  private toSky(f: Flight, p: Point): Point {
    const lx = ((p.x - ART_W / 2) / ART_W) * f.w * f.dir;
    const ly = ((p.y - ART_H / 2) / ART_H) * f.h * f.roll;
    const r = (f.rot * Math.PI) / 180;
    return { x: f.x + lx * Math.cos(r) - ly * Math.sin(r), y: f.y + lx * Math.sin(r) + ly * Math.cos(r) };
  }

  private render(f: Flight): void {
    if (!f.el) {
      f.el = this.host.querySelector<HTMLElement>(`[data-rid="${f.rid}"]`);
      if (!f.el) return;
      f.w = f.el.offsetWidth || f.w;
      f.h = f.el.offsetHeight || f.h;
      f.el.style.opacity = '1';
    }
    f.el.style.transform =
      `translate3d(${(f.x - f.w / 2).toFixed(1)}px, ${(f.y - f.h / 2).toFixed(1)}px, 0) ` +
      `rotate(${f.rot.toFixed(1)}deg) scale(${f.dir}, ${f.roll.toFixed(3)})`;
  }

  /** Reduced motion: the four rockets parked around the hero, no flying. */
  private showParked(): void {
    const spots = [
      [0.14, 0.2, 1],
      [0.86, 0.22, -1],
      [0.16, 0.82, 1],
      [0.84, 0.8, -1],
    ] as const;
    const small = this.width < 600;
    CREW.forEach((crew, i) => {
      const w = small ? 110 : 170;
      const [fx, fy, dir] = spots[i % spots.length];
      this.flights.set(this.nextId, {
        rid: this.nextId, crew, pet: null, el: null, w, h: (w * ART_H) / ART_W,
        path: new FlightPath({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
        dir, speed: 0, boost: 1, dist: 0, falling: false, x: fx * this.width, y: fy * this.height,
        rot: 0, roll: 1, vx: 0, vy: 0, spin: 0, offset: 0, dodge: null, dropAt: -1, phase: 0,
      });
      this.nextId++;
    });
    this.ships.set(
      [...this.flights.values()].map((f) => ({ rid: f.rid, crew: f.crew, pet: null, mode: 'fly', flipped: f.dir < 0 })),
    );
    this.later(0, () => this.flights.forEach((f) => this.render(f)));
  }

  /** Only after a real tap: browsers refuse (and complain) otherwise. */
  private vibrate(pattern: number | number[]): void {
    const navigator = this.window?.navigator;
    if (navigator?.userActivation?.hasBeenActive) navigator.vibrate?.(pattern);
  }

  private later(ms: number, fn: () => void): void {
    const id = this.window?.setTimeout(() => {
      this.timers.delete(id!);
      fn();
    }, ms);
    if (id !== undefined) this.timers.add(id);
  }
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
