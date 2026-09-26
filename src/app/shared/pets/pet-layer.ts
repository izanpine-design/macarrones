import { afterNextRender, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { PetId } from '../crew/crew';
import { PARACHUTE, PetPose } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { SfxService } from '../sfx/sfx.service';
import { PetService } from './pet.service';
import { Pet, PETS } from './pets';

type Mode = 'hidden' | 'drop' | 'idle' | 'walk' | 'sleep';

interface Walker {
  pet: Pet;
  el: HTMLElement | null;
  x: number;
  y: number;
  facing: 1 | -1;
  mode: Mode;
  /** Time (ms) when the current mode ends. */
  until: number;
  targetX: number;
  dropFrom: { x: number; y: number; at: number; duration: number } | null;
  nextBlink: number;
  /** Sprite size in px, measured after render and on resize. */
  w: number;
  h: number;
}

const WALK_CYCLE: PetPose[] = ['walkB', 'stand', 'walkC', 'stand'];
/** Parachute descent speed, px/s. */
const DROP_SPEED = 95;
/** If no rocket drops them, pets walk in after this long anyway. */
const FALLBACK_MS = 40_000;

/**
 * The crew's pets, roaming the bottom of the screen on every page: they walk,
 * wag, blink and nap from time to time. Tapping one makes it hop.
 */
@Component({
  selector: 'app-pet-layer',
  imports: [PixelSprite],
  templateUrl: './pet-layer.html',
  styleUrl: './pet-layer.css',
  host: { 'aria-hidden': 'true' },
})
export class PetLayer {
  private readonly petService = inject(PetService);
  private readonly sfx = inject(SfxService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;

  protected readonly pets = PETS;
  protected readonly parachute = PARACHUTE;
  protected readonly modes = signal<Record<PetId, Mode>>(recordOf(() => 'hidden'));
  protected readonly poses = signal<Record<PetId, PetPose>>(recordOf(() => 'stand'));
  protected readonly hopping = signal<PetId | null>(null);

  private readonly walkers = new Map<PetId, Walker>(
    PETS.map((pet) => [
      pet.id,
      { pet, el: null, x: 0, y: 0, facing: 1, mode: 'hidden', until: 0, targetX: 0, dropFrom: null, nextBlink: 0, w: 72, h: 51 },
    ]),
  );
  private frame = 0;
  private last = 0;
  private started = false;
  private readonly still = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.petService.phases();
      this.petService.drops();
      untracked(() => this.sync());
    });

    afterNextRender(() => {
      this.started = true;
      for (const walker of this.walkers.values()) {
        walker.el = this.host.querySelector<HTMLElement>(`[data-pet="${walker.pet.id}"]`);
      }
      this.measure();
      const onResize = (): void => this.measure();
      this.window?.addEventListener('resize', onResize);
      const timers = [
        // Not on the welcome page: nobody will drop them, so they walk in.
        this.window?.setTimeout(() => this.petService.hasSky() || this.petService.landAll(), 1500),
        this.window?.setTimeout(() => this.petService.landAll(), FALLBACK_MS),
      ];
      this.sync();
      this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
      destroyRef.onDestroy(() => {
        this.window?.removeEventListener('resize', onResize);
        this.window?.cancelAnimationFrame(this.frame);
        timers.forEach((id) => this.window?.clearTimeout(id));
      });
    });
  }

  protected pat(id: PetId): void {
    const walker = this.walkers.get(id);
    if (!walker || walker.mode === 'hidden' || walker.mode === 'drop') return;
    this.sfx.play('pop');
    this.hopping.set(id);
    this.window?.setTimeout(() => this.hopping() === id && this.hopping.set(null), 900);
    this.setMode(walker, 'idle', 1800);
    this.setPose(id, 'wag');
  }

  /** Starts the animations the pet service asks for (drops, walking in). */
  private sync(): void {
    if (!this.started) return;
    for (const drop of this.petService.takeDrops()) {
      const walker = this.walkers.get(drop.id);
      if (!walker) continue;
      walker.x = drop.x - walker.w / 2;
      walker.y = drop.y - walker.h / 2;
      const distance = Math.max(0, this.groundY(walker) - walker.y);
      walker.dropFrom = { x: walker.x, y: walker.y, at: performance.now(), duration: (distance / DROP_SPEED) * 1000 };
      if (this.still) {
        this.land(walker);
      } else {
        this.setMode(walker, 'drop', Infinity);
      }
    }
    const phases = this.petService.phases();
    for (const walker of this.walkers.values()) {
      if (phases[walker.pet.id] === 'ground' && walker.mode === 'hidden') this.walkIn(walker);
    }
  }

  private walkIn(walker: Walker): void {
    const width = this.viewportWidth();
    walker.y = this.groundY(walker);
    if (this.still) {
      const index = PETS.indexOf(walker.pet);
      walker.x = ((index + 0.5) / PETS.length) * width - walker.w / 2;
      this.setMode(walker, 'idle', Infinity);
      return;
    }
    const fromLeft = Math.random() < 0.5;
    walker.x = fromLeft ? -walker.w : width;
    walker.targetX = randomBetween(0.05, 0.85) * (width - walker.w);
    walker.facing = fromLeft ? 1 : -1;
    this.setMode(walker, 'walk', Infinity);
  }

  private land(walker: Walker): void {
    walker.dropFrom = null;
    walker.y = this.groundY(walker);
    this.petService.landed(walker.pet.id);
    this.setMode(walker, 'idle', 1500);
    this.setPose(walker.pet.id, 'wag');
  }

  private tick(now: number): void {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    for (const walker of this.walkers.values()) {
      if (walker.mode !== 'hidden') this.update(walker, now, dt);
    }
    this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
  }

  private update(walker: Walker, now: number, dt: number): void {
    const id = walker.pet.id;
    switch (walker.mode) {
      case 'drop': {
        const drop = walker.dropFrom!;
        const progress = Math.min(1, (now - drop.at) / Math.max(drop.duration, 1));
        walker.y = drop.y + (this.groundY(walker) - drop.y) * progress;
        walker.x = drop.x + Math.sin((now - drop.at) / 450) * 16;
        if (progress >= 1) this.land(walker);
        break;
      }
      case 'walk': {
        const direction = Math.sign(walker.targetX - walker.x) || 1;
        walker.facing = direction > 0 ? 1 : -1;
        walker.x += direction * walker.pet.speed * dt;
        this.setPose(id, WALK_CYCLE[Math.floor(now / 125) % WALK_CYCLE.length]);
        if ((walker.targetX - walker.x) * direction <= 0) {
          walker.x = walker.targetX;
          this.decide(walker);
        }
        break;
      }
      case 'idle': {
        if (!this.still && now > walker.until) {
          this.decide(walker);
        } else if (now > walker.nextBlink) {
          walker.nextBlink = now + randomBetween(1800, 4200);
        } else if (now > walker.nextBlink - 160) {
          this.setPose(id, 'blink');
        } else {
          const wagging = id === 'pichu' || this.hopping() === id;
          this.setPose(id, wagging && Math.floor(now / 220) % 2 ? 'wag' : 'stand');
        }
        break;
      }
      case 'sleep':
        if (now > walker.until) this.decide(walker);
        break;
    }
    if (walker.el) {
      walker.el.style.transform = `translate3d(${walker.x.toFixed(1)}px, ${walker.y.toFixed(1)}px, 0)`;
      walker.el.style.setProperty('--facing', String(walker.facing));
    }
  }

  /** Picks what the pet does next. */
  private decide(walker: Walker): void {
    const roll = Math.random();
    const sleepy = walker.pet.id === 'pichu' ? 0.92 : 0.8;
    if (roll < 0.42) {
      this.setMode(walker, 'idle', randomBetween(2500, 6500));
    } else if (roll < sleepy) {
      walker.targetX = randomBetween(0.02, 0.98) * (this.viewportWidth() - walker.w);
      this.setMode(walker, 'walk', Infinity);
    } else {
      this.setMode(walker, 'sleep', randomBetween(9000, 17000));
      this.setPose(walker.pet.id, 'sleep');
    }
  }

  private setMode(walker: Walker, mode: Mode, duration: number): void {
    walker.mode = mode;
    walker.until = performance.now() + duration;
    this.modes.update((modes) => (modes[walker.pet.id] === mode ? modes : { ...modes, [walker.pet.id]: mode }));
    if (mode === 'idle' || mode === 'drop') this.setPose(walker.pet.id, 'stand');
  }

  private setPose(id: PetId, pose: PetPose): void {
    if (this.poses()[id] !== pose) this.poses.update((poses) => ({ ...poses, [id]: pose }));
  }

  /** Reads sprite sizes (they change with the breakpoint) and re-grounds the pets. */
  private measure(): void {
    for (const walker of this.walkers.values()) {
      const sprite = walker.el?.querySelector('.pet__body');
      walker.w = sprite?.clientWidth || walker.w;
      walker.h = sprite?.clientHeight || walker.h;
      if (walker.mode !== 'drop' && walker.mode !== 'hidden') walker.y = this.groundY(walker);
      walker.x = Math.min(walker.x, this.viewportWidth() - walker.w);
      walker.targetX = Math.min(walker.targetX, this.viewportWidth() - walker.w);
    }
  }

  private groundY(walker: Walker): number {
    return (this.window?.innerHeight ?? 800) - walker.h - 6;
  }

  private viewportWidth(): number {
    return this.host.clientWidth || (this.window?.innerWidth ?? 1024);
  }
}

function recordOf<T>(value: () => T): Record<PetId, T> {
  return Object.fromEntries(PETS.map((pet) => [pet.id, value()])) as Record<PetId, T>;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
