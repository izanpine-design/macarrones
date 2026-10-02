import { Reducer } from '../../party.model';
import { clampText, shuffle } from '../shared.logic';
import { CARTAS } from './cartas';

/**
 * "Reglas por carta": anyone draws a card; each one is a sip, a quick game or a
 * rule that stays active (up to MAX_REGLAS, the oldest goes away). Meant to be
 * played in the background while talking.
 */
export interface ReglaActiva {
  id: number;
  texto: string;
  por: string;
}

export interface ReglasCartaState {
  fase: 'jugando';
  /** Card indexes of CARTAS, shuffled; reshuffled when exhausted. */
  mazo: number[];
  indice: number;
  /** The last card drawn and who drew it. */
  actual: { carta: number; por: string } | null;
  sacadas: number;
  reglas: ReglaActiva[];
  siguienteId: number;
}

export const MAX_REGLAS = 4;

export function reglasCartaInicial(): ReglasCartaState {
  return { fase: 'jugando', mazo: nuevoMazo(), indice: 0, actual: null, sacadas: 0, reglas: [], siguienteId: 1 };
}

function nuevoMazo(): number[] {
  return shuffle(CARTAS.map((_, i) => i));
}

export const sacarCarta =
  (sacadas: number): Reducer<ReglasCartaState> =>
  (state, { me }) => {
    if (state.sacadas !== sacadas) return null;
    let { mazo, indice } = state;
    if (indice >= mazo.length) {
      mazo = nuevoMazo();
      indice = 0;
    }
    const carta = mazo[indice];
    let { reglas, siguienteId } = state;
    // "El rey" asks to write a rule: it is added from the screen instead.
    if (CARTAS[carta].tipo === 'regla' && CARTAS[carta].titulo !== 'El rey') {
      reglas = [...reglas, { id: siguienteId, texto: `${CARTAS[carta].titulo}: ${CARTAS[carta].texto}`, por: me }].slice(-MAX_REGLAS);
      siguienteId++;
    }
    return { ...state, mazo, indice: indice + 1, actual: { carta, por: me }, sacadas: sacadas + 1, reglas, siguienteId };
  };

/** A rule written by the players ("El rey"). */
export const anadirRegla =
  (texto: string): Reducer<ReglasCartaState> =>
  (state, { me }) => {
    const regla = clampText(texto, 140);
    if (regla.length < 3) return null;
    return {
      ...state,
      reglas: [...state.reglas, { id: state.siguienteId, texto: regla, por: me }].slice(-MAX_REGLAS),
      siguienteId: state.siguienteId + 1,
    };
  };

export const quitarRegla =
  (id: number): Reducer<ReglasCartaState> =>
  (state) =>
    state.reglas.some((r) => r.id === id) ? { ...state, reglas: state.reglas.filter((r) => r.id !== id) } : null;
