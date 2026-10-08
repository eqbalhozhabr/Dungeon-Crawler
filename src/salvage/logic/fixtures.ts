import type { FixtureKind, Tool } from './types';

/** Things in a fight room that the tool face of a card can work on. Each can be used once, by either side. */
export const FIXTURE_NEEDS: Record<FixtureKind, Tool[]> = {
  valve: ['PRY', 'KEY'],
  cyst: ['CUT', 'DIG'],
  pod: ['LIGHT'],
};

export const FIXTURE_NAMES: Record<FixtureKind, string> = {
  valve: 'ACID VALVE',
  cyst: 'GOO CYST',
  pod: 'GLOW POD',
};

export const FIXTURE_HELP: Record<FixtureKind, string> = {
  valve: 'ACID FLOODS THE OTHER SIDE: 7',
  cyst: 'HEALS WHOEVER OPENS IT: 6',
  pod: 'BLINDS THE OTHER SIDE (DAZZLE)',
};

export const VALVE_DMG = 7;
export const CYST_HEAL = 6;
