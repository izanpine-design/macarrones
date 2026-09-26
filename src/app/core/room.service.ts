import { inject, Service } from '@angular/core';
import { AuthService } from './auth.service';
import { PlayerService } from './player.service';
import { SupabaseService } from './supabase.service';
import { OpenRoom, RoomInfo, RoomPlayer } from './room.model';

/** Error codes raised by the room and game functions in supabase/salas.sql. */
export type RoomErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_NICKNAME'
  | 'INVALID_PASSWORD'
  | 'GAME_NOT_FOUND'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'GAME_NOT_SUPPORTED'
  | 'GAME_NOT_STARTED'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_YOUR_TURN'
  | 'NO_QUESTIONS'
  | 'INVALID_QUESTION'
  | 'INVALID_QUESTION_TYPE'
  | 'LEVEL_NOT_FOUND'
  | 'LOT_NOT_FOUND'
  | 'INVALID_LOT_NAME'
  | 'LOT_NAME_TAKEN'
  | 'NO_LOT_SELECTED'
  | 'UNKNOWN';

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  NOT_AUTHENTICATED: 'No se ha podido identificar tu dispositivo. Recarga la página.',
  INVALID_NICKNAME: 'Tu apodo no es válido. Cámbialo e inténtalo de nuevo.',
  INVALID_PASSWORD: 'La contraseña debe tener entre 4 y 50 caracteres.',
  GAME_NOT_FOUND: 'Este juego no existe.',
  ROOM_NOT_FOUND: 'No existe ninguna sala con ese código.',
  ROOM_CLOSED: 'Esta sala ya ha terminado.',
  PASSWORD_REQUIRED: 'Esta sala tiene contraseña.',
  WRONG_PASSWORD: 'Contraseña incorrecta.',
  NOT_HOST: 'Solo el anfitrión puede hacer esto.',
  WRONG_PHASE: 'Esto ya no se puede hacer en este momento de la partida.',
  GAME_NOT_SUPPORTED: 'Este juego todavía no se puede jugar.',
  GAME_NOT_STARTED: 'La partida no ha empezado.',
  NOT_ENOUGH_PLAYERS: 'Hacen falta al menos 2 jugadores.',
  NOT_YOUR_TURN: 'No es tu turno.',
  NO_QUESTIONS: 'No hay preguntas de este tipo. Escríbela tú.',
  INVALID_QUESTION: 'La pregunta debe tener entre 3 y 300 caracteres.',
  INVALID_QUESTION_TYPE: 'Cada pregunta tiene que ser "verdad" o "reto".',
  LEVEL_NOT_FOUND: 'Esa categoría no existe.',
  LOT_NOT_FOUND: 'Ese lote no existe o no es de esta categoría.',
  INVALID_LOT_NAME: 'El nombre del lote debe tener entre 2 y 40 caracteres.',
  LOT_NAME_TAKEN: 'Ya hay un lote con ese nombre en esta categoría.',
  NO_LOT_SELECTED: 'Elige primero un lote de preguntas.',
  UNKNOWN: 'Ha ocurrido un error inesperado.',
};

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    detail?: string,
  ) {
    super(code === 'UNKNOWN' && detail ? detail : ERROR_MESSAGES[code]);
  }
}

export function toRoomError(error: { message: string }): RoomError {
  const code = error.message in ERROR_MESSAGES ? (error.message as RoomErrorCode) : 'UNKNOWN';
  return new RoomError(code, error.message);
}

/** User-facing message for any error thrown while working with rooms. */
export function roomErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Service()
export class RoomService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);

  /** Creates a room of a game and category, with the caller as host. Returns its code. */
  async createRoom(gameId: number, levelId: number, password: string | null): Promise<string> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.rpc('crear_sala', {
      p_juego_id: gameId,
      p_nivel_id: levelId,
      p_apodo: this.player.nickname(),
      p_password: password,
    });
    if (error) throw toRoomError(error);
    return data as string;
  }

  async joinRoom(code: string, password: string | null): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc('unirse_sala', {
      p_codigo: code,
      p_apodo: this.player.nickname(),
      p_password: password,
    });
    if (error) throw toRoomError(error);
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc('salir_sala', { p_sala_id: roomId });
    if (error) throw toRoomError(error);
  }

  async listOpenRooms(gameId: number): Promise<OpenRoom[]> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.rpc('salas_abiertas', { p_juego_id: gameId });
    if (error) throw toRoomError(error);
    return data as OpenRoom[];
  }

  /** Public summary of a room, or null if the code does not exist. */
  async getRoomInfo(code: string): Promise<RoomInfo | null> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.rpc('info_sala', { p_codigo: code });
    if (error) throw toRoomError(error);
    return (data as RoomInfo[])[0] ?? null;
  }

  /** Players and current host of a room the caller belongs to. */
  async getLobby(roomId: string): Promise<{ hostId: string | null; players: RoomPlayer[] }> {
    await this.auth.ensureSignedIn();
    const [room, players] = await Promise.all([
      this.supabase.from('salas').select('anfitrion_id').eq('id', roomId).maybeSingle(),
      this.supabase
        .from('jugadores_sala')
        .select('user_id, apodo, joined_at')
        .eq('sala_id', roomId)
        .order('joined_at'),
    ]);
    if (room.error) throw toRoomError(room.error);
    if (players.error) throw toRoomError(players.error);
    return {
      hostId: (room.data as { anfitrion_id: string } | null)?.anfitrion_id ?? null,
      players: players.data as RoomPlayer[],
    };
  }

  /** Host only: starts the game (2+ players). */
  async startGame(roomId: string): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc('empezar_partida', { p_sala_id: roomId });
    if (error) throw toRoomError(error);
  }

  /** Host only: ends the game and goes back to the waiting lobby. */
  async endGame(roomId: string): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc('terminar_partida', { p_sala_id: roomId });
    if (error) throw toRoomError(error);
  }

  /**
   * Calls `onChange` whenever the room, its players or its turns change
   * (Supabase Realtime). Returns a function that stops listening.
   */
  watchRoom(roomId: string, onChange: () => void): () => void {
    const channel = this.supabase
      .channel(`sala:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores_sala' }, (payload) => {
        // DELETE events only carry the primary key (sala_id, user_id), in `old`.
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { sala_id?: string };
        if (row.sala_id === roomId) onChange();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salas', filter: `id=eq.${roomId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos', filter: `sala_id=eq.${roomId}` },
        () => onChange(),
      )
      .subscribe();

    return () => void this.supabase.removeChannel(channel);
  }
}
