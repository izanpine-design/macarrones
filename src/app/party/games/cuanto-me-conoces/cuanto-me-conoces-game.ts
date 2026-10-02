import { Component, computed, inject } from '@angular/core';
import { PartyStore } from '../../party-store';
import { Scoreboard } from '../../ui/scoreboard';
import { TextEntry } from '../../ui/text-entry';
import {
  CuantoMeConocesState,
  jugarOtraVez,
  otraPregunta,
  preguntaActual,
  protagonista,
  responder,
  revelar,
  siguiente,
  toggleAcierto,
} from './cuanto-me-conoces.logic';

@Component({
  selector: 'app-cuanto-me-conoces-game',
  imports: [Scoreboard, TextEntry],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        @if (s.fase === 'final') {
          <h3 class="h4 text-center mb-3">¡Fin de la partida!</h3>
          <app-scoreboard [puntos]="s.puntos" [players]="store.players()" [final]="true" />
          <button type="button" class="btn btn-primary btn-lg w-100 mt-3" [disabled]="store.busy()" (click)="again()">Jugar otra vez</button>
        } @else {
          <p class="text-center text-body-secondary mb-1">Ronda sobre <strong>{{ prota() === store.me ? 'ti' : store.nameOf(prota()) }}</strong></p>
          <p class="h4 text-center mb-4" aria-live="polite">{{ pregunta() }}</p>

          @if (s.fase === 'respondiendo') {
            @if (miRespuesta(); as r) {
              <p class="text-center mb-2">Tu respuesta: <strong>{{ r }}</strong></p>
              <p class="small text-body-secondary text-center" role="status">Esperando al resto… ({{ respondidas() }} de {{ store.players().length }})</p>
            } @else {
              <app-text-entry
                [label]="prota() === store.me ? 'Tu respuesta de verdad' : '¿Qué crees que responderá ' + store.nameOf(prota()) + '?'"
                button="Responder"
                [minLength]="1"
                [maxLength]="120"
                [disabled]="store.busy()"
                (submitted)="answer($event)"
              />
            }
            <div class="d-flex gap-2 mt-3">
              @if (respondidas() === 0) {
                <button type="button" class="btn btn-outline-secondary flex-fill" [disabled]="store.busy()" (click)="otherQuestion()">Otra pregunta</button>
              }
              <button type="button" class="btn btn-outline-secondary flex-fill" [disabled]="store.busy() || !s.respuestas[prota()]" (click)="reveal()">
                Revelar ya
              </button>
            </div>
          } @else {
            <p class="text-center mb-3">
              Respuesta de {{ store.nameOf(prota()) }}: <strong class="fs-5">{{ s.respuestas[prota()] ?? '—' }}</strong>
            </p>
            <p class="small text-body-secondary">{{ prota() === store.me ? 'Marca quién ha acertado:' : 'Quien ha acertado (lo marca ' + store.nameOf(prota()) + '):' }}</p>
            <ul class="list-group mb-3">
              @for (p of adivinadores(); track p.user_id) {
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                  <span><strong>{{ p.apodo }}</strong>: {{ s.respuestas[p.user_id] ?? 'no respondió' }}</span>
                  <button
                    type="button"
                    class="btn btn-sm flex-shrink-0"
                    [class]="s.aciertos[p.user_id] ? 'btn-success' : 'btn-outline-dark'"
                    [attr.aria-pressed]="!!s.aciertos[p.user_id]"
                    [disabled]="store.busy() || !s.respuestas[p.user_id]"
                    (click)="mark(p.user_id)"
                  >
                    {{ s.aciertos[p.user_id] ? '✔ Acierto' : 'Acierto' }}
                  </button>
                </li>
              }
            </ul>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">
              Sumar puntos y seguir <span aria-hidden="true">→</span>
            </button>
          }
        }
      </div>
    </div>
    @if (s.fase !== 'final') {
      <app-scoreboard [puntos]="s.puntos" [players]="store.players()" />
    }
  `,
})
export class CuantoMeConocesGame {
  protected readonly store = inject(PartyStore) as PartyStore<CuantoMeConocesState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly prota = computed(() => protagonista(this.state()));
  protected readonly pregunta = computed(() => preguntaActual(this.state()) ?? 'No hay preguntas en este lote.');
  protected readonly miRespuesta = computed(() => this.state().respuestas[this.store.me] ?? null);
  protected readonly respondidas = computed(() => Object.keys(this.state().respuestas).length);
  protected readonly adivinadores = computed(() => this.store.players().filter((p) => p.user_id !== this.prota()));

  protected answer(texto: string): void {
    void this.store.act(responder(this.state().turno, texto));
  }

  protected reveal(): void {
    void this.store.act(revelar(this.state().turno));
  }

  protected otherQuestion(): void {
    void this.store.act(otraPregunta(this.state().turno));
  }

  protected mark(userId: string): void {
    void this.store.act(toggleAcierto(this.state().turno, userId));
  }

  protected next(): void {
    void this.store.act(siguiente(this.state().turno));
  }

  protected again(): void {
    void this.store.act(jugarOtraVez);
  }
}
