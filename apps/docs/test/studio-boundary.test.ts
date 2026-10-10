import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import type { Expression } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

/*
 * The theme studio stays removable by deleting its folders and the lines listed in
 * `src/studio/registration.ts`. That holds only while shared code reaches the studio through the
 * registration alone. The lint config has no import-boundary rule for apps/docs, and
 * `no-restricted-imports` matches specifier text per file glob, so lint cannot reject a studio
 * import everywhere except the studio's own trees while allowing one module from a list of seams.
 */

const STUDIO = "src/studio/";
const REGISTRATION = "src/studio/registration.ts";

/** The trees that belong to the studio and may import any studio module. */
const STUDIO_TREES = ["src/studio/", "src/app/(studio)/", "test/studio/"];

/** The studio's own generated modules, which `src/studio/generate` writes and removal prunes. */
const STUDIO_GENERATED = "src/generated/studio-";

/** The shared modules that may import the registration, and nothing else from the studio. */
const SEAMS = [
  "scripts/generate.ts",
  "scripts/lib/llms.ts",
  "scripts/lib/routes.ts",
  "scripts/lib/search.ts",
  "src/app/(landing)/landing/landing-nav.tsx",
  "src/app/og/docs/[[...path]]/route.tsx",
  "src/components/header.tsx",
  "test/docs-pipeline.test.ts",
  "test/og-fit.test.ts",
  "test/search-index.test.ts",
  "test/site-inventory.test.ts",
];

const EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".mdx"];

/**
 * Dependency, build and output directories, which hold no authored module. Every other directory
 * under the docs root is scanned, `src/generated` included: the generator writes those modules, and
 * a shared one importing the studio would break on removal like an authored one.
 */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "public", "dist", "coverage", "out"]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      if (!entry.startsWith(".") && !SKIPPED_DIRECTORIES.has(entry)) {
        files.push(...sourceFiles(absolute));
      }
    } else if (EXTENSIONS.includes(path.extname(entry))) {
      files.push(absolute);
    }
  }
  return files;
}

function relative(file: string): string {
  return path.relative(docsRoot, file).split(path.sep).join("/");
}

/**
 * Every quoted relative path anywhere in an MDX page, in single, double or backtick quotes. MDX
 * can import from ESM blocks, expressions and JSX alike, and docs has no direct MDX compiler
 * dependency, so the scan takes every literal instead of parsing. It can over-report a quoted path
 * in prose or a code fence, but it cannot miss a literal import.
 */
function mdxSpecifiers(source: string): string[] {
  return [...source.matchAll(/(["'`])(\.{1,2}\/[^"'`\n]*)\1/gu)].map((match) => match[2] ?? "");
}

/** The specifier of a dynamic `import()` written as a string or a template without substitutions. */
function literalSpecifier(source: Expression): string | undefined {
  if (source.type === "Literal") {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree tags every literal kind `Literal`; the value's type is the only tag a string literal has
    return typeof source.value === "string" ? source.value : undefined;
  }
  if (source.type === "TemplateLiteral" && source.expressions.length === 0) {
    return source.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/**
 * Every module specifier `file` depends on: static imports and `import type`, re-exports,
 * `import("…")` type references, and dynamic `import()` of a string or a template without
 * substitutions. An MDX page contributes every quoted relative path instead.
 */
function specifiersOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  if (path.extname(file) === ".mdx") {
    return mdxSpecifiers(source);
  }
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    throw new Error(
      `${relative(file)} does not parse: ${parsed.errors.map((error) => error.message).join("; ")}`
    );
  }
  const specifiers: string[] = [];
  new Visitor({
    ImportDeclaration: (node) => specifiers.push(node.source.value),
    ExportNamedDeclaration: (node) => {
      if (node.source !== null) specifiers.push(node.source.value);
    },
    ExportAllDeclaration: (node) => specifiers.push(node.source.value),
    TSImportType: (node) => specifiers.push(node.source.value),
    ImportExpression: (node) => {
      const specifier = literalSpecifier(node.source);
      if (specifier !== undefined) specifiers.push(specifier);
    },
  }).visit(parsed.program);
  return specifiers;
}

/** Each relative import of `file`, as a path relative to the docs root, extension resolved. */
function importsOf(file: string): string[] {
  return specifiersOf(file)
    .filter((specifier) => specifier.startsWith("."))
    .map((specifier) => {
      const target = relative(path.resolve(path.dirname(file), specifier));
      return path.extname(target) === "" ? `${target}.ts` : target;
    });
}

function isStudioModule(file: string): boolean {
  return file.startsWith(STUDIO) || file.startsWith(STUDIO_GENERATED);
}

function isStudioOwned(file: string): boolean {
  return STUDIO_TREES.some((tree) => file.startsWith(tree)) || file.startsWith(STUDIO_GENERATED);
}

/** Every import of a studio module from outside the studio, as `importer -> target`. */
function studioImports(): string[] {
  return sourceFiles(docsRoot).flatMap((file) => {
    const importer = relative(file);
    if (isStudioOwned(importer)) {
      return [];
    }
    return importsOf(file)
      .filter(isStudioModule)
      .map((target) => `${importer} -> ${target}`);
  });
}

describe("theme studio boundary", () => {
  it("reaches the studio from shared code only through the registration, from the listed seams", () => {
    const allowed = new Set(SEAMS.map((seam) => `${seam} -> ${REGISTRATION}`));
    expect(studioImports().filter((edge) => !allowed.has(edge))).toEqual([]);
  });

  it("finds each listed seam's import of the registration, so the list cannot go stale", () => {
    const seen = new Set(studioImports());
    expect(SEAMS.filter((seam) => !seen.has(`${seam} -> ${REGISTRATION}`))).toEqual([]);
  });
});
