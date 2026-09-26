import { afterNextRender, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { PetId } from '../crew/crew';
import { PARACHUTE, PetPose } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { SfxService } from '../sfx/sfx.service';
import { PetService } from './pet.service';
import { Pet, PETS } from './pets';

/**
 * What a pet is doing. Moving modes (walk, run, approach, chase, flee, hunt)
 * go towards `targetX`; the rest stay put until `until`.
 */
type Mode =
  | 'hidden' | 'drop' | 'idle' | 'walk' | 'sleep' | 'run' | 'jump' | 'look' | 'stretch'
  | 'approach' | 'wait' | 'angry' | 'brawl' | 'love' | 'chase' | 'flee' | 'hunt';

type Meeting = 'fight' | 'friends';

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
  /** The other pet in a meeting or a chase. */
  partner: Walker | null;
  meeting: Meeting | null;
  /** Recent taps, to notice when someone keeps poking. */
  taps: number[];
}

const WALK_CYCLE: PetPose[] = ['walkB', 'stand', 'walkC', 'stand'];
/** Speed multiplier of each moving mode. */
const PACE: Partial<Record<Mode, number>> = { walk: 1, approach: 1.4, run: 2.4, chase: 2.7, flee: 2.5, hunt: 2.6 };
/** Parachute descent speed, px/s. */
const DROP_SPEED = 95;
/** If no rocket drops them, pets walk in after this long anyway. */
const FALLBACK_MS = 40_000;
/** Pets on the ground plan something together every few seconds. */
const SOCIAL_EVERY_MS = [14000, 26000] as const;
/** Movable modes that can be interrupted by a new plan. */
const FREE: readonly Mode[] = ['idle', 'walk', 'look', 'stretch'];

const GRUMBLE: Record<PetId, string> = { pichu: '¡Grrr!', nael: '¡Fsss!', simba: '¡Fsss!', enana: '¡Miau!' };

