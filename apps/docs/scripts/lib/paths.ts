import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `apps/docs`. */
export const docsRoot = path.join(here, "../..");

/** The workspace root. */
export const repoRoot = path.join(docsRoot, "../..");

/** `packages/fuse`. */
export const fuseRoot = path.join(repoRoot, "packages/fuse");

/** `packages/fuse/src`. */
export const fuseSrc = path.join(fuseRoot, "src");

/** The tsconfig the generator opens to resolve library types. */
export const fuseTsconfig = path.join(fuseRoot, "tsconfig.json");

/** Everything the generator writes under `src`. */
export const generatedDir = path.join(docsRoot, "src/generated");

/** Static markdown endpoints, served from `/components/<slug>.md`. */
export const markdownOutDir = path.join(docsRoot, "public/components");

/** The `(docs)` route group, where every nav destination must have a `page.tsx`. */
export const docsRouteGroup = path.join(docsRoot, "src/app/(docs)");

/** The `(studio)` route group, where every studio page must have a `page.tsx`. */
export const studioRouteGroup = path.join(docsRoot, "src/app/(studio)");

/**
 * The component route directories. Each holds the component's authored `page.mdx` and
 * its co-located `demos/`.
 *
 * `src/lib/docs-route-files.ts` encodes the same `src/app/(docs)/components/<slug>/`
 * layout as a cwd-relative path (`DOCS_ROUTES`), because it resolves route files at
 * render time rather than from this module's URL. Moving the route group means changing
 * both.
 */
export const componentRoutesDir = path.join(docsRouteGroup, "components");

/** The generated site-root `llms.txt` index. */
export const llmsTxtFile = path.join(docsRoot, "public/llms.txt");

/** The budget module `size-limit` enforces, and the docs publish measurements from. */
export const sizeBudgetsFile = path.join(fuseRoot, "scripts/size-budgets.ts");

/** Repo host base for **View source** links. */
export const REPO_BLOB_BASE = "https://github.com/elmeragroup/fuse/blob/main";

export function repoRelative(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}
