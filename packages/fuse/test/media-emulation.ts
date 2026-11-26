import { commands } from "vitest/browser";

import type { EmulatedMedia } from "./media-commands";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    emulateMedia: (media: EmulatedMedia) => Promise<void>;
  }
}

/** The system palette a forced-colors emulation picks. */
export type ForcedColorsOptions = {
  /**
   * The `prefers-color-scheme` to emulate with forced colors, which picks Chromium's light or
   * dark forced palette. Left out, the page's scheme stays as it is.
   */
  readonly colorScheme?: "light" | "dark";
};

/**
 * Runs `body` with forced-colors mode emulated as `value`, after checking that the page's
 * `(forced-colors: active)` query reads it, and its `prefers-color-scheme` query when `options`
 * names a scheme. Then it removes the overrides it set, even when `body` throws, and leaves the
 * page's other media emulation as it is.
 *
 * @param value - The forced-colors mode to emulate.
 * @param body - Runs while the mode holds.
 * @param options - The color scheme to emulate with it.
 */
export async function withForcedColors(
  value: "active" | "none",
  body: () => Promise<void>,
  options: ForcedColorsOptions = {}
): Promise<void> {
  const { colorScheme } = options;
  await commands.emulateMedia(
    colorScheme === undefined ? { forcedColors: value } : { forcedColors: value, colorScheme }
  );
  try {
    if (window.matchMedia("(forced-colors: active)").matches !== (value === "active")) {
      throw new Error(`forced-colors emulation did not reach the page as ${value}`);
    }
    if (colorScheme !== undefined && !window.matchMedia(`(prefers-color-scheme: ${colorScheme})`).matches) {
      throw new Error(`color-scheme emulation did not reach the page as ${colorScheme}`);
    }
    await body();
  } finally {
    await commands.emulateMedia(
      colorScheme === undefined ? { forcedColors: null } : { forcedColors: null, colorScheme: null }
    );
  }
}

/** The computed fill and text color an element paints. */
export type ColorFace = { readonly background: string; readonly text: string };

/**
 * Reads the fill and text color of `element` as computed in the page.
 *
 * @param element - The element to read.
 */
export function faceOf(element: Element): ColorFace {
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, text: style.color };
}

/**
 * Resolves the system color `keyword` and its text pair, such as `Mark` and `MarkText`, as the page
 * computes them right now. It reads a probe element that opts out of forced-color adjustment, so
 * call it inside {@link withForcedColors} to get the forced palette's values.
 *
 * @param keyword - The system background color whose `<keyword>Text` pair is read with it.
 */
export function systemFace(keyword: "Canvas" | "Highlight" | "Mark"): ColorFace {
  const probe = document.createElement("span");
  probe.style.backgroundColor = keyword;
  probe.style.color = `${keyword}Text`;
  probe.style.forcedColorAdjust = "none";
  document.body.append(probe);
  try {
    return faceOf(probe);
  } finally {
    probe.remove();
  }
}
