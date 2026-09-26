import { Component, computed, inject } from '@angular/core';
import { GameThemeService } from './game-theme.service';

/** Where the props float: around the edges, never behind the reading column. */
const SPOTS = [
  { x: 4, y: 18, size: 34, delay: 0 },
  { x: 91, y: 16, size: 30, delay: -3 },
  { x: 7, y: 52, size: 26, delay: -6 },
  { x: 93, y: 48, size: 36, delay: -2 },
  { x: 3, y: 84, size: 30, delay: -8 },
  { x: 88, y: 80, size: 26, delay: -5 },
  { x: 16, y: 32, size: 22, delay: -9 },
  { x: 82, y: 66, size: 22, delay: -4 },
];

/**
 * Background of the game's planet, behind the page: tinted sky, a big planet
 * (with a ring on some) and the game's things floating around the edges.
 */
@Component({
  selector: 'app-game-backdrop',
  templateUrl: './game-backdrop.html',
  styleUrl: './game-backdrop.css',
  host: { 'aria-hidden': 'true' },
})
export class GameBackdrop {
  protected readonly theme = inject(GameThemeService).current;

  protected readonly props = computed(() => {
    const props = this.theme()?.props ?? [];
    return SPOTS.map((spot, i) => ({ ...spot, icon: props[i % Math.max(props.length, 1)] }));
  });
}
