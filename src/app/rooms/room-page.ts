import { Component, DestroyRef, DOCUMENT, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomInfo, RoomPlayer, Turn } from '../core/room.model';
import { isNetworkError, roomErrorMessage, RoomService } from '../core/room.service';
import { TurnService } from '../core/turn.service';
import { ProfileService } from '../core/profile.service';
import { RoomLobby } from './room-lobby';
import { RoomPasswordForm } from './room-password-form';
import { TruthOrDareGame } from './truth-or-dare/truth-or-dare-game';
import { PartyGame } from '../party/party-game';
import { BackButton } from '../shared/back-button/back-button';
import { DrinkAlert } from '../shared/drink/drink-alert';
import { GameThemeService } from '../shared/themes/game-theme.service';
import { PlanetBadge } from '../shared/themes/planet-badge';

/**
 * /sala/:codigo — entry point of invite links. Rooms without password are
 * joined directly; protected ones ask for the password first. Once inside, it
 * keeps the room, players and current turn in sync through Realtime and shows
 * the lobby or the game.
 */
@Component({
  selector: 'app-room-page',
  host: {
    // Phones cut connections while the page is in the background (e.g. while
    // sharing the invite): catch up when it comes back.
    '(document:visibilitychange)': 'onVisibilityChange()',
    '(window:online)': 'resync()',
  },
  imports: [RouterLink, RoomLobby, RoomPasswordForm, TruthOrDareGame, PartyGame, BackButton, PlanetBadge, DrinkAlert],
  template: `
    <nav class="page-crumb" aria-label="Navegación">
      @if (room()?.soy_miembro) {
        <app-back-button
          label="Menú de juegos"
          confirmLabel="¿Salir de la sala? Toca otra vez"
          [busy]="leaving()"
          (go)="leave(room()!, ['/juegos'])"
        />
      } @else {
        <app-back-button label="Menú de juegos" link="/juegos" />
      }
    </nav>

    <section class="page-intro page-intro--compact" aria-label="Sala de juego">
      <app-planet-badge />
      <p class="page-intro__eyebrow">Estación de la tripulación</p>
      <h1 class="page-title">¡Pasta a la vista!</h1>
      <p class="page-intro__copy">La pandilla está a punto de despegar.</p>
    </section>

    <div class="row justify-content-center room-layout">
      <div class="col-12 col-md-8 col-lg-6">
        @if (loading()) {
          <div class="d-flex align-items-center gap-2" role="status">
            <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
            <span>Entrando en la sala…</span>
          </div>
        } @else if (error()) {
          <div class="alert alert-danger" role="alert">
            {{ error() }}
            <button type="button" class="btn btn-sm btn-outline-danger ms-2" (click)="load()">Reintentar</button>
          </div>
          <a routerLink="/juegos" class="link-primary">← Volver a los juegos</a>
        } @else if (room(); as room) {
          @if (room.soy_miembro) {
            @if (syncError(); as message) {
              <div class="alert alert-warning d-flex align-items-center gap-2 py-2" role="status">
                <span class="flex-grow-1">{{ message }} Reintentando…</span>
                <button type="button" class="btn btn-sm btn-outline-dark" (click)="resync()">Reintentar ahora</button>
              </div>
            }
            <app-drink-alert [roomId]="room.id" />
            @if (room.estado === 'jugando' && room.juego_clave === 'verdad_o_reto' && turn(); as turn) {
              <app-truth-or-dare-game [room]="room" [turn]="turn" [hostId]="hostId()" />
            } @else if (room.estado === 'jugando' && room.juego_clave !== 'verdad_o_reto') {
              <app-party-game [roomId]="room.id" [clave]="room.juego_clave" [players]="players()" [hostId]="hostId()" />
            } @else {
              <app-room-lobby [room]="room" [players]="players()" [hostId]="hostId()" />
            }

            <button type="button" class="btn btn-outline-danger w-100" [disabled]="leaving()" (click)="leave(room)">
              Salir de la sala
            </button>
          } @else {
            <app-room-password-form [room]="room" (joined)="load()" />
            <a [routerLink]="['/juegos', room.juego_id]" class="d-inline-block mt-3 link-primary">
              ← Volver a {{ room.juego }}
            </a>
          }
        } @else {
          <div class="alert alert-warning" role="alert">
            No existe ninguna sala con el código <span class="font-monospace">{{ codigo() }}</span>.
          </div>
          <a routerLink="/juegos" class="link-primary">← Volver a los juegos</a>
        }
      </div>
    </div>
  `,
})
export class RoomPage {
  private readonly rooms = inject(RoomService);
  private readonly turns = inject(TurnService);
  private readonly router = inject(Router);
  private readonly themes = inject(GameThemeService);
  private readonly profiles = inject(ProfileService);

