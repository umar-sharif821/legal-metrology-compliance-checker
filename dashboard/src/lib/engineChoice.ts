/**
 * Which recognition engine to use, and where its key lives.
 *
 * Tesseract is the default and stays the default. It needs no key, no network and no
 * account, so the application always works — the cloud model is an enhancement path,
 * never a dependency, which is the only way the offline claim stays honest (P2).
 */
export type EngineId = 'tesseract' | 'gemini';

export const ENGINE_LABEL: Record<EngineId, string> = {
  tesseract: 'Tesseract (on this device)',
  gemini: 'Google Gemini (cloud)',
};

const ENGINE_KEY = 'lm.ocr.engine';
const API_KEY = 'lm.gemini.key';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing or storage disabled. The choice simply will not persist.
  }
}

export function currentEngine(): EngineId {
  const forced =
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ocr');
  if (forced === 'gemini' || forced === 'tesseract') return forced;
  const stored = safeGet(ENGINE_KEY);
  return stored === 'gemini' ? 'gemini' : 'tesseract';
}

export function setEngine(id: EngineId): void {
  safeSet(ENGINE_KEY, id);
}

/**
 * The API key.
 *
 * `VITE_GEMINI_API_KEY` in `dashboard/.env.local` is checked first, so a key can be kept
 * in a gitignored file and never typed into the page. Otherwise it comes from whatever
 * was entered in the UI, held in this browser only.
 *
 * Neither route is production key handling — a browser-held key is visible to anyone with
 * the machine, and a bundled one ships to every visitor. For a demonstration on your own
 * laptop that is acceptable; for a deployment the call belongs on a server that holds the
 * key, which is the same adapter with a different endpoint.
 */
export function apiKey(): string {
  const fromEnv = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return (safeGet(API_KEY) ?? '').trim();
}

export function setApiKey(value: string): void {
  safeSet(API_KEY, value.trim());
}

/** True when a key is available from either route. */
export function hasApiKey(): boolean {
  return apiKey().length > 0;
}

/** True when the key came from the gitignored env file rather than the page. */
export function keyFromEnv(): boolean {
  const fromEnv = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return Boolean(fromEnv && fromEnv.trim());
}
