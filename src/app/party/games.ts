import { adivinanzaInicial } from './games/adivinanza/adivinanza.logic';
import { cuantoMeConocesInicial } from './games/cuanto-me-conoces/cuanto-me-conoces.logic';
import { kryptonitaInicial } from './games/kryptonita/kryptonita.logic';
import { masProbableInicial } from './games/mas-probable/mas-probable.logic';
import { mimicaInicial } from './games/mimica/mimica.logic';
import { palabraProhibidaInicial } from './games/palabra-prohibida/palabra-prohibida.logic';
import { reglasCartaInicial } from './games/reglas-carta/reglas-carta.logic';
import { tierListInicial } from './games/tier-list/tier-list.logic';
import { yoNuncaInicial } from './games/yo-nunca/yo-nunca.logic';

/** What a party game needs to start, and its initial state. */
export interface PartyGameDef {
  /** Plays with the texts of a question pack chosen in the lobby. */
  usaLote: boolean;
  minJugadores: number;
  /** Texts the pack needs (when usaLote). */
  minItems: number;
  inicial(items: readonly string[], jugadores: readonly string[]): object;
}

/** Every game except "Verdad o reto", by `juegos.clave`. */
export const PARTY_GAMES: Readonly<Record<string, PartyGameDef>> = {
  yo_nunca: { usaLote: true, minJugadores: 2, minItems: 1, inicial: (items) => yoNuncaInicial(items) },
  quien_es_mas_probable: { usaLote: true, minJugadores: 2, minItems: 1, inicial: (items) => masProbableInicial(items) },
  palabra_prohibida: { usaLote: true, minJugadores: 2, minItems: 2, inicial: (items) => palabraProhibidaInicial(items) },
  reglas_por_carta: { usaLote: false, minJugadores: 2, minItems: 0, inicial: () => reglasCartaInicial() },
  tu_kryptonita: { usaLote: false, minJugadores: 2, minItems: 0, inicial: () => kryptonitaInicial() },
  cuanto_me_conoces: {
    usaLote: true,
    minJugadores: 2,
    minItems: 1,
    inicial: (items, jugadores) => cuantoMeConocesInicial(items, jugadores),
  },
  secretos_anonimos: { usaLote: false, minJugadores: 3, minItems: 0, inicial: () => adivinanzaInicial() },
  mimica_pictionary: { usaLote: true, minJugadores: 2, minItems: 1, inicial: (items, jugadores) => mimicaInicial(items, jugadores) },
  tier_list: { usaLote: true, minJugadores: 2, minItems: 1, inicial: (items) => tierListInicial(items) },
  quien_dijo_que: { usaLote: false, minJugadores: 3, minItems: 0, inicial: () => adivinanzaInicial() },
};
