import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/useTheme";
import { alpha } from "../lib/theme";

/**
 * Full-screen ambient backdrop: a soft accent-tinted aurora that sits behind
 * every screen's content. The gradient + blobs adapt to the active accent and
 * theme, so the whole app gets a rich, modern depth wash for free.
 */
export default function ScreenBackground({ children, style }) {
  const t = useTheme();
  const wash = t.theme === "light" ? 0.1 : 0.14;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }, style]}>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <LinearGradient
          colors={[alpha(t.accent, wash), alpha(t.bg, 0), t.bg]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.blobTop, { backgroundColor: alpha(t.accentStrong, wash * 0.8) }]} />
        <View style={[styles.blobBottom, { backgroundColor: alpha(t.accent, wash * 0.7) }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blobTop: {
    position: "absolute",
    top: -130,
    right: -90,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  blobBottom: {
    position: "absolute",
    bottom: -150,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
});
