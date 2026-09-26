import { inject, Service } from '@angular/core';
import { AuthService } from './auth.service';
import { QuestionType } from './question.model';
import { Turn } from './room.model';
import { toRoomError } from './room.service';
import { SupabaseService } from './supabase.service';

/** Actions of a "Verdad o reto" turn. The database checks whose turn it is. */
@Service()
export class TurnService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  /** Current (latest) turn of a room, or null if no game is being played. */
  async getCurrentTurn(roomId: string): Promise<Turn | null> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase
      .from('turnos')
      .select('id, sala_id, numero, preguntador_id, objetivo_id, jugadores, tipo, pregunta_texto, personalizada, fase, created_at')
      .eq('sala_id', roomId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw toRoomError(error);
    return data as Turn | null;
  }

  /** Target of the turn: chooses verdad or reto. */
  chooseType(roomId: string, type: QuestionType): Promise<void> {
    return this.call('elegir_tipo', { p_sala_id: roomId, p_tipo: type });
  }

  /** Asker: takes a random question of the chosen type from the database. */
  pickRandomQuestion(roomId: string): Promise<void> {
    return this.call('elegir_pregunta_aleatoria', { p_sala_id: roomId });
  }

  /** Asker: writes their own question or dare. */
  writeQuestion(roomId: string, text: string): Promise<void> {
    return this.call('escribir_pregunta', { p_sala_id: roomId, p_texto: text });
  }

  /** Asker (once the question is shown) or host (any time): starts the next turn. */
  nextTurn(roomId: string): Promise<void> {
    return this.call('siguiente_turno', { p_sala_id: roomId });
  }

  private async call(fn: string, args: Record<string, unknown>): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc(fn, args);
    if (error) throw toRoomError(error);
  }
}
