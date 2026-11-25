import { commands } from "vitest/browser";

/**
 * Emulates the `prefers-reduced-motion` preference and leaves the page's other media emulation as
 * it is.
 *
 * @param value - The preference to emulate.
 */
export async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  await commands.emulateMedia({ reducedMotion: value });
}
