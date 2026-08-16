import { useEffect, useState } from "react";

// In-memory equivalent of sessionStorage: shows skeletons on the very first
// visit to each page per app session, then renders instantly afterwards.
const loaded = new Set();

/**
 * Shows a skeleton state on the very first visit to a page (per session),
 * then renders instantly on subsequent navigations.
 */
export function useFirstVisitLoading(key, ms = 500) {
  const storageKey = `pulse-loaded:${key}`;
  const [ready, setReady] = useState(() => loaded.has(storageKey));
  const [prevKey, setPrevKey] = useState(storageKey);
  if (prevKey !== storageKey) {
    setPrevKey(storageKey);
    setReady(false);
  }

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      loaded.add(storageKey);
      setReady(true);
    }, ms);
    return () => clearTimeout(t);
  }, [ready, ms, storageKey]);

  return ready;
}
