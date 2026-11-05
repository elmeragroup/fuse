/**
 * The repository's source files: the one definition the module-name lint pass and the source-level
 * repository-policy suites share, of which trees hold source, which files are source, and which
 * folders hold no one's source.
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root: this module lives in `scripts/`. */
export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** The repository trees that hold source, which the source-level checks walk. */
export const SOURCE_TREES: readonly string[] = ["apps", "packages", "scripts", "tooling", "test"];

/** The JS and TS file kinds the source-level checks read. */
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/u;

/** Folders that hold installed, built or generated output, which the walker never enters. */
const SKIPPED_DIRECTORY_NAMES: ReadonlySet<string> = new Set(["node_modules", "dist", "generated"]);

/**
 * Whether a file basename is a JS or TS source file.
 *
 * @param name - The file's basename.
 * @returns True when the name carries a source extension.
 */
export function isSourceFile(name: string): boolean {
  return SOURCE_EXTENSION.test(name);
}

/**
 * Renders an absolute path relative to the repository root, with forward slashes.
 *
 * @param path - An absolute path inside the repository.
 * @returns The repository-relative POSIX path.
 */
export function repoRelativePath(path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

/**
 * The absolute paths of every file under `directory` whose basename `matches`, skipping
 * `node_modules`, `dist`, `generated` and dot-entries.
 *
 * @param directory - The absolute directory to walk.
 * @param matches - A predicate over a file's basename.
 * @returns The matching files' absolute paths.
 */
export function findFiles(directory: string, matches: (name: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith(".")) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, matches);
    return matches(entry.name) ? [path] : [];
  });
}
