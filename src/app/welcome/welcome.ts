import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { PlayerService } from '../core/player.service';

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

@Component({
  selector: 'app-welcome',
  imports: [FormField],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);

  /** Query param `?volver=` set by nicknameGuard (e.g. an invite link). */
  readonly volver = input<string>();

  /** Fixed decorative slots ready for future portrait images. */
  protected readonly rocketSlots = [0, 1, 2, 3, 4];
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
      await this.router.navigateByUrl(safeReturnUrl(this.volver()));
      return undefined;
    });
  }
}

/** Only same-app paths, to avoid redirecting to another site. */
function safeReturnUrl(url: string | undefined): string {
  return url?.startsWith('/') && !url.startsWith('//') ? url : '/juegos';
}
