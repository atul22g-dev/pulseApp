import { useEffect, useRef } from "react";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { PressableScale, usePop } from "../lib/motion";

/**
 * Heart toggle. Fully prop-driven (no player-context subscription), so it can
 * sit inside memoized list rows without forcing them to re-render on every
 * player state change. `active` = is the track favorited; `onToggle` receives
 * the track id.
 */
export default function FavoriteButton({ trackId, active = false, onToggle, size = 17, style }) {
  const t = useTheme();
  const { pop, style: popStyle } = usePop(1.45);

  // Rules of Hooks: every hook must run unconditionally in the same order, so
  // these live ABOVE the early return below — a trackId that flips between
  // defined/undefined would otherwise change the hook order between renders.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    pop();
  }, [active, pop]);

  if (!trackId) return null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={active ? "Remove from favorites" : "Add to favorites"}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      scale={0.85}
      onPress={(e) => {
        e.stopPropagation?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggle?.(trackId);
      }}
      style={[
        {
          width: size + 18,
          height: size + 18,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.View style={popStyle}>
        <Heart
          size={size}
          strokeWidth={2}
          color={active ? t.accent : t.dim}
          fill={active ? t.accent : "transparent"}
        />
      </Animated.View>
    </PressableScale>
  );
}
