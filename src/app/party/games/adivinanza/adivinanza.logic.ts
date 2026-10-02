import { Reducer } from '../../party.model';
import { addPoints, shuffle } from '../shared.logic';

/**
 * Shared by "Secretos anónimos" and "¿Quién dijo qué?". First everybody writes
 * (the texts are `aportes`, whose author stays in the database); then, one text
 * at a time, everyone votes who it belongs to and it is revealed.
 *
 *   secretos: the answer is who wrote it. Right guesses score a point; the
 *             author scores one if nobody guessed.
 *   frases:   the answer is who SAID it (chosen by the writer). Right guesses
 *             score, except the writer's (they already knew).
 */
export type Modo = 'secretos' | 'frases';

export interface AdivinanzaState {
  fase: 'escribiendo' | 'adivinando' | 'final';
  /** Aporte ids in the order they are played. */
  orden: number[];
  indice: number;
  /** voter → voted. */
  votos: Record<string, string>;
  /** Answer of the current text, once revealed. */
  revelado: { autor: string; respuesta: string } | null;
  puntos: Record<string, number>;
}

export function adivinanzaInicial(): AdivinanzaState {
  return { fase: 'escribiendo', orden: [], indice: 0, votos: {}, revelado: null, puntos: {} };
}

/** Writing is over: play the texts in random order. */
export const empezarAdivinar =
  (aporteIds: readonly number[]): Reducer<AdivinanzaState> =>
  (state) =>
    state.fase !== 'escribiendo' || aporteIds.length === 0
      ? null
      : { ...state, fase: 'adivinando', orden: shuffle(aporteIds), indice: 0, votos: {}, revelado: null };

export const votar =
  (indice: number, votado: string): Reducer<AdivinanzaState> =>
  (state, { me, players }) =>
    state.fase !== 'adivinando' || state.indice !== indice || state.revelado || !players.some((p) => p.user_id === votado)
      ? null
      : { ...state, votos: { ...state.votos, [me]: votado } };

/**
 * Reveals the current text. `autor` (who wrote it) and `respuesta` (the right
 * answer) come from the database (PartyBackend.revealAporte).
 */
export const revelar =
  (indice: number, modo: Modo, autor: string, respuesta: string): Reducer<AdivinanzaState> =>
  (state) => {
    if (state.fase !== 'adivinando' || state.indice !== indice || state.revelado) return null;
    const acertantes = Object.entries(state.votos)
      .filter(([votante, votado]) => votado === respuesta && !(modo === 'frases' && votante === autor))
      .map(([votante]) => votante);
    let puntos = addPoints(state.puntos, acertantes);
    if (modo === 'secretos' && acertantes.filter((v) => v !== autor).length === 0) puntos = addPoints(puntos, [autor]);
    return { ...state, revelado: { autor, respuesta }, puntos };
  };

export const siguiente =
  (indice: number): Reducer<AdivinanzaState> =>
  (state) => {
    if (state.fase !== 'adivinando' || state.indice !== indice || !state.revelado) return null;
    const next = indice + 1;
    return next >= state.orden.length
      ? { ...state, fase: 'final', votos: {}, revelado: null }
      : { ...state, indice: next, votos: {}, revelado: null };
  };
