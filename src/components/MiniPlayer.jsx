import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { SkipBack, SkipForward, ListMusic, Maximize2 } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Artwork from "./Artwork";
import { ThinProgress } from "./ProgressBar";
import FavoriteButton from "./FavoriteButton";
import PlayPauseButton from "./PlayPauseButton";
import { useTheme } from "../lib/useTheme";
import { IconBtn } from "./ui";
import { AnimatedIn } from "../lib/motion";

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, nextTrack, previousTrack, setQueueOpen, provider, favorites, toggleFavorite } = usePlayer();
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // On narrow phones the six-button control row crowds the track info down to
  // nothing, so drop the two redundant buttons (the track press already opens
  // now-playing, and its top bar has the queue button). Both remain on wide
  // screens and tablets.
  const narrow = width < 360;

  if (!currentTrack) return null;

  return (
    <AnimatedIn distance={20} duration={300}>
      <View style={styles.wrap}>
        <ThinProgress style={styles.progress} />
        <View style={styles.inner}>
          {/* track info */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full now playing view"
            onPress={() => router.push("/now-playing")}
            style={styles.info}
          >
            <View>
              <Artwork src={currentTrack.thumbnail} alt="" gradient={currentTrack.gradient} size={48} rounded={12} />
              {isPlaying ? (
                <View style={[styles.liveDot, { backgroundColor: t.accent }]}>
                  <View style={[styles.liveDotInner, { backgroundColor: t.accentInk }]} />
                </View>
              ) : null}
            </View>
            <View style={styles.infoText}>
              <View style={styles.titleRow}>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.25}
                  style={[styles.title, { color: t.ink, fontFamily: t.fontBody[600] }]}
                >
                  {currentTrack.title}
                </Text>
                {/* {provider === "youtube" ? (
                  <View style={styles.ytBadge}>
                    <View style={[styles.ytDot, { backgroundColor: "#34d399" }]} />
                    <Text maxFontSizeMultiplier={1.25} style={styles.ytText}>YouTube</Text>
                  </View>
                ) : null} */}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[styles.artist, { color: t.dim }]}>{currentTrack.artist}</Text>
            </View>
          </Pressable>

          {/* transport */}
          <View style={styles.controls}>
            {/* <Pressable accessibilityRole="button" accessibilityLabel="Previous track" onPress={previousTrack} hitSlop={6}>
              <SkipBack size={19} fill={t.dim} color={t.dim} />
            </Pressable> */}
            <PlayPauseButton  size="xs" playing={isPlaying} onToggle={togglePlay} />
            {/* <Pressable accessibilityRole="button" accessibilityLabel="Next track" onPress={nextTrack} hitSlop={6}>
              <SkipForward size={19} fill={t.dim} color={t.dim} />
            </Pressable> */}
            {/* <FavoriteButton trackId={currentTrack.id} active={favorites.includes(currentTrack.id)} onToggle={toggleFavorite} size={15} /> */}

            {/* {!narrow && (
              <IconBtn label="Open queue" size={34} onPress={() => setQueueOpen(true)}>
                <ListMusic size={17} color={t.dim} />
              </IconBtn>
            )} */}
            {/* {!narrow && (
              <IconBtn label="Open now playing" size={34} onPress={() => router.push("/now-playing")}>
                <Maximize2 size={16} color={t.dim} />
              </IconBtn>
            )} */}
          </View>
        </View>
      </View>
    </AnimatedIn>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Solid panel — the chrome's opaque surface comes from BottomChrome.
    paddingHorizontal: 12,
  },
  progress: {
    position: "absolute",
    top: -2,
    left: 0,
    right: 0,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 72,
    paddingVertical: 8,
  },
  info: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 13,
    flexShrink: 1,
  },
  ytBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ytDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  ytText: {
    color: "#34d399",
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  artist: {
    fontSize: 12,
    marginTop: 1,
  },
  liveDot: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 25,
  },
});
