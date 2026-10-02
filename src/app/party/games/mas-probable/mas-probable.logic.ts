import { Reducer } from '../../party.model';
import { deckItem, everyoneDid, mostVoted, shuffle } from '../shared.logic';

/**
 * "¿Quién es más probable?": everyone votes at the same time who fits the
 * situation; the votes are shown when everybody has voted (or someone reveals)
 * and the most voted drinks.
 */
export interface MasProbableState {
  fase: 'votando' | 'resultado';
  mazo: string[];
  indice: number;
  /** voter → voted. */
  votos: Record<string, string>;
}

export function masProbableInicial(items: readonly string[]): MasProbableState {
  return { fase: 'votando', mazo: shuffle(items), indice: 0, votos: {} };
}

export function situacionActual(state: MasProbableState): string | null {
  return deckItem(state.mazo, state.indice);
}

export const votar =
  (indice: number, votado: string): Reducer<MasProbableState> =>
  (state, { me, players }) => {
    if (state.indice !== indice || state.fase !== 'votando') return null;
    if (!players.some((p) => p.user_id === votado)) return null;
    const votos = { ...state.votos, [me]: votado };
    return { ...state, votos, fase: everyoneDid(votos, players) ? 'resultado' : 'votando' };
  };

export const revelar =
  (indice: number): Reducer<MasProbableState> =>
  (state) =>
    state.indice !== indice || state.fase !== 'votando' || Object.keys(state.votos).length === 0
      ? null
      : { ...state, fase: 'resultado' };

export const siguiente =
  (indice: number): Reducer<MasProbableState> =>
  (state) =>
    state.indice !== indice ? null : { ...state, fase: 'votando', indice: state.indice + 1, votos: {} };

/** Who drinks: the most voted (everyone tied at the top). */
export function quienesBeben(state: MasProbableState): string[] {
  return state.fase === 'resultado' ? mostVoted(state.votos) : [];
}
