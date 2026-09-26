import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameSummary } from '../../core/game.service';
import { themeFor } from '../../shared/themes/game-themes';

let nextId = 0;

/**
 * One game of the menu: a clean card with an illustration of a penne rigate
 * flying in front of the game's planet, the game's thing peeking out of it.
 * Playable games have tomato sauce on top; the rest are raw pasta.
 */
@Component({
  selector: 'app-game-tube',
  imports: [RouterLink],
  templateUrl: './game-tube.html',
  styleUrl: './game-tube.css',
})
export class GameTube {
  readonly game = input.required<GameSummary>();
  readonly playable = input(false);

  protected readonly theme = computed(() => themeFor(this.game().clave));
  protected readonly ids = (() => {
    const n = nextId++;
    return { body: `penne-body-${n}`, hole: `penne-hole-${n}`, raw: `penne-raw-${n}` };
  })();
}
