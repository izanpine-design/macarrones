import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OpenRoom } from '../core/room.model';
import { RoomService } from '../core/room.service';

@Component({
  selector: 'app-open-room-list',
  imports: [RouterLink],
  template: `
    <div class="d-flex align-items-center justify-content-between mb-2">
      <h3 class="h5 m-0">Salas abiertas</h3>
      <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="loading()" (click)="load()">
        Actualizar
      </button>
    </div>

    <div aria-live="polite">
      @if (loading()) {
        <div class="d-flex align-items-center gap-2" role="status">
          <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
          <span>Buscando salas…</span>
        </div>
      } @else if (rooms().length === 0) {
        <p class="text-body-secondary">No hay salas abiertas. ¡Crea una!</p>
      } @else {
        <ul class="list-group">
          @for (room of rooms(); track room.codigo) {
            <li class="list-group-item list-group-item-action position-relative">
              <div class="d-flex justify-content-between align-items-center gap-2">
                <div>
                  <a [routerLink]="['/sala', room.codigo]" class="stretched-link fw-semibold text-decoration-none">
                    Sala de {{ room.anfitrion ?? 'alguien' }}
                  </a>
                  <div class="small text-body-secondary">
                    {{ room.jugadores }} {{ room.jugadores === 1 ? 'jugador' : 'jugadores' }}
                    · <span class="font-monospace">{{ room.codigo }}</span>
                  </div>
                </div>
                @if (room.tiene_password) {
                  <span class="badge text-bg-secondary">
                    <span aria-hidden="true">🔒</span> Con contraseña
                  </span>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class OpenRoomList {
  private readonly roomService = inject(RoomService);

  readonly gameId = input.required<number>();

  protected readonly loading = signal(true);
  protected readonly rooms = signal<OpenRoom[]>([]);

  constructor() {
    effect(() => {
      this.gameId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rooms.set(await this.roomService.listOpenRooms(this.gameId()));
    } catch (e) {
      // Shown as an empty list; the cause is only logged for debugging.
      console.error('[OpenRoomList] No se han podido cargar las salas:', e);
      this.rooms.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
