import { Reducer } from '../../party.model';
import { clampText, ids, shuffle } from '../shared.logic';
import { BEBIDAS, generarBrebaje, MAX_BREBAJES, RETOS_SIN_ALCOHOL, textoBrebaje } from './brebaje';

/**
 * "Tu kryptonita": everyone gets a forbidden habit chosen by another player
 * (biting nails, a pet phrase, looking at the phone…), secret or known. For a
 * fixed time anyone can mark someone as caught: a light slip is a sip, a
 * serious one triggers a Brebaje made with the drinks the players have.
 *
 * Phases: preparando (drinks + options) → eligiendo (each chooses the
 * kryptonite of the next one in a random ring) → jugando → final (revealed).
 * Secret kryptonites are per-player secrets (the owner cannot read theirs).
 */
export interface PilladoKryptonita {
  quien: string;
  por: string;
  grave: boolean;
  en: number;
  /** Brebaje recipe or challenge, for serious slips. */
  castigo?: string;
}

export interface KryptonitaState {
  fase: 'preparando' | 'eligiendo' | 'jugando' | 'final';
  /** Drinks each player has available. */
  bebidas: Record<string, string[]>;
  /** Secret: the owner does not know their kryptonite. */
  secreta: boolean;
  minutos: number;
  ronda: number;
  /** chooser → player whose kryptonite they choose. */
  asignador: Record<string, string>;
  /** Players whose kryptonite has been chosen. */
  elegidas: Record<string, true>;
  /** Known kryptonites (only when not secret). */
  manias: Record<string, string>;
  terminaEn: number | null;
  pillados: PilladoKryptonita[];
  /** Brebajes each player has had tonight. */
  brebajes: Record<string, number>;
  revelarSecretos: boolean;
}

export const MINUTOS_KRYPTONITA = [10, 20, 30];

export const SUGERENCIAS_MANIAS: readonly string[] = [
  'Mirar el móvil',
  'Decir «literal»',
  'Decir «en plan»',
  'Tocarse el pelo',
  'Morderse las uñas',
  'Cruzarse de brazos',
  'Decir una palabrota',
  'Reírse de su propio chiste',
  'Decir el nombre de alguien',
  'Señalar con el dedo',
  'Decir «tío» o «tía»',
  'Beber sin brindar',
  'Interrumpir a alguien',
  'Decir «vale»',
  'Quejarse de algo',
  'Poner los ojos en blanco',
];

export function kryptonitaInicial(): KryptonitaState {
  return {
    fase: 'preparando',
    bebidas: {},
    secreta: true,
    minutos: 20,
    ronda: 0,
    asignador: {},
    elegidas: {},
    manias: {},
    terminaEn: null,
    pillados: [],
    brebajes: {},
    revelarSecretos: false,
  };
}

export const toggleBebida =
  (bebida: string): Reducer<KryptonitaState> =>
  (state, { me }) => {
    if (!BEBIDAS.some((b) => b.id === bebida)) return null;
    const mias = state.bebidas[me] ?? [];
    const nuevas = mias.includes(bebida) ? mias.filter((b) => b !== bebida) : [...mias, bebida];
    return { ...state, bebidas: { ...state.bebidas, [me]: nuevas } };
  };

export const configurar =
  (cambios: { secreta?: boolean; minutos?: number }): Reducer<KryptonitaState> =>
  (state) => {
    if (state.fase !== 'preparando') return null;
    if (cambios.minutos !== undefined && !MINUTOS_KRYPTONITA.includes(cambios.minutos)) return null;
    return { ...state, ...cambios };
  };

/** Random ring: each player chooses the kryptonite of the next one. */
export const empezarEleccion =
  (ronda: number): Reducer<KryptonitaState> =>
  (state, { players }) => {
    if (state.fase !== 'preparando' || state.ronda !== ronda || players.length < 2) return null;
    const orden = shuffle(ids(players));
    const asignador = Object.fromEntries(orden.map((id, i) => [id, orden[(i + 1) % orden.length]]));
    return { ...state, fase: 'eligiendo', ronda: ronda + 1, asignador, elegidas: {}, manias: {}, pillados: [], revelarSecretos: false };
  };

/**
 * The chooser has picked their player's kryptonite. When secret, the text is
 * stored as a per-player secret by the caller and only marked here.
 */
export const elegirKryptonita =
  (texto: string): Reducer<KryptonitaState> =>
  (state, { me, now }) => {
    const objetivo = state.asignador[me];
    const mania = clampText(texto, 80);
    if (state.fase !== 'eligiendo' || !objetivo || mania.length < 2) return null;
    const elegidas = { ...state.elegidas, [objetivo]: true as const };
    const manias = state.secreta ? state.manias : { ...state.manias, [objetivo]: mania };
    const todas = Object.values(state.asignador).every((id) => elegidas[id]);
    return {
      ...state,
      elegidas,
      manias,
      ...(todas ? { fase: 'jugando' as const, terminaEn: now + state.minutos * 60_000 } : {}),
    };
  };

/** Start playing even if someone (who left, for instance) did not choose. */
export const empezarYa =
  (ronda: number): Reducer<KryptonitaState> =>
  (state, { now }) =>
    state.fase !== 'eligiendo' || state.ronda !== ronda || Object.keys(state.elegidas).length === 0
      ? null
      : { ...state, fase: 'jugando', terminaEn: now + state.minutos * 60_000 };

/** Every drink some player has. */
export function bebidasDisponibles(state: KryptonitaState): string[] {
  return [...new Set(Object.values(state.bebidas).flat())];
}

/**
 * `quien` has been caught. A serious slip is a Brebaje while they have had
 * fewer than MAX_BREBAJES (or no alcohol is available), a challenge otherwise.
 */
export const pillar =
  (quien: string, grave: boolean, apodo: string, random: () => number = Math.random): Reducer<KryptonitaState> =>
  (state, { me, now }) => {
    if (state.fase !== 'jugando' || quien === me || !state.asignador[quien]) return null;
    const pillado: PilladoKryptonita = { quien, por: me, grave, en: now };
    let brebajes = state.brebajes;
    if (grave) {
      const tomados = brebajes[quien] ?? 0;
      const brebaje = tomados < MAX_BREBAJES ? generarBrebaje(bebidasDisponibles(state), apodo, random) : null;
      if (brebaje) {
        pillado.castigo = textoBrebaje(brebaje);
        brebajes = { ...brebajes, [quien]: tomados + 1 };
      } else {
        pillado.castigo = `🎯 Reto sin alcohol: ${RETOS_SIN_ALCOHOL[Math.floor(random() * RETOS_SIN_ALCOHOL.length)]}`;
      }
    }
    return { ...state, pillados: [...state.pillados, pillado], brebajes };
  };

export const terminar =
  (ronda: number): Reducer<KryptonitaState> =>
  (state) =>
    state.fase !== 'jugando' || state.ronda !== ronda ? null : { ...state, fase: 'final', revelarSecretos: true };

export const otraRonda =
  (ronda: number): Reducer<KryptonitaState> =>
  (state) =>
    state.fase !== 'final' || state.ronda !== ronda ? null : { ...state, fase: 'preparando', revelarSecretos: false };
