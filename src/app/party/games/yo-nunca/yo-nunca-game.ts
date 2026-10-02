import { Component, computed, inject } from '@angular/core';
import { PartyStore } from '../../party-store';
import { TextEntry } from '../../ui/text-entry';
import { anadirFrase, fraseActual, siguienteFrase, toggleYoSi, YoNuncaState } from './yo-nunca.logic';

@Component({
  selector: 'app-yo-nunca-game',
  imports: [TextEntry],
  template: `
    @let s = state();
    <div class="card shadow-sm mb-3">
      <div class="card-body p-4 text-center">
        <p class="small text-body-secondary mb-2">Frase {{ s.indice + 1 }}</p>
        <p class="h3 mb-4" aria-live="polite">{{ frase() }}</p>

        <button
          type="button"
          class="btn btn-lg w-100 mb-3"
          [class]="yoSi() ? 'btn-warning' : 'btn-outline-dark'"
          [attr.aria-pressed]="yoSi()"
          [disabled]="store.busy()"
          (click)="toggle()"
        >
          <span aria-hidden="true">🍺</span> {{ yoSi() ? 'Yo sí (bebo) · deshacer' : 'Yo sí lo he hecho' }}
        </button>

        <div aria-live="polite">
          @if (beben().length > 0) {
            <p class="mb-3"><strong>Beben:</strong> {{ beben().join(', ') }}</p>
          } @else {
            <p class="text-body-secondary mb-3">De momento nadie lo ha hecho…</p>
          }
        </div>

        <button type="button" class="btn btn-primary btn-lg w-100" [disabled]="store.busy()" (click)="next()">
          Siguiente frase <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>

    <details class="card shadow-sm mb-3">
      <summary class="card-body fw-semibold">Añadir una frase propia</summary>
      <div class="card-body pt-0">
        <app-text-entry
          label="Tu frase (saldrá justo después de esta)"
          placeholder="Yo nunca nunca he…"
          button="Añadir frase"
          buttonClass="btn-outline-primary"
          [minLength]="4"
          [disabled]="store.busy()"
          (submitted)="add($event)"
        />
      </div>
    </details>
  `,
})
export class YoNuncaGame {
  protected readonly store = inject(PartyStore) as PartyStore<YoNuncaState>;
  protected readonly state = computed(() => this.store.state()!);
  protected readonly frase = computed(() => fraseActual(this.state()) ?? 'No hay frases en este lote.');
  protected readonly yoSi = computed(() => !!this.state().yoSi[this.store.me]);
  protected readonly beben = computed(() =>
    this.store
      .players()
      .filter((p) => this.state().yoSi[p.user_id])
      .map((p) => p.apodo),
  );

  protected toggle(): void {
    void this.store.act(toggleYoSi(this.state().indice));
  }

  protected next(): void {
    void this.store.act(siguienteFrase(this.state().indice));
  }

  protected add(texto: string): void {
    void this.store.act(anadirFrase(texto));
  }
}