/**
 * The crew's pets, roaming the bottom of the screen on every page. Alone they
 * walk, run, jump, look around, stretch and nap; together they make friends,
 * chase each other or get into a cartoon brawl. They react to taps and, on a
 * computer, hunt the mouse when it comes near the ground.
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
  /** Speech bubble over each pet ("♥", "💢 ¡Fsss!"…). */
  protected readonly bubbles = signal<Record<PetId, string | null>>(recordOf(() => null));
  /** The dust cloud of a brawl, in viewport px. */
  protected readonly brawl = signal<{ x: number; y: number } | null>(null);

  private readonly walkers = new Map<PetId, Walker>(PETS.map((pet) => [pet.id, newWalker(pet)]));
  private frame = 0;
  private last = 0;
  private started = false;
  private nextSocial = 0;
  private pointer: { x: number; y: number; at: number } | null = null;
  private readonly timers = new Set<number>();
  private readonly still = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private readonly finePointer = this.window?.matchMedia?.('(pointer: fine)').matches ?? false;

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
      const onPointer = (e: PointerEvent): void => {
        this.pointer = { x: e.clientX, y: e.clientY, at: performance.now() };
      };
      this.window?.addEventListener('resize', onResize);
      if (this.finePointer) this.window?.addEventListener('pointermove', onPointer, { passive: true });
      // Not on the welcome page: nobody will drop them, so they walk in.
      this.later(1500, () => this.petService.hasSky() || this.petService.landAll());
      this.later(FALLBACK_MS, () => this.petService.landAll());
      this.nextSocial = performance.now() + randomBetween(...SOCIAL_EVERY_MS);
      this.sync();
      this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
      destroyRef.onDestroy(() => {
        this.window?.removeEventListener('resize', onResize);
        this.window?.removeEventListener('pointermove', onPointer);
        this.window?.cancelAnimationFrame(this.frame);
        this.timers.forEach((id) => this.window?.clearTimeout(id));
      });
    });
  }

  /** Tap: a hop and a heart… but poke it three times and it gets cross. */
  protected pat(id: PetId): void {
    const walker = this.walkers.get(id);
    if (!walker || ['hidden', 'drop', 'brawl'].includes(walker.mode)) return;
    const now = performance.now();
    walker.taps = [...walker.taps.filter((t) => now - t < 1600), now];

    if (walker.mode === 'sleep') {
      this.grumble(walker, '😾');
      return;
    }
    if (walker.taps.length >= 3) {
      walker.taps = [];
      this.grumble(walker, `💢 ${GRUMBLE[id]}`);
      this.later(900, () => this.runTo(walker, walker.x < this.viewportWidth() / 2 ? 0.92 : 0.04));
      return;
    }
    this.sfx.play('pop');
    this.say(walker, `♥ ${walker.pet.nombre}`, 1200);
    this.release(walker);
    this.setMode(walker, 'jump', 650);
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
      if (this.still) this.land(walker);
      else this.setMode(walker, 'drop', Infinity);
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
    this.setMode(walker, 'walk', Infinity);
  }

  private land(walker: Walker): void {
    walker.dropFrom = null;
    walker.y = this.groundY(walker);
    this.petService.landed(walker.pet.id);
    this.setMode(walker, 'jump', 650);
  }

  private tick(now: number): void {
    this.frame = this.window?.requestAnimationFrame((t) => this.tick(t)) ?? 0;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.still) {
      if (now > this.nextSocial) this.planSomethingTogether(now);
      this.maybeHunt(now);
    }
    for (const walker of this.walkers.values()) {
      if (walker.mode !== 'hidden') this.update(walker, now, dt);
    }
  }

  private update(walker: Walker, now: number, dt: number): void {
    const id = walker.pet.id;
    const pace = PACE[walker.mode];
    if (walker.mode === 'drop') {
      const drop = walker.dropFrom!;
      const progress = Math.min(1, (now - drop.at) / Math.max(drop.duration, 1));
      walker.y = drop.y + (this.groundY(walker) - drop.y) * progress;
      walker.x = drop.x + Math.sin((now - drop.at) / 450) * 16;
      if (progress >= 1) this.land(walker);
    } else if (pace) {
      if (walker.mode === 'chase' && walker.partner) walker.targetX = walker.partner.x;
      const direction = Math.sign(walker.targetX - walker.x) || 1;
      walker.facing = direction > 0 ? 1 : -1;
      walker.x += direction * walker.pet.speed * pace * dt;
      this.setPose(id, WALK_CYCLE[Math.floor((now * pace) / 125) % WALK_CYCLE.length]);
      const arrived = (walker.targetX - walker.x) * direction <= (walker.mode === 'chase' ? walker.w * 0.6 : 0);
      if (arrived || now > walker.until) this.arrive(walker);
    } else if (walker.mode === 'look') {
      walker.facing = Math.floor(now / 700) % 2 ? 1 : -1;
      this.setPose(id, 'stand');
      if (now > walker.until) this.decide(walker);
    } else if (walker.mode === 'love') {
      this.setPose(id, Math.floor(now / 200) % 2 ? 'wag' : 'stand');
      if (now > walker.until) this.decide(walker);
    } else if (walker.mode === 'idle' || walker.mode === 'wait') {
      // Waiting for a pet that was interrupted on its way: carry on.
      if ((walker.mode === 'idle' && now > walker.until) || (walker.mode === 'wait' && !walker.partner)) {
        this.decide(walker);
      } else if (now > walker.nextBlink) {
        walker.nextBlink = now + randomBetween(1800, 4200);
      } else {
        const blinking = now > walker.nextBlink - 160;
        const wagging = id === 'pichu' && Math.floor(now / 220) % 2 === 1;
        this.setPose(id, blinking ? 'blink' : wagging ? 'wag' : 'stand');
      }
    } else if (walker.mode !== 'brawl' && walker.mode !== 'angry' && now > walker.until) {
      // sleep, jump, stretch.
      this.decide(walker);
    }
    if (walker.el) {
      walker.el.style.transform = `translate3d(${walker.x.toFixed(1)}px, ${walker.y.toFixed(1)}px, 0)`;
      walker.el.style.setProperty('--facing', String(walker.facing));
    }
  }

  /** Reached the target of a moving mode. */
  private arrive(walker: Walker): void {
    const partner = walker.partner;
    switch (walker.mode) {
      case 'approach':
        if (partner && walker.meeting) this.meet(walker, partner, walker.meeting);
        else this.decide(walker);
        break;
      case 'chase':
        // Caught up (or gave up): the one being chased turns round, furious.
        if (partner && partner.mode === 'flee') {
          this.face(partner, walker);
          this.grumble(partner, `💢 ${GRUMBLE[partner.pet.id]}`);
          this.release(partner);
        }
        this.release(walker);
        this.setMode(walker, 'jump', 650);
        break;
      case 'hunt':
        this.say(walker, '❗', 900);
        this.setMode(walker, 'jump', 650);
        break;
      default:
        this.decide(walker);
    }
  }

  /** Picks what a pet does next on its own. */
  private decide(walker: Walker): void {
    this.release(walker);
    const width = this.viewportWidth() - walker.w;
    const roll = Math.random();
    const isDog = walker.pet.id === 'pichu';
    if (roll < 0.26) {
      this.setMode(walker, 'idle', randomBetween(2500, 6000));
    } else if (roll < 0.52) {
      walker.targetX = randomBetween(0.02, 0.98) * width;
      this.setMode(walker, 'walk', 20_000);
    } else if (roll < 0.6) {
      this.runTo(walker, Math.random());
    } else if (roll < 0.66 && !isDog) {
      this.zoomies(walker);
    } else if (roll < 0.74) {
      this.setMode(walker, 'look', randomBetween(1800, 3200));
    } else if (roll < 0.8) {
      this.setMode(walker, 'jump', 650);
    } else if (roll < 0.87) {
      this.setMode(walker, 'stretch', 1600);
    } else {
      this.setMode(walker, 'sleep', randomBetween(9000, 17000));
      this.setPose(walker.pet.id, 'sleep');
    }
  }

  /** Every few seconds two pets on the ground do something together. */
  private planSomethingTogether(now: number): void {
    this.nextSocial = now + randomBetween(...SOCIAL_EVERY_MS);
    const free = [...this.walkers.values()].filter((w) => FREE.includes(w.mode));
    if (free.length < 2) return;
    const [a, b] = shuffle(free);
    const catAndDog = a.pet.id === 'pichu' || b.pet.id === 'pichu';
    const roll = Math.random();
    // Brawls are the exception: mostly they make friends or play chase.
    if (roll < (catAndDog ? 0.22 : 0.14)) this.approach(a, b, 'fight');
    else if (roll < 0.68) this.approach(a, b, 'friends');
    else this.chase(a, b);
  }

  private approach(a: Walker, b: Walker, meeting: Meeting): void {
    a.partner = b;
    a.meeting = meeting;
    b.partner = a;
    const gap = b.w * 0.75;
    a.targetX = clamp(b.x + (a.x < b.x ? -gap : gap), 0, this.viewportWidth() - a.w);
    this.setMode(a, 'approach', 12_000);
    this.face(b, a);
    this.say(b, '❓', 1200);
    this.setMode(b, 'wait', Infinity);
  }

  private meet(a: Walker, b: Walker, meeting: Meeting): void {
    this.face(a, b);
    this.face(b, a);
    if (meeting === 'friends') {
      this.say(a, '♥', 1700);
      this.say(b, '♥', 1700);
      this.release(a);
      this.release(b);
      this.setMode(a, 'love', 1700);
      this.setMode(b, 'love', 1700);
      return;
    }
    // Staring contest… then the dust cloud.
    this.grumble(a, `💢 ${GRUMBLE[a.pet.id]}`);
    this.grumble(b, `💢 ${GRUMBLE[b.pet.id]}`);
    this.later(1100, () => {
      if (a.partner !== b) return;
      this.brawl.set({ x: (a.x + b.x + a.w) / 2, y: a.y + a.h / 2 });
      this.setMode(a, 'brawl', Infinity);
      this.setMode(b, 'brawl', Infinity);
      this.sfx.play('scuffle');
    });
    this.later(3000, () => {
      if (a.partner !== b) return;
      this.brawl.set(null);
      this.release(a);
      this.release(b);
      const [left, right] = a.x < b.x ? [a, b] : [b, a];
      this.runTo(left, 0.02);
      this.runTo(right, 0.95);
      this.say(Math.random() < 0.5 ? left : right, '😿', 1400);
    });
  }

  private chase(chaser: Walker, target: Walker): void {
    chaser.partner = target;
    target.partner = chaser;
    const awayRight = target.x > chaser.x;
    target.targetX = awayRight ? this.viewportWidth() - target.w : 0;
    this.say(target, '❗', 900);
    this.setMode(target, 'flee', 3200);
    this.setMode(chaser, 'chase', 3000);
    this.say(chaser, '😼', 900);
  }

  private zoomies(walker: Walker): void {
    const width = this.viewportWidth() - walker.w;
    const legs = walker.x < width / 2 ? [0.95, 0.05, 0.9] : [0.05, 0.95, 0.1];
    let delay = 0;
    for (const leg of legs) {
      this.later(delay, () => walker.mode === 'run' || FREE.includes(walker.mode) ? this.runTo(walker, leg) : undefined);
      delay += (Math.abs(width * 0.85) / (walker.pet.speed * PACE.run!)) * 1000;
    }
  }

  private runTo(walker: Walker, fraction: number): void {
    walker.targetX = clamp(fraction, 0, 1) * (this.viewportWidth() - walker.w);
    this.setMode(walker, 'run', 12_000);
  }

  /** On a computer: a cat stalks the mouse when it comes down near the pets. */
  private maybeHunt(now: number): void {
    const pointer = this.pointer;
    if (!pointer || now - pointer.at > 600) return;
    if (pointer.y < (this.window?.innerHeight ?? 800) - 150) return;
    this.pointer = null;
    if (Math.random() > 0.35) return;
    const hunter = [...this.walkers.values()].find((w) => w.pet.id !== 'pichu' && FREE.includes(w.mode));
    if (!hunter) return;
    hunter.targetX = clamp(pointer.x - hunter.w / 2, 0, this.viewportWidth() - hunter.w);
    this.say(hunter, '👀', 700);
    this.setMode(hunter, 'hunt', 4000);
  }

  private grumble(walker: Walker, text: string): void {
    this.say(walker, text, 1300);
    this.sfx.play(walker.pet.id === 'pichu' ? 'woof' : 'hiss');
    this.setMode(walker, 'angry', 1100);
    this.later(1100, () => walker.mode === 'angry' && this.setMode(walker, 'idle', 1500));
  }

  private say(walker: Walker, text: string, ms: number): void {
    const id = walker.pet.id;
    this.bubbles.update((b) => ({ ...b, [id]: text }));
    this.later(ms, () => this.bubbles()[id] === text && this.bubbles.update((b) => ({ ...b, [id]: null })));
  }

  private face(walker: Walker, other: Walker): void {
    walker.facing = other.x > walker.x ? 1 : -1;
  }

  /** Ends any plan with a partner. */
  private release(walker: Walker): void {
    if (walker.partner?.partner === walker) walker.partner.partner = null;
    walker.partner = null;
    walker.meeting = null;
  }

  private setMode(walker: Walker, mode: Mode, duration: number): void {
    walker.mode = mode;
    walker.until = performance.now() + duration;
    this.modes.update((modes) => (modes[walker.pet.id] === mode ? modes : { ...modes, [walker.pet.id]: mode }));
    if (!PACE[mode] && mode !== 'sleep') this.setPose(walker.pet.id, 'stand');
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

  private later(ms: number, fn: () => void): void {
    const id = this.window?.setTimeout(() => {
      this.timers.delete(id!);
      fn();
    }, ms);
    if (id !== undefined) this.timers.add(id);
  }
}

function newWalker(pet: Pet): Walker {
  return {
    pet, el: null, x: 0, y: 0, facing: 1, mode: 'hidden', until: 0, targetX: 0, dropFrom: null,
    nextBlink: 0, w: 72, h: 51, partner: null, meeting: null, taps: [],
  };
}

function recordOf<T>(value: () => T): Record<PetId, T> {
  return Object.fromEntries(PETS.map((pet) => [pet.id, value()])) as Record<PetId, T>;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
