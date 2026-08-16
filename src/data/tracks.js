/**
 * Track catalog — fully dynamic, never hardcoded.
 *
 * The catalog starts EMPTY and is populated at runtime from the user's live
 * YouTube playlist (see services/youtubeService.js + PlayerContext). A copy of
 * the last successful sync is cached in localStorage so the app is instant and
 * works offline, and the catalog is re-checked automatically so songs added to
 * the YouTube playlist later appear on their own.
 *
 * All reads go through the accessors below so every page stays in sync when
 * the catalog is refreshed.
 */

export let tracks = [];

export const getAllTracks = () => tracks;

export const getTrack = (id) => tracks.find((t) => t.id === id) || null;

function normalize(raw, id) {
  return {
    id: raw.youtubeId || raw.id || id,
    title: raw.title || `YouTube Track ${id.slice(0, 8)}`,
    artist: raw.artist || "Unknown Artist",
    album: raw.album || "Personal Songs",
    duration: raw.duration || 0,
    source: "youtube",
    youtubeId: raw.youtubeId || raw.id || id,
    thumbnail:
      raw.thumbnail || `https://i.ytimg.com/vi/${raw.youtubeId || raw.id || id}/hqdefault.jpg`,
    gradient: raw.gradient || ["#6366f1", "#ec4899"],
    // Which configured YouTube playlist(s) contain this track. A video shared
    // by two playlists appears once in the library but in both playlists.
    playlistIds: Array.isArray(raw.playlistIds)
      ? [...new Set(raw.playlistIds)]
      : raw.playlistId
        ? [raw.playlistId]
        : ["library"],
  };
}

/** Restore the cached catalog snapshot at boot (before any live sync). */
export function restoreCatalog(entries = []) {
  if (!Array.isArray(entries)) return;
  const normalized = [];
  for (const t of entries) {
    if (!t?.id) continue;
    normalized.push(normalize({ ...t, playlistIds: t.playlistIds || ["library"] }, t.id));
  }
  tracks = normalized;
}

/**
 * Sync ONE configured playlist into the catalog (the live playlist is the
 * source of truth for its own tracks). Tracks that are still in the playlist
 * get fresh metadata; tracks removed from the playlist are dropped from it
 * (and from the library if no other playlist contains them); brand-new tracks
 * are added. Other playlists' tracks are left untouched.
 */
export function setPlaylistEntries(playlistId, entries = []) {
  const liveIds = new Set();
  for (const e of entries) {
    const id = e.youtubeId || e.id;
    if (id) liveIds.add(id);
  }
  const incoming = [];
  for (const raw of entries) {
    const id = raw.youtubeId || raw.id;
    if (!id) continue;
    const already = raw.playlistIds?.includes(playlistId)
      ? raw.playlistIds
      : [...(raw.playlistIds || []), playlistId];
    incoming.push(normalize({ ...raw, playlistIds: already }, id));
  }

  let added = 0;
  let removed = 0;
  const next = [];
  const index = new Map();

  for (const t of tracks) {
    const inThisPlaylist = t.playlistIds?.includes(playlistId);
    if (inThisPlaylist && !liveIds.has(t.id)) {
      // Removed from this playlist — keep it only if another playlist has it.
      const rest = t.playlistIds.filter((p) => p !== playlistId);
      if (rest.length) {
        const kept = { ...t, playlistIds: rest };
        next.push(kept);
        index.set(kept.id, kept);
      } else {
        removed += 1;
      }
      continue;
    }
    next.push(t);
    index.set(t.id, t);
  }

  for (const raw of incoming) {
    const existing = index.get(raw.id);
    if (existing) {
      // Already in the catalog (possibly via another playlist) — refresh its
      // metadata and merge playlist membership.
      const idx = next.indexOf(existing);
      if (idx >= 0) {
        const merged = {
          ...raw,
          playlistIds: [...new Set([...(raw.playlistIds || []), ...(existing.playlistIds || [])])],
        };
        next[idx] = merged;
        index.set(merged.id, merged);
      }
      continue;
    }
    next.push(raw);
    index.set(raw.id, raw);
    added += 1;
  }

  tracks = next;
  return { added, removed, total: tracks.length };
}

/**
 * Write back a real duration learned during playback (YouTube reports it once
 * a video starts). Returns true when the catalog actually changed, so callers
 * can persist and re-render.
 */
export function updateTrackDuration(id, duration) {
  if (!id || !Number.isFinite(duration) || duration <= 0) return false;
  const t = tracks.find((x) => x.id === id);
  if (t && t.duration !== duration) {
    t.duration = Math.round(duration);
    return true;
  }
  return false;
}

/** Artists derived from the live catalog (channel names from YouTube). */
export function getArtists() {
  const map = new Map();
  for (const t of tracks) {
    if (!map.has(t.artist)) map.set(t.artist, []);
    map.get(t.artist).push(t);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      tracks: list,
      thumbnail: list[0].thumbnail,
      gradient: list[0].gradient,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Albums derived from the live catalog. */
export function getAlbums() {
  const map = new Map();
  for (const t of tracks) {
    if (!map.has(t.album)) map.set(t.album, []);
    map.get(t.album).push(t);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      artist: list[0].artist,
      tracks: list,
      thumbnail: list[0].thumbnail,
      gradient: list[0].gradient,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Plain JSON-safe snapshot for localStorage caching. */
export const getCatalogSnapshot = () => tracks.map((t) => ({ ...t }));
