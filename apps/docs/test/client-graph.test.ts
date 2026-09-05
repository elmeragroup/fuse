import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

const srcRoot = path.join(docsRoot, "src");

/** The highlighter, and the one component that may reach it (docs-site.md §8). */
const HIGHLIGHTER = "sugar-high";

const EXTENSIONS = [".ts", ".tsx"] as const;

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      if (entry !== "generated") {
        files.push(...sourceFiles(absolute));
      }
      continue;
    }
    if (EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      files.push(absolute);
    }
  }
  return files;
}

/**
 * A leading `"use client"` directive — the real thing, not the quoted label the API view
 * renders as an RSC status.
 */
function isClientModule(source: string): boolean {
  const body = source.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/u, "").trimStart();
  return body.startsWith('"use client"') || body.startsWith("'use client'");
}

const RELATIVE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["'](\.[^"']*)["']/gmu;
const BARE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["']([^."'][^"']*)["']/gmu;

function resolveImport(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Every module reachable from `entry` through relative imports, `entry` included. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) {
      continue;
    }
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const resolved = resolveImport(file, match[1] ?? "");
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function importsHighlighter(file: string): boolean {
  return [...readFileSync(file, "utf8").matchAll(BARE_IMPORT)].some((match) => match[1] === HIGHLIGHTER);
}

describe("the docs client graph never reaches the highlighter (docs-site.md §8, ADR 0009)", () => {
  it("keeps sugar-high out of every module a client component can import", () => {
    const offenders: string[] = [];
    for (const entry of sourceFiles(srcRoot).filter((file) => isClientModule(readFileSync(file, "utf8")))) {
      for (const reached of reachableFrom(entry)) {
        if (importsHighlighter(reached)) {
          offenders.push(`${path.relative(docsRoot, entry)} → ${path.relative(docsRoot, reached)}`);
        }
      }
    }
    // Highlighting every prop signature at hydration is the regression this guards:
    // the server renders those blocks and hands them down as elements (`api-row.ts`).
    expect(offenders).toEqual([]);
  });

  it("still finds the client components and the server module that does highlight", () => {
    const clients = sourceFiles(srcRoot).filter((file) => isClientModule(readFileSync(file, "utf8")));
    expect(clients.length).toBeGreaterThanOrEqual(8);
    expect(clients.map((file) => path.basename(file))).toContain("api-prop-rows.tsx");
    expect(importsHighlighter(path.join(srcRoot, "components/docs-code-block.tsx"))).toBe(true);
  });
});
