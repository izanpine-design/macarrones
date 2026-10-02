import { Component, computed, inject, signal } from '@angular/core';
import { PartyStore } from '../../party-store';
import { PlayerPicker } from '../../ui/player-picker';
import { TextEntry } from '../../ui/text-entry';
import { CARTAS, TipoCarta } from './cartas';
import { anadirRegla, quitarRegla, ReglasCartaState, sacarCarta } from './reglas-carta.logic';

const ETIQUETAS: Record<TipoCarta, string> = {
  trago: '🍺 Trago',
  reparte: '🫵 Reparte',
  todos: '🍻 Todos',
  regla: '📜 Regla',
  accion: '🎲 Acción',
};

@Component({
  selector: 'app-reglas-carta-game',
  imports: [PlayerPicker, TextEntry],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4 text-center">
        @if (carta(); as c) {
          <div class="playing-card mx-auto mb-3" [attr.data-tipo]="c.tipo" aria-live="polite">
            <span class="badge text-bg-dark mb-2">{{ etiqueta(c.tipo) }}</span>
            <p class="h4 mb-2">{{ c.titulo }}</p>
            <p class="mb-2">{{ c.texto }}</p>
            <p class="small text-body-secondary mb-0">La ha sacado {{ store.nameOf(s.actual!.por) }}</p>
          </div>

          @if (c.tipo === 'reparte' && esMia()) {
            <p class="fw-semibold mb-2">¿A quién le toca beber?</p>
            <app-player-picker label="Repartir tragos" [players]="store.players()" [me]="store.me" [exclude]="[store.me]" [disabled]="store.busy()" (pick)="give($event)" />
            <p class="small text-body-secondary mt-2" aria-live="polite">{{ repartidos() }}</p>
          }
          @if (c.titulo === 'El rey' && esMia()) {
            <div class="text-start mb-3">
              <app-text-entry label="Tu regla nueva" placeholder="Prohibido decir…" button="Poner regla" [minLength]="3" [maxLength]="140" (submitted)="addRule($event)" />
            </div>
          }
        } @else {
          <p class="h5 mb-3">Barajadas {{ total }} cartas. ¡Que empiece el juego!</p>
        }

        <button type="button" class="btn btn-primary btn-lg w-100 mt-2" [disabled]="store.busy()" (click)="draw()">
          Sacar carta <span aria-hidden="true">🃏</span>
        </button>
        <p class="small text-body-secondary mt-2 mb-0">Cartas sacadas: {{ s.sacadas }}</p>
      </div>
    </div>

    <div class="card shadow-sm mb-3" role="group" aria-label="Reglas activas">
      <div class="card-body">
        <h3 class="h6 text-uppercase text-body-secondary">Reglas activas ({{ s.reglas.length }})</h3>
        @if (s.reglas.length === 0) {
          <p class="text-body-secondary mb-0">Ninguna. Cuando salga una carta de regla, aparecerá aquí.</p>
        } @else {
          <ul class="list-group">
            @for (r of s.reglas; track r.id) {
              <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                <span>{{ r.texto }} <span class="small text-body-secondary">· {{ store.nameOf(r.por) }}</span></span>
                <button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" [disabled]="store.busy()" (click)="removeRule(r.id)">
                  Quitar
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: `
    .playing-card {
      max-width: 340px;
      padding: 1.25rem;
      border: 3px solid var(--bs-border-color);
      border-radius: 18px;
      background: var(--bs-tertiary-bg);
    }
    .playing-card[data-tipo='trago'], .playing-card[data-tipo='todos'] { border-color: #d39e00; }
    .playing-card[data-tipo='regla'] { border-color: var(--bs-primary); }
    .playing-card[data-tipo='accion'] { border-color: var(--bs-success); }
    .playing-card[data-tipo='reparte'] { border-color: var(--bs-danger); }
  `,
})
export class ReglasCartaGame {
  protected readonly store = inject(PartyStore) as PartyStore<ReglasCartaState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly total = CARTAS.length;
  protected readonly carta = computed(() => {
    const actual = this.state().actual;
    return actual ? CARTAS[actual.carta] : null;
  });
  protected readonly esMia = computed(() => this.state().actual?.por === this.store.me);
  /** Sips handed out with the current card (only on this phone). */
  private readonly given = signal<{ sacadas: number; nombres: string[] }>({ sacadas: -1, nombres: [] });
  protected readonly repartidos = computed(() => {
    const g = this.given();
    return g.sacadas === this.state().sacadas && g.nombres.length ? `Repartido a: ${g.nombres.join(', ')}` : '';
  });

  protected etiqueta(tipo: TipoCarta): string {
    return ETIQUETAS[tipo];
  }

  protected async draw(): Promise<void> {
    const result = await this.store.act(sacarCarta(this.state().sacadas));
    const carta = result?.after.actual ? CARTAS[result.after.actual.carta] : null;
    if (carta?.tipo === 'trago') void this.store.drink(this.store.me, `Carta: ${carta.titulo}`).catch(() => undefined);
  }

  protected give(userId: string): void {
    const carta = this.carta();
    if (!carta) return;
    const sacadas = this.state().sacadas;
    const current = this.given();
    this.given.set({
      sacadas,
      nombres: [...(current.sacadas === sacadas ? current.nombres : []), this.store.nameOf(userId)],
    });
    void this.store.run(() => this.store.drink(userId, `Carta: ${carta.titulo}`));
  }

  protected addRule(texto: string): void {
    void this.store.act(anadirRegla(texto));
  }

  protected removeRule(id: number): void {
    void this.store.act(quitarRegla(id));
  }
}
