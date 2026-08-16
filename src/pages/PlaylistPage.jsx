import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Play, Shuffle, Search, RefreshCw, ArrowDownWideNarrow, ArrowLeft, Clock, ListMusic, X } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Page from "../components/Page";
import SongList from "../components/SongList";
import EmptyState from "../components/EmptyState";
import Artwork from "../components/Artwork";
import { CardGrid } from "../components/CollectionCards";
import { SkeletonSongRow } from "../components/Skeleton";
import { getMainPlaylist, getPlaylist, youtubePlaylists } from "../data/playlists";
import { getPlaylistTracks } from "../utils/library";
import { formatListDuration, pluralize } from "../utils/format";
import { shuffleArray } from "../utils/misc";
import { isLiveApiConfigured } from "../services/youtubeService";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { PrimaryBtn, GhostBtn, Chip } from "../components/ui";

const SORTS = [
  { id: "default", label: "Original order" },
  { id: "title", label: "Title (A–Z)" },
  { id: "artist", label: "Artist (A–Z)" },
  { id: "duration", label: "Duration" },
];

export default function PlaylistPage() {
  const params = useLocalSearchParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { playTrack, savedPlaylists, catalog, syncState, syncNow } = usePlayer();
  const t = useTheme();
  const router = useRouter();

  const main = getMainPlaylist();
  // The "/playlist" route (no id) is just the "Your playlists" overview; an
  // explicit id — even the main playlist's — renders the playlist detail view.
  const isOverview = !id;
  const playlist = id ? getPlaylist(id) || savedPlaylists.find((p) => p.id === id) || null : main;
  const isYouTubePlaylist = Boolean(playlist?.isYouTube);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");

  const baseTracks = useMemo(
    () => (playlist ? getPlaylistTracks(playlist) : []),
    // `playlist` is a stable reference — the catalog is the thing that changes.
    [playlist, catalog]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? baseTracks.filter(
          (tr) =>
            tr.title.toLowerCase().includes(q) ||
            tr.artist.toLowerCase().includes(q) ||
            tr.album.toLowerCase().includes(q)
        )
      : baseTracks;
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "artist") sorted.sort((a, b) => a.artist.localeCompare(b.artist));
    else if (sort === "duration") sorted.sort((a, b) => a.duration - b.duration);
    return sorted;
  }, [baseTracks, query, sort]);

  if (!playlist) {
    return (
      <Page>
        <EmptyState
          icon={ListMusic}
          title="Playlist unavailable"
          message="We couldn't find that playlist. It may have been deleted or the link is stale."
          action={{ to: "/playlist", label: "Back to My Playlist" }}
        />
      </Page>
    );
  }

  const playAll = () => {
    if (!baseTracks.length) return;
    playTrack(baseTracks[0], { queue: baseTracks, index: 0 });
  };
  const shufflePlay = () => {
    if (!baseTracks.length) return;
    const shuffled = shuffleArray(baseTracks);
    playTrack(shuffled[0], { queue: shuffled, index: 0 });
  };
  const cycleSort = () => {
    const idx = SORTS.findIndex((s) => s.id === sort);
    setSort(SORTS[(idx + 1) % SORTS.length].id);
  };

  return (
    <Page>
      {!isOverview ? (
        <>
          {/* back link — matches album/artist detail pages. Falls back to the
              overview when there's no back stack (e.g. a deep link), so the
              unhandled GO_BACK error can't surface. */}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/playlist"))}
            style={styles.backLink}
          >
            <ArrowLeft size={15} color={t.dim} />
            <Text style={[styles.backLabel, { color: t.dim, fontFamily: t.fontBody[500] }]}>Back to Your playlists</Text>
          </Pressable>

          <PlaylistHeader
            playlist={playlist}
            tracks={baseTracks}
            syncState={syncState}
            syncNow={syncNow}
            catalogLength={catalog.length}
            isYouTubePlaylist={isYouTubePlaylist}
            onPlayAll={playAll}
            onShuffle={shufflePlay}
          />

          {/* controls */}
          <PlaylistControls
            query={query}
            onChangeQuery={setQuery}
            sort={sort}
            onCycleSort={cycleSort}
            placeholder={`Search in ${playlist.name}`}
          />

          {/* songs */}
          <View style={{ marginTop: 14 }}>
            <PlaylistSongs
              syncState={syncState}
              tracks={filtered}
              playlistName={playlist.name}
              query={query}
              onClearSearch={() => setQuery("")}
            />
          </View>
        </>
      ) : null}

      {/* all tracked playlists, grouped by source API (overview only) */}
      {isOverview ? (
        <YoutubePlaylistsSection
          catalogLength={catalog.length}
          savedCount={savedPlaylists.length}
          onOpen={(pid) => router.push(`/playlist/${pid}`)}
        />
      ) : null}

      {/* saved playlists (only on the overview) */}
      {isOverview && savedPlaylists.length > 0 ? (
        <SavedQueueSection playlists={savedPlaylists} onOpen={(pid) => router.push(`/playlist/${pid}`)} />
      ) : null}

      {!isOverview ? (
        <Text style={[styles.source, { color: t.faint }]}>
          {isYouTubePlaylist ? `Source: youtube.com/playlist?list=${playlist.id}` : "Saved from your queue"}
          {" · playback streams the official YouTube embed for each track"}
        </Text>
      ) : null}
    </Page>
  );
}

