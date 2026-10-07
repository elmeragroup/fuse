/**
 * Locating a docs page's co-located files at render time.
 *
 * Two render-time readers reach into a page's route directory: the demo frame reads
 * `demos/<name>.tsx` and the API reference reads a component's `api.json`. Both need the same
 * location in two spellings — an absolute path to read from, and the repo-relative path a
 * reader is shown or a failure names — so the pairing lives here once instead of being spelled
 * per reader.
 *
 * The generator reaches the component directories from its own root (`componentRoutesDir` in
 * `scripts/lib/paths.ts`). The two cannot share a constant — this one is relative to
 * `process.cwd()` at render time, that one is resolved from the script's module URL — so a
 * change to the route layout has to land in both.
 */

import path from "node:path";

/** `apps/docs`, the directory every docs task runs from (`next build`, `next dev`, vitest). */
const DOCS_ROOT = process.cwd();

/** The docs app's own path inside the repo, for the paths a reader is shown. */
const DOCS_PACKAGE = "apps/docs";

/** Where the docs routes — and therefore their co-located files — live. */
const DOCS_ROUTES = "src/app/(docs)";

/** A docs section whose pages keep co-located files: component pages and handbook pages. */
export type DocsRouteSection = "components" | "handbook";

export type DocsRouteFile = {
  /** Absolute path, for the read. */
  absolute: string;
  /** Repo-relative path, as printed in the demo frame's meta row or named by a failure. */
  repoPath: string;
};

/**
 * One file inside a docs page's route directory, e.g. `("components", "button", "api.json")`.
 *
 * @param section - The docs section the page belongs to.
 * @param slug - The page's route segment inside its section.
 * @param segments - The path of the file inside the page's route directory.
 * @returns The file's absolute and repo-relative paths.
 */
export function docsRouteFile(section: DocsRouteSection, slug: string, ...segments: string[]): DocsRouteFile {
  return {
    absolute: path.join(DOCS_ROOT, DOCS_ROUTES, section, slug, ...segments),
    repoPath: [DOCS_PACKAGE, DOCS_ROUTES, section, slug, ...segments].join("/"),
  };
}
