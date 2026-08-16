import { memo, useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePlayer } from "../context/PlayerContext";
import SongRow from "./SongRow";
import { useTheme } from "../lib/useTheme";
import { AnimatedIn } from "../lib/motion";

// Above this many rows the per-row entrance animation stops being a nice
// cascade and just costs startup time (each AnimatedIn mounts a shared value
// and schedules a delay), so large lists mount instantly instead.
const MAX_ANIMATED_ROWS = 40;

const SongList = memo(function SongList({ tracks, showAlbum = true, showHeader = false, style, empty }) {
  const { currentTrack, isPlaying, playTrack, favorites, toggleFavorite, addToQueue } = usePlayer();
  const t = useTheme();

  // Stable callbacks: rows are memoized, so prop identity must survive
  // re-renders or the memoization is defeated. playTrack / toggleFavorite /
  // addToQueue are themselves stable (PlayerContext), so these only change
  // when `tracks` changes.
  const onPlay = useCallback(
    (track, index) => playTrack(track, { queue: tracks, index }),
    [playTrack, tracks]
  );
  const onToggleFavorite = useCallback((id) => toggleFavorite(id), [toggleFavorite]);
  const onAddToQueue = useCallback((track, opts) => addToQueue(track, opts), [addToQueue]);

  // Every row checks whether its track is favorited, so hoist the favorites
  // array into a Set for constant-time lookups instead of an O(n) scan per
  // row. Rebuilt only when favorites actually changes.
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  if (!tracks.length) return empty || null;

  const animate = tracks.length <= MAX_ANIMATED_ROWS;

  return (
    <View style={style}>
      {showHeader ? (
        // Column labels mirror SongRow's geometry (index + artwork + title / duration
        // / actions) so the header lines up with the rows underneath it.
        <View style={styles.header}>
          <Text style={[styles.headerCell, { color: t.faint, fontFamily: t.fontBody[600] }]}>#</Text>
          <View style={styles.headerArt} />
          <Text style={[styles.headerTitle, { color: t.faint, fontFamily: t.fontBody[600] }]}>Title</Text>
          <Text style={[styles.headerDur, { color: t.faint, fontFamily: t.fontBody[600] }]}>Duration</Text>
          <View style={styles.headerActions} />
        </View>
      ) : null}
      <View style={styles.list}>
        {tracks.map((track, index) => {
          const row = (
            <SongRow
              track={track}
              index={index}
              state={
                currentTrack?.id === track.id ? (isPlaying ? "playing" : "current") : "idle"
              }
              onPlay={onPlay}
              showAlbum={showAlbum}
              isFavorite={favSet.has(track.id)}
              onToggleFavorite={onToggleFavorite}
              onAddToQueue={onAddToQueue}
            />
          );
          return animate ? (
            <AnimatedIn key={track.id} delay={Math.min(index, 14) * 30} distance={12} duration={240}>
              {row}
            </AnimatedIn>
          ) : (
            <View key={track.id}>{row}</View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerCell: {
    width: 28,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1,
  },
  headerArt: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: 11,
    letterSpacing: 1,
  },
  headerDur: {
    fontSize: 11,
    letterSpacing: 1,
  },
  // Matches the width of the favorite + overflow buttons on each row.
  headerActions: {
    width: 66,
  },
  list: {
    gap: 2,
  },
});

export default SongList;
