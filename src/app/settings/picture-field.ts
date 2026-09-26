import { Component, computed, inject, input, model, signal } from '@angular/core';
import { ACCEPTED_PICTURE_TYPES } from '../core/picture';
import { PictureKind } from '../core/profile.model';
import { ProfileService } from '../core/profile.service';

let nextId = 0;

/**
 * Upload / replace / remove one picture of your rocket. The value is the
 * picture reference (bucket path or app asset); it is only kept if you save.
 */
@Component({
  selector: 'app-picture-field',
  template: `
    <div class="picture-field">
      <div class="picture-field__preview" [class.picture-field__preview--round]="kind() === 'cabeza'">
        @if (url(); as src) {
          <img [src]="src" [alt]="label() + ' actual'" />
        } @else {
          <span class="text-body-secondary small">{{ emptyText() }}</span>
        }
      </div>
      <div class="picture-field__actions">
        <label class="form-label mb-1" [for]="inputId">{{ label() }}</label>
        <input
          #file
          class="form-control form-control-sm"
          type="file"
          [id]="inputId"
          [accept]="accept"
          [disabled]="busy()"
          [attr.aria-describedby]="helpId"
          (change)="upload(file)"
        />
        <div [id]="helpId" class="form-text">{{ hint() }} JPG, PNG, WebP o GIF, máximo 10 MB (se reduce al subirla).</div>
        @if (value()) {
          <button type="button" class="btn btn-link btn-sm px-0" [disabled]="busy()" (click)="remove()">Quitar imagen</button>
        }
        <div aria-live="polite">
          @if (busy()) {
            <span class="small" role="status"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Subiendo…</span>
          }
          @if (error()) {
            <div class="text-danger small" role="alert">{{ error() }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .picture-field { display: flex; gap: .9rem; align-items: flex-start; }
    .picture-field__preview {
      display: grid;
      flex: 0 0 88px;
      width: 88px;
      height: 88px;
      place-items: center;
      overflow: hidden;
      border: 2px dashed var(--bs-border-color);
      border-radius: 12px;
      background: var(--bs-tertiary-bg);
      text-align: center;
    }
    .picture-field__preview--round { border-radius: 50%; }
    .picture-field__preview img { width: 100%; height: 100%; object-fit: cover; }
    .picture-field__actions { flex: 1; min-width: 0; }
  `,
})
export class PictureField {
  private readonly profiles = inject(ProfileService);

  readonly kind = input.required<PictureKind>();
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly emptyText = input('Sin imagen');
  /** Picture reference, or null. */
  readonly value = model<string | null>(null);

  protected readonly accept = ACCEPTED_PICTURE_TYPES.join(',');
  protected readonly inputId = `picture-field-${nextId++}`;
  protected readonly helpId = `${this.inputId}-help`;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly url = computed(() => {
    const ref = this.value();
    return ref ? this.profiles.pictureUrl(ref) : null;
  });

  protected async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const previous = this.value();
      this.value.set(await this.profiles.uploadPicture(this.kind(), file));
      if (previous) this.profiles.discardPicture(previous);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }

  protected remove(): void {
    const previous = this.value();
    this.value.set(null);
    if (previous) this.profiles.discardPicture(previous);
  }
}
