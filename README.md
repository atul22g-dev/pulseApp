# PULSE — Mobile (Expo)

A fully native **Expo (React Native)** port of the PULSE personal music player
web app (React + Vite + Tailwind). Same product, same data model, same
`music-player-*` storage keys — no backend, no accounts, fully local.

The source web app is untouched; everything here lives in `mobile/`.

## Run it

```bash
cd mobile
npm install

# Expo Go (fastest — all libraries used here are Expo Go compatible)
npx expo start          # then scan the QR with Expo Go, or press a / i

# Development build (native modules, background audio config)
npx expo run:android    # or npx expo run:ios
```

`app.json` already configures the audio background mode
(`UIBackgroundModes: ["audio"]`), portrait orientation, a dark splash and the
PULSE branding.

### YouTube sync

- **No API key required** (default): the catalog is read from the configured
  playlist via YouTube's public feed + the oEmbed endpoint. Titles, artists
  and video ids come straight from those official endpoints; durations are
  learned during playback and written back into the catalog.
- **Atual API (optional)**: set `EXPO_PUBLIC_ATUAL_API_KEY` in `.env` to fetch
  playlists from `https://apis-atual-dev.vercel.app/api/playlists` (key sent
  as the `X-API-Key` header) instead of the public feed — see
  `src/config/atualApi.js`.
- **YouTube Data API (optional)**: set `EXPO_PUBLIC_YOUTUBE_API_KEY` in `.env`
  to switch sync to the YouTube Data API v3 (full pagination, durations
  included) — the equivalent of the web app's `VITE_YOUTUBE_API_KEY` path.
  Precedence: Atual API > YouTube Data API > public feed.
- **CORS relay (web builds only)**: YouTube's feed sends no CORS headers, so
  the browser reads it through a relay. Local dev works out of the box
  (corsproxy.io + an allorigins fallback); for production web deployments set
  `EXPO_PUBLIC_FEED_PROXY` to your own relay — a URL template containing
  `{url}`, or a comma-separated list tried in order. Native never uses it.
- The cached catalog (`music-player-catalog-v3`) renders the whole app
  instantly on cold start, fully offline.

## Stack & library swaps vs. the web app

| Concern | Web | Native (this app) | Notes |
| --- | --- | --- | --- |
| Framework | React + Vite | Expo SDK 54 + expo-router | file-based routing, `src/app/` |
| Styling | Tailwind CSS vars | Inline styles driven by a `ThemeContext` (same 3 themes × 5 accents, same hex values) | NativeWind v4 is wired up for utility classes; colors are resolved at runtime via `src/lib/theme.js` |
| Storage | `localStorage` (`music-player-*`) | `@react-native-async-storage/async-storage`, **same keys & shapes** | Sync `load`/`save` API kept via an in-memory map hydrated before render |
| Audio (synth fallback) | Live Web Audio oscillators | Same composition **rendered offline to a WAV** (seeded per track) and played by `expo-audio` | Required for background audio + lock-screen controls (native has no Web Audio API) |
| Audio (YouTube) | IFrame Player API (hidden 2×2 embed) | `react-native-youtube-iframe` (WebView + IFrame API), driven through a hidden off-screen `<YoutubeBridge/>` | Same provider surface; no audio is extracted |
| Icons | lucide-react | `lucide-react-native` | |
| Share | `navigator.share` / clipboard | RN `Share` sheet + `expo-clipboard` fallback | |
| Visualizer | Canvas frequency bars | Deterministic animated bars (Reanimated-style, RN Animated) | expo-audio exposes no analyser; uses the web app's sine-wave fallback |
| Queue reorder | HTML5 drag & drop | `PanResponder` drag rows in the queue drawer | |
| Keyboard shortcuts | Space/←/→/↑/↓/F | On-screen controls + hardware volume keys; lock-screen play/pause via expo-audio (synth mode) | |
| Toasts | Custom DOM overlay | Same custom overlay (RN views), no notification library | |
| Haptics | — | `expo-haptics` on favorite / queue actions | |
| Keep awake | — | `expo-keep-awake` on Now Playing | |

Other notable substitutions:

- **Slider** — `@react-native-community/slider` (RN core's `Slider` was
  removed).
- **Image** — `expo-image` (caching + graceful fallback to the gradient
  artwork).
- **Fonts** — `@expo-google-fonts/{inter,sora,jetbrains-mono}` (the same
  three families as the web app).
- **Playlist id enumeration (no API key)** — the web app used a hidden
  IFrame player's `cuePlaylist`/`getPlaylist`; `react-native-youtube-iframe`
  doesn't expose those getters, so native uses YouTube's public
  `feeds/videos.xml` endpoint instead. Note: the public feed caps playlists at
  ~15 entries — larger libraries should set `EXPO_PUBLIC_YOUTUBE_API_KEY`.

## Behavioral changes vs. the web app (with justification)

1. **Synth fallback is pre-rendered audio, not live synthesis.** The web
   engine schedules oscillators in real time; React Native has no Web Audio
   API, and a real-time synthesizer would fight the OS audio session. The
   identical seeded composition is rendered once to a cached WAV (per track)
   and played through expo-audio — which also delivers the native-only
   requirements: background playback, lock-screen title/artist, play/pause.
   Renders cap at 6 minutes for tracks with unknown durations.
2. **Lock-screen controls are only bound to the synth provider.** expo-audio
   binds lock-screen metadata + play/pause to its own players; the YouTube
   WebView keeps playing in the background but has no media-session metadata
   (its stream is inside the iframe). The provider badge and toasts make the
   active provider visible.
3. **Playlist enumeration without an API key uses the YouTube feed** (see
   above) instead of the hidden-player `getPlaylist()` readback.
4. **No keyboard shortcuts.** Mobile has no keyboard; shortcuts became
   on-screen controls, hardware volume keys, and lock-screen play/pause.
5. **First-visit skeletons** use an in-memory session flag instead of
   `sessionStorage`.
6. **Catalog search/sort** in Playlist uses a compact sort toggle instead of a
   `<select>` dropdown (idiomatic on touch).
7. **Queue options menu** is a bottom sheet instead of a hover dropdown
   (idiomatic on touch); the "Open on YouTube" item uses `Linking`.

## Project structure

```
src/app/            expo-router routes (all 10 web routes mapped 1:1)
src/pages/          page ports (same content, same order as the web app)
src/components/     shared UI ports (Artwork, SongRow, MiniPlayer, QueueDrawer,
                    Visualizer, toasts, skeletons, …)
src/context/        PlayerContext (ported with minimal edits) + ToastContext
src/services/       audioEngine (same surface), youtubeService, synthRenderer,
                    storage (AsyncStorage, same keys)
src/data/           tracks.js / playlists.js (ported as-is, live getters)
src/config/         youtubePlaylists.js — the only file to edit for playlists
src/lib/            theme tokens (3 themes × 5 accents) + ThemeContext
```
