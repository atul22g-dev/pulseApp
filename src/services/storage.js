/**
 * storage — port of the web app's localStorage service to AsyncStorage.
 *
 * The web version is synchronous (`load`/`save`), and PlayerContext calls it
 * synchronously from useState initializers. Native AsyncStorage is async, so
 * this module keeps the exact same sync API over an in-memory map that is
 * hydrated from AsyncStorage ONCE before the app renders (see hydrate() and
 * the root layout). `save` writes to the map synchronously and persists
 * asynchronously — key names and value shapes are identical to the web app.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "music-player";

export const STORAGE_KEYS = {
  theme: `${PREFIX}-theme`,
  volume: `${PREFIX}-volume`,
  favorites: `${PREFIX}-favorites`,
  recent: `${PREFIX}-recent`,
  queue: `${PREFIX}-queue`,
  settings: `${PREFIX}-settings`,
};

// Same key the web app uses for the saved-playlists + cached catalog.
const EXTRA_KEYS = [
  "music-player-saved-playlists",
  "music-player-catalog-v3",
];

/** In-memory mirror of every persisted value (sync reads for ported code). */
const cache = new Map();
let hydrated = false;

/** Load every known key from AsyncStorage into the sync map. */
export async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  const keys = [...Object.values(STORAGE_KEYS), ...EXTRA_KEYS];
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [key, raw] of pairs) {
      if (raw == null) continue;
      try {
        cache.set(key, JSON.parse(raw));
      } catch {
        /* corrupted value — ignore */
      }
    }
  } catch {
    /* storage unavailable — start empty (offline-first still works in-memory) */
  }
}

export function load(key, fallback = null) {
  if (!cache.has(key)) return fallback;
  return cache.get(key);
}

export function save(key, value) {
  try {
    cache.set(key, value);
    const raw = JSON.stringify(value);
    AsyncStorage.setItem(key, raw).catch(() => {});
    emitChange(key, value);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Change subscription (lets the theme provider follow settings)       */
/* ------------------------------------------------------------------ */

const listeners = new Map(); // key -> Set<fn>

function emitChange(key, value) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) fn(value);
}

/** Subscribe to value changes for a key; returns an unsubscribe fn. */
export function onChange(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

export function remove(key) {
  cache.delete(key);
  AsyncStorage.removeItem(key).catch(() => {});
}

export function clearAll() {
  Object.values(STORAGE_KEYS).forEach((k) => remove(k));
  EXTRA_KEYS.forEach((k) => remove(k));
}
