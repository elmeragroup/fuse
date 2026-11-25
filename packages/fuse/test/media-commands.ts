import type { BrowserCommand } from "vitest/node";

/**
 * The media features a test may emulate. A feature left out keeps its current emulation, and
 * `null` removes the feature's override.
 */
export type EmulatedMedia = {
  readonly media?: "print" | "screen" | null;
  readonly forcedColors?: "active" | "none" | null;
  readonly reducedMotion?: "reduce" | "no-preference" | null;
};

/**
 * A browser command that runs in the Vitest server and emulates media features through
 * Playwright's `page.emulateMedia`. Playwright keeps every feature's emulation and sends all of
 * them on each call, so every media override goes through this command: a feature set over raw
 * CDP would be cleared by the next call.
 */
export const mediaCommands = {
  emulateMedia: (async (context, media: EmulatedMedia) => {
    await context.page.emulateMedia(media);
  }) satisfies BrowserCommand<[EmulatedMedia]>,
};
