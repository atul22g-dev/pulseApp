import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const THUMB = 20;

/**
 * Shared value (0–100) that eases toward `pct` so the fill and thumb glide
 * instead of stepping with the engine's position timer. Snaps instantly while
 * the user is dragging or when `key` changes (e.g. a new track).
 */
export function useSmoothPct(pct, { key, instant, duration = 260, easing = Easing.linear }) {
  const progress = useSharedValue(pct);
  const lastKey = useRef(key);

  useEffect(() => {
    if (instant || lastKey.current !== key) {
      lastKey.current = key;
      progress.value = pct;
    } else {
      progress.value = withTiming(pct, { duration, easing });
    }
  }, [pct, key, instant, duration, easing, progress]);

  return progress;
}

/**
 * A slider with a gliding accent fill and custom thumb, both driven by one
 * eased Reanimated value — the community Slider underneath is only a gesture
 * layer (its own thumb is hidden). Programmatic value changes glide; while
 * the user drags, everything follows the finger instantly.
 *
 * `value` is a controlled input in [min, max] units (the parent freezes it
 * during a drag if it wants the thumb locked to the finger). `onChange`
 * receives live values during a drag, `onStart`/`onComplete` bracket it.
 */
export default function SmoothSlider({
  value,
  min = 0,
  max = 1,
  step,
  onChange,
  onStart,
  onComplete,
  duration = 260,
  easing = Easing.linear,
  resetKey,
  accent,
  thumbColor,
  borderColor,
  trackColor,
  trackHeight = 5,
  style,
  accessibilityLabel,
  tapToSeek = false,
}) {
  const [dragging, setDragging] = useState(false);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const progress = useSmoothPct(pct, { key: resetKey, instant: dragging, duration, easing });
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${progress.value}%`,
    transform: [{ translateX: -THUMB / 2 }, { translateY: -THUMB / 2 }],
  }));

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.padBox, { paddingHorizontal: THUMB / 2 }]}>
        <View style={[styles.track, { height: trackHeight, backgroundColor: trackColor }]}>
          <Animated.View style={[styles.fill, { backgroundColor: accent }, fillStyle]} />
        </View>
        <Animated.View
          style={[styles.thumb, { backgroundColor: thumbColor, borderColor }, thumbStyle]}
        />
      </View>
      <Slider
        style={StyleSheet.absoluteFill}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onSlidingStart={(v) => {
          setDragging(true);
          onStart?.(v);
        }}
        onValueChange={(v) => onChange?.(v)}
        onSlidingComplete={(v) => {
          setDragging(false);
          onComplete?.(v);
        }}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor="transparent"
        tapToSeek={tapToSeek}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 22,
    justifyContent: "center",
  },
  padBox: {
    height: 5,
    justifyContent: "center",
  },
  track: {
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  thumb: {
    position: "absolute",
    top: "50%",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
  },
});
