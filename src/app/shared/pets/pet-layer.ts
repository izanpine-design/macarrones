import { afterNextRender, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { PetId } from '../crew/crew';
import { PARACHUTE, PetPose, PixelFrame } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { SfxService } from '../sfx/sfx.service';
import { DRY_MS, makePuddle, PEE_MS, PeePuddle, PeeStream, Puddle } from './pee';
import { PetService } from './pet.service';
import { PetRagdoll, Ragdoll } from './ragdoll';
import { Pet, PETS } from './pets';

/**
 * What a pet is doing. Moving modes (walk, run, approach, chase, flee, hunt)
 * go towards `targetX`; the rest stay put until `until`.
 */
type Mode =
  | 'hidden' | 'drop' | 'bounce' | 'idle' | 'walk' | 'sleep' | 'run' | 'jump' | 'look' | 'stretch'
  | 'approach' | 'wait' | 'angry' | 'brawl' | 'love' | 'chase' | 'flee' | 'hunt' | 'held' | 'fall' | 'pee';

type Meeting = 'fight' | 'friends';

/** A pointer holding a pet (or about to: it only lifts once the pointer moves). */
interface Grab {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Pointer velocity, px/s: shaking annoys the pet and letting go throws it. */
  vx: number;
  vy: number;
  at: number;
  lifted: boolean;
  liftedAt: number;
  /** Hand position last frame, its velocity and acceleration (px/s, px/s²), for the swing. */
  frameX: number;
  frameY: number;
  hvx: number;
  hvy: number;
  ax: number;
  ay: number;
}

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
  body: HTMLElement | null;
  /** Standing sprite height; `h` follows the blown-up sprite while bouncing. */
  standH: number;
  /** Airborne velocity (thrown, or bouncing), px/s. */
  vx: number;
  vy: number;
  /** How blown up the balloon pet still is: 1 full, 0 deflated. */
  air: number;
  /** Squash after hitting the floor, fades from 1 to 0. */
  squash: number;
  grab: Grab | null;
  /** The puddle it is filling right now. */
  puddle: Puddle | null;
  /** Bendy body while held or thrown. */
  rag: Ragdoll | null;
  /** Scratched whoever held it: runs off once it lands. */
  furious: boolean;
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
/** Out of reach: can't be grabbed or sent anywhere by a plan. */
const BUSY: readonly Mode[] = ['hidden', 'drop', 'bounce', 'brawl', 'held', 'fall'];
/** Gravity for thrown pets and for the balloon (which floats more), px/s². */
const GRAVITY = 2200;
const BALLOON_GRAVITY = 900;
/** Held: the gravity its body feels, and air drag (px/s² per px/s). */
const HOLD_GRAVITY = 2200;
const AIR_DRAG = 0.6;
/** Physics step of the ragdoll, seconds. */
const RAG_STEP = 1 / 240;
/** Strongest pull the dangling body feels, px/s² (about twice gravity). */
const MAX_PULL = 4600;
/** Fully blown up, the balloon pet is this much bigger. */
const BALLOON_GROWTH = 0.9;

const GRUMBLE: Record<PetId, string> = { pichu: '¡Grrr!', nael: '¡Fsss!', simba: '¡Fsss!', enana: '¡Miau!', gordo: '¡Mrrau!' };

/**
 * The crew's pets, roaming the bottom of the screen on every page. Alone they
 * walk, run, jump, look around, stretch and nap; together they make friends,
 * chase each other or get into a cartoon brawl. They react to taps, can be
 * picked up by the scruff and thrown (they may scratch and wriggle free) and,
 * on a computer, hunt the mouse when it comes near the ground.
 */
@Component({
  selector: 'app-pet-layer',
  imports: [PixelSprite, PeePuddle, PeeStream, PetRagdoll],
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
  /** Wee puddles on the ground (growing, then drying up). */
  protected readonly puddles = signal<readonly Puddle[]>([]);
  /** Claw marks left on the screen where a held pet scratched. */
  protected readonly scratches = signal<readonly { x: number; y: number; at: number }[]>([]);

  private readonly walkers = new Map<PetId, Walker>(PETS.map((pet) => [pet.id, newWalker(pet)]));
  private frame = 0;
  private last = 0;
  private started = false;
  private nextSocial = 0;
  private puddleCount = 0;
  /** When the dog last had a wee (it waits a while before the next one). */
  private lastPee = -Infinity;
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
        walker.body = walker.el?.querySelector<HTMLElement>('.pet__body') ?? null;
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

  /** Pointer down on a pet: a tap if it lets go right away, a pick-up if it drags. */
  protected grab(id: PetId, event: PointerEvent): void {
    const walker = this.walkers.get(id);
    if (!walker || walker.grab || event.button !== 0) return;
    if (BUSY.includes(walker.mode) && walker.mode !== 'fall') return;
    event.preventDefault();
    try {
      // Keep receiving the moves even when the pointer outruns the pet.
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone: the grab simply ends on the next pointerup.
    }
    const { clientX: x, clientY: y } = event;
    walker.grab = { pointerId: event.pointerId, startX: x, startY: y, x, y, vx: 0, vy: 0, at: performance.now(), lifted: false, liftedAt: 0,
      frameX: x, frameY: y, hvx: 0, hvy: 0, ax: 0, ay: 0 };
    // Caught in mid-air: straight into the hand.
    if (walker.mode === 'fall') this.lift(walker);
  }

  protected drag(id: PetId, event: PointerEvent): void {
    const walker = this.walkers.get(id);
    const grab = walker?.grab;
    if (!walker || !grab || grab.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(8, now - grab.at) / 1000;
    grab.vx = grab.vx * 0.5 + ((event.clientX - grab.x) / dt) * 0.5;
    grab.vy = grab.vy * 0.5 + ((event.clientY - grab.y) / dt) * 0.5;
    grab.x = event.clientX;
    grab.y = event.clientY;
    grab.at = now;
    if (!grab.lifted && Math.hypot(grab.x - grab.startX, grab.y - grab.startY) > 8) this.lift(walker);
  }

  protected letGo(id: PetId, event: PointerEvent): void {
    const walker = this.walkers.get(id);
    const grab = walker?.grab;
    if (!walker || !grab || grab.pointerId !== event.pointerId) return;
    walker.grab = null;
    if (!grab.lifted) {
      if (event.type === 'pointerup') this.pat(id);
      return;
    }
    // Let go: it drops, or flies off if flung.
    const still = performance.now() - grab.at > 90;
    this.toss(walker, still ? 0 : grab.hvx, still ? 0 : grab.hvy);
  }

  /** Tap: a hop and a heart… but poke it three times and it gets cross. */
  protected pat(id: PetId): void {
    const walker = this.walkers.get(id);
    if (!walker || BUSY.includes(walker.mode)) return;
    const now = performance.now();
    walker.taps = [...walker.taps.filter((t) => now - t < 1600), now];

    if (walker.mode === 'pee') {
      this.grumble(walker, '😳');
      return;
    }
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
      if (walker.pet.landing === 'balloon' && !this.still) {
        this.blowUp(walker, drop.x, drop.y);
        continue;
      }
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

  /** Jumps off the rocket blown up like a balloon, to bounce around until it deflates. */
  private blowUp(walker: Walker, x: number, y: number): void {
    const ball = walker.pet.art.ball!;
    walker.standH = walker.h;
    walker.h = (walker.w * ball.length) / ball[0].length;
    walker.x = x - walker.w / 2;
    walker.y = y - walker.h / 2;
    walker.vx = (Math.random() < 0.5 ? -1 : 1) * randomBetween(160, 280);
    walker.vy = -220;
    walker.air = 1;
    walker.squash = 0;
    this.setMode(walker, 'bounce', Infinity);
  }

  /** Airborne: thrown pets fall, the balloon bounces off the floor and walls. */
  private fly(walker: Walker, dt: number): void {
    const balloon = walker.mode === 'bounce';
    const scale = balloon ? 1 + walker.air * BALLOON_GROWTH : 1;
    walker.vy += (balloon ? BALLOON_GRAVITY : GRAVITY) * dt;
    walker.x += walker.vx * dt;
    walker.y += walker.vy * dt;

    // The sprite grows from its bottom centre, so the edges move out.
    const spread = (walker.w * (scale - 1)) / 2;
    const width = this.viewportWidth();
    let bump = false;
    if (walker.x - spread < 0 && walker.vx < 0) {
      walker.x = spread;
      walker.vx *= -0.8;
      bump = true;
    } else if (walker.x + walker.w + spread > width && walker.vx > 0) {
      walker.x = width - walker.w - spread;
      walker.vx *= -0.8;
      bump = true;
    }
    const top = walker.y + walker.h * (1 - scale);
    if (top < 0 && walker.vy < 0) {
      walker.y = walker.h * (scale - 1);
      walker.vy *= -0.4;
    }
    if (balloon && walker.vx) walker.facing = walker.vx > 0 ? 1 : -1;

    if (walker.y >= this.groundY(walker)) {
      walker.y = this.groundY(walker);
      if (!balloon) {
        this.touchDown(walker);
        return;
      }
      // Every bounce lets some air out; with too little left, it lands.
      walker.air -= 0.14;
      if (walker.air <= 0.1) {
        this.deflate(walker);
        return;
      }
      walker.vy = -(380 + 520 * walker.air);
      walker.vx *= 0.88;
      walker.squash = 1;
      bump = true;
    }
    if (bump) this.sfx.play('boing');
    if (balloon) walker.air = Math.max(0.12, walker.air - 0.04 * dt);

    walker.squash = Math.max(0, walker.squash - dt * 5);
    const sx = scale * (1 + walker.squash * 0.3);
    const sy = scale * (1 - walker.squash * 0.3);
    if (walker.body) walker.body.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    walker.el?.style.setProperty('--puff', scale.toFixed(3));
    // Let go: falling, it only feels the air, so the body wobbles back into shape.
    if (!balloon) this.flop(walker, -walker.vx * AIR_DRAG, -walker.vy * AIR_DRAG, dt);
  }

  /** Out of air: back to normal size, standing on the ground. */
  private deflate(walker: Walker): void {
    this.settle(walker);
    walker.h = walker.standH;
    walker.air = 0;
    this.land(walker);
    this.say(walker, '😮‍💨', 1400);
  }

  /** A thrown or dropped pet hits the ground. */
  private touchDown(walker: Walker): void {
    const hard = walker.vy > 1300;
    this.settle(walker);
    this.setMode(walker, 'jump', 650);
    if (walker.furious) {
      walker.furious = false;
      this.later(650, () => {
        if (walker.mode !== 'jump' && walker.mode !== 'idle') return;
        this.say(walker, '😾', 1200);
        this.runTo(walker, walker.x < this.viewportWidth() / 2 ? 0.95 : 0.03);
      });
    } else if (hard) {
      this.say(walker, '😵', 1200);
    }
  }

  private settle(walker: Walker): void {
    walker.vx = 0;
    walker.vy = 0;
    walker.squash = 0;
    walker.rag = null;
    if (walker.body) walker.body.style.transform = '';
    walker.el?.style.removeProperty('--puff');
  }

  /** Picked up by the scruff: dangles from the pointer, kicking its legs. */
  private lift(walker: Walker): void {
    const grab = walker.grab!;
    grab.lifted = true;
    grab.liftedAt = performance.now();
    grab.frameX = grab.x;
    grab.frameY = grab.y;
    // A pet woken up or already cross is more likely to scratch.
    walker.furious = walker.mode === 'sleep' || walker.mode === 'angry';
    this.release(walker);
    this.settle(walker);
    walker.rag = new Ragdoll(walker.pet.art.rig);
    this.setMode(walker, 'held', Infinity);
    this.say(walker, walker.furious ? '😾' : '❗', 900);
    this.sfx.play('pop');
  }

  private hold(walker: Walker, now: number, dt: number): void {
    const grab = walker.grab;
    if (!grab) {
      this.toss(walker, 0, 0);
      return;
    }
    // The pointer stopped: its speed fades out.
    if (now - grab.at > 60) {
      grab.vx *= 0.8;
      grab.vy *= 0.8;
    }
    // How the hand moves this frame: its velocity and acceleration.
    const step = Math.max(dt, 1 / 240);
    const vx = grab.hvx + ((grab.x - grab.frameX) / step - grab.hvx) * 0.4;
    const vy = grab.hvy + ((grab.y - grab.frameY) / step - grab.hvy) * 0.4;
    grab.ax += (clamp((vx - grab.hvx) / step, -9000, 9000) - grab.ax) * 0.3;
    grab.ay += (clamp((vy - grab.hvy) / step, -9000, 9000) - grab.ay) * 0.3;
    [grab.hvx, grab.hvy, grab.frameX, grab.frameY] = [vx, vy, grab.x, grab.y];

    // The scruff stays in the hand; the body dangles and bends below it,
    // feeling gravity minus the hand's acceleration (and some air drag).
    const [sx, sy] = this.scruff(walker);
    walker.x = grab.x - walker.w * sx;
    walker.y = grab.y - walker.h * sy;
    this.flop(walker, -grab.ax - grab.hvx * AIR_DRAG, HOLD_GRAVITY - grab.ay - grab.hvy * AIR_DRAG, dt);
    this.setPose(walker.pet.id, WALK_CYCLE[Math.floor(now / 110) % WALK_CYCLE.length]);

    // Nobody likes being held for long, let alone shaken: sometimes it scratches.
    const shaking = Math.hypot(grab.vx, grab.vy) > 1600;
    const temper = 0.2 + (shaking ? 1.2 : 0) + (walker.furious ? 0.5 : 0);
    if (now - grab.liftedAt > 700 && Math.random() < temper * dt) this.scratch(walker, grab);
  }

  /** The back of the neck, as a fraction of the sprite box (the head is at the front). */
  private scruff(walker: Walker): [number, number] {
    const { rig, frames } = walker.pet.art;
    const x = rig.neck / frames.stand[0].length;
    return [walker.facing === 1 ? x : 1 - x, (rig.spine - 3) / frames.stand.length];
  }

  /**
   * Runs the ragdoll (see Ragdoll) with the acceleration its body feels, in
   * screen px/s², and bends the drawn pieces to match.
   */
  private flop(walker: Walker, ax: number, ay: number, dt: number): void {
    const rag = walker.rag;
    if (!rag) return;
    const scale = walker.w / walker.pet.art.frames.stand[0].length;
    // Small steps keep the springs steady even on a slow frame.
    // Even a wild yank only pulls so hard: it bends a lot, it doesn't tangle up.
    const pull = Math.hypot(ax, ay);
    if (pull > MAX_PULL) [ax, ay] = [(ax / pull) * MAX_PULL, (ay / pull) * MAX_PULL];
    const steps = Math.max(1, Math.ceil(dt / RAG_STEP));
    for (let i = 0; i < steps; i++) rag.update(dt / steps, (ax / scale) * walker.facing, ay / scale);
    const pieces = walker.el?.querySelectorAll<HTMLElement>('app-pet-ragdoll .piece');
    if (!pieces?.length) return;
    const transforms = rag.transforms(scale);
    pieces.forEach((piece, i) => (piece.style.transform = transforms[i] ?? ''));
  }

  /** Swipes at the hand holding it and wriggles free. */
  private scratch(walker: Walker, grab: Grab): void {
    walker.grab = null;
    if (walker.el?.hasPointerCapture(grab.pointerId)) walker.el.releasePointerCapture(grab.pointerId);
    const at = performance.now();
    this.scratches.update((marks) => [...marks, { x: grab.x, y: grab.y, at }]);
    this.later(900, () => this.scratches.update((marks) => marks.filter((m) => m.at !== at)));
    this.sfx.play('scratch');
    this.sfx.play(walker.pet.id === 'pichu' ? 'woof' : 'hiss');
    this.window?.navigator.vibrate?.(120);
    this.say(walker, `💢 ${GRUMBLE[walker.pet.id]}`, 1300);
    walker.furious = true;
    this.toss(walker, grab.vx * 0.3, -350);
  }

  private toss(walker: Walker, vx: number, vy: number): void {
    walker.vx = clamp(vx, -1600, 1600);
    walker.vy = clamp(vy, -1600, 1600);
    this.setMode(walker, 'fall', Infinity);
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
    if (walker.mode === 'bounce' || walker.mode === 'fall') {
      this.fly(walker, dt);
    } else if (walker.mode === 'held') {
      this.hold(walker, now, dt);
    } else if (walker.mode === 'drop') {
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
    } else if (walker.mode === 'pee') {
      if (now > walker.until) {
        this.say(walker, '😌', 1500);
        this.decide(walker);
      }
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
    if (walker.pet.art.pee && this.mayPee() && Math.random() < 0.12) {
      this.pee(walker);
      return;
    }
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

  /** Sprite for a pet right now: blown up, leg lifted, or its current pose. */
  protected frameOf(pet: Pet, mode: Mode, pose: PetPose): PixelFrame {
    if (mode === 'bounce' && pet.art.ball) return pet.art.ball;
    if (mode === 'pee' && pet.art.pee) return pet.art.pee;
    return pet.art.frames[pose];
  }

  /** Not too often, and one puddle at a time. */
  private mayPee(): boolean {
    return !this.still && performance.now() - this.lastPee > PEE_MS + DRY_MS && this.puddles().length === 0;
  }

  /** Leg up for a wee: the puddle grows under its back paws. */
  private pee(walker: Walker): void {
    const now = performance.now();
    this.lastPee = now;
    // Where the stream lands, just behind the hind paws (see PeeStream).
    const behind = 2.3 / 24;
    const landing = walker.x + walker.w * (walker.facing === 1 ? behind : 1 - behind);
    // The pool spreads mostly behind the dog, not under it.
    const x = landing - walker.facing * 17;
    const puddle = makePuddle(++this.puddleCount, x, walker.y + walker.h - 1, walker.facing, now);
    walker.puddle = puddle;
    this.puddles.update((all) => [...all, puddle]);
    this.say(walker, '💦', 1200);
    this.sfx.play('pee');
    this.setMode(walker, 'pee', PEE_MS);
  }

  /** The wee is over (done, or interrupted): the puddle starts drying up. */
  private stopPeeing(walker: Walker): void {
    const puddle = walker.puddle;
    if (!puddle) return;
    walker.puddle = null;
    const t = Math.min(1, (performance.now() - puddle.startedAt) / PEE_MS);
    // Roughly where the growing animation (an ease-out) had got to.
    const grown = Math.max(0.08, 1 - (1 - t) ** 2.4);
    this.puddles.update((all) => all.map((p) => (p.id === puddle.id ? { ...p, drying: true, grown } : p)));
    this.later(DRY_MS + 200, () => this.puddles.update((all) => all.filter((p) => p.id !== puddle.id)));
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
      // Whatever happened meanwhile, nobody may stay inside the (invisible) brawl.
      const fighters = [a, b].filter((w) => w.mode === 'brawl');
      if (fighters.length === 0) return;
      this.brawl.set(null);
      for (const w of fighters) {
        this.release(w);
        this.setMode(w, 'idle', 0);
      }
      // Out of the dust cloud, each one runs off its own way.
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
    // A plan made earlier doesn't apply to a pet in someone's hand or in the air.
    if (BUSY.includes(walker.mode)) return;
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
    if (walker.mode === 'pee' && mode !== 'pee') this.stopPeeing(walker);
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
      if (walker.mode !== 'bounce') walker.standH = walker.h;
      if (!BUSY.includes(walker.mode) || walker.mode === 'brawl') walker.y = this.groundY(walker);
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
    body: null, standH: 51, vx: 0, vy: 0, air: 0, squash: 0, grab: null, furious: false, rag: null, puddle: null,
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