/* ---------------- detail view sections ---------------- */

function PlaylistHeader({ playlist, tracks, syncState, syncNow, catalogLength, isYouTubePlaylist, onPlayAll, onShuffle }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Wide layouts (web frame / tablets) put the artwork beside the copy like
  // the album & artist detail pages; phones keep the stacked column.
  const wide = width >= 640;
  const artSize = wide ? 180 : 140;
  const thumbs = tracks.slice(0, 4);
  const totalDuration = tracks.reduce((sum, tr) => sum + tr.duration, 0);
  const syncTint = syncState === "syncing" ? t.accent : syncState === "offline" ? "#fbbf24" : "#34d399";

  return (
    <View style={[styles.header, wide && styles.headerRow]}>
      <View style={[styles.thumbs, { width: artSize, height: artSize }]}>
        {thumbs.length > 1 ? (
          <View style={styles.thumbsGrid}>
            {thumbs.map((tr) => (
              <Artwork key={tr.id} src={tr.thumbnail} alt="" gradient={tr.gradient} style={styles.thumbsCell} rounded={0} />
            ))}
          </View>
        ) : (
          <Artwork src={thumbs[0]?.thumbnail} alt="" gradient={thumbs[0]?.gradient || ["#6366f1", "#ec4899"]} size={140} rounded={16} />
        )}
        <View style={[styles.songCount, { borderColor: white(0.1), backgroundColor: alpha(t.surface, 0.95) }]}>
          <Text style={[styles.songCountText, { color: t.ink, fontFamily: t.fontBody[600] }]}>{pluralize(tracks.length, "song")}</Text>
        </View>
      </View>

      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: t.accent, fontFamily: t.fontBody[700] }]}>Playlist</Text>
        <Text style={[styles.title, { color: t.ink, fontFamily: t.fontDisplay[800] }]}>{playlist.name}</Text>
        <Text style={[styles.desc, { color: t.dim }]}>{playlist.description}</Text>

        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: t.dim, fontFamily: t.fontBody[500] }]}>{pluralize(tracks.length, "song")}</Text>
          <Text style={[styles.metaDot, { color: t.faint }]}>·</Text>
          <Text style={[styles.meta, { color: t.dim }]}>{formatListDuration(totalDuration)}</Text>
          {isYouTubePlaylist ? (
            <>
              <Text style={[styles.metaDot, { color: t.faint }]}>·</Text>
              <Text style={[styles.meta, { color: syncTint }]}>
                <RefreshCw size={12} color={syncTint} />{" "}
                {syncState === "syncing"
                  ? "Syncing with YouTube…"
                  : syncState === "offline"
                    ? "YouTube unreachable — showing local copy"
                    : isLiveApiConfigured()
                      ? `Live · ${catalogLength} tracks synced`
                      : `Live YouTube playlist · ${catalogLength} tracks`}
              </Text>
            </>
          ) : null}
          {isYouTubePlaylist ? (
            <>
              <Text style={[styles.metaDot, { color: t.faint }]}>·</Text>
              <Text style={[styles.meta, { color: t.dim }]}>
                {playlist.source === "atual" ? "Atual API" : "YouTube config"}
              </Text>
            </>
          ) : null}
        </View>

        {isYouTubePlaylist ? (
          <Chip onPress={syncNow} disabled={syncState === "syncing"} style={styles.syncBtn} label="Sync now">
            <RefreshCw size={11} color={t.dim} />
          </Chip>
        ) : null}

        <View style={styles.actions}>
          <PrimaryBtn onPress={onPlayAll} label="Play all">
            <Play size={16} fill={t.accentInk} color={t.accentInk} />
          </PrimaryBtn>
          <GhostBtn onPress={onShuffle} label="Shuffle">
            <Shuffle size={15} color={t.ink} />
          </GhostBtn>
        </View>
      </View>
    </View>
  );
}

