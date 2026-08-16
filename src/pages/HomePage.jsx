import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Heart, Flame, ListMusic, History, Compass, Disc3, Mic2 } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import { useFirstVisitLoading } from "../hooks/useUi";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import SongList from "../components/SongList";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock } from "../components/Skeleton";
import { Chip } from "../components/ui";
import { resolveFavorites } from "../utils/library";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";

// One-tap shortcuts into the library, always visible above the shelves.
const QUICK_ACTIONS = [
  { label: "Playlist", icon: ListMusic, to: "/playlist" },
  { label: "Favorites", icon: Heart, to: "/favorites" },
  { label: "Recent", icon: History, to: "/recently-played" },
  { label: "Discover", icon: Compass, to: "/discover" },
];

// Time-of-day greeting so the home page feels alive on every visit.
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { favorites, catalog, artists, syncState, syncNow } = usePlayer();
  const ready = useFirstVisitLoading("home", 550);
  const t = useTheme();
  const router = useRouter();

  const favTracks = resolveFavorites(catalog, favorites);
  const trending = [...catalog].sort((a, b) => b.duration - a.duration).slice(0, 6);

  const stats = [
    { icon: ListMusic, value: catalog.length, label: "Songs" },
    { icon: Heart, value: favTracks.length, label: "Favorites" },
    // { icon: Disc3, value: albums.length, label: "Albums" },
    { icon: Mic2, value: artists.length, label: "Artists" },
  ];

  return (
    <Page>
      {/* hero */}
      {!ready ? (
        <View style={styles.heroSkeleton}>
          <SkeletonBlock style={{ height: 12, width: 110, borderRadius: 6 }} />
          <SkeletonBlock style={{ height: 32, width: 240 }} />
          <SkeletonBlock style={{ height: 14, width: 280 }} />
          <SkeletonBlock style={{ height: 42, width: "100%", borderRadius: 999 }} />
          <SkeletonBlock style={{ height: 72, width: "100%", borderRadius: 18 }} />
        </View>
      ) : catalog.length ? (
        <>
          <PageHeader
            style={styles.heading}
            eyebrow={greeting()}
            title={<>Your Music, <Text style={{ color: t.accentStrong }}>Your Mood.</Text></>}
            sub="Your personal collection, beautifully organized."
          />

          {/* quick actions */}
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map(({ label, icon: Icon, to }) => (
              <Chip key={label} onPress={() => router.push(to)} label={label} style={styles.quickChip}>
                <Icon size={14} color={t.dim} />
              </Chip>
            ))}
          </View>

          {/* library stats */}
          <View style={styles.statsRow}>
            {stats.map(({ icon: Icon, value, label }) => (
              <View key={label} style={[styles.statTile, { borderColor: white(0.07), backgroundColor: white(0.03) }]}>
                <Icon size={15} color={t.accent} />
                <Text style={[styles.statValue, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: t.dim }]}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : syncState === "syncing" ? (
        <SkeletonBlock style={{ height: 300, width: "100%", borderRadius: 24 }} />
      ) : (
        <EmptyState
          icon={ListMusic}
          title="Your playlist is empty"
          message="PULSE pulls your songs straight from your YouTube playlist — connect to sync them in."
          action={{ onClick: () => syncNow(), label: "Sync from YouTube", icon: ListMusic }}
        />
      )}

      {/* favorites */}
      <View style={styles.section}>
        <SectionHeader title="Your favorites" subtitle="The ones you keep coming back to" to="/favorites" />
        {favTracks.length ? (
          <View style={{ marginTop: 14 }}>
            <SongList tracks={favTracks.slice(0, 5)} />
          </View>
        ) : (
          <View style={{ marginTop: 14 }}>
            <EmptyState
              icon={Heart}
              title="No favorites yet"
              message="Tap the heart on any song and it will live here, always one click away."
              action={{ to: "/discover", label: "Discover music", icon: Flame }}
            />
          </View>
        )}
      </View>

      {/* trending strip */}
      <View style={styles.section}>
        <SectionHeader title="Trending in your library" subtitle="Your longest tracks, ready for a deep listen" to="/playlist" />
        <View style={{ marginTop: 14 }}>
          <SongList tracks={trending} showAlbum={false} />
        </View>
      </View>

      <Text style={[styles.footer, { color: t.faint }]}>
        <ListMusic size={13} color={t.faint} /> Built with PULSE · {catalog.length} songs synced from your YouTube playlists
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  heroSkeleton: {
    gap: 18,
  },
  heading: {
    marginBottom: 0,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 20,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 20,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 11,
  },
  section: {
    marginTop: 34,
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
