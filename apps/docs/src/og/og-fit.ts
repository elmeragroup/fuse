/**
 * The OG card's subtitle size. Satori never shrinks text: it measures each word with its bundled
 * `@shuding/opentype.js` and wraps inside `maxWidth`. `next/og` exposes none of that, so the card
 * measures the subtitle itself with the same library and the same Roboto 500 file it loads.
 */

import type { Font } from "@shuding/opentype.js";
import { parse } from "@shuding/opentype.js";
import { readFileSync } from "node:fs";

import { robotoPath } from "./og-assets";

/** The size a subtitle sets at when it fits. */
const MAX_SIZE = 64;

/** The smallest size the card shrinks a subtitle to; a wider one wraps and clamps instead. */
const MIN_SIZE = 44;

/** The width a subtitle should fit, inside its 560px max width so a fitting one never wraps. */
const FIT_WIDTH = 520;

/** The subtitle's letter spacing, -0.01em, as the fraction of the size Satori passes. */
export const OG_SUBTITLE_LETTER_SPACING = -0.01;

/** Roboto 500, parsed once per server process on first use. */
let roboto500: Font | undefined;

function subtitleFont(): Font {
  if (roboto500 === undefined) {
    const file = readFileSync(robotoPath(500));
    roboto500 = parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  }
  return roboto500;
}

/**
 * The size that fits a subtitle on one 520px line: 64px when it fits there, otherwise the whole
 * px size that scales it to 520px, never below 44px.
 *
 * @param subtitle - The subtitle text.
 * @returns The font size in px, from 44 to 64.
 */
export function ogSubtitleSize(subtitle: string): number {
  const width = subtitleFont().getAdvanceWidth(subtitle, MAX_SIZE, {
    letterSpacing: OG_SUBTITLE_LETTER_SPACING,
  });
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.floor((MAX_SIZE * FIT_WIDTH) / width)));
}