function PlaylistControls({ query, onChangeQuery, sort, onCycleSort, placeholder }) {
  const t = useTheme();
  const sortLabel = SORTS.find((s) => s.id === sort)?.label;

  return (
    <View style={styles.controls}>
      <View style={styles.searchWrap}>
        <Search size={15} color={t.faint} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          placeholderTextColor={t.faint}
          accessibilityLabel={placeholder}
          style={[styles.searchInput, { color: t.ink, backgroundColor: white(0.05), borderColor: white(0.1), fontFamily: t.fontBody[400] }]}
        />
        {query ? (
          <Pressable onPress={() => onChangeQuery("")} hitSlop={8} style={styles.searchClear}>
            <X size={13} color={t.faint} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onCycleSort}
        style={[styles.sortBtn, { borderColor: white(0.1), backgroundColor: white(0.05) }]}
      >
        <ArrowDownWideNarrow size={14} color={t.faint} />
        <Text style={[styles.sortLabel, { color: t.ink, fontFamily: t.fontBody[500] }]}>{sortLabel}</Text>
      </Pressable>
    </View>
  );
}

function PlaylistSongs({ syncState, tracks, playlistName, query, onClearSearch }) {
  const t = useTheme();

  if (syncState === "syncing") {
    return (
      <View style={[styles.songSkeleton, { borderColor: "rgba(255,255,255,0.05)" }]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonSongRow key={i} />
        ))}
      </View>
    );
  }

  if (!tracks.length) {
    return (
      <EmptyState
        icon={Search}
        title={query ? "No matching songs" : "This playlist is empty"}
        message={
          query
            ? `Nothing in ${playlistName} matches “${query}”. Try a different search.`
            : "Songs added to this playlist will appear here."
        }
        action={query ? { onClick: onClearSearch, label: "Clear search" } : { to: "/discover", label: "Explore music" }}
      />
    );
  }

  return <SongList tracks={tracks} showAlbum showHeader />;
}

/* ---------------- overview sections ---------------- */

// Shared card shell for both overview grids (YouTube playlists and saved queues).
function PlaylistCard({ onPress, cover, name, meta }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.savedCard,
        { borderColor: "rgba(255,255,255,0.06)", backgroundColor: alpha(t.surface, 0.5) },
        pressed && { backgroundColor: white(0.08) },
      ]}
    >
      {cover}
      <Text numberOfLines={1} style={[styles.savedName, { color: t.ink, fontFamily: t.fontBody[600] }]}>{name}</Text>
      <Text style={[styles.savedCount, { color: t.dim }]}>{meta}</Text>
    </Pressable>
  );
}

