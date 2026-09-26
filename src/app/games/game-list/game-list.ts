import { Component, inject, signal } from '@angular/core';
import { GameService, GameSummary } from '../../core/game.service';

@Component({
  selector: 'app-game-list',
  template: `
    <h2 class="h4 mb-3">Elige un juego</h2>

    @if (loading()) {
      <div class="d-flex align-items-center gap-2" role="status">
        <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
        <span>Cargando juegos…</span>
      </div>
    } @else if (error()) {
      <div class="alert alert-danger" role="alert">
        No se han podido cargar los juegos: {{ error() }}
      </div>
    } @else if (games().length === 0) {
      <p class="text-body-secondary">Todavía no hay juegos disponibles.</p>
    } @else {
      <ul class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 list-unstyled">
        @for (game of games(); track game.id) {
          <li class="col">
            <article class="card h-100 shadow-sm">
              <div class="card-body">
                <h3 class="card-title h5">{{ game.nombre }}</h3>
                <p class="card-text text-body-secondary mb-0">
                  {{ game.questionCount }} {{ game.questionCount === 1 ? 'pregunta' : 'preguntas' }}
                </p>
              </div>
            </article>
          </li>
        }
      </ul>
    }
  `,
})
export class GameList {
  private readonly gameService = inject(GameService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly games = signal<GameSummary[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.games.set(await this.gameService.getGames());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }
}
