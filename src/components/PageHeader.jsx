import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";

/**
 * Page heading — eyebrow + title + sub, with an optional `right` action
 * (e.g. the "Clear history" button) pinned to the end of the row. Previously
 * hand-built in six pages with slightly drifted styles; now one component.
 */
export default function PageHeader({ eyebrow, title, sub, right, style }) {
  const t = useTheme();
  const hasRight = Boolean(right);

  return (
    <View style={[styles.heading, hasRight && styles.headingRow, style]}>
      <View style={styles.textWrap}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: t.accent, fontFamily: t.fontBody[700] }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[styles.title, { color: t.ink, fontFamily: t.fontDisplay[800] }]}>{title}</Text>
        {sub ? <Text style={[styles.sub, { color: t.dim }]}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: 4,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
});
