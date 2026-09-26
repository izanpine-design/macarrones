import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { AuthService } from '../core/auth.service';
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, safeReturnUrl } from '../core/nickname';
import { PlayerService } from '../core/player.service';
import { PASSWORD_MIN_LENGTH, Profile, SHIP_TEMPLATES } from '../core/profile.model';
import { ProfileService } from '../core/profile.service';
import { CrewHead } from '../shared/crew/crew-head';
import { CrewId } from '../shared/crew/crew';
import { IntroService } from '../shared/intro/intro.service';
import { RocketSky } from '../shared/rockets/rocket-sky';
import { SfxService } from '../shared/sfx/sfx.service';
import { SpaceSky } from '../shared/space/space-sky';

/**
 * signed:   you are signed in to your profile.
 * pick:     "¿Quién eres?" — every profile, plus create / guest.
 * password: password of the profile you picked.
 * create:   new profile (nickname, starting rocket, password).
 * guest:    play without a profile (nickname only, no rocket of your own).
 */
type Step = 'loading' | 'signed' | 'pick' | 'password' | 'create' | 'guest';

@Component({
  selector: 'app-welcome',
  imports: [FormField, RouterLink, CrewHead, RocketSky, SpaceSky],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly player = inject(PlayerService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query param `?volver=` set by nicknameGuard (e.g. an invite link). */
  readonly volver = input<string>();

  protected readonly profiles = inject(ProfileService);
  protected readonly sfx = inject(SfxService);
  protected readonly intro = inject(IntroService);
  protected readonly minLength = NICKNAME_MIN_LENGTH;
  protected readonly maxLength = NICKNAME_MAX_LENGTH;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly templates = SHIP_TEMPLATES;

  protected readonly step = linkedSignal<Step>(() => {
    if (this.profiles.state() === 'loading' || this.profiles.state() === 'idle') return 'loading';
    return this.profiles.own() ? 'signed' : 'pick';
  });
  protected readonly picked = signal<Profile | null>(null);
  /** Starting rocket of a new profile: a crew design or blank. */
  protected readonly template = signal<CrewId | 'blank'>('blank');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  // Guest nickname ---------------------------------------------------------------------
  private readonly guestModel = signal({ nickname: this.player.guestNickname() });
  protected readonly guestForm = form(this.guestModel, (path) => {
    maxLength(path.nickname, NICKNAME_MAX_LENGTH, { message: `Máximo ${NICKNAME_MAX_LENGTH} caracteres.` });
    validate(path.nickname, ({ value }) => nicknameError(value()));
  });
  protected readonly showGuestErrors = computed(() => {
    const field = this.guestForm.nickname();
    return field.touched() && field.invalid();
  });

  // Password of a picked profile -------------------------------------------------------
  private readonly loginModel = signal({ password: '' });
  protected readonly loginForm = form(this.loginModel, (path) => {
    validate(path.password, ({ value }) =>
      value() === '' ? { kind: 'required', message: 'Escribe tu contraseña.' } : undefined,
    );
  });
  protected readonly showLoginErrors = computed(() => {
    const field = this.loginForm.password();
    return field.touched() && field.invalid();
  });

  // New profile -------------------------------------------------------------------------
  private readonly createModel = signal({ apodo: '', password: '', repeat: '' });
  protected readonly createForm = form(this.createModel, (path) => {
    maxLength(path.apodo, NICKNAME_MAX_LENGTH, { message: `Máximo ${NICKNAME_MAX_LENGTH} caracteres.` });
    validate(path.apodo, ({ value }) =>
      nicknameError(value()) ??
      (this.profiles.isNameTaken(value()) ? { kind: 'taken', message: 'Ya hay un perfil con ese nombre.' } : undefined),
    );
    validate(path.password, ({ value }) =>
      value().length < PASSWORD_MIN_LENGTH
        ? { kind: 'minLength', message: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.` }
        : undefined,
    );
    validate(path.repeat, ({ value, valueOf }) =>
      value() !== valueOf(path.password) ? { kind: 'match', message: 'Las contraseñas no coinciden.' } : undefined,
    );
  });

  constructor() {
    void this.profiles.load();
  }

  protected show(step: Step): void {
    this.error.set(null);
    this.step.set(step);
  }

  protected pick(profile: Profile): void {
    this.picked.set(profile);
    this.loginModel.set({ password: '' });
    this.show('password');
  }

  protected continueSigned(): void {
    void this.finish();
  }

  protected async switchProfile(): Promise<void> {
    this.busy.set(true);
    try {
      await this.profiles.logout();
      this.show('pick');
    } finally {
      this.busy.set(false);
    }
  }

  protected login(event: Event): void {
    event.preventDefault();
    const profile = this.picked();
    if (!profile) return;
    this.error.set(null);
    void submit(this.loginForm, async () => {
      try {
        await this.profiles.login(profile, this.loginModel().password);
        await this.finish();
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      }
      return undefined;
    });
  }

  protected create(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    void submit(this.createForm, async () => {
      const { apodo, password } = this.createModel();
      const templateId = this.template();
      try {
        await this.profiles.create(apodo, this.templates.find((m) => m.id === templateId) ?? null, password);
        // First, customise the new rocket; the presentation plays after saving it.
        await this.router.navigate(['/ajustes'], { queryParams: { bienvenida: 1, volver: this.returnUrl() } });
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      }
      return undefined;
    });
  }

  protected enterAsGuest(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    void submit(this.guestForm, async () => {
      try {
        // A signed-in profile on this device would otherwise take over the guest.
        if (!this.auth.isGuest()) await this.profiles.logout();
        this.player.setNickname(this.guestModel().nickname);
        await this.auth.ensureSignedIn();
        await this.finish();
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      }
      return undefined;
    });
  }

  protected retry(): void {
    void this.profiles.load(true);
  }

  private async finish(): Promise<void> {
    this.intro.playOnce();
    await this.router.navigateByUrl(this.returnUrl());
  }

  private returnUrl(): string {
    return safeReturnUrl(this.volver());
  }
}

function nicknameError(value: string): { kind: string; message: string } | undefined {
  const length = value.trim().length;
  if (length === 0) return { kind: 'required', message: 'Escribe un apodo.' };
  if (length < NICKNAME_MIN_LENGTH) return { kind: 'minLength', message: `Mínimo ${NICKNAME_MIN_LENGTH} caracteres.` };
  return undefined;
}
