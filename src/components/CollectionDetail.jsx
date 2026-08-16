import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Play, Shuffle } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Page from "./Page";
import EmptyState from "./EmptyState";
import SongList from "./SongList";
import { PrimaryBtn, GhostBtn } from "./ui";
import { useTheme } from "../lib/useTheme";
import { shuffleArray } from "../utils/misc";
import { findByName } from "../utils/library";

/**
 * Shared detail page for a library collection (album / artist): back link,
 * not-found state, artwork + copy header with Play all / Shuffle actions, and
 * the track list. The artwork block and meta line differ per kind, so they're
 * render props: `artwork(item)` and `meta(item, tracks)`.
 */
export default function CollectionDetail({
  list,
  name,
  icon,
  eyebrow,
  backLabel,
  backTo,
  emptyTitle,
  emptyMessage,
  artwork,
  meta,
  sectionTitle,
}) {
  const { playTrack } = usePlayer();
  const t = useTheme();
  const router = useRouter();

  const item = findByName(list, name);
  if (!item) {
    return (
      <Page>
        <EmptyState
          icon={icon}
          title={emptyTitle}
          message={emptyMessage}
          action={{ to: backTo, label: `Back to ${backLabel.toLowerCase()}` }}
        />
      </Page>
    );
  }

  const tracks = item.tracks;
  const playAll = () => playTrack(tracks[0], { queue: tracks, index: 0 });
  const shufflePlay = () => {
    const s = shuffleArray(tracks);
    playTrack(s[0], { queue: s, index: 0 });
  };

  return (
    <Page>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
        style={styles.backLink}
      >
        <ArrowLeft size={15} color={t.dim} />
        <Text style={[styles.backLabel, { color: t.dim, fontFamily: t.fontBody[500] }]}>{backLabel}</Text>
      </Pressable>

      <View style={styles.detailHeader}>
        {artwork(item)}
        <View style={styles.detailCopy}>
          <Text style={[styles.eyebrow, { color: t.accent, fontFamily: t.fontBody[700] }]}>{eyebrow}</Text>
          <Text style={[styles.detailName, { color: t.ink, fontFamily: t.fontDisplay[800] }]}>{item.name}</Text>
          <Text style={[styles.detailMeta, { color: t.dim, fontFamily: t.fontBody[500] }]}>{meta(item, tracks)}</Text>
          <View style={styles.detailActions}>
            <PrimaryBtn onPress={playAll} label="Play all">
              <Play size={16} fill={t.accentInk} color={t.accentInk} />
            </PrimaryBtn>
            <GhostBtn onPress={shufflePlay} label="Shuffle">
              <Shuffle size={15} color={t.ink} />
            </GhostBtn>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 26 }}>
        {sectionTitle ? (
          <>
            <Text style={[styles.sectionTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>{sectionTitle}</Text>
            <View style={{ marginTop: 12 }}>
              <SongList tracks={tracks} showAlbum showHeader />
            </View>
          </>
        ) : (
          <SongList tracks={tracks} showAlbum showHeader />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backLabel: {
    fontSize: 13,
  },
  detailHeader: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
  },
  detailName: {
    marginTop: 6,
    fontSize: 26,
    letterSpacing: -0.6,
  },
  detailMeta: {
    marginTop: 8,
    fontSize: 13,
  },
  detailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
  },
});
