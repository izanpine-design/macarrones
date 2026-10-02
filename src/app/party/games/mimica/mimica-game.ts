import { Component, computed, inject } from '@angular/core';
import { PartyStore } from '../../party-store';
import { Countdown } from '../../ui/countdown';
import { PlayerPicker } from '../../ui/player-picker';
import { Scoreboard } from '../../ui/scoreboard';
import { DrawingBoard } from './drawing-board';
import {
  acertado,
  actor,
  configurar,
  empezar,
  jugarOtraVez,
  MimicaState,
  ModoMimica,
  nadie,
  palabraActual,
  saltarPalabra,
  SEGUNDOS_OPCIONES,
  siguienteTurno,
} from './mimica.logic';

@Component({
  selector: 'app-mimica-game',
  imports: [Countdown, DrawingBoard, PlayerPicker, Scoreboard],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4">
        @switch (s.fase) {
          @case ('preparado') {
            @if (soyActor()) {
              <p class="text-center text-body-secondary mb-1">Te toca. Tu palabra secreta es:</p>
              <p class="display-6 text-center fw-bold mb-3">{{ palabra() }}</p>
              <div class="d-flex gap-2 mb-3">
                <button type="button" class="btn btn-primary btn-lg flex-fill" [disabled]="store.busy()" (click)="start('mimica')">
                  <span aria-hidden="true">🎭</span> Mímica
                </button>
                <button type="button" class="btn btn-primary btn-lg flex-fill" [disabled]="store.busy()" (click)="start('dibujo')">
                  <span aria-hidden="true">✏️</span> Dibujar
                </button>
              </div>
              <button type="button" class="btn btn-outline-secondary w-100 mb-3" [disabled]="store.busy()" (click)="skip()">Otra palabra</button>
            } @else {
              <p class="h5 text-center mb-3" role="status">Le toca a <strong>{{ store.nameOf(actorId()) }}</strong>. ¡Prepárate para adivinar!</p>
            }
            <div class="text-center">
              <span class="small text-body-secondary me-2">Tiempo:</span>
              <div class="btn-group btn-group-sm" role="group" aria-label="Tiempo por turno">
                @for (seg of segundos; track seg) {
                  <button type="button" class="btn" [class]="s.segundos === seg ? 'btn-secondary' : 'btn-outline-secondary'" [attr.aria-pressed]="s.segundos === seg" [disabled]="store.busy()" (click)="setSeconds(seg)">
                    {{ seg }} s
                  </button>
                }
              </div>
            </div>
          }
          @case ('actuando') {
            <app-countdown [terminaEn]="s.terminaEn" (expired)="timeUp()" />
            <p class="text-center my-2">
              {{ s.modo === 'dibujo' ? '✏️ Dibuja' : '🎭 Representa' }} <strong>{{ soyActor() ? 'tú' : store.nameOf(actorId()) }}</strong>
              @if (soyActor()) {
                · tu palabra: <strong>{{ palabra() }}</strong>
              }
            </p>
            @if (s.modo === 'dibujo') {
              <app-drawing-board class="d-block mb-3" [canDraw]="soyActor()" [turno]="s.turno" [label]="'Dibujo de ' + store.nameOf(actorId())" />
            }
            <p class="fw-semibold mb-2">¿Quién lo ha adivinado?</p>
            <app-player-picker label="Quién lo ha adivinado" [players]="store.players()" [me]="store.me" [exclude]="[actorId()]" [disabled]="store.busy()" (pick)="guessed($event)" />
            <button type="button" class="btn btn-outline-secondary w-100 mt-3" [disabled]="store.busy()" (click)="nobody()">Nadie / rendirse</button>
          }
          @case ('resultado') {
            <p class="h4 text-center mb-2" role="status">
              @if (s.acertante) {
                <span aria-hidden="true">🎉</span> ¡Lo ha adivinado {{ store.nameOf(s.acertante) }}!
              } @else {
                Nadie lo ha adivinado.
              }
            </p>
            <p class="text-center mb-3">Era: <strong>{{ palabra() }}</strong></p>
            <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">Siguiente turno <span aria-hidden="true">→</span></button>
          }
          @case ('final') {
            <h3 class="h4 text-center mb-3">¡Fin de la partida!</h3>
            <app-scoreboard [puntos]="s.puntos" [players]="store.players()" [final]="true" />
            <button type="button" class="btn btn-primary btn-lg w-100 mt-3" [disabled]="store.busy()" (click)="again()">Jugar otra vez</button>
          }
        }
      </div>
    </div>
    @if (s.fase !== 'final') {
      <app-scoreboard [puntos]="s.puntos" [players]="store.players()" />
    }
  `,
})
export class MimicaGame {
  protected readonly store = inject(PartyStore) as PartyStore<MimicaState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly segundos = SEGUNDOS_OPCIONES;
  protected readonly actorId = computed(() => actor(this.state()));
  protected readonly soyActor = computed(() => this.actorId() === this.store.me);
  protected readonly palabra = computed(() => palabraActual(this.state()) ?? '—');

  protected start(modo: ModoMimica): void {
    void this.store.act(empezar(this.state().turno, modo));
  }

  protected skip(): void {
    void this.store.act(saltarPalabra(this.state().turno));
  }

  protected setSeconds(segundos: number): void {
    void this.store.act(configurar(segundos));
  }

  protected guessed(userId: string): void {
    void this.store.act(acertado(this.state().turno, userId));
  }

  protected nobody(): void {
    void this.store.act(nadie(this.state().turno));
  }

  protected timeUp(): void {
    void this.store.act(nadie(this.state().turno));
  }

  protected next(): void {
    void this.store.act(siguienteTurno(this.state().turno));
  }

  protected again(): void {
    void this.store.act(jugarOtraVez);
  }
}
