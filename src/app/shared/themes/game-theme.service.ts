import { computed, DOCUMENT, effect, inject, Injector, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { GameTheme, themeCss, themeFor } from './game-themes';

const GAME_URL = /^\/juegos\/(\d+)/;

/**
 * The theme (planet) of the game being visited, from the URL: /juegos/:id by
 * the game id, /sala/:codigo as reported by the room page. It is exposed as
 * `data-game` on <html>, which switches the page colours to the game's.
 */
@Service()
export class GameThemeService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** Game id → clave, from the catalog. */
  private readonly keysById = signal<ReadonlyMap<number, string>>(new Map());
  /** Game clave of the room being shown (the URL only has the room code). */
  private readonly roomGame = signal<string | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly current = computed<GameTheme | null>(() => {
    const url = this.url();
    const game = GAME_URL.exec(url);
    if (game) return this.forId(Number(game[1]));
    return url.startsWith('/sala/') ? themeFor(this.roomGame()) : null;
  });

  constructor() {
    const style = this.document.createElement('style');
    style.textContent = themeCss();
    this.document.head.append(style);

    void this.loadCatalog(inject(Injector));

    effect(() => {
      const theme = this.current();
      const root = this.document.documentElement;
      if (theme) root.dataset['game'] = theme.clave;
      else delete root.dataset['game'];
    });
  }

  /** Loaded lazily so Supabase stays out of the initial bundle. */
  private async loadCatalog(injector: Injector): Promise<void> {
    try {
      const { GameService } = await import('../../core/game.service');
      const games = await injector.get(GameService).getGames();
      this.keysById.set(new Map(games.map((game) => [game.id, game.clave])));
    } catch {
      // Without the catalog, game pages just keep the default look.
    }
  }

  forId(id: number): GameTheme | null {
    return themeFor(this.keysById().get(id));
  }

  /** The room page tells which game the room is of. */
  reportRoomGame(clave: string | null | undefined): void {
    this.roomGame.set(clave ?? null);
  }
}
