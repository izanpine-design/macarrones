import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { form, FormField, maxLength, validate } from '@angular/forms/signals';
import { PackService } from '../../core/pack.service';
import { QuestionType } from '../../core/question.model';
import { parseQuestionsCsv, ParsedQuestionsCsv } from '../../core/questions-csv';
import {
  GAMES_WITH_QUESTION_TYPE,
  NewQuestion,
  PACK_NAME_MAX_LENGTH,
  PACK_NAME_MIN_LENGTH,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  RoomInfo,
} from '../../core/room.model';
import { roomErrorMessage } from '../../core/room.service';

type Destination = 'current' | 'new';
type Mode = 'csv' | 'text';

/**
 * Host: adds questions to the selected pack or to a new one, from a CSV file
 * (columns texto,tipo) or writing them one by one. They are saved for good.
 */
@Component({
  selector: 'app-add-questions',
  imports: [FormField],
  template: `
    <fieldset class="mb-3">
      <legend class="form-label fs-6">¿Dónde se guardan?</legend>
      <div class="form-check">
        <input
          id="dest-current"
          type="radio"
          class="form-check-input"
          name="add-destination"
          [checked]="destination() === 'current'"
          [disabled]="!room().lote_id"
          (change)="destination.set('current')"
        />
        <label for="dest-current" class="form-check-label">
          En el lote seleccionado
          @if (room().lote) {
            («{{ room().lote }}»)
          }
        </label>
      </div>
      <div class="form-check">
        <input
          id="dest-new"
          type="radio"
          class="form-check-input"
          name="add-destination"
          [checked]="destination() === 'new'"
          (change)="destination.set('new')"
        />
        <label for="dest-new" class="form-check-label">En un lote nuevo de «{{ room().nivel }}»</label>
      </div>

      @if (destination() === 'new') {
        <label for="new-pack-name" class="form-label mt-2">Nombre del lote nuevo</label>
        <input
          id="new-pack-name"
          type="text"
          class="form-control"
          aria-required="true"
          [formField]="packForm.name"
          [class.is-invalid]="showNameErrors()"
          [attr.aria-invalid]="showNameErrors()"
          [attr.aria-describedby]="showNameErrors() ? 'new-pack-name-error' : null"
        />
        @if (showNameErrors()) {
          <div id="new-pack-name-error" class="invalid-feedback">{{ packForm.name().errors()[0].message }}</div>
        }
      }
    </fieldset>

    <div class="btn-group w-100 mb-3" role="group" aria-label="Forma de añadir preguntas">
      <input id="mode-csv" type="radio" class="btn-check" name="add-mode" [checked]="mode() === 'csv'" (change)="setMode('csv')" />
      <label for="mode-csv" class="btn btn-outline-primary">Subir CSV</label>
      <input id="mode-text" type="radio" class="btn-check" name="add-mode" [checked]="mode() === 'text'" (change)="setMode('text')" />
      <label for="mode-text" class="btn btn-outline-primary">Escribir una</label>
    </div>

    @if (mode() === 'csv') {
      <label for="questions-csv" class="form-label">Fichero CSV</label>
      <input
        id="questions-csv"
        type="file"
        class="form-control mb-1"
        accept=".csv,text/csv"
        aria-describedby="questions-csv-help"
        (change)="readCsv($event)"
      />
      <div id="questions-csv-help" class="form-text mb-2">
        Primera fila: <code>{{ hasTypes() ? 'texto,tipo' : 'texto' }}</code>@if (hasTypes()) {
          , con tipo <code>verdad</code> o <code>reto</code>
        }. Vale separado por comas o por punto y coma.
        <a href="ejemplo-preguntas.csv" download>Descargar ejemplo</a>
      </div>

      @if (csv(); as parsed) {
        <div class="small mb-2" aria-live="polite">
          <p class="mb-1">
            <strong>{{ parsed.questions.length }}</strong> preguntas listas para añadir.
            @if (parsed.duplicates > 0) {
              {{ parsed.duplicates }} repetidas en el fichero (se ignoran).
            }
          </p>
          @if (parsed.errors.length > 0) {
            <p class="text-danger mb-1">{{ parsed.errors.length }} filas con errores (no se añadirán):</p>
            <ul class="text-danger mb-0">
              @for (rowError of parsed.errors.slice(0, 5); track rowError.row) {
                <li>Fila {{ rowError.row }}: {{ rowError.message }}</li>
              }
              @if (parsed.errors.length > 5) {
                <li>… y {{ parsed.errors.length - 5 }} más.</li>
              }
            </ul>
          }
        </div>
        <button
          type="button"
          class="btn btn-primary w-100"
          [disabled]="busy() || parsed.questions.length === 0"
          (click)="save(parsed.questions)"
        >
          Añadir {{ parsed.questions.length }} preguntas
        </button>
      }
    } @else {
      <form novalidate (submit)="addOne($event)">
        @if (hasTypes()) {
          <fieldset class="mb-2">
            <legend class="visually-hidden">Tipo</legend>
            <div class="btn-group" role="group">
              <input id="one-verdad" type="radio" class="btn-check" name="one-type" [checked]="oneType() === 'verdad'" (change)="oneType.set('verdad')" />
              <label for="one-verdad" class="btn btn-outline-info btn-sm">Verdad</label>
              <input id="one-reto" type="radio" class="btn-check" name="one-type" [checked]="oneType() === 'reto'" (change)="oneType.set('reto')" />
              <label for="one-reto" class="btn btn-outline-danger btn-sm">Reto</label>
            </div>
          </fieldset>
        }
        <label for="one-question" class="form-label">{{ oneType() === 'reto' ? 'Reto' : 'Pregunta' }}</label>
        <textarea
          id="one-question"
          class="form-control mb-2"
          rows="2"
          aria-required="true"
          [formField]="oneForm.text"
          [class.is-invalid]="showTextErrors()"
          [attr.aria-invalid]="showTextErrors()"
          [attr.aria-describedby]="showTextErrors() ? 'one-question-error' : null"
        ></textarea>
        @if (showTextErrors()) {
          <div id="one-question-error" class="invalid-feedback d-block mb-2">
            {{ oneForm.text().errors()[0].message }}
          </div>
        }
        <button type="submit" class="btn btn-primary w-100" [disabled]="busy()">Añadir</button>
      </form>
    }

    <div aria-live="polite">
      @if (success()) {
        <div class="alert alert-success py-2 mt-3 mb-0">{{ success() }}</div>
      }
      @if (error()) {
        <div class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error() }}</div>
      }
    </div>
  `,
})
export class AddQuestions {
  private readonly packs = inject(PackService);

