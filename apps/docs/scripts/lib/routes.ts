/**
 * Nav-destination verification.
 *
 * The Components group is derived from the route directories the generation pass globbed,
 * so it cannot point at a missing page. The Overview and Handbook groups are *authored* in
 * `src/lib/pages.ts`, and this is what stops one of them from shipping a 404 in the SideNav:
 * every authored entry must have a `page.tsx` or a `page.mdx` under the `(docs)` route group. The studio
 * manifest (`src/studio/registration.ts`) is held to the same rule under the `(studio)` route
 * group.
 *
 * The existence probe is a parameter so the invariant is provable without moving a real
 * route out of the way (`test/docs-pipeline.test.ts`).
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { STATIC_PAGES } from "../../src/lib/pages.ts";
import type { StaticPage } from "../../src/lib/pages.ts";
import { STUDIO_PAGES } from "../../src/studio/registration.ts";
import type { StudioPage } from "../../src/studio/registration.ts";
import { docsRouteGroup, studioRouteGroup } from "./paths.ts";

/** Answers whether a route file exists. */
export type RouteProbe = (routeFile: string) => boolean;

/**
 * Where an authored nav entry's route module may live: a `page.tsx`, or a `page.mdx` whose prose
 * the generation pass also reads as data (`prose-page.ts`).
 */
export function staticRouteFiles(href: string): readonly [tsx: string, mdx: string] {
  return [path.join(docsRouteGroup, href, "page.tsx"), proseRouteFile(href)];
}

/** Where an authored nav entry's MDX route module lives, when it has one. */
export function proseRouteFile(href: string): string {
  return path.join(docsRouteGroup, href, "page.mdx");
}

/** The authored nav entries with no route module, in manifest order. */
export function missingNavRoutes(
  pages: readonly Pick<StaticPage, "href">[] = STATIC_PAGES,
  probe: RouteProbe = existsSync
): readonly string[] {
  return pages.map((page) => page.href).filter((href) => !staticRouteFiles(href).some((file) => probe(file)));
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
