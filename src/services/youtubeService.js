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
 * When EXPO_PUBLIC_ATUAL_API_KEY is set (see src/config/atualApi.js), the app's
 * playlist LIST comes from the Atual API (GET /api/playlists) — it supplies
 * which playlists to track (name + YouTube playlistId); the actual tracks are
 * still synced from YouTube below.
 */

import { Platform } from "react-native";
import { ATUAL_API_BASE, atualApiKey, isAtualApiConfigured } from "../config/atualApi";
import { YOUTUBE_PLAYLISTS } from "../config/youtubePlaylists";

const FEED_URL = "https://www.youtube.com/feeds/videos.xml";

/** The first configured playlist is the app's main one (shown at /playlist). */
const REFERENCE_PLAYLIST_ID = YOUTUBE_PLAYLISTS[0]?.id || "";

// YouTube's public Atom feed only returns this many entries per playlist —
// larger playlists need the playlist-page enumeration below to be complete.
const FEED_CAP = 15;

/* ------------------------------------------------------------------ */
/*  Playlist enumeration (no API key)                                  */
/* ------------------------------------------------------------------ */

/**
 * CORS relay templates for the browser build. YouTube's Atom feed sends no
 * CORS headers, so on web the feed is read through a relay. `{url}` is the
 * encoded feed URL. Native never uses these (no CORS on Pulse).
 *
 * The defaults cover both cases:
 *   - corsproxy.io — fast, but its free tier only allows localhost/dev origins
 *   - allorigins   — no origin restriction, works on production domains
 */
const DEFAULT_FEED_PROXIES = [
  "https://corsproxy.io/?url={url}",
  "https://api.allorigins.win/raw?url={url}",
];

const feedProxyTemplates = () => DEFAULT_FEED_PROXIES;

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
 * build relays the exact same feed through a CORS proxy (see
 * feedProxyTemplates).
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
 * Fetch the CURRENT video ids of a playlist. Returns { ids, player: null } to
 * keep the web call signature (the web version shared a hidden IFrame player
 * here; native uses the feed instead).
 *
 * The public feed caps playlists at ~15 entries, so when it hits that cap the
 * id set is augmented from YouTube's own playlist page (full keyless
 * enumeration — see fetchPlaylistPageEntries) so bigger playlists are complete.
 */
// NOTE: exported — PlayerContext's boot check imports it; without the export
// the light sync crashed ("undefined is not a function") and the app never
// refreshed the catalog from the API, only ever showing the cached copy.
export async function fetchPlaylistVideoIdsFromPlayer(playlistId = REFERENCE_PLAYLIST_ID) {
  const ids = await fetchPlaylistIds(playlistId);
  if (!ids.length) throw new Error("Playlist returned no videos");
  return { ids, player: null };
}

