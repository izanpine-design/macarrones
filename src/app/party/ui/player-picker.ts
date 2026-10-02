import { Component, computed, inject, input, output } from '@angular/core';
import { ProfileService } from '../../core/profile.service';
import { CrewHead } from '../../shared/crew/crew-head';
import { PartyPlayer } from '../party.model';

/** Grid of players to vote / choose one, with their face. */
@Component({
  selector: 'app-player-picker',
  imports: [CrewHead],
  template: `
    <div class="picker" role="group" [attr.aria-label]="label()">
      @for (p of options(); track p.user_id) {
        <button
          type="button"
          class="picker__option"
          [class.picker__option--on]="p.user_id === selected()"
          [attr.aria-pressed]="p.user_id === selected()"
          [disabled]="disabled()"
          (click)="pick.emit(p.user_id)"
        >
          <app-crew-head class="picker__head" [crew]="profiles.lookFor(p.user_id)" [nickname]="p.apodo" />
          <span class="picker__name">{{ p.apodo }}{{ p.user_id === me() ? ' (tú)' : '' }}</span>
          @if (badge()[p.user_id]; as text) {
            <span class="picker__badge">{{ text }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .picker {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
      gap: 0.5rem;
    }
    .picker__option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 0.25rem;
      border: 2px solid var(--bs-border-color);
      border-radius: 14px;
      background: var(--bs-body-bg);
      color: var(--bs-body-color);
      font-weight: 600;
    }
    .picker__option:hover:not(:disabled) {
      border-color: var(--bs-primary);
    }
    .picker__option--on {
      border-color: var(--bs-primary);
      background: var(--bs-primary-bg-subtle);
    }
    .picker__option:focus-visible {
      outline: 3px solid var(--bs-primary);
      outline-offset: 2px;
    }
    .picker__head {
      width: 52px;
    }
    .picker__name {
      max-width: 100%;
      overflow: hidden;
      font-size: 0.85rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .picker__badge {
      font-size: 0.75rem;
      font-weight: 700;
    }
  `,
})
export class PlayerPicker {
  protected readonly profiles = inject(ProfileService);

  readonly players = input.required<readonly PartyPlayer[]>();
  readonly label = input.required<string>();
  readonly selected = input<string | null>(null);
  /** Players not offered (e.g. yourself). */
  readonly exclude = input<readonly string[]>([]);
  readonly disabled = input(false);
  readonly me = input<string | null>(null);
  /** Extra text under some players (e.g. "2 votos"). */
  readonly badge = input<Record<string, string>>({});
  readonly pick = output<string>();

  protected readonly options = computed(() => this.players().filter((p) => !this.exclude().includes(p.user_id)));
}
