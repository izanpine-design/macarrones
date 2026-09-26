import { Component, input } from '@angular/core';
import { RoomInfo } from '../../core/room.model';
import { AddQuestions } from './add-questions';
import { PackPicker } from './pack-picker';

/** "Preguntas" card of the lobby: the host configures it, the rest see a summary. */
@Component({
  selector: 'app-room-questions',
  imports: [AddQuestions, PackPicker],
  template: `
    <section class="card shadow-sm mb-3" aria-labelledby="questions-title">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 id="questions-title" class="h5 m-0">Preguntas</h2>
          <span class="badge text-bg-secondary text-capitalize">{{ room().nivel }}</span>
        </div>

        @if (isHost()) {
          <app-pack-picker [room]="room()" />

          <details class="mt-3">
            <summary class="fw-semibold">Añadir preguntas (CSV o a mano)</summary>
            <div class="pt-3">
              <app-add-questions [room]="room()" />
            </div>
          </details>
        } @else if (room().lote) {
          <p class="mb-0">
            Lote <strong>«{{ room().lote }}»</strong> · {{ room().lote_preguntas }}
            {{ room().lote_preguntas === 1 ? 'pregunta' : 'preguntas' }}
          </p>
        } @else {
          <p class="text-body-secondary mb-0" role="status">El anfitrión está eligiendo las preguntas…</p>
        }
      </div>
    </section>
  `,
})
export class RoomQuestions {
  readonly room = input.required<RoomInfo>();
  readonly isHost = input.required<boolean>();
}
