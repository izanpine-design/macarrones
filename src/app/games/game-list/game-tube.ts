import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameSummary } from '../../core/game.service';

/**
 * One game of the menu as a macaroni tube: sauce at one end, the game's
 * label and badge, and its thing peeking out of the other end. Games that
 * cannot be played yet are raw pasta with a cork.
 */
@Component({
  selector: 'app-game-tube',
  imports: [RouterLink],
  template: `
    @let g = game();
    <article class="tube" [class.tube--soon]="!playable()" [attr.data-game]="g.clave">
      <span class="tube__end" aria-hidden="true"></span>
      <span class="tube__drip" aria-hidden="true"></span>
      <span class="tube__band" aria-hidden="true"></span>
      <span class="tube__badge" aria-hidden="true"></span>
      <div class="tube__text">
        <h3 class="tube__title">
          <a class="tube__link" [routerLink]="['/juegos', g.id]">{{ g.nombre }}</a>
        </h3>
        @if (g.descripcion) {
          <p class="tube__desc">{{ g.descripcion }}</p>
        }
        <p class="tube__meta">
          @if (playable()) {
            <span class="tube__play"><span aria-hidden="true">▶</span> ¡A jugar!</span>
          } @else {
            <span class="tube__soon">Próximamente</span>
          }
          @if (g.questionCount > 0) {
            <span>{{ g.questionCount }} {{ g.questionCount === 1 ? 'pregunta' : 'preguntas' }}</span>
          }
        </p>
      </div>
      <span class="tube__mouth" aria-hidden="true"></span>
      <span class="tube__peek" aria-hidden="true"></span>
      <span class="tube__steam" aria-hidden="true"><i></i><i></i><i></i></span>
    </article>
  `,
  styleUrl: './game-tube.css',
})
export class GameTube {
  readonly game = input.required<GameSummary>();
  readonly playable = input(false);
}
