"use client";

import { useCallback, useSyncExternalStore } from "react";

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Package-private media-query probe, the one owner of `matchMedia` outside `theme/`.
 * Snapshot is `mql.matches`, so a non-hydrating client first render already reports the
 * real value. Server snapshot is `false`, so SSR and hydration report a non-match until
 * the client reads the query; write `query` so that `false` is the safe default.
 *
 * @param query - A media query; keep it a module constant so the subscription is stable.
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
