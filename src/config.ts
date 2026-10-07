// Logical resolution: 16:9, scaled by whole numbers on big screens (480x270 -> 1920x1080 is exactly 4x).
export const W = 480;
export const H = 270;

export const GAME_TITLE = 'Down the Hatch'; // working title - check originality before release

export const CELL = 32;
export const BOARD_X = 40;
export const BOARD_Y = 38;
export const COLS = 8;
export const ROWS = 5;
export const BOARD_W = COLS * CELL; // 256
export const BOARD_H = ROWS * CELL; // 160
export const GHOST_X = BOARD_X - CELL; // preview column (the creature's next bite)
export const ACID_X = BOARD_X + BOARD_W;
export const EXIT_X = ACID_X + CELL;
export const PANEL_X = 372;

export const HAND_Y = 228;
export const CARD_W = 62;
export const CARD_H = 40;

export const cellX = (c: number) => BOARD_X + c * CELL + CELL / 2;
export const cellY = (r: number) => BOARD_Y + r * CELL + CELL / 2;

export const COLOUR_NAMES = ['RUBY', 'EMERALD', 'SAPPHIRE', 'TOPAZ'];

// ramps run dark -> light (5 steps)
export const GEM_RAMPS: number[][] = [
  [0x4a0f1c, 0x8f1f33, 0xd8344a, 0xff6b7c, 0xffc2c9],
  [0x0b3a22, 0x16743f, 0x2fc06a, 0x7af0a0, 0xd0ffe0],
  [0x0e2250, 0x1c4aa8, 0x3f86ff, 0x8bbcff, 0xdcebff],
  [0x4a3306, 0x9a6a0e, 0xf0b92a, 0xffe070, 0xfff6c8],
];
export const COLOUR_UI = [0xff5a6e, 0x3fe083, 0x5a9bff, 0xffd042];

export const C = {
  ink: 0x1a0a14,
  panel: 0x26101e,
  panelEdge: 0x6a3a54,
  text: 0xf4e3d7,
  textDim: 0xa88a96,
  accent: 0xffd35a,
  good: 0x6bdc3c,
  bad: 0xff5a5a,
  acid: 0x8cf03e,
};
