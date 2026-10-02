import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Secreto } from '../../party.model';
import { PartyStore } from '../../party-store';
import { Countdown } from '../../ui/countdown';
import { TextEntry } from '../../ui/text-entry';
import { BEBIDAS, MAX_ALCOHOL_CL, MAX_BREBAJES } from './brebaje';
import {
  configurar,
  elegirKryptonita,
  empezarEleccion,
  empezarYa,
  KryptonitaState,
  MINUTOS_KRYPTONITA,
  otraRonda,
  pillar,
  SUGERENCIAS_MANIAS,
  terminar,
  toggleBebida,
} from './kryptonita.logic';

@Component({
  selector: 'app-kryptonita-game',
  imports: [Countdown, TextEntry],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        @switch (s.fase) {
          @case ('preparando') {
            <h3 class="h5">Antes de empezar</h3>
            <fieldset class="mb-3">
              <legend class="form-label fs-6">¿Qué bebidas tienes? <span class="text-body-secondary">(para los Brebajes)</span></legend>
              <div class="d-flex flex-wrap gap-2">
                @for (b of bebidas; track b.id) {
                  <button
                    type="button"
                    class="btn btn-sm"
                    [class]="misBebidas().includes(b.id) ? 'btn-primary' : 'btn-outline-primary'"
                    [attr.aria-pressed]="misBebidas().includes(b.id)"
                    [disabled]="store.busy()"
                    (click)="toggleDrink(b.id)"
                  >
                    <span aria-hidden="true">{{ b.emoji }}</span> {{ b.nombre }}
                  </button>
                }
              </div>
              <p class="small text-body-secondary mt-2 mb-0">
                En la sala hay: {{ disponibles() || 'nada todavía' }}. Cada Brebaje lleva como mucho {{ maxCl }} cl de alcohol y nadie
                toma más de {{ maxBrebajes }} por noche.
              </p>
            </fieldset>
            <fieldset class="mb-3">
              <legend class="form-label fs-6">Kryptonitas</legend>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" [id]="ids.secreta" [checked]="s.secreta" [disabled]="store.busy()" (change)="setSecret($any($event.target).checked)" />
                <label class="form-check-label" [for]="ids.secreta">Secretas: no sabes cuál es la tuya</label>
              </div>
              <div class="btn-group mt-2" role="group" aria-label="Duración">
                @for (m of minutos; track m) {
                  <button type="button" class="btn btn-sm" [class]="s.minutos === m ? 'btn-primary' : 'btn-outline-primary'" [attr.aria-pressed]="s.minutos === m" [disabled]="store.busy()" (click)="setMinutes(m)">
                    {{ m }} min
                  </button>
                }
              </div>
            </fieldset>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy() || store.players().length < 2" (click)="startChoosing()">
              Elegir kryptonitas <span aria-hidden="true">🧪</span>
            </button>
          }
          @case ('eligiendo') {
            @if (miObjetivo(); as objetivo) {
              @if (!s.elegidas[objetivo]) {
                <h3 class="h5">Elige la kryptonita de {{ store.nameOf(objetivo) }}</h3>
                <p class="small text-body-secondary">{{ s.secreta ? 'No se lo digas: será secreta.' : 'Todos la sabrán, también esa persona.' }}</p>
                <div class="d-flex flex-wrap gap-2 mb-3">
                  @for (m of sugerencias; track m) {
                    <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="store.busy()" (click)="choose(objetivo, m)">{{ m }}</button>
                  }
                </div>
                <app-text-entry label="O escribe otra" placeholder="Decir «obvio»…" button="Elegir esta" [maxLength]="80" [disabled]="store.busy()" (submitted)="choose(objetivo, $event)" />
              } @else {
                <p class="text-center mb-3" role="status">Hecho. Esperando a que los demás elijan…</p>
              }
            } @else {
              <p class="text-center mb-3" role="status">Has llegado a mitad de elección: jugarás en la próxima ronda.</p>
            }
            <p class="small text-body-secondary text-center">Elegidas {{ elegidas() }} de {{ total() }}.</p>
            <button type="button" class="btn btn-outline-secondary w-100" [disabled]="store.busy() || elegidas() === 0" (click)="startNow()">
              Empezar ya con las elegidas
            </button>
          }
          @case ('jugando') {
            <app-countdown [terminaEn]="s.terminaEn" (expired)="end()" />
            <ul class="list-group my-3" aria-label="Kryptonitas">
              @for (id of jugadores(); track id) {
                <li class="list-group-item">
                  <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <span>
                      <strong>{{ store.nameOf(id) }}{{ id === store.me ? ' (tú)' : '' }}</strong>
                      <span class="d-block">{{ maniaDe(id) }}</span>
                      <span class="small text-body-secondary">Brebajes: {{ s.brebajes[id] ?? 0 }}/{{ maxBrebajes }}</span>
                    </span>
                    @if (id !== store.me) {
                      <span class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-dark" [disabled]="store.busy()" (click)="caught(id, false)">Leve 🍺</button>
                        <button type="button" class="btn btn-sm btn-danger" [disabled]="store.busy()" (click)="caught(id, true)">Grave 🧪</button>
                      </span>
                    }
                  </div>
                </li>
              }
            </ul>
            @if (ultimos().length > 0) {
              <h3 class="h6 text-uppercase text-body-secondary">Últimas pilladas</h3>
              <ul class="list-unstyled small" aria-live="polite">
                @for (p of ultimos(); track p.en) {
                  <li class="mb-2">
                    <strong>{{ store.nameOf(p.quien) }}</strong> pillado por {{ store.nameOf(p.por) }} · {{ p.grave ? 'grave' : 'leve' }}
                    @if (p.castigo) {
                      <span class="d-block castigo">{{ p.castigo }}</span>
                    }
                  </li>
                }
              </ul>
            }
            <button type="button" class="btn btn-outline-secondary w-100" [disabled]="store.busy()" (click)="end()">Terminar ronda</button>
          }
          @case ('final') {
            <h3 class="h5">Kryptonitas reveladas</h3>
            <ul class="list-group mb-3">
              @for (id of jugadores(); track id) {
                <li class="list-group-item d-flex justify-content-between">
                  <span><strong>{{ store.nameOf(id) }}</strong>: {{ reveladas()[id] ?? s.manias[id] ?? '—' }}</span>
                  <span class="badge text-bg-secondary align-self-center">{{ vecesPillado()[id] ?? 0 }} pilladas</span>
                </li>
              }
            </ul>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="again()">Otra ronda</button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .castigo {
      white-space: pre-line;
    }
  `,
})
export class KryptonitaGame {
  protected readonly store = inject(PartyStore) as PartyStore<KryptonitaState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly bebidas = BEBIDAS;
  protected readonly minutos = MINUTOS_KRYPTONITA;
  protected readonly sugerencias = SUGERENCIAS_MANIAS;
  protected readonly maxCl = MAX_ALCOHOL_CL;
  protected readonly maxBrebajes = MAX_BREBAJES;
  protected readonly ids = { secreta: `kryptonita-secreta-${Math.random().toString(36).slice(2, 8)}` };

  /** Kryptonites of the others (secret mode; yours stays hidden). */
  protected readonly visibles = signal<Record<string, string>>({});
  protected readonly reveladas = signal<Record<string, string>>({});

  protected readonly misBebidas = computed(() => this.state().bebidas[this.store.me] ?? []);
  protected readonly disponibles = computed(() =>
    BEBIDAS.filter((b) => Object.values(this.state().bebidas).some((list) => list.includes(b.id)))
      .map((b) => b.nombre)
      .join(', '),
  );
  protected readonly miObjetivo = computed(() => this.state().asignador[this.store.me] ?? null);
  protected readonly jugadores = computed(() => Object.values(this.state().asignador));
  protected readonly elegidas = computed(() => Object.keys(this.state().elegidas).length);
  protected readonly total = computed(() => Object.keys(this.state().asignador).length);
  protected readonly ultimos = computed(() => this.state().pillados.slice(-4).reverse());
  protected readonly vecesPillado = computed(() => {
    const result: Record<string, number> = {};
    for (const p of this.state().pillados) result[p.quien] = (result[p.quien] ?? 0) + 1;
    return result;
  });

  constructor() {
    effect(() => {
      this.store.changes();
      const fase = this.state().fase;
      const secreta = this.state().secreta;
      untracked(() => void this.loadSecrets(fase, secreta));
    });
  }

  protected maniaDe(id: string): string {
    const s = this.state();
    if (!s.elegidas[id]) return 'Sin kryptonita';
    if (!s.secreta) return s.manias[id] ?? '—';
    if (id === this.store.me) return '🤐 Secreta (no puedes verla)';
    return this.visibles()[id] ?? 'cargando…';
  }

  protected toggleDrink(id: string): void {
    void this.store.act(toggleBebida(id));
  }

  protected setSecret(secreta: boolean): void {
    void this.store.act(configurar({ secreta }));
  }

  protected setMinutes(minutos: number): void {
    void this.store.act(configurar({ minutos }));
  }

  protected async startChoosing(): Promise<void> {
    const result = await this.store.act(empezarEleccion(this.state().ronda));
    // The previous round's secret kryptonites go away.
    if (result) await this.store.run(() => this.store.backend.clearSecrets(this.store.roomId));
  }

  protected async choose(objetivo: string, texto: string): Promise<void> {
    // Secret: stored where the owner cannot read it, before marking it chosen.
    if (this.state().secreta) {
      const saved = await this.store.run(() => this.store.backend.saveSecret(this.store.roomId, objetivo, { mania: texto }));
      if (saved === null && this.store.error()) return;
    }
    await this.store.act(elegirKryptonita(texto));
  }

  protected startNow(): void {
    void this.store.act(empezarYa(this.state().ronda));
  }

  protected async caught(id: string, grave: boolean): Promise<void> {
    const result = await this.store.act(pillar(id, grave, this.store.nameOf(id)));
    const pillado = result?.after.pillados.at(-1);
    if (!pillado) return;
    const motivo = !grave
      ? 'Pillado con su kryptonita'
      : pillado.castigo?.startsWith('🧪')
        ? 'Falta grave: ¡Brebaje!'
        : 'Falta grave (ya lleva sus Brebajes)';
    void this.store.drink(id, motivo, pillado.castigo).catch(() => undefined);
  }

  protected end(): void {
    void this.store.act(terminar(this.state().ronda));
  }

  protected again(): void {
    void this.store.act(otraRonda(this.state().ronda));
  }

  private async loadSecrets(fase: KryptonitaState['fase'], secreta: boolean): Promise<void> {
    if (!secreta) return;
    try {
      if (fase === 'jugando') this.visibles.set(manias(await this.store.backend.visibleSecrets(this.store.roomId)));
      if (fase === 'final') this.reveladas.set(manias(await this.store.backend.allSecrets(this.store.roomId)));
    } catch {
      // Retried on the next change.
    }
  }
}

function manias(secrets: Record<string, Secreto>): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([id, s]) => [id, String(s['mania'] ?? '')]));
}
