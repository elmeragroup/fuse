import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `apps/docs`. */
export const docsRoot = path.join(here, "../..");

/** The workspace root. */
export const repoRoot = path.join(docsRoot, "../..");

/** `packages/ui`. */
export const uiRoot = path.join(repoRoot, "packages/ui");

/** `packages/ui/src`. */
export const uiSrc = path.join(uiRoot, "src");

/** The tsconfig the generator opens to resolve library types. */
export const uiTsconfig = path.join(uiRoot, "tsconfig.json");

/** Everything the generator writes under `src`. */
export const generatedDir = path.join(docsRoot, "src/generated");

/** Static markdown endpoints, served from `/components/<slug>.md`. */
export const markdownOutDir = path.join(docsRoot, "public/components");

/** The `(docs)` route group, where every nav destination must have a `page.tsx`. */
export const docsRouteGroup = path.join(docsRoot, "src/app/(docs)");

/**
 * The component route directories. Each holds the component's authored `page.mdx` and
 * its co-located `demos/` (docs-site.md §1, §6 — demos live in the docs app, next to the
 * page they document, not in `packages/ui`).
 *
 * The frame encodes the same `src/app/(docs)/components/<slug>/demos/<file>` layout as a
 * cwd-relative path (`COMPONENT_ROUTES` in `src/lib/demo-source.ts`), because it resolves
 * demos at render time rather than from this module's URL. Moving the route group means
 * changing both.
 */
export const componentRoutesDir = path.join(docsRouteGroup, "components");

/** The generated site-root `llms.txt` index. */
export const llmsTxtFile = path.join(docsRoot, "public/llms.txt");

/** The budget module `size-limit` enforces, and the docs publish measurements from. */
export const sizeBudgetsFile = path.join(uiRoot, "scripts/size-budgets.ts");

/** Repo host base for **View source** links. */
export const REPO_BLOB_BASE = "https://github.com/elmeragroup/ui/blob/main";

export function repoRelative(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

/**
 * `NodeHandle.path` is a canonicalised path (lower-cased on case-insensitive
 * filesystems), so comparisons against real paths have to be case-insensitive too.
 */
export function isLibrarySourcePath(candidate: string): boolean {
  return candidate.toLowerCase().includes("/packages/ui/src/");
}
