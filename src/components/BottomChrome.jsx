import { StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { useTheme } from "../lib/useTheme";
import { white } from "../lib/theme";
import MiniPlayer from "./MiniPlayer";
import BottomNavigation from "./BottomNavigation";

/**
 * Native equivalent of the web AppLayout's fixed bottom area: the sticky
 * MiniPlayer sits above the bottom tab bar on every screen except the
 * full-screen Now Playing view, which keeps only the tab bar (its own
 * transport controls already fill the MiniPlayer's role there). A solid
 * surface panel (no frosted glass) keeps the chrome crisp and readable over
 * any scrolling content.
 */
export default function BottomChrome() {
  const pathname = usePathname();
  const { currentTrack } = usePlayer();
  const t = useTheme();
  const isNowPlaying = pathname === "/now-playing";

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface }]}>
      {!isNowPlaying && currentTrack ? <MiniPlayer /> : null}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: white(0.09),
    boxShadow: "0px -10px 24px rgba(0,0,0,0.28)",
  },
});
