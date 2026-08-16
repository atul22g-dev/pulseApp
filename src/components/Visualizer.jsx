import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, makeMutable, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { useTheme } from "../lib/useTheme";
import { alpha } from "../lib/theme";

/** One animated bar — owns its own animated style (hooks need a component). */
function Bar({ bar, active, height, accent, bars }) {
  const style = useAnimatedStyle(() => ({
    height: interpolate(bar.value.value, [0, 1], [2, height * 0.9]),
  }));
  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: alpha(accent, active ? 0.75 : 0.3),
          width: Math.max(2, (100 / bars) * 0.62) + "%",
        },
        style,
      ]}
    />
  );
}

/**
 * Subtle audio visualizer. The web app reads real frequency data from the
 * engine's analyser; native has no analyser (expo-audio exposes none), so
 * this renders the same deterministic sine-wave motion the web app uses as
 * its fallback — livelier while playing, calm when idle, frozen when
 * reduce-motion is on. Bar heights animate on the UI thread (Reanimated)
 * instead of the JS thread. The loop pauses entirely while the host screen
 * isn't focused, so screens left mounted under the stack stop burning frames.
 */
export default function Visualizer({ bars = 48, style, height = 40, ariaLabel = "Audio visualizer" }) {
  const { isPlaying } = usePlayer();
  const t = useTheme();
  const reduced = t.reduceMotion;

  // Screens stay mounted under the stack (Home stays alive under Now
  // Playing), so gate the loop on focus — otherwise every mounted screen's
  // visualizer would keep ticking frames on hidden screens.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  // Bars are created once with a stable per-bar id (React list key) — the
  // visualizer never reorders or filters, but the id keeps the key stable.
  // `makeMutable` creates Reanimated shared values outside of render, so
  // building them in a lazy state initializer (runs exactly once) is fine.
  const [barsData] = useState(() =>
    Array.from({ length: bars }, (_, i) => ({ id: `viz-bar-${i}`, value: makeMutable(0.12) }))
  );

  useEffect(() => {
    // Reduce-motion: a single static pass, no animation loop at all.
    if (reduced) {
      barsData.forEach((b) => {
        b.value.value = 0.3;
      });
      return;
    }

    // Unfocused screen — freeze in a calm static state; the loop restarts on
    // focus. (Without this, Home's visualizer kept ticking behind every
    // pushed screen, and web runs Reanimated on the JS thread.)
    if (!focused) {
      barsData.forEach((b) => {
        b.value.value = 0.12;
      });
      return;
    }

    // The loop only runs at full cadence while a track is actually playing;
    // when idle it ticks at ~2.5Hz (a calm, cheap drift) instead of ~16Hz —
    // the visualizer used to run a constant 60ms requestAnimationFrame loop
    // on every screen that hosts one, even paused, burning JS-thread time.
    const intervalMs = isPlaying ? 70 : 380;
    let timer;
    let raf = 0;
    let running = true;

    const tick = (now) => {
      if (!running) return;
      const time = now / 1000;
      barsData.forEach((b, i) => {
        const wave = Math.sin(time * 0.7 + i * 0.35) * 0.5 + 0.5;
        if (isPlaying) {
          b.value.value = withTiming(0.18 + wave * 0.62, { duration: 120 });
        } else {
          // Idle: write values directly — scheduling N withTiming per tick
          // (48 bars) is pure overhead when nothing is playing.
          b.value.value = 0.08 + wave * 0.28;
        }
      });
      timer = setTimeout(() => {
        raf = requestAnimationFrame(tick);
      }, intervalMs);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, reduced, bars, barsData, focused]);

  if (barsData.length !== bars) {
    return null; // bars count is fixed per mount site in practice
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={ariaLabel}
      style={[styles.row, { height }, style]}
    >
      {barsData.map((b) => (
        <Bar key={b.id} bar={b} active={isPlaying} height={height} accent={t.accent} bars={bars} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
  },
  bar: {
    borderRadius: 3,
  },
});
