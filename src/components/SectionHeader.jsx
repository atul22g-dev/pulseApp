import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";

export default function SectionHeader({ title, subtitle, to, actionLabel = "See all", style }) {
  const t = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.dim }]}>{subtitle}</Text> : null}
      </View>
      {to ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(to)}
          style={({ pressed }) => [
            styles.link,
            { borderColor: white(0.1), backgroundColor: white(0.04) },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.linkText, { color: t.dim, fontFamily: t.fontBody[500] }]}>{actionLabel}</Text>
          <ArrowUpRight size={14} color={t.dim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 13,
  },
});
