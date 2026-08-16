/**
 * PULSE theme tokens — direct port of the web app's CSS-variable design
 * system (src/index.css + tailwind.config.js). Three color themes × five
 * accent palettes, each exposing accent / accentStrong / accentSoft /
 * accentGlow / accentInk exactly like the CSS `--accent*` custom properties.
 */

import { Moon, MonitorSmartphone, Sun } from "lucide-react-native";

const rgb = (r, g, b) => [r, g, b];
const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

export const THEMES = {
  dark: {
    bg: hex(rgb(7, 7, 11)),
    surface: hex(rgb(15, 15, 24)),
    elevated: hex(rgb(24, 24, 38)),
    ink: hex(rgb(246, 246, 250)),
    dim: hex(rgb(168, 168, 184)),
    faint: hex(rgb(110, 110, 128)),
  },
  oled: {
    bg: hex(rgb(0, 0, 0)),
    surface: hex(rgb(7, 7, 12)),
    elevated: hex(rgb(14, 14, 22)),
    ink: hex(rgb(245, 245, 250)),
    dim: hex(rgb(160, 160, 178)),
    faint: hex(rgb(104, 104, 124)),
  },
  light: {
    bg: hex(rgb(243, 243, 248)),
    surface: hex(rgb(255, 255, 255)),
    elevated: hex(rgb(255, 255, 255)),
    ink: hex(rgb(20, 20, 30)),
    dim: hex(rgb(84, 84, 102)),
    faint: hex(rgb(128, 128, 148)),
  },
};

export const ACCENTS = {
  purple: {
    accent: "#8b5cf6",
    accentStrong: "#a78bfa",
    accentSoft: "#8b5cf6",
    accentGlow: "#8b5cf6",
    accentInk: "#ffffff",
  },
  blue: {
    accent: "#3b82f6",
    accentStrong: "#60a5fa",
    accentSoft: "#3b82f6",
    accentGlow: "#3b82f6",
    accentInk: "#ffffff",
  },
  pink: {
    accent: "#ec4899",
    accentStrong: "#f472b6",
    accentSoft: "#ec4899",
    accentGlow: "#ec4899",
    accentInk: "#ffffff",
  },
  green: {
    accent: "#10b981",
    accentStrong: "#34d399",
    accentSoft: "#10b981",
    accentGlow: "#10b981",
    accentInk: "#07281e",
  },
  orange: {
    accent: "#f97316",
    accentStrong: "#fb923c",
    accentSoft: "#f97316",
    accentGlow: "#f97316",
    accentInk: "#ffffff",
  },
};

/**
 * Theme card metadata — single source of truth for the Settings theme picker.
 * Icons are lucide components rendered directly in the UI.
 */
export const THEME_META = {
  dark: { label: "Dark", desc: "Premium default", icon: Moon },
  oled: { label: "OLED", desc: "True black", icon: MonitorSmartphone },
  light: { label: "Light", desc: "Clean & bright", icon: Sun },
};

export const ACCENT_HEX = Object.fromEntries(
  Object.entries(ACCENTS).map(([k, v]) => [k, v.accent])
);

/** Ordered keys for pickers — single source of truth (replaces config/playerSettings). */
export const THEME_KEYS = Object.keys(THEMES);
export const ACCENT_KEYS = Object.keys(ACCENTS);

/** Hex + alpha → "rgba(r, g, b, a)". */
export function alpha(hexColor, a) {
  const n = parseInt(hexColor.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** White + alpha (for the web app's `border-white/x` and `bg-white/x`). */
export const white = (a) => `rgba(255, 255, 255, ${a})`;

/* ------------------------------------------------------------------ */
/*  Fonts — Inter / Sora / JetBrains Mono (loaded via expo-font)       */
/* ------------------------------------------------------------------ */

export const FONTS = {
  display: {
    500: "Sora_500Medium",
    600: "Sora_600SemiBold",
    700: "Sora_700Bold",
    800: "Sora_800ExtraBold",
  },
  body: {
    400: "Inter_400Regular",
    500: "Inter_500Medium",
    600: "Inter_600SemiBold",
    700: "Inter_700Bold",
  },
  mono: {
    400: "JetBrainsMono_400Regular",
    500: "JetBrainsMono_500Medium",
  },
};
