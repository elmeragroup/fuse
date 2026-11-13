/**
 * Which demos are Live code: every demo of a component page, and nothing on handbook or block
 * pages. The loader (`next.config.ts`'s Turbopack rule), its Vite twin for the tests, the demo
 * frame and the `/demo-source` route all ask here, so they cannot disagree. Node imports this
 * module by stripping types, so it keeps to erasable syntax.
 */

import type { DocsRouteSection } from "../docs-route-files";

/**
 * A component demo's module path, as Turbopack and Vite name it. A Vite id with a query, such as
 * the tests' `?original`, does not match, so that import keeps its source.
 */
export const LIVE_CODE_DEMO_PATH = /(?:^|\/)src\/app\/\(docs\)\/components\/[^/]+\/demos\/[^/?]+\.tsx$/u;

/**
 * Whether the loader rewrites a module for Live code.
 *
 * @param path - The module's path or Vite id.
 * @returns Whether it is a component demo.
 */
export function isLiveCodeDemo(path: string): boolean {
  return LIVE_CODE_DEMO_PATH.test(path);
}

/**
 * Whether a section's demo frames are Live code: a stage editor, and the edited source in the Code view.
 *
 * @param section - The docs section of the page.
 * @returns Whether the section is the component pages.
 */
export function hasLiveCode(section: DocsRouteSection): boolean {
  return section === "components";
}
