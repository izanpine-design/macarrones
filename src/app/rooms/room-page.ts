import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomInfo, RoomPlayer, Turn } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';
import { TurnService } from '../core/turn.service';
import { RoomLobby } from './room-lobby';
import { RoomPasswordForm } from './room-password-form';
import { TruthOrDareGame } from './truth-or-dare/truth-or-dare-game';

/**
 * /sala/:codigo — entry point of invite links. Rooms without password are
 * joined directly; protected ones ask for the password first. Once inside, it
 * keeps the room, players and current turn in sync through Realtime and shows
 * the lobby or the game.
 */
@Component({
  selector: 'app-room-page',
  imports: [RouterLink, RoomLobby, RoomPasswordForm, TruthOrDareGame],
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-md-8 col-lg-6">
        @if (loading()) {
          <div class="d-flex align-items-center gap-2" role="status">
            <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
            <span>Entrando en la sala…</span>
          </div>
        } @else if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
          <a routerLink="/juegos" class="link-primary">← Volver a los juegos</a>
        } @else if (room(); as room) {
          @if (room.soy_miembro) {
            @if (room.estado === 'jugando' && turn(); as turn) {
              <app-truth-or-dare-game [room]="room" [turn]="turn" [hostId]="hostId()" />
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

  /** Route parameter `:codigo`. */
  readonly codigo = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly leaving = signal(false);
  protected readonly room = signal<RoomInfo | null>(null);
  protected readonly players = signal<RoomPlayer[]>([]);
  protected readonly hostId = signal<string | null>(null);
  protected readonly turn = signal<Turn | null>(null);

  private stopWatching: (() => void) | null = null;
  /** Ignores responses of older refreshes that arrive after newer ones. */
  private refreshCount = 0;

  constructor() {
    effect(() => {
      this.codigo();
      untracked(() => void this.load());
    });
    inject(DestroyRef).onDestroy(() => this.stopWatching?.());
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
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async leave(room: RoomInfo): Promise<void> {
    this.leaving.set(true);
    try {
      this.stopWatching?.();
      this.stopWatching = null;
      await this.rooms.leaveRoom(room.id);
      await this.router.navigate(['/juegos', room.juego_id]);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
      this.leaving.set(false);
    }
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
      if (count === this.refreshCount) this.room.set(room);
    } catch (e) {
      if (count === this.refreshCount) this.error.set(roomErrorMessage(e));
    }
  }

  private async loadMemberData(room: RoomInfo, count = this.refreshCount): Promise<void> {
    const [lobby, turn] = await Promise.all([
      this.rooms.getLobby(room.id),
      room.estado === 'jugando' ? this.turns.getCurrentTurn(room.id) : Promise.resolve(null),
    ]);
    if (count !== this.refreshCount) return;
    this.players.set(lobby.players);
    this.hostId.set(lobby.hostId);
    this.turn.set(turn);
  }

  private normalizedCode(): string {
    return this.codigo().trim().toUpperCase();
  }
}
