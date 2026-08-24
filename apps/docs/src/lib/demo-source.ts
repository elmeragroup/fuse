/**
 * Reading a demo's source at render time (docs-site.md §6).
 *
 * A demo is one file: the page imports it as an ordinary ESM module — that is the live
 * render — and the frame reads the very same file from disk to display its source. There
 * is no extraction step and no registry between the two, so the code a reader copies is
 * byte-for-byte the code that produced the stage above it.
 *
 * Server-only: the read happens while the page is prerendered, so the highlighted markup
 * is part of the static HTML and no demo source is shipped as client data.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { highlight } from "sugar-high";

import { normalizeDemoSource } from "./docs-model";

/** `apps/docs`, the directory every docs task runs from (`next build`, `next dev`, vitest). */
const DOCS_ROOT = process.cwd();

/**
 * Where the component routes — and therefore the co-located `demos/` — live.
 *
 * The generator reaches the same directories from its own root: `componentRoutesDir` in
 * `scripts/lib/paths.ts` (built from `docsRouteGroup`) is this path made absolute. The two
 * cannot share a constant — this one is relative to `process.cwd()` at render time, that
 * one is resolved from the script's module URL — so a change to the route layout has to
 * land in both.
 */
const COMPONENT_ROUTES = "src/app/(docs)/components";

/** The docs app's own path inside the repo, for the path the frame prints. */
const DOCS_PACKAGE = "apps/docs";

export type DemoSource = {
  /** Repo-relative path of the authored demo file, as printed in the frame's meta row. */
  sourcePath: string;
  /** Verbatim demo source, trailing whitespace trimmed. */
  source: string;
  /** Syntax-highlighted HTML of `source` (sugar-high — the single highlighter, §8). */
  highlighted: string;
};

/**
 * Reads one demo file of a component page.
 *
 * A page that names a demo the directory does not hold is a build failure: this runs
 * during prerendering, so the throw fails `next build` with the path it looked for
 * instead of rendering a frame with an empty source region.
 */
export async function readDemoSource(slug: string, file: string): Promise<DemoSource> {
  const sourcePath = `${DOCS_PACKAGE}/${COMPONENT_ROUTES}/${slug}/demos/${file}`;
  const absolute = path.join(DOCS_ROOT, COMPONENT_ROUTES, slug, "demos", file);
  let raw: string;
  try {
    raw = await readFile(absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `Component page "${slug}" renders a demo from ${file}, but ${sourcePath} does not exist. ` +
        `A demo is one file, imported by the page and read by the frame (docs-site.md §6).`,
      { cause }
    );
  }
  const source = normalizeDemoSource(raw);
  return { sourcePath, source, highlighted: highlight(source) };
}
