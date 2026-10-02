import { Component, computed, DestroyRef, DOCUMENT, effect, inject, input, output, signal } from '@angular/core';

/** Time left until `terminaEn` (epoch ms). Emits `expired` once when it reaches 0. */
@Component({
  selector: 'app-countdown',
  template: `
    <p class="countdown" [class.countdown--low]="seconds() <= 10" role="timer" [attr.aria-label]="'Quedan ' + label()">
      <span aria-hidden="true">⏱️</span> {{ label() }}
    </p>
  `,
  styles: `
    .countdown {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .countdown--low {
      color: var(--bs-danger-text-emphasis);
    }
  `,
})
export class Countdown {
  private readonly window = inject(DOCUMENT).defaultView;

  readonly terminaEn = input.required<number | null>();
  readonly expired = output<void>();

  private readonly now = signal(Date.now());
  private fired: number | null = null;

  protected readonly seconds = computed(() => {
    const end = this.terminaEn();
    return end === null ? 0 : Math.max(0, Math.ceil((end - this.now()) / 1000));
  });
  protected readonly label = computed(() => {
    const s = this.seconds();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    const timer = this.window?.setInterval(() => this.now.set(Date.now()), 500);
    inject(DestroyRef).onDestroy(() => this.window?.clearInterval(timer));
    effect(() => {
      const end = this.terminaEn();
      if (end !== null && this.seconds() === 0 && this.fired !== end) {
        this.fired = end;
        this.expired.emit();
      }
    });
  }
}
