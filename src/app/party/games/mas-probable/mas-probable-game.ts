import { Component, computed, inject } from '@angular/core';
import { PartyStore } from '../../party-store';
import { PlayerPicker } from '../../ui/player-picker';
import { tally } from '../shared.logic';
import { MasProbableState, quienesBeben, revelar, siguiente, situacionActual, votar } from './mas-probable.logic';

@Component({
  selector: 'app-mas-probable-game',
  imports: [PlayerPicker],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        <p class="h3 text-center mb-4" aria-live="polite">{{ situacion() }}</p>

        @if (s.fase === 'votando') {
          <app-player-picker
            label="¿A quién señalas?"
            [players]="store.players()"
            [me]="store.me"
            [selected]="miVoto()"
            [disabled]="store.busy()"
            (pick)="vote($event)"
          />
          <p class="small text-body-secondary text-center mt-3 mb-2" aria-live="polite">
            Han votado {{ votados() }} de {{ store.players().length }}.
            {{ miVoto() ? 'Puedes cambiar tu voto hasta que se revele.' : 'Vota en secreto: se verá al final.' }}
          </p>
          <button type="button" class="btn btn-outline-secondary w-100" [disabled]="store.busy() || votados() === 0" (click)="reveal()">
            Revelar ya
          </button>
        } @else {
          <ul class="list-group mb-3" aria-label="Votos">
            @for (row of resultados(); track row.userId) {
              <li class="list-group-item d-flex justify-content-between align-items-center">
                {{ store.nameOf(row.userId) }}
                <span class="badge rounded-pill" [class]="beben().includes(row.userId) ? 'text-bg-danger' : 'text-bg-secondary'">
                  {{ row.votos }} {{ row.votos === 1 ? 'voto' : 'votos' }}
                </span>
              </li>
            }
          </ul>
          <p class="h5 text-center mb-3" role="status">
            <span aria-hidden="true">🍺</span> Bebe{{ beben().length > 1 ? 'n' : '' }}: {{ bebenNombres() }}
          </p>
          <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">
            Siguiente situación <span aria-hidden="true">→</span>
          </button>
        }
      </div>
    </div>
  `,
})
export class MasProbableGame {
  protected readonly store = inject(PartyStore) as PartyStore<MasProbableState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly situacion = computed(() => situacionActual(this.state()) ?? 'No hay situaciones en este lote.');
  protected readonly miVoto = computed(() => this.state().votos[this.store.me] ?? null);
  protected readonly votados = computed(() => Object.keys(this.state().votos).length);
  protected readonly resultados = computed(() => tally(this.state().votos));
  protected readonly beben = computed(() => quienesBeben(this.state()));
  protected readonly bebenNombres = computed(() => this.beben().map((id) => this.store.nameOf(id)).join(', '));

  protected async vote(userId: string): Promise<void> {
    this.announce(await this.store.act(votar(this.state().indice, userId)));
  }

  protected async reveal(): Promise<void> {
    this.announce(await this.store.act(revelar(this.state().indice)));
  }

  protected next(): void {
    void this.store.act(siguiente(this.state().indice));
  }

  /** Whoever closed the vote tells the room who drinks. */
  private announce(result: { before: MasProbableState; after: MasProbableState } | null): void {
    if (result?.before.fase !== 'votando' || result.after.fase !== 'resultado') return;
    for (const userId of quienesBeben(result.after)) {
      void this.store.drink(userId, 'Ha sido el más votado').catch(() => undefined);
    }
  }
}
