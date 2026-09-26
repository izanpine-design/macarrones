import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { ROOM_PASSWORD_MAX_LENGTH, ROOM_PASSWORD_MIN_LENGTH } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';

@Component({
  selector: 'app-create-room-form',
  imports: [FormField],
  template: `
    <form novalidate (submit)="create($event)">
      <div class="form-check mb-3">
        <input
          id="create-use-password"
          type="checkbox"
          class="form-check-input"
          [formField]="roomForm.usePassword"
        />
        <label for="create-use-password" class="form-check-label">Proteger con contraseña</label>
      </div>

      @if (model().usePassword) {
        <div class="mb-3">
          <label for="create-password" class="form-label">Contraseña de la sala</label>
          <input
            id="create-password"
            type="password"
            class="form-control"
            autocomplete="new-password"
            aria-required="true"
            [formField]="roomForm.password"
            [class.is-invalid]="showPasswordErrors()"
            [attr.aria-invalid]="showPasswordErrors()"
            [attr.aria-describedby]="showPasswordErrors() ? 'create-password-error' : 'create-password-help'"
          />
          @if (showPasswordErrors()) {
            <div id="create-password-error" class="invalid-feedback">
              {{ roomForm.password().errors()[0].message }}
            </div>
          } @else {
            <div id="create-password-help" class="form-text">
              Pásasela a tus amigos: la necesitarán para entrar.
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="alert alert-danger py-2" role="alert">{{ error() }}</div>
      }

      <button type="submit" class="btn btn-primary w-100" [disabled]="roomForm().submitting()">
        @if (roomForm().submitting()) {
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        }
        Crear sala
      </button>
    </form>
  `,
})
export class CreateRoomForm {
  private readonly rooms = inject(RoomService);
  private readonly router = inject(Router);

  readonly gameId = input.required<number>();

  protected readonly error = signal<string | null>(null);
  protected readonly model = signal({ usePassword: false, password: '' });

  protected readonly roomForm = form(this.model, (path) => {
    maxLength(path.password, ROOM_PASSWORD_MAX_LENGTH, {
      message: `Máximo ${ROOM_PASSWORD_MAX_LENGTH} caracteres.`,
    });
    validate(path.password, ({ value, valueOf }) => {
      if (!valueOf(path.usePassword)) {
        return undefined;
      }
      if (value().length < ROOM_PASSWORD_MIN_LENGTH) {
        return { kind: 'minLength', message: `Mínimo ${ROOM_PASSWORD_MIN_LENGTH} caracteres.` };
      }
      return undefined;
    });
  });

  protected readonly showPasswordErrors = computed(() => {
    const field = this.roomForm.password();
    return field.touched() && field.invalid();
  });

  protected create(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    void submit(this.roomForm, async () => {
      const { usePassword, password } = this.model();
      try {
        const code = await this.rooms.createRoom(this.gameId(), usePassword ? password : null);
        await this.router.navigate(['/sala', code]);
      } catch (e) {
        this.error.set(roomErrorMessage(e));
      }
      return undefined;
    });
  }
}
