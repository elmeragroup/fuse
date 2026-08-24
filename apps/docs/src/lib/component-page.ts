/**
 * The lookups a hand-authored component `page.mdx` needs (docs-site.md §1).
 *
 * A page is authored; everything it renders below its prose is generated. These
 * accessors are the seam between the two: the page names a slug, and the generated
 * registry answers with the data. A slug — or a demo — the generator did not produce is
 * a build failure, never a silently empty section.
 */

import type { Metadata } from "next";

import type { DocsComponent, DocsDemo } from "./docs-model";
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

/**
 * One demo of a component page, addressed by the demo file the page imports — the same
 * file the frame displays the source of, so the render and the source cannot drift.
 */
export function requireDemo(slug: string, file: string): DocsDemo {
  const component = requireComponent(slug);
  const demo = component.demos.find((candidate) => candidate.sourcePath.endsWith(`/${file}`));
  if (demo === undefined) {
    throw new Error(`Component page "${slug}" has no generated demo for ${file}.`);
  }
  return demo;
}

/** Page metadata from the frontmatter the generator read (title, lede). */
export function componentMetadata(slug: string): Metadata {
  const component = requireComponent(slug);
  return { title: component.title, description: component.lede };
}
