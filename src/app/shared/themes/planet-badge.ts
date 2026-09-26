import { Component, inject } from '@angular/core';
import { GameThemeService } from './game-theme.service';

/** "🎰 Casino Nebulosa — La ruleta decide tu destino": the planet of the current game. */
@Component({
  selector: 'app-planet-badge',
  template: `
    @if (theme(); as t) {
      <p class="planet-badge">
        <span class="planet-badge__icon" aria-hidden="true">{{ t.icono }}</span>
        <strong>{{ t.planeta }}</strong>
        <span class="planet-badge__lema">· {{ t.lema }}</span>
      </p>
    }
  `,
  styles: `
    :host { display: block; }
    .planet-badge {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      gap: .45rem;
      margin: 0 0 .9rem;
      padding: .3rem .9rem .3rem .35rem;
      border: 1px solid color-mix(in srgb, var(--game-accent) 30%, transparent);
      border-radius: 999px;
      color: #2a2130;
      background: rgb(255 255 255 / 78%);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--game-accent) 16%, transparent);
      font-size: .9rem;
    }
    .planet-badge__icon {
      display: grid;
      width: 2rem;
      height: 2rem;
      place-items: center;
      border-radius: 50%;
      background: var(--game-soft);
      box-shadow: inset 0 0 0 2px var(--game-accent);
      font-size: 1.1rem;
      animation: orbit 3s ease-in-out infinite alternate;
    }
    strong { color: var(--game-accent); }
    .planet-badge__lema { color: #5c5058; }
    @keyframes orbit { to { transform: rotate(12deg) scale(1.08); } }
    @media (max-width: 600px) { .planet-badge__lema { display: none; } }
    @media (prefers-reduced-motion: reduce) { .planet-badge__icon { animation: none; } }
  `,
})
export class PlanetBadge {
  protected readonly theme = inject(GameThemeService).current;
}
