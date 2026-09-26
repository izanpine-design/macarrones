/** Things a crew member carries on their rocket. */
export type CrewObject = 'vaper' | 'bolos' | 'micro';

export type PetId = 'pichu' | 'nael' | 'simba' | 'enana';

export type CrewId = 'noe' | 'raul' | 'izan' | 'miguel';

export interface CrewMember {
  id: CrewId;
  nombre: string;
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
    color: '#f08a24',
    colorOscuro: '#a1520c',
    pelo: '#2e2019',
    cabeza: null,
    delante: null,
    detras: null,
    mascota: 'enana',
  },
];
