import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";

export default function Toggle({ checked, onChange, label, description }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: t.ink, fontFamily: t.fontBody[500] }]}>{label}</Text>
        {description ? <Text style={[styles.desc, { color: t.dim }]}>{description}</Text> : null}
      </View>
      <Switch
        value={checked}
        onValueChange={onChange}
        trackColor={{ false: white(0.12), true: alpha(t.accent, 0.75) }}
        thumbColor={checked ? "#fff" : "#b8b8c8"}
        ios_backgroundColor={white(0.12)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 13.5,
  },
  desc: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
});
