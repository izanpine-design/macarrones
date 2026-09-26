import { DOCUMENT, inject } from '@angular/core';
import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { GameThemeService } from './game-theme.service';

const GAME_URL = /^\/juegos\/(\d+)/;

/**
 * Picks the page transition from where we come and where we go:
 * entering a game plays its planet's animation, leaving it plays it backwards.
 * The choice is exposed as `data-vt` / `data-vt-style` on <html> for styles.css.
 */
export function gameViewTransition({ transition, from, to }: ViewTransitionInfo): void {
  const document = inject(DOCUMENT);
  const themes = inject(GameThemeService);
  if (document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    transition.skipTransition();
    return;
  }

  const fromUrl = urlOf(from);
  const toUrl = urlOf(to);
  const toGame = GAME_URL.exec(toUrl);
  const inGame = GAME_URL.test(fromUrl) || fromUrl.startsWith('/sala/');

  let direction: 'enter' | 'exit' | null = null;
  let style: string = 'warp';
  if (toGame && !inGame) {
    direction = 'enter';
    style = themes.forId(Number(toGame[1]))?.transition ?? 'warp';
  } else if (inGame && !toGame && !toUrl.startsWith('/sala/')) {
    direction = 'exit';
    style = themes.current()?.transition ?? 'warp';
  } else if (fromUrl === '/' && toUrl.startsWith('/juegos')) {
    direction = 'enter'; // Take-off from the welcome page.
  } else if (toUrl === '/' && fromUrl !== '/') {
    direction = 'exit';
  } else if (toUrl.startsWith('/sala/') && GAME_URL.test(fromUrl)) {
    direction = 'enter';
    style = 'dock';
  }
  if (!direction) return;

  const root = document.documentElement;
  root.dataset['vt'] = direction;
  root.dataset['vtStyle'] = style;
  const clear = (): void => {
    delete root.dataset['vt'];
    delete root.dataset['vtStyle'];
  };
  // Also when the transition is aborted (hidden tab, quick navigation): no unhandled rejection.
  transition.finished.then(clear, clear);
}

function urlOf(snapshot: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  for (let s: ActivatedRouteSnapshot | null = snapshot; s; s = s.firstChild) {
    parts.push(...s.url.map((segment) => segment.path));
  }
  return '/' + parts.join('/');
}