  readonly room = input.required<RoomInfo>();

  protected readonly mode = signal<Mode>('csv');
  /** Defaults to the selected pack, or to a new one if there is none yet. */
  protected readonly destination = linkedSignal<Destination>(() => (this.room().lote_id ? 'current' : 'new'));
  protected readonly csv = signal<ParsedQuestionsCsv | null>(null);
  protected readonly oneType = signal<QuestionType>('verdad');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly hasTypes = computed(() => GAMES_WITH_QUESTION_TYPE.includes(this.room().juego_clave ?? ''));

  private readonly packModel = signal({ name: '' });
  protected readonly packForm = form(this.packModel, (path) => {
    maxLength(path.name, PACK_NAME_MAX_LENGTH, { message: `Máximo ${PACK_NAME_MAX_LENGTH} caracteres.` });
    validate(path.name, ({ value }) =>
      value().trim().length < PACK_NAME_MIN_LENGTH
        ? { kind: 'minLength', message: 'Ponle un nombre al lote.' }
        : undefined,
    );
  });

  private readonly oneModel = signal({ text: '' });
  protected readonly oneForm = form(this.oneModel, (path) => {
    maxLength(path.text, QUESTION_MAX_LENGTH, { message: `Máximo ${QUESTION_MAX_LENGTH} caracteres.` });
    validate(path.text, ({ value }) =>
      value().trim().length < QUESTION_MIN_LENGTH
        ? { kind: 'minLength', message: `Escribe al menos ${QUESTION_MIN_LENGTH} caracteres.` }
        : undefined,
    );
  });

  protected readonly showNameErrors = computed(() => {
    const field = this.packForm.name();
    return field.touched() && field.invalid();
  });
  protected readonly showTextErrors = computed(() => {
    const field = this.oneForm.text();
    return field.touched() && field.invalid();
  });

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.success.set(null);
  }

  protected async readCsv(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.error.set(null);
    this.success.set(null);
    this.csv.set(file ? parseQuestionsCsv(await file.text(), this.hasTypes()) : null);
  }

  protected addOne(event: Event): void {
    event.preventDefault();
    this.oneForm.text().markAsTouched();
    if (this.oneForm.text().invalid()) return;
    const question: NewQuestion = {
      texto: this.oneModel().text.trim(),
      tipo: this.hasTypes() ? this.oneType() : null,
    };
    void this.save([question]).then((saved) => {
      if (saved) this.oneModel.set({ text: '' });
    });
  }

  protected async save(questions: NewQuestion[]): Promise<boolean> {
    this.error.set(null);
    this.success.set(null);

    const toNewPack = this.destination() === 'new';
    if (toNewPack) {
      this.packForm.name().markAsTouched();
      if (this.packForm.name().invalid()) return false;
    }

    this.busy.set(true);
    try {
      let packName = this.room().lote;
      if (toNewPack) {
        packName = this.packModel().name.trim();
        await this.packs.createPack(this.room().id, packName);
      }
      const added = await this.packs.addQuestions(this.room().id, questions);
      const skipped = questions.length - added;
      this.success.set(
        `${added} ${added === 1 ? 'pregunta añadida' : 'preguntas añadidas'} a «${packName}».` +
          (skipped > 0 ? ` ${skipped} ya estaban en el lote.` : ''),
      );
      if (toNewPack) {
        // The new pack is now the selected one.
        this.destination.set('current');
        this.packModel.set({ name: '' });
      }
      this.csv.set(null);
      return true;
    } catch (e) {
      this.error.set(roomErrorMessage(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
