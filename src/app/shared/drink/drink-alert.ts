import { NgOptimizedImage } from '@angular/common';
import { afterRenderEffect, Component, computed, DOCUMENT, effect, ElementRef, inject, input, untracked, viewChild } from '@angular/core';
import { CrewHead } from '../crew/crew-head';
import { crewForNickname } from '../crew/crew';
import { PET_BY_ID } from '../pets/pets';
import { BEER_MUG, BEER_PALETTE } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { SfxService } from '../sfx/sfx.service';
import { DrinkService } from './drink.service';

/** Seconds before the alert closes by itself. */
const AUTO_CLOSE_MS = 9000;

const CONFETTI = ['🍝', '🍺', '🎉', '🍻', '🍝', '🥂', '🍺', '🎊', '🍝', '🍻', '🎉', '🍺'];

const REASONS = {
  rajado: 'Se ha rajado',
  no_cumple: 'No ha cumplido el reto',
} as const;

/**
 * "¡A beber, X!": shown to everybody in the room when someone has to drink.
 * The meme photo gets the drinker's face pasted on, next to their pet.
 */
@Component({
  selector: 'app-drink-alert',
  imports: [NgOptimizedImage, CrewHead, PixelSprite],
  templateUrl: './drink-alert.html',
  styleUrl: './drink-alert.css',
})
export class DrinkAlert {
  private readonly drinks = inject(DrinkService);
  private readonly sfx = inject(SfxService);
  private readonly document = inject(DOCUMENT);

  /** Room whose calls to listen to. */
  readonly roomId = input.required<string>();

  protected readonly call = this.drinks.call;
  protected readonly crew = computed(() => {
    const call = this.call();
    return call ? crewForNickname(call.apodo) : null;
  });
  protected readonly name = computed(() => this.crew()?.nombre ?? this.call()?.apodo ?? '');
  protected readonly pet = computed(() => {
    const crew = this.crew();
    return crew ? (PET_BY_ID.get(crew.mascota) ?? null) : null;
  });
  protected readonly reason = computed(() => {
    const call = this.call();
    return call ? `${REASONS[call.reason]} · lo dice ${call.por}` : '';
  });
  protected readonly accent = computed(() => this.crew()?.color ?? '#ffcf75');
  protected readonly mug = BEER_MUG;
  protected readonly mugPalette = BEER_PALETTE;
  protected readonly confetti = CONFETTI.map((icon, i) => ({
    icon,
    left: (i * 83) % 100,
    delay: -(i * 0.37) % 2.4,
    duration: 2.2 + (i % 4) * 0.35,
  }));

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private timer: number | undefined;

  constructor() {
    effect((onCleanup) => {
      const leave = this.drinks.join(this.roomId());
      onCleanup(leave);
    });

    // A new call: open as a modal dialog (above everything, focus on "¡Salud!",
    // Escape closes), play the sound and close by itself after a while.
    // After render, so the dialog content exists when it opens.
    afterRenderEffect(() => {
      const call = this.call();
      const dialog = this.dialog().nativeElement;
      untracked(() => {
        this.window()?.clearTimeout(this.timer);
        if (!call) {
          if (dialog.open) dialog.close();
          return;
        }
        if (!dialog.open) dialog.showModal();
        this.sfx.play('cheers');
        this.timer = this.window()?.setTimeout(() => this.close(), AUTO_CLOSE_MS);
      });
    });
  }

  protected close(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  /** The dialog closed (button, backdrop, Escape or timeout). */
  protected closed(): void {
    this.window()?.clearTimeout(this.timer);
    this.drinks.dismiss();
  }

  private window(): Window | null {
    return this.document.defaultView;
  }
}
