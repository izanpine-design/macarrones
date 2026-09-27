import { CREW, CrewMember, CrewObject, PetId } from '../shared/crew/crew';

/** 'piezas': the drawn macaroni rocket. 'imagen': an uploaded picture replaces it. */
export type ShipStyle = 'piezas' | 'imagen';

/**
 * A player's rocket, stored as JSON in `perfiles.nave`. Picture fields are
 * references: a path in the "naves" bucket, or an app asset ('crew/…').
 */
export interface ShipConfig {
  color: string;
  colorOscuro: string;
  pelo: string;
  delante: CrewObject | null;
  detras: CrewObject | null;
  mascota: PetId | null;
  /** Head photo, or null for the drawn face. */
  cabeza: string | null;
  nave: ShipStyle;
  /** Full rocket picture, used when `nave` is 'imagen'. */
  naveImagen: string | null;
  /** Own "¡A beber!" background and whether to use it. */
  fondoBeber: string | null;
  usarFondoBeber: boolean;
}

/** Row of `perfiles`. */
export interface Profile {
  user_id: string;
  apodo: string;
  login: string;
  nave: ShipConfig;
  updated_at: string;
}

export const PASSWORD_MIN_LENGTH = 6;
/**
 * Domain of the internal login emails (players never see them). It must be a
 * real domain: Supabase rejects reserved ones (.example, .test, .local…). Ours has
 * no mail server, so nothing is ever delivered.
 */
export const LOGIN_DOMAIN = 'macarrones.netlify.app';

/** Kinds of picture a player can upload. */
export type PictureKind = 'cabeza' | 'nave' | 'fondo';

export const BLANK_SHIP: ShipConfig = {
  color: '#8a5cff',
  colorOscuro: '#4b2a9c',
  pelo: '#3b2418',
  delante: null,
  detras: null,
  mascota: null,
  cabeza: null,
  nave: 'piezas',
  naveImagen: null,
  fondoBeber: null,
  usarFondoBeber: false,
};

/**
 * A crew member's design as a starting point for a new rocket. Their photo is
 * not copied: it is that person's face.
 */
export function shipFromTemplate(member: CrewMember): ShipConfig {
  return {
    ...BLANK_SHIP,
    color: member.color,
    colorOscuro: member.colorOscuro,
    pelo: member.pelo,
    delante: member.delante,
    detras: member.detras,
    mascota: member.mascota,
  };
}

export const SHIP_TEMPLATES = CREW;

/** Name prefix of head photos uploaded with a transparent background. */
export const CUTOUT_HEAD = 'cabeza-libre';

/** A cut-out head (reference or URL): drawn as is, without the round frame. */
export function isCutoutHead(ref: string | null): boolean {
  return !!ref && ref.includes(`/${CUTOUT_HEAD}-`);
}

/** True for app assets (public/…), false for paths in the "naves" bucket. */
export function isAssetPicture(ref: string): boolean {
  return ref.startsWith('crew/') || ref.startsWith('beber/');
}

/** Uploaded pictures (bucket paths) a rocket refers to. */
export function uploadedPictures(ship: ShipConfig): string[] {
  return [ship.cabeza, ship.naveImagen, ship.fondoBeber].filter(
    (ref): ref is string => !!ref && !isAssetPicture(ref),
  );
}

const OBJECTS: readonly CrewObject[] = ['vaper', 'bolos', 'micro', 'mando', 'pepe', 'jackson'];
const PETS: readonly PetId[] = ['pichu', 'nael', 'simba', 'enana', 'gordo'];

/** Fills missing / invalid fields of a stored rocket with the defaults. */
export function normalizeShip(value: unknown): ShipConfig {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
  const ref = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  const object = (v: unknown) => (OBJECTS.includes(v as CrewObject) ? (v as CrewObject) : null);
  return {
    color: color(raw['color'], BLANK_SHIP.color),
    colorOscuro: color(raw['colorOscuro'], BLANK_SHIP.colorOscuro),
    pelo: color(raw['pelo'], BLANK_SHIP.pelo),
    delante: object(raw['delante']),
    detras: object(raw['detras']),
    mascota: PETS.includes(raw['mascota'] as PetId) ? (raw['mascota'] as PetId) : null,
    cabeza: ref(raw['cabeza']),
    nave: raw['nave'] === 'imagen' ? 'imagen' : 'piezas',
    naveImagen: ref(raw['naveImagen']),
    fondoBeber: ref(raw['fondoBeber']),
    usarFondoBeber: raw['usarFondoBeber'] === true,
  };
}
