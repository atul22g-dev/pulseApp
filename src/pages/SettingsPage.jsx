import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Palette, SlidersHorizontal, Database, Check,
  RefreshCw, Trash2, Heart, History,
} from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import Toggle from "../components/Toggle";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import VolumeSlider from "../components/VolumeSlider";
import { useTheme } from "../lib/useTheme";
import { alpha, white, ACCENT_HEX, ACCENT_KEYS, THEME_KEYS, THEME_META } from "../lib/theme";

function Card({ title, icon: Icon, children, style }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { borderColor: white(0.07), backgroundColor: alpha(t.surface, 0.8) }, style]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: alpha(t.accent, 0.15) }]}>
          <Icon size={16} color={t.accent} />
        </View>
        <Text style={[styles.cardTitle, { color: t.ink, fontFamily: t.fontDisplay[700] }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DataRow({ icon: Icon, title, sub, danger, onPress, disabled }) {
  const t = useTheme();
  const fg = danger ? "#fb7185" : t.dim;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.dataRow,
        {
          borderColor: danger ? "rgba(244,63,94,0.2)" : white(0.07),
          backgroundColor: danger ? "rgba(244,63,94,0.06)" : white(0.03),
          opacity: disabled ? 0.4 : 1,
        },
        pressed && { backgroundColor: white(0.08) },
      ]}
    >
      <Icon size={17} color={fg} />
      <View style={styles.dataText}>
        <Text style={[styles.dataTitle, { color: t.ink, fontFamily: t.fontBody[600] }]}>{title}</Text>
        <Text style={[styles.dataSub, { color: t.dim }]}>{sub}</Text>
      </View>
      <Trash2 size={15} color={t.faint} />
    </Pressable>
  );
}

export default function SettingsPage() {
  const {
    settings, updateSettings, setVolume, volume,
    clearRecentlyPlayed, clearFavorites, resetApp, recent, favorites,
  } = usePlayer();
  const t = useTheme();

  return (
    <Page>
      <PageHeader
        style={styles.heading}
        eyebrow="Preferences"
        title="Settings"
        sub="Everything is saved locally — themes, accents, playback and history."
      />

      {/* appearance */}
      <Card title="Appearance" icon={Palette} style={{ marginTop: 22 }}>
        <Text style={[styles.groupLabel, { color: t.faint, fontFamily: t.fontBody[600] }]}>Theme</Text>
        <View style={styles.themeGrid}>
          {THEME_KEYS.map((th) => {
            const meta = THEME_META[th];
            const Icon = meta.icon;
            const active = settings.theme === th;
            return (
              <Pressable
                key={th}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => updateSettings({ theme: th })}
                style={({ pressed }) => [
                  styles.themeCard,
                  active
                    ? { borderColor: alpha(t.accent, 0.5), backgroundColor: alpha(t.accent, 0.08) }
                    : { borderColor: white(0.1), backgroundColor: white(0.03) },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Icon size={18} color={active ? t.accent : t.dim} />
                <Text style={[styles.themeLabel, { color: t.ink, fontFamily: t.fontBody[600] }]}>{meta.label}</Text>
                <Text style={[styles.themeDesc, { color: t.dim }]}>{meta.desc}</Text>
                {active ? (
                  <View style={[styles.themeCheck, { backgroundColor: t.accent }]}>
                    <Check size={12} strokeWidth={3} color={t.accentInk} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.groupLabel, styles.accentLabel, { color: t.faint, fontFamily: t.fontBody[600] }]}>Accent color</Text>
        <View style={styles.accentRow}>
          {ACCENT_KEYS.map((a) => {
            const active = settings.accent === a;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${a} accent`}
                onPress={() => updateSettings({ accent: a })}
                style={[
                  styles.accentDot,
                  { backgroundColor: ACCENT_HEX[a] },
                  active && { borderWidth: 3, borderColor: t.bg },
                ]}
              >
                {active ? <Check size={16} strokeWidth={3} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* playback */}
      <Card title="Playback" icon={SlidersHorizontal} style={{ marginTop: 18 }}>
        <View style={styles.volumeWrap}>
          <View style={styles.volumeHeader}>
            <Text style={[styles.volumeLabel, { color: t.ink, fontFamily: t.fontBody[500] }]}>Volume</Text>
            <Text style={[styles.volumePct, { color: t.faint, fontFamily: t.fontMono[400] }]}>{Math.round(volume * 100)}%</Text>
          </View>
          <VolumeSlider value={volume} onChange={setVolume} trackHeight={5} />
        </View>
        <View style={styles.toggles}>
          <Toggle
            checked={settings.autoplay}
            onChange={(v) => updateSettings({ autoplay: v })}
            label="Autoplay"
            description="When the queue ends, keep the music going with a fresh shuffle."
          />
          <Toggle
            checked={settings.crossfade}
            onChange={(v) => updateSettings({ crossfade: v })}
            label="Crossfade"
            description="Smoothly blend the end of one track into the next."
          />
          <Toggle
            checked={settings.reduceMotion}
            onChange={(v) => updateSettings({ reduceMotion: v })}
            label="Reduce animations"
            description="Calm the interface down — minimal motion everywhere."
          />
        </View>
      </Card>

      {/* data */}
      <Card title="Your data" icon={Database} style={{ marginTop: 18 }}>
        <View style={styles.dataList}>
          <DataRow
            icon={History}
            title="Clear recently played"
            sub={`${recent.length} entries in history`}
            onPress={clearRecentlyPlayed}
            disabled={recent.length === 0}
          />
          <DataRow
            icon={Heart}
            title="Clear favorites"
            sub={`${favorites.length} hearted tracks`}
            onPress={clearFavorites}
            disabled={favorites.length === 0}
          />
          <DataRow icon={RefreshCw} title="Reset application" sub="Wipe all local data and start fresh" danger onPress={resetApp} />
        </View>
      </Card>

    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
  },
  groupLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  accentLabel: {
    marginTop: 24,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themeCard: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 88,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 88,
  },
  themeLabel: {
    marginTop: 9,
    fontSize: 12.5,
  },
  themeDesc: {
    marginTop: 2,
    fontSize: 10.5,
  },
  themeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  accentDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  volumeWrap: {
    marginBottom: 22,
  },
  volumeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  volumeLabel: {
    fontSize: 13.5,
  },
  volumePct: {
    fontSize: 12,
  },
  toggles: {
    gap: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 18,
  },
  dataList: {
    gap: 10,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  dataText: {
    flex: 1,
  },
  dataTitle: {
    fontSize: 13,
  },
  dataSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
