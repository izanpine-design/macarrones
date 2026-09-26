// TEMPORARY: Supabase connection test. To remove it, delete this folder and
// the <app-supabase-test /> tag (and its import) from app.html / app.ts.
import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { Question } from '../core/question.model';

@Component({
  selector: 'app-supabase-test',
  template: `
    <section class="supabase-test" aria-live="polite">
      <h2>Prueba de conexión con Supabase</h2>
      @if (loading()) {
        <p>Consultando la tabla <code>preguntas</code>…</p>
      } @else if (error()) {
        <p class="error" role="alert">Error: {{ error() }}</p>
      } @else {
        <p>{{ questions().length }} preguntas recibidas:</p>
        <ul>
          @for (question of questions(); track question.id) {
            <li>[{{ question.juego }}{{ question.nivel ? ' · ' + question.nivel : '' }}] {{ question.texto }}</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .supabase-test {
      margin: 1rem;
      padding: 1rem;
      border: 2px dashed #555;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      color: #1a1a1a;
      background: #fff;
    }
    .error {
      color: #b00020;
    }
  `,
})
export class SupabaseTest {
  private readonly supabase = inject(SupabaseService).client;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly questions = signal<Question[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const { data, error } = await this.supabase.from('preguntas').select('*').order('id');

    if (error) {
      console.error('[Supabase test] Error:', error);
      this.error.set(error.message);
    } else {
      console.log('[Supabase test] Preguntas:', data);
      this.questions.set(data as Question[]);
    }
    this.loading.set(false);
  }
}
