// Tiny save for the salvage prototype (its own key: the Guts & Gems save is left alone).
const KEY = 'gs_save_v1';

export interface SalvageSave {
  deepest: number; // furthest step reached (0..8)
  wins: number;
  runs: number;
  /** art style: full colour or an old black-and-white cartoon */
  vintage: boolean;
}

let cache: SalvageSave | null = null;

export function loadSalvage(): SalvageSave {
  if (cache) return cache;
  cache = { deepest: 0, wins: 0, runs: 0, vintage: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cache = { ...cache, ...(JSON.parse(raw) as Partial<SalvageSave>) };
  } catch {
    /* private mode etc.: play without saving */
  }
  return cache;
}

export function writeSalvage(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
