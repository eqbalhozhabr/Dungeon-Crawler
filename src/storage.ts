// Progress lives in localStorage (CrazyGames backs it up automatically). Every access is guarded:
// it can throw or come back empty in private windows / blocked-storage previews.
const KEY = 'dth_save_v1';

export interface Save {
  muted: boolean;
  seenHelp: boolean;
  best: Record<string, { score: number; stars: number }>;
}

const DEFAULT: Save = { muted: false, seenHelp: false, best: {} };

let cache: Save | null = null;

export function loadSave(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Save>;
      cache = { ...DEFAULT, ...parsed, best: { ...(parsed.best ?? {}) } };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = { ...DEFAULT, best: {} };
  return cache;
}

export function writeSave(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSave()));
  } catch {
    /* ignore */
  }
}
