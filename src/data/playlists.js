import { tracks } from "./tracks";
import { YOUTUBE_PLAYLISTS } from "../config/youtubePlaylists";

/**
 * One playlist object per configured YouTube playlist (see
 * src/config/youtubePlaylists.js). `trackIds` is a live getter that filters
 * the catalog by playlist membership, so songs added to any configured
 * YouTube playlist appear here automatically.
 */
function buildYoutubePlaylists(list) {
  return list.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    description: cfg.description || "Synced live from your YouTube playlist.",
    isYouTube: true,
    // Which API supplied this playlist ("config" = youtubePlaylists.js,
    // "atual" = the Atual API) — used to group playlists by source.
    source: cfg.source || "config",
    get trackIds() {
      const ids = [];
      for (const t of tracks) {
        if (t.playlistIds?.includes(cfg.id)) ids.push(t.id);
      }
      return ids;
    },
  }));
}

/**
 * The app's tracked YouTube playlists. Static by default (from
 * src/config/youtubePlaylists.js); PlayerContext replaces this with the Atual
 * API's playlist list when EXPO_PUBLIC_ATUAL_API_KEY is set.
 */
export let youtubePlaylists = buildYoutubePlaylists(YOUTUBE_PLAYLISTS);

/**
 * Replace the tracked playlist set (used by PlayerContext after a sync).
 * Returns true when the list actually changed, so callers can re-render.
 */
export function setYoutubePlaylists(list) {
  if (!Array.isArray(list) || !list.length) return false;
  const next = buildYoutubePlaylists(list);
  if (next.length === youtubePlaylists.length && next.every((p, i) => p.id === youtubePlaylists[i].id)) {
    return false;
  }
  youtubePlaylists = next;
  return true;
}

// The first configured YouTube playlist is the app's main one (route /playlist).
export const getMainPlaylist = () =>
  youtubePlaylists[0] || {
    id: "personal-songs",
    name: "Personal Songs",
    description: "Your personal collection, beautifully organized.",
    get trackIds() {
      return tracks.map((t) => t.id);
    },
  };

export const getPlaylist = (id) => {
  if (!id) return getMainPlaylist();
  return youtubePlaylists.find((p) => p.id === id) || null;
};
