import { computed, DOCUMENT, inject, Service, signal } from '@angular/core';
import { CREW, CrewMember } from '../shared/crew/crew';
import { crewLook, Look, profileLook } from '../shared/crew/look';
import { AuthService } from './auth.service';
import { preparePicture } from './picture';
import {
  isAssetPicture,
  LOGIN_DOMAIN,
  normalizeShip,
  PictureKind,
  Profile,
  shipFromTemplate,
  ShipConfig,
  BLANK_SHIP,
  uploadedPictures,
} from './profile.model';
import { SupabaseService } from './supabase.service';

const BUCKET = 'naves';
/** Rockets on the welcome page and in the presentation: yours + random ones. */
export const SHOWCASE_SIZE = 6;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Player profiles (`perfiles`) and their rockets. Everybody can see every
 * profile; only its owner (a registered player) can change it.
 */
@Service()
export class ProfileService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  private readonly _profiles = signal<readonly Profile[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);
  /** Random order picked when the list loads, so the showcase stays stable. */
  private readonly _order = signal<readonly string[]>([]);
  private pending: Promise<void> | null = null;

  readonly profiles = this._profiles.asReadonly();
  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();

  /** Your profile, or null for guests / nobody signed in. */
  readonly own = computed(() => {
    const userId = this.auth.userId();
    if (!userId || this.auth.isGuest()) return null;
    return this._profiles().find((p) => p.user_id === userId) ?? null;
  });

  /** Look of every profile, by user id. */
  readonly looks = computed(
    () => new Map(this._profiles().map((p) => [p.user_id, profileLook(p, (ref) => this.pictureUrl(ref))])),
  );

  /**
   * Up to 6 rockets for the welcome page and the presentation: yours first,
   * the rest at random. The crew's original designs if there are no profiles.
   */
  readonly showcase = computed<Look[]>(() => {
    const looks = this.looks();
    if (looks.size === 0) return CREW.map(crewLook);
    const ownId = this.own()?.user_id;
    const ids = [...(ownId ? [ownId] : []), ...this._order().filter((id) => id !== ownId)];
    return ids.flatMap((id) => looks.get(id) ?? []).slice(0, SHOWCASE_SIZE);
  });

  /** Loads the session and the profiles once (`force` to reload). */
  load(force = false): Promise<void> {
    if (force) this.pending = null;
    this.pending ??= this.fetchAll().catch(() => {
      this.pending = null;
    });
    return this.pending;
  }

  lookFor(userId: string): Look | null {
    return this.looks().get(userId) ?? null;
  }

  /** Makes sure these users' profiles are loaded (e.g. someone who just signed up). */
  async ensureProfiles(userIds: readonly string[]): Promise<void> {
    await this.load();
    const known = new Set(this._profiles().map((p) => p.user_id));
    const missing = userIds.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    const { data, error } = await this.supabase.from('perfiles').select('*').in('user_id', missing);
    if (error) throw new Error(`No se han podido cargar los perfiles: ${error.message}`);
    this.merge((data as Profile[]).map(normalizeProfile));
  }

  /** Signs in as an existing profile. */
  async login(profile: Profile, password: string): Promise<void> {
    await this.auth.signInWithPassword(profile.login, password);
    await this.load(true);
  }

  /** Creates your profile (you become a registered player) from a template or blank. */
  async create(apodo: string, template: CrewMember | null, password: string): Promise<void> {
    const name = apodo.trim();
    await this.load();
    if (this.isNameTaken(name)) throw new Error('Ya hay un perfil con ese nombre.');

    const login = `u-${crypto.randomUUID()}@${LOGIN_DOMAIN}`;
    const userId = await this.auth.signUp(login, password);
    const nave = template ? shipFromTemplate(template) : BLANK_SHIP;

    const { error } = await this.supabase.from('perfiles').insert({ user_id: userId, apodo: name, login, nave });
    if (error) {
      throw new Error(
        error.code === '23505' ? 'Ya hay un perfil con ese nombre.' : `No se ha podido crear el perfil: ${error.message}`,
      );
    }
    await this.load(true);
  }

  /** Saves your nickname and rocket. Uploaded pictures no longer used are deleted. */
  async save(apodo: string, nave: ShipConfig): Promise<void> {
    const own = this.own();
    if (!own) throw new Error('Inicia sesión en tu perfil para guardar tu nave.');
    const name = apodo.trim();
    if (this.isNameTaken(name, own.user_id)) throw new Error('Ya hay un perfil con ese nombre.');

    const { data, error } = await this.supabase
      .from('perfiles')
      .update({ apodo: name, nave })
      .eq('user_id', own.user_id)
      .select('*')
      .single();
    if (error) {
      throw new Error(
        error.code === '23505' ? 'Ya hay un perfil con ese nombre.' : `No se ha podido guardar tu nave: ${error.message}`,
      );
    }
    this.merge([normalizeProfile(data as Profile)]);

    const unused = uploadedPictures(own.nave).filter((ref) => !uploadedPictures(nave).includes(ref));
    if (unused.length > 0) void this.supabase.storage.from(BUCKET).remove(unused);
  }

  async changePassword(password: string): Promise<void> {
    await this.auth.changePassword(password);
  }

  /** Leaves your profile on this device (you go back to choosing who you are). */
  async logout(): Promise<void> {
    await this.auth.signOut();
  }

  /** Resizes and uploads a picture to your folder. Returns its reference (bucket path). */
  async uploadPicture(kind: PictureKind, file: File): Promise<string> {
    const own = this.own();
    if (!own) throw new Error('Inicia sesión en tu perfil para subir imágenes.');
    const { blob, extension } = await preparePicture(file, kind, this.document);
    const path = `${own.user_id}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
    if (error) throw new Error(`No se ha podido subir la imagen: ${error.message}`);
    return path;
  }

  /** Deletes an uploaded picture that was never saved (replaced or removed in the editor). */
  discardPicture(ref: string): void {
    const saved = uploadedPictures(this.own()?.nave ?? BLANK_SHIP);
    if (!isAssetPicture(ref) && !saved.includes(ref)) {
      void this.supabase.storage.from(BUCKET).remove([ref]);
    }
  }

  /** URL of a picture reference: app asset as is, bucket path as public URL. */
  pictureUrl(ref: string): string {
    return isAssetPicture(ref) ? ref : this.supabase.storage.from(BUCKET).getPublicUrl(ref).data.publicUrl;
  }

  isNameTaken(apodo: string, exceptUserId?: string): boolean {
    const name = apodo.trim().toLowerCase();
    return this._profiles().some((p) => p.user_id !== exceptUserId && p.apodo.trim().toLowerCase() === name);
  }

  private async fetchAll(): Promise<void> {
    this._state.set('loading');
    this._error.set(null);
    try {
      await this.auth.ready();
      const { data, error } = await this.supabase.from('perfiles').select('*').order('apodo');
      if (error) throw new Error(error.message);
      const profiles = (data as Profile[]).map(normalizeProfile);
      this._profiles.set(profiles);
      this._order.set(shuffle(profiles.map((p) => p.user_id)));
      this._state.set('ready');
    } catch (e) {
      this._state.set('error');
      this._error.set(`No se han podido cargar los perfiles: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }

  private merge(profiles: readonly Profile[]): void {
    this._profiles.update((current) => {
      const byId = new Map(current.map((p) => [p.user_id, p]));
      profiles.forEach((p) => byId.set(p.user_id, p));
      return [...byId.values()].sort((a, b) => a.apodo.localeCompare(b.apodo));
    });
    this._order.update((order) => [...order, ...profiles.map((p) => p.user_id).filter((id) => !order.includes(id))]);
  }
}

function normalizeProfile(row: Profile): Profile {
  return { ...row, nave: normalizeShip(row.nave) };
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
