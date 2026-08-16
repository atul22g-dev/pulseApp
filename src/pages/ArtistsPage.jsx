import { StyleSheet, View } from "react-native";
import { Users, Music2 } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import { ArtistCard, CardGrid } from "../components/CollectionCards";
import Artwork from "../components/Artwork";
import CollectionDetail from "../components/CollectionDetail";
import { pluralize } from "../utils/format";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";

export default function ArtistsPage() {
  const params = useLocalSearchParams();
  const name = typeof params.name === "string" ? params.name : undefined;
  const { artists } = usePlayer();
  const t = useTheme();

  if (name) {
    return (
      <CollectionDetail
        list={artists}
        name={name}
        icon={Users}
        eyebrow="Artist"
        backLabel="Artists"
        backTo="/artists"
        emptyTitle="Artist not found"
        emptyMessage="This artist isn't in your library."
        artwork={(item) => (
          <View style={styles.detailArt}>
            <View style={[styles.detailRing, { borderColor: white(0.1) }]}>
              <Artwork src={item.thumbnail} alt="" gradient={item.gradient} size={140} rounded={999} />
            </View>
            <View style={[styles.detailBadge, { backgroundColor: t.accent }]}>
              <Music2 size={17} color={t.accentInk} />
            </View>
          </View>
        )}
        meta={(item, tracks) => `${pluralize(tracks.length, "song")} in your library`}
        sectionTitle="Popular songs"
      />
    );
  }

  return (
    <Page>
      <PageHeader eyebrow="Your library" title="Artists" sub="Everyone in your Personal Songs." />
      <CardGrid>
        {artists.map((a) => (
          <ArtistCard key={a.name} artist={a} />
        ))}
      </CardGrid>
    </Page>
  );
}

const styles = StyleSheet.create({
  detailArt: {
    position: "relative",
  },
  detailRing: {
    borderRadius: 999,
    borderWidth: 4,
    overflow: "hidden",
  },
  detailBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
