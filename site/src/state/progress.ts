export type ThemePreference = 'dark' | 'light';

export interface ProgressSnapshot {
  inventory: Map<string, number>;
  theme: ThemePreference;
}

const STORAGE_KEY = 'deer-isle-progress';
const DEFAULT_THEME: ThemePreference = 'dark';

interface StoredProgress {
  ticked?: unknown;
  inventory?: unknown;
  theme?: unknown;
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light';
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Load progress, clamping inventory counts against the current graph's item targets. */
export function loadProgress(validCounts: ReadonlyMap<string, number>): ProgressSnapshot {
  let saved: string | null = null;
  try {
    saved = storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return { inventory: new Map(), theme: DEFAULT_THEME };
  }
  if (!saved) return { inventory: new Map(), theme: DEFAULT_THEME };

  try {
    const parsed = JSON.parse(saved) as StoredProgress;
    const inventory = new Map<string, number>();
    if (parsed.inventory && typeof parsed.inventory === 'object' && !Array.isArray(parsed.inventory)) {
      for (const [id, value] of Object.entries(parsed.inventory)) {
        const max = validCounts.get(id);
        if (max === undefined || typeof value !== 'number' || !Number.isInteger(value)) continue;
        const count = Math.max(0, Math.min(max, value));
        if (count > 0) inventory.set(id, count);
      }
    } else if (Array.isArray(parsed.ticked)) {
      for (const id of parsed.ticked) {
        if (typeof id === 'string' && validCounts.has(id)) inventory.set(id, 1);
      }
    }
    return { inventory, theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_THEME };
  } catch {
    return { inventory: new Map(), theme: DEFAULT_THEME };
  }
}

export function saveProgress(snapshot: ProgressSnapshot): void {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({ inventory: Object.fromEntries(snapshot.inventory), theme: snapshot.theme }),
    );
  } catch {}
}

export function clearProgress(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {}
}

export function getProgressStorageKey(): string {
  return STORAGE_KEY;
}
