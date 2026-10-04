/**
 * The files an OG image reads at request time: Roboto and the brand artwork.
 *
 * Satori takes TTF, OTF or WOFF, never WOFF2, and loads nothing over the network, so every
 * image reads its fonts from `@fontsource/roboto` (SIL OFL 1.1, the license ships in the
 * package) and its logos from `public/landing/`. Paths are relative to the app directory, the
 * working directory of `next start` and of the standalone `server.js`. `next.config.ts` lists
 * the same files under `outputFileTracingIncludes`, so the standalone bundle carries them.
 *
 * Roboto is `--font-sans` in every theme. Three external themes name the commercial Neo Sans as
 * `--font-heading`; the images set their headings in Roboto for those themes too, since the
 * repo cannot ship Neo Sans.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { BrandCode } from "@elmeragroup/fuse/theme";

/** The one family every image sets type in. */
export const OG_FONT_FAMILY = "Roboto";

const ROBOTO_DIR = "node_modules/@fontsource/roboto/files";
const WEIGHTS = [400, 500, 600, 700] as const;

/** A font as `ImageResponse` takes it. */
type OgFont = {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly weight: (typeof WEIGHTS)[number];
  readonly style: "normal";
};

function appPath(relative: string): string {
  // Tracing cannot resolve a path built at runtime and would otherwise pull in the whole project;
  // `next.config.ts` lists these files under `outputFileTracingIncludes` instead.
  return path.join(/* turbopackIgnore: true */ process.cwd(), relative);
}

async function readArrayBuffer(relative: string): Promise<ArrayBuffer> {
  const file = await readFile(appPath(relative));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

/**
 * Roboto's Latin subset in the four weights the images use. Latin covers Norwegian and Swedish
 * letters and the × sign.
 *
 * @returns The fonts for `ImageResponse`, a mutable array because its `fonts` option is one.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  return await Promise.all(
    WEIGHTS.map(async (weight) => ({
      name: OG_FONT_FAMILY,
      data: await readArrayBuffer(`${ROBOTO_DIR}/roboto-latin-${String(weight)}-normal.woff`),
      weight,
      style: "normal" as const,
    }))
  );
}

/** A brand's monochrome artwork: the compact mark or the full logo. */
type BrandArtwork = "marks" | "logos";

/** Artwork as Satori draws it: a data URI and the aspect ratio of its view box. */
export type ArtworkImage = {
  readonly src: string;
  readonly aspect: number;
};

const VIEW_BOX = /viewBox="([\d.\s-]+)"/u;

/**
 * A brand's artwork in one ink. The files fill every shape with `#000`, the landing's mask
 * source, so the image swaps that fill for the color it paints.
 *
 * @param brand - The brand whose artwork to read.
 * @param kind - The compact mark or the full logo.
 * @param ink - A CSS color for every filled shape.
 * @returns The artwork as a data URI with its aspect ratio.
 */
export async function loadBrandArtwork(
  brand: BrandCode,
  kind: BrandArtwork,
  ink: string
): Promise<ArtworkImage> {
  const source = await readFile(appPath(`public/landing/${kind}/${brand}.svg`), "utf8");
  const [, , width = "1", height = "1"] = (VIEW_BOX.exec(source)?.[1] ?? "").trim().split(/\s+/u);
  const inked = source.replaceAll('fill="#000"', `fill="${ink}"`);
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(inked).toString("base64")}`,
    aspect: Number(width) / Number(height),
  };
}
