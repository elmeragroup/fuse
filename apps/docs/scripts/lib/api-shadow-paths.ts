import path from "node:path";

import { repoRelative, repoRoot, uiRoot } from "./paths.ts";

/**
 * Stable repository-relative spelling shared by both sides of the comparison.
 *
 * TypeScript-go lowercases `NodeHandle.path` on case-insensitive volumes
 * (Darwin). `sourceFile.fileName` keeps the on-disk spelling. The checker walk
 * reports the former; the Effect extractor reports the latter through
 * `compilerSourceFileName`. Folding the fingerprint makes those two strings
 * compare equal on macOS and Linux. It is not covering a wrong-case import:
 * files under node_modules are camelCase (`useFocusable.d.ts`,
 * `useRender.d.mts`), and library imports use that spelling.
 *
 * The repo-root prefix comparison is already case-insensitive so an absolute
 * path still strips correctly when the volume folded the root.
 */
export function normalizePath(value: string): string {
  const normalized = value.split(path.sep).join("/");
  if (!path.isAbsolute(value)) return normalized.toLowerCase();
  const root = repoRoot.split(path.sep).join("/");
  const lower = normalized.toLowerCase();
  const rootLower = root.toLowerCase();
  const relative = lower.startsWith(`${rootLower}/`)
    ? normalized.slice(root.length + 1)
    : repoRelative(value);
  return relative.split(path.sep).join("/").toLowerCase();
}

/** Normalizes diagnostics before comparing the current and Effect problem logs. */
export function normalizeMessage(value: string): string {
  return value
    .replaceAll(uiRoot, "<repo>/packages/ui")
    .replaceAll(repoRoot, "<repo>")
    .replaceAll(path.sep, "/");
}

export function repoRelativePath(value: string): string {
  return normalizePath(value);
}