/** Feed ids, extended past the ~15-entry cap via the playlist page when needed. */
async function fetchPlaylistIds(playlistId) {
  const feedIds = await fetchFeedIds(playlistId);
  if (feedIds.length < FEED_CAP) return feedIds;
  // At the cap — the playlist may be larger. The page pass is defensive (it
  // returns [] on any failure), so a parse hiccup just keeps the feed result.
  const pageEntries = await fetchPlaylistPageEntries(playlistId);
  if (pageEntries.length > feedIds.length) return pageEntries.map((e) => e.youtubeId);
  return feedIds;
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

/* ------------------------------------------------------------------ */
/*  Full playlist enumeration (no API key, past the feed's 15-entry cap) */
/* ------------------------------------------------------------------ */

/**
 * The public feed stops at ~15 entries, but YouTube's own playlist page
 * (`/playlist?list=…`) embeds the FULL video list as JSON (ytInitialData),
 * paginated with continuation tokens. Reading that page is what the web app's
 * VITE_YOUTUBE_API_KEY path used an API key for; this keyless pass covers the
 * same ground on native (browsers are CORS-blocked, same as the feed, so web
 * keeps the feed path). Defensive by design: every failure mode falls back to
 * the feed result, so this can never make sync worse than it was.
 */

const YT_INNERTUBE_API = "https://www.youtube.com/youtubei/v1/browse";
const MAX_PAGE_ITEMS = 2000; // sane ceiling for the continuation loop

/** Return the balanced JSON object that starts at source[start] ('{'). */
function extractBalancedObject(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Pull the playlist's video entries + pagination info out of the page JSON. */
function parsePlaylistPage(json) {
  const entries = [];
  let token = "";
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const lock = node.lockupViewModel;
    if (lock && lock.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && lock.contentId) {
      const md = lock.metadata?.lockupMetadataViewModel;
      const rows = md?.metadata?.contentMetadataViewModel?.metadataRows || [];
      const authors = [];
      for (const row of rows) {
        for (const part of row?.metadataParts || []) {
          const text = part?.text?.content;
          if (text) authors.push(text);
        }
      }
      const durationText =
        lock.contentImage?.thumbnailViewModel?.overlays
          ?.flatMap((o) => o?.thumbnailBottomOverlayViewModel?.badges || [])
          .map((b) => b?.thumbnailBadgeViewModel?.text)
          .find(Boolean) || "";
      entries.push({
        youtubeId: lock.contentId,
        title: cleanTitle(md?.title?.content || ""),
        artist: authors[0] || "Unknown Artist",
        duration: parseClock(durationText),
        thumbnail: `https://i.ytimg.com/vi/${lock.contentId}/hqdefault.jpg`,
      });
    }
    // First continuation token wins — the playlist's own pagination appears
    // before any side-shelf (shorts etc.) continuations in the tree.
    const cont = node.continuationCommand?.token;
    if (cont && !token) token = cont;
    Object.values(node).forEach(walk);
  };
  walk(json);
  return { entries, token };
}

/** "1:44" / "1:02:03" (or a bare seconds count) → seconds. */
function parseClock(text = "") {
  const parts = text.trim().split(":").map((n) => Number(n));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 1) return parts[0] || 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** Fetch one continuation page and return { entries, token }. */
async function fetchContinuationPage(apiKey, context, token) {
  const res = await fetch(`${YT_INNERTUBE_API}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, continuation: token }),
  });
  if (!res.ok) throw new Error(`youtubei ${res.status}`);
  return parsePlaylistPage(await res.json());
}

/**
 * Enumerate a playlist's videos from its own page (full, keyless). Returns []
 * on any failure — callers treat that as "page pass unavailable". Native only:
 * browsers are CORS-blocked from reading youtube.com/playlist.
 */
async function fetchPlaylistPageEntries(playlistId) {
  if (Platform.OS === "web") return [];
  let html;
  try {
    const res = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }
  try {
    const dataStart = html.indexOf("ytInitialData");
    if (dataStart < 0) return [];
    const brace = html.indexOf("{", dataStart);
    const jsonText = extractBalancedObject(html, brace);
    if (!jsonText) return [];
    const { entries, token } = parsePlaylistPage(JSON.parse(jsonText));
    if (!token || entries.length >= MAX_PAGE_ITEMS) return entries;

    // Paginate past the first 100 via the page's own INNERTUBE credentials.
    const keyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const ctxStart = html.indexOf('"INNERTUBE_CONTEXT"');
    const ctxBrace = ctxStart >= 0 ? html.indexOf("{", ctxStart) : -1;
    const contextText = ctxBrace >= 0 ? extractBalancedObject(html, ctxBrace) : null;
    if (!keyMatch || !contextText) return entries;

    let all = entries;
    let nextToken = token;
    let page = 0;
    while (nextToken && all.length < MAX_PAGE_ITEMS && page < 25) {
      const more = await fetchContinuationPage(keyMatch[1], JSON.parse(contextText), nextToken);
      all = all.concat(more.entries);
      nextToken = more.token;
      page += 1;
    }
    return all;
  } catch {
    return [];
  }
}

/** Merge the page's full list with the feed's (keeps feed metadata when both
 * know a video, but lets the page's real duration win). Order = page order. */
function mergePlaylistEntries(feedEntries, pageEntries) {
  const byId = new Map(feedEntries.map((e) => [e.youtubeId, e]));
  return pageEntries.map((p) => {
    const f = byId.get(p.youtubeId);
    return f ? { ...f, duration: p.duration || f.duration } : p;
  });
}

/**
 * Full sync: enumerate every video in the live playlist and collect real
 * metadata (title, channel). Durations are learned at playback time and
 * written back into the catalog (see PlayerContext's position poller) — the
 * page pass also brings real durations in up front.
 */
async function fetchPlaylistWithMetadata(playlistId = REFERENCE_PLAYLIST_ID) {
  const xml = await fetchFeedXml(playlistId);
  let entries = parseFeedEntries(xml);
  if (!entries.length) {
    // Feed unavailable/empty — fall back to per-video oEmbed after an id pass.
    const { ids } = await fetchPlaylistVideoIdsFromPlayer(playlistId);
    entries = await fetchTitlesViaOEmbed(ids);
  }
  // The feed caps playlists at ~15 entries; when it hits that cap the playlist
  // may be larger, so fill in the rest (with real durations) from the playlist
  // page. No-op when the page pass is unavailable or finds nothing extra.
  if (entries.length >= FEED_CAP) {
    const full = await fetchPlaylistPageEntries(playlistId);
    if (full.length > entries.length) entries = mergePlaylistEntries(entries, full);
  }
  return backfillAuthors(entries);
}

/** Entry point used by the player context (same signature as the web app). */
export async function syncPlaylistFromYouTube(playlistId = REFERENCE_PLAYLIST_ID) {
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

function cleanTitle(title = "") {
  return title.replace(/\s*\(Official(?: Music)? Video\)\s*/i, "").trim();
}
