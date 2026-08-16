import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Search, Sparkles, CornerDownLeft } from "lucide-react-native";
import Page from "../components/Page";
import SearchBar from "../components/SearchBar";
import SongList from "../components/SongList";
import EmptyState from "../components/EmptyState";
import { AlbumCard, ArtistCard, TrackCard, CardGrid } from "../components/CollectionCards";
import SectionHeader from "../components/SectionHeader";
import { usePlayer } from "../context/PlayerContext";
import { resolveRecent } from "../utils/library";
import { useTheme } from "../lib/useTheme";

// Stable row renderer for the Suggestions strip (no component-scope deps), so
// FlatList gets a consistent function reference across re-renders.
const renderTrackCard = ({ item }) => <TrackCard track={item} />;

function normalize(s) {
  return s.toLowerCase().trim();
}

export default function SearchPage() {
  const params = useLocalSearchParams();
  const initial = typeof params.q === "string" ? params.q : "";
  const [query, setQuery] = useState(initial);
  const { recent, playTrack, catalog, artists, albums } = usePlayer();
  const t = useTheme();

  const q = query.trim().toLowerCase();
  const recentTracks = resolveRecent(catalog, recent, 6).map((r) => r.track);

  const results = useMemo(() => {
    if (!q) return null;
    const match = (hay = "") => hay.toLowerCase().includes(q);
    return {
      songs: catalog.filter((tr) => match(tr.title) || match(tr.artist) || match(tr.album)),
      artists: artists.filter((a) => match(a.name) || a.tracks.some((tr) => match(tr.title))),
      albums: albums.filter((a) => match(a.name) || match(a.artist)),
    };
  }, [q, catalog, artists, albums]);

  const total = results ? results.songs.length + results.artists.length + results.albums.length : 0;

  return (
    <Page>
      <View style={styles.searchWrap}>
        <SearchBar autoFocus style={styles.searchBar} />
        <Text style={[styles.hint, { color: t.faint }]}>
          <Sparkles size={12} color={t.faint} /> Try “chaand”, “banjaare” or “haryanvi”
        </Text>
      </View>

      {!q ? (
        <View style={{ marginTop: 34 }}>
          <SectionHeader title="Suggestions" subtitle="Jump back into what you've been playing" />
          {recentTracks.length ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              style={{ marginHorizontal: -16 }}
              data={recentTracks}
              keyExtractor={(tr) => tr.id}
              renderItem={renderTrackCard}
            />
          ) : (
            <View style={{ marginTop: 14 }}>
              <EmptyState
                icon={Search}
                title="Search your library"
                message="Songs, artists and albums — all searchable from one place."
              />
            </View>
          )}
        </View>
      ) : total === 0 ? (
        <View style={{ marginTop: 34 }}>
          <EmptyState
            icon={Search}
            title={`No results for “${query}”`}
            message="Check the spelling, or try searching for a different song, artist or album."
            action={{ onClick: () => setQuery(""), label: "Clear search" }}
          />
        </View>
      ) : (
        <View style={{ marginTop: 34 }}>
          {results.songs.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.resultHeader}>
                <Text style={[styles.resultTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>Songs</Text>
                <Text style={[styles.resultCount, { color: t.dim, backgroundColor: "rgba(255,255,255,0.06)" }]}>{results.songs.length}</Text>
                {results.songs[0] ? (
                  <Text
                    onPress={() => playTrack(results.songs[0], { queue: results.songs, index: 0 })}
                    style={[styles.playTop, { color: t.accent, fontFamily: t.fontBody[600] }]}
                  >
                    Play top result <CornerDownLeft size={12} color={t.accent} />
                  </Text>
                ) : null}
              </View>
              <SongList tracks={results.songs} showAlbum />
            </View>
          ) : null}

          {results.artists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.resultTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>Artists</Text>
              <CardGrid style={{ marginTop: 16 }}>
                {results.artists.map((a) => (
                  <ArtistCard key={a.name} artist={a} />
                ))}
              </CardGrid>
            </View>
          ) : null}

          {results.albums.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.resultTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>Albums</Text>
              <CardGrid style={{ marginTop: 16 }}>
                {results.albums.map((a) => (
                  <AlbumCard key={a.name} album={a} />
                ))}
              </CardGrid>
            </View>
          ) : null}

        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    alignItems: "center",
  },
  searchBar: {
    width: "100%",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    fontSize: 11.5,
    marginTop: 12,
    textAlign: "center",
  },
  strip: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  section: {
    marginBottom: 36,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 19,
  },
  resultCount: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  playTop: {
    marginLeft: "auto",
    fontSize: 12,
  },
});
