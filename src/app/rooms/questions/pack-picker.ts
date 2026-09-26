import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { PackService } from '../../core/pack.service';
import { GAMES_WITH_QUESTION_TYPE, QuestionPack, RoomInfo } from '../../core/room.model';
import { roomErrorMessage } from '../../core/room.service';

/** Host: chooses the question pack of the room among those of its category. */
@Component({
  selector: 'app-pack-picker',
  template: `
    <fieldset>
      <legend class="form-label fs-6">Lote de preguntas</legend>

      @if (loading()) {
        <div class="d-flex align-items-center gap-2 small" role="status">
          <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
          <span>Cargando lotes…</span>
        </div>
      } @else if (packs().length === 0) {
        <p class="small text-body-secondary mb-0">
          Todavía no hay lotes de «{{ room().nivel }}». Crea uno nuevo añadiendo preguntas abajo.
        </p>
      } @else {
        <div class="list-group">
          @for (pack of packs(); track pack.id) {
            <label class="list-group-item d-flex gap-2 align-items-start">
              <input
                type="radio"
                class="form-check-input flex-shrink-0 mt-1"
                name="room-pack"
                [checked]="pack.id === room().lote_id"
                [disabled]="busy()"
                (change)="choose(pack)"
              />
              <span>
                <span class="fw-semibold">{{ pack.nombre }}</span>
                <span class="d-block small text-body-secondary">
                  @if (hasTypes()) {
                    {{ pack.verdades }} {{ pack.verdades === 1 ? 'verdad' : 'verdades' }} ·
                    {{ pack.retos }} {{ pack.retos === 1 ? 'reto' : 'retos' }}
                  } @else {
                    {{ pack.total }} {{ pack.total === 1 ? 'pregunta' : 'preguntas' }}
                  }
                </span>
              </span>
            </label>
          }
        </div>
      }
    </fieldset>

    @if (error()) {
      <div class="alert alert-danger py-2 mt-2 mb-0" role="alert">{{ error() }}</div>
    }
  `,
})
export class PackPicker {
  private readonly packService = inject(PackService);

  readonly room = input.required<RoomInfo>();

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly packs = signal<QuestionPack[]>([]);

  protected readonly hasTypes = computed(() => GAMES_WITH_QUESTION_TYPE.includes(this.room().juego_clave ?? ''));

  constructor() {
    // Reload when the selected pack or its size changes (e.g. questions added).
    effect(() => {
      this.room().lote_id;
      this.room().lote_preguntas;
      untracked(() => void this.load());
    });
  }

  protected async choose(pack: QuestionPack): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.packService.choosePack(this.room().id, pack.id);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const { juego_id, nivel_id } = this.room();
    try {
      this.packs.set(await this.packService.listPacks(juego_id, nivel_id));
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
