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

/* ---------- Chubby cat (Enano Gordo): the cat's head on a big round belly ----------
 * Same keys as the cat plus s: tabby stripes. Each row is body (14) + head (12).
 */
const FAT_HEAD = [
  '.k.......k..',
  '.kk.....kk..',
  '.kik...kik..',
  '.kehkkkhek..',
  'khhhhzhhhhk.',
  'kmyymzmyymk.',
  'kmmmfnfmmmk.',
  'kmffxxxffmk.',
];

const FAT_STAND: PixelFrame = [
  '..............' + FAT_HEAD[0],
  '..............' + FAT_HEAD[1],
  '..............' + FAT_HEAD[2],
  '.k............' + FAT_HEAD[3],
  'ktk...........' + FAT_HEAD[4],
  'ksk...........' + FAT_HEAD[5],
  'ktkkkkkkkkkkkk' + FAT_HEAD[6],
  'kskbsbbsbbsbbb' + FAT_HEAD[7],
  '.ktbsbbsbbsbbb' + 'bkfffffffk..',
  'kbbsbbsbbsbbbb' + 'cckkkkkkk...',
  'kbbsbbsbbsbbcc' + 'ccck........',
  'kbsbbsbbsbcccc' + 'cccck.......',
  'kbsbbsbbcccccc' + 'cccck.......',
  'kbbbbbcccccccc' + 'ccck........',
  '.kbbcccccccccc' + 'cck.........',
  '..kccccccccccc' + 'ck..........',
  '...kllkkkkkkkllk..........',
  '...kppk.....kppk..........',
  '...kkkk.....kkkk..........',
];

const FAT_TAIL_WAG: Record<number, string> = {
  3: '..k...........' + FAT_HEAD[3],
  4: '.ktk..........' + FAT_HEAD[4],
  5: '.ksk..........' + FAT_HEAD[5],
  6: '.ktkkkkkkkkkkk' + FAT_HEAD[6],
  7: '.ksbsbbsbbsbbb' + FAT_HEAD[7],
};

const FAT_WALK_B: Record<number, string> = {
  17: '..kppk.......kppk.........',
  18: '..kkkk.......kkkk.........',
};

const FAT_WALK_C: Record<number, string> = {
  17: '....kppk...kppk...........',
  18: '....kkkk...kkkk...........',
};

/**
 * Enano Gordo blown up like a balloon, for his bouncy landing: a round belly
 * with the face on the right, stubby paws below and the tail poking out.
 */
function inflatedCat(): PixelFrame {
  const width = 24;
  const height = 22;
  const [cx, cy, r] = [12, 12, 9.3];
  const inside = (x: number, y: number): boolean => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): string => {
      if (!inside(x, y)) return '.';
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) return 'k';
      if (Math.hypot((x + 0.5 - cx - 1) / 6.5, (y + 0.5 - cy - 4) / 4.5) < 1) return 'c';
      // Tabby stripes curving round the ball, like the lines of a beach ball.
      const across = (x + 0.5 - cx) / Math.sqrt(Math.max(4, r * r - (y + 0.5 - cy) ** 2));
      return (((across * 2.2) % 1) + 1) % 1 < 0.22 ? 's' : 'b';
    }),
  );
  const stamp = (x: number, y: number, rows: string[]): void =>
    rows.forEach((row, dy) => [...row].forEach((char, dx) => char !== '.' && (grid[y + dy][x + dx] = char)));

  stamp(10, 0, ['k..', 'kk.', 'kik', 'kbb']);
  stamp(16, 1, ['..k', '.kk', 'kik', 'bbk']);
  stamp(14, 7, ['y...y', 'y...y']);
  stamp(13, 10, ['i..n..i', '...k...']);
  stamp(0, 12, ['.kk', 'ktt', '.kk']);
  stamp(6, 20, ['kppk', 'kkkk']);
  stamp(14, 20, ['kppk', 'kkkk']);
  return grid.map((row) => row.join(''));
}

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

