import { Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { QuestionType } from '../../core/question.model';
import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from '../../core/room.model';
import { roomErrorMessage } from '../../core/room.service';
import { TurnService } from '../../core/turn.service';

/** Asker's choice: a random question from the database or one they write. */
@Component({
  selector: 'app-question-picker',
  imports: [FormField],
  template: `
    <p class="mb-3">
      <strong>{{ targetName() }}</strong> ha elegido
      <strong>{{ type() === 'verdad' ? 'verdad' : 'reto' }}</strong>. ¿Cómo quieres {{ type() === 'verdad' ? 'la pregunta' : 'el reto' }}?
    </p>

    <button type="button" class="btn btn-primary btn-lg w-100 mb-3" [disabled]="busy()" (click)="pickRandom()">
      <span aria-hidden="true">🎲</span> {{ type() === 'verdad' ? 'Pregunta aleatoria' : 'Reto aleatorio' }}
    </button>

    <form novalidate (submit)="write($event)">
      <label for="own-question" class="form-label">O escríbelo tú:</label>
      <textarea
        id="own-question"
        class="form-control mb-2"
        rows="3"
        aria-required="true"
        [formField]="questionForm.text"
        [class.is-invalid]="showErrors()"
        [attr.aria-invalid]="showErrors()"
        [attr.aria-describedby]="showErrors() ? 'own-question-error' : null"
      ></textarea>
      @if (showErrors()) {
        <div id="own-question-error" class="invalid-feedback d-block mb-2">
          {{ questionForm.text().errors()[0].message }}
        </div>
      }
      <button type="submit" class="btn btn-outline-primary w-100" [disabled]="busy()">
        {{ type() === 'verdad' ? 'Hacer esta pregunta' : 'Proponer este reto' }}
      </button>
    </form>

    @if (error()) {
      <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div>
    }
  `,
})
export class QuestionPicker {
  private readonly turns = inject(TurnService);

  readonly roomId = input.required<string>();
  readonly type = input.required<QuestionType>();
  readonly targetName = input.required<string>();

  protected readonly error = signal<string | null>(null);
  private readonly pickingRandom = signal(false);
  private readonly model = signal({ text: '' });

  protected readonly questionForm = form(this.model, (path) => {
    maxLength(path.text, QUESTION_MAX_LENGTH, { message: `Máximo ${QUESTION_MAX_LENGTH} caracteres.` });
    validate(path.text, ({ value }) =>
      value().trim().length < QUESTION_MIN_LENGTH
        ? { kind: 'minLength', message: 'Escribe la pregunta o el reto.' }
        : undefined,
    );
  });

  protected readonly busy = computed(() => this.pickingRandom() || this.questionForm().submitting());

  protected readonly showErrors = computed(() => {
    const field = this.questionForm.text();
    return field.touched() && field.invalid();
  });

  protected async pickRandom(): Promise<void> {
    this.error.set(null);
    this.pickingRandom.set(true);
    try {
      await this.turns.pickRandomQuestion(this.roomId());
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.pickingRandom.set(false);
    }
  }

  protected write(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    void submit(this.questionForm, async () => {
      try {
        await this.turns.writeQuestion(this.roomId(), this.model().text);
      } catch (e) {
        this.error.set(roomErrorMessage(e));
      }
      return undefined;
    });
  }
}
