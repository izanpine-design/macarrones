import { Component, computed, input, output, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';

let nextId = 0;

/** A short text with a send button (answers, secrets, own phrases…). */
@Component({
  selector: 'app-text-entry',
  imports: [FormField],
  template: `
    <form novalidate (submit)="send($event)">
      <label class="form-label" [for]="inputId">{{ label() }}</label>
      @if (multiline()) {
        <textarea
          class="form-control mb-2"
          rows="3"
          [id]="inputId"
          [attr.placeholder]="placeholder() || null"
          [formField]="textForm.texto"
          [class.is-invalid]="showErrors()"
          [attr.aria-invalid]="showErrors()"
          [attr.aria-describedby]="showErrors() ? errorId : null"
        ></textarea>
      } @else {
        <input
          type="text"
          class="form-control mb-2"
          autocomplete="off"
          [id]="inputId"
          [attr.placeholder]="placeholder() || null"
          [formField]="textForm.texto"
          [class.is-invalid]="showErrors()"
          [attr.aria-invalid]="showErrors()"
          [attr.aria-describedby]="showErrors() ? errorId : null"
        />
      }
      @if (showErrors()) {
        <div class="invalid-feedback d-block mb-2" [id]="errorId">{{ textForm.texto().errors()[0].message }}</div>
      }
      <button type="submit" class="btn w-100" [class]="buttonClass()" [disabled]="disabled()">{{ button() }}</button>
    </form>
  `,
})
export class TextEntry {
  readonly label = input.required<string>();
  readonly button = input('Enviar');
  readonly buttonClass = input('btn-primary');
  readonly placeholder = input('');
  readonly multiline = input(false);
  readonly minLength = input(2);
  readonly maxLength = input(200);
  readonly disabled = input(false);
  readonly submitted = output<string>();

  protected readonly inputId = `text-entry-${nextId++}`;
  protected readonly errorId = `${this.inputId}-error`;
  private readonly model = signal({ texto: '' });

  protected readonly textForm = form(this.model, (path) => {
    maxLength(path.texto, () => this.maxLength(), { message: 'Es demasiado largo.' });
    validate(path.texto, ({ value }) =>
      value().trim().length < this.minLength() ? { kind: 'minLength', message: 'Escribe un poco más.' } : undefined,
    );
  });

  protected readonly showErrors = computed(() => {
    const field = this.textForm.texto();
    return field.touched() && field.invalid();
  });

  protected send(event: Event): void {
    event.preventDefault();
    void submit(this.textForm, async () => {
      this.submitted.emit(this.model().texto.trim());
      this.model.set({ texto: '' });
      this.textForm().reset();
      return undefined;
    });
  }
}
