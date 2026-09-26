import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { ROOM_CODE_LENGTH } from '../core/room.model';

const CODE_PATTERN = new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`);

/** Goes to /sala/:codigo; the room page takes care of the password. */
@Component({
  selector: 'app-join-by-code-form',
  imports: [FormField],
  template: `
    <form novalidate (submit)="join($event)">
      <div class="mb-3">
        <label for="join-code" class="form-label">Código de la sala</label>
        <input
          id="join-code"
          type="text"
          class="form-control text-uppercase font-monospace"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          aria-required="true"
          [formField]="codeForm.code"
          [class.is-invalid]="showErrors()"
          [attr.aria-invalid]="showErrors()"
          [attr.aria-describedby]="showErrors() ? 'join-code-error' : 'join-code-help'"
        />
        @if (showErrors()) {
          <div id="join-code-error" class="invalid-feedback">
            {{ codeForm.code().errors()[0].message }}
          </div>
        } @else {
          <div id="join-code-help" class="form-text">{{ codeLength }} letras o números, p. ej. K7QX2P.</div>
        }
      </div>
      <button type="submit" class="btn btn-outline-primary w-100">Unirse</button>
    </form>
  `,
})
export class JoinByCodeForm {
  private readonly router = inject(Router);

  protected readonly codeLength = ROOM_CODE_LENGTH;
  private readonly model = signal({ code: '' });

  protected readonly codeForm = form(this.model, (path) => {
    validate(path.code, ({ value }) => {
      const code = normalizeCode(value());
      if (code === '') {
        return { kind: 'required', message: 'Escribe el código de la sala.' };
      }
      if (!CODE_PATTERN.test(code)) {
        return { kind: 'pattern', message: `El código tiene ${ROOM_CODE_LENGTH} letras o números.` };
      }
      return undefined;
    });
  });

  protected readonly showErrors = computed(() => {
    const field = this.codeForm.code();
    return field.touched() && field.invalid();
  });

  protected join(event: Event): void {
    event.preventDefault();
    void submit(this.codeForm, async () => {
      await this.router.navigate(['/sala', normalizeCode(this.model().code)]);
      return undefined;
    });
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
