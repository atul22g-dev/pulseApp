import { StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { PressableScale } from "../lib/motion";

/** The web app's `.btn-icon` — a round ghost icon button. */
export function IconBtn({ onPress, label, size = 40, color, activeColor, children, style, disabled }) {
  const t = useTheme();
  const fg = activeColor || color || t.dim;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      scale={0.88}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size },
        pressed && { backgroundColor: alpha("#fff", 0.1) },
        style,
      ]}
    >
      {typeof children === "function" ? children({ color: fg }) : children}
    </PressableScale>
  );
}

/** The web app's `.btn-primary` — accent-gradient pill button. */
export function PrimaryBtn({ onPress, label, children, style, disabled, small }) {
  const t = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      scale={0.95}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <LinearGradient
        colors={t.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primary, small && styles.small]}
      >
        {children}
        {label ? <Text style={[styles.primaryLabel, { color: t.accentInk, fontFamily: t.fontBody[600] }]}>{label}</Text> : null}
      </LinearGradient>
    </PressableScale>
  );
}

/** The web app's `.btn-ghost` — bordered pill button. */
export function GhostBtn({ onPress, label, children, style, disabled }) {
  const t = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      scale={0.95}
      style={({ pressed }) => [
        styles.ghost,
        { borderColor: white(0.1), backgroundColor: white(0.04), opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {children}
      {label ? <Text style={[styles.primaryLabel, { color: t.ink, fontFamily: t.fontBody[600] }]}>{label}</Text> : null}
    </PressableScale>
  );
}

/** The web app's `.chip` — small pill badge/button. */
export function Chip({ onPress, label, children, color, style, disabled }) {
  const t = useTheme();
  const fg = color || t.dim;
  return (
    <PressableScale
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={disabled || !onPress}
      scale={0.96}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: white(0.1), backgroundColor: white(0.05), opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {children}
      {label ? <Text style={[styles.chipLabel, { color: fg, fontFamily: t.fontBody[500] }]}>{label}</Text> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryLabel: {
    fontSize: 14,
  },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderWidth: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
  },
});
