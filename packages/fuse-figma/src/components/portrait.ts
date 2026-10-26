/**
 * The picture the kit's image cells show: Avatar's image and Item's image media. Both draw the
 * docs Avatar portrait, so the kit ships one PNG for them.
 */
import { readFileSync } from "node:fs";

/**
 * The docs portrait as a PNG, which Figma stores where it takes no SVG. The docs demo
 * `avatar-basic.tsx` draws it as an SVG data URI: a `#5b8def` square with a white head and
 * shoulders. On 2026-10-22 Playwright's Chromium drew that data URI in a 96 × 96 `<img>` at a device
 * scale of 1, twice the largest Avatar, and the `<img>`'s element screenshot is the file. The build
 * and the compare renderers read it here, so Figma and the browser draw the same pixels. It is read
 * when called, so importing the registry reads no file.
 *
 * @returns The bytes of `portrait.png`.
 */
export function portraitPng(): Uint8Array {
  return readFileSync(new URL("./portrait.png", import.meta.url));
}
