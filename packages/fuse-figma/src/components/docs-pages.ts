/**
 * What a kit page reads from its component's docs page: the page's lede, which the kit shows under
 * the title as its description, and the page's published URL, which the `View documentation` link
 * opens. The lede comes from the docs page's `page.mdx`, read by the frontmatter reader the docs generator uses, so
 * the kit holds no second copy of it.
 */

import * as Effect from "effect/Effect";
import { readFileSync } from "node:fs";

import { parsePageLede } from "../../../../apps/docs/scripts/lib/page-frontmatter.ts";
import { KitSourceInvalid } from "./build-errors";
import type { KitPage } from "./kit-registry";

/**
 * The origin the docs site is published at: the `origin` input the merge workflow
 * (`.github/workflows/merge.yml`) builds the production docs image with, which `siteOrigin()` in
 * `apps/docs/src/lib/site-origin.ts` reads at run time. The build bakes it into the kit, so a link
 * opens the published page whatever machine builds the plugin.
 */
export const DOCS_ORIGIN = "https://fuse.elmeragroup.no";

/** A kit page's docs page: its one-line description and its published URL. */
export type DocsPage = {
  /** The docs page's lede, with its inline code marks removed, as the page shows it in one line. */
  readonly description: string;
  /** The docs page's published URL, such as `https://fuse.elmeragroup.no/components/button`. */
  readonly url: string;
};

/** The slug of a kit page's docs page: its own `docs`, or the kit page's slug. */
function docsSlug(page: KitPage): string {
  return page.docs ?? page.slug;
}

/**
 * Read a kit page's docs page.
 *
 * @param page - The kit page.
 * @returns The description and URL. The Effect fails with `KitSourceInvalid` where the docs page is
 *   missing or the docs generator cannot read it.
 */
export const readDocsPage = Effect.fn("readDocsPage")(function* (page: KitPage) {
  const slug = docsSlug(page);
  const file = new URL(`../../../../apps/docs/src/app/(docs)/components/${slug}/page.mdx`, import.meta.url);
  const lede = yield* Effect.try({
    try: () => parsePageLede(readFileSync(file, "utf8"), `components/${slug}/page.mdx`),
    catch: (cause) =>
      new KitSourceInvalid({
        message: `the ${page.name} page's docs page components/${slug} cannot be read: ${String(cause)}`,
      }),
  });
  const docs: DocsPage = {
    description: lede.replaceAll("`", ""),
    url: `${DOCS_ORIGIN}/components/${slug}`,
  };
  return docs;
});
