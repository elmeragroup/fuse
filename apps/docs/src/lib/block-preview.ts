/**
 * The messages between a block's docs page and the block running in the page's preview iframe.
 *
 * The docs header's theme picker keeps the preview theme in memory, so the iframe, a document of
 * its own, cannot read it. The page posts the theme to the iframe whenever it changes and when the
 * iframe says it is ready; the iframe posts its path and search after every navigation, which the
 * preview's address bar shows. The iframe's history is the browser's own, so no message mirrors it. The colour scheme needs no message: both documents read it from the same
 * storage key, and a change in one fires a storage event in the other.
 *
 * Both sides are on the docs origin. Each checks the other's origin, and each parses what arrives,
 * because any window can post a message.
 */

import { parseThemeSlug, themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";

/** Marks the docs' block messages among the others a window receives. */
const SOURCE = "fuse-block-preview";

/** A message between the preview's page and its iframe. */
export type BlockPreviewMessage =
  /** The iframe's block has mounted and listens for the theme. */
  | { readonly _tag: "Ready" }
  /** The iframe's block now shows `path`: its pathname and search. */
  | { readonly _tag: "Location"; readonly path: string }
  /** The docs page's preview theme. */
  | { readonly _tag: "Theme"; readonly theme: ThemeInput };

/** A message as it travels: plain data, the theme as its slug. */
type WireMessage =
  | { readonly source: typeof SOURCE; readonly _tag: "Ready" }
  | { readonly source: typeof SOURCE; readonly _tag: "Location"; readonly path: string }
  | { readonly source: typeof SOURCE; readonly _tag: "Theme"; readonly theme: string };

/**
 * The structured-clone payload of a message.
 *
 * @param message - The message to send.
 * @returns What to pass to `postMessage`.
 */
export function encodeBlockPreviewMessage(message: BlockPreviewMessage): WireMessage {
  switch (message._tag) {
    case "Ready":
      return { source: SOURCE, _tag: "Ready" };
    case "Location":
      return { source: SOURCE, _tag: "Location", path: message.path };
    case "Theme":
      return { source: SOURCE, _tag: "Theme", theme: themeSlug(message.theme) };
  }
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- postMessage I/O boundary: this module is the parser for what any window posts
function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- postMessage I/O boundary: this module is the parser for what any window posts
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string field of a posted record, or `undefined` when it holds anything else. */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- postMessage I/O boundary: this module is the parser for what any window posts
function text(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- postMessage I/O boundary: this module is the parser for what any window posts
  return typeof value === "string" ? value : undefined;
}

/**
 * Parses what a `message` event carries.
 *
 * @param data - The event's `data`, from any window.
 * @returns The block preview message, or `undefined` for anything else: another sender's data, an
 *   unknown tag, a path that is not site-relative or a theme Fuse does not know.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- postMessage I/O boundary: this module is the parser for what any window posts
export function parseBlockPreviewMessage(data: unknown): BlockPreviewMessage | undefined {
  if (!isRecord(data) || text(data, "source") !== SOURCE) {
    return undefined;
  }
  switch (text(data, "_tag")) {
    case "Ready":
      return { _tag: "Ready" };
    case "Location": {
      const path = text(data, "path");
      // Site-relative only: "/x", never "//host/x" or "javascript:".
      return path !== undefined && path.startsWith("/") && !path.startsWith("//")
        ? { _tag: "Location", path }
        : undefined;
    }
    case "Theme": {
      const slug = text(data, "theme");
      const theme = slug === undefined ? null : parseThemeSlug(slug);
      return theme === null ? undefined : { _tag: "Theme", theme };
    }
    default:
      return undefined;
  }
}

/** The query parameter a preview opened in its own tab reads its theme from. */
export const BLOCK_THEME_PARAM = "theme";

/** Where a preview in its own tab keeps the linked theme for the tab's session. */
export const BLOCK_SESSION_THEME_KEY = "fuse-block-preview-theme";
