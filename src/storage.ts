// Progress lives in localStorage (CrazyGames backs it up automatically). Every access is guarded:
// it can throw or come back empty in private windows / blocked-storage previews.
const KEY = 'dth_save_v1';

import type { ToolId } from './logic/types';

export type ViewMode = 'flat' | 'fp';

export interface Save {
  muted: boolean;
  seenHelp: boolean;
  view: ViewMode;
  /** Reward cards earned so far; they are added to the starting deck of every new run. */
  extras: ToolId[];
  best: Record<string, { score: number; stars: number }>;
}

const DEFAULT: Save = { muted: false, seenHelp: false, view: 'fp', extras: [], best: {} };

let cache: Save | null = null;

export function loadSave(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Save>;
      cache = { ...DEFAULT, ...parsed, extras: [...(parsed.extras ?? [])], best: { ...(parsed.best ?? {}) } };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = { ...DEFAULT, extras: [], best: {} };
  return cache;
}

export function writeSave(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSave()));
  } catch {
    /* ignore */
  }
}
