import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { Home, Compass, ListMusic, Heart, Settings } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";
import { useMotion, usePop } from "../lib/motion";

/** Height of the tab bar itself (icon row + labels, no safe-area inset).
 * Screens that need their content to scroll clear of the fixed chrome (e.g.
 * Now Playing) use this to size their bottom padding. */
export const TAB_BAR_HEIGHT = 54;

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/playlist", label: "Playlist", icon: ListMusic },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Tab icon that pops when its tab becomes active. */
function TabIcon({ icon: Icon, active, ...iconProps }) {
  const { pop, style } = usePop(1.22);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active) pop();
  }, [active, pop]);
  return (
    <Animated.View style={style}>
      <Icon {...iconProps} />
    </Animated.View>
  );
}

export default function BottomNavigation() {
  const t = useTheme();
  const { reduced } = useMotion();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isActive = (item) => (item.end ? pathname === item.to : pathname.startsWith(item.to));

  return (
    <View style={[styles.wrap, { borderTopColor: white(0.06), paddingBottom: insets.bottom }]}>
      <View style={styles.grid}>
        {ITEMS.map(({ to, label, icon, end }) => {
          const active = isActive({ to, end });
          return (
            <Pressable
              key={to}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => router.push(to)}
              style={styles.item}
            >
              {active ? (
                <Animated.View
                  entering={reduced ? undefined : FadeIn.duration(180)}
                  style={[styles.indicator, { backgroundColor: t.accent }]}
                />
              ) : null}
              <TabIcon icon={icon} size={20} strokeWidth={active ? 2.25 : 1.8} color={active ? t.accent : t.faint} active={active} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[styles.label, { color: active ? t.accent : t.faint, fontFamily: t.fontBody[600] }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Sits on BottomChrome's solid surface; the hairline separates the tab
    // row from the mini player above it.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grid: {
    flexDirection: "row",
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingTop: 11,
    paddingBottom: 7,
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 30,
    height: 2.5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  label: {
    fontSize: 10,
  },
});
