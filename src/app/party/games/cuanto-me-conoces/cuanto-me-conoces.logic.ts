import { Reducer } from '../../party.model';
import { addPoints, clampText, deckItem, everyoneDid, ids, nextInRotation, shuffle } from '../shared.logic';

/**
 * "¿Cuánto me conoces?": each round is about one person (the protagonist). They
 * answer a question about themselves while the rest guess their answer. When
 * everyone has answered, the answers are revealed and the protagonist marks
 * which guesses are right: one point each. Whoever has most points at the end
 * wins.
 */
export interface CuantoMeConocesState {
  fase: 'respondiendo' | 'revelado' | 'final';
  mazo: string[];
  indice: number;
  /** Protagonists, in order (fixed at the start). */
  orden: string[];
  /** Position in `orden` (it keeps growing; the protagonist is orden[turno % n]). */
  turno: number;
  /** Rounds each player is the protagonist. */
  rondas: number;
  /** player → answer (the protagonist's is the right one). */
  respuestas: Record<string, string>;
  /** Players whose guess the protagonist marked as right. */
  aciertos: Record<string, true>;
  puntos: Record<string, number>;
}

export function cuantoMeConocesInicial(items: readonly string[], jugadores: readonly string[], rondas = 1): CuantoMeConocesState {
  return {
    fase: 'respondiendo',
    mazo: shuffle(items),
    indice: 0,
    orden: shuffle(jugadores),
    turno: 0,
    rondas,
    respuestas: {},
    aciertos: {},
    puntos: {},
  };
}

export function protagonista(state: CuantoMeConocesState): string {
  return state.orden[state.turno % state.orden.length];
}

export function preguntaActual(state: CuantoMeConocesState): string | null {
  return deckItem(state.mazo, state.indice);
}

export const responder =
  (turno: number, texto: string): Reducer<CuantoMeConocesState> =>
  (state, { me, players }) => {
    const respuesta = clampText(texto, 120);
    if (state.fase !== 'respondiendo' || state.turno !== turno || !respuesta) return null;
    const respuestas = { ...state.respuestas, [me]: respuesta };
    const listos = everyoneDid(respuestas, players);
    return { ...state, respuestas, fase: listos ? 'revelado' : 'respondiendo' };
  };

/** Reveal without waiting for everybody (the protagonist must have answered). */
export const revelar =
  (turno: number): Reducer<CuantoMeConocesState> =>
  (state) =>
    state.fase !== 'respondiendo' || state.turno !== turno || !state.respuestas[protagonista(state)]
      ? null
      : { ...state, fase: 'revelado' };

export const toggleAcierto =
  (turno: number, jugador: string): Reducer<CuantoMeConocesState> =>
  (state) => {
    if (state.fase !== 'revelado' || state.turno !== turno || jugador === protagonista(state) || !state.respuestas[jugador]) return null;
    const aciertos = { ...state.aciertos };
    if (aciertos[jugador]) delete aciertos[jugador];
    else aciertos[jugador] = true;
    return { ...state, aciertos };
  };

/** Counts the points and moves to the next protagonist (or the end). */
export const siguiente =
  (turno: number): Reducer<CuantoMeConocesState> =>
  (state, { players }) => {
    if (state.fase !== 'revelado' || state.turno !== turno) return null;
    const puntos = addPoints(state.puntos, Object.keys(state.aciertos));
    const next = nextInRotation(state.orden, state.turno, players);
    const fin = next === null || next >= state.orden.length * state.rondas;
    return fin
      ? { ...state, puntos, fase: 'final' }
      : { ...state, puntos, turno: next, indice: state.indice + 1, respuestas: {}, aciertos: {}, fase: 'respondiendo' };
  };

/** Change the question of this round (only before anyone answers). */
export const otraPregunta =
  (turno: number): Reducer<CuantoMeConocesState> =>
  (state) =>
    state.fase !== 'respondiendo' || state.turno !== turno || Object.keys(state.respuestas).length > 0
      ? null
      : { ...state, indice: state.indice + 1 };

export const jugarOtraVez: Reducer<CuantoMeConocesState> = (state, { players }) =>
  state.fase !== 'final' ? null : cuantoMeConocesInicial(state.mazo, ids(players), state.rondas);
