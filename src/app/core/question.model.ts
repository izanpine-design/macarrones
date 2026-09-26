/** Row of the `juegos` table. */
export interface Game {
  id: number;
  nombre: string;
}

/** Row of the `niveles` table. */
export interface Level {
  id: number;
  nombre: string;
  orden: number;
}

/** Values of the `tipo_pregunta` enum (only used in "Verdad o reto"). */
export type QuestionType = 'verdad' | 'reto';

/** Row of the `preguntas` table. */
export interface Question {
  id: number;
  texto: string;
  juego_id: number;
  nivel_id: number | null;
  tipo: QuestionType | null;
}
