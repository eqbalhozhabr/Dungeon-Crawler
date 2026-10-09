// Alley Echo: logical resolution (portrait 9:16) and palette. Everything is drawn into a 180x320 pixel buffer.
export const W = 180;
export const H = 320;
/** The street view occupies y = 0..SCENE_H, the seal board sits below it. */
export const SCENE_H = 206;

export const GAME_TITLE = 'Alley Echo'; // working title: check it is free on CrazyGames / itch / Steam before release

export const C = {
  ink: 0x1d1026,
  panel: 0x2a1530,
  panelEdge: 0x6a4468,
  text: 0xfbeed8,
  textDim: 0xb89aa6,
  gold: 0xffd24a,
  goldDark: 0xb07a1c,
  red: 0xe0485a,
  good: 0x7ae070,
  ghost: 0x86e4ff,
  haze: 0xe49aa4,
  tileA: 0xe0905a,
  tileB: 0xc87448,
  tileEdge: 0x8f4a3a,
  rune: 0x4a2f8a,
  runeDim: 0x7a5a9a,
};

/** District colours (gate banners and the notch beside the grid rows). */
export const DISTRICT_COL = [0x4ab8b0, 0xe05a5a, 0xf0c050];

/** Floor tint of a lane by the rune that builds it: readable at a glance. */
export const FLOOR: Record<string, number> = {
  coin: 0xd8c264,
  bandit: 0xa89cc0,
  spikes: 0x9c6a7c,
  fountain: 0x78b4aa,
  bare: 0xb8a678,
};
