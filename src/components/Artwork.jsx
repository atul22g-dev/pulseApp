import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Music } from "lucide-react-native";
import { white } from "../lib/theme";

/**
 * Album artwork with graceful fallback: if the remote image (YouTube CDN)
 * fails to load, render a deterministic gradient derived from the track.
 */
export default function Artwork({ src, alt = "", gradient, style, size, rounded = 12 }) {
  const [failed, setFailed] = useState(false);
  const [c1, c2] = gradient || ["#6366f1", "#ec4899"];

  if (!src || failed) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={alt}
        style={[
          styles.fallback,
          {
            backgroundColor: c1,
            borderRadius: rounded,
            ...(size ? { width: size, height: size } : {}),
          },
          style,
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: rounded, backgroundColor: "transparent" },
          ]}
        >
          <View
            style={{
              position: "absolute",
              left: "15%",
              top: "10%",
              width: "55%",
              height: "55%",
              borderRadius: 999,
              backgroundColor: white(0.28),
              opacity: 0.5,
            }}
          />
        </View>
        <Music color={white(0.8)} size={size ? size * 0.38 : 24} strokeWidth={1.75} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: src }}
      accessibilityLabel={alt}
      contentFit="cover"
      transition={120}
      onError={() => setFailed(true)}
      style={[{ borderRadius: rounded }, size ? { width: size, height: size } : {}, style]}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
