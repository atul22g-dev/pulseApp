/**
 * Motion primitives — springy press feedback, entrance reveals and pops,
 * all powered by Reanimated (UI-thread on native, JS fallback on web) and
 * all aware of the app's "Reduce animations" setting (Settings → Playback)
 * plus the OS-level reduce-motion preference.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable } from "react-native";
import Animated, {
  createAnimatedComponent,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "./useTheme";

/** Duration tokens (ms). */
const DUR = { fast: 140, base: 240, slow: 380 };

/** Easing curves tuned for UI motion. */
const EASE = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.bezier(0.22, 0.9, 0.24, 1),
};

/** Spring presets — press feedback, pops and drawer reveals. */
export const SPRING = {
  press: { damping: 18, stiffness: 320, mass: 0.55 },
  pop: { damping: 10, stiffness: 280, mass: 0.5 },
  drawer: { damping: 26, stiffness: 300, mass: 0.9 },
};

/** True when animations should be disabled (setting or OS preference). */
export function useMotion() {
  const t = useTheme();
  return { reduced: t.reduceMotion };
}

const AnimatedPressable = createAnimatedComponent(Pressable);

/**
 * A Pressable that springs to `scale` while pressed and springs back on
 * release. Accepts `style` as an object/array or a `({ pressed }) => ...`
 * function (the function still receives the pressed state for background
 * changes). With reduce-motion enabled it falls back to a subtle opacity
 * change instead of any movement.
 */
export function PressableScale({ onPress, disabled, scale = 0.94, children, style, ...rest }) {
  const { reduced } = useMotion();
  const progress = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const animateTo = useCallback(
    (to) => {
      progress.value = withSpring(to, SPRING.press);
    },
    [progress]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduced) animateTo(scale);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (!reduced) animateTo(1);
        rest.onPressOut?.(e);
      }}
      style={[
        typeof style === "function" ? style({ pressed }) : style,
        reduced ? (pressed ? { opacity: 0.72 } : null) : animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Entrance reveal — fades content in with a gentle slide on mount.
 * `direction="up"` slides up from below, `"down"` slides down from above.
 * Skipped entirely (children render as-is) with reduce-motion enabled.
 */
export function AnimatedIn({ children, delay = 0, distance = 14, duration = DUR.base, direction = "up", style }) {
  const { reduced } = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(delay, withTiming(1, { duration, easing: EASE.standard }));
  }, [reduced, delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const dir = direction === "down" ? -1 : 1;
    return {
      opacity: progress.value,
      transform: [{ translateY: (1 - progress.value) * distance * dir }],
    };
  });

  return <Animated.View style={[style, reduced ? null : animatedStyle]}>{children}</Animated.View>;
}

/**
 * Pop animation — a quick overshoot-scale then settle. Returns an animated
 * style to attach to a wrapper and a `pop()` callback to trigger it (e.g. on
 * favorite toggles, tab switches).
 */
export function usePop(scaleTo = 1.3) {
  const { reduced } = useMotion();
  const progress = useSharedValue(1);

  const pop = useCallback(() => {
    if (reduced) return;
    progress.value = withSequence(
      withTiming(scaleTo, { duration: 110, easing: EASE.emphasized }),
      withSpring(1, SPRING.pop)
    );
  }, [reduced, progress, scaleTo]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }));

  return { pop, style };
}
