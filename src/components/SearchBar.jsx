import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";

export default function SearchBar({ style, autoFocus = false }) {
  const router = useRouter();
  const t = useTheme();
  const [query, setQuery] = useState("");

  const submit = () => {
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    if (!autoFocus) setQuery("");
  };

  return (
    <View style={[styles.wrap, style]}>
      <Search size={16} color={t.faint} style={styles.icon} />
      <TextInput
        value={query}
        autoFocus={autoFocus}
        onChangeText={setQuery}
        onSubmitEditing={submit}
        returnKeyType="search"
        placeholder="Search songs, artists, albums…"
        placeholderTextColor={t.faint}
        accessibilityLabel="Search"
        style={[
          styles.input,
          {
            color: t.ink,
            backgroundColor: white(0.05),
            borderColor: white(0.1),
            fontFamily: t.fontBody[400],
          },
        ]}
      />
      {query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => setQuery("")}
          hitSlop={8}
          style={styles.clear}
        >
          <X size={14} color={t.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  icon: {
    position: "absolute",
    left: 14,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 40,
    paddingRight: 34,
    fontSize: 13,
  },
  clear: {
    position: "absolute",
    right: 10,
    padding: 5,
  },
});
