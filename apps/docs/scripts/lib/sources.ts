/**
 * Walks a component's recipe surface: its own implementation files plus every
 * package-relative module they pull in (shared style utilities, overlay class
 * vocabulary, …). Demos, tests and locale dictionaries are excluded — they are not
 * part of what the component renders.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { uiSrc } from "./paths.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
const EXCLUDED_DIRECTORIES = new Set(["demos", "intl", "__snapshots__"]);
const RELATIVE_IMPORT = /(?:from|import)\s+"(\.[^"]+)"/g;

export type RecipeSources = {
  /** TS/TSX sources, in visit order. */
  sources: readonly string[];
  /** CSS files reachable from those sources. */
  stylesheets: readonly string[];
  /** Absolute paths of every file scanned, for reporting. */
  files: readonly string[];
};

function isTestFile(file: string): boolean {
  return /\.(?:test|test-d|browser\.test)\.[cm]?tsx?$/.test(file) || file.endsWith(".d.ts");
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Not this candidate.
    }
  }
  return null;
}

function isInsideLibrary(file: string): boolean {
  const relative = path.relative(uiSrc, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isExcluded(file: string): boolean {
  if (isTestFile(path.basename(file))) {
    return true;
  }
  return path
    .relative(uiSrc, file)
    .split(path.sep)
    .some((segment) => EXCLUDED_DIRECTORIES.has(segment));
}

/** Entry files: every non-test source directly inside the component directory. */
function entryFiles(componentDir: string): readonly string[] {
  return readdirSync(componentDir)
    .filter((entry) => SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension)))
    .filter((entry) => !isTestFile(entry))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => path.join(componentDir, entry));
}

/** Collects the transitive, package-local recipe surface of one component. */
export function collectRecipeSources(componentDir: string): RecipeSources {
  const visited = new Set<string>();
  const sources: string[] = [];
  const stylesheets: string[] = [];
  const files: string[] = [];
  const queue = [...entryFiles(componentDir)];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file) || !isInsideLibrary(file) || isExcluded(file)) {
      continue;
    }
    visited.add(file);
    files.push(file);
    const text = readFileSync(file, "utf8");
    if (file.endsWith(".css")) {
      stylesheets.push(text);
      continue;
    }
    sources.push(text);
    RELATIVE_IMPORT.lastIndex = 0;
    let match = RELATIVE_IMPORT.exec(text);
    while (match !== null) {
      const specifier = match[1];
      if (specifier !== undefined) {
        const resolved = resolveRelative(file, specifier);
        if (resolved !== null) {
          queue.push(resolved);
        }
      }
      match = RELATIVE_IMPORT.exec(text);
    }
  }

  return { sources, stylesheets, files };
}
