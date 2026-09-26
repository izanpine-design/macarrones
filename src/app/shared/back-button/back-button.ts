import { Component, DestroyRef, DOCUMENT, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const ARMED_MS = 4000;

/**
 * "← Menú de juegos" pill. With `link` it navigates; without, it emits `go`.
 * With `confirmLabel`, the first press only asks ("¿Salir de la sala?") and a
 * second press within a few seconds confirms.
 */
@Component({
  selector: 'app-back-button',
  imports: [RouterLink],
  template: `
    @if (link(); as target) {
      <a class="back" [routerLink]="target">
        <span class="back__arrow" aria-hidden="true">←</span>
        {{ label() }}
      </a>
    } @else {
      <button type="button" class="back" [class.back--armed]="armed()" [disabled]="busy()" (click)="press()">
        <span class="back__arrow" aria-hidden="true">←</span>
        {{ armed() ? confirmLabel() : label() }}
      </button>
    }
  `,
  styles: `
    :host { display: inline-block; }
    .back {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      gap: .5rem;
      padding: .45rem 1.05rem .45rem .5rem;
      border: 2px solid var(--game-accent, #a9503e);
      border-radius: 999px;
      color: var(--game-accent, #8b4335);
      background: rgb(255 255 255 / 85%);
      font: inherit;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      transition: transform 160ms ease, background-color 160ms ease, color 160ms ease;
    }
    .back__arrow {
      display: grid;
      width: 1.8rem;
      height: 1.8rem;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: var(--game-accent, #a9503e);
      transition: transform 160ms ease;
    }
    .back:hover { transform: translateX(-3px); }
    .back:hover .back__arrow { transform: translateX(-3px); }
    .back:focus-visible { outline: 3px solid var(--game-accent, #a9503e); outline-offset: 3px; }
    .back--armed { color: #fff; background: var(--game-accent, #a9503e); border-color: var(--game-accent, #a9503e); }
    .back--armed .back__arrow { color: var(--game-accent, #a9503e); background: #fff; }
    .back:disabled { opacity: .6; cursor: progress; }
    @media (prefers-reduced-motion: reduce) { .back, .back__arrow { transition: none; } }
  `,
})
export class BackButton {
  private readonly window = inject(DOCUMENT).defaultView;

  readonly label = input('Menú de juegos');
  readonly link = input<string | null>(null);
  readonly confirmLabel = input<string | null>(null);
  readonly busy = input(false);
  readonly go = output();

  protected readonly armed = signal(false);
  private timer: number | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.window?.clearTimeout(this.timer));
  }

  protected press(): void {
    if (this.confirmLabel() && !this.armed()) {
      this.armed.set(true);
      this.timer = this.window?.setTimeout(() => this.armed.set(false), ARMED_MS);
      return;
    }
    this.window?.clearTimeout(this.timer);
    this.armed.set(false);
    this.go.emit();
  }
}
