/**
 * youtubeService — syncs the app's catalog with a live YouTube playlist
 * (native port of the web app's service).
 *
 * No API key required: playlist contents are read from YouTube's public Atom
 * feed (the same feed that powers "videos.xml" subscriptions) and titles +
 * artists come from the feed itself, backfilled from the oEmbed endpoint
 * (a plain, CORS-enabled fetch) when missing. Durations arrive later from the
 * live player during playback.
 *
 * If EXPO_PUBLIC_YOUTUBE_API_KEY is set, the heavier REST path (playlistItems
 * + videos) takes over instead — full pagination, exact same behavior as the
 * web app's VITE_YOUTUBE_API_KEY path.
 *
 * If EXPO_PUBLIC_ATUAL_API_KEY is set (see src/config/atualApi.js), the app's
 * playlist LIST comes from the Atual API (GET /api/playlists) — it supplies
 * which playlists to track (name + YouTube playlistId); the actual tracks are
 * still synced from YouTube below.
 */

import { Platform } from "react-native";
import { ATUAL_API_BASE, atualApiKey, isAtualApiConfigured } from "../config/atualApi";
import { YOUTUBE_PLAYLISTS } from "../config/youtubePlaylists";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml";

/** The first configured playlist is the app's main one (shown at /playlist). */
const REFERENCE_PLAYLIST_ID = YOUTUBE_PLAYLISTS[0]?.id || "";

// Web used import.meta.env.VITE_YOUTUBE_API_KEY; Expo uses EXPO_PUBLIC_*.
const apiKey = () => process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || "";

export const isLiveApiConfigured = () => Boolean(apiKey());

/* ------------------------------------------------------------------ */
/*  Playlist enumeration (no API key)                                  */
/* ------------------------------------------------------------------ */

/**
 * CORS relay templates for the browser build. YouTube's Atom feed sends no
 * CORS headers, so on web the feed is read through a relay. `{url}` is the
 * encoded feed URL. Native never uses these (no CORS on mobile).
 *
 * The defaults cover both cases:
 *   - corsproxy.io — fast, but its free tier only allows localhost/dev origins
 *   - allorigins   — no origin restriction, works on production domains
 *
 * Set EXPO_PUBLIC_FEED_PROXY to override: a single `{url}` template, or a
 * comma-separated list tried in order. Custom relays are tried first, then the
 * defaults as a last resort (so a misconfigured relay never bricks sync).
 */
const DEFAULT_FEED_PROXIES = [
  "https://corsproxy.io/?url={url}",
  "https://api.allorigins.win/raw?url={url}",
];

const feedProxyTemplates = () => {
  const custom = (process.env.EXPO_PUBLIC_FEED_PROXY || "").trim();
  if (custom) {
    const list = custom
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) return list;
  }
  return DEFAULT_FEED_PROXIES;
};

/** Substitute the encoded feed URL into a relay template. */
const expandRelayTemplate = (template, url) =>
  template.includes("{url}")
    ? template.split("{url}").join(encodeURIComponent(url))
    : `${template}${encodeURIComponent(url)}`;

/** A relay response that isn't the Atom feed (JSON/HTML error pages etc). */
const isFeedXml = (text) => /^(<\?xml|<feed\b|<rss\b)/i.test(text.trim());

/**
 * Read a playlist's public Atom feed. Native fetches hit YouTube directly;
 * browsers are blocked by CORS (the feed sends no CORS headers), so the web
 * build relays the exact same feed through a configurable CORS proxy (see
 * feedProxyTemplates). Production web deployments should prefer
 * EXPO_PUBLIC_YOUTUBE_API_KEY (the Data API path is fully CORS-enabled) or
 * their own relay via EXPO_PUBLIC_FEED_PROXY.
 */
