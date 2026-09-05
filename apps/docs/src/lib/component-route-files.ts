/**
 * Locating a component page's co-located files at render time (docs-site.md §1, §6, §8).
 *
 * Two render-time readers reach into a component's route directory: the demo frame reads
 * `demos/<name>.tsx` and the API reference reads `api.json`. Both need the same location in
 * two spellings — an absolute path to read from, and the repo-relative path a reader is shown
 * or a failure names — so the pairing lives here once instead of being spelled per reader.
 *
 * The generator reaches the same directories from its own root (`componentRoutesDir` in
 * `scripts/lib/paths.ts`). The two cannot share a constant — this one is relative to
 * `process.cwd()` at render time, that one is resolved from the script's module URL — so a
 * change to the route layout has to land in both.
 */

import path from "node:path";

/** `apps/docs`, the directory every docs task runs from (`next build`, `next dev`, vitest). */
const DOCS_ROOT = process.cwd();

/** The docs app's own path inside the repo, for the paths a reader is shown. */
const DOCS_PACKAGE = "apps/docs";

/** Where the component routes — and therefore their co-located files — live. */
const COMPONENT_ROUTES = "src/app/(docs)/components";

export type ComponentRouteFile = {
  /** Absolute path, for the read. */
  absolute: string;
  /** Repo-relative path, as printed in the demo frame's meta row or named by a failure. */
  repoPath: string;
};

/** One file inside a component page's route directory, e.g. `("button", "api.json")`. */
export function componentRouteFile(slug: string, ...segments: string[]): ComponentRouteFile {
  return {
    absolute: path.join(DOCS_ROOT, COMPONENT_ROUTES, slug, ...segments),
    repoPath: [DOCS_PACKAGE, COMPONENT_ROUTES, slug, ...segments].join("/"),
  };
}
