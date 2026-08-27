import { relative } from "node:path";

/**
 * Repository-relative form of an absolute file path, with forward slashes.
 *
 * Single owner for every repository-relative path the backend reports —
 * provenance declaration paths, re-export chains, and derived module names.
 * An empty relative result (the file equal to the root itself, which no real
 * module file reaches) normalizes to `.`, exactly as the provenance side has
 * always reported; the module walk previously returned the empty string
 * there, so no reachable input observes the reconciliation.
 */
export function repositoryRelativePath(rootDirectory: string, filePath: string): string {
  const path = relative(rootDirectory, filePath).replaceAll("\\", "/");
  return path === "" ? "." : path;
}
