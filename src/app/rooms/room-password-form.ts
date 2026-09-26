import { Component, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { RoomInfo } from '../core/room.model';
import { RoomError, roomErrorMessage, RoomService } from '../core/room.service';

/** Asks for the password of a protected room and joins it. */
@Component({
  selector: 'app-room-password-form',
  imports: [FormField],
  template: `
    <div class="card shadow-sm">
      <div class="card-body p-4">
        <h2 class="h4 card-title">
          <span aria-hidden="true">🔒</span> Sala de {{ room().anfitrion ?? 'alguien' }}
        </h2>
        <p class="text-body-secondary">
          {{ room().juego }} · {{ room().jugadores }} {{ room().jugadores === 1 ? 'jugador' : 'jugadores' }}.
          Esta sala tiene contraseña.
        </p>

        <form novalidate (submit)="join($event)">
          <div class="mb-3">
            <label for="room-password" class="form-label">Contraseña</label>
            <input
              id="room-password"
              type="password"
              class="form-control"
              autocomplete="current-password"
              aria-required="true"
              [formField]="passwordForm.password"
              [class.is-invalid]="errorMessage()"
              [attr.aria-invalid]="!!errorMessage()"
              [attr.aria-describedby]="errorMessage() ? 'room-password-error' : null"
            />
            @if (errorMessage(); as message) {
              <div id="room-password-error" class="invalid-feedback">{{ message }}</div>
            }
          </div>
          <button type="submit" class="btn btn-primary w-100" [disabled]="passwordForm().submitting()">
            @if (passwordForm().submitting()) {
              <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            }
            Entrar en la sala
          </button>
        </form>
      </div>
    </div>
  `,
})
export class RoomPasswordForm {
  private readonly rooms = inject(RoomService);

  readonly room = input.required<RoomInfo>();
  readonly joined = output();

  private readonly serverError = signal<string | null>(null);
  private readonly model = signal({ password: '' });

  protected readonly passwordForm = form(this.model, (path) => {
    validate(path.password, ({ value }) =>
      value() === '' ? { kind: 'required', message: 'Escribe la contraseña.' } : undefined,
    );
  });

  protected readonly errorMessage = computed(() => {
    const field = this.passwordForm.password();
    if (field.touched() && field.invalid()) {
      return field.errors()[0].message ?? null;
    }
    return this.serverError();
  });

  protected join(event: Event): void {
    event.preventDefault();
    this.serverError.set(null);
    void submit(this.passwordForm, async () => {
      try {
        await this.rooms.joinRoom(this.room().codigo, this.model().password);
        this.joined.emit();
      } catch (e) {
        this.serverError.set(
          e instanceof RoomError && e.code === 'WRONG_PASSWORD' ? 'Contraseña incorrecta.' : roomErrorMessage(e),
        );
      }
      return undefined;
    });
  }
}
