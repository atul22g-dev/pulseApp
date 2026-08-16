import { Easing } from "react-native-reanimated";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";
import SmoothSlider from "./SmoothSlider";

/**
 * The volume slider: an accent-filled track with a custom thumb that glides on
 * one eased Reanimated value, with a transparent community Slider layered on
 * top purely for gestures. Shared by the Now Playing volume control and the
 * Settings page.
 */
export default function VolumeSlider({ value, onChange, style, trackHeight = 4 }) {
  const t = useTheme();
  return (
    <SmoothSlider
      style={style}
      value={value}
      min={0}
      max={1}
      step={0.01}
      duration={140}
      easing={Easing.out(Easing.quad)}
      accent={t.accent}
      thumbColor={t.accentStrong}
      borderColor={t.bg}
      trackColor={white(0.12)}
      trackHeight={trackHeight}
      onChange={onChange}
      accessibilityLabel="Volume"
    />
  );
}
