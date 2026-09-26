import { QuestionType } from './question.model';

export type RoomStatus = 'esperando' | 'jugando' | 'terminada';

/** Row returned by the `salas_abiertas` function. */
export interface OpenRoom {
  codigo: string;
  anfitrion: string | null;
  jugadores: number;
  tiene_password: boolean;
  created_at: string;
}

/** Row returned by the `info_sala` function. */
export interface RoomInfo {
  id: string;
  codigo: string;
  juego_id: number;
  juego: string;
  juego_clave: string | null;
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
export const PLAYABLE_GAMES = ['verdad_o_reto'];

export const ROOM_CODE_LENGTH = 6;
export const ROOM_PASSWORD_MIN_LENGTH = 4;
export const ROOM_PASSWORD_MAX_LENGTH = 50;
export const QUESTION_MIN_LENGTH = 3;
export const QUESTION_MAX_LENGTH = 300;
