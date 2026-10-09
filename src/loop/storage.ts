// Progress lives in localStorage (CrazyGames backs it up automatically). Every access is guarded:
// it can throw or come back empty in private windows / blocked-storage previews.
const KEY = 'ae_save_v1';

export interface Save {
  muted: boolean;
  best: number;
  bestLaps: number;
  runs: number;
  /** Hints already shown (each is shown once). */
  hints: string[];
}

const DEFAULT: Save = { muted: false, best: 0, bestLaps: 0, runs: 0, hints: [] };
let cache: Save | null = null;

export function loadSave(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Save>;
      cache = { ...DEFAULT, ...p, hints: [...(p.hints ?? [])] };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = { ...DEFAULT, hints: [] };
  return cache;
}

export function writeSave(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSave()));
  } catch {
    /* ignore */
  }
}
