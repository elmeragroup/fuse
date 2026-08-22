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

/** Authored MDX shells. */
export const contentDir = path.join(docsRoot, "src/content/components");

/** Everything the generator writes under `src`. */
export const generatedDir = path.join(docsRoot, "src/generated");

/** Static markdown endpoints, served from `/components/<slug>.md`. */
export const markdownOutDir = path.join(docsRoot, "public/components");

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
