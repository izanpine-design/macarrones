import { inject, Service } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Game, Level } from './question.model';

/** Game with the number of questions it has in `preguntas`. */
export interface GameSummary extends Game {
  questionCount: number;
}

@Service()
export class GameService {
  private readonly supabase = inject(SupabaseService).client;

  /** All rows of `juegos`, in catalog order, with their question count. */
  async getGames(): Promise<GameSummary[]> {
    const { data, error } = await this.supabase
      .from('juegos')
      .select('id, clave, nombre, descripcion, con_alcohol, orden, preguntas(count)')
      .order('orden')
      .order('id');

    if (error) {
      throw new Error(error.message);
    }

    return (data as (Game & { preguntas: { count: number }[] })[]).map(({ preguntas, ...game }) => ({
      ...game,
      questionCount: preguntas[0]?.count ?? 0,
    }));
  }

  /** Question categories (`niveles`), in their display order. */
  async getLevels(): Promise<Level[]> {
    const { data, error } = await this.supabase.from('niveles').select('id, nombre, orden').order('orden');

    if (error) {
      throw new Error(error.message);
    }

    return data as Level[];
  }

  /** A single game by id, or null if it does not exist. */
  async getGame(id: number): Promise<Game | null> {
    const { data, error } = await this.supabase
      .from('juegos')
      .select('id, clave, nombre, descripcion, con_alcohol, orden')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as Game | null;
  }
}
