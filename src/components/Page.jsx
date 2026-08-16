import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";
import { useTheme } from "../lib/useTheme";
import { AnimatedIn } from "../lib/motion";
import ScreenBackground from "./ScreenBackground";

/**
 * Standard content wrapper: themed aurora background, vertical scroll, safe-area
 * aware, with bottom padding so content clears the fixed mini player +
 * bottom tab bar (which sit above every non-now-playing screen).
 */
export default function Page({ children, style, contentStyle, scroll = true }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { currentTrack } = usePlayer();

  const chromeH = (currentTrack ? 72 : 0) + 64 + insets.bottom + 24;
  const base = [styles.content, contentStyle];

  if (!scroll) {
    return (
      <ScreenBackground style={style}>
        <AnimatedIn distance={10} duration={260}>
          <View style={base}>{children}</View>
        </AnimatedIn>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground style={style}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[base, { paddingBottom: chromeH }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedIn distance={10} duration={260}>
          {children}
        </AnimatedIn>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
});