function YoutubePlaylistsSection({ catalogLength, savedCount, onOpen }) {
  const t = useTheme();
  return (
    <View style={styles.savedSection}>
      <View style={styles.savedHeader}>
        <Text style={[styles.savedTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>Your playlists</Text>
        <Text style={[styles.manageLink, { color: t.dim, fontFamily: t.fontBody[500] }]}>
          {pluralize(youtubePlaylists.length, "playlist")} · {pluralize(catalogLength, "track")}
        </Text>
      </View>
      {youtubePlaylists.length ? (
        <CardGrid style={{ marginTop: 14 }}>
          {youtubePlaylists.map((p) => {
            const tracks = getPlaylistTracks(p);
            const thumbs = tracks.slice(0, 4);
            return (
              <PlaylistCard
                key={p.id}
                onPress={() => onOpen(p.id)}
                name={p.name}
                meta={pluralize(tracks.length, "track")}
                cover={
                  thumbs.length > 1 ? (
                    <View style={styles.thumbsWrap}>
                      <View style={styles.thumbsMini}>
                        {thumbs.map((tr) => (
                          <Artwork key={tr.id} src={tr.thumbnail} alt="" gradient={tr.gradient} style={styles.thumbsMiniCell} rounded={0} />
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.thumbsWrap}>
                      <Artwork src={thumbs[0]?.thumbnail} alt="" gradient={thumbs[0]?.gradient || ["#6366f1", "#ec4899"]} style={styles.playlistArt} rounded={12} />
                    </View>
                  )
                }
              />
            );
          })}
        </CardGrid>
      ) : savedCount === 0 ? (
        <View style={{ marginTop: 14 }}>
          <EmptyState
            icon={ListMusic}
            title="No playlists yet"
            message="Your library is built from YouTube playlists. Connect one in Settings — or play a few songs and save your queue as a playlist."
            action={{ to: "/settings", label: "Open Settings" }}
          />
        </View>
      ) : null}
    </View>
  );
}

function SavedQueueSection({ playlists, onOpen }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={styles.savedSection}>
      <View style={styles.savedHeader}>
        <Text style={[styles.savedTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>Saved from your queue</Text>
        <Text onPress={() => router.push("/settings")} style={[styles.manageLink, { color: t.dim, fontFamily: t.fontBody[500] }]}>
          Manage
        </Text>
      </View>
      <CardGrid style={{ marginTop: 14 }}>
        {playlists.map((p) => (
          <PlaylistCard
            key={p.id}
            onPress={() => onOpen(p.id)}
            name={p.name}
            meta={`${p.trackIds.length} tracks`}
            cover={
              <View style={[styles.savedIcon, { backgroundColor: white(0.03) }]}>
                <Clock size={22} color={t.faint} />
              </View>
            }
          />
        ))}
      </CardGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 12,
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 13
  },
  header: {
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbs: {
    position: "relative",
    width: 140,
    height: 140,
  },
  thumbsGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    overflow: "hidden",
  },
  thumbsCell: {
    width: "50%",
    height: "50%",
  },
  songCount: {
    position: "absolute",
    right: -8,
    bottom: -8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  songCountText: {
    fontSize: 11,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
  desc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  meta: {
    fontSize: 12.5,
  },
  metaDot: {
    fontSize: 12.5,
  },
  syncBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 26,
  },
  searchWrap: {
    flex: 1,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 13,
    top: 12,
    zIndex: 1,
  },
  searchInput: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 38,
    paddingRight: 30,
    fontSize: 13,
  },
  searchClear: {
    position: "absolute",
    right: 12,
    top: 13,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  sortLabel: {
    fontSize: 12.5,
  },
  songSkeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 2,
  },
  savedSection: {
    marginTop: 40,
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedTitle: {
    fontSize: 19,
  },
  manageLink: {
    fontSize: 13,
  },
  savedCard: {
    width: "100%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  savedIcon: {
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  thumbsWrap: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  thumbsMini: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  thumbsMiniCell: {
    width: "50%",
    height: "50%",
  },
  playlistArt: {
    width: "100%",
    height: "100%",
  },
  savedName: {
    fontSize: 13,
  },
  savedCount: {
    fontSize: 11.5,
    marginTop: 2,
  },
  source: {
    marginTop: 30,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
  },
});
