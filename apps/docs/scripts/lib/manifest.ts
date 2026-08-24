/**
 * The generated component-page manifest (docs-site.md §3.3, §3.4).
 *
 * The one module the *site* imports about its component pages: what the SideNav lists, what
 * a page's intro and `metadata` say, what the QuickNav outlines, and which tokens the
 * Tokens-consumed section shows. It is a manifest, not content — the prose comes from the
 * authored `page.mdx`, each demo's source is read from the demo file at render time, and the
 * API reference reads the committed `api.json`. So a page's *substance* has exactly one
 * source, and this carries only the metadata none of those files owns.
 */

import type { ComponentPageEntry, DocsComponent } from "../../src/lib/docs-model.ts";
import { toPageEntry } from "../../src/lib/docs-model.ts";

/** Renders the generated module the nav, the intro and the QuickNav import. */
export function renderComponentPages(components: readonly DocsComponent[]): string {
  const entries: readonly ComponentPageEntry[] = components.map(toPageEntry);
  return `import type { ComponentPageEntry } from "../lib/docs-model";

/** Every component page the site serves, in route order (docs-site.md §3.3). */
export const COMPONENT_PAGES: readonly ComponentPageEntry[] = ${JSON.stringify(entries, null, 2)};
`;
}
