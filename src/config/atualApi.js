/**
 * Atual API config — optional backend for playlist sync.
 *
 * Set EXPO_PUBLIC_ATUAL_API_KEY in `.env` to fetch playlists from
 * https://apis-atual-dev.vercel.app/api/playlists (GET /api/playlists with the
 * key in the `X-API-Key` header) instead of YouTube's public feed. When the
 * key is absent the app falls back to the feed / YouTube Data API path (see
 * src/services/youtubeService.js).
 *
 *   # .env
 *   EXPO_PUBLIC_ATUAL_API_KEY=your-key-here
 */
const ATUAL_API_BASE = "https://apis-atual-dev.vercel.app/api";

const atualApiKey = () => process.env.EXPO_PUBLIC_ATUAL_API_KEY || "";

export const isAtualApiConfigured = () => Boolean(atualApiKey());

export { ATUAL_API_BASE, atualApiKey };
