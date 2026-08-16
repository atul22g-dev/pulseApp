import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AudioLines } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";

export function SkeletonBlock({ style }) {
  const t = useTheme();
  return <View style={[styles.block, { backgroundColor: white(0.07) }, style]} />;
}

export function SkeletonSongRow() {
  return (
    <View style={styles.songRow}>
      <SkeletonBlock style={styles.songIndex} />
      <SkeletonBlock style={styles.songArt} />
      <View style={styles.songLines}>
        <SkeletonBlock style={styles.songLine1} />
        <SkeletonBlock style={styles.songLine2} />
      </View>
      <SkeletonBlock style={styles.songDur} />
    </View>
  );
}

/**
 * Splash-style loader shown while the app boots (fonts + storage hydration).
 * Rendered before the ThemeProvider mounts, so it uses static dark tokens.
 */
export function PageLoader() {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    // Assigning a plain value cancels the running loop on unmount.
    return () => {
      pulse.value = 0.4;
    };
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.loader}>
      <Animated.View style={pulseStyle}>
        <View style={styles.loaderTile}>
          <AudioLines size={30} strokeWidth={2.25} color="#ffffff" />
        </View>
      </Animated.View>
      <Text style={styles.loaderText}>PULSE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 12,
    overflow: "hidden",
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  songIndex: {
    width: 24,
    height: 14,
  },
  songArt: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  songLines: {
    flex: 1,
    gap: 7,
  },
  songLine1: {
    height: 13,
    width: "33%",
  },
  songLine2: {
    height: 11,
    width: "25%",
  },
  songDur: {
    height: 13,
    width: 40,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#07070b",
  },
  loaderTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    boxShadow: "0px 8px 18px rgba(0,0,0,0.4)",
  },
  loaderText: {
    fontSize: 14,
    letterSpacing: 4,
    color: "#6e6e80",
    fontFamily: "Sora_600SemiBold",
  },
});
