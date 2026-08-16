import { Children } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Play } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Artwork from "./Artwork";
import { pluralize, formatTime } from "../utils/format";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";

// Stable per-bar ids for the mini equalizer — the bars never reorder or
// filter, but React list keys should be a stable identifier, not the index.
const MINI_EQ_BARS = [
  { id: "mini-eq-0", h: 8 },
  { id: "mini-eq-1", h: 5 },
  { id: "mini-eq-2", h: 11 },
];

function PlayOverlay({ size = 46 }) {
  const t = useTheme();
  return (
    <View style={[styles.playOverlay, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent }]}>
      <Play size={size * 0.42} fill={t.accentInk} color={t.accentInk} style={{ marginLeft: 2 }} />
    </View>
  );
}

const cardPressStyle = ({ pressed }) => [pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }];

/**
 * Two-column responsive card grid (cards wrap 47%-wide). Used by the Albums /
 * Artists / Search pages and the playlist overview — one layout, one style.
 */
export function CardGrid({ children, style }) {
  return (
    <View style={[styles.grid, style]}>
      {Children.map(children, (child) => (child ? <View style={styles.gridItem}>{child}</View> : null))}
    </View>
  );
}

export function AlbumCard({ album }) {
  const { playTrack } = usePlayer();
  const t = useTheme();
  const router = useRouter();
  const tracks = album.tracks;

  const open = () => router.push(`/albums/${encodeURIComponent(album.name)}`);

  return (
    <Pressable onPress={open} accessibilityLabel={`Open album ${album.name} by ${album.artist}`} style={cardPressStyle}>
      <View style={styles.card}>
        <View>
          <Artwork src={album.thumbnail} alt={`${album.name} artwork`} gradient={album.gradient} style={styles.cardArt} rounded={16} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play album ${album.name}`}
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              playTrack(tracks[0], { queue: tracks, index: 0 });
            }}
            style={styles.playBtn}
          >
            <PlayOverlay size={44} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={[styles.cardTitle, { color: t.ink, fontFamily: t.fontBody[600] }]}>{album.name}</Text>
        <Text numberOfLines={1} style={[styles.cardSub, { color: t.dim }]}>
          {album.artist} · {pluralize(tracks.length, "song")}
        </Text>
      </View>
    </Pressable>
  );
}

export function ArtistCard({ artist }) {
  const { playTrack } = usePlayer();
  const t = useTheme();
  const router = useRouter();
  const tracks = artist.tracks;

  return (
    <Pressable onPress={() => router.push(`/artists/${encodeURIComponent(artist.name)}`)} accessibilityLabel={`Open artist ${artist.name}`} style={cardPressStyle}>
      <View style={[styles.card, styles.artistCard]}>
        <View>
          <View style={styles.artistArtWrap}>
            <Artwork src={artist.thumbnail} alt={`${artist.name} portrait`} gradient={artist.gradient} style={styles.artistArt} rounded={999} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play ${artist.name}`}
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              playTrack(tracks[0], { queue: tracks, index: 0 });
            }}
            style={styles.playBtnSmall}
          >
            <PlayOverlay size={38} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={[styles.cardTitle, styles.centerText, { color: t.ink, fontFamily: t.fontBody[600] }]}>{artist.name}</Text>
        <Text style={[styles.cardSub, styles.centerText, { color: t.dim }]}>{pluralize(tracks.length, "song")}</Text>
      </View>
    </Pressable>
  );
}

/** Horizontal track card used in “recently played” strips. */
export function TrackCard({ track }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const t = useTheme();
  const active = currentTrack?.id === track.id;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title}`}
      onPress={() => playTrack(track, { queue: [track], index: 0 })}
      style={({ pressed }) => [
        styles.trackCard,
        active
          ? { borderColor: alpha(t.accent, 0.3), backgroundColor: alpha(t.accent, 0.08) }
          : { borderColor: white(0.06), backgroundColor: alpha(t.surface, 0.6) },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <View>
        <Artwork src={track.thumbnail} alt="" gradient={track.gradient} size={48} rounded={12} />
        <View style={styles.trackArtOverlay}>
          {active && isPlaying ? (
            <View style={styles.miniEq}>
              {MINI_EQ_BARS.map((b) => (
                <View key={b.id} style={[styles.miniEqBar, { height: b.h, backgroundColor: t.accent }]} />
              ))}
            </View>
          ) : (
            <Play size={17} fill="#fff" color="#fff" style={{ marginLeft: 1 }} />
          )}
        </View>
      </View>
      <View style={styles.trackText}>
        <Text numberOfLines={1} style={[styles.trackTitle, active ? { color: t.accent } : { color: t.ink }, { fontFamily: t.fontBody[600] }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={[styles.trackArtist, { color: t.dim }]}>{track.artist}</Text>
        <Text style={[styles.trackDur, { color: t.faint, fontFamily: t.fontMono[400] }]}>{formatTime(track.duration)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginTop: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  gridItem: {
    width: "47%",
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    padding: 12,
  },
  cardArt: {
    width: "100%",
    aspectRatio: 1,
  },
  cardTitle: {
    fontSize: 13.5,
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  playBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },
  playBtnSmall: {
    position: "absolute",
    right: 4,
    bottom: 4,
  },
  playOverlay: {
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 5px 12px rgba(0,0,0,0.35)",
  },
  artistCard: {
    alignItems: "center",
  },
  artistArtWrap: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 999,
  },
  artistArt: {
    width: "100%",
    height: "100%",
  },
  centerText: {
    textAlign: "center",
  },
  trackCard: {
    width: 176,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  trackArtOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  trackText: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 12.5,
  },
  trackArtist: {
    fontSize: 11.5,
    marginTop: 1,
  },
  trackDur: {
    fontSize: 10,
    marginTop: 3,
  },
  miniEq: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  miniEqBar: {
    width: 3,
    borderRadius: 2,
  },
});
