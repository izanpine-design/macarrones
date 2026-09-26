import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseTest } from './supabase-test/supabase-test'; // TEMPORARY

@Component({
  imports: [RouterOutlet, SupabaseTest], // TEMPORARY: SupabaseTest
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
