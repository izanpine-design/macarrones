/**
 * Hand-made pixel art. Each frame is a list of equal-length rows; every
 * character is a palette key and '.' is transparent.
 */
export type PixelFrame = readonly string[];
export type PixelPalette = Readonly<Record<string, string>>;

export type PetPose = 'stand' | 'blink' | 'wag' | 'walkB' | 'walkC' | 'sleep';
export type PetFrames = Readonly<Record<PetPose, PixelFrame>>;

/* ---------- Cat (side body, head turned to the viewer, facing right) ----------
 * k outline · e ear · i inner ear · h head top · z forehead blaze · m eye mask
 * y eye · n nose · f muzzle · x "moustache" under the nose · b back · t tail
 * c chest/belly · l leg · p paw
 */
const CAT_STAND: PixelFrame = [
  '.............k.......k..',
  '.............kk.....kk..',
  '.............kik...kik..',
  '.k...........kehkkkhek..',
  'ktk.........khhhhzhhhhk.',
  'ktk.........kmyymzmyymk.',
  'ktkkkkkkkkkkkmmmfnfmmmk.',
  'ktkbbbbbbbbbkmffxxxffmk.',
  '.ktbbbbbbbbbbkfffffffk..',
  '.kbbbbbbbbbccckkkkkkk...',
  '.kbbbbbbbbccccck........',
  '.kbbbbbbccccccck........',
  '.kccccccccccccck........',
  '..kllkkkkkkkllkk........',
  '..kllk.....kllk.........',
  '..kppk.....kppk.........',
  '..kkkk.....kkkk.........',
];

const CAT_TAIL_WAG: Record<number, string> = {
  3: '..k..........kehkkkhek..',
  4: '.ktk........khhhhzhhhhk.',
  5: '.ktk........kmyymzmyymk.',
  6: '.ktkkkkkkkkkkmmmfnfmmmk.',
  7: '.ktbbbbbbbbbkmffxxxffmk.',
};

const CAT_WALK_B: Record<number, string> = {
  14: '.kllk.......kllk........',
  15: 'kppk.........kppk.......',
  16: 'kkkk.........kkkk.......',
};

const CAT_WALK_C: Record<number, string> = {
  14: '...kllk...kllk..........',
  15: '....kppk.kppk...........',
  16: '....kkkk.kkkk...........',
};

/* ---------- Dog: long-haired chihuahua (Pichu) ----------
 * k outline · e ear fur · h head · t tan (eyebrows, legs) · y eye · w eye glint · n nose
 * c cream muzzle/chest · r tongue · b chocolate body/tail · p paw
 */
const DOG_STAND: PixelFrame = [
  '...........k...........k',
  '...........kek.......kek',
  '............kek.....kek.',
  '.kk.........keekkkkkeek.',
  'kbbk.........khhhhhhhk..',
  'kbbk........khthhhhhthk.',
  '.kbkkkkkkkkkkhywhhhywhk.',
  '.kbbbbbbbbbbkhhccncchhk.',
  '..kbbbbbbbbbbkccccccck..',
  '..kbbbbbbbcccckkkrkkk...',
  '..kbbbbbbccccccckrk.....',
  '..kbbbbbcccccccckk......',
  '..kbbbbccccccccck.......',
  '...kttkkkkkkkttkk.......',
  '...kttk.....kttk........',
  '...kppk.....kppk........',
  '...kkkk.....kkkk........',
];

const DOG_TAIL_WAG: Record<number, string> = {
  3: '..kk........keekkkkkeek.',
  4: '.kbbk........khhhhhhhk..',
  5: '.kbbk.......khthhhhhthk.',
};

const DOG_WALK_B: Record<number, string> = {
  14: '..kttk.......kttk.......',
  15: '.kppk.........kppk......',
  16: '.kkkk.........kkkk......',
};

const DOG_WALK_C: Record<number, string> = {
  14: '....kttk...kttk.........',
  15: '.....kppk.kppk..........',
  16: '.....kkkk.kkkk..........',
};

/* ---------- Extras ---------- */

/** Mirrors a left half into a symmetric row. */
function mirror(left: string): string {
  return left + [...left].reverse().join('');
}

/**
 * Gloved hand showing the middle finger, other fingers folded.
 * w glove · g glove shadow · c sleeve cuff (crew colour) · d cuff shadow.
 */
export const MIDDLE_FINGER: PixelFrame = [
  '.....kkk......',
  '....kwwwk.....',
  '....kwwgk.....',
  '....kwwgk.....',
  '....kwwgk.....',
  '....kwwgk.....',
  '..kkkwwgkkkk..',
  '.kwwkwwgkwwgk.',
  '.kwwkwwgkwwgk.',
  'kwwwwwwwwwwgk.',
  'kwkkwwwwwwwgk.',
  '.kwwwkwwwwwgk.',
  '.kwwwwwwwwwgk.',
  '..kwwwwwwwggk.',
  '..kkkkkkkkkkk.',
  '..kccccccccdk.',
  '..kccccccccdk.',
  '..kkkkkkkkkkk.',
];

