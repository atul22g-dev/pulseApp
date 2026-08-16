import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { X, ListMusic, Trash2, Save, Play, Pause, Music, GripVertical } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Artwork from "./Artwork";
import { formatTime } from "../utils/format";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { SPRING, useMotion } from "../lib/motion";

function QueueRow({ index, track, queue, queueIndex, dragIndex, translateY, setDragIndex, onReorder, onRemove, onPlay }) {
  const t = useTheme();
  const realIndex = queue.indexOf(track);
  const active = realIndex === queueIndex;
  const dragging = dragIndex === index;

  // Drag-to-reorder via gesture-handler (native gesture recognition) instead of
  // the JS-thread PanResponder. Same thresholds as before: the drag engages
  // after ~6px of vertical movement and reorders past 50px. The row follows the
  // finger on the UI thread; JS-only side effects (state, haptics, reorder)
  // hop back with scheduleOnRN. Indices use `realIndex` (position in the full
  // queue) since reorderQueue operates on the whole queue, not just the
  // upcoming (filtered) slice.
  const pan = useMemo(() => {
    const reorder = (from, to) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onReorder(from, to);
    };
    return Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onBegin(() => {
        translateY.value = 0;
        scheduleOnRN(setDragIndex, index);
      })
      .onUpdate((e) => {
        translateY.value = e.translationY;
      })
      .onEnd((e) => {
        const dy = e.translationY;
        if (dy < -50 && realIndex > 0) {
          scheduleOnRN(reorder, realIndex, realIndex - 1);
        } else if (dy > 50 && realIndex < queue.length - 1) {
          scheduleOnRN(reorder, realIndex, realIndex + 1);
        }
      })
      .onFinalize(() => {
        translateY.value = withSpring(0, SPRING.pop);
        scheduleOnRN(setDragIndex, null);
      });
  }, [index, realIndex, queue.length, translateY, setDragIndex, onReorder]);

  // Drags follow the shared value live; when not dragging the row sits still.
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragging ? translateY.value : 0 }],
    opacity: dragging ? 0.85 : 1,
  }));

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.rowInner}>
          <GripVertical size={14} color={t.faint} style={styles.grip} />
          <Pressable
            style={styles.rowMain}
            onPress={() => onPlay(track, { queue, index: realIndex })}
            accessibilityLabel={`Play ${track.title}`}
          >
            <Text
              numberOfLines={1}
              style={[styles.rowTitle, active ? { color: t.accent } : { color: t.ink }, { fontFamily: t.fontBody[500] }]}
            >
              {track.title}
            </Text>
            <Text numberOfLines={1} style={[styles.rowArtist, { color: t.dim }]}>{track.artist}</Text>
          </Pressable>
          <Text style={[styles.rowDur, { color: t.faint, fontFamily: t.fontMono[400] }]}>{formatTime(track.duration)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${track.title} from queue`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRemove(realIndex);
            }}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <X size={14} color={t.faint} />
          </Pressable>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

export default function QueueDrawer() {
  const {
    queue, queueIndex, currentTrack, isPlaying, queueOpen, setQueueOpen,
    togglePlay, removeFromQueue, clearQueue, reorderQueue, saveQueueAsPlaylist, playTrack,
  } = usePlayer();
  const t = useTheme();

  const [dragIndex, setDragIndex] = useState(null);
  const translateY = useSharedValue(0);
  const panelX = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);
  const { reduced } = useMotion();

  // Spring the panel in from the right (and fade the backdrop) on open.
  const openDrawer = useCallback(() => {
    if (reduced) {
      panelX.value = 0;
      backdropOpacity.value = 1;
      return;
    }
    panelX.value = 400;
    backdropOpacity.value = 0;
    panelX.value = withSpring(0, SPRING.drawer);
    backdropOpacity.value = withTiming(1, { duration: 220 });
  }, [reduced, panelX, backdropOpacity]);

  useEffect(() => {
    if (queueOpen) openDrawer();
  }, [queueOpen, openDrawer]);

  // Slide out (instead of vanishing) before unmounting the modal.
  const close = useCallback(() => {
    if (reduced) {
      setQueueOpen(false);
      return;
    }
    panelX.value = withTiming(400, { duration: 220 }, (finished) => {
      if (finished) setQueueOpen(false);
    });
    backdropOpacity.value = withTiming(0, { duration: 200 });
  }, [reduced, panelX, backdropOpacity, setQueueOpen]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelX.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Guard against any stray falsy entry (e.g. a queue persisted by an older
  // session before the context began filtering) — a null track would crash
  // the row render below on `track.qid`.
  const upcoming = queue.filter((t, i) => t && i !== queueIndex);

  return (
    <Modal visible={queueOpen} transparent animationType="none" onRequestClose={close}>
      {/* The backdrop covers the whole window; on web the panel aligns to the
          same centered column as the app frame so it doesn't sit at the far
          right edge of a wide desktop window. */}
      <View style={[styles.root, Platform.OS === "web" && styles.webRoot]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close queue" />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: alpha(t.surface, 0.62),
              borderLeftColor: white(0.08),
            },
            panelStyle,
          ]}
        >
          <BlurView
            intensity={30}
            tint={t.theme === "light" ? "light" : "dark"}
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          />
          {/* header */}
          <View style={[styles.header, { borderBottomColor: white(0.06) }]}>
            <Text style={[styles.headerTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>
              <ListMusic size={18} color={t.accent} /> Queue
            </Text>
            <View style={styles.headerActions}>
              <Pressable onPress={saveQueueAsPlaylist} style={[styles.chip, { borderColor: white(0.1), backgroundColor: white(0.05) }]}>
                <Save size={13} color={t.dim} />
                <Text style={[styles.chipLabel, { color: t.dim }]}>Save</Text>
              </Pressable>
              <Pressable onPress={clearQueue} style={[styles.chip, { borderColor: white(0.1), backgroundColor: white(0.05) }]}>
                <Trash2 size={13} color="#fb7185" />
                <Text style={[styles.chipLabel, { color: "#fb7185" }]}>Clear</Text>
              </Pressable>
              <Pressable onPress={close} hitSlop={8} style={styles.closeBtn}>
                <X size={17} color={t.dim} />
              </Pressable>
            </View>
          </View>

          <View style={styles.body}>
            {/* now playing */}
            <Text style={[styles.sectionLabel, { color: t.faint, fontFamily: t.fontBody[600] }]}>Now Playing</Text>
            {currentTrack ? (
              <View style={[styles.nowPlaying, { borderColor: alpha(t.accent, 0.25), backgroundColor: alpha(t.accent, 0.07) }]}>
                <Artwork src={currentTrack.thumbnail} alt="" gradient={currentTrack.gradient} size={56} rounded={12} />
                <View style={styles.nowPlayingText}>
                  <Text numberOfLines={1} style={[styles.trackTitle, { color: t.ink, fontFamily: t.fontBody[600] }]}>{currentTrack.title}</Text>
                  <Text numberOfLines={1} style={[styles.trackArtist, { color: t.dim }]}>{currentTrack.artist}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? "Pause" : "Play"}
                  onPress={togglePlay}
                  style={[styles.playBtn, { backgroundColor: t.accent }]}
                >
                  {isPlaying ? (
                    <Pause size={16} fill={t.accentInk} color={t.accentInk} />
                  ) : (
                    <Play size={16} fill={t.accentInk} color={t.accentInk} style={{ marginLeft: 1 }} />
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={[styles.nothing, { borderColor: white(0.1) }]}>
                <Music size={20} color={t.faint} />
                <Text style={[styles.nothingText, { color: t.dim, fontFamily: t.fontBody[500] }]}>Nothing playing yet</Text>
              </View>
            )}

            {/* next up */}
            <View style={styles.nextHeader}>
              <Text style={[styles.sectionLabel, { color: t.faint, fontFamily: t.fontBody[600] }]}>Next Up</Text>
              <Text style={[styles.nextCount, { color: t.faint }]}>{upcoming.length} tracks</Text>
            </View>

            {upcoming.length === 0 ? (
              <View style={[styles.emptyQueue, { borderColor: white(0.1) }]}>
                <ListMusic size={22} color={t.faint} />
                <Text style={[styles.emptyQueueTitle, { color: t.ink, fontFamily: t.fontBody[600] }]}>The queue is clear</Text>
                <Text style={[styles.emptyQueueText, { color: t.dim }]}>Add songs to the queue and they'll appear here.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {upcoming.map((track, i) => (
                  <QueueRow
                    key={track.qid ?? track.id}
                    index={i}
                    track={track}
                    queue={queue}
                    queueIndex={queueIndex}
                    dragIndex={dragIndex}
                    translateY={translateY}
                    setDragIndex={setDragIndex}
                    onReorder={reorderQueue}
                    onRemove={removeFromQueue}
                    onPlay={playTrack}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={[styles.footer, { borderTopColor: white(0.06) }]}>
            <Text style={[styles.footerText, { color: t.faint }]}>Drag rows to reorder · tap a track to play it</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  webRoot: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    width: "92%",
    maxWidth: 400,
    borderLeftWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  closeBtn: {
    padding: 5,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sectionLabel: {
    fontSize: 10.5,
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  nowPlaying: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  nowPlayingText: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 13.5,
  },
  trackArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  nothing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  nothingText: {
    fontSize: 12.5,
  },
  nextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  nextCount: {
    fontSize: 11,
  },
  emptyQueue: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    alignItems: "center",
    padding: 22,
    gap: 4,
  },
  emptyQueueTitle: {
    fontSize: 13,
  },
  emptyQueueText: {
    fontSize: 12,
    textAlign: "center",
  },
  list: {
    gap: 2,
  },
  row: {
    borderRadius: 12,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  grip: {
    opacity: 0.6,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
  },
  rowArtist: {
    fontSize: 11.5,
    marginTop: 1,
  },
  rowDur: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  removeBtn: {
    padding: 5,
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
  },
});
