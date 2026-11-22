/**
 * The mode combinations of a synced file, and the page stamps that put Fuse's built CSS in the same
 * modes, which the Chromium oracle suites measure the real component under.
 */
import { Result } from "effect";

import { parsePreviewTheme, themeStamps } from "../src/compare/preview-theme.ts";
import type { ThemeStamps } from "../src/compare/preview-theme.ts";
import type { InMemoryFigma } from "./in-memory-figma.ts";

/** A frame's mode for each collection of the file, by collection name. */
export type Pin = Readonly<Record<string, string>>;

/**
 * Every combination of the file's collection modes, one mode per collection.
 *
 * @param figma - The file the token sync wrote.
 * @returns Each combination, as a frame pins it.
 */
export function everyPin(figma: InMemoryFigma): readonly Pin[] {
  return figma
    .collectionNames()
    .reduce<readonly Pin[]>(
      (pins, collection) =>
        pins.flatMap((pin) => figma.modeNames(collection).map((mode) => ({ ...pin, [collection]: mode }))),
      [{}]
    );
}

/**
 * The attributes that stamp a page with a pin's modes, as `test:compare` stamps a preview.
 *
 * @param pin - The pin.
 * @returns The stamps on the root and the body.
 * @throws When the pin names a mode the theme catalog does not hold.
 */
export function pinStamps(pin: Pin): ThemeStamps {
  const theme = parsePreviewTheme(Object.entries(pin).map(([collection, mode]) => ({ collection, mode })));
  if (Result.isFailure(theme)) {
    throw new Error(theme.failure.message);
  }
  return themeStamps(theme.success);
}

/**
 * A pin's modes, joined for a mismatch line.
 *
 * @param pin - The pin.
 * @returns The modes, in collection order.
 */
export function pinName(pin: Pin): string {
  return Object.values(pin).join(" / ");
}
