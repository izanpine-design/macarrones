import { QuestionType } from './question.model';

export type RoomStatus = 'esperando' | 'jugando' | 'terminada';

/** Row returned by the `salas_abiertas` function. */
export interface OpenRoom {
  codigo: string;
  anfitrion: string | null;
  nivel: string;
  jugadores: number;
  tiene_password: boolean;
  created_at: string;
}

/** Question pack (row of `lotes`) with its question counts. */
export interface QuestionPack {
  id: number;
  nombre: string;
  total: number;
  verdades: number;
  retos: number;
}

/** Question to add to a pack. `tipo` is only used in "Verdad o reto". */
export interface NewQuestion {
  texto: string;
  tipo: QuestionType | null;
}

/** Row returned by the `info_sala` function. */
export interface RoomInfo {
  id: string;
  codigo: string;
  juego_id: number;
  juego: string;
  juego_clave: string | null;
  nivel_id: number;
  nivel: string;
  /** Question pack chosen by the host (null until they choose one). */
  lote_id: number | null;
  lote: string | null;
  lote_preguntas: number;
  anfitrion: string | null;
  jugadores: number;
  tiene_password: boolean;
  estado: RoomStatus;
  soy_miembro: boolean;
}

/** Row of the `jugadores_sala` table. */
export interface RoomPlayer {
  user_id: string;
  apodo: string;
  joined_at: string;
}

export type TurnPhase = 'eligiendo_tipo' | 'eligiendo_pregunta' | 'respondiendo';

/** Player snapshot stored in each turn (the names the roulettes spin over). */
export interface TurnPlayer {
  user_id: string;
  apodo: string;
}

/** Row of the `turnos` table: one turn of "Verdad o reto". */
export interface Turn {
  id: number;
  sala_id: string;
  numero: number;
  preguntador_id: string;
  objetivo_id: string;
  jugadores: TurnPlayer[];
  tipo: QuestionType | null;
  pregunta_texto: string | null;
  personalizada: boolean;
  fase: TurnPhase;
  created_at: string;
}

/** Games whose rooms can start a game (value of `juegos.clave`). */
export const PLAYABLE_GAMES = [
  'verdad_o_reto',
  'yo_nunca',
  'quien_es_mas_probable',
  'palabra_prohibida',
  'reglas_por_carta',
  'tu_kryptonita',
  'cuanto_me_conoces',
  'secretos_anonimos',
  'mimica_pictionary',
  'tier_list',
  'quien_dijo_que',
];

/** Games played without a question pack (their content comes from the players or the app). */
export const GAMES_WITHOUT_PACKS = ['reglas_por_carta', 'tu_kryptonita', 'secretos_anonimos', 'quien_dijo_que'];

/** Games whose pack has no categories: their rooms use "suave" without asking. */
export const GAMES_WITHOUT_LEVELS = [...GAMES_WITHOUT_PACKS, 'palabra_prohibida', 'mimica_pictionary'];

export const ROOM_CODE_LENGTH = 6;
export const ROOM_PASSWORD_MIN_LENGTH = 4;
export const ROOM_PASSWORD_MAX_LENGTH = 50;
export const QUESTION_MIN_LENGTH = 3;
export const QUESTION_MAX_LENGTH = 300;
export const PACK_NAME_MIN_LENGTH = 2;
export const PACK_NAME_MAX_LENGTH = 40;
/** Games whose questions are split into verdad / reto. */
export const GAMES_WITH_QUESTION_TYPE = ['verdad_o_reto'];
