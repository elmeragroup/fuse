/**
 * The files the OG card reads at request time: Roboto and the Elmera mark.
 *
 * Satori takes TTF, OTF or WOFF, never WOFF2, and loads nothing over the network, so the card
 * reads its fonts from `@fontsource/roboto` (SIL OFL 1.1, the license ships in the package) and
 * the mark from `public/landing/marks/`. Paths are relative to the app directory, the working
 * directory of `next start` and of the standalone `server.js`. `next.config.ts` lists the same
 * files under `outputFileTracingIncludes`, so the standalone bundle carries them.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { OG_CARD_COLORS } from "../generated/og-card-colors";

/** The one family the card sets type in. */
export const OG_FONT_FAMILY = "Roboto";

/** The weights the card sets: 600 for the wordmark, 500 for the subtitle. */
const WEIGHTS = [500, 600] as const;

/** A Roboto weight the card loads. */
export type OgFontWeight = (typeof WEIGHTS)[number];

/** A font as `ImageResponse` takes it. */
type OgFont = {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly weight: OgFontWeight;
  readonly style: "normal";
};

/** Artwork as Satori draws it: a data URI. */
export type ArtworkImage = {
  readonly src: string;
};

function appPath(relative: string): string {
  // Tracing cannot resolve a path built at runtime and would otherwise pull in the whole project;
  // `next.config.ts` lists these files under `outputFileTracingIncludes` instead.
  return path.join(/* turbopackIgnore: true */ process.cwd(), relative);
}

/**
 * The absolute path of Roboto's Latin subset in one weight. Latin covers Norwegian and Swedish
 * letters.
 *
 * @param weight - A weight the card loads.
 * @returns The WOFF file's path.
 */
export function robotoPath(weight: OgFontWeight): string {
  return appPath(`node_modules/@fontsource/roboto/files/roboto-latin-${String(weight)}-normal.woff`);
}

/**
 * Roboto in the weights the card sets.
 *
 * @returns The fonts for `ImageResponse`, a mutable array because its `fonts` option is one.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  return await Promise.all(
    WEIGHTS.map(async (weight) => {
      const file = await readFile(robotoPath(weight));
      return {
        name: OG_FONT_FAMILY,
        data: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        weight,
        style: "normal" as const,
      };
    })
  );
}

/**
 * The Elmera mark in the card's foreground. The file fills every shape with `#000`, the landing's
 * mask source, so the card swaps that fill for the color it paints.
 *
 * @returns The mark as a data URI.
 */
export async function loadElmeraMark(): Promise<ArtworkImage> {
  const source = await readFile(appPath("public/landing/marks/elma.svg"), "utf8");
  const inked = source.replaceAll('fill="#000"', `fill="${OG_CARD_COLORS.foreground}"`);
  return { src: `data:image/svg+xml;base64,${Buffer.from(inked).toString("base64")}` };
}
