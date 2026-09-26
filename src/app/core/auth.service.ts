import { inject, Service, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

/**
 * Anonymous Supabase session: no login screen, but every device gets a stable
 * user id (auth.uid()) that the database uses to identify the player.
 */
@Service()
export class AuthService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly _userId = signal<string | null>(null);
  private pending: Promise<string> | null = null;

  readonly userId = this._userId.asReadonly();

  /** Reuses the stored session or creates an anonymous one. Returns the user id. */
  ensureSignedIn(): Promise<string> {
    this.pending ??= this.signIn().catch((error: unknown) => {
      this.pending = null;
      throw error;
    });
    return this.pending;
  }

  private async signIn(): Promise<string> {
    const { data } = await this.auth.getSession();
    let user = data.session?.user ?? null;

    if (!user) {
      const { data: signInData, error } = await this.auth.signInAnonymously();
      if (error) {
        throw new Error(`No se ha podido iniciar la sesión anónima: ${error.message}`);
      }
      user = signInData.user;
    }

    if (!user) {
      throw new Error('No se ha podido iniciar la sesión anónima.');
    }
    this._userId.set(user.id);
    return user.id;
  }
}
