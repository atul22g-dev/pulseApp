import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Pause } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { PressableScale } from "../lib/motion";

const SIZES = { xs: 40, sm: 36, md: 44, lg: 56, xl: 64 };
const ICON = { xs: 17, sm: 16, md: 20, lg: 24, xl: 28 };

export default function PlayPauseButton({ playing = false, onToggle, size = "md", style, label = null, disabled = false }) {
  const t = useTheme();
  const dim = SIZES[size] || SIZES.md;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={playing ? label || "Pause" : label || "Play"}
      onPress={onToggle}
      disabled={disabled}
      scale={0.9}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <LinearGradient
        colors={t.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, { width: dim, height: dim, borderRadius: dim / 2 }]}
      >
        <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]} />
        {playing ? (
          <Pause size={ICON[size] || 20} fill={t.accentInk} color={t.accentInk} />
        ) : (
          <Play size={ICON[size] || 20} fill={t.accentInk} color={t.accentInk} style={{ marginLeft: 2 }} />
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 6px 14px rgba(0,0,0,0.35)",
  },
});
