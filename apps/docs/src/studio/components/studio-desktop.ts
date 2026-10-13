"use client";

import { useMediaQuery } from "../../lib/use-media-query";

/** Tailwind's `lg`, where both panels sit beside the canvas instead of opening as Sheets. */
const DESKTOP_QUERY = "(width >= 64rem)";

/**
 * Whether the studio lays out for a desktop: both panels beside the canvas, and the floating
 * theme toolbar over it. The server and hydration render the desktop layout.
 */
export function useDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, true);
}
