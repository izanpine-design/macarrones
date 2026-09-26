export type Game = 'yo_nunca' | 'verdad' | 'reto';

/** Row of the `preguntas` table. */
export interface Question {
  id: number;
  texto: string;
  juego: Game;
  nivel: string | null;
}
