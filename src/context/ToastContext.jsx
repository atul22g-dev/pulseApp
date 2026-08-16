import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Info, X, TriangleAlert, Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/useTheme";
import { alpha, white } from "../lib/theme";
import { uid } from "../utils/misc";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: Check,
  error: X,
  info: Info,
  favorite: Heart,
  warning: TriangleAlert,
};

const TINT = {
  success: "#10b981",
  error: "#f43f5e",
  info: "#8b5cf6",
  favorite: "#ec4899",
  warning: "#f97316",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (message, type = "success", duration = 2800) => {
      const id = uid("toast");
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  // Clear pending timers on unmount.
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toasts, onDismiss }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.host, { top: insets.top + 12, pointerEvents: "box-none" }]}>
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        const tint = TINT[toast.type] || TINT.info;
        return (
          <View
            key={toast.id}
            style={[
              styles.toast,
              {
                backgroundColor: alpha(t.surface, 0.9),
                borderColor: white(0.1),
                boxShadow: "0px 8px 20px rgba(0,0,0,0.4)",
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: alpha(tint, 0.14) }]}>
              <Icon size={15} strokeWidth={2.5} color={tint} />
            </View>
            <Text style={[styles.message, { color: t.ink, fontFamily: t.fontBody[500] }]} numberOfLines={3}>
              {toast.message}
            </Text>
            <Pressable onPress={() => onDismiss(toast.id)} hitSlop={8} style={styles.dismiss}>
              <X size={15} color={t.faint} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: "center",
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  dismiss: {
    padding: 4,
  },
});
