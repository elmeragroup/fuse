/**
 * Reading a demo's source at render time.
 *
 * A demo is one file: the page imports it as an ordinary ESM module — that is the live
 * render — and the frame reads the very same file from disk to display its source. There
 * is no extraction step and no registry between the two, so the code a reader copies is
 * byte-for-byte the code that produced the stage above it.
 *
 * Server-only: the read happens while the page is prerendered, so the source region is part
 * of the static HTML and no demo source is shipped as client data. The read is synchronous: Cache
 * Components prerenders synchronous I/O and counts an awaited file read as uncached data.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";

import { normalizeDemoSource } from "./docs-model";
import { DOCS_ROUTE_SECTIONS, docsRouteFile } from "./docs-route-files";
import type { DocsRouteSection } from "./docs-route-files";

export type DemoSource = {
  /** Verbatim demo source, trailing whitespace trimmed; `DocsCodeBlock` highlights it. */
  source: string;
};

/** Where a demo file lives: the page's section and slug, and the file in its `demos/`. */
export type DemoLocation = {
  section: DocsRouteSection;
  slug: string;
  file: string;
};

/**
 * Reads one demo file of a docs page.
 *
 * A page that names a demo the directory does not hold is a build failure: this runs
 * during prerendering, so the throw fails `next build` with the path it looked for
 * instead of rendering a frame with an empty source region.
 */
export function readDemoSource({ section, slug, file }: DemoLocation): DemoSource {
  const location = docsRouteFile(section, slug, "demos", file);
  let raw: string;
  try {
    raw = readFileSync(location.absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `Docs page "${section}/${slug}" renders a demo from ${file}, but ${location.repoPath} does not exist. ` +
        `A demo is one file, imported by the page and read by the frame.`,
      { cause }
    );
  }
  const source = normalizeDemoSource(raw);
  return { source };
}

/**
 * Where the highlighted source of one demo is served: a prerendered route the Code view fetches
 * the first time it shows, so the page itself ships the source as plain text only.
 *
 * @param location - The demo's section, page slug and file.
 * @returns The route's path.
 */
export function demoSourceHref({ section, slug, file }: DemoLocation): string {
  return `/demo-source/${section}/${slug}/${file}`;
}

/**
 * Every demo file of every docs page, read from the route directories, which the source route
 * prerenders one by one.
 *
 * @returns Each demo's location.
 */
export function demoLocations(): DemoLocation[] {
  return DOCS_ROUTE_SECTIONS.flatMap((section) => {
    const sectionDir = docsRouteFile(section, "").absolute;
    return readdirSync(sectionDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap(({ name: slug }) => {
        const demosDir = docsRouteFile(section, slug, "demos").absolute;
        return existsSync(demosDir)
          ? readdirSync(demosDir)
              .filter((file) => file.endsWith(".tsx"))
              .map((file) => ({ section, slug, file }))
          : [];
      });
  });
}
