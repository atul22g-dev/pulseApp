/**
 * PULSE config — the YouTube playlists this app tracks.
 *
 * This is the ONLY file you need to edit to manage your playlists. Each entry
 * becomes its own playlist in the app (sidebar + /playlist/:id page), and every
 * song across all entries is aggregated into the library (home, search,
 * favorites, artists, albums, …). Songs added to any listed playlist appear
 * automatically; nothing here is hardcoded into the rest of the app.
 *
 * To add a playlist: paste its id from the playlist URL (?list=PL...) and give
 * it a name (and an optional description). Order matters — the first entry is
 * the one shown at /playlist.
 *
 *   {
 *     id: "PLIV4nZCjWE3E", // YouTube playlist ID like the one in the URL: https://www.youtube.com/playlist?list=PLIV4nZCjWE3E
 *     name: "Personal Songs", // name of the playlist in the app
 *     description: "Your personal collection, beautifully organized.", // optional description shown in the app
 *   },
 */

export const YOUTUBE_PLAYLISTS = [
  {
    id: "PLIV4nZCjWE3E",
    name: "Personal Songs",
    description: "Your personal collection, beautifully organized.",
  },
];
