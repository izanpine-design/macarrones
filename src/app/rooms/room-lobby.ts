import { Component, computed, DestroyRef, DOCUMENT, inject, input, OnInit, output, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { RoomInfo, RoomPlayer } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';

/** Waiting room: live list of players, invite button and leave button. */
@Component({
  selector: 'app-room-lobby',
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
        @if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
        }
        <ul class="list-group list-group-flush" aria-live="polite">
          @for (player of players(); track player.user_id) {
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
              <span>
                {{ player.apodo }}
                @if (player.user_id === userId()) {
                  <span class="text-body-secondary">(tú)</span>
                }
              </span>
              @if (player.user_id === hostId()) {
                <span class="badge text-bg-primary">Anfitrión</span>
              }
            </li>
          }
        </ul>
      </div>
    </section>

    @if (isHost()) {
      <p class="text-body-secondary text-center">
        Eres el anfitrión. Pronto podrás empezar la partida desde aquí.
      </p>
    } @else {
      <p class="text-body-secondary text-center">Esperando a que el anfitrión empiece la partida…</p>
    }

    <button type="button" class="btn btn-outline-danger w-100" [disabled]="leaving()" (click)="leave()">
      Salir de la sala
    </button>
  `,
})
export class RoomLobby implements OnInit {
  private readonly rooms = inject(RoomService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;

  readonly room = input.required<RoomInfo>();
  readonly left = output();

  protected readonly userId = inject(AuthService).userId;
  protected readonly players = signal<RoomPlayer[]>([]);
  protected readonly hostId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly leaving = signal(false);
  protected readonly inviteFeedback = signal('');

  protected readonly isHost = computed(() => this.hostId() !== null && this.hostId() === this.userId());
  protected readonly spelledCode = computed(() => this.room().codigo.split('').join(' '));

  ngOnInit(): void {
    void this.refresh();
    const stopWatching = this.rooms.watchRoom(this.room().id, () => void this.refresh());
    this.destroyRef.onDestroy(stopWatching);
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

  protected async leave(): Promise<void> {
    this.leaving.set(true);
    try {
      await this.rooms.leaveRoom(this.room().id);
      this.left.emit();
    } catch (e) {
      this.error.set(roomErrorMessage(e));
      this.leaving.set(false);
    }
  }

  private async refresh(): Promise<void> {
    try {
      const { hostId, players } = await this.rooms.getLobby(this.room().id);
      this.hostId.set(hostId);
      this.players.set(players);
      this.error.set(null);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    }
  }
}
