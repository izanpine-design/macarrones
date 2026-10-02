/**
 * Deck of "Reglas por carta", in the spirit of "Rey" / "Ring of Fire".
 *   trago:   whoever draws it drinks
 *   reparte: whoever draws it chooses who drinks
 *   todos:   everybody drinks
 *   regla:   a rule that stays active until it is removed
 *   accion:  a quick game or challenge right now
 */
export type TipoCarta = 'trago' | 'reparte' | 'todos' | 'regla' | 'accion';

export interface Carta {
  tipo: TipoCarta;
  titulo: string;
  texto: string;
  /** For 'reparte': how many sips to hand out. */
  tragos?: number;
}

export const CARTAS: readonly Carta[] = [
  { tipo: 'trago', titulo: 'Para ti', texto: 'Quien ha sacado la carta bebe un trago.' },
  { tipo: 'trago', titulo: 'Doble ración', texto: 'Quien ha sacado la carta bebe dos tragos.' },
  { tipo: 'trago', titulo: 'Mala suerte', texto: 'Bebes un trago… y vuelves a sacar carta.' },
  { tipo: 'trago', titulo: 'El espejo', texto: 'Bebes tú y la persona que tengas enfrente.' },
  { tipo: 'trago', titulo: 'Vecinos', texto: 'Beben las personas sentadas a tu izquierda y a tu derecha.' },
  { tipo: 'reparte', titulo: 'Reparte uno', texto: 'Elige a alguien: bebe un trago.', tragos: 1 },
  { tipo: 'reparte', titulo: 'Reparte dos', texto: 'Reparte dos tragos entre quien quieras.', tragos: 2 },
  { tipo: 'reparte', titulo: 'Reparte tres', texto: 'Reparte tres tragos entre quien quieras.', tragos: 3 },
  { tipo: 'reparte', titulo: 'Compañero de copas', texto: 'Elige un compañero: cada vez que tú bebas, bebe también (hasta la próxima carta de este tipo).', tragos: 1 },
  { tipo: 'todos', titulo: '¡Salud!', texto: 'Beben todos un trago.' },
  { tipo: 'todos', titulo: 'Brindis', texto: 'Brindis por el grupo: todos beben y quien no choque el vaso, bebe otra vez.' },
  { tipo: 'todos', titulo: 'Los de tu equipo', texto: 'Beben todos los que lleven algo del mismo color que tú.' },
  { tipo: 'todos', titulo: 'Los que tengan móvil', texto: 'Bebe todo el que tenga el móvil en la mano ahora mismo.' },
  { tipo: 'accion', titulo: 'Cascada', texto: 'Empiezas a beber y no puedes parar hasta que pare quien está a tu derecha; así toda la ronda.' },
  { tipo: 'accion', titulo: 'Categorías', texto: 'Di una categoría (marcas de coches, pokémon…). Por turnos, cada uno dice algo de ella. Quien se quede en blanco o repita, bebe.' },
  { tipo: 'accion', titulo: 'Rima', texto: 'Di una palabra. Por turnos hay que decir otra que rime. Quien falle, bebe.' },
  { tipo: 'accion', titulo: 'Yo nunca', texto: 'Di un «yo nunca nunca…». Quien sí lo haya hecho, bebe.' },
  { tipo: 'accion', titulo: 'Señala', texto: 'A la de tres, todos señalan a quien tiene más pinta de acabar la noche cantando. El más señalado bebe.' },
  { tipo: 'accion', titulo: 'Piedra, papel o tijera', texto: 'Juega contra quien elijas. Quien pierda, bebe.' },
  { tipo: 'accion', titulo: 'El cuento', texto: 'Empieza una historia con una palabra; cada uno añade una. Quien se equivoque repitiendo la historia, bebe.' },
  { tipo: 'accion', titulo: 'Cara de póker', texto: 'Mira fijamente a alguien. El primero que se ría, bebe.' },
  { tipo: 'accion', titulo: 'Verdad rápida', texto: 'Cualquiera te hace una pregunta. Respondes o bebes dos tragos.' },
  { tipo: 'accion', titulo: 'Mímica exprés', texto: 'Representa una película sin hablar. Quien la adivine reparte un trago.' },
  { tipo: 'accion', titulo: 'Último en tocar el suelo', texto: 'Todos tocan el suelo. El último, bebe.' },
  { tipo: 'accion', titulo: 'Último con la mano en la cabeza', texto: 'Pon la mano en la cabeza disimuladamente. El último en darse cuenta e imitarte, bebe.' },
  { tipo: 'regla', titulo: 'Prohibido decir «beber»', texto: 'Nadie puede decir «beber» ni «bebe». Quien lo diga, bebe.' },
  { tipo: 'regla', titulo: 'Sin nombres', texto: 'Prohibido llamar a nadie por su nombre. Quien lo haga, bebe.' },
  { tipo: 'regla', titulo: 'Mano izquierda', texto: 'Solo se puede beber con la mano izquierda. Quien use la derecha, bebe otra vez.' },
  { tipo: 'regla', titulo: 'Maestro de preguntas', texto: 'Quien ha sacado la carta es el maestro: quien conteste a una pregunta suya, bebe.' },
  { tipo: 'regla', titulo: 'Pulgar', texto: 'Quien ha sacado la carta puede poner el pulgar en la mesa cuando quiera: el último en imitarle, bebe.' },
  { tipo: 'regla', titulo: 'Sin señalar', texto: 'Prohibido señalar con el dedo. Quien lo haga, bebe.' },
  { tipo: 'regla', titulo: 'Acento', texto: 'Todo el mundo habla con acento de otra región. Quien se olvide, bebe.' },
  { tipo: 'regla', titulo: 'Sin palabrotas', texto: 'Cada palabrota, un trago.' },
  { tipo: 'regla', titulo: 'Brindis obligatorio', texto: 'Antes de beber hay que decir «por los macarrones». Quien se olvide, bebe otra vez.' },
  { tipo: 'regla', titulo: 'El rey', texto: 'Quien ha sacado la carta inventa una regla nueva. Escríbela y que se cumpla.' },
  { tipo: 'regla', titulo: 'Tercera persona', texto: 'Todos hablan de sí mismos en tercera persona. Quien falle, bebe.' },
];
