import { Component, computed, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { ProfileService } from '../../core/profile.service';
import { CrewObject, OBJECT_EMOJI } from '../crew/crew';
import { PetService } from '../pets/pet.service';
import { PET_BY_ID, PETS } from '../pets/pets';
import { PARACHUTE } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { RocketShip } from '../rockets/rocket-ship';
import { Sfx, SfxService } from '../sfx/sfx.service';
import { PastaPlanet } from '../space/pasta-planet';
import { IntroLogo, LOGO_LANDING, LOGO_STAGGER, LOGO_WORD } from './intro-logo';
import { IntroPlanet } from './intro-planet';
import { IntroScene } from './intro-scene';
import {
  cameraRise, CUE, flashAt, FLY_OUT, glowAt, heading, jumper, pose, rocketWidth, Screen, shakeAt, smoothstep, Stage,
  stageAt, starSpeed, tunnelAt,
} from './intro-timeline';
import { IntroService } from './intro.service';

const SEEN_KEY = 'macarrones.intro';
/** Where the engine is on the rocket drawing (240×150), from its centre. */
const ENGINE = { x: (64 - 120) / 240, y: (92 - 75) / 240 };

/** Something that happens once, at a moment of the show. */
interface Cue {
  at: number;
  run: () => void;
}

/**
 * Opening show: the players' rockets wait on a launch pad on the Parmesan
 * moon; countdown, liftoff with billowing smoke, an air show of loops with
 * coloured trails past the pasta planets, the pets bail out, the jump to
 * hyperspace through a fusilli tunnel and the arrival at planet Macarrones,
 * with the title dropping in letter by letter under macaroni confetti.
 *
 * The whole show is a timeline (see intro-timeline): every frame the rockets
 * are put exactly where the timeline says for that instant, so they move
 * continuously from one part to the next. Skippable, and it can be replayed
 * from the welcome page (IntroService).
 */
@Component({
  selector: 'app-intro',
  imports: [RocketShip, PixelSprite, PastaPlanet, IntroPlanet, IntroLogo],
  templateUrl: './intro.html',
  styleUrl: './intro.css',
  host: { '(document:keydown.escape)': 'skip()' },
})
export class Intro {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly sfx = inject(SfxService);
  private readonly petService = inject(PetService);
  private readonly profiles = inject(ProfileService);
  /** Reduced motion: no shaking, softer flashes, fewer particles. */
  private readonly calm = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected readonly visible = signal(false);
  protected readonly stage = signal<Stage>('ready');
  protected readonly count = signal(3);
  /** The pets ride along until they bail out before hyperspace. */
  protected readonly bailed = signal(false);
  protected readonly showPlay = signal(false);
  protected readonly parachute = PARACHUTE;

  /** The rockets of the show (up to 6): yours first, leading the formation. */
  protected readonly pilots = computed(() =>
    this.profiles.showcase().slice(0, 6).map((look, i) => ({
      look,
      uid: 9000 + i,
      label: objectLabel(look.delante, look.detras),
      pet: look.mascota ? (PET_BY_ID.get(look.mascota) ?? null) : null,
    })),
  );
  /** Flying off to the left at the end: drawn mirrored (the painted name flipped back). */
  protected readonly flipped = computed(() => {
    const leaving = this.stage() === 'arrive' || this.stage() === 'leaving';
    return this.pilots().map((_, i) => leaving && Math.cos((FLY_OUT[i % FLY_OUT.length] * Math.PI) / 180) < 0);
  });

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('scene');
  private readonly flash = viewChild<ElementRef<HTMLElement>>('flash');
  private readonly launchButton = viewChild<ElementRef<HTMLButtonElement>>('launchButton');
  private scene: IntroScene | null = null;
  private frame = 0;
  private openedAt = 0;
  private last = 0;
  /** When "¡Despegar!" was pressed (null while waiting on the pad). */
  private launchedAt: number | null = null;
  private lastT = -1;
  private cues: Cue[] = [];
  private readonly timers: number[] = [];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.stop());
    // Not on arrival: once the player has chosen their profile / guest nickname.
    const firstRuns = inject(IntroService).firstRuns;
    effect(() => {
      if (firstRuns() > 0) untracked(() => this.shouldShow() && this.open());
    });
    // "Ver presentación" on the welcome page: the user asked for it, so it
    // plays even with reduced motion or if it was already seen.
    const requests = inject(IntroService).requests;
    effect(() => {
      if (requests() > 0) untracked(() => this.open());
    });
  }

  private open(): void {
    if (this.visible()) return;
    this.stage.set('ready');
    this.count.set(3);
    this.bailed.set(false);
    this.showPlay.set(false);
    this.launchedAt = null;
    this.lastT = -1;
    this.visible.set(true);
    this.document.body.style.overflow = 'hidden';
    // The dialog is rendered in the next tick.
    this.later(0, () => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas) this.scene = new IntroScene(canvas, this.calm);
      this.openedAt = this.last = performance.now();
      this.frame = this.window?.requestAnimationFrame((now) => this.tick(now)) ?? 0;
      this.launchButton()?.nativeElement.focus();
    });
  }

  protected launch(): void {
    if (this.stage() !== 'ready') return;
    this.launchedAt = performance.now();
    this.lastT = -0.001;
    this.cues = this.program();
    this.stage.set('countdown');
  }

  protected skip(): void {
    if (!this.visible() || this.stage() === 'leaving') return;
    this.stage.set('leaving');
    this.remember();
    this.later(550, () => {
      this.stop();
      this.visible.set(false);
      this.dropPets();
    });
  }

  /** What happens when: sounds, the countdown, confetti… */
  private program(): Cue[] {
    const play = (sound: Sfx) => () => this.sfx.play(sound);
    const letters = [...LOGO_WORD].map((_, i) => ({ at: CUE.flash + LOGO_LANDING + i * LOGO_STAGGER, run: play('pop') }));
    return [
      { at: 0, run: play('beep') },
      { at: CUE.two, run: () => this.countTo(2) },
      { at: CUE.one, run: () => this.countTo(1) },
      { at: CUE.lift, run: () => this.liftoff() },
      { at: CUE.loop + 0.25, run: play('whoosh') },
      { at: CUE.loop + 0.85, run: play('whoosh') },
      { at: CUE.bail, run: () => this.bail() },
      { at: CUE.dive, run: play('warp') },
      { at: CUE.dive + 0.8, run: play('whoosh') },
      { at: CUE.flash, run: () => this.arrive() },
      ...letters,
      { at: CUE.flash + 1.9, run: () => this.celebrate() },
      { at: CUE.flyby + 0.25, run: play('whoosh') },
      { at: CUE.play, run: () => this.showPlay.set(true) },
      { at: CUE.end, run: () => this.skip() },
    ];
  }

  private countTo(n: number): void {
    this.count.set(n);
    this.sfx.play('beep');
  }

  private liftoff(): void {
    this.sfx.play('go');
    this.sfx.play('launch');
    // The pad disappears in a wall of smoke.
    const screen = this.screen();
    const deck = screen.height * 0.8;
    for (let k = 0; k <= 26; k++) this.scene?.groundSmoke(screen.width * (k / 26), deck, 2.2);
  }

  private bail(): void {
    this.bailed.set(true);
    this.sfx.play('pop');
  }

  private arrive(): void {
    this.sfx.play('boom');
    this.sfx.play('arrive');
    const { width, height } = this.screen();
    this.scene?.confetti(width / 2, height * 0.62, 90);
  }

  private celebrate(): void {
    this.sfx.play('fanfare');
    const { width, height } = this.screen();
    this.scene?.confetti(width * 0.2, height * 0.25, 45);
    this.scene?.confetti(width * 0.8, height * 0.25, 45);
  }

  private tick(now: number): void {
    this.frame = this.window?.requestAnimationFrame((next) => this.tick(next)) ?? 0;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const idle = (now - this.openedAt) / 1000;
    const t = this.launchedAt === null ? -1 : (now - this.launchedAt) / 1000;

    if (this.launchedAt !== null) {
      for (const cue of this.cues) if (cue.at > this.lastT && cue.at <= t) cue.run();
      this.lastT = t;
      if (this.stage() !== 'leaving' && stageAt(t) !== this.stage()) this.stage.set(stageAt(t));
    }

    const screen = this.screen();
    const camera = cameraRise(t, screen);
    this.placeRockets(t, idle, screen, camera);
    this.placeJumpers(t, screen);
    if (this.stage() === 'arrive' && t < CUE.end - 2 && Math.random() < 0.5) this.scene?.rain(1);
    this.scene?.render({ t: idle, dt, camera, speed: starSpeed(t), tunnel: tunnelAt(t), glow: glowAt(t) });

    const root = this.root()?.nativeElement;
    if (root) {
      const shake = this.calm ? 0 : shakeAt(t);
      root.style.translate = shake ? `${wobble(now, 0) * shake}px ${wobble(now, 1) * shake}px` : '';
    }
    const flash = this.flash()?.nativeElement;
    if (flash) flash.style.opacity = String(Math.min(this.calm ? 0.3 : 0.95, flashAt(t)));
  }

  /** Puts every rocket where the timeline says, and lets out its exhaust. */
  private placeRockets(t: number, idle: number, screen: Screen, camera: number): void {
    const root = this.root()?.nativeElement;
    if (!root) return;
    const width = rocketWidth(screen);
    const height = width * 0.625;
    root.style.setProperty('--w', `${width}px`);
    const pilots = this.pilots();
    root.querySelectorAll<HTMLElement>('.intro__pilot').forEach((el, i) => {
      const p = pose(i, t, screen, idle);
      const angle = heading(i, t, screen, idle);
      // Engines rumbling on the pad: a fine shiver, strongest at ignition.
      const rumble = t < 0 ? 0 : Math.min(1, t / CUE.lift) * 3 * (1 - smoothstep(CUE.lift, CUE.lift + 1.2, t));
      const x = p.x + Math.sin(t * 61 + i * 7) * rumble;
      const y = p.y + Math.sin(t * 73 + i * 3) * rumble;
      el.style.transform = `translate(${(x - width / 2).toFixed(1)}px, ${(y - height / 2).toFixed(1)}px)`;
      el.style.opacity = p.alpha.toFixed(3);
      const sx = p.scale * p.stretch * p.facing;
      const sy = p.scale / Math.sqrt(p.stretch);
      (el.firstElementChild as HTMLElement | null)?.style.setProperty(
        'transform',
        `rotate(${angle.toFixed(3)}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
      );
      const label = el.querySelector<HTMLElement>('.intro__label');
      if (label) {
        label.style.transform = `translate(-50%, ${((height / 2) * p.scale + 6).toFixed(1)}px) scale(${Math.max(p.scale, 0.8).toFixed(2)})`;
        label.style.opacity = (1 - smoothstep(CUE.lift, CUE.lift + 0.4, t)).toFixed(2);
      }

      const pilot = pilots[i];
      if (!this.scene || !pilot || p.alpha < 0.3) return;
      // Engine: its place on the turned and scaled drawing.
      const ex = ENGINE.x * width * sx;
      const ey = ENGINE.y * width * sy;
      const engineX = x + ex * Math.cos(angle) - ey * Math.sin(angle);
      const engineY = y + ex * Math.sin(angle) + ey * Math.cos(angle);
      const nose = angle + (p.facing === -1 ? Math.PI : 0);
      if (t >= CUE.lift - 0.2) {
        // Thick trails at liftoff, thinner in hyperspace and past the title at the end.
        const power = t < CUE.loop ? 1.4 : t >= CUE.flash ? 0.45 : t >= CUE.dive ? 0.5 : 1;
        this.scene.exhaust(engineX, engineY, nose + Math.PI, pilot.look.color, power);
      } else if (t >= CUE.two) {
        // Warming up: smoke gathering on the pad.
        if (Math.random() < 0.55) this.scene.groundSmoke(engineX, screen.height * 0.8 + camera - 4, smoothstep(CUE.two, CUE.lift, t) * 1.2);
      }
    });
  }

  /** The pets that bailed out, drifting away under their parachutes. */
  private placeJumpers(t: number, screen: Screen): void {
    if (!this.bailed()) return;
    const size = rocketWidth(screen) * 0.24;
    this.root()?.nativeElement.querySelectorAll<HTMLElement>('.intro__jumper').forEach((el) => {
      const j = jumper(Number(el.dataset['i']), t, screen);
      el.style.transform = `translate(${(j.x - size / 2).toFixed(1)}px, ${(j.y - size).toFixed(1)}px) rotate(${j.tilt.toFixed(3)}rad) scale(${j.scale.toFixed(2)})`;
      el.style.opacity = j.alpha.toFixed(2);
    });
  }

  /** The pets bailed out before hyperspace: they parachute onto the page now. */
  private dropPets(): void {
    const width = this.window?.innerWidth ?? 800;
    PETS.forEach((pet, i) => this.petService.drop(pet.id, ((i + 0.5) / PETS.length) * width, 40 + (i % 2) * 50));
  }

  private screen(): Screen {
    return { width: this.window?.innerWidth ?? 1024, height: this.window?.innerHeight ?? 768 };
  }

  private shouldShow(): boolean {
    if (!this.window || this.calm) return false;
    try {
      return this.window.sessionStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  }

  private remember(): void {
    try {
      this.window?.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Without storage the intro may show again after a reload.
    }
  }

  private stop(): void {
    this.timers.forEach((id) => this.window?.clearTimeout(id));
    this.timers.length = 0;
    this.window?.cancelAnimationFrame(this.frame);
    this.scene = null;
    this.document.body.style.overflow = '';
  }

  private later(ms: number, fn: () => void): void {
    const id = this.window?.setTimeout(fn, ms);
    if (id !== undefined) this.timers.push(id);
  }
}

function objectLabel(delante: CrewObject | null, detras: CrewObject | null): string {
  return [delante, detras].flatMap((o) => (o ? [OBJECT_EMOJI[o]] : [])).join('');
}

/** Smooth pseudo-random wobble in -1…1 for the screen shake. */
function wobble(now: number, axis: number): number {
  const s = now / 1000;
  return (Math.sin(s * 47 + axis * 3) + Math.sin(s * 71 + axis * 11)) / 2;
}
