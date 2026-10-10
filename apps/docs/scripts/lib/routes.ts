/**
 * Nav-destination verification.
 *
 * The Components group is derived from the route directories the generation pass globbed,
 * so it cannot point at a missing page. The Overview and Handbook groups are *authored* in
 * `src/lib/pages.ts`, and this is what stops one of them from shipping a 404 in the SideNav:
 * every authored entry must have a `page.tsx` under the `(docs)` route group. The studio
 * manifest is held to the same rule under the `(studio)` route group.
 *
 * The existence probe is a parameter so the invariant is provable without moving a real
 * route out of the way (`test/docs-pipeline.test.ts`).
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { STATIC_PAGES, STUDIO_PAGES } from "../../src/lib/pages.ts";
import type { StaticPage, StudioPage } from "../../src/lib/pages.ts";
import { docsRouteGroup, studioRouteGroup } from "./paths.ts";

/** Answers whether a route file exists. */
export type RouteProbe = (routeFile: string) => boolean;

/** Where an authored nav entry's route module has to live. */
export function staticRouteFile(href: string): string {
  return path.join(docsRouteGroup, href, "page.tsx");
}

/** The authored nav entries with no route module, in manifest order. */
export function missingNavRoutes(
  pages: readonly Pick<StaticPage, "href">[] = STATIC_PAGES,
  probe: RouteProbe = existsSync
): readonly string[] {
  return pages.map((page) => page.href).filter((href) => !probe(staticRouteFile(href)));
}

/** Where a studio page's route module has to live. */
export function studioRouteFile(href: string): string {
  return path.join(studioRouteGroup, href, "page.tsx");
}

/** The studio pages with no route module, in manifest order. */
export function missingStudioRoutes(
  pages: readonly Pick<StudioPage, "href">[] = STUDIO_PAGES,
  probe: RouteProbe = existsSync
): readonly string[] {
  return pages.map((page) => page.href).filter((href) => !probe(studioRouteFile(href)));
}
