import { getTrack } from "../data/tracks";

export const getPlaylistTracks = (playlist) => {
  const tracks = [];
  for (const id of playlist?.trackIds || []) {
    const track = getTrack(id);
    if (track) tracks.push(track);
  }
  return tracks;
};

/** Build an O(1) id → item map (for catalog lookups in lists/strips). */
const indexBy = (arr, key = "id") => new Map(arr.map((x) => [x[key], x]));

/** Find a collection entry (album/artist) by name — raw or URL-encoded. */
export function findByName(list, name) {
  return list.find((a) => a.name === name) || list.find((a) => a.name === decodeURIComponent(name || ""));
}

/**
 * Resolve recent-history entries into full track objects, dropping ids that
 * are no longer in the catalog. Returns [{ id, playedAt, track }] preserving
 * the play order (newest first), capped at `limit`.
 */
export function resolveRecent(catalog, recent, limit = Infinity) {
  const byId = indexBy(catalog);
  const out = [];
  for (const r of recent.slice(0, limit)) {
    const track = byId.get(r.id);
    if (track) out.push({ ...r, track });
  }
  return out;
}

/** Resolve favorite ids into full track objects, dropping stale ids. */
export function resolveFavorites(catalog, favorites) {
  const byId = indexBy(catalog);
  const out = [];
  for (const id of favorites) {
    const track = byId.get(id);
    if (track) out.push(track);
  }
  return out;
}
