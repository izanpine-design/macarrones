import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { Game } from '../../core/question.model';
import { GameService } from '../../core/game.service';
import { PLAYABLE_GAMES } from '../../core/room.model';
import { CreateRoomForm } from '../../rooms/create-room-form';
import { JoinByCodeForm } from '../../rooms/join-by-code-form';
import { OpenRoomList } from '../../rooms/open-room-list';
import { BackButton } from '../../shared/back-button/back-button';
import { PlanetBadge } from '../../shared/themes/planet-badge';

@Component({
  selector: 'app-game-detail',
  imports: [CreateRoomForm, JoinByCodeForm, OpenRoomList, BackButton, PlanetBadge],
  template: `
    <nav class="page-crumb" aria-label="Navegación">
      <app-back-button label="Menú de juegos" link="/juegos" />
    </nav>

    @if (loading()) {
      <div class="d-flex align-items-center gap-2" role="status">
        <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
        <span>Cargando juego…</span>
      </div>
    } @else if (error()) {
      <div class="alert alert-danger" role="alert">No se ha podido cargar el juego: {{ error() }}</div>
    } @else if (game(); as game) {
      <section class="page-intro page-intro--compact" aria-labelledby="game-title">
        <app-planet-badge />
        <p class="page-intro__eyebrow">A preparar el viaje</p>
        <h1 id="game-title" class="page-title">{{ game.nombre }}</h1>
        <p class="page-intro__copy">
          {{ game.descripcion ?? 'Cread una sala o uníos con vuestro código para empezar a jugar.' }}
        </p>
      </section>

      @if (!isPlayable()) {
        <div class="alert alert-info" role="status">
          Este juego todavía no se puede jugar: puedes crear la sala e invitar, pero la partida llegará pronto.
        </div>
      }

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-6">
          <section class="card h-100 shadow-sm" aria-labelledby="create-room-title">
            <div class="card-body">
              <h2 id="create-room-title" class="h5 card-title">Crear sala</h2>
              <app-create-room-form [gameId]="game.id" [gameClave]="game.clave" />
            </div>
          </section>
        </div>
        <div class="col-12 col-md-6">
          <section class="card h-100 shadow-sm" aria-labelledby="join-room-title">
            <div class="card-body">
              <h2 id="join-room-title" class="h5 card-title">Unirse con código</h2>
              <app-join-by-code-form />
            </div>
          </section>
        </div>
      </div>

      <app-open-room-list [gameId]="game.id" />
    } @else {
      <div class="alert alert-warning" role="alert">Este juego no existe.</div>
    }
  `,
})
export class GameDetail {
  private readonly gameService = inject(GameService);

  /** Route parameter `:id`, bound through withComponentInputBinding(). */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly game = signal<Game | null>(null);
  protected readonly isPlayable = computed(() => PLAYABLE_GAMES.includes(this.game()?.clave ?? ''));

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  private async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.game.set(Number.isInteger(id) ? await this.gameService.getGame(id) : null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }
}
