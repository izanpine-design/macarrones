import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseTest } from './supabase-test/supabase-test'; // TEMPORARY

@Component({
  imports: [RouterOutlet, SupabaseTest], // TEMPORARY: SupabaseTest
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('macarrones');
}
