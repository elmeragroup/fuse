/**
 * The lookups a hand-authored component `page.mdx` needs (docs-site.md §1).
 *
 * A page is authored; everything it renders below its prose is generated. These
 * accessors are the seam between the two: the page names a slug, and the generated
 * registry answers with the data. A slug the generator did not produce is a build
 * failure, never a silently empty section.
 *
 * Demo sources are not part of this seam — the frame reads the demo file itself
 * (`demo-source.ts`, docs-site.md §6).
 */

import type { Metadata } from "next";

import type { DocsComponent } from "./docs-model";
import { componentBySlug } from "./nav";

/** The registry entry for one component page. Throws at build when the slug is unknown. */
export function requireComponent(slug: string): DocsComponent {
  const component = componentBySlug(slug);
  if (component === undefined) {
    throw new Error(
      `No generated data for component page "${slug}". Run \`pnpm --filter docs generate\`; if the page is new, check its frontmatter.`
    );
  }
  return component;
}

/** Page metadata from the frontmatter the generator read (title, lede). */
export function componentMetadata(slug: string): Metadata {
  const component = requireComponent(slug);
  return { title: component.title, description: component.lede };
}
