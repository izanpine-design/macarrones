/** How the page animates when entering (and, reversed, leaving) a game. */
export type TransitionStyle =
  | 'fill'
  | 'iris'
  | 'spin'
  | 'blinds'
  | 'flip'
  | 'glitch'
  | 'pop'
  | 'curtain'
  | 'wipe'
  | 'stack'
  | 'bubble'
  | 'warp';

/** Each game is its own planet inside the space-and-pasta universe. */
export interface GameTheme {
  /** Value of `juegos.clave`. */
  clave: string;
  planeta: string;
  lema: string;
  icono: string;
  /** Little things floating in the background. */
  props: readonly string[];
  /** Strong colour: buttons, links, eyebrows. Keeps AA contrast with white and on `soft`. */
  accent: string;
  /** Page background tint. */
  soft: string;
  glow: string;
  /** Planet gradient: light side, dark side. */
  planet: readonly [string, string];
  ring: boolean;
  transition: TransitionStyle;
}

export const GAME_THEMES: readonly GameTheme[] = [
  {
    clave: 'yo_nunca',
    planeta: 'Bar Orbital',
    lema: 'Aquí se confiesa con un chupito en la mano',
    icono: '🍹',
    props: ['🍸', '🥃', '🫧', '🍋', '🧊'],
    accent: '#0f766e',
    soft: '#ecfdf8',
    glow: '#5eead4',
    planet: ['#99f6e4', '#0d9488'],
    ring: true,
    transition: 'fill',
  },
  {
    clave: 'quien_es_mas_probable',
    planeta: 'Planeta Dedo Acusador',
    lema: 'Todos los dedos apuntan a alguien',
    icono: '👉',
    props: ['👈', '👆', '🔦', '🕵️', '❓'],
    accent: '#4338ca',
    soft: '#eef2ff',
    glow: '#fde047',
    planet: ['#fde68a', '#6366f1'],
    ring: false,
    transition: 'iris',
  },
  {
    clave: 'verdad_o_reto',
    planeta: 'Casino Nebulosa',
    lema: 'La ruleta decide tu destino',
    icono: '🎰',
    props: ['🎲', '♠️', '🎯', '💋', '🔥'],
    accent: '#b3122e',
    soft: '#fff1f2',
    glow: '#fb7185',
    planet: ['#fecaca', '#be123c'],
    ring: true,
    transition: 'spin',
  },
  {
    clave: 'palabra_prohibida',
    planeta: 'Planeta Silencio',
    lema: 'Una palabra de más y… glup',
    icono: '🤐',
    props: ['🚫', '🔇', '🤫', '📛', '💬'],
    accent: '#3f3f46',
    soft: '#fafaf0',
    glow: '#facc15',
    planet: ['#fef08a', '#52525b'],
    ring: false,
    transition: 'blinds',
  },
  {
    clave: 'reglas_por_carta',
    planeta: 'Estación Baraja',
    lema: 'Cada carta, una regla nueva',
    icono: '🃏',
    props: ['♥️', '♣️', '♦️', '♠️', '👑'],
    accent: '#9f1239',
    soft: '#fff7ed',
    glow: '#fbbf24',
    planet: ['#fde68a', '#b91c1c'],
    ring: true,
    transition: 'flip',
  },
  {
    clave: 'tu_kryptonita',
    planeta: 'Planeta Radiactivo',
    lema: 'Todos tenemos un punto débil',
    icono: '☢️',
    props: ['💚', '🧪', '⚡', '🦸', '💀'],
    accent: '#15803d',
    soft: '#f0fdf4',
    glow: '#4ade80',
    planet: ['#bbf7d0', '#16a34a'],
    ring: false,
    transition: 'glitch',
  },
  {
    clave: 'cuanto_me_conoces',
    planeta: 'Observatorio Íntimo',
    lema: 'A ver quién te conoce de verdad',
    icono: '🔭',
    props: ['🔍', '🧠', '💭', '⭐', '📸'],
    accent: '#6d28d9',
    soft: '#f5f3ff',
    glow: '#c4b5fd',
    planet: ['#ddd6fe', '#7c3aed'],
    ring: true,
    transition: 'pop',
  },
  {
    clave: 'secretos_anonimos',
    planeta: 'Nebulosa Susurro',
    lema: 'Lo que pasa aquí, se queda aquí',
    icono: '🤫',
    props: ['✉️', '🔒', '🎭', '🗝️', '👀'],
    accent: '#6b21a8',
    soft: '#faf5ff',
    glow: '#e879f9',
    planet: ['#f5d0fe', '#86198f'],
    ring: false,
    transition: 'curtain',
  },
  {
    clave: 'mimica_pictionary',
    planeta: 'Planeta Garabato',
    lema: 'Sin palabras: dibuja o actúa',
    icono: '🎨',
    props: ['✏️', '🖍️', '🎭', '🖌️', '💡'],
    accent: '#c2410c',
    soft: '#fff7ed',
    glow: '#38bdf8',
    planet: ['#fed7aa', '#ea580c'],
    ring: true,
    transition: 'wipe',
  },
  {
    clave: 'tier_list',
    planeta: 'Podio Galáctico',
    lema: 'Del S al F, sin piedad',
    icono: '🏆',
    props: ['🥇', '🥈', '🥉', '📊', '👑'],
    accent: '#a16207',
    soft: '#fefce8',
    glow: '#facc15',
    planet: ['#fef08a', '#ca8a04'],
    ring: true,
    transition: 'stack',
  },
  {
    clave: 'quien_dijo_que',
    planeta: 'Planeta Eco',
    lema: 'Tus frases te persiguen',
    icono: '💬',
    props: ['🗨️', '📢', '🦜', '🎙️', '❗'],
    accent: '#0369a1',
    soft: '#f0f9ff',
    glow: '#7dd3fc',
    planet: ['#bae6fd', '#0284c7'],
    ring: false,
    transition: 'bubble',
  },
];

const BY_KEY = new Map(GAME_THEMES.map((theme) => [theme.clave, theme]));

export function themeFor(clave: string | null | undefined): GameTheme | null {
  return (clave && BY_KEY.get(clave)) || null;
}

/** CSS variables of every theme, keyed by `[data-game]` (on <html> and on menu cards). */
export function themeCss(): string {
  return GAME_THEMES.map(
    (t) =>
      `[data-game="${t.clave}"]{--game-accent:${t.accent};--game-soft:${t.soft};--game-glow:${t.glow};` +
      `--game-planet-a:${t.planet[0]};--game-planet-b:${t.planet[1]};--game-icon:"${t.icono}";}`,
  ).join('\n');
}
