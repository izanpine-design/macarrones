/** Things a crew member carries on their rocket. */
export type CrewObject = 'vaper' | 'bolos' | 'micro';

export type PetId = 'pichu' | 'nael' | 'simba' | 'enana';

export type CrewId = 'noe' | 'raul' | 'izan' | 'miguel';

export interface CrewMember {
  id: CrewId;
  nombre: string;
  /** Nicknames that identify this person in a room (lowercase, no accents). */
  alias: readonly string[];
  /** Accent colour: sleeves, fins, scarf and rocket trail. */
  color: string;
  colorOscuro: string;
  /** Hair colour of the drawn placeholder head (used until there is a photo). */
  pelo: string;
  /** Cut-out head photo in `public/`, e.g. 'crew/noe.webp'. Null = drawn placeholder. */
  cabeza: string | null;
  /** Object in the front hand (near the mouth) and in the raised back hand. */
  delante: CrewObject | null;
  detras: CrewObject | null;
  mascota: PetId;
}

export const CREW: readonly CrewMember[] = [
  {
    id: 'noe',
    nombre: 'Noe',
    alias: ['noe', 'noelia'],
    color: '#e8589a',
    colorOscuro: '#9c2c63',
    pelo: '#3b2418',
    cabeza: null,
    delante: 'vaper',
    detras: null,
    mascota: 'pichu',
  },
  {
    id: 'raul',
    nombre: 'Raúl',
    alias: ['raul'],
    color: '#3f82ea',
    colorOscuro: '#20478f',
    pelo: '#241a14',
    cabeza: null,
    delante: 'micro',
    detras: 'bolos',
    mascota: 'nael',
  },
  {
    id: 'izan',
    nombre: 'Izan',
    alias: ['izan'],
    color: '#2eab6e',
    colorOscuro: '#17663f',
    pelo: '#5a3a22',
    cabeza: null,
    delante: null,
    detras: null,
    mascota: 'simba',
  },
  {
    id: 'miguel',
    nombre: 'Miguel',
    alias: ['miguel', 'migue', 'miki', 'mike'],
    color: '#f08a24',
    colorOscuro: '#a1520c',
    pelo: '#2e2019',
    cabeza: 'crew/miguel.webp',
    delante: null,
    detras: null,
    mascota: 'enana',
  },
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Crew member a room nickname refers to ("Migue", "raúl 🍺"…), or null. */
export function crewForNickname(nickname: string): CrewMember | null {
  const words = normalize(nickname).split(/[^a-z0-9]+/).filter(Boolean);
  return CREW.find((member) => member.alias.some((alias) => words.includes(alias))) ?? null;
}
