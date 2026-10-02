import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Aporte, AporteTipo } from '../../party.model';
import { PartyStore } from '../../party-store';
import { PlayerPicker } from '../../ui/player-picker';
import { Scoreboard } from '../../ui/scoreboard';
import { TextEntry } from '../../ui/text-entry';
import { AdivinanzaState, empezarAdivinar, Modo, revelar, siguiente, votar } from './adivinanza.logic';

/** "Secretos anónimos" (modo secretos) and "¿Quién dijo qué?" (modo frases). */
@Component({
  selector: 'app-adivinanza-game',
  imports: [PlayerPicker, Scoreboard, TextEntry],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        @switch (s.fase) {
          @case ('escribiendo') {
            @if (modo() === 'secretos') {
              <h3 class="h5">Escribe un secreto</h3>
              <p class="small text-body-secondary">Nadie sabrá que es tuyo… hasta que lo adivinen. Puedes escribir más de uno.</p>
              <app-text-entry label="Tu secreto" [multiline]="true" button="Enviar secreto" [minLength]="4" [maxLength]="300" [disabled]="store.busy()" (submitted)="send($event)" />
            } @else {
              <h3 class="h5">Apunta una frase que haya dicho alguien</h3>
              <p class="small text-body-secondary">Elige quién la dijo y escríbela. Los demás tendrán que adivinarlo. Puedes apuntar varias.</p>
              <app-player-picker label="¿Quién la dijo?" [players]="store.players()" [me]="store.me" [selected]="dijo()" [disabled]="store.busy()" (pick)="dijo.set($event)" />
              <div class="mt-3">
                <app-text-entry
                  [label]="dijo() ? 'Frase de ' + store.nameOf(dijo()) : 'Primero elige quién la dijo'"
                  button="Guardar frase"
                  [minLength]="3"
                  [maxLength]="300"
                  [disabled]="store.busy() || !dijo()"
                  (submitted)="send($event)"
                />
              </div>
            }
            <p class="small mt-3" aria-live="polite">{{ enviado() }}</p>
            <h4 class="h6 text-uppercase text-body-secondary mt-3">Quién ha escrito</h4>
            <ul class="list-inline">
              @for (p of store.players(); track p.user_id) {
                <li class="list-inline-item badge" [class]="progreso()[p.user_id] ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ p.apodo }} {{ progreso()[p.user_id] ? '✓ ' + progreso()[p.user_id] : '…' }}
                </li>
              }
            </ul>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy() || totalEscritos() < 2" (click)="startGuessing()">
              Empezar a adivinar ({{ totalEscritos() }})
            </button>
            @if (totalEscritos() < 2) {
              <p class="small text-body-secondary text-center mt-2 mb-0">Hacen falta al menos 2 para jugar.</p>
            }
          }
          @case ('adivinando') {
            <p class="small text-body-secondary text-center mb-1">{{ s.indice + 1 }} de {{ s.orden.length }}</p>
            <blockquote class="h4 text-center mb-4" aria-live="polite">«{{ textoActual() }}»</blockquote>
            @if (!s.revelado) {
              <app-player-picker
                [label]="modo() === 'secretos' ? '¿Quién lo escribió?' : '¿Quién lo dijo?'"
                [players]="store.players()"
                [me]="store.me"
                [selected]="s.votos[store.me] ?? null"
                [disabled]="store.busy()"
                (pick)="vote($event)"
              />
              <p class="small text-body-secondary text-center mt-3 mb-2">Han votado {{ votos() }} de {{ store.players().length }}.</p>
              <button type="button" class="btn btn-primary w-100" [disabled]="store.busy() || votos() === 0" (click)="reveal()">Revelar</button>
            } @else {
              <p class="h5 text-center mb-2" role="status">
                {{ modo() === 'secretos' ? 'Lo escribió' : 'Lo dijo' }} <strong>{{ store.nameOf(s.revelado.respuesta) }}</strong>
                @if (modo() === 'frases') {
                  <span class="d-block small text-body-secondary">Apuntada por {{ store.nameOf(s.revelado.autor) }}</span>
                }
              </p>
              <p class="text-center mb-3">{{ acertantes() }}</p>
              <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">Siguiente <span aria-hidden="true">→</span></button>
            }
          }
          @case ('final') {
            <h3 class="h4 text-center mb-3">¡Fin!</h3>
            <app-scoreboard [puntos]="s.puntos" [players]="store.players()" [final]="true" />
            <p class="small text-body-secondary text-center mt-3 mb-0">Para jugar otra vez, el anfitrión puede terminar la partida y empezar una nueva.</p>
          }
        }
      </div>
    </div>
    @if (s.fase === 'adivinando') {
      <app-scoreboard [puntos]="s.puntos" [players]="store.players()" />
    }
  `,
})
export class AdivinanzaGame {
  protected readonly store = inject(PartyStore) as PartyStore<AdivinanzaState>;
  readonly modo = input.required<Modo>();

  protected readonly state = computed(() => this.store.state()!);
  protected readonly dijo = signal<string | null>(null);
  protected readonly enviado = signal('');
  protected readonly progreso = signal<Record<string, number>>({});
  private readonly aportes = signal<Aporte[]>([]);

  private readonly tipo = computed<AporteTipo>(() => (this.modo() === 'secretos' ? 'secreto' : 'frase'));
  protected readonly totalEscritos = computed(() => Object.values(this.progreso()).reduce((a, b) => a + b, 0));
  protected readonly votos = computed(() => Object.keys(this.state().votos).length);
  protected readonly textoActual = computed(() => {
    const id = this.state().orden[this.state().indice];
    return this.aportes().find((a) => a.id === id)?.texto ?? '…';
  });
  protected readonly acertantes = computed(() => {
    const r = this.state().revelado;
    if (!r) return '';
    const names = Object.entries(this.state().votos)
      .filter(([votante, votado]) => votado === r.respuesta && !(this.modo() === 'frases' && votante === r.autor))
      .map(([votante]) => this.store.nameOf(votante));
    return names.length ? `Han acertado: ${names.join(', ')} (+1)` : 'Nadie lo ha adivinado.';
  });

  constructor() {
    effect(() => {
      this.store.changes();
      const fase = this.state().fase;
      untracked(() => void this.refresh(fase));
    });
  }

  protected async send(texto: string): Promise<void> {
    const sobre = this.modo() === 'frases' ? this.dijo() : null;
    const ok = await this.store.run(() => this.store.backend.sendAporte(this.store.roomId, this.tipo(), texto, sobre));
    if (ok !== null) this.enviado.set(this.modo() === 'secretos' ? 'Secreto enviado ✓' : 'Frase guardada ✓');
  }

  protected async startGuessing(): Promise<void> {
    const aportes = await this.store.run(() => this.store.backend.listAportes(this.store.roomId, this.tipo()));
    if (aportes?.length) await this.store.act(empezarAdivinar(aportes.map((a) => a.id)));
  }

  protected vote(userId: string): void {
    void this.store.act(votar(this.state().indice, userId));
  }

  protected async reveal(): Promise<void> {
    const s = this.state();
    const id = s.orden[s.indice];
    const answer = await this.store.run(() => this.store.backend.revealAporte(this.store.roomId, id));
    if (!answer) return;
    const respuesta = this.modo() === 'secretos' ? answer.autor_id : (answer.sobre_id ?? answer.autor_id);
    await this.store.act(revelar(s.indice, this.modo(), answer.autor_id, respuesta));
  }

  protected next(): void {
    void this.store.act(siguiente(this.state().indice));
  }

  private async refresh(fase: AdivinanzaState['fase']): Promise<void> {
    try {
      if (fase === 'escribiendo') this.progreso.set(await this.store.backend.aporteProgress(this.store.roomId, this.tipo()));
      if (fase === 'adivinando' && this.aportes().length === 0) {
        this.aportes.set(await this.store.backend.listAportes(this.store.roomId, this.tipo()));
      }
    } catch {
      // Retried on the next change.
    }
  }
}
