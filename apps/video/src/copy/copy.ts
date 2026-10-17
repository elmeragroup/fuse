import { createContext, use } from "react";

import type { Copy, VideoLocale } from "./catalog";
import { EN_US } from "./en-US";
import { NB_NO } from "./nb-NO";
import { SV_SE } from "./sv-SE";

const CATALOGS = {
  "en-US": EN_US,
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
} as const satisfies Record<VideoLocale, Copy>;

/**
 * The video's locale, provided once by the release composition. A scene opened on its own in
 * Studio falls back to English.
 */
export const VideoLocaleContext = createContext<VideoLocale>("en-US");

/**
 * Read the video's locale, for Fuse's `LocaleProvider` and for formatting numbers and currency.
 *
 * @returns The video's locale.
 */
export function useVideoLocale(): VideoLocale {
  return use(VideoLocaleContext);
}

/**
 * Read the video's copy.
 *
 * @returns The catalog for the video's locale.
 */
export function useCopy(): Copy {
  return CATALOGS[useVideoLocale()];
}
