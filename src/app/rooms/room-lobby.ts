import { Component, computed, DOCUMENT, inject, input, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { PLAYABLE_GAMES, RoomInfo, RoomPlayer } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';
import { RoomQuestions } from './questions/room-questions';
import { ProfileService } from '../core/profile.service';
import { CrewHead } from '../shared/crew/crew-head';
import { PARTY_GAMES } from '../party/games';
import { SupabasePartyBackend } from '../party/supabase-party-backend';

const MIN_PLAYERS = 2;

/** Waiting room: invite button, players and (for the host) the start button. */
@Component({
  selector: 'app-room-lobby',
  imports: [RoomQuestions, CrewHead],
  template: `
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4 text-center">
        <p class="text-body-secondary mb-1">{{ room().juego }} · Código de la sala</p>
        <p class="display-5 font-monospace fw-bold mb-3" [attr.aria-label]="'Código ' + spelledCode()">
          {{ room().codigo }}
        </p>

        <button type="button" class="btn btn-primary btn-lg" (click)="invite()">Invitar</button>
        <p class="small mt-2 mb-0" aria-live="polite">{{ inviteFeedback() }}</p>
        @if (room().tiene_password) {
          <p class="small text-body-secondary mt-2 mb-0">
            <span aria-hidden="true">🔒</span> La sala tiene contraseña: pásasela a tus amigos aparte.
          </p>
        }
      </div>
    </div>

    <section class="card shadow-sm mb-3" aria-labelledby="players-title">
      <div class="card-body">
        <h2 id="players-title" class="h5">Jugadores ({{ players().length }})</h2>
        <ul class="list-group list-group-flush" aria-live="polite">
          @for (player of players(); track player.user_id) {
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
              <span class="d-flex align-items-center gap-2">
                <app-crew-head class="lobby-head" [crew]="profiles.lookFor(player.user_id)" [nickname]="player.apodo" />
                <span>
                  {{ player.apodo }}
                  @if (player.user_id === userId()) {
                    <span class="text-body-secondary">(tú)</span>
                  }
                  @if (!profiles.lookFor(player.user_id)) {
                    <span class="d-block small text-body-secondary">Invitado</span>
                  }
                </span>
              </span>
              @if (player.user_id === hostId()) {
                <span class="badge text-bg-primary">Anfitrión</span>
              }
            </li>
          }
        </ul>
      </div>
    </section>

    @if (usesPack()) {
      <app-room-questions [room]="room()" [isHost]="isHost()" />
    }

    @if (!isPlayable()) {
      <p class="text-body-secondary text-center">Este juego todavía no se puede jugar. ¡Pronto!</p>
    } @else if (isHost()) {
      <button
        type="button"
        class="btn btn-success btn-lg w-100 mb-2"
        [disabled]="startBlocker() !== null || starting()"
        [attr.aria-describedby]="startBlocker() ? 'start-help' : null"
        (click)="start()"
      >
        @if (starting()) {
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        }
        Empezar partida
      </button>
      @if (startBlocker(); as blocker) {
        <p id="start-help" class="small text-body-secondary text-center">{{ blocker }}</p>
      }
    } @else {
      <p class="text-body-secondary text-center" role="status">Esperando a que el anfitrión empiece la partida…</p>
    }

    @if (error()) {
      <div class="alert alert-danger" role="alert">{{ error() }}</div>
    }
  `,
  styles: `
    .lobby-head {
      flex: 0 0 40px;
      width: 40px;
    }
  `,
})
export class RoomLobby {
  private readonly rooms = inject(RoomService);
  private readonly party = inject(SupabasePartyBackend);
  private readonly window = inject(DOCUMENT).defaultView;

  readonly room = input.required<RoomInfo>();
  readonly players = input.required<RoomPlayer[]>();
  readonly hostId = input.required<string | null>();

  protected readonly userId = inject(AuthService).userId;
  protected readonly profiles = inject(ProfileService);
  protected readonly error = signal<string | null>(null);
  protected readonly starting = signal(false);
  protected readonly inviteFeedback = signal('');

  protected readonly isHost = computed(() => this.hostId() !== null && this.hostId() === this.userId());
  protected readonly isPlayable = computed(() => PLAYABLE_GAMES.includes(this.room().juego_clave ?? ''));
  /** Rules of every game except "Verdad o reto" (null for it). */
  private readonly partyGame = computed(() => PARTY_GAMES[this.room().juego_clave ?? ''] ?? null);
  /** "Verdad o reto" and the games played with a question pack. */
  protected readonly usesPack = computed(() => this.partyGame()?.usaLote ?? true);
  private readonly minPlayers = computed(() => this.partyGame()?.minJugadores ?? MIN_PLAYERS);

  /** Why the game cannot start yet, or null if it can. */
  protected readonly startBlocker = computed(() => {
    if (this.players().length < this.minPlayers()) {
      return `Hacen falta al menos ${this.minPlayers()} jugadores. ¡Invita a alguien!`;
    }
    if (this.usesPack() && !this.room().lote_id) {
      return 'Elige un lote de preguntas (o crea uno) para empezar.';
    }
    if (this.usesPack() && this.room().lote_preguntas === 0) {
      return 'El lote elegido está vacío: añade preguntas o elige otro.';
    }
    return null;
  });
  protected readonly spelledCode = computed(() => this.room().codigo.split('').join(' '));

  protected async start(): Promise<void> {
    this.starting.set(true);
    this.error.set(null);
    try {
      // The page switches to the game screen through Realtime.
      const game = this.partyGame();
      if (!game) {
        await this.rooms.startGame(this.room().id);
      } else {
        const items = game.usaLote && this.room().lote_id ? await this.party.packItems(this.room().lote_id!) : [];
        if (items.length < game.minItems) {
          this.error.set('El lote elegido no tiene suficientes preguntas para este juego.');
          return;
        }
        await this.party.start(this.room().id, game.inicial(items, this.players().map((p) => p.user_id)));
      }
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.starting.set(false);
    }
  }

  protected async invite(): Promise<void> {
    const url = `${this.window?.location.origin ?? ''}/sala/${this.room().codigo}`;
    const navigator = this.window?.navigator;
    this.inviteFeedback.set('');

    if (navigator?.share) {
      try {
        await navigator.share({
          title: 'Macarrones',
          text: `¡Únete a mi sala de ${this.room().juego}! Código: ${this.room().codigo}`,
          url,
        });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // Sharing failed: fall back to copying the link.
      }
    }

    try {
      await navigator?.clipboard.writeText(url);
      this.inviteFeedback.set('Enlace copiado. ¡Pásalo a tus amigos!');
    } catch {
      this.inviteFeedback.set(`Copia este enlace: ${url}`);
    }
  }
}
