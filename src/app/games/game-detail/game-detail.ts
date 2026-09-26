import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../../core/question.model';
import { GameService } from '../../core/game.service';

@Component({
  selector: 'app-game-detail',
  imports: [RouterLink],
  template: `
    <nav class="mb-3" aria-label="Navegación">
      <a routerLink="/juegos" class="link-primary">← Volver a los juegos</a>
    </nav>

    @if (loading()) {
      <div class="d-flex align-items-center gap-2" role="status">
        <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
        <span>Cargando juego…</span>
      </div>
    } @else if (error()) {
      <div class="alert alert-danger" role="alert">No se ha podido cargar el juego: {{ error() }}</div>
    } @else if (game(); as game) {
      <h2 class="h3">{{ game.nombre }}</h2>
      <p class="text-body-secondary">Aquí podrás crear una sala o unirte a una. Próximamente.</p>
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
