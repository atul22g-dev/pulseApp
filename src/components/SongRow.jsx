import { memo, useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Play, ListPlus, Heart, Share2, ExternalLink, X } from "lucide-react-native";
import { useToast } from "../context/ToastContext";
import Artwork from "./Artwork";
import FavoriteButton from "./FavoriteButton";
import { formatTime } from "../utils/format";
import { shareTrack } from "../utils/share";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";

// Stable per-bar ids — the eq bars never reorder or filter, but React list
// keys should still be a stable identifier rather than the array index.
const EQ_BAR_IDS = ["eq-0", "eq-1", "eq-2", "eq-3"];

function EqBars() {
  const t = useTheme();
  const heights = useRef([10, 6, 14, 8]);
  useEffect(() => {
    const iv = setInterval(() => {
      heights.current = heights.current.map(() => 5 + Math.random() * 11);
      setTick((x) => x + 1);
    }, 320);
    return () => clearInterval(iv);
  }, []);
  const [, setTick] = useState(0);
  return (
    <View style={styles.eq} accessibilityElementsHidden>
      {EQ_BAR_IDS.map((id, i) => (
        <View key={id} style={[styles.eqBar, { height: heights.current[i], backgroundColor: t.accent }]} />
      ))}
    </View>
  );
}

// Memoized so a list of N rows re-renders only the 1-2 rows whose own props
// changed (current track, playing state, favorite state) — not the whole list
// on every play/pause. All player data arrives via props from SongList, so a
// row never subscribes to the player context itself.
const SongRow = memo(function SongRow({
  track, index, state = "idle", onPlay, showAlbum = true,
  isFavorite, onToggleFavorite, onAddToQueue,
}) {
  const toast = useToast();
  const t = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  // `state` is a discriminated variant of the mutually-exclusive row states
  // (idle / current / playing) — one explicit shape instead of juggling the
  // old isCurrent + isPlaying boolean pair.
  const isCurrent = state !== "idle";
  const isPlaying = state === "playing";

  const rowClick = () => {
    setMenuOpen(false);
    onPlay(track, index);
  };

  const openYouTube = () => {
    Linking.openURL(`https://www.youtube.com/watch?v=${track.youtubeId || track.id}`).catch(() => {});
  };

  return (
    <View
      style={[
        styles.row,
        isCurrent
          ? { backgroundColor: alpha(t.accent, 0.08), borderLeftColor: t.accent }
          : { borderLeftColor: "transparent" },
      ]}
    >
      {/* play region */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        onPress={rowClick}
        style={({ pressed }) => [styles.playRegion, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.indexWrap}>
          {isCurrent && isPlaying ? (
            <EqBars />
          ) : (
            <View style={styles.indexInner}>
              <Text style={[styles.index, { color: t.faint, fontFamily: t.fontMono[400] }]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Play size={15} fill={t.ink} color={t.ink} style={styles.playOverlay} />
            </View>
          )}
        </View>

        <Artwork src={track.thumbnail} alt={`${track.title} artwork`} gradient={track.gradient} size={44} rounded={10} />

        <View style={styles.titleWrap}>
          <Text
            numberOfLines={1}
            style={[styles.title, isCurrent ? { color: t.accent } : { color: t.ink }, { fontFamily: t.fontBody[600] }]}
          >
            {track.title}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: t.dim }]}>{track.artist}</Text>
        </View>
      </Pressable>

      {showAlbum ? (
        <Text numberOfLines={1} style={[styles.album, { color: t.dim }]}>{track.album}</Text>
      ) : null}

      <Text style={[styles.duration, { color: t.faint, fontFamily: t.fontMono[400] }]}>
        {formatTime(track.duration)}
      </Text>

      <View style={styles.actions}>
        <FavoriteButton trackId={track.id} active={isFavorite} onToggle={onToggleFavorite} size={16} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${track.title}`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMenuOpen((o) => !o);
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: white(0.1) }]}
        >
          <View style={styles.moreDots}>
            <View style={[styles.dot, { backgroundColor: t.faint }]} />
            <View style={[styles.dot, { backgroundColor: t.faint }]} />
            <View style={[styles.dot, { backgroundColor: t.faint }]} />
          </View>
        </Pressable>
      </View>

      <SongMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        track={track}
        fav={isFavorite}
        onPlayNext={() => {
          onAddToQueue(track, { playNext: true });
          setMenuOpen(false);
        }}
        onAddQueue={() => {
          onAddToQueue(track);
          setMenuOpen(false);
        }}
        onToggleFav={() => {
          onToggleFavorite(track.id);
          setMenuOpen(false);
        }}
        onShare={() => {
          shareTrack(track, toast);
          setMenuOpen(false);
        }}
        onYouTube={openYouTube}
      />
    </View>
  );
});

function SongMenu({ visible, onClose, track, fav, onPlayNext, onAddQueue, onToggleFav, onShare, onYouTube }) {
  const t = useTheme();
  const items = [
    { icon: ListPlus, label: "Play next", onPress: onPlayNext },
    { icon: ListPlus, label: "Add to queue", onPress: onAddQueue },
    { icon: Heart, label: fav ? "Remove from favorites" : "Add to favorites", onPress: onToggleFav },
    { icon: Share2, label: "Share", onPress: onShare },
    { icon: ExternalLink, label: "Open on YouTube", onPress: onYouTube },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.sheet, { backgroundColor: alpha(t.elevated, 0.72), borderColor: white(0.1) }]}>
        <BlurView
          intensity={30}
          tint={t.theme === "light" ? "light" : "dark"}
          style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
        />
        <View style={[styles.grabber, { backgroundColor: white(0.15) }]} />
        <Text numberOfLines={1} style={[styles.sheetTitle, { color: t.ink, fontFamily: t.fontDisplay[600] }]}>
          {track.title}
        </Text>
        {items.map(({ icon: Icon, label, onPress }, i) => (
          <Pressable
            key={label}
            onPress={onPress}
            style={({ pressed }) => [styles.sheetItem, i === items.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: white(0.08) }]}
          >
            <Icon size={17} color={t.dim} />
            <Text style={[styles.sheetItemLabel, { color: t.dim, fontFamily: t.fontBody[500] }]}>{label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.sheetCancel}>
          <X size={15} color={t.faint} />
          <Text style={[styles.sheetCancelLabel, { color: t.faint }]}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  playRegion: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  indexWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  indexInner: {
    position: "relative",
  },
  index: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  playOverlay: {
    position: "absolute",
    top: -7,
    left: 2,
    opacity: 0,
  },
  eq: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 16,
  },
  eqBar: {
    width: 3,
    borderRadius: 2,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13.5,
  },
  artist: {
    fontSize: 12,
    marginTop: 1,
  },
  album: {
    width: 120,
    fontSize: 12.5,
    display: "none", // hidden on narrow screens (mobile-first like the web)
  },
  duration: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  moreDots: {
    flexDirection: "row",
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    padding: 16,
    paddingBottom: 34,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetItemLabel: {
    fontSize: 13.5,
  },
  sheetCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  sheetCancelLabel: {
    fontSize: 13,
  },
});

export default SongRow;
