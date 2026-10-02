/**
 * "El generador de Brebajes": the punishment for a serious slip in "Tu
 * kryptonita". A short random recipe made only with the drinks the players
 * have, with fixed amounts and an absurd name.
 *
 * Limits so the night does not get out of hand:
 *   - at most MAX_ALCOHOL_CL of spirits per Brebaje (topped up with soft drinks),
 *   - at most MAX_BREBAJES per person; after that, a challenge without alcohol.
 */
export type TipoBebida = 'licor' | 'suave' | 'refresco';

export interface Bebida {
  id: string;
  nombre: string;
  tipo: TipoBebida;
  emoji: string;
}

export const MAX_ALCOHOL_CL = 3;
export const MAX_BREBAJES = 3;

export const BEBIDAS: readonly Bebida[] = [
  { id: 'ron', nombre: 'Ron', tipo: 'licor', emoji: '🥃' },
  { id: 'vodka', nombre: 'Vodka', tipo: 'licor', emoji: '🍸' },
  { id: 'ginebra', nombre: 'Ginebra', tipo: 'licor', emoji: '🍸' },
  { id: 'whisky', nombre: 'Whisky', tipo: 'licor', emoji: '🥃' },
  { id: 'tequila', nombre: 'Tequila', tipo: 'licor', emoji: '🌵' },
  { id: 'licor', nombre: 'Licor de hierbas', tipo: 'licor', emoji: '🌿' },
  { id: 'cerveza', nombre: 'Cerveza', tipo: 'suave', emoji: '🍺' },
  { id: 'vino', nombre: 'Vino', tipo: 'suave', emoji: '🍷' },
  { id: 'cola', nombre: 'Cola', tipo: 'refresco', emoji: '🥤' },
  { id: 'limon', nombre: 'Refresco de limón', tipo: 'refresco', emoji: '🍋' },
  { id: 'naranja', nombre: 'Refresco de naranja', tipo: 'refresco', emoji: '🍊' },
  { id: 'tonica', nombre: 'Tónica', tipo: 'refresco', emoji: '🫧' },
  { id: 'zumo', nombre: 'Zumo', tipo: 'refresco', emoji: '🧃' },
  { id: 'gaseosa', nombre: 'Gaseosa', tipo: 'refresco', emoji: '💧' },
  { id: 'energetica', nombre: 'Bebida energética', tipo: 'refresco', emoji: '⚡' },
];

const BY_ID = new Map(BEBIDAS.map((b) => [b.id, b]));

const NOMBRES = [
  'El Chispazo',
  'La Bomba Galáctica',
  'El Meteorito',
  'El Agujero Negro',
  'La Supernova',
  'El Despegue',
  'La Pócima Macarrónica',
  'El Trueno',
  'La Nebulosa',
  'El Cohete Loco',
  'El Rayo Verde',
  'La Tormenta Solar',
];

const TOQUES = ['con una pizca de hielo', 'removido tres veces', 'con brindis obligatorio', 'de un trago', 'mirando a los ojos de quien te pilló'];

/** Challenges without alcohol, once someone has had MAX_BREBAJES. */
export const RETOS_SIN_ALCOHOL: readonly string[] = [
  'Haz diez sentadillas mientras el grupo cuenta.',
  'Habla con acento extranjero hasta tu próximo turno.',
  'Deja que alguien publique un emoji en tu estado.',
  'Canta el estribillo de la canción que elija el grupo.',
  'Bebe un vaso de agua entero (¡hidrátate!).',
  'Imita a alguien del grupo hasta que lo adivinen.',
  'Haz un cumplido sincero a cada persona de la sala.',
  'Mantén la postura del flamenco treinta segundos.',
];

export interface Brebaje {
  nombre: string;
  /** Recipe lines, e.g. "1,5 cl de Ron". */
  lineas: string[];
  /** cl of spirits (≤ MAX_ALCOHOL_CL). */
  alcoholCl: number;
}

/**
 * A random recipe with the available drinks, or null if there is nothing
 * alcoholic to make it with (then a challenge without alcohol applies).
 */
export function generarBrebaje(disponibles: readonly string[], apodo: string, random: () => number = Math.random): Brebaje | null {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const bebidas = disponibles.map((id) => BY_ID.get(id)).filter((b): b is Bebida => !!b);
  const licores = bebidas.filter((b) => b.tipo === 'licor');
  const suaves = bebidas.filter((b) => b.tipo === 'suave');
  const refrescos = bebidas.filter((b) => b.tipo === 'refresco');

  const lineas: string[] = [];
  let alcoholCl = 0;
  if (licores.length > 0) {
    // One spirit (2–3 cl) or two of 1,5 cl: never more than MAX_ALCOHOL_CL.
    if (licores.length >= 2 && random() < 0.5) {
      const [a, b] = shuffleSmall(licores, random);
      lineas.push(`1,5 cl de ${a.nombre}`, `1,5 cl de ${b.nombre}`);
      alcoholCl = 3;
    } else {
      const cl = random() < 0.5 ? 2 : 3;
      lineas.push(`${cl} cl de ${pick(licores).nombre}`);
      alcoholCl = cl;
    }
  } else if (suaves.length > 0) {
    lineas.push(`6 cl de ${pick(suaves).nombre}`);
  } else {
    return null;
  }

  if (refrescos.length > 0) {
    lineas.push(`Completa hasta 15 cl con ${pick(refrescos).nombre}`);
  } else if (alcoholCl > 0) {
    lineas.push('Completa hasta 15 cl con agua');
  }
  lineas.push(pick(TOQUES));

  return { nombre: `${pick(NOMBRES)} de ${apodo}`, lineas, alcoholCl };
}

export function textoBrebaje(brebaje: Brebaje): string {
  return `🧪 ${brebaje.nombre}\n${brebaje.lineas.join('\n')}`;
}

function shuffleSmall<T>(items: readonly T[], random: () => number): T[] {
  return [...items].sort(() => random() - 0.5);
}
