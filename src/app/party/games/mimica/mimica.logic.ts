import { Reducer } from '../../party.model';
import { addPoints, deckItem, ids, nextInRotation, shuffle } from '../shared.logic';

/**
 * "Mímica o Pictionary": the player in turn sees a word only they can see and
 * chooses to act it out or to draw it on their phone (the drawing appears live
 * on everyone's screen). Whoever guesses it before time runs out gets a point,
 * and so does the actor.
 */
export type ModoMimica = 'mimica' | 'dibujo';

export interface MimicaState {
  fase: 'preparado' | 'actuando' | 'resultado' | 'final';
  mazo: string[];
  indice: number;
  /** Actors, in order (fixed at the start). */
  orden: string[];
  turno: number;
  /** Turns each player acts. */
  rondas: number;
  segundos: number;
  modo: ModoMimica | null;
  terminaEn: number | null;
  acertante: string | null;
  puntos: Record<string, number>;
}

export const SEGUNDOS_OPCIONES = [45, 60, 90];

export function mimicaInicial(items: readonly string[], jugadores: readonly string[], rondas = 2): MimicaState {
  return {
    fase: 'preparado',
    mazo: shuffle(items),
    indice: 0,
    orden: shuffle(jugadores),
    turno: 0,
    rondas,
    segundos: 60,
    modo: null,
    terminaEn: null,
    acertante: null,
    puntos: {},
  };
}

export function actor(state: MimicaState): string {
  return state.orden[state.turno % state.orden.length];
}

export function palabraActual(state: MimicaState): string | null {
  return deckItem(state.mazo, state.indice);
}

export const configurar =
  (segundos: number): Reducer<MimicaState> =>
  (state) =>
    state.fase !== 'preparado' || !SEGUNDOS_OPCIONES.includes(segundos) ? null : { ...state, segundos };

/** The actor wants another word. */
export const saltarPalabra =
  (turno: number): Reducer<MimicaState> =>
  (state, { me }) =>
    state.fase !== 'preparado' || state.turno !== turno || me !== actor(state) ? null : { ...state, indice: state.indice + 1 };

export const empezar =
  (turno: number, modo: ModoMimica): Reducer<MimicaState> =>
  (state, { me, now }) =>
    state.fase !== 'preparado' || state.turno !== turno || me !== actor(state)
      ? null
      : { ...state, fase: 'actuando', modo, terminaEn: now + state.segundos * 1000, acertante: null };

/** `quien` guessed it: a point for them and for the actor. */
export const acertado =
  (turno: number, quien: string): Reducer<MimicaState> =>
  (state) =>
    state.fase !== 'actuando' || state.turno !== turno || quien === actor(state)
      ? null
      : { ...state, fase: 'resultado', acertante: quien, puntos: addPoints(state.puntos, [quien, actor(state)]) };

/** Time is up (or they gave up) and nobody guessed. */
export const nadie =
  (turno: number): Reducer<MimicaState> =>
  (state) =>
    state.fase !== 'actuando' || state.turno !== turno ? null : { ...state, fase: 'resultado', acertante: null };

export const siguienteTurno =
  (turno: number): Reducer<MimicaState> =>
  (state, { players }) => {
    if (state.fase !== 'resultado' || state.turno !== turno) return null;
    const next = nextInRotation(state.orden, state.turno, players);
    const fin = next === null || next >= state.orden.length * state.rondas;
    return fin
      ? { ...state, fase: 'final' }
      : { ...state, fase: 'preparado', turno: next, indice: state.indice + 1, modo: null, terminaEn: null, acertante: null };
  };

export const jugarOtraVez: Reducer<MimicaState> = (state, { players }) =>
  state.fase !== 'final' ? null : { ...mimicaInicial(state.mazo, ids(players), state.rondas), segundos: state.segundos };
