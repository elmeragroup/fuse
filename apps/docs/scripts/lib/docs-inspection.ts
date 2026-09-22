/**
 * Writer-free inspection of the docs inputs.
 *
 * The generation pass and the `api.json` drift check consume the same route inventory,
 * component path resolver, page reader, route policy, and size report. This module is the
 * *only* owner of demo and route validation: the generator imports these helpers rather
 * than keeping a second copy.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { normalizeDemoSource } from "../../src/lib/docs-model.ts";
import type { DocsDemo, RscStatus } from "../../src/lib/docs-model.ts";
import { componentSlugs, resolveComponentPaths } from "./components.ts";
import type { ComponentPaths } from "./components.ts";
import type { ProblemLog } from "./errors.ts";
import { readComponentPage } from "./page-source.ts";
import type { ComponentPageSource } from "./page-source.ts";
import { repoRelative, sizeBudgetsFile, fuseRoot } from "./paths.ts";
import { missingNavRoutes, staticRouteFile } from "./routes.ts";
import { readBundleSizes } from "./sizes.ts";
import type { BundleSizeReport } from "./sizes.ts";
import { assertDocsFuseCssExports } from "./workspace-css.ts";

/**
 * RSC classification of a module from its own leading directive.
 *
 * Only a directive in the module prologue counts: comments and other directives
 * (`"use strict"`) may precede it, but the first statement ends the prologue, so a
 * `"use client"` string expression further down does not make the module a client one.
 */
export function readRscStatus(source: string): RscStatus {
  const prologue = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const line of prologue.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (/^["']use client["'];?$/.test(trimmed)) return "client";
    if (!/^["'][^"']*["'];?$/.test(trimmed)) break;
  }
  return "server";
}

/** One component the API generator extracts: its slug plus the entry surface to walk. */
export type DocsApiComponent = {
  readonly slug: string;
  readonly entryFile: string;
  /** Exact public exports the API generator walks. */
  readonly exportNames: readonly string[];
  readonly sourceFile: string;
  /** The committed `api.json` the generator writes for this page. */
  readonly apiFile: string;
};

/** A slug with its resolved inputs — what the API inventory is built from. */
export type ResolvedComponent = {
  readonly slug: string;
  readonly paths: ComponentPaths;
};

export type ComponentInspection = {
  readonly slug: string;
  readonly page: ComponentPageSource;
  readonly paths: ComponentPaths;
};

/** Reads the exact route inventory consumed by the production generator. */
export function componentInspections(): readonly ComponentInspection[] {
  return componentSlugs().map(inspectComponent);
}

/**
 * The one API inventory: exactly the route-local component pages the generation pass
 * writes for, in production order. The pass and the `api.json` drift check both
 * extract from this list.
 */
export function docsApiInventory(
  components: readonly ResolvedComponent[] = componentSlugs().map((slug) => ({
    slug,
    paths: resolveComponentPaths(slug),
  }))
): readonly DocsApiComponent[] {
  const seen = new Set<string>();
  return components.map(({ slug, paths }) => {
    if (seen.has(slug)) {
      throw new Error(`docs API inventory contains duplicate component "${slug}"`);
    }
    seen.add(slug);
    return {
      slug,
      entryFile: paths.entryFile,
      exportNames: paths.apiExportNames,
      sourceFile: paths.sourceFile,
      apiFile: paths.apiFile,
    };
  });
}

/** Resolves and parses one route-local component page without writing artifacts. */
export function inspectComponent(slug: string): ComponentInspection {
  const paths = resolveComponentPaths(slug);
  return {
    slug,
    paths,
    page: readComponentPage(paths.pageFile, slug, repoRelative(paths.pageFile)),
  };
}

/** Validates and reads the demos referenced by one route-local component page. */
export function inspectComponentDemos(
  inspection: ComponentInspection,
  problems: ProblemLog
): readonly DocsDemo[] {
  const { slug, page, paths } = inspection;
  if (!existsSync(paths.entryFile)) {
    problems.add(`${slug}: no public entry module at ${repoRelative(paths.entryFile)}`);
  }
  if (!existsSync(paths.sourceFile)) {
    problems.add(`${slug}: no implementation file at ${repoRelative(paths.sourceFile)}`);
  }
  if (!existsSync(paths.demosDir)) {
    problems.add(`${slug}: no co-located demos directory at ${repoRelative(paths.demosDir)}`);
  }

  const rendered = new Set(page.demos.map((demo) => demo.file));
  if (existsSync(paths.demosDir)) {
    for (const entry of readdirSync(paths.demosDir)) {
      if (entry.endsWith(".tsx") && !rendered.has(entry)) {
        problems.add(`${slug}: demo file ${entry} is never rendered by the page`);
      }
    }
  }

  const demos: DocsDemo[] = [];
  for (const entry of page.demos) {
    const absolute = path.join(paths.demosDir, entry.file);
    const relative = repoRelative(absolute);
    if (!existsSync(absolute)) {
      problems.add(`${relative}: the page renders this demo, but the file does not exist`);
      continue;
    }
    const raw = readFileSync(absolute, "utf8");
    if (readRscStatus(raw) !== "client") {
      problems.add(`${relative}: a demo must start with a "use client" directive`);
    }
    demos.push({
      id: entry.id,
      title: entry.title,
      sourcePath: relative,
      source: normalizeDemoSource(raw),
    });
  }
  return demos;
}

/** Validates global read-only inputs and reads the canonical bundle-size report. */
export function inspectGlobalDocs(problems: ProblemLog): BundleSizeReport {
  assertDocsFuseCssExports(fuseRoot);
  for (const href of missingNavRoutes()) {
    problems.add(`nav entry ${href} has no route at ${repoRelative(staticRouteFile(href))}`);
  }
  return readBundleSizes(sizeBudgetsFile, problems);
}
