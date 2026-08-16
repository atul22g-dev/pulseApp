import { FlatList, StyleSheet, Text, View } from "react-native";
import { Heart, History, Compass } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import { useFirstVisitLoading } from "../hooks/useUi";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { TrackCard, AlbumCard } from "../components/CollectionCards";
import SongList from "../components/SongList";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock } from "../components/Skeleton";
import { resolveRecent, resolveFavorites } from "../utils/library";
import { useTheme } from "../lib/useTheme";

// Stable row renderer for the horizontal strips (FlatList needs a consistent
// function reference across re-renders).
const renderTrackCard = ({ item }) => <TrackCard track={item} />;

export default function DiscoverPage() {
  const { recent, favorites, catalog, albums, syncState, syncNow } = usePlayer();
  const ready = useFirstVisitLoading("discover", 500);
  const t = useTheme();

  const recentTracks = resolveRecent(catalog, recent, 10).map((r) => r.track);
  const favTracks = resolveFavorites(catalog, favorites);
  const trending = [...catalog].sort((a, b) => a.duration - b.duration).slice(0, 6);
  const continueListening = [...albums].sort((a, b) => b.tracks.length - a.tracks.length).slice(0, 2);

  return (
    <Page>
      <PageHeader
        style={styles.heading}
        eyebrow="Discover"
        title={<>Find your <Text style={{ color: t.accentStrong }}>next obsession</Text></>}
        sub="A dashboard of everything your library has to offer — fresh picks and momentum."
      />

      {/* recently played */}
      <View style={styles.section}>
        <SectionHeader title="Recently played" to="/recently-played" />
        {ready && recentTracks.length ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            style={{ marginHorizontal: -16 }}
            data={recentTracks}
            keyExtractor={(tr) => tr.id}
            renderItem={renderTrackCard}
          />
        ) : ready ? (
          <View style={{ marginTop: 14 }}>
            <EmptyState
              icon={History}
              title="Nothing here yet"
              message="Play a few songs and your listening history will build this shelf."
              action={{ to: "/playlist", label: "Start listening" }}
            />
          </View>
        ) : (
          <View style={styles.skelStrip}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} style={{ height: 74, width: 176, borderRadius: 16 }} />
            ))}
          </View>
        )}
      </View>

      {/* trending */}
      <View style={styles.section}>
        <SectionHeader title="Trending" subtitle="Shortest bangers, biggest momentum" to="/playlist" />
        <View style={{ marginTop: 14 }}>
          <SongList tracks={trending} showAlbum={false} />
        </View>
      </View>

      {/* favorites shelf */}
      <View style={styles.section}>
        <SectionHeader title="Your favorites" subtitle="Songs you've hearted" to="/favorites" />
        {ready && favTracks.length ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            style={{ marginHorizontal: -16 }}
            data={favTracks}
            keyExtractor={(tr) => tr.id}
            renderItem={renderTrackCard}
          />
        ) : ready ? (
          <View style={{ marginTop: 14 }}>
            <EmptyState
              icon={Heart}
              title="No favorites yet"
              message="Heart a song anywhere in the app and it will show up here."
              action={{ to: "/playlist", label: "Explore your playlist" }}
            />
          </View>
        ) : null}
      </View>

      {/* continue listening */}
      <View style={styles.section}>
        <SectionHeader title="Continue listening" subtitle="Pick up where you left off" to="/albums" />
        <View style={styles.albumGrid}>
          {continueListening.map((album) => (
            <View key={album.name} style={[styles.albumCard, { borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }]}>
              <AlbumCard album={album} />
            </View>
          ))}
        </View>
      </View>

      {!catalog.length && syncState !== "syncing" ? (
        <View style={styles.section}>
          <EmptyState
            icon={Compass}
            title="Nothing synced yet"
            message="Your library is built from your YouTube playlist. Sync it once and every shelf lights up."
            action={{ onClick: () => syncNow(), label: "Sync from YouTube", icon: Compass }}
          />
        </View>
      ) : null}

      <Text style={[styles.footer, { color: t.faint }]}>
        <Compass size={13} color={t.faint} /> More shelves coming as your library grows
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
    marginBottom: 18,
  },
  section: {
    marginTop: 32,
  },
  strip: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  skelStrip: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
  },
  albumGrid: {
    marginTop: 16,
    gap: 14,
  },
  albumCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 11.5,
    paddingVertical: 24,
  },
});
