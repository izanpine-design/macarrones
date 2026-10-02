import { Component, computed, inject, linkedSignal } from '@angular/core';
import { PartyStore } from '../../party-store';
import { categoriaActual, enviarOrden, ordenDelGrupo, revelar, siguiente, TierListState } from './tier-list.logic';

@Component({
  selector: 'app-tier-list-game',
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        <p class="text-center text-body-secondary mb-1">Ordenad de más a menos:</p>
        <p class="h3 text-center mb-4" aria-live="polite">{{ categoria() }}</p>

        @if (s.fase === 'ordenando') {
          <ol class="list-group list-group-numbered mb-3" aria-label="Tu orden">
            @for (id of orden(); track id; let i = $index; let last = $last) {
              <li class="list-group-item d-flex align-items-center gap-2">
                <span class="me-auto ms-2">{{ store.nameOf(id) }}{{ id === store.me ? ' (tú)' : '' }}</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="i === 0" [attr.aria-label]="'Subir a ' + store.nameOf(id)" (click)="moveUp(i)">↑</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="last" [attr.aria-label]="'Bajar a ' + store.nameOf(id)" (click)="moveDown(i)">↓</button>
              </li>
            }
          </ol>
          <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="send()">
            {{ enviado() ? 'Actualizar mi lista' : 'Enviar mi lista' }}
          </button>
          <p class="small text-body-secondary text-center mt-2 mb-2" aria-live="polite">
            {{ enviado() ? 'Lista enviada. ' : '' }}Han enviado {{ enviadas() }} de {{ store.players().length }}.
          </p>
          <button type="button" class="btn btn-outline-secondary w-100" [disabled]="store.busy() || enviadas() === 0" (click)="reveal()">Ver resultado ya</button>
        } @else {
          <h3 class="h6 text-uppercase text-body-secondary">Orden del grupo</h3>
          <ol class="list-group list-group-numbered mb-3">
            @for (row of grupo(); track row.userId) {
              <li class="list-group-item d-flex justify-content-between">
                <span class="ms-2 me-auto">{{ store.nameOf(row.userId) }}</span>
                <span class="small text-body-secondary">media {{ row.media.toFixed(1) }}</span>
              </li>
            }
          </ol>
          <details class="mb-3">
            <summary>Las listas de cada uno (¡a debatir!)</summary>
            <ul class="list-unstyled mt-2">
              @for (entry of listas(); track entry.de) {
                <li class="mb-1"><strong>{{ store.nameOf(entry.de) }}:</strong> {{ entry.orden }}</li>
              }
            </ul>
          </details>
          <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">Siguiente categoría <span aria-hidden="true">→</span></button>
        }
      </div>
    </div>
  `,
})
export class TierListGame {
  protected readonly store = inject(PartyStore) as PartyStore<TierListState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly categoria = computed(() => categoriaActual(this.state()) ?? 'No hay categorías en este lote.');

  /**
   * My list as last sent, or the room order (new players at the end). Only
   * changes when its content does, so other players' moves never reset the
   * list I am editing.
   */
  private readonly base = computed(
    () => {
      const ids = this.store.players().map((p) => p.user_id);
      const sent = (this.state().rankings[this.store.me] ?? []).filter((id) => ids.includes(id));
      return [...sent, ...ids.filter((id) => !sent.includes(id))];
    },
    { equal: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]) },
  );
  /** My list being edited. */
  protected readonly orden = linkedSignal(() => this.base());
  protected readonly enviado = computed(() => !!this.state().rankings[this.store.me]);
  protected readonly enviadas = computed(() => Object.keys(this.state().rankings).length);
  protected readonly grupo = computed(() => ordenDelGrupo(this.state(), this.store.players()));
  protected readonly listas = computed(() =>
    Object.entries(this.state().rankings).map(([de, orden]) => ({ de, orden: orden.map((id) => this.store.nameOf(id)).join(' > ') })),
  );

  protected moveUp(i: number): void {
    this.swap(i, i - 1);
  }

  protected moveDown(i: number): void {
    this.swap(i, i + 1);
  }

  protected send(): void {
    void this.store.act(enviarOrden(this.state().indice, this.orden()));
  }

  protected reveal(): void {
    void this.store.act(revelar(this.state().indice));
  }

  protected next(): void {
    void this.store.act(siguiente(this.state().indice));
  }

  private swap(a: number, b: number): void {
    this.orden.update((orden) => {
      const next = [...orden];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }
}
