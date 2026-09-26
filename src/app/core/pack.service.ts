import { inject, Service } from '@angular/core';
import { AuthService } from './auth.service';
import { NewQuestion, QuestionPack } from './room.model';
import { toRoomError } from './room.service';
import { SupabaseService } from './supabase.service';

/** Max questions per call to `anadir_preguntas` (the database accepts 500). */
const QUESTIONS_PER_REQUEST = 500;

/** Question packs (lotes) of a room. Writes are host only (checked by the database). */
@Service()
export class PackService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  /** Packs of a game and category, with their question counts. */
  async listPacks(gameId: number, levelId: number): Promise<QuestionPack[]> {
    const { data, error } = await this.supabase
      .from('lotes')
      .select('id, nombre, total:preguntas(count), verdades:preguntas(count), retos:preguntas(count)')
      .eq('juego_id', gameId)
      .eq('nivel_id', levelId)
      .eq('verdades.tipo', 'verdad')
      .eq('retos.tipo', 'reto')
      .order('nombre');
    if (error) throw toRoomError(error);

    type Row = { id: number; nombre: string } & Record<'total' | 'verdades' | 'retos', { count: number }[]>;
    return (data as Row[]).map((row) => ({
      id: row.id,
      nombre: row.nombre,
      total: row.total[0]?.count ?? 0,
      verdades: row.verdades[0]?.count ?? 0,
      retos: row.retos[0]?.count ?? 0,
    }));
  }

  choosePack(roomId: string, packId: number): Promise<void> {
    return this.call('elegir_lote', { p_sala_id: roomId, p_lote_id: packId });
  }

  /** Creates an empty pack for the room's game and category and selects it. */
  async createPack(roomId: string, name: string): Promise<number> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.rpc('crear_lote', { p_sala_id: roomId, p_nombre: name });
    if (error) throw toRoomError(error);
    return data as number;
  }

  /** Adds questions to the room's selected pack. Returns how many were new. */
  async addQuestions(roomId: string, questions: NewQuestion[]): Promise<number> {
    await this.auth.ensureSignedIn();
    let added = 0;
    for (let i = 0; i < questions.length; i += QUESTIONS_PER_REQUEST) {
      const { data, error } = await this.supabase.rpc('anadir_preguntas', {
        p_sala_id: roomId,
        p_preguntas: questions.slice(i, i + QUESTIONS_PER_REQUEST),
      });
      if (error) throw toRoomError(error);
      added += data as number;
    }
    return added;
  }

  private async call(fn: string, args: Record<string, unknown>): Promise<void> {
    await this.auth.ensureSignedIn();
    const { error } = await this.supabase.rpc(fn, args);
    if (error) throw toRoomError(error);
  }
}
