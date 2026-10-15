/**
 * The lookups a hand-authored component `page.mdx` needs.
 *
 * A page is authored; its metadata is generated. These accessors are the seam between the
 * two: the page names a slug, and the generated manifest answers with its identity (title,
 * lede and source links) and the tokens its recipe reads. A slug the generator did not produce
 * is a build failure, never a silently empty section.
 *
 * Neither the demos nor the API reference come through this seam — the frame reads the demo
 * file itself (`demo-source.ts`) and the reference reads the committed
 * `api.json` (`api-source.ts`).
 */

import type { Metadata } from "next";

import { COMPONENT_PAGES } from "../generated/component-pages";
import type { ComponentPageEntry } from "./docs-model";
import { ogComponentPath, ogMetadata } from "./og-metadata";

/**
 * The one slug → manifest entry lookup: the page, its metadata and its Open Graph card read it.
 * It runs on the server only, so the full manifest never reaches the client.
 */
export function componentBySlug(slug: string): ComponentPageEntry | undefined {
  return COMPONENT_PAGES.find((component) => component.slug === slug);
}

/** The manifest entry for one component page. Throws at build when the slug is unknown. */
export function requireComponent(slug: string): ComponentPageEntry {
  const component = componentBySlug(slug);
  if (component === undefined) {
    throw new Error(
      `No generated data for component page "${slug}". Run \`pnpm --filter docs generate\`; if the page is new, check its frontmatter.`
    );
  }
  return component;
}

/**
 * Page metadata from the generated manifest: the slug-derived title, the lede, and a card that
 * points at the component's OG card.
 */
export function componentMetadata(slug: string): Metadata {
  const component = requireComponent(slug);
  return {
    title: component.title,
    description: component.lede,
    ...ogMetadata({
      image: ogComponentPath(component.slug),
      alt: `Fuse: ${component.title}`,
    }),
  };
}
