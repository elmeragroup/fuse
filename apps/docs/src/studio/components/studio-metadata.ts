import type { Metadata } from "next";

import { ogDocsPath, ogMetadata } from "../../lib/og-metadata";
import { requireStudioPage } from "../lib/pages";

/**
 * Metadata for a studio page, from the same manifest entry search and `llms.txt` read. The card
 * is the docs card titled with the page, under `/og/docs`.
 */
export function studioPageMetadata(href: string): Metadata {
  const page = requireStudioPage(href);
  return {
    title: { absolute: `${page.title} · Fuse` },
    description: page.description,
    ...ogMetadata({ image: ogDocsPath(href), alt: `Fuse: ${page.title}` }),
  };
}
