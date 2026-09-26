import { afterNextRender, Component, computed, DOCUMENT, inject, input, output, signal } from '@angular/core';

const SPIN_MS = 4500;
const RESULT_PAUSE_MS = 1500;
const FULL_TURNS = 6;
const LABEL_MAX_LENGTH = 10;
/** Light fills: dark text on them keeps AA contrast. */
const COLORS = ['#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6', '#a0c4ff', '#ffadad'];

interface Segment {
  path: string;
  color: string;
  label: string;
  labelTransform: string;
}

/**
 * Decorative wheel: the winner is already decided (by the database), the wheel
 * only spins until it lands on it. Emits `done` once the result has been shown.
 */
@Component({
  selector: 'app-roulette',
  template: `
    <div class="text-center">
      <h3 class="h5 mb-3">{{ title() }}</h3>

      <div class="roulette mx-auto">
        <div class="pointer" aria-hidden="true"></div>
        <svg
          viewBox="-100 -100 200 200"
          class="wheel"
          aria-hidden="true"
          [style.transform]="'rotate(' + rotation() + 'deg)'"
          [style.transition-duration.ms]="spinMs"
          (transitionend)="finish()"
        >
          @if (names().length === 1) {
            <circle r="98" [attr.fill]="colors[0]" stroke="#fff" stroke-width="1" />
            <text y="-60" text-anchor="middle" dominant-baseline="middle" class="label">{{ segments()[0].label }}</text>
          } @else {
            @for (segment of segments(); track $index) {
              <path [attr.d]="segment.path" [attr.fill]="segment.color" stroke="#fff" stroke-width="1" />
              <text [attr.transform]="segment.labelTransform" text-anchor="end" dominant-baseline="middle" class="label">
                {{ segment.label }}
              </text>
            }
          }
          <circle r="12" fill="#fff" stroke="#adb5bd" stroke-width="1" />
        </svg>
      </div>

      <p class="h4 mt-3 mb-0 result" aria-live="polite">
        @if (finished()) {
          {{ names()[winnerIndex()] }}
        }
      </p>
    </div>
  `,
  styles: `
    .roulette {
      position: relative;
      width: min(80vw, 280px);
      aspect-ratio: 1;
    }
    .wheel {
      width: 100%;
      height: 100%;
      transition-property: transform;
      transition-timing-function: cubic-bezier(0.15, 0.85, 0.2, 1);
    }
    .pointer {
      position: absolute;
      top: -8px;
      left: 50%;
      z-index: 1;
      transform: translateX(-50%);
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-top: 24px solid var(--bs-danger);
    }
    .label {
      fill: #212529;
      font-size: 11px;
      font-weight: 600;
    }
    .result {
      min-height: 1.5em;
    }
  `,
})
export class Roulette {
  private readonly window = inject(DOCUMENT).defaultView;

  readonly title = input.required<string>();
  readonly names = input.required<string[]>();
  readonly winnerIndex = input.required<number>();
  readonly done = output();

  protected readonly colors = COLORS;
  protected readonly rotation = signal(0);
  protected readonly finished = signal(false);
  protected readonly spinMs = this.prefersReducedMotion() ? 0 : SPIN_MS;

  protected readonly segments = computed<Segment[]>(() => {
    const names = this.names();
    const size = 360 / names.length;
    return names.map((name, i) => {
      const start = i * size;
      const end = start + size;
      const middle = start + size / 2;
      return {
        path: `M 0 0 L ${point(start)} A 98 98 0 ${size > 180 ? 1 : 0} 1 ${point(end)} Z`,
        color: COLORS[i % COLORS.length],
        label: name.length > LABEL_MAX_LENGTH ? `${name.slice(0, LABEL_MAX_LENGTH - 1)}…` : name,
        labelTransform: `rotate(${middle - 90}) translate(90 0)`,
      };
    });
  });

  constructor() {
    afterNextRender(() => {
      const size = 360 / this.names().length;
      const middle = (this.winnerIndex() + 0.5) * size;
      // Land somewhere inside the winner's segment, not always at its center.
      const jitter = (Math.random() - 0.5) * size * 0.6;
      const target = FULL_TURNS * 360 - middle + jitter;

      if (this.spinMs === 0) {
        this.rotation.set(target);
        this.finish();
      } else {
        // Next frame, so the browser animates from 0 to the target.
        this.window?.requestAnimationFrame(() => this.rotation.set(target));
      }
    });
  }

  protected finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.window?.setTimeout(() => this.done.emit(), RESULT_PAUSE_MS);
  }

  private prefersReducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}

/** Point on the wheel edge; angles are clockwise from the top (the pointer). */
function point(angle: number): string {
  const radians = (angle * Math.PI) / 180;
  return `${(98 * Math.sin(radians)).toFixed(2)} ${(-98 * Math.cos(radians)).toFixed(2)}`;
}
