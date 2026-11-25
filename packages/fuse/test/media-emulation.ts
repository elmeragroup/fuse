import { commands } from "vitest/browser";

import type { EmulatedMedia } from "./media-commands";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    emulateMedia: (media: EmulatedMedia) => Promise<void>;
  }
}

/**
 * Runs `body` with forced-colors mode emulated as `value`, after checking that the page's
 * `(forced-colors: active)` query reads it. Then it removes the forced-colors override, even when
 * `body` throws, and leaves the page's other media emulation as it is.
 *
 * @param value - The forced-colors mode to emulate.
 * @param body - Runs while the mode holds.
 */
export async function withForcedColors(value: "active" | "none", body: () => Promise<void>): Promise<void> {
  await commands.emulateMedia({ forcedColors: value });
  try {
    if (window.matchMedia("(forced-colors: active)").matches !== (value === "active")) {
      throw new Error(`forced-colors emulation did not reach the page as ${value}`);
    }
    await body();
  } finally {
    await commands.emulateMedia({ forcedColors: null });
  }
}