async function fetchFeedXml(playlistId) {
  const url = `${FEED_URL}?playlist_id=${encodeURIComponent(playlistId)}`;
  if (Platform.OS === "web") {
    let lastErr;
    for (const template of feedProxyTemplates()) {
      try {
        const res = await fetch(expandRelayTemplate(template, url));
        if (!res.ok) throw new Error(`feed relay ${res.status}`);
        const text = await res.text();
        if (!isFeedXml(text)) throw new Error("feed relay returned a non-feed response");
        return text;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("YouTube feed unavailable");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube feed ${res.status}`);
  return await res.text();
}

/**
 * Fetch the CURRENT video ids of a playlist from YouTube's public feed.
 * Returns { ids, player: null } to keep the web call signature (the web
 * version shared a hidden IFrame player here; native uses the feed instead).
 * NOTE: the public feed caps playlists at ~15 entries — larger libraries need
 * EXPO_PUBLIC_YOUTUBE_API_KEY for full enumeration.
 */
async function fetchPlaylistVideoIdsFromPlayer(playlistId = REFERENCE_PLAYLIST_ID) {
  const ids = await fetchFeedIds(playlistId);
  if (!ids.length) throw new Error("Playlist returned no videos");
  return { ids, player: null };
}

async function fetchFeedIds(playlistId) {
  const xml = await fetchFeedXml(playlistId);
  const ids = [];
  const re = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
  let m;
  while ((m = re.exec(xml)) !== null) ids.push(m[1]);
  return ids;
}

/** Parse the feed's per-entry { youtubeId, title, artist } tuples. */
function parseFeedEntries(xml) {
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let em;
  while ((em = entryRe.exec(xml)) !== null) {
    const body = em[1];
    const vid = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = body.match(/<title>([^<]*)<\/title>/);
    const author = body.match(/<name>([^<]*)<\/name>/);
    if (!vid) continue;
    entries.push({
      youtubeId: vid[1],
      title: cleanTitle(title?.[1] || ""),
      artist: author?.[1] || "Unknown Artist",
      duration: 0,
      thumbnail: `https://i.ytimg.com/vi/${vid[1]}/hqdefault.jpg`,
    });
  }
  return entries;
}

/**
 * Titles + artists via YouTube's official oEmbed endpoint. Plain fetch — no
 * CORS restrictions on native. Used as the metadata source of last resort.
 */
async function fetchTitlesViaOEmbed(ids) {
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        return {
          youtubeId: id,
          title: cleanTitle(data.title || ""),
          artist: data.author_name || "Unknown Artist",
          duration: 0,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        };
      } catch {
        return { youtubeId: id, duration: 0 };
      }
    })
  );
  return entries;
}

/** Fill in missing artist names via oEmbed (mirrors the web's backfillAuthors). */
async function backfillAuthors(entries) {
  const missing = entries.filter((e) => !e.artist || e.artist === "Unknown Artist");
  if (!missing.length) return entries;
  const filled = await Promise.all(
    missing.map(async (e) => {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${e.youtubeId}`)}&format=json`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        return { ...e, artist: data.author_name || e.artist };
      } catch {
        return e;
      }
    })
  );
  const byId = new Map(filled.map((e) => [e.youtubeId, e]));
  return entries.map((e) => byId.get(e.youtubeId) || e);
}

/**
 * Full sync: enumerate every video in the live playlist and collect real
 * metadata (title, channel). Durations are learned at playback time and
 * written back into the catalog (see PlayerContext's position poller).
 */
async function fetchPlaylistWithMetadata(playlistId = REFERENCE_PLAYLIST_ID) {
  const xml = await fetchFeedXml(playlistId);
  let entries = parseFeedEntries(xml);
  if (!entries.length) {
    // Feed unavailable/empty — fall back to per-video oEmbed after an id pass.
    const { ids } = await fetchPlaylistVideoIdsFromPlayer(playlistId);
    entries = await fetchTitlesViaOEmbed(ids);
  }
  return backfillAuthors(entries);
}

/** Entry point used by the player context (same signature as the web app). */
export async function syncPlaylistFromYouTube(playlistId = REFERENCE_PLAYLIST_ID) {
  if (isLiveApiConfigured()) {
    const fetched = await fetchPlaylist(playlistId);
    return { entries: fetched };
  }
  const entries = await fetchPlaylistWithMetadata(playlistId);
  return { entries };
}

/* ------------------------------------------------------------------ */
/*  Atual API path (only when EXPO_PUBLIC_ATUAL_API_KEY is set)        */
/* ------------------------------------------------------------------ */

let cachedAtualPlaylists = null;

