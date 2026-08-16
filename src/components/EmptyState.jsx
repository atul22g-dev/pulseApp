import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { PrimaryBtn } from "./ui";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";

export default function EmptyState({ icon: Icon, title, message, action, style }) {
  const t = useTheme();
  const router = useRouter();

  const runAction = () => {
    if (!action) return;
    if (action.to) router.push(action.to);
    else if (action.onClick) action.onClick();
  };

  return (
    <View style={[styles.wrap, { borderColor: white(0.1), backgroundColor: white(0.02) }, style]}>
      <View style={styles.iconBox}>
        <View style={[styles.glow, { backgroundColor: alpha(t.accent, 0.2) }]} />
        <View style={[styles.iconTile, { borderColor: white(0.1), backgroundColor: t.surface }]}>
          {Icon ? <Icon size={28} strokeWidth={1.75} color={t.accent} /> : null}
        </View>
      </View>
      <Text style={[styles.title, { color: t.ink, fontFamily: t.fontDisplay[600] }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: t.dim }]}>{message}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <PrimaryBtn onPress={runAction} label={action.label} small>
            {action.icon ? <action.icon size={16} color={t.accentInk} /> : null}
          </PrimaryBtn>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  iconBox: {
    marginBottom: 18,
  },
  glow: {
    position: "absolute",
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 999,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 320,
  },
  action: {
    marginTop: 24,
  },
});
