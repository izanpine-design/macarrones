import { Component, computed, input } from '@angular/core';
import { ranking } from '../games/shared.logic';
import { PartyPlayer } from '../party.model';

let nextId = 0;

/** Points of every player, highest first. */
@Component({
  selector: 'app-scoreboard',
  template: `
    <div [attr.aria-labelledby]="titleId" role="group">
      <h3 [id]="titleId" class="h6 text-uppercase text-body-secondary mb-2">{{ title() }}</h3>
      <ol class="list-group list-group-numbered">
        @for (row of rows(); track row.userId) {
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="ms-2 me-auto">
              {{ row.apodo }}
              @if (final() && row.puntos > 0 && row.puntos === top()) {
                <span aria-hidden="true">🏆</span>
              }
            </span>
            <span class="badge text-bg-primary rounded-pill">{{ row.puntos }} {{ row.puntos === 1 ? 'punto' : 'puntos' }}</span>
          </li>
        }
      </ol>
    </div>
  `,
})
export class Scoreboard {
  readonly puntos = input.required<Record<string, number>>();
  readonly players = input.required<readonly PartyPlayer[]>();
  readonly title = input('Puntuación');
  /** Shows the trophy for the winner. */
  readonly final = input(false);

  protected readonly titleId = `scoreboard-${nextId++}`;
  protected readonly rows = computed(() => ranking(this.puntos(), this.players()));
  /** Highest score: everybody tied on it gets the trophy. */
  protected readonly top = computed(() => this.rows()[0]?.puntos ?? 0);
}