/** Hind leg lifted sideways, for a wee. */
const DOG_LEG_UP: Record<number, string> = {
  11: 'kkkkkbbbcccccccckk......',
  12: 'kptttbbccccccccck.......',
  13: '.kkkkkkkkkkkkttkk.......',
  14: '............kttk........',
  15: '............kppk........',
  16: '............kkkk........',
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

/** Beer mug for the drinking alert. w foam · y beer · h highlight · b bubble. */
export const BEER_MUG: PixelFrame = [
  '...wwwwwww....',
  '..wwwwwwwwww..',
  '.wwwwwwwwwwww.',
  '.kwwwwwwwwwk..',
  '.kyyyhyyyyyk..',
  '.kyyyhyyyyykkk',
  '.kyyyhyybyyk.k',
  '.kyyyhyyyyyk.k',
  '.kyyyhybyyykkk',
  '.kyyyyyyyyyk..',
  '.kyyybyyyyyk..',
  '.kkkkkkkkkkk..',
];

export const BEER_PALETTE: PixelPalette = { k: '#3b2418', w: '#fffaf0', y: '#f5b82e', h: '#ffe7a0', b: '#fff3c4' };

/* ---------- Frame builders ---------- */

function patch(base: PixelFrame, rows: Record<number, string>): PixelFrame {
  return base.map((row, i) => rows[i] ?? row);
}

function closeEyes(frame: PixelFrame): PixelFrame {
  return frame.map((row) => row.replace(/[yw]/g, 'k'));
}

/** Lying down: body lowered (by the legs' height), no legs, eyes closed, tail tucked. */
function sleeping(stand: PixelFrame, tailRows: Record<number, string>, bottom: string, bodyRows = 13): PixelFrame {
  const width = stand[0].length;
  const body = closeEyes(patch(stand.slice(0, bodyRows), tailRows));
  const lift = stand.length - bodyRows - 1;
  return [...Array.from({ length: lift }, () => '.'.repeat(width)), ...body, bottom];
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

const FAT_FRAMES: PetFrames = {
  stand: FAT_STAND,
  blink: closeEyes(FAT_STAND),
  wag: patch(FAT_STAND, FAT_TAIL_WAG),
  walkB: patch(FAT_STAND, FAT_WALK_B),
  walkC: patch(FAT_STAND, FAT_WALK_C),
  sleep: sleeping(
    FAT_STAND,
    {
      3: tuck(FAT_STAND[3], '...'),
      4: tuck(FAT_STAND[4], '...'),
      5: tuck(FAT_STAND[5], '...'),
      6: tuck(FAT_STAND[6], '...'),
      7: tuck(FAT_STAND[7], '..k'),
    },
    '..kkkkkkkkkkkkkk..........',
    16,
  ),
};

/* ---------- The pets ---------- */

export interface PetArt {
  frames: PetFrames;
  palette: PixelPalette;
  /** Where it bends when picked up: neck column and spine row (see Ragdoll). */
  rig: { neck: number; spine: number };
  /** Blown-up look, for pets that land bouncing instead of by parachute. */
  ball?: PixelFrame;
  /** Leg lifted for a wee (only the dog does that). */
  pee?: PixelFrame;
}

export const PET_ART = {
  // Noe's long-haired chihuahua: chocolate with tan eyebrows and legs, cream muzzle.
  pichu: {
    frames: DOG_FRAMES,
    rig: { neck: 12, spine: 9 },
    pee: patch(DOG_STAND, DOG_LEG_UP),
    palette: {
      k: '#1e120d', e: '#b9764a', h: '#4a2a1f', t: '#c98a4f', y: '#120b08', w: '#fff6e8', n: '#3a2320',
      c: '#efd9b8', r: '#ec7a8c', b: '#4a2a1f', p: '#e7c9a0',
    },
  },
  // Raúl's tuxedo cat with the black moustache spot under the nose.
  nael: {
    frames: CAT_FRAMES,
    rig: { neck: 12, spine: 9 },
    palette: {
      k: '#07060a', e: '#26222c', i: '#e59aa5', h: '#26222c', z: '#f4f1ea', m: '#26222c',
      y: '#c9d85a', n: '#e39aa2', f: '#f4f1ea', x: '#07060a', b: '#26222c', t: '#26222c',
      c: '#f4f1ea', l: '#f4f1ea', p: '#ffffff',
    },
  },
  // Simba, Izan's orange and white cat.
  simba: {
    frames: CAT_FRAMES,
    rig: { neck: 12, spine: 9 },
    palette: {
      k: '#3b2418', e: '#e59144', i: '#f3b0a4', h: '#e59144', z: '#fbf5ec', m: '#eea95e',
      y: '#8fb24a', n: '#f09c9c', f: '#fbf5ec', x: '#fbf5ec', b: '#e08b3a', t: '#e08b3a',
      c: '#fbf5ec', l: '#fbf5ec', p: '#fbf5ec',
    },
  },
  // Miguel's seal-point Siamese: cream body, dark points and blue eyes.
  enana: {
    frames: CAT_FRAMES,
    rig: { neck: 12, spine: 9 },
    palette: {
      k: '#2b1a14', e: '#4a2e24', i: '#8a5a4a', h: '#eadcc6', z: '#8a6a58', m: '#4a2e24',
      y: '#8fd6f5', n: '#241510', f: '#4a2e24', x: '#4a2e24', b: '#efe4d2', t: '#4a2e24',
      c: '#f7f0e4', l: '#6b4636', p: '#3d2720',
    },
  },
  // Enano Gordo, Miguel's chunky grey tabby: black stripes (the "M" on the
  // forehead too), pale chin and belly, yellow-green eyes, pinkish-brown nose.
  gordo: {
    frames: FAT_FRAMES,
    rig: { neck: 14, spine: 10 },
    ball: inflatedCat(),
    palette: {
      k: '#1a1714', e: '#6b6457', i: '#c98f84', h: '#877f70', z: '#2e2924', m: '#9a917f',
      y: '#c8cf4e', n: '#b7766a', f: '#ddd5c4', x: '#ddd5c4', b: '#877f70', t: '#6b6457',
      s: '#2e2924', c: '#b9b09c', l: '#877f70', p: '#b9b09c',
    },
  },
} satisfies Record<string, PetArt>;
