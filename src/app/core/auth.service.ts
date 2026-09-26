import { computed, inject, Service, signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/**
 * Supabase session. Registered players sign in with their profile's password;
 * guests get an anonymous session. Either way auth.uid() identifies the player
 * in the database.
 */
@Service()
export class AuthService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly _user = signal<User | null>(null);
  private readonly initial: Promise<void>;
  private pending: Promise<string> | null = null;

  readonly userId = computed(() => this._user()?.id ?? null);
  /** True for guests (anonymous session), false for registered players. */
  readonly isGuest = computed(() => this._user()?.is_anonymous ?? true);

  constructor() {
    this.initial = this.auth.getSession().then(({ data }) => this._user.set(data.session?.user ?? null));
    this.auth.onAuthStateChange((_event, session) => {
      this._user.set(session?.user ?? null);
      if (!session) this.pending = null;
    });
  }

  /** Resolves once the stored session (if any) has been read. */
  ready(): Promise<void> {
    return this.initial;
  }

  /** Reuses the current session or starts a guest (anonymous) one. Returns the user id. */
  ensureSignedIn(): Promise<string> {
    this.pending ??= this.startSession().catch((error: unknown) => {
      this.pending = null;
      throw error;
    });
    return this.pending;
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { data, error } = await this.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.code === 'invalid_credentials' ? 'Contraseña incorrecta.' : error.message);
    }
    this.useUser(data.user);
  }

  /** Creates a registered user. Needs "Confirm email" off in Supabase. */
  async signUp(email: string, password: string): Promise<string> {
    const { data, error } = await this.auth.signUp({ email, password });
    if (error) throw new Error(`No se ha podido crear el perfil: ${error.message}`);
    if (!data.session || !data.user) {
      throw new Error('Supabase pide confirmar el email: desactiva "Confirm email" en Authentication.');
    }
    this.useUser(data.user);
    return data.user.id;
  }

  async changePassword(password: string): Promise<void> {
    const { error } = await this.auth.updateUser({ password });
    if (error) throw new Error(`No se ha podido cambiar la contraseña: ${error.message}`);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this._user.set(null);
    this.pending = null;
  }

  private useUser(user: User | null): void {
    this._user.set(user);
    this.pending = user ? Promise.resolve(user.id) : null;
  }

  private async startSession(): Promise<string> {
    await this.initial;
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
    this._user.set(user);
    return user.id;
  }
}
