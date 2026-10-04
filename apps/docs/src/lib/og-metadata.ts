/**
 * The Open Graph and X card metadata every page carries, and the image routes it points at.
 *
 * The image URLs are site-relative; the layouts set `metadataBase` from `site-origin.ts`, and
 * Next resolves them to the absolute URLs Open Graph and X require.
 */

import type { Metadata } from "next";

import type { ThemeInput } from "@elmeragroup/fuse/theme";
import { themeSlug } from "@elmeragroup/fuse/theme";

import { HOME_PAGE } from "./pages";

/** The pixel size of every OG image, which the tags declare so unfurlers can lay out early. */
const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** The route prefix of the docs page images; the docs index draws at the bare prefix. */
const OG_DOCS_PREFIX = "/og/docs";

/** The image route of a component page. */
export function ogComponentPath(slug: string): string {
  return `/og/components/${slug}`;
}

/**
 * The image route of an authored docs page: `/og/docs` for the docs index, otherwise the page's
 * href under `/og/docs`.
 */
export function ogDocsPath(href: string): string {
  return href === HOME_PAGE.href ? OG_DOCS_PREFIX : `${OG_DOCS_PREFIX}${href}`;
}

/**
 * The docs page href an image route's segments name, the inverse of {@link ogDocsPath}.
 *
 * @param segments - The optional catch-all segments after `/og/docs`.
 * @returns The page href.
 */
export function docsHrefFromSegments(segments: readonly string[]): string {
  return segments.length === 0 ? HOME_PAGE.href : `/${segments.join("/")}`;
}

/** The landing image route for a parsed theme, carrying only its canonical slug. */
export function ogLandingPath(theme: ThemeInput): string {
  return `/og/landing?theme=${themeSlug(theme)}`;
}

/** What a page's card says. */
export type OgCard = {
  /** The image route, site-relative. */
  readonly image: string;
  /** The card title, as the page's document title reads. */
  readonly title: string;
  /** The card description. */
  readonly description: string;
  /** What the image shows, for readers who cannot see it. */
  readonly alt: string;
};

/**
 * The `openGraph` and `twitter` members of a page's metadata.
 *
 * @param card - The page's card.
 * @returns Metadata members naming the image, its size and alt text, as a large X card.
 */
export function ogMetadata(card: OgCard): Pick<Metadata, "openGraph" | "twitter"> {
  const image = { url: card.image, alt: card.alt, ...OG_IMAGE_SIZE, type: "image/png" };
  return {
    openGraph: {
      type: "website",
      siteName: "Fuse",
      title: card.title,
      description: card.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
      images: [{ url: card.image, alt: card.alt }],
    },
  };
}
