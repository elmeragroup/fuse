"use client";

import { useMediaQuery } from "./use-media-query";

// The exact complement of Tailwind's `md:` (`width >= 48rem`). Both sides use rem, so no
// fractional width or non-16px browser default font size leaves a gap where neither matches.
const MOBILE_MEDIA_QUERY = "(width < 48rem)";

/**
 * Whether a `(width < 48rem)` media query matches, the complement of Tailwind's `md:`. It is
 * Sidebar's package-private viewport probe. Its snapshot is `mql.matches`, so a non-hydrating client
 * first render already reports the real value. Its server snapshot is `false`, so server rendering
 * and hydration report desktop until the client reads the media query list. It is observable only
 * through `useSidebar().isMobile`, never as a public export.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
