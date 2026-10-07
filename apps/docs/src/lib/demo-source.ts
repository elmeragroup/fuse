/**
 * Reading a demo's source at render time.
 *
 * A demo is one file: the page imports it as an ordinary ESM module — that is the live
 * render — and the frame reads the very same file from disk to display its source. There
 * is no extraction step and no registry between the two, so the code a reader copies is
 * byte-for-byte the code that produced the stage above it.
 *
 * Server-only: the read happens while the page is prerendered, so the source region is part
 * of the static HTML and no demo source is shipped as client data.
 */

import { readFile } from "node:fs/promises";

import { normalizeDemoSource } from "./docs-model";
import { docsRouteFile } from "./docs-route-files";
import type { DocsRouteSection } from "./docs-route-files";

export type DemoSource = {
  /** Repo-relative path of the authored demo file, as printed in the frame's meta row. */
  sourcePath: string;
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
export async function readDemoSource({ section, slug, file }: DemoLocation): Promise<DemoSource> {
  const location = docsRouteFile(section, slug, "demos", file);
  let raw: string;
  try {
    raw = await readFile(location.absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `Docs page "${section}/${slug}" renders a demo from ${file}, but ${location.repoPath} does not exist. ` +
        `A demo is one file, imported by the page and read by the frame.`,
      { cause }
    );
  }
  const source = normalizeDemoSource(raw);
  return { sourcePath: location.repoPath, source };
}