/**
 * Fetch the playlist LIST from the Atual API (GET /api/playlists, key in the
 * X-API-Key header). The endpoint returns playlist metadata only — name,
 * description and the YouTube `playlistId` for each playlist. The actual
 * videos/tracks are synced from YouTube per playlistId (see
 * syncPlaylistFromYouTube), so this list only drives WHICH playlists the app
 * tracks. Cached for the session.
 */
async function fetchPlaylistsFromAtual() {
  if (cachedAtualPlaylists) return cachedAtualPlaylists;
  const res = await fetch(`${ATUAL_API_BASE}/playlists`, {
    headers: { "X-API-Key": atualApiKey() },
  });
  if (!res.ok) throw new Error(`Atual API ${res.status}`);
  const json = await res.json();
  const rawList = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  const playlists = [];
  for (const p of rawList) {
    if (!p || typeof p !== "object") continue;
    const playlistId = p.playlistId || p.id || "";
    if (!playlistId) continue;
    playlists.push({
      id: playlistId,
      name: p.name || p.label || playlistId,
      description: p.description || "",
      slug: p.id || "",
    });
  }
  cachedAtualPlaylists = playlists;
  return playlists;
}

/**
 * The playlists the app tracks: the static YOUTUBE_PLAYLISTS config, plus the
 * Atual API list when EXPO_PUBLIC_ATUAL_API_KEY is set. Both sources are kept
 * SEPARATE — each playlist is tagged with the API that provided it
 * (`source: "config" | "atual"`) so the UI can group them per source. A
 * playlist id present in both keeps the config entry (the local config is the
 * explicit choice). If the Atual API is unreachable, the config is used.
 */
export async function getYoutubePlaylists() {
  const merged = YOUTUBE_PLAYLISTS.map((p) => ({ ...p, source: "config" }));
  if (isAtualApiConfigured()) {
    try {
      const atual = await fetchPlaylistsFromAtual();
      for (const p of atual) {
        if (!merged.some((m) => m.id === p.id)) merged.push({ ...p, source: "atual" });
      }
    } catch {
      /* Atual unreachable — keep the config playlists */
    }
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/*  YouTube Data API v3 path (only when EXPO_PUBLIC_YOUTUBE_API_KEY is set) */
/* ------------------------------------------------------------------ */

async function fetchPlaylist(playlistId = REFERENCE_PLAYLIST_ID) {
  let nextPageToken = "";
  const items = [];
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      key: apiKey(),
      ...(nextPageToken ? { pageToken: nextPageToken } : {}),
    });
    const res = await fetch(`${API_BASE}/playlistItems?${params}`);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const json = await res.json();
    items.push(...(json.items || []));
    nextPageToken = json.nextPageToken || "";
  } while (nextPageToken);

  const videoIds = [];
  for (const item of items) {
    const videoId = item.snippet?.resourceId?.videoId;
    if (videoId) videoIds.push(videoId);
  }
  const details = await fetchVideoDetails(videoIds);

  const result = [];
  for (const item of items) {
    const snippet = item.snippet || {};
    const videoId = snippet.resourceId?.videoId;
    if (!videoId) continue;
    result.push({
      youtubeId: videoId,
      title: cleanTitle(snippet.title || "Untitled"),
      artist: snippet.videoOwnerChannelTitle || "Unknown Artist",
      album: "Personal Songs",
      duration: details.get(videoId) || 0,
      thumbnail: snippet.thumbnails?.high?.url || "",
    });
  }
  return result;
}

async function fetchVideoDetails(videoIds) {
  const map = new Map();
  const chunkSize = 50;
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    chunks.push(videoIds.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        part: "contentDetails",
        id: chunk.join(","),
        key: apiKey(),
      });
      const res = await fetch(`${API_BASE}/videos?${params}`);
      if (!res.ok) return null;
      return res.json();
    })
  );
  results.forEach((json) => {
    if (!json) return;
    (json.items || []).forEach((v) => {
      const seconds = parseIsoDuration(v.contentDetails?.duration);
      map.set(v.id, seconds);
    });
  });
  return map;
}

function parseIsoDuration(iso = "") {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

function cleanTitle(title = "") {
  return title.replace(/\s*\(Official(?: Music)? Video\)\s*/i, "").trim();
}