  /** Route parameter `:codigo`. */
  readonly codigo = input.required<string>();

  protected readonly loading = signal(true);
  /** The room could not be opened (replaces the page). */
  protected readonly error = signal<string | null>(null);
  /** A background update failed; the room stays on screen and it retries. */
  protected readonly syncError = signal<string | null>(null);
  protected readonly leaving = signal(false);
  protected readonly room = signal<RoomInfo | null>(null);
  protected readonly players = signal<RoomPlayer[]>([]);
  protected readonly hostId = signal<string | null>(null);
  protected readonly turn = signal<Turn | null>(null);

  private readonly document = inject(DOCUMENT);
  private stopWatching: (() => void) | null = null;
  private retryTimer: number | undefined;
  private retries = 0;
  /** Ignores responses of older refreshes that arrive after newer ones. */
  private refreshCount = 0;

  constructor() {
    effect(() => {
      this.codigo();
      untracked(() => void this.load());
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching?.();
      this.document.defaultView?.clearTimeout(this.retryTimer);
    });
  }

  protected async load(): Promise<void> {
    const code = this.normalizedCode();
    this.loading.set(true);
    this.error.set(null);
    try {
      let room = await this.rooms.getRoomInfo(code);
      if (room && !room.soy_miembro && !room.tiene_password) {
        await this.rooms.joinRoom(code, null);
        room = await this.rooms.getRoomInfo(code);
      }
      if (room?.soy_miembro) {
        await this.loadMemberData(room);
        this.watch(room.id);
      }
      this.room.set(room);
      this.themes.reportRoomGame(room?.juego_clave);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async leave(room: RoomInfo, destination: unknown[] = ['/juegos', room.juego_id]): Promise<void> {
    this.leaving.set(true);
    try {
      this.stopWatching?.();
      this.stopWatching = null;
      await this.rooms.leaveRoom(room.id);
      await this.router.navigate(destination);
    } catch (e) {
      this.syncError.set(roomErrorMessage(e));
      this.leaving.set(false);
    }
  }

  /** Brings the room up to date now (button, connection back, page visible again). */
  protected resync(): void {
    if (this.room()?.soy_miembro) void this.refresh();
  }

  protected onVisibilityChange(): void {
    if (this.document.visibilityState === 'visible') this.resync();
  }

  private watch(roomId: string): void {
    this.stopWatching?.();
    this.stopWatching = this.rooms.watchRoom(roomId, () => void this.refresh());
  }

  /** Called on every Realtime change of the room, its players or its turns. */
  private async refresh(): Promise<void> {
    const count = ++this.refreshCount;
    try {
      const room = await this.rooms.getRoomInfo(this.normalizedCode());
      if (count !== this.refreshCount) return;
      if (room?.soy_miembro) {
        await this.loadMemberData(room, count);
      }
      if (count !== this.refreshCount) return;
      this.room.set(room);
      this.syncError.set(null);
      this.retries = 0;
    } catch (e) {
      if (count !== this.refreshCount) return;
      // Keep showing the room: tell the player and try again in a moment.
      this.syncError.set(isNetworkError(e) ? 'Se ha cortado la conexión.' : roomErrorMessage(e));
      this.scheduleRetry();
    }
  }

  /** Retries after 2 s, 4 s, 8 s… up to 30 s. */
  private scheduleRetry(): void {
    const window = this.document.defaultView;
    if (!window) return;
    window.clearTimeout(this.retryTimer);
    const delay = Math.min(30_000, 2000 * 2 ** this.retries++);
    this.retryTimer = window.setTimeout(() => this.resync(), delay);
  }

  private async loadMemberData(room: RoomInfo, count = this.refreshCount): Promise<void> {
    const [lobby, turn] = await Promise.all([
      this.rooms.getLobby(room.id),
      room.estado === 'jugando' && room.juego_clave === 'verdad_o_reto' ? this.turns.getCurrentTurn(room.id) : Promise.resolve(null),
    ]);
    if (count !== this.refreshCount) return;
    this.players.set(lobby.players);
    this.hostId.set(lobby.hostId);
    this.turn.set(turn);
    // Rockets and heads of whoever is in the room (lobby, "¡A beber!"). Not
    // blocking: without them players show with their initial.
    this.profiles.ensureProfiles(lobby.players.map((p) => p.user_id)).catch((e: unknown) => {
      console.warn('[RoomPage] No se han podido cargar los perfiles de la sala:', e);
    });
  }

  private normalizedCode(): string {
    return this.codigo().trim().toUpperCase();
  }
}
