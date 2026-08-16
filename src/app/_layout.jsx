import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import {
  Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
} from "@expo-google-fonts/sora";
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular, JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { hydrate } from "../services/storage";
import { ToastProvider } from "../context/ToastContext";
import { PlayerProvider } from "../context/PlayerContext";
import { ThemeProvider, useTheme } from "../lib/useTheme";
import YoutubeBridge from "../components/YoutubeBridge";
import BottomChrome from "../components/BottomChrome";
import QueueDrawer from "../components/QueueDrawer";
import { PageLoader } from "../components/Skeleton";

function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.theme === "light" ? "dark" : "light"} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate().then(() => setHydrated(true));
  }, []);

  if (!fontsLoaded || !hydrated) {
    return <PageLoader />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex}>
        <ThemeProvider>
          <ToastProvider>
            <PlayerProvider>
              <YoutubeBridge />
              <ThemedStatusBar />
              {/* On web (desktop windows) the app renders as a centered phone-
                  width column instead of stretching edge-to-edge; native
                  phones are already narrower than the cap, so it's a no-op. */}
              <View style={[styles.flex, Platform.OS === "web" && styles.webFrame]}>
                <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="discover" />
                  <Stack.Screen name="playlist" />
                  <Stack.Screen name="playlist/[id]" />
                  <Stack.Screen name="favorites" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="recently-played" />
                  <Stack.Screen name="artists" />
                  <Stack.Screen name="artists/[name]" />
                  <Stack.Screen name="albums" />
                  <Stack.Screen name="albums/[name]" />
                  <Stack.Screen name="search" />
                  <Stack.Screen name="now-playing" options={{ animation: "slide_from_bottom" }} />
                </Stack>
                <BottomChrome />
              </View>
              <QueueDrawer />
            </PlayerProvider>
          </ToastProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  webFrame: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.07)",
    borderRightColor: "rgba(255,255,255,0.07)",
    boxShadow: "0px 0px 60px rgba(0,0,0,0.55)",
  },
});
