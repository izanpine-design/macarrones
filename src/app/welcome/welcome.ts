import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { PlayerService } from '../core/player.service';

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

@Component({
  selector: 'app-welcome',
  imports: [FormField],
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-7 col-lg-5">
        <div class="card shadow-sm">
          <div class="card-body p-4">
            <h2 class="h3 card-title">¡Bienvenido!</h2>
            <p class="text-body-secondary">
              Elige el apodo con el que te verán los demás jugadores.
            </p>

            <form novalidate (submit)="save($event)">
              <div class="mb-3">
                <label for="nickname" class="form-label">Apodo</label>
                <input
                  id="nickname"
                  type="text"
                  class="form-control form-control-lg"
                  autocomplete="nickname"
                  aria-required="true"
                  [formField]="nicknameForm.nickname"
                  [class.is-invalid]="showErrors()"
                  [attr.aria-invalid]="showErrors()"
                  [attr.aria-describedby]="showErrors() ? 'nickname-error' : 'nickname-help'"
                />
                @if (showErrors()) {
                  <div id="nickname-error" class="invalid-feedback">
                    {{ nicknameForm.nickname().errors()[0].message }}
                  </div>
                } @else {
                  <div id="nickname-help" class="form-text">
                    Entre {{ minLength }} y {{ maxLength }} caracteres.
                  </div>
                }
              </div>

              <button type="submit" class="btn btn-primary btn-lg w-100">Entrar</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Welcome {
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);

  protected readonly minLength = NICKNAME_MIN_LENGTH;
  protected readonly maxLength = NICKNAME_MAX_LENGTH;

  private readonly model = signal({ nickname: this.player.nickname() });

  protected readonly nicknameForm = form(this.model, (path) => {
    // Also renders the native maxlength attribute on the input.
    maxLength(path.nickname, NICKNAME_MAX_LENGTH, { message: `Máximo ${NICKNAME_MAX_LENGTH} caracteres.` });
    validate(path.nickname, ({ value }) => {
      const length = value().trim().length;
      if (length === 0) {
        return { kind: 'required', message: 'Escribe un apodo.' };
      }
      if (length < NICKNAME_MIN_LENGTH) {
        return { kind: 'minLength', message: `Mínimo ${NICKNAME_MIN_LENGTH} caracteres.` };
      }
      return undefined;
    });
  });

  protected readonly showErrors = computed(() => {
    const field = this.nicknameForm.nickname();
    return field.touched() && field.invalid();
  });

  protected save(event: Event): void {
    event.preventDefault();
    void submit(this.nicknameForm, async () => {
      this.player.setNickname(this.model().nickname);
      await this.router.navigateByUrl('/juegos');
      return undefined;
    });
  }
}