/**
 * Parachute with alternating gores; the pet hangs where the strings meet.
 * c canopy (crew colour) · w white gore · d underside shade · g white gore shade · s strings.
 */
export const PARACHUTE: PixelFrame = [
  mirror('......kkkk'),
  mirror('....kkcccw'),
  mirror('...kccccww'),
  mirror('..kcccccww'),
  mirror('.kccccccww'),
  mirror('kcccccccww'),
  mirror('kdddddddgg'),
  'kk.kk.kk.kk.kk.kk.kk',
  mirror('.s....s...'),
  mirror('..s....s..'),
  mirror('....s...s.'),
  mirror('......s.s.'),
  mirror('........ss'),
];

/* ---------- Frame builders ---------- */

function patch(base: PixelFrame, rows: Record<number, string>): PixelFrame {
  return base.map((row, i) => rows[i] ?? row);
}

function closeEyes(frame: PixelFrame): PixelFrame {
  return frame.map((row) => row.replace(/[yw]/g, 'k'));
}

/** Lying down: body lowered 3 rows, no legs, eyes closed, tail tucked. */
function sleeping(stand: PixelFrame, tailRows: Record<number, string>, bottom: string): PixelFrame {
  const width = stand[0].length;
  const body = closeEyes(patch(stand.slice(0, 13), tailRows));
  return [...Array.from({ length: 3 }, () => '.'.repeat(width)), ...body, bottom];
}

function tuck(row: string, prefix: string): string {
  return prefix + row.slice(prefix.length);
}

const CAT_FRAMES: PetFrames = {
  stand: CAT_STAND,
  blink: closeEyes(CAT_STAND),
  wag: patch(CAT_STAND, CAT_TAIL_WAG),
  walkB: patch(CAT_STAND, CAT_WALK_B),
  walkC: patch(CAT_STAND, CAT_WALK_C),
  sleep: sleeping(
    CAT_STAND,
    {
      3: tuck(CAT_STAND[3], '...'),
      4: tuck(CAT_STAND[4], '...'),
      5: tuck(CAT_STAND[5], '...'),
      6: tuck(CAT_STAND[6], '...'),
      7: tuck(CAT_STAND[7], '..k'),
    },
    '.kkkkkkkkkkkkkkk........',
  ),
};

const DOG_FRAMES: PetFrames = {
  stand: DOG_STAND,
  blink: closeEyes(DOG_STAND),
  wag: patch(DOG_STAND, DOG_TAIL_WAG),
  walkB: patch(DOG_STAND, DOG_WALK_B),
  walkC: patch(DOG_STAND, DOG_WALK_C),
  sleep: sleeping(
    DOG_STAND,
    {
      3: tuck(DOG_STAND[3], '....'),
      4: tuck(DOG_STAND[4], '....'),
      5: tuck(DOG_STAND[5], '....'),
      6: tuck(DOG_STAND[6], '..k'),
    },
    '..kkkkkkkkkkkkkkk.......',
  ),
};

/* ---------- The four pets ---------- */

export interface PetArt {
  frames: PetFrames;
  palette: PixelPalette;
}

export const PET_ART = {
  // Noe's long-haired chihuahua: chocolate with tan eyebrows and legs, cream muzzle.
  pichu: {
    frames: DOG_FRAMES,
    palette: {
      k: '#1e120d', e: '#b9764a', h: '#4a2a1f', t: '#c98a4f', y: '#120b08', w: '#fff6e8', n: '#3a2320',
      c: '#efd9b8', r: '#ec7a8c', b: '#4a2a1f', p: '#e7c9a0',
    },
  },
  // Raúl's tuxedo cat with the black moustache spot under the nose.
  nael: {
    frames: CAT_FRAMES,
    palette: {
      k: '#07060a', e: '#26222c', i: '#e59aa5', h: '#26222c', z: '#f4f1ea', m: '#26222c',
      y: '#c9d85a', n: '#e39aa2', f: '#f4f1ea', x: '#07060a', b: '#26222c', t: '#26222c',
      c: '#f4f1ea', l: '#f4f1ea', p: '#ffffff',
    },
  },
  // Simba, Izan's orange and white cat.
  simba: {
    frames: CAT_FRAMES,
    palette: {
      k: '#3b2418', e: '#e59144', i: '#f3b0a4', h: '#e59144', z: '#fbf5ec', m: '#eea95e',
      y: '#8fb24a', n: '#f09c9c', f: '#fbf5ec', x: '#fbf5ec', b: '#e08b3a', t: '#e08b3a',
      c: '#fbf5ec', l: '#fbf5ec', p: '#fbf5ec',
    },
  },
  // Miguel's seal-point Siamese: cream body, dark points and blue eyes.
  enana: {
    frames: CAT_FRAMES,
    palette: {
      k: '#2b1a14', e: '#4a2e24', i: '#8a5a4a', h: '#eadcc6', z: '#8a6a58', m: '#4a2e24',
      y: '#8fd6f5', n: '#241510', f: '#4a2e24', x: '#4a2e24', b: '#efe4d2', t: '#4a2e24',
      c: '#f7f0e4', l: '#6b4636', p: '#3d2720',
    },
  },
} satisfies Record<string, PetArt>;
