import { afterNextRender, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { CREW, OBJECT_EMOJI } from '../crew/crew';
import { PetService } from '../pets/pet.service';
import { PETS } from '../pets/pets';
import { PARACHUTE } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { RocketShip } from '../rockets/rocket-ship';
import { SfxService } from '../sfx/sfx.service';
import { PastaPlanet } from '../space/pasta-planet';
import { IntroService } from './intro.service';
import { Warpfield } from './warpfield';

type Stage = 'ready' | 'countdown' | 'launch' | 'warp' | 'arrive' | 'leaving';

const SEEN_KEY = 'macarrones.intro';
/** How fast the stars fly at each stage (0 = still, 1 = normal cruise). */
const STAR_SPEED: Record<Stage, number> = { ready: 0.6, countdown: 0.8, launch: 2.5, warp: 22, arrive: 0.6, leaving: 0.6 };

/**
 * Opening show, once per session on the welcome page: countdown, the crew
 * taking off in formation, jump to hyperspace past the pasta planets (the pets
 * bail out in parachutes) and arrival at "Macarrones". Skippable, and it can
 * be replayed from the welcome page (IntroService).
 */
@Component({
  selector: 'app-intro',
  imports: [RocketShip, PixelSprite, PastaPlanet],
  templateUrl: './intro.html',
  styleUrl: './intro.css',
  host: { '(document:keydown.escape)': 'skip()' },
})
export class Intro {
  private readonly document = inject(DOCUMENT);
  private readonly sfx = inject(SfxService);
  private readonly petService = inject(PetService);

  protected readonly visible = signal(false);
  protected readonly stage = signal<Stage>('ready');
  protected readonly count = signal(3);
  protected readonly crew = CREW.map((member, i) => ({
    member,
    uid: 9000 + i,
    label: [member.delante, member.detras].flatMap((o) => (o ? [OBJECT_EMOJI[o]] : [])).join(''),
    pet: PETS.find((pet) => pet.owner.id === member.id)!,
  }));
  protected readonly parachute = PARACHUTE;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('stars');
  private readonly launchButton = viewChild<ElementRef<HTMLButtonElement>>('launchButton');
  private warpfield: Warpfield | null = null;
  private readonly timers: number[] = [];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.stop());
    afterNextRender(() => {
      if (this.shouldShow()) this.open();
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
    this.visible.set(true);
    this.document.body.style.overflow = 'hidden';
    // The dialog is rendered in the next tick.
    this.later(0, () => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas) this.warpfield = new Warpfield(canvas, () => STAR_SPEED[this.stage()]);
      this.launchButton()?.nativeElement.focus();
    });
  }

  protected launch(): void {
    if (this.stage() !== 'ready') return;
    this.stage.set('countdown');
    this.sfx.play('beep');
    this.later(750, () => this.tick(2));
    this.later(1500, () => this.tick(1));
    this.later(2250, () => {
      this.sfx.play('go');
      this.sfx.play('launch');
      this.stage.set('launch');
    });
    this.later(4200, () => {
      this.sfx.play('warp');
      this.stage.set('warp');
    });
    this.later(5800, () => {
      this.sfx.play('arrive');
      this.stage.set('arrive');
    });
    this.later(7600, () => this.skip());
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

  private tick(n: number): void {
    this.count.set(n);
    this.sfx.play('beep');
  }

  /** The pets bailed out in hyperspace: they parachute onto the page now. */
  private dropPets(): void {
    const width = this.document.defaultView?.innerWidth ?? 800;
    PETS.forEach((pet, i) => this.petService.drop(pet.id, ((i + 0.5) / PETS.length) * width, 40 + (i % 2) * 50));
  }

  private shouldShow(): boolean {
    const window = this.document.defaultView;
    if (window?.location.pathname !== '/') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      return window.sessionStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  }

  private remember(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Without storage the intro may show again after a reload.
    }
  }

  private stop(): void {
    this.timers.forEach((id) => this.document.defaultView?.clearTimeout(id));
    this.timers.length = 0;
    this.warpfield?.stop();
    this.warpfield = null;
    this.document.body.style.overflow = '';
  }

  private later(ms: number, fn: () => void): void {
    const id = this.document.defaultView?.setTimeout(fn, ms);
    if (id !== undefined) this.timers.push(id);
  }
}
