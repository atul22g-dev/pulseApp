import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { STORAGE_KEYS, load, onChange } from "../services/storage";
import { THEMES, ACCENTS, FONTS } from "./theme";

/**
 * Resolves the current theme × accent (from the persisted settings) into
 * concrete hex colors — the native equivalent of the web app's CSS custom
 * properties. Reads settings through the storage shim and subscribes to
 * changes, so it can sit above the player providers (the toast host and all
 * components use it).
 */
const ThemeContext = createContext(null);

const DEFAULT_SETTINGS = { theme: "dark", accent: "purple", reduceMotion: false };

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load(STORAGE_KEYS.settings, {}) }));

  useEffect(() => {
    return onChange(STORAGE_KEYS.settings, (value) => {
      setSettings({ ...DEFAULT_SETTINGS, ...(value || {}) });
    });
  }, []);

  // Also honor the OS-level reduce-motion preference.
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setSystemReduced(Boolean(v));
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setSystemReduced(Boolean(v)));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const t = useMemo(() => {
    const theme = settings.theme || "dark";
    const accentName = settings.accent || "purple";
    const base = THEMES[theme] || THEMES.dark;
    const accent = ACCENTS[accentName] || ACCENTS.purple;
    return {
      theme,
      accentName,
      reduceMotion: Boolean(settings.reduceMotion) || systemReduced,
      ...base,
      ...accent,
      fontDisplay: FONTS.display,
      fontBody: FONTS.body,
      fontMono: FONTS.mono,
      accentGradient: [accent.accent, accent.accentStrong],
    };
  }, [settings, systemReduced]);

  return <ThemeContext.Provider value={t}>{children}</ThemeContext.Provider>;
}
