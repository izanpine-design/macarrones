import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { BLANK_SHIP, PASSWORD_MIN_LENGTH, ShipConfig, ShipStyle } from '../core/profile.model';
import { ProfileService } from '../core/profile.service';
import { CrewHead } from '../shared/crew/crew-head';
import { CrewObject, OBJECT_EMOJI, PetId } from '../shared/crew/crew';
import { profileLook } from '../shared/crew/look';
import { IntroService } from '../shared/intro/intro.service';
import { PET_BY_ID, PETS } from '../shared/pets/pets';
import { RocketShip } from '../shared/rockets/rocket-ship';
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, safeReturnUrl } from '../core/nickname';
import { PictureField } from './picture-field';

const OBJECT_NAMES: Record<CrewObject, string> = {
  vaper: 'Vaper',
  bolos: 'Bolos',
  micro: 'Micrófono',
  mando: 'Mando',
  pepe: 'Peluche de Pepe',
  jackson: 'Peluche de Michael Jackson',
};

/**
 * /ajustes — your rocket: nickname, colours, objects, pet, head photo, drawn or
 * uploaded rocket and "¡A beber!" background, plus your password. Only for
 * registered profiles; everybody sees the result.
 */
@Component({
  selector: 'app-ship-settings',
  imports: [FormField, RouterLink, CrewHead, RocketShip, PictureField],
  templateUrl: './ship-settings.html',
  styleUrl: './ship-settings.css',
})
export class ShipSettings {
  private readonly router = inject(Router);
  private readonly intro = inject(IntroService);
  protected readonly profiles = inject(ProfileService);

  /** `?bienvenida=1`: right after creating the profile (then the presentation). */
  readonly bienvenida = input<string>();
  readonly volver = input<string>();

  protected readonly objects = (Object.keys(OBJECT_NAMES) as CrewObject[]).map((id) => ({
    id,
    label: `${OBJECT_EMOJI[id]} ${OBJECT_NAMES[id]}`,
  }));
  protected readonly pets = PETS.map((pet) => ({ id: pet.id, nombre: pet.nombre }));

  /** Your rocket being edited (starts from the saved one). */
  protected readonly ship = linkedSignal<ShipConfig>(() => this.profiles.own()?.nave ?? BLANK_SHIP);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);

  private readonly nameModel = linkedSignal(() => ({ apodo: this.profiles.own()?.apodo ?? '' }));
  protected readonly nameForm = form(this.nameModel, (path) => {
    maxLength(path.apodo, NICKNAME_MAX_LENGTH, { message: `Máximo ${NICKNAME_MAX_LENGTH} caracteres.` });
    validate(path.apodo, ({ value }) => {
      const name = value().trim();
      if (name.length < NICKNAME_MIN_LENGTH) return { kind: 'minLength', message: `Mínimo ${NICKNAME_MIN_LENGTH} caracteres.` };
      if (this.profiles.isNameTaken(name, this.profiles.own()?.user_id)) {
        return { kind: 'taken', message: 'Ya hay un perfil con ese nombre.' };
      }
      return undefined;
    });
  });
  protected readonly showNameErrors = computed(() => {
    const field = this.nameForm.apodo();
    return field.touched() && field.invalid();
  });

  private readonly passwordModel = signal({ password: '', repeat: '' });
  protected readonly passwordForm = form(this.passwordModel, (path) => {
    validate(path.password, ({ value }) =>
      value().length < PASSWORD_MIN_LENGTH ? { kind: 'minLength', message: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.` } : undefined,
    );
    validate(path.repeat, ({ value, valueOf }) =>
      value() !== valueOf(path.password) ? { kind: 'match', message: 'Las contraseñas no coinciden.' } : undefined,
    );
  });
  protected readonly passwordMessage = signal<{ ok: boolean; text: string } | null>(null);

  /** How your rocket looks with the current changes. */
  protected readonly look = computed(() => {
    const own = this.profiles.own();
    if (!own) return null;
    return profileLook({ ...own, apodo: this.nameModel().apodo.trim() || own.apodo, nave: this.ship() }, (ref) =>
      this.profiles.pictureUrl(ref),
    );
  });
  protected readonly pet = computed(() => {
    const id = this.ship().mascota;
    return id ? (PET_BY_ID.get(id) ?? null) : null;
  });
  /** The uploaded-picture mode is on but there is no picture yet. */
  protected readonly missingShipPicture = computed(() => this.ship().nave === 'imagen' && !this.ship().naveImagen);

  constructor() {
    void this.profiles.load();
  }

  protected set<K extends keyof ShipConfig>(key: K, value: ShipConfig[K]): void {
    this.saved.set(false);
    this.ship.update((ship) => ({ ...ship, [key]: value }));
  }

  protected setObject(key: 'delante' | 'detras', value: string): void {
    this.set(key, value === '' ? null : (value as CrewObject));
  }

  protected setPet(value: string): void {
    this.set('mascota', value === '' ? null : (value as PetId));
  }

  protected setStyle(style: ShipStyle): void {
    this.set('nave', style);
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    this.saved.set(false);
    if (this.missingShipPicture()) {
      this.error.set('Sube la imagen de tu nave o elige la nave por piezas.');
      return;
    }
    void submit(this.nameForm, async () => {
      this.busy.set(true);
      try {
        await this.profiles.save(this.nameModel().apodo, this.ship());
        this.saved.set(true);
        if (this.bienvenida()) {
          this.intro.playOnce();
          await this.router.navigateByUrl(safeReturnUrl(this.volver()));
        }
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }

  protected changePassword(event: Event): void {
    event.preventDefault();
    this.passwordMessage.set(null);
    void submit(this.passwordForm, async () => {
      try {
        await this.profiles.changePassword(this.passwordModel().password);
        this.passwordModel.set({ password: '', repeat: '' });
        this.passwordForm().reset();
        this.passwordMessage.set({ ok: true, text: 'Contraseña cambiada.' });
      } catch (e) {
        this.passwordMessage.set({ ok: false, text: e instanceof Error ? e.message : String(e) });
      }
      return undefined;
    });
  }

  protected async logout(): Promise<void> {
    await this.profiles.logout();
    await this.router.navigateByUrl('/');
  }
}
