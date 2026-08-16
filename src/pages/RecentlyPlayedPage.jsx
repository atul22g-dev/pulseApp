import { Pressable, StyleSheet, Text, View } from "react-native";
import { History, Trash2, Play, RotateCcw } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Artwork from "../components/Artwork";
import { formatTime, relativeTime, pluralize } from "../utils/format";
import { resolveRecent } from "../utils/library";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { PrimaryBtn } from "../components/ui";

export default function RecentlyPlayedPage() {
  const { recent, playTrack, clearRecentlyPlayed, removeRecent, catalog } = usePlayer();
  const t = useTheme();

  const items = resolveRecent(catalog, recent);
  const continueTrack = items[0]?.track;

  const resume = () => {
    if (!continueTrack) return;
    playTrack(continueTrack, { queue: items.map((i) => i.track), index: 0 });
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Listening history"
        title="Recently Played"
        sub={items.length ? `Your last ${pluralize(items.length, "track")} — pick up right where you left off.` : "Your listening history lives here."}
        right={items.length > 0 ? (
          <Pressable onPress={clearRecentlyPlayed} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
            <Trash2 size={13} color="#fb7185" />
            <Text style={[styles.clearLabel, { color: "#fb7185" }]}>Clear history</Text>
          </Pressable>
        ) : null}
      />

      {items.length === 0 ? (
        <View style={{ marginTop: 30 }}>
          <EmptyState
            icon={History}
            title="Your history is empty"
            message="Play any song and it will appear here with the exact time you listened — perfect for continuing later."
            action={{ to: "/playlist", label: "Play something", icon: Play }}
          />
        </View>
      ) : (
        <>
          {/* continue listening hero */}
          <View style={[styles.hero, { borderColor: white(0.07), backgroundColor: alpha(t.surface, 0.6) }]}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: alpha(t.accent, 0.16), pointerEvents: "none" },
              ]}
            />
            <View style={styles.heroInner}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Continue playing ${continueTrack.title}`} onPress={resume}>
                <Artwork src={continueTrack.thumbnail} alt="" gradient={continueTrack.gradient} size={100} rounded={18} />
              </Pressable>
              <View style={styles.heroText}>
                <Text style={[styles.heroEyebrow, { color: t.accent, fontFamily: t.fontBody[700] }]}>Continue listening</Text>
                <Text numberOfLines={1} style={[styles.heroTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>{continueTrack.title}</Text>
                <Text numberOfLines={1} style={[styles.heroArtist, { color: t.dim }]}>{continueTrack.artist}</Text>
                <Text style={[styles.heroTime, { color: t.faint }]}>{relativeTime(items[0].playedAt)}</Text>
                <PrimaryBtn onPress={resume} label="Resume" small style={styles.resumeBtn}>
                  <Play size={14} fill={t.accentInk} color={t.accentInk} />
                </PrimaryBtn>
              </View>
            </View>
          </View>

          {/* full history */}
          <View style={styles.list}>
            {items.map(({ track, playedAt }, i) => {
              const play = () => playTrack(track, { queue: items.map((x) => x.track), index: i });
              return (
                <View key={`${track.id}-${playedAt}`} style={styles.row}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Play ${track.title} again`} onPress={play} style={styles.rowMain}>
                    <Text style={[styles.rowIndex, { color: t.faint, fontFamily: t.fontMono[400] }]}>
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <View>
                      <Artwork src={track.thumbnail} alt="" gradient={track.gradient} size={44} rounded={10} />
                      <View style={[styles.rowPlayOverlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                        <Play size={15} fill="#fff" color="#fff" style={{ marginLeft: 1 }} />
                      </View>
                    </View>
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: t.ink, fontFamily: t.fontBody[600] }]}>{track.title}</Text>
                      <Text numberOfLines={1} style={[styles.rowArtist, { color: t.dim }]}>{track.artist}</Text>
                    </View>
                  </Pressable>
                  <Text style={[styles.rowDur, { color: t.faint, fontFamily: t.fontMono[400] }]}>{formatTime(track.duration)}</Text>
                  <Text style={[styles.rowWhen, { color: t.faint }]}>{relativeTime(playedAt)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${track.title} from history`}
                    onPress={() => removeRecent(track.id)}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <RotateCcw size={13} color={t.faint} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
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
  hero: {
    marginTop: 28,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    padding: 22,
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 10.5,
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 20,
  },
  heroArtist: {
    fontSize: 13,
    marginTop: 2,
  },
  heroTime: {
    fontSize: 11.5,
    marginTop: 6,
  },
  resumeBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  list: {
    marginTop: 26,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowIndex: {
    width: 24,
    textAlign: "center",
    fontSize: 11,
  },
  rowPlayOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13.5,
  },
  rowArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  rowDur: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  rowWhen: {
    fontSize: 11,
    width: 56,
    textAlign: "right",
  },
  removeBtn: {
    padding: 6,
  },
});
