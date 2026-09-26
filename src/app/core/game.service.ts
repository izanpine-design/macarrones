import { inject, Service } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Game } from './question.model';

/** Game with the number of questions it has in `preguntas`. */
export interface GameSummary extends Game {
  questionCount: number;
}

@Service()
export class GameService {
  private readonly supabase = inject(SupabaseService).client;

  /** All rows of `juegos`, ordered by id, with their question count. */
  async getGames(): Promise<GameSummary[]> {
    const { data, error } = await this.supabase
      .from('juegos')
      .select('id, nombre, preguntas(count)')
      .order('id');

    if (error) {
      throw new Error(error.message);
    }

    return (data as (Game & { preguntas: { count: number }[] })[]).map(({ preguntas, ...game }) => ({
      ...game,
      questionCount: preguntas[0]?.count ?? 0,
    }));
  }
}
