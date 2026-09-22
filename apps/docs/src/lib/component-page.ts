/**
 * The lookups a hand-authored component `page.mdx` needs.
 *
 * A page is authored; its metadata is generated. These accessors are the seam between the
 * two: the page names a slug, and the generated manifest answers with its identity, TOC
 * skeleton and tokens. A slug the generator did not produce is a build failure, never a
 * silently empty section.
 *
 * Neither the demos nor the API reference come through this seam — the frame reads the demo
 * file itself (`demo-source.ts`) and the reference reads the committed
 * `api.json` (`api-source.ts`).
 */

import type { Metadata } from "next";

import type { ComponentPageEntry } from "./docs-model";
import { componentBySlug } from "./nav";

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

/** Page metadata from the generated manifest: the slug-derived title and the lede. */
export function componentMetadata(slug: string): Metadata {
  const component = requireComponent(slug);
  return { title: component.title, description: component.lede };
}
