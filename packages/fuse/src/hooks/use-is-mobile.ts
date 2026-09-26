"use client";

import { useSyncExternalStore } from "react";

// The exact complement of Tailwind's `md:` (`width >= 48rem`). Both sides use rem, so no
// fractional width or non-16px browser default font size leaves a gap where neither matches.
const MOBILE_MEDIA_QUERY = "(width < 48rem)";

function subscribeIsMobile(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => {
    mql.removeEventListener("change", onStoreChange);
  };
}

function getIsMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getIsMobileServerSnapshot(): boolean {
  return false;
}

/**
 * Package-private viewport probe for Sidebar:
 * a `(width < 48rem)` media query, the complement of Tailwind's `md:`. Snapshot is
 * `mql.matches`, so a non-hydrating client first render already reports the real
 * value. Server snapshot is `false`, so SSR and hydration report desktop until the
 * client MQL is read. Observable only through `useSidebar().isMobile` — never a
 * public export.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeIsMobile, getIsMobileSnapshot, getIsMobileServerSnapshot);
}
