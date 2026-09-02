import path from "node:path";

import { repoRelative, repoRoot, uiRoot } from "./paths.ts";

/** Stable repository-relative spelling shared by both sides of the comparison. */
export function normalizePath(value: string): string {
  const normalized = value.split(path.sep).join("/");
  if (!path.isAbsolute(value)) return normalized;
  const root = repoRoot.split(path.sep).join("/");
  const lower = normalized.toLowerCase();
  const rootLower = root.toLowerCase();
  return lower.startsWith(`${rootLower}/`) ? normalized.slice(root.length + 1) : repoRelative(value);
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
