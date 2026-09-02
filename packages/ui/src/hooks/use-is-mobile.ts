"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

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
 * Package-private viewport probe for Sidebar (sidebar.md §2 "Private useIsMobile"):
 * a `(max-width: 767px)` media query against the 768px breakpoint. Snapshot is
 * `mql.matches`, so a non-hydrating client first render already reports the real
 * value. Server snapshot is `false`, so SSR and hydration report desktop until the
 * client MQL is read. Observable only through `useSidebar().isMobile` — never a
 * public export.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeIsMobile, getIsMobileSnapshot, getIsMobileServerSnapshot);
}
