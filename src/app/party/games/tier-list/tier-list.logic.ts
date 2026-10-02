import { PartyPlayer, Reducer } from '../../party.model';
import { deckItem, everyoneDid, ids, shuffle } from '../shared.logic';

/**
 * "Tier list de amigos": a category comes up ("el más tacaño"…) and each
 * player orders everyone in the room from most to least. The result is the
 * group's average order, with each person's list to argue about it.
 */
export interface TierListState {
  fase: 'ordenando' | 'resultado';
  mazo: string[];
  indice: number;
  /** player → user ids from first (the most) to last. */
  rankings: Record<string, string[]>;
}

export function tierListInicial(items: readonly string[]): TierListState {
  return { fase: 'ordenando', mazo: shuffle(items), indice: 0, rankings: {} };
}

export function categoriaActual(state: TierListState): string | null {
  return deckItem(state.mazo, state.indice);
}

export const enviarOrden =
  (indice: number, orden: readonly string[]): Reducer<TierListState> =>
  (state, { me, players }) => {
    if (state.fase !== 'ordenando' || state.indice !== indice) return null;
    // Exactly the players in the room, each once.
    const enSala = new Set(ids(players));
    if (orden.length !== enSala.size || new Set(orden).size !== orden.length || !orden.every((id) => enSala.has(id))) return null;
    const rankings = { ...state.rankings, [me]: [...orden] };
    return { ...state, rankings, fase: everyoneDid(rankings, players) ? 'resultado' : 'ordenando' };
  };

export const revelar =
  (indice: number): Reducer<TierListState> =>
  (state) =>
    state.fase !== 'ordenando' || state.indice !== indice || Object.keys(state.rankings).length === 0
      ? null
      : { ...state, fase: 'resultado' };

export const siguiente =
  (indice: number): Reducer<TierListState> =>
  (state) =>
    state.indice !== indice ? null : { ...state, fase: 'ordenando', indice: state.indice + 1, rankings: {} };

/**
 * The group's order: average position of each player over every list (1 = the
 * most). Players missing from a list (joined later) are left out of it.
 */
export function ordenDelGrupo(state: TierListState, players: readonly PartyPlayer[]): { userId: string; media: number }[] {
  const listas = Object.values(state.rankings);
  return players
    .map((p) => {
      const posiciones = listas.map((l) => l.indexOf(p.user_id)).filter((i) => i >= 0);
      const media = posiciones.length ? posiciones.reduce((a, b) => a + b + 1, 0) / posiciones.length : Infinity;
      return { userId: p.user_id, media };
    })
    .filter((r) => Number.isFinite(r.media))
    .sort((a, b) => a.media - b.media);
}
