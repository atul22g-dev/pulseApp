import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart, Compass, Trash2 } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import SongList from "../components/SongList";
import EmptyState from "../components/EmptyState";
import { resolveFavorites } from "../utils/library";
import { useTheme } from "../lib/useTheme";

export default function FavoritesPage() {
  const { favorites, clearFavorites, catalog } = usePlayer();
  const t = useTheme();

  const favTracks = resolveFavorites(catalog, favorites);
  const total = favorites.length;

  return (
    <Page>
      <PageHeader
        style={styles.heading}
        eyebrow="Your library"
        title="Favorites"
        sub={total ? `${total} hearted ${total === 1 ? "track" : "tracks"} across your library` : "Every song you heart, all in one place."}
        right={total > 0 ? (
          <Pressable onPress={clearFavorites} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
            <Trash2 size={13} color="#fb7185" />
            <Text style={[styles.clearLabel, { color: "#fb7185" }]}>Clear favorites</Text>
          </Pressable>
        ) : null}
      />

      <View style={{ marginTop: 22 }}>
        {favTracks.length ? (
          <SongList tracks={favTracks} showAlbum showHeader />
        ) : (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            message="Tap the heart next to any song to add it here. Favorites sync automatically to this device."
            action={{ to: "/discover", label: "Discover music", icon: Compass }}
          />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
