import { Reducer } from '../../party.model';
import { ids, shuffle } from '../shared.logic';

/**
 * "Palabra prohibida": each player gets a forbidden word that everybody else
 * sees but them (stored as a per-player secret, see PartyBackend.saveSecret).
 * Whoever hears someone say theirs marks them: they drink. The round lasts a
 * fixed time; at the end every word is revealed.
 */
export interface Pillado {
  quien: string;
  por: string;
  en: number;
}

export interface PalabraProhibidaState {
  fase: 'preparando' | 'jugando' | 'final';
  mazo: string[];
  /** Words of the deck already handed out (the next round takes the following ones). */
  usadas: number;
  minutos: number;
  ronda: number;
  terminaEn: number | null;
  /** Players who got a word this round, in the order the words were taken. */
  jugadoresRonda: string[];
  pillados: Pillado[];
  /** Lets the database reveal every word (see secretos_de_sala). */
  revelarSecretos: boolean;
}

export const MINUTOS_OPCIONES = [5, 10, 15];

export function palabraProhibidaInicial(items: readonly string[]): PalabraProhibidaState {
  return {
    fase: 'preparando',
    mazo: shuffle(items),
    usadas: 0,
    minutos: 10,
    ronda: 0,
    terminaEn: null,
    jugadoresRonda: [],
    pillados: [],
    revelarSecretos: false,
  };
}

export const configurar =
  (minutos: number): Reducer<PalabraProhibidaState> =>
  (state) =>
    state.fase !== 'preparando' || !MINUTOS_OPCIONES.includes(minutos) ? null : { ...state, minutos };

export const empezarRonda =
  (ronda: number): Reducer<PalabraProhibidaState> =>
  (state, { players, now }) => {
    if (state.fase !== 'preparando' || state.ronda !== ronda || players.length < 2 || state.mazo.length === 0) return null;
    const jugadoresRonda = ids(players);
    return {
      ...state,
      fase: 'jugando',
      ronda: ronda + 1,
      usadas: state.usadas + jugadoresRonda.length,
      jugadoresRonda,
      terminaEn: now + state.minutos * 60_000,
      pillados: [],
      revelarSecretos: false,
    };
  };

/**
 * The word of every player of the current round (taken right after the words
 * of the previous rounds). Used by whoever starts the round to store them.
 */
export function palabrasDeRonda(state: PalabraProhibidaState): Record<string, string> {
  const first = state.usadas - state.jugadoresRonda.length;
  return Object.fromEntries(
    state.jugadoresRonda.map((userId, i) => [userId, state.mazo[(first + i) % state.mazo.length]]),
  );
}

/** Someone said their forbidden word. */
export const pillar =
  (quien: string): Reducer<PalabraProhibidaState> =>
  (state, { me, now }) =>
    state.fase !== 'jugando' || quien === me || !state.jugadoresRonda.includes(quien)
      ? null
      : { ...state, pillados: [...state.pillados, { quien, por: me, en: now }] };

export const terminarRonda =
  (ronda: number): Reducer<PalabraProhibidaState> =>
  (state) =>
    state.fase !== 'jugando' || state.ronda !== ronda ? null : { ...state, fase: 'final', revelarSecretos: true };

export const otraRonda =
  (ronda: number): Reducer<PalabraProhibidaState> =>
  (state) =>
    state.fase !== 'final' || state.ronda !== ronda ? null : { ...state, fase: 'preparando', revelarSecretos: false };

/** Times each player was caught this round. */
export function vecesPillado(state: PalabraProhibidaState): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of state.pillados) result[p.quien] = (result[p.quien] ?? 0) + 1;
  return result;
}
