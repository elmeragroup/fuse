/**
 * The package source as the central source contracts read it: every non-test module under
 * `src/`, with its text and its code lines. `src/source-contracts.test.ts` owns the policies.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSync } from "oxc-parser";
import type { ParseResult } from "oxc-parser";

/** One module of the package source. */
export type SourceRecord = {
  /** The path from `src/`. */
  readonly relative: string;
  /** The whole module text. */
  readonly source: string;
  /** The text without comment lines, so prose that cites a spelling is not a copy of it. */
  readonly code: string;
};

function isTestFile(path: string): boolean {
  return (
    path.endsWith(".test.ts") ||
    path.endsWith(".test.tsx") ||
    path.endsWith(".browser.test.tsx") ||
    path.endsWith(".test-d.tsx")
  );
}

function walkSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkSourceFiles(path));
      continue;
    }
    if ((path.endsWith(".ts") || path.endsWith(".tsx")) && !isTestFile(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Line-comment and block-comment lines dropped, so prose citing a spelling is not a copy of it. */
function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/** The package source read once, with lookups by path from `src/`. */
export type SourceTree = {
  /** Every module, keyed by its absolute path. */
  readonly records: ReadonlyMap<string, SourceRecord>;
  /** The module's whole text. */
  readonly source: (relativePath: string) => string;
  /** The module's code lines. */
  readonly code: (relativePath: string) => string;
  /** Every module other than `owner` whose code contains `needle`. */
  readonly ownedBy: (owner: string, needle: string) => string[];
  /** Every module whose code contains `needle`. */
  readonly filesContainingCode: (needle: string) => string[];
  /** Every name the module exports, with type-only exports prefixed `type `. */
  readonly exportedNames: (relativePath: string) => string[];
};

/**
 * Read every non-test module under a source root.
 *
 * @param root - The absolute `src/` directory.
 * @returns The tree and its lookups.
 * @throws When a lookup names a module the tree does not hold.
 */
export function loadSourceTree(root: string): SourceTree {
  const records = new Map<string, SourceRecord>();
  for (const file of walkSourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    records.set(file, { relative: relative(root, file), source, code: codeOnly(source) });
  }
  const record = (relativePath: string): SourceRecord => {
    const found = records.get(join(root, relativePath));
    if (found === undefined) {
      throw new Error(`expected source file ${relativePath}`);
    }
    return found;
  };
  const matching = (needle: string, except?: string): string[] =>
    [...records.entries()]
      .filter(([file, { code }]) => file !== except && code.includes(needle))
      .map(([, { relative: path }]) => path);
  return {
    records,
    source: (relativePath) => record(relativePath).source,
    code: (relativePath) => record(relativePath).code,
    ownedBy: (owner, needle) => matching(needle, join(root, owner)),
    filesContainingCode: (needle) => matching(needle),
    exportedNames: (relativePath) => exportedNames(relativePath, record(relativePath).source),
  };
}

/**
 * Whether a module opens with the client directive.
 *
 * @param source - The module text.
 * @returns True when `"use client"` is the first statement.
 */
export function hasUseClientDirective(source: string): boolean {
  const trimmed = source.trimStart();
  return trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");
}

/**
 * Parse a module, failing loudly on a syntax error.
 *
 * @param relativePath - The module's path, which names it in a parse failure.
 * @param source - The module text.
 * @returns The parse result.
 * @throws When the module does not parse, a defect in package source.
 */
export function parseModule(relativePath: string, source: string): ParseResult {
  const parsed = parseSync(relativePath, source);
  if (parsed.errors.length > 0) {
    throw new Error(
      `${relativePath} does not parse: ${parsed.errors.map((error) => error.message).join("; ")}`
    );
  }
  return parsed;
}

/** Every name a module exports, with type-only exports prefixed `type `. */
function exportedNames(relativePath: string, source: string): string[] {
  return parseModule(relativePath, source).module.staticExports.flatMap(({ entries }) =>
    entries.map(({ exportName, isType }) => `${isType ? "type " : ""}${exportName.name ?? "default"}`)
  );
}
