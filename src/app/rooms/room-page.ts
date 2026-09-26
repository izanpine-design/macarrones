import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomInfo } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';
import { RoomLobby } from './room-lobby';
import { RoomPasswordForm } from './room-password-form';

/**
 * /sala/:codigo — entry point of invite links. Rooms without password are
 * joined directly; protected ones ask for the password first.
 */
@Component({
  selector: 'app-room-page',
  imports: [RouterLink, RoomLobby, RoomPasswordForm],
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
            <app-room-lobby [room]="room" (left)="onLeft(room)" />
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
  private readonly router = inject(Router);

  /** Route parameter `:codigo`. */
  readonly codigo = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly room = signal<RoomInfo | null>(null);

  constructor() {
    effect(() => {
      this.codigo();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const code = this.codigo().trim().toUpperCase();
    this.loading.set(true);
    this.error.set(null);
    try {
      let room = await this.rooms.getRoomInfo(code);
      if (room && !room.soy_miembro && !room.tiene_password) {
        await this.rooms.joinRoom(code, null);
        room = await this.rooms.getRoomInfo(code);
      }
      this.room.set(room);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected onLeft(room: RoomInfo): void {
    void this.router.navigate(['/juegos', room.juego_id]);
  }
}
