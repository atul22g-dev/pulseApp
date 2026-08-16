import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Volume2, Volume1, VolumeX } from "lucide-react-native";
import { usePlayer } from "../context/PlayerContext";
import { useTheme } from "../lib/useTheme";
import { IconBtn } from "./ui";
import VolumeSlider from "./VolumeSlider";

function VolumeIcon({ volume, color }) {
  if (volume === 0) return <VolumeX size={18} color={color} />;
  if (volume < 0.5) return <Volume1 size={18} color={color} />;
  return <Volume2 size={18} color={color} />;
}

export default function VolumeControl({ style }) {
  const { volume, setVolume } = usePlayer();
  const t = useTheme();
  // Remember the last non-zero level so unmute returns to it instead of
  // always jumping to a hardcoded default.
  const lastVolume = useRef(0.8);
  if (volume > 0) lastVolume.current = volume;

  return (
    <View style={[styles.row, style]}>
      <IconBtn
        label={volume === 0 ? "Unmute" : "Mute"}
        onPress={() => {
          if (volume > 0) setVolume(0);
          else setVolume(lastVolume.current || 0.8);
        }}
      >
        {({ color }) => <VolumeIcon volume={volume} color={color} />}
      </IconBtn>
      <VolumeSlider value={volume} onChange={setVolume} style={styles.sliderWrap} />
      <Text style={[styles.pct, { color: t.faint, fontFamily: t.fontMono[400] }]}>{Math.round(volume * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderWrap: {
    flex: 1,
    minWidth: 90,
  },
  pct: {
    fontSize: 11,
    minWidth: 32,
    textAlign: "right",
  },
});
