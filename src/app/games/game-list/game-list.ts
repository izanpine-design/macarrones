import { Component, computed, inject, signal } from '@angular/core';
import { GameService, GameSummary } from '../../core/game.service';
import { PLAYABLE_GAMES } from '../../core/room.model';
import { GameTube } from './game-tube';

@Component({
  selector: 'app-game-list',
  imports: [GameTube],
  template: `
    <section class="page-intro" aria-labelledby="games-title">
      <p class="page-intro__eyebrow">El menú de la tripulación</p>
      <h1 id="games-title" class="page-title">Elige un juego</h1>
      <p class="page-intro__copy">Reúne a la pandilla, prepara la pasta y elegid vuestra próxima aventura.</p>
    </section>

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
          <section class="menu-section" [attr.aria-labelledby]="section.id">
            <h2 [id]="section.id" class="menu-section__title">
              <span aria-hidden="true">{{ section.icon }}</span> {{ section.title }}
            </h2>
            <ul class="menu">
              @for (game of section.games; track game.id) {
                <li>
                  <app-game-tube [game]="game" [playable]="isPlayable(game)" />
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styleUrl: './game-list.css',
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
