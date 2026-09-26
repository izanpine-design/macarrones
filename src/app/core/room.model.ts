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

export const ROOM_CODE_LENGTH = 6;
export const ROOM_PASSWORD_MIN_LENGTH = 4;
export const ROOM_PASSWORD_MAX_LENGTH = 50;
