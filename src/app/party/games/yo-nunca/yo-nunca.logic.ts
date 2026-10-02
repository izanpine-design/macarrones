import { Reducer } from '../../party.model';
import { clampText, deckItem, shuffle } from '../shared.logic';

/**
 * "Yo nunca nunca": a phrase at a time; whoever HAS done it taps "Yo sí" and
 * drinks. Anyone moves on to the next phrase or slips in one of their own.
 */
export interface YoNuncaState {
  fase: 'jugando';
  mazo: string[];
  indice: number;
  /** Players who have done the current phrase. */
  yoSi: Record<string, true>;
}

const PREFIX = 'Yo nunca nunca';

export function yoNuncaInicial(items: readonly string[]): YoNuncaState {
  return { fase: 'jugando', mazo: shuffle(items), indice: 0, yoSi: {} };
}

export function fraseActual(state: YoNuncaState): string | null {
  return deckItem(state.mazo, state.indice);
}

/** "Yo sí" / undo, for the current phrase. */
export const toggleYoSi =
  (indice: number): Reducer<YoNuncaState> =>
  (state, { me }) => {
    if (state.indice !== indice) return null;
    const yoSi = { ...state.yoSi };
    if (yoSi[me]) delete yoSi[me];
    else yoSi[me] = true;
    return { ...state, yoSi };
  };

export const siguienteFrase =
  (indice: number): Reducer<YoNuncaState> =>
  (state) =>
    state.indice !== indice ? null : { ...state, indice: state.indice + 1, yoSi: {} };

/** A phrase of your own, played right after the current one. */
export const anadirFrase =
  (texto: string): Reducer<YoNuncaState> =>
  (state) => {
    const frase = normalizeFrase(texto);
    if (!frase) return null;
    const mazo = [...state.mazo];
    // Next position on the current lap of the deck.
    mazo.splice((state.indice % Math.max(mazo.length, 1)) + 1, 0, frase);
    return { ...state, mazo };
  };

/** "Yo nunca he…" → "Yo nunca nunca he…", and the final full stop. */
export function normalizeFrase(texto: string): string | null {
  let frase = clampText(texto, 200);
  if (frase.length < 4) return null;
  frase = frase.replace(/^yo\s+nunca(\s+nunca)?\s*/i, '');
  frase = `${PREFIX} ${frase.charAt(0).toLowerCase()}${frase.slice(1)}`;
  return /[.!?…]$/.test(frase) ? frase : `${frase}.`;
}
