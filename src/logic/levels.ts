import type { LevelDef, ToolId } from './types';

export const BASE_DECK: ToolId[] = ['pick', 'pick', 'pick', 'zapper', 'zapper', 'net', 'net', 'shove', 'shove'];

export const PAL = {
  pink: [0x12050c, 0x21101a, 0x361626, 0x52213a, 0x7a2f4b, 0xa84a63, 0xd8788a],
  swamp: [0x08130e, 0x10241b, 0x1b3a2b, 0x2c5a42, 0x468060, 0x6fa884, 0xa0d4a8],
  dusk: [0x0a0c1a, 0x141830, 0x222850, 0x353d7a, 0x4e59a0, 0x7882c8, 0xa6aeea],
  moss: [0x14120a, 0x241f10, 0x3a3118, 0x584a20, 0x7c6c2c, 0xa6924a, 0xd2be78],
  rust: [0x160808, 0x2a0e0e, 0x461818, 0x6c2a22, 0x984430, 0xc46c48, 0xe8a070],
};

const COMMON = { maxEnergy: 3, handSize: 4, infectionMax: 3, initialColumns: 6 };

/** The journey: five creatures, each one bends the rules in its own way. */
export const CREATURES: Omit<LevelDef, 'deck'>[] = [
  {
    ...COMMON,
    id: 'tiny-frog',
    name: 'Tiny Frog',
    tagline: 'A gentle little meal.',
    quirk: 'none',
    quirkEvery: 0,
    quirkText: 'NO QUIRKS. A GENTLE FIRST MEAL.',
    palette: PAL.pink,
    portrait: 'portrait_frog',
    digestMax: 20,
    quota: 210,
    stars: [280, 350],
    reach: 5,
    spawn: { pBug: 0.4, pGem: 0.28, pBone: 0.05 },
  },
  {
    ...COMMON,
    id: 'hiccup-toad',
    name: 'Hiccup Toad',
    tagline: 'Hic! Hold on to something.',
    quirk: 'hiccup',
    quirkEvery: 4,
    quirkText: 'EVERY 4TH SQUEEZE THE BELT HICCUPS: TWO STEPS.',
    palette: PAL.swamp,
    portrait: 'portrait_toad',
    digestMax: 20,
    quota: 230,
    stars: [300, 380],
    reach: 5,
    spawn: { pBug: 0.4, pGem: 0.29, pBone: 0.05 },
  },
  {
    ...COMMON,
    id: 'burp-hippo',
    name: 'Burp Hippo',
    tagline: 'Excuse me!',
    quirk: 'burp',
    quirkEvery: 5,
    quirkText: 'EVERY 5TH SQUEEZE IS A BURP: THE BELT RUNS BACK.',
    palette: PAL.dusk,
    portrait: 'portrait_hippo',
    digestMax: 22,
    quota: 250,
    stars: [330, 410],
    reach: 5,
    spawn: { pBug: 0.45, pGem: 0.3, pBone: 0.04 },
  },
  {
    ...COMMON,
    id: 'sticky-slug',
    name: 'Sticky Slug',
    tagline: 'Everything clings.',
    quirk: 'slime',
    quirkEvery: 0,
    quirkText: 'SLIMY BUGS CLING AND JAM THE BELT BEHIND THEM.',
    palette: PAL.moss,
    portrait: 'portrait_slug',
    digestMax: 22,
    quota: 260,
    stars: [340, 430],
    reach: 5,
    spawn: { pBug: 0.43, pGem: 0.3, pBone: 0.04 },
  },
  {
    ...COMMON,
    id: 'mouldy-mammoth',
    name: 'Mouldy Mammoth',
    tagline: 'Old. Big. Rotten.',
    quirk: 'rot',
    quirkEvery: 0,
    quirkText: 'GEMS ON THE BELT MAY ROT INTO BUGS.',
    palette: PAL.rust,
    portrait: 'portrait_mammoth',
    digestMax: 26,
    quota: 270,
    stars: [360, 460],
    reach: 5,
    spawn: { pBug: 0.36, pGem: 0.34, pBone: 0.04 },
  },
];

export function makeLevel(index: number, extras: ToolId[] = []): LevelDef {
  const base = CREATURES[Math.max(0, Math.min(CREATURES.length - 1, index))];
  return { ...base, deck: [...BASE_DECK, ...extras] };
}

/** Tiny Frog with the player's earned reward cards added to the starting deck (kept for the tests/sim). */
export const tinyFrog = (extras: ToolId[] = []) => makeLevel(0, extras);
export const TINY_FROG: LevelDef = tinyFrog();

/** Tools that can be offered as a reward after a level. */
export const REWARD_POOL: ToolId[] = [
  'magnet', 'broom', 'antidote', 'lantern', 'glue', 'spray', 'forage', 'adrenaline', 'dynamite',
  'pick', 'zapper', 'net', 'shove',
];
/** Rewards that are new/interesting are offered more often than the basic ones. */
export const REWARD_NEW: ToolId[] = ['magnet', 'broom', 'antidote', 'lantern', 'glue', 'spray', 'forage', 'adrenaline', 'dynamite'];
