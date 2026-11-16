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
import type { DocsDemo } from "../../src/lib/docs-model.ts";
import { componentSlugs, resolveComponentPaths } from "./components.ts";
import type { ApiEntryPaths, ComponentPaths } from "./components.ts";
import type { ProblemLog } from "./errors.ts";
import { readComponentPage } from "./page-source.ts";
import type { ComponentPageSource } from "./page-source.ts";
import { repoRelative, fuseRoot } from "./paths.ts";
import { missingNavRoutes, missingStudioRoutes, staticRouteFile, studioRouteFile } from "./routes.ts";
import { readRscStatus } from "./rsc-status.ts";
import { assertDocsFuseCssExports } from "./workspace-css.ts";

/**
 * Reviewed demos written as Server Components, by repository path. Each starts with no
 * `"use client"` line, and every other demo must start with one, because a demo that imports a
 * hook or passes a function prop only works as a client module. Review a new entry here rather
 * than deriving it from the demo files.
 */
export const SERVER_DEMOS: ReadonlySet<string> = new Set([
  // The chart contract promises that a server component renders a chart from plain data, and this
  // demo shows that path on the bar-chart page.
  "apps/docs/src/app/(docs)/components/bar-chart/demos/bar-chart-server.tsx",
  // A pie from plain data renders on the server too, its slices, labels and table written there (S13).
  "apps/docs/src/app/(docs)/components/pie-chart/demos/pie-chart-server.tsx",
  // A radar's grid, labels and series render on the server from plain data (S13).
  "apps/docs/src/app/(docs)/components/radar-chart/demos/radar-chart-deviation.tsx",
  // A dial of stacked columns renders on the server from plain data (S13).
  "apps/docs/src/app/(docs)/components/clock-chart/demos/clock-chart-server.tsx",
  // Sparkline calls no hook, and this demo shows it drawn on the server with no client JavaScript.
  "apps/docs/src/app/(docs)/components/sparkline/demos/sparkline-server.tsx",
  // A server component wraps server-rendered Sparklines in the client SparklineHover, which reads
  // their geometry from the markup, so the data never crosses Flight as props.
  "apps/docs/src/app/(docs)/components/sparkline/demos/sparkline-glide.tsx",
  // A server component writes selection rows and their SubSections, which must still render
  // outside each row's label once they cross Flight (#508).
  "apps/docs/src/app/(docs)/components/selection-item/demos/selection-item-server-shell.tsx",
  "apps/docs/src/app/(docs)/components/selection-item/demos/selection-item-server-checkbox-rows.tsx",
  "apps/docs/src/app/(docs)/components/selection-item/demos/selection-item-server-radio-rows.tsx",
]);

/**
 * One committed artifact the API generator extracts: one row of a page's `apis`, plus the page
 * whose reference renders it.
 */
export type DocsApiComponent = ApiEntryPaths & {
  /** The component page whose API reference renders this artifact. */
  readonly page: string;
};

/** A slug with its resolved inputs — what the API inventory is built from. */
type ResolvedComponent = {
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
 * The one API inventory: one artifact per row of each route-local component page's `apis`, each
 * page's own entry first and then its extra ones, in production order. The pass and the
 * `api.json` drift check both extract from this list. An artifact slug names one artifact, so an
 * extra entry that shares a page's slug fails here.
 */
export function docsApiInventory(components: readonly ResolvedComponent[]): readonly DocsApiComponent[] {
  const seen = new Set<string>();
  return components.flatMap(({ slug, paths }) =>
    paths.apis.map((api): DocsApiComponent => {
      if (seen.has(api.slug)) {
        throw new Error(`docs API inventory contains duplicate component "${api.slug}"`);
      }
      seen.add(api.slug);
      return { ...api, page: slug };
    })
  );
}

/** Resolves and parses one route-local component page without writing artifacts. */
function inspectComponent(slug: string): ComponentInspection {
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
  for (const { entryFile } of paths.apis) {
    if (!existsSync(entryFile)) {
      problems.add(`${slug}: no public entry module at ${repoRelative(entryFile)}`);
    }
  }
  if (!existsSync(paths.sourceFile)) {
    problems.add(`${slug}: no implementation file at ${repoRelative(paths.sourceFile)}`);
  }
  if (!existsSync(paths.demosDir)) {
    problems.add(`${slug}: no co-located demos directory at ${repoRelative(paths.demosDir)}`);
  }

  const rendered = new Set([...page.demos.map((demo) => demo.file), page.defaultDemo]);
  if (existsSync(paths.demosDir)) {
    for (const entry of readdirSync(paths.demosDir)) {
      if (entry.endsWith(".tsx") && !rendered.has(entry)) {
        problems.add(`${slug}: demo file ${entry} is never rendered by the page`);
      }
    }
  }

  // The default stage gets every check a titled demo gets, and no section of the outline.
  readRenderedDemo(paths.demosDir, page.defaultDemo, problems);
  return page.demos.flatMap((entry): DocsDemo[] => {
    const demo = readRenderedDemo(paths.demosDir, entry.file, problems);
    if (demo === null) return [];
    return [
      { id: entry.id, title: entry.title, sourcePath: demo.relative, source: normalizeDemoSource(demo.raw) },
    ];
  });
}

/**
 * Reads one demo file a page renders, after checking that it exists and that its directive
 * matches its review: a server demo is listed in `SERVER_DEMOS`, and every other demo is a client
 * module. A failed check goes to `problems`.
 *
 * @returns The file's repo path and source, or `null` when it does not exist.
 */
function readRenderedDemo(
  demosDir: string,
  file: string,
  problems: ProblemLog
): { readonly relative: string; readonly raw: string } | null {
  const absolute = path.join(demosDir, file);
  const relative = repoRelative(absolute);
  if (!existsSync(absolute)) {
    problems.add(`${relative}: the page renders this demo, but the file does not exist`);
    return null;
  }
  const raw = readFileSync(absolute, "utf8");
  const status = readRscStatus(raw);
  if (SERVER_DEMOS.has(relative)) {
    if (status !== "server") {
      problems.add(`${relative}: a reviewed server demo must not start with a "use client" directive`);
    }
  } else if (status !== "client") {
    problems.add(`${relative}: a demo must start with a "use client" directive`);
  }
  return { relative, raw };
}

/** Validates global read-only inputs. */
export function inspectGlobalDocs(problems: ProblemLog): void {
  assertDocsFuseCssExports(fuseRoot);
  for (const href of missingNavRoutes()) {
    problems.add(`nav entry ${href} has no route at ${repoRelative(staticRouteFile(href))}`);
  }
  for (const href of missingStudioRoutes()) {
    problems.add(`studio page ${href} has no route at ${repoRelative(studioRouteFile(href))}`);
  }
}
