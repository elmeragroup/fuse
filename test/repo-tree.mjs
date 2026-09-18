import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, shared by the source-level repository-policy suites. */
export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Repository trees the source-level policy tests walk, shared by the guards that read source. */
export const SOURCE_TREES = ["apps", "packages", "scripts", "tooling", "test"];

/** The JS/TS file kinds the source-level policy tests read. */
export const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/;

/**
 * Whether a file basename is a JS/TS source file the source-level policy tests read.
 *
 * @param {string} name - File basename.
 * @returns {boolean} True when the name carries a source extension.
 */
export function isSourceFile(name) {
  return SOURCE_EXTENSION.test(name);
}

/**
 * Renders an absolute path relative to the repository root, with forward slashes.
 *
 * @param {string} path - Absolute path inside the repository.
 * @returns {string} The repository-relative POSIX path.
 */
export function repoRelativePath(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

/** Directory names the shared file walker never descends into. */
const SKIPPED_DIRECTORY_NAMES = new Set(["node_modules", "dist", "generated"]);

/**
 * Collects the absolute paths of every file under `directory` whose basename `matches`, skipping
 * `node_modules`, `dist`, `generated` and dot-entries.
 *
 * @param {string} directory - Absolute directory to walk.
 * @param {(name: string) => boolean} matches - Predicate over a file's basename.
 * @returns {string[]} Absolute paths of matching files.
 */
export function findFiles(directory, matches) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(path, matches));
    else if (matches(entry.name)) found.push(path);
  }
  return found;
}
