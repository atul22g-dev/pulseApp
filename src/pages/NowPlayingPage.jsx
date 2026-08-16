import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Share2, Play, Pause,
} from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import { useToast } from "../context/ToastContext";
import Artwork from "../components/Artwork";
import Visualizer from "../components/Visualizer";
import ProgressBar from "../components/ProgressBar";
import VolumeControl from "../components/VolumeControl";
import FavoriteButton from "../components/FavoriteButton";
import EmptyState from "../components/EmptyState";
import { shareTrack } from "../utils/share";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { IconBtn } from "../components/ui";
import { TAB_BAR_HEIGHT } from "../components/BottomNavigation";
import { AnimatedIn, PressableScale } from "../lib/motion";

export default function NowPlayingPage() {
  useKeepAwake();
  const {
    currentTrack, isPlaying, togglePlay, nextTrack, previousTrack,
    shuffle, repeat, toggleShuffle, cycleRepeat, setQueueOpen, provider,
    favorites, toggleFavorite,
  } = usePlayer();
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  if (!currentTrack) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: t.bg }]}>
        <EmptyState
          icon={Play}
          title="Nothing is playing"
          message="Head to your playlist and pick a song to fill this screen with music."
          action={{ to: "/playlist", label: "Go to playlist" }}
        />
      </View>
    );
  }

  // Ambient glow follows the artwork's own colors so each track gets a
  // distinct, immersive backdrop (re-keyed per track for a fresh wash).
  const g = currentTrack.gradient || [t.accent, t.accentStrong];

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* ambient background — tinted by the current track's artwork colors */}
      <View key={currentTrack.id} style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <LinearGradient
          colors={[alpha(g[0], 0.34), alpha(t.bg, 0), t.bg]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.ambient1, { backgroundColor: alpha(g[0], 0.22) }]} />
        <View style={[styles.ambient2, { backgroundColor: alpha(g[1], 0.16) }]} />
      </View>

      {/* Scrollable so short phones never clip the transport/secondary row,
          with bottom padding so controls clear the tab bar + home indicator. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar */}
        <View style={styles.topBar}>
          <IconBtn label="Go back" onPress={() => router.back()}>
            <ArrowLeft size={19} color={t.dim} />
          </IconBtn>
          <View style={styles.topCenter}>
            <Text style={[styles.nowLabel, { color: t.faint, fontFamily: t.fontBody[700] }]}>Now Playing</Text>
            <Text onPress={() => router.push("/playlist")} style={[styles.albumLink, { color: t.accent, fontFamily: t.fontBody[500] }]}>
              {currentTrack.album}
            </Text>
          </View>
          <IconBtn label="Open queue" onPress={() => setQueueOpen(true)}>
            <ListMusic size={19} color={t.dim} />
          </IconBtn>
        </View>

        {/* artwork with accent glow ring */}
        <AnimatedIn distance={16} duration={380}>
          <View style={styles.artWrap}>
            <View style={[styles.glowRing, { backgroundColor: alpha(t.accent, 0.12), boxShadow: `0px 0px 42px ${alpha(t.accent, 0.55)}` }]} />
            <View style={[styles.vinylRing, { borderColor: white(0.1) }]} />
            <Artwork
              src={currentTrack.thumbnail}
              alt={`${currentTrack.title} artwork`}
              gradient={currentTrack.gradient}
              size={230}
              rounded={26}
            />
          </View>
        </AnimatedIn>

        {/* title */}
        <View style={styles.titleBlock}>
          <Text numberOfLines={2} style={[styles.title, { color: t.ink, fontFamily: t.fontDisplay[800] }]}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.artist, { color: t.dim, fontFamily: t.fontBody[500] }]}>{currentTrack.artist}</Text>
          {/* {provider === "youtube" ? (
            <View style={styles.liveBadge}>
              <View style={[styles.liveDot, { backgroundColor: "#34d399" }]} />
              <Text style={[styles.liveText, { color: "#34d399", fontFamily: t.fontBody[700] }]}>Playing live from YouTube</Text>
            </View>
          ) : null} */}
        </View>

        {/* visualizer */}
        <Visualizer style={styles.viz} bars={52} height={30} ariaLabel="Now playing visualizer" />

        {/* progress */}
        <ProgressBar style={styles.progress} />

        {/* transport — glass dock */}
        <View style={[styles.dock, { backgroundColor: alpha(t.surface, 0.55), borderColor: white(0.1) }]}>
          <BlurView
            intensity={26}
            tint={t.theme === "light" ? "light" : "dark"}
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          />
          <View style={styles.transport}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
              accessibilityState={{ selected: shuffle }}
              onPress={toggleShuffle}
              hitSlop={8}
            >
              <Shuffle size={17} color={shuffle ? t.accent : t.dim} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous track" onPress={previousTrack} hitSlop={8}>
              <SkipBack size={22} fill={t.dim} color={t.dim} />
            </Pressable>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              onPress={togglePlay}
              scale={0.9}
              style={styles.bigPlayWrap}
            >
              <LinearGradient
                colors={t.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bigPlay, { boxShadow: `0px 8px 22px ${alpha(t.accent, 0.5)}` }]}
              >
                {isPlaying ? (
                  <Pause size={30} fill={t.accentInk} color={t.accentInk} />
                ) : (
                  <Play size={30} fill={t.accentInk} color={t.accentInk} style={{ marginLeft: 3 }} />
                )}
              </LinearGradient>
            </PressableScale>
            <Pressable accessibilityRole="button" accessibilityLabel="Next track" onPress={nextTrack} hitSlop={8}>
              <SkipForward size={22} fill={t.dim} color={t.dim} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Repeat mode"
              onPress={cycleRepeat}
              hitSlop={8}
            >
              {repeat === "one" ? (
                <Repeat1 size={17} color={repeat !== "off" ? t.accent : t.dim} />
              ) : (
                <Repeat size={17} color={repeat !== "off" ? t.accent : t.dim} />
              )}
            </Pressable>
          </View>
        </View>

        {/* secondary row */}
        <View style={styles.secondary}>
          <FavoriteButton trackId={currentTrack.id} active={favorites.includes(currentTrack.id)} onToggle={toggleFavorite} size={19} />
          <View style={styles.volume}>
            <VolumeControl />
          </View>
          <IconBtn label="Share track" onPress={() => shareTrack(currentTrack, toast)}>
            <Share2 size={17} color={t.dim} />
          </IconBtn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  root: {
    paddingTop: 18,
    flex: 1,
  },
  ambient1: {
    position: "absolute",
    top: -60,
    left: "50%",
    marginLeft: -230,
    width: 460,
    height: 460,
    borderRadius: 230,
  },
  ambient2: {
    position: "absolute",
    bottom: -110,
    left: 30,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCenter: {
    alignItems: "center",
  },
  nowLabel: {
    fontSize: 10.5,
    letterSpacing: 2.2,
  },
  albumLink: {
    fontSize: 12,
    marginTop: 1,
  },
  artWrap: {
    marginTop: 30,
  },
  glowRing: {
    position: "absolute",
    top: -34,
    left: -34,
    right: -34,
    bottom: -34,
    borderRadius: 999,
  },
  vinylRing: {
    position: "absolute",
    top: -24,
    left: -24,
    right: -24,
    bottom: -24,
    borderRadius: 999,
    borderWidth: 1,
  },
  titleBlock: {
    marginTop: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  artist: {
    fontSize: 14,
    marginTop: 6,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    letterSpacing: 1,
  },
  viz: {
    marginTop: 22,
    width: "100%",
    maxWidth: 420,
  },
  progress: {
    marginLeft: 4,
    marginTop: 16,
    maxWidth: 430,
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: "hidden",
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  bigPlayWrap: {
    borderRadius: 36,
  },
  bigPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 26,
    width: "100%",
    maxWidth: 420,
  },
  volume: {
    flex: 1,
  },
});
