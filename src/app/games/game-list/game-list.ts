import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService, GameSummary } from '../../core/game.service';
import { PLAYABLE_GAMES } from '../../core/room.model';

@Component({
  selector: 'app-game-list',
  imports: [RouterLink],
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
      @for (section of sections(); track section.title) {
        @if (section.games.length > 0) {
          <section class="mb-4" [attr.aria-labelledby]="section.id">
            <h3 [id]="section.id" class="h5 mb-3">
              <span aria-hidden="true">{{ section.icon }}</span> {{ section.title }}
            </h3>
            <ul class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 list-unstyled">
              @for (game of section.games; track game.id) {
                <li class="col">
                  <article class="card h-100 shadow-sm game-card">
                    <div class="card-body d-flex flex-column">
                      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <h4 class="card-title h5 mb-0">
                          <a
                            [routerLink]="['/juegos', game.id]"
                            class="stretched-link link-body-emphasis text-decoration-none"
                          >
                            {{ game.nombre }}
                          </a>
                        </h4>
                        @if (!isPlayable(game)) {
                          <span class="badge text-bg-secondary flex-shrink-0">Próximamente</span>
                        }
                      </div>
                      @if (game.descripcion) {
                        <p class="card-text text-body-secondary small mb-2">{{ game.descripcion }}</p>
                      }
                      @if (game.questionCount > 0) {
                        <p class="card-text small text-body-secondary mt-auto mb-0">
                          {{ game.questionCount }} {{ game.questionCount === 1 ? 'pregunta' : 'preguntas' }}
                        </p>
                      }
                    </div>
                  </article>
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styles: `
    .game-card {
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .game-card:hover,
    .game-card:focus-within {
      transform: translateY(-2px);
      box-shadow: var(--bs-box-shadow) !important;
    }
    .game-card:focus-within {
      outline: 3px solid var(--bs-primary);
      outline-offset: 2px;
    }
    .game-card a:focus-visible {
      outline: none;
    }
  `,
})
export class GameList {
  private readonly gameService = inject(GameService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly games = signal<GameSummary[]>([]);

  protected readonly sections = computed(() => [
    {
      id: 'games-alcohol',
      icon: '🍻',
      title: 'Con alcohol',
      games: this.games().filter((game) => game.con_alcohol),
    },
    {
      id: 'games-no-alcohol',
      icon: '🧃',
      title: 'Sin alcohol',
      games: this.games().filter((game) => !game.con_alcohol),
    },
  ]);

  protected isPlayable(game: GameSummary): boolean {
    return PLAYABLE_GAMES.includes(game.clave);
  }

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
