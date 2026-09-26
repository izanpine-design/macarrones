import { Component, computed, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { QuestionType } from '../../core/question.model';
import { RoomInfo, Turn } from '../../core/room.model';
import { roomErrorMessage, RoomService } from '../../core/room.service';
import { TurnService } from '../../core/turn.service';
import { DrinkReason, DrinkService } from '../../shared/drink/drink.service';
import { Roulette } from '../roulette';
import { QuestionPicker } from './question-picker';

/** Turns older than this (e.g. after reloading the page) skip the roulettes. */
const ANIMATE_TURNS_NEWER_THAN_MS = 30_000;

type RouletteStep = 'starter' | 'target' | 'done';

/** Game screen of "Verdad o reto": roulettes, then the phases of the turn. */
@Component({
  selector: 'app-truth-or-dare-game',
  imports: [Roulette, QuestionPicker],
  template: `
    @let t = turn();
    <section class="card shadow-sm mb-3" aria-labelledby="turn-title">
      <div class="card-body p-4">
        <h2 id="turn-title" class="visually-hidden">Turno {{ t.numero }}</h2>

        @switch (rouletteStep()) {
          @case ('starter') {
            <app-roulette
              title="¿Quién empieza?"
              [names]="starterNames()"
              [winnerIndex]="starterIndex()"
              (done)="rouletteStep.set('target')"
            />
          }
          @case ('target') {
            <app-roulette
              [title]="'¿A quién le pregunta ' + askerName() + '?'"
              [names]="targetNames()"
              [winnerIndex]="targetIndex()"
              (done)="rouletteStep.set('done')"
            />
          }
          @default {
            <p class="text-body-secondary small text-center mb-3">
              Turno {{ t.numero }} · <strong>{{ askerName() }}</strong> pregunta a
              <strong>{{ targetName() }}</strong>
            </p>

            @switch (t.fase) {
              @case ('eligiendo_tipo') {
                @if (isTarget()) {
                  <p class="h4 text-center mb-3">¿Verdad o reto?</p>
                  <div class="d-flex gap-2">
                    <button type="button" class="btn btn-info btn-lg flex-fill" [disabled]="busy()" (click)="chooseType('verdad')">
                      Verdad
                    </button>
                    <button type="button" class="btn btn-danger btn-lg flex-fill" [disabled]="busy()" (click)="chooseType('reto')">
                      Reto
                    </button>
                  </div>
                } @else {
                  <p class="text-center mb-0" role="status">
                    Esperando a que <strong>{{ targetName() }}</strong> elija verdad o reto…
                  </p>
                }
              }
              @case ('eligiendo_pregunta') {
                @if (isAsker()) {
                  <app-question-picker [roomId]="room().id" [type]="t.tipo!" [targetName]="targetName()" />
                } @else {
                  <p class="text-center mb-0" role="status">
                    <strong>{{ targetName() }}</strong> ha elegido
                    <strong>{{ t.tipo === 'verdad' ? 'verdad' : 'reto' }}</strong>.
                    <strong>{{ askerName() }}</strong> está eligiendo {{ t.tipo === 'verdad' ? 'la pregunta' : 'el reto' }}…
                  </p>
                }
              }
              @case ('respondiendo') {
                <div class="text-center">
                  <span class="badge fs-6 mb-3" [class]="t.tipo === 'verdad' ? 'text-bg-info' : 'text-bg-danger'">
                    {{ t.tipo === 'verdad' ? 'Verdad' : 'Reto' }}
                  </span>
                  <p class="h4 mb-2" aria-live="polite">{{ t.pregunta_texto }}</p>
                  <p class="small text-body-secondary mb-3">
                    Para {{ isTarget() ? 'ti' : targetName() }}
                    @if (t.personalizada) {
                      · escrita por {{ askerName() }}
                    }
                  </p>
                  @if (isAsker()) {
                    <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="busy()" (click)="nextTurn()">
                      Siguiente turno
                    </button>
                  } @else {
                    <p class="small text-body-secondary mb-0">
                      {{ askerName() }} pasará al siguiente turno cuando {{ isTarget() ? 'hayas' : 'haya' }} cumplido.
                    </p>
                  }
                  @if (isTarget()) {
                    <button type="button" class="btn btn-outline-danger w-100 mt-3" [disabled]="busy()" (click)="drink('rajado')">
                      <span aria-hidden="true">🐔</span> Me rajo: bebo
                    </button>
                  } @else if (isAsker()) {
                    <button type="button" class="btn btn-outline-danger w-100 mt-2" [disabled]="busy()" (click)="drink('no_cumple')">
                      <span aria-hidden="true">🍺</span> No lo ha cumplido: ¡a beber!
                    </button>
                  }
                </div>
              }
            }
          }
        }

        @if (error()) {
          <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div>
        }
      </div>
    </section>

    @if (isHost()) {
      <div class="d-flex gap-2 mb-3">
        @if (!(isAsker() && t.fase === 'respondiendo')) {
          <button type="button" class="btn btn-outline-secondary flex-fill" [disabled]="busy()" (click)="nextTurn()">
            Saltar turno
          </button>
        }
        <button type="button" class="btn btn-outline-secondary flex-fill" [disabled]="busy()" (click)="endGame()">
          Terminar partida
        </button>
      </div>
    }
  `,
})
export class TruthOrDareGame {
  private readonly rooms = inject(RoomService);
  private readonly turns = inject(TurnService);
  private readonly drinks = inject(DrinkService);
  private readonly userId = inject(AuthService).userId;

  readonly room = input.required<RoomInfo>();
  readonly turn = input.required<Turn>();
  readonly hostId = input.required<string | null>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Restarts the roulettes every time a new turn arrives. */
  protected readonly rouletteStep = linkedSignal<number, RouletteStep>({
    source: () => this.turn().id,
    computation: () => untracked(() => initialStep(this.turn())),
  });

  protected readonly isHost = computed(() => this.hostId() === this.userId());
  protected readonly isAsker = computed(() => this.turn().preguntador_id === this.userId());
  protected readonly isTarget = computed(() => this.turn().objetivo_id === this.userId());
  protected readonly askerName = computed(() => this.nameOf(this.turn().preguntador_id));
  protected readonly targetName = computed(() => this.nameOf(this.turn().objetivo_id));

  protected readonly starterNames = computed(() => this.turn().jugadores.map((p) => p.apodo));
  protected readonly starterIndex = computed(() =>
    this.turn().jugadores.findIndex((p) => p.user_id === this.turn().preguntador_id),
  );
  private readonly targetCandidates = computed(() =>
    this.turn().jugadores.filter((p) => p.user_id !== this.turn().preguntador_id),
  );
  protected readonly targetNames = computed(() => this.targetCandidates().map((p) => p.apodo));
  protected readonly targetIndex = computed(() =>
    this.targetCandidates().findIndex((p) => p.user_id === this.turn().objetivo_id),
  );

  protected chooseType(type: QuestionType): Promise<void> {
    return this.run(() => this.turns.chooseType(this.room().id, type));
  }

  protected nextTurn(): Promise<void> {
    return this.run(() => this.turns.nextTurn(this.room().id));
  }

  /** Tells the whole room that the target of the turn drinks. */
  protected drink(reason: DrinkReason): Promise<void> {
    const turn = this.turn();
    const apodo = (id: string | null): string => turn.jugadores.find((p) => p.user_id === id)?.apodo ?? 'Alguien';
    return this.run(() =>
      this.drinks.send({ userId: turn.objetivo_id, apodo: apodo(turn.objetivo_id), reason, por: apodo(this.userId()) }),
    );
  }

  protected endGame(): Promise<void> {
    return this.run(() => this.rooms.endGame(this.room().id));
  }

  /** The screen updates through Realtime; here we only track busy / errors. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private nameOf(userId: string): string {
    const name = this.turn().jugadores.find((p) => p.user_id === userId)?.apodo ?? 'Alguien';
    return userId === this.userId() ? `${name} (tú)` : name;
  }
}

function initialStep(turn: Turn): RouletteStep {
  const isFresh =
    turn.fase === 'eligiendo_tipo' && Date.now() - new Date(turn.created_at).getTime() < ANIMATE_TURNS_NEWER_THAN_MS;
  if (!isFresh) return 'done';
  return turn.numero === 1 ? 'starter' : 'target';
}
