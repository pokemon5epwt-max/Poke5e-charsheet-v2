import { StateStorage } from 'zustand/middleware';
import { InitiativeEntry } from '../types/pokemon5e';

const INITIATIVE_SNAPSHOT_KEY = 'pokemon5e-initiative-snapshot-v1';
const ACTIVE_TAB_KEY = 'pokemon5e-active-tab-v1';
const WINDOW_NAME_PREFIX = '__p5e_store__:';

export interface InitiativeSnapshot {
  entries: InitiativeEntry[];
  turnIndex: number;
  round: number;
  updatedAt?: string;
}

function readWindowNameMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    if (window.name && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      const parsed = JSON.parse(window.name.slice(WINDOW_NAME_PREFIX.length));
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // Ignore malformed window.name
  }
  return {};
}

function writeWindowNameMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = `${WINDOW_NAME_PREFIX}${JSON.stringify(map)}`;
    if (serialized.length < 512_000) {
      window.name = serialized;
    }
  } catch {
    // Ignore window.name failures
  }
}

export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const val = window.localStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    // localStorage unavailable (e.g. restricted iframe)
  }

  try {
    const val = window.sessionStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    // sessionStorage unavailable
  }

  const fallbackMap = readWindowNameMap();
  return typeof fallbackMap[key] === 'string' ? fallbackMap[key] : null;
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  let savedToPrimary = false;
  try {
    window.localStorage.setItem(key, value);
    savedToPrimary = true;
  } catch {
    // QuotaExceededError or SecurityError
  }

  try {
    window.sessionStorage.setItem(key, value);
    savedToPrimary = true;
  } catch {
    // Ignore sessionStorage error
  }

  if (!savedToPrimary || key === INITIATIVE_SNAPSHOT_KEY || key === ACTIVE_TAB_KEY) {
    const fallbackMap = readWindowNameMap();
    fallbackMap[key] = value;
    writeWindowNameMap(fallbackMap);
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
  const fallbackMap = readWindowNameMap();
  if (key in fallbackMap) {
    delete fallbackMap[key];
    writeWindowNameMap(fallbackMap);
  }
}

export const resilientZustandStorage: StateStorage = {
  getItem: (name) => safeGetItem(name),
  setItem: (name, value) => safeSetItem(name, value),
  removeItem: (name) => safeRemoveItem(name),
};

export function saveInitiativeSnapshot(snapshot: InitiativeSnapshot): void {
  try {
    safeSetItem(INITIATIVE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore serialization error
  }
}

export function loadInitiativeSnapshot(): InitiativeSnapshot | null {
  try {
    const raw = safeGetItem(INITIATIVE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InitiativeSnapshot>;
    if (!Array.isArray(parsed.entries)) return null;
    const entries = parsed.entries.filter(
      (e): e is InitiativeEntry =>
        Boolean(
          e &&
            typeof e === 'object' &&
            typeof e.id === 'string' &&
            typeof e.characterName === 'string' &&
            typeof e.initiative === 'number'
        )
    );
    const round =
      typeof parsed.round === 'number' && Number.isFinite(parsed.round)
        ? Math.max(1, Math.floor(parsed.round))
        : 1;
    const rawIndex =
      typeof parsed.turnIndex === 'number' && Number.isFinite(parsed.turnIndex)
        ? Math.floor(parsed.turnIndex)
        : 0;
    const turnIndex =
      entries.length > 0 ? Math.max(0, Math.min(rawIndex, entries.length - 1)) : 0;

    return {
      entries,
      turnIndex,
      round,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function saveActiveTab(tab: 'sheet' | 'initiative' | 'history'): void {
  safeSetItem(ACTIVE_TAB_KEY, tab);
}

export function loadActiveTab(): 'sheet' | 'initiative' | 'history' {
  const saved = safeGetItem(ACTIVE_TAB_KEY);
  if (saved === 'initiative' || saved === 'history' || saved === 'sheet') {
    return saved;
  }
  return 'sheet';
}
