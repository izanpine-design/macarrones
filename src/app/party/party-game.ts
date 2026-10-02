import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { AdivinanzaGame } from './games/adivinanza/adivinanza-game';
import { CuantoMeConocesGame } from './games/cuanto-me-conoces/cuanto-me-conoces-game';
import { KryptonitaGame } from './games/kryptonita/kryptonita-game';
import { MasProbableGame } from './games/mas-probable/mas-probable-game';
import { MimicaGame } from './games/mimica/mimica-game';
import { PalabraProhibidaGame } from './games/palabra-prohibida/palabra-prohibida-game';
import { ReglasCartaGame } from './games/reglas-carta/reglas-carta-game';
import { TierListGame } from './games/tier-list/tier-list-game';
import { YoNuncaGame } from './games/yo-nunca/yo-nunca-game';
import { PARTY_BACKEND, PartyBackend, PartyPlayer } from './party.model';
import { PartyStore } from './party-store';
import { SupabasePartyBackend } from './supabase-party-backend';

/**
 * Game screen of every game except "Verdad o reto". Creates the game's store
 * (one per screen, shared by the game component inside) and follows the
 * room's state.
 */
@Component({
  selector: 'app-party-game',
  imports: [
    AdivinanzaGame,
    CuantoMeConocesGame,
    KryptonitaGame,
    MasProbableGame,
    MimicaGame,
    PalabraProhibidaGame,
    ReglasCartaGame,
    TierListGame,
    YoNuncaGame,
  ],
  providers: [PartyStore],
  template: `
    <h2 class="visually-hidden">Partida</h2>

    @if (store.error(); as message) {
      <div class="alert alert-warning d-flex align-items-center gap-2 py-2" role="alert">
        <span class="flex-grow-1">{{ message }}</span>
        <button type="button" class="btn btn-sm btn-outline-dark" (click)="retry()">Reintentar</button>
      </div>
    }

    @if (store.loading()) {
      <div class="d-flex align-items-center gap-2 mb-3" role="status">
        <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
        <span>Cargando la partida…</span>
      </div>
    } @else if (store.state()) {
      @switch (clave()) {
        @case ('yo_nunca') {
          <app-yo-nunca-game />
        }
        @case ('quien_es_mas_probable') {
          <app-mas-probable-game />
        }
        @case ('palabra_prohibida') {
          <app-palabra-prohibida-game />
        }
        @case ('reglas_por_carta') {
          <app-reglas-carta-game />
        }
        @case ('tu_kryptonita') {
          <app-kryptonita-game />
        }
        @case ('cuanto_me_conoces') {
          <app-cuanto-me-conoces-game />
        }
        @case ('secretos_anonimos') {
          <app-adivinanza-game modo="secretos" />
        }
        @case ('quien_dijo_que') {
          <app-adivinanza-game modo="frases" />
        }
        @case ('mimica_pictionary') {
          <app-mimica-game />
        }
        @case ('tier_list') {
          <app-tier-list-game />
        }
        @default {
          <p class="alert alert-info">Este juego todavía no se puede jugar.</p>
        }
      }
    } @else {
      <p class="text-body-secondary" role="status">Esperando a que empiece la partida…</p>
    }

    @if (store.isHost()) {
      <button
        type="button"
        class="btn btn-outline-secondary w-100 mb-3"
        [disabled]="store.busy()"
        (click)="end()"
      >
        {{ confirmEnd() ? '¿Seguro? Toca otra vez para terminar' : 'Terminar partida' }}
      </button>
    }
  `,
})
export class PartyGame {
  protected readonly store = inject(PartyStore);
  private readonly defaultBackend = inject(PARTY_BACKEND, { optional: true }) ?? inject(SupabasePartyBackend);
  private readonly auth = inject(AuthService);

  readonly roomId = input.required<string>();
  readonly clave = input.required<string | null>();
  readonly players = input.required<readonly PartyPlayer[]>();
  readonly hostId = input.required<string | null>();
  /** Who plays on this screen (the test page sets it; otherwise the signed-in user). */
  readonly me = input<string | null>(null);
  /** Server to use (the test page passes an in-memory one; otherwise Supabase). */
  readonly backend = input<PartyBackend | null>(null);

  protected readonly confirmEnd = signal(false);

  constructor() {
    effect(() => {
      const roomId = this.roomId();
      const me = this.me() ?? this.auth.userId();
      if (!me) return;
      untracked(() =>
        this.store.init({
          backend: this.backend() ?? this.defaultBackend,
          roomId,
          me,
          players: () => this.players(),
          hostId: () => this.hostId(),
        }),
      );
    });
    inject(DestroyRef).onDestroy(() => this.store.destroy());
  }

  protected retry(): void {
    this.store.error.set(null);
    void this.store.reload();
  }

  /** Two taps: the first one asks for confirmation. */
  protected end(): void {
    if (!this.confirmEnd()) {
      this.confirmEnd.set(true);
      return;
    }
    this.confirmEnd.set(false);
    void this.store.run(() => this.store.backend.endGame(this.store.roomId));
  }
}
