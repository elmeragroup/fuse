"use client";

import { useCallback, useSyncExternalStore } from "react";

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether a media query matches. The hook is a package-private probe, and the one owner of
 * `matchMedia` outside `theme/`. Its snapshot is `mql.matches`, so a non-hydrating client first
 * render already reports the real value. Its server snapshot is `false`, so server rendering and
 * hydration report a non-match until the client reads the query. Write `query` so that `false` is
 * the safe default.
 *
 * @param query - A media query. Keep it a module constant so the subscription is stable.
 * @returns Whether the query matches now.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => {
        mql.removeEventListener("change", onStoreChange);
      };
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
