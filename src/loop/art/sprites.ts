// All sprites are drawn from ASCII rows at start-up (no image files). '.' is transparent.
import { Px } from '../../art/pixel';

const LEG: Record<string, number> = {
  K: 0x241530, // ink outline
  h: 0x4a4aa0, // hood
  H: 0x7474d0,
  r: 0xd0404a, // red mask / scarf
  R: 0x8a2434,
  b: 0x3c5ab8, // tunic
  B: 0x28408a,
  g: 0xf0c848, // gold
  l: 0x5a3a2c, // leg / boot
  w: 0xf0f0fa, // blade
  p: 0x6a3a8a, // bandit purple
  P: 0x4a2a66,
  q: 0xc84a4a,
  y: 0xff5050, // glowing eyes
  S: 0x9a9ab0, // shield
  s: 0xc8c8dc,
  d: 0xd8d8e8,
  G: 0xb07a1c, // dark gold
};

function make(rows: string[]): Px {
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`sprite row width ${r.length} != ${w}: ${r}`);
  const px = new Px(w, rows.length);
  px.ascii(0, 0, rows, LEG);
  return px;
}

const RUNNER_BODY = [
  '....KKKK....',
  '...KhhhhK...',
  '..KhHHHhhK..',
  '..KhHHhhhK..',
  '..KhhhhhhK..',
  '..KrrrrrrKw.',
  '...KbbbbKw..',
  '..KbBbbBbw..',
  '.KbbBbbBKw..',
  '.KbbBggBKwK.',
  '..KbbbbbKK..',
  '..KbbBBbbK..',
];
const LEGS_A = ['...KlK.KlK..', '...KlK.KlK..', '..KlK...KlK.', '..KKK...KKK.'];
const LEGS_B = ['....KlKlK...', '....KlKlK...', '....KlKlK...', '....KKKKK...'];

export const SPR = {
  runnerA: make([...RUNNER_BODY, ...LEGS_A]),
  runnerB: make([...RUNNER_BODY, ...LEGS_B]),
  bandit: make([
    '....KKKK....',
    '...KppppK...',
    '..KpPPPPpK..',
    '..KpKKKKpK..',
    '..KpKyyKpK..',
    '..KpKKKKpK..',
    '...KppppK...',
    '..KppqqppK..',
    '.KpppqqpppKd',
    '.KpPpqqpPpKd',
    '.KpPppppPKd.',
    '..KppppppK..',
    '..KpppppK...',
    '..KpKKKKpK..',
    '..KPK..KPK..',
    '..KKK..KKK..',
  ]),
  brute: make([
    '....KKKKKKKK....',
    '...KrrrrrrrrK...',
    '..KrRRRRRRRRrK..',
    '..KrRKKKKKKRrK..',
    '..KrRKyKKyKRrK..',
    '..KrRKKKKKKRrK..',
    '...KrrRRRRrrK...',
    '.KKrrSSSSSSrrKK.',
    'KrrrSSSggSSSrrrK',
    'KrRrSSSggSSSrRrK',
    'KrRrSSSSSSSSrRrK',
    '.KrrSSSSSSSSrrK.',
    '.KrrrSSSSSSrrrK.',
    '..KrrrKSSKrrrK..',
    '..KRRRK..KRRRK..',
    '..KRRRK..KRRRK..',
    '..KKKKK..KKKKK..',
  ]),
  heart: make(['.KK.KK.', 'KrrKrrK', 'KrrrrrK', '.KrrrK.', '..KrK..', '...K...']),
  heartEmpty: make(['.KK.KK.', 'K..K..K', 'K.....K', '.K...K.', '..K.K..', '...K...']),
  lock: make(['..KKK..', '.K...K.', '.K...K.', 'KKKKKKK', 'KggggGK', 'KggKggK', 'KggggGK', 'KKKKKKK']),
};
