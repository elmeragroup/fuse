/**
 * Writer-free inspection of the docs inputs.
 *
 * The production generator and the shadow comparison consume the same route inventory,
 * component path resolver, page reader, route policy, and size report. The helpers here
 * mirror the generator's remaining demo validation without importing its writer entrypoint.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { normalizeDemoSource } from "../../src/lib/docs-model.ts";
import type { DocsDemo } from "../../src/lib/docs-model.ts";
import { componentSlugs, resolveComponentPaths } from "./components.ts";
import type { ComponentPaths } from "./components.ts";
import type { ProblemLog } from "./errors.ts";
import { readComponentPage } from "./page-source.ts";
import type { ComponentPageSource } from "./page-source.ts";
import { repoRelative, sizeBudgetsFile, uiRoot } from "./paths.ts";
import { missingNavRoutes, staticRouteFile } from "./routes.ts";
import { readBundleSizes } from "./sizes.ts";
import type { BundleSizeReport } from "./sizes.ts";
import { assertDocsUiCssExports } from "./workspace-css.ts";

export type ComponentInspection = {
  readonly slug: string;
  readonly page: ComponentPageSource;
  readonly paths: ComponentPaths;
};

/** Reads the exact route inventory consumed by the production generator. */
export function componentInspections(): readonly ComponentInspection[] {
  return componentSlugs().map(inspectComponent);
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
    if (!/^\s*["']use client["']/.test(raw)) {
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
  assertDocsUiCssExports(uiRoot);
  for (const href of missingNavRoutes()) {
    problems.add(`nav entry ${href} has no route at ${repoRelative(staticRouteFile(href))}`);
  }
  return readBundleSizes(sizeBudgetsFile, problems);
}
