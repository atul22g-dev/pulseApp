import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { usePlayer, usePosition } from "../context/PlayerContext";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";
import { formatTime } from "../utils/format";
import { clamp } from "../utils/misc";
import SmoothSlider, { useSmoothPct } from "./SmoothSlider";

/** Full seekable progress bar with time labels. */
export default function ProgressBar({ style, showTimes = true }) {
  const { seekTo, currentTrack } = usePlayer();
  const { position, duration } = usePosition();
  const t = useTheme();

  // While the user drags, the slider is a controlled component — feeding it
  // the live playback position every 250ms would yank the thumb back to the
  // playing spot mid-drag (and the fill wouldn't follow at all). So during a
  // drag we freeze the slider at the drag value and preview that value in the
  // fill + time labels; on release we actually seek.
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(null);

  const max = Math.max(duration, 1);
  const preview = dragging && dragValue != null ? dragValue : position;

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.time, { color: t.faint, fontFamily: t.fontMono[400] }]}>{formatTime(preview)}</Text>
      <SmoothSlider
        style={styles.sliderWrap}
        value={clamp(preview, 0, max)}
        min={0}
        max={max}
        step={0.5}
        duration={260}
        resetKey={currentTrack?.id || null}
        accent={t.accent}
        thumbColor={t.accentStrong}
        borderColor={t.bg}
        trackColor={white(0.12)}
        onStart={(v) => {
          setDragging(true);
          setDragValue(v);
        }}
        onChange={(v) => {
          if (dragging) setDragValue(v);
        }}
        onComplete={(v) => {
          setDragging(false);
          setDragValue(null);
          if (Number.isFinite(v)) seekTo(v);
        }}
        tapToSeek
        accessibilityLabel="Seek"
      />
      {showTimes && (
        <Text style={[styles.time, { color: t.faint, fontFamily: t.fontMono[400] }]}>{formatTime(duration)}</Text>
      )}
    </View>
  );
}

/** Thin clickable progress line — used on the mini player. */
export function ThinProgress({ style }) {
  const { seekTo, currentTrack } = usePlayer();
  const { position, duration } = usePosition();
  const t = useTheme();
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const progress = useSmoothPct(pct, { key: currentTrack?.id || null });
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Seek"
      onPress={(e) => {
        const { locationX, layoutMeasurement } = e.nativeEvent;
        const ratio = layoutMeasurement?.width ? locationX / layoutMeasurement.width : 0;
        seekTo(ratio * duration);
      }}
      style={[styles.thinTrack, { backgroundColor: white(0.1) }, style]}
    >
      <Animated.View style={[styles.thinFill, { backgroundColor: t.accent }, fillStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  time: {
    fontSize: 11,
    minWidth: 38,
    fontVariant: ["tabular-nums"],
  },
  sliderWrap: {
    flex: 1,
  },
  thinTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  thinFill: {
    height: "100%",
    borderRadius: 999,
  },
});
