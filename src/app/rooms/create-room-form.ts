import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { GameService } from '../core/game.service';
import { Level } from '../core/question.model';
import { ROOM_PASSWORD_MAX_LENGTH, ROOM_PASSWORD_MIN_LENGTH } from '../core/room.model';
import { roomErrorMessage, RoomService } from '../core/room.service';

@Component({
  selector: 'app-create-room-form',
  imports: [FormField],
  template: `
    <form novalidate (submit)="create($event)">
      <fieldset class="mb-3">
        <legend class="form-label fs-6">Categoría de las preguntas</legend>
        @if (levels().length === 0) {
          <div class="d-flex align-items-center gap-2 small" role="status">
            <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
            <span>Cargando categorías…</span>
          </div>
        } @else {
          <div class="d-flex flex-wrap gap-2">
            @for (level of levels(); track level.id) {
              <input
                type="radio"
                class="btn-check"
                name="create-level"
                [id]="'create-level-' + level.id"
                [checked]="level.id === levelId()"
                (change)="levelId.set(level.id)"
              />
              <label class="btn btn-outline-primary btn-sm text-capitalize" [for]="'create-level-' + level.id">
                {{ level.nombre }}
              </label>
            }
          </div>
        }
      </fieldset>

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

      <button type="submit" class="btn btn-primary w-100" [disabled]="roomForm().submitting() || levelId() === null">
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
  private readonly games = inject(GameService);
  private readonly router = inject(Router);

  readonly gameId = input.required<number>();

  protected readonly levels = signal<Level[]>([]);
  /** Selected category; defaults to the first one (suave). */
  protected readonly levelId = signal<number | null>(null);
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

  constructor() {
    void this.loadLevels();
  }

  protected create(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    const levelId = this.levelId();
    if (levelId === null) return;

    void submit(this.roomForm, async () => {
      const { usePassword, password } = this.model();
      try {
        const code = await this.rooms.createRoom(this.gameId(), levelId, usePassword ? password : null);
        await this.router.navigate(['/sala', code]);
      } catch (e) {
        this.error.set(roomErrorMessage(e));
      }
      return undefined;
    });
  }

  private async loadLevels(): Promise<void> {
    try {
      const levels = await this.games.getLevels();
      this.levels.set(levels);
      this.levelId.set(levels[0]?.id ?? null);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    }
  }
}
