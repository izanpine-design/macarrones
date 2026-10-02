import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Secreto } from '../../party.model';
import { PartyStore } from '../../party-store';
import { Countdown } from '../../ui/countdown';
import {
  configurar,
  empezarRonda,
  MINUTOS_OPCIONES,
  otraRonda,
  PalabraProhibidaState,
  palabrasDeRonda,
  pillar,
  terminarRonda,
  vecesPillado,
} from './palabra-prohibida.logic';

@Component({
  selector: 'app-palabra-prohibida-game',
  imports: [Countdown],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        @switch (s.fase) {
          @case ('preparando') {
            <h3 class="h5">Ronda {{ s.ronda + 1 }}</h3>
            <p>
              Cada uno recibirá una palabra prohibida que verán todos menos él. Si se te escapa la tuya, bebes. Quien la oiga, que
              lo marque.
            </p>
            <fieldset class="mb-3">
              <legend class="form-label fs-6">Duración de la ronda</legend>
              <div class="btn-group" role="group">
                @for (m of minutos; track m) {
                  <button
                    type="button"
                    class="btn"
                    [class]="s.minutos === m ? 'btn-primary' : 'btn-outline-primary'"
                    [attr.aria-pressed]="s.minutos === m"
                    [disabled]="store.busy()"
                    (click)="setMinutes(m)"
                  >
                    {{ m }} min
                  </button>
                }
              </div>
            </fieldset>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="start()">
              Repartir palabras <span aria-hidden="true">🤐</span>
            </button>
          }
          @case ('jugando') {
            <app-countdown [terminaEn]="s.terminaEn" (expired)="timeUp()" />
            <p class="text-center my-3">
              @if (meJuega()) {
                <span aria-hidden="true">🤐</span> Tu palabra es secreta. ¡Cuidado con lo que dices!
              } @else {
                Has llegado a mitad de ronda: jugarás en la siguiente.
              }
            </p>
            <ul class="list-group mb-3" aria-label="Palabras de los demás">
              @for (p of otros(); track p.user_id) {
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                  <span>
                    <strong>{{ p.apodo }}</strong>
                    <span class="d-block">
                      @if (palabras()[p.user_id]; as palabra) {
                        «{{ palabra }}»
                      } @else {
                        <span class="text-body-secondary small">repartiendo…</span>
                      }
                    </span>
                    @if (pillados()[p.user_id]; as n) {
                      <span class="small text-body-secondary">Pillado {{ n }} {{ n === 1 ? 'vez' : 'veces' }}</span>
                    }
                  </span>
                  <button type="button" class="btn btn-danger btn-sm flex-shrink-0" [disabled]="store.busy()" (click)="caught(p.user_id)">
                    ¡La ha dicho! <span aria-hidden="true">🍺</span>
                  </button>
                </li>
              }
            </ul>
            <button type="button" class="btn btn-outline-secondary w-100" [disabled]="store.busy()" (click)="end()">Terminar ronda</button>
          }
          @case ('final') {
            <h3 class="h5">Fin de la ronda {{ s.ronda }}</h3>
            <ul class="list-group mb-3" aria-label="Palabras de la ronda">
              @for (p of jugadoresRonda(); track p.user_id) {
                <li class="list-group-item d-flex justify-content-between">
                  <span>
                    <strong>{{ p.apodo }}</strong>: «{{ reveladas()[p.user_id] ?? '…' }}»
                  </span>
                  <span class="badge text-bg-secondary align-self-center">{{ pillados()[p.user_id] ?? 0 }} 🍺</span>
                </li>
              }
            </ul>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="again()">Otra ronda</button>
          }
        }
      </div>
    </div>
  `,
})
export class PalabraProhibidaGame {
  protected readonly store = inject(PartyStore) as PartyStore<PalabraProhibidaState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly minutos = MINUTOS_OPCIONES;

  /** Words of the others (yours is hidden by the database). */
  protected readonly palabras = signal<Record<string, string>>({});
  /** Every word, at the end of the round. */
  protected readonly reveladas = signal<Record<string, string>>({});

  protected readonly meJuega = computed(() => this.state().jugadoresRonda.includes(this.store.me));
  protected readonly otros = computed(() =>
    this.store.players().filter((p) => p.user_id !== this.store.me && this.state().jugadoresRonda.includes(p.user_id)),
  );
  protected readonly jugadoresRonda = computed(() => {
    const byId = new Map(this.store.players().map((p) => [p.user_id, p]));
    return this.state().jugadoresRonda.map((id) => byId.get(id) ?? { user_id: id, apodo: 'Alguien que se fue' });
  });
  protected readonly pillados = computed(() => vecesPillado(this.state()));

  constructor() {
    // Re-read the secrets whenever the game changes.
    effect(() => {
      this.store.changes();
      const fase = this.state().fase;
      untracked(() => void this.loadWords(fase));
    });
  }

  protected setMinutes(minutos: number): void {
    void this.store.act(configurar(minutos));
  }

  protected async start(): Promise<void> {
    const result = await this.store.act(empezarRonda(this.state().ronda));
    if (!result) return;
    // Whoever started the round stores everybody's word as a secret.
    const words = palabrasDeRonda(result.after);
    await this.store.run(async () => {
      await this.store.backend.clearSecrets(this.store.roomId);
      for (const [userId, palabra] of Object.entries(words)) {
        await this.store.backend.saveSecret(this.store.roomId, userId, { palabra });
      }
    });
  }

  protected async caught(userId: string): Promise<void> {
    const result = await this.store.act(pillar(userId));
    if (result) void this.store.drink(userId, 'Ha dicho su palabra prohibida', this.palabras()[userId] ? `«${this.palabras()[userId]}»` : undefined).catch(() => undefined);
  }

  protected timeUp(): void {
    void this.store.act(terminarRonda(this.state().ronda));
  }

  protected end(): void {
    void this.store.act(terminarRonda(this.state().ronda));
  }

  protected again(): void {
    void this.store.act(otraRonda(this.state().ronda));
  }

  private async loadWords(fase: PalabraProhibidaState['fase']): Promise<void> {
    try {
      if (fase === 'jugando') this.palabras.set(words(await this.store.backend.visibleSecrets(this.store.roomId)));
      if (fase === 'final') this.reveladas.set(words(await this.store.backend.allSecrets(this.store.roomId)));
    } catch {
      // Shown again on the next change; the round goes on.
    }
  }
}

function words(secrets: Record<string, Secreto>): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([id, s]) => [id, String(s['palabra'] ?? '')]));
}
