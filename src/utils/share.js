import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

/**
 * Native port of the web's shareTrack: opens the system share sheet with the
 * track title/artist + YouTube URL. If the share sheet is unavailable (or the
 * user cancels), it falls back to copying the link (same as the web app).
 */
export async function shareTrack(track, toast) {
  const text = `${track.title} — ${track.artist}`;
  const url = `https://www.youtube.com/watch?v=${track.youtubeId || track.id}`;
  try {
    const result = await Share.share({ message: `${text}\n${url}`, url, title: text });
    // User dismissed the sheet — no toast needed.
    if (result.action === Share.dismissedAction) return;
    return;
  } catch {
    // share sheet failed → clipboard fallback (same as web)
  }
  try {
    await Clipboard.setStringAsync(url);
    toast.push(`Link to “${track.title}” copied`, "success");
  } catch {
    toast.push("Couldn't copy the link", "error");
  }
}
