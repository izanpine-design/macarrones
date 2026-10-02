import { Component, computed, signal } from '@angular/core';
import { PARTY_GAMES } from '../party/games';
import { PartyPlayer } from '../party/party.model';
import { PartyGame } from '../party/party-game';
import { LocalPartyServer } from './local-party-backend';

const PLAYERS: PartyPlayer[] = [
  { user_id: 'ana', apodo: 'Ana' },
  { user_id: 'bea', apodo: 'Bea' },
  { user_id: 'cris', apodo: 'Cris' },
];

/** A few texts per game (the real ones come from the packs in Supabase). */
const PACKS: Record<string, string[]> = {
  yo_nunca: ['Yo nunca nunca he cantado en un karaoke.', 'Yo nunca nunca me he caído en público.', 'Yo nunca nunca he copiado en un examen.'],
  quien_es_mas_probable: ['¿Quién es más probable que llegue tarde a su boda?', '¿Quién es más probable que se haga famoso?'],
  palabra_prohibida: ['vale', 'tío', 'literal', 'beber', 'hola', 'jaja'],
  cuanto_me_conoces: ['¿Cuál es mi comida favorita?', '¿Qué superpoder elegiría?', '¿Cuál es mi color favorito?'],
  mimica_pictionary: ['Titanic', 'pingüino', 'Torre Eiffel', 'hacerse un selfie'],
  tier_list: ['El que mejor cocina', 'El más dormilón'],
};

/**
 * /pruebas-juegos (development builds only): every party game with three
 * simulated players side by side, on an in-memory server. Lets you play a
 * game from start to end without Supabase.
 */
@Component({
  selector: 'app-party-sandbox',
  imports: [PartyGame],
  template: `
    <section class="page-intro page-intro--compact" aria-labelledby="sandbox-title">
      <p class="page-intro__eyebrow">Solo en desarrollo</p>
      <h1 id="sandbox-title" class="page-title">Pruebas de juegos</h1>
      <p class="page-intro__copy">Tres jugadores simulados en un servidor en memoria. Ana es la anfitriona.</p>
    </section>

    <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Juego">
      @for (clave of claves; track clave) {
        <button type="button" class="btn btn-sm" [class]="clave === juego() ? 'btn-dark' : 'btn-outline-dark'" (click)="start(clave)">
          {{ clave }}
        </button>
      }
    </div>

    @if (juego(); as clave) {
      <div class="row g-3">
        @for (p of players; track p.user_id) {
          <div class="col-12 col-lg-4">
            <section class="card shadow-sm" [attr.aria-label]="'Pantalla de ' + p.apodo" [attr.data-player]="p.user_id">
              <div class="card-header fw-semibold">📱 {{ p.apodo }}</div>
              <div class="card-body">
                @if (activo()) {
                  <app-party-game [roomId]="'sandbox'" [clave]="clave" [players]="players" hostId="ana" [me]="p.user_id" [backend]="backends[p.user_id]" />
                } @else {
                  <p class="text-body-secondary">Partida terminada.</p>
                }
              </div>
            </section>
          </div>
        }
      </div>

      <section class="card mt-3" aria-label="Avisos de beber">
        <div class="card-body">
          <h2 class="h6 text-uppercase text-body-secondary">¡A beber! enviados</h2>
          <ul class="small mb-0" data-drinks>
            @for (d of server.drinks(); track d.at + d.userId) {
              <li>{{ d.apodo }}: {{ d.motivo ?? d.reason }} (lo dice {{ d.por }}){{ d.detalle ? ' · ' + d.detalle : '' }}</li>
            } @empty {
              <li>Ninguno.</li>
            }
          </ul>
        </div>
      </section>
    }
  `,
})
export class PartySandbox {
  protected readonly server = new LocalPartyServer(PACKS);
  protected readonly players = PLAYERS;
  protected readonly claves = Object.keys(PARTY_GAMES);
  protected readonly backends = Object.fromEntries(PLAYERS.map((p) => [p.user_id, this.server.backendFor(p.user_id)]));
  protected readonly juego = signal<string | null>(null);
  /** Remounts the three screens on every new game. */
  private readonly round = signal(0);
  protected readonly activo = computed(() => this.round() > 0 && this.server.ended() < this.round());

  protected start(clave: string): void {
    const game = PARTY_GAMES[clave];
    this.juego.set(null);
    this.server.reset(game.inicial(this.server.packItems(clave), PLAYERS.map((p) => p.user_id)));
    // Next tick: the screens are destroyed and created again for the new game.
    setTimeout(() => {
      this.round.set(this.server.ended() + 1);
      this.juego.set(clave);
    });
  }
}
