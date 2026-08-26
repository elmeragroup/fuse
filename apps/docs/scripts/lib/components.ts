/**
 * The component-page inventory and where each page's inputs live.
 *
 * One directory under the components route per page. The directory *is* the inventory —
 * there is no shell registry a page can be missing from — and everything else about a
 * page is convention (its public entry, the identifier that entry exports, the
 * implementation file), so frontmatter never restates what the repo layout already says.
 *
 * This lives beside the generator rather than inside it because two readers need the
 * same resolution: the generation pass, and the `api.json` drift check that regenerates
 * the API data in-memory (docs-site.md §8).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { componentRoutesDir, uiSrc } from "./paths.ts";

function pascalCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Every component page on the site, in route order. */
export function componentSlugs(): readonly string[] {
  if (!existsSync(componentRoutesDir)) {
    return [];
  }
  return readdirSync(componentRoutesDir)
    .filter((entry) => existsSync(path.join(componentRoutesDir, entry, "page.mdx")))
    .sort((left, right) => left.localeCompare(right));
}

export type ComponentPaths = {
  pageFile: string;
  /** The committed, generated API artifact next to the page (docs-site.md §8). */
  apiFile: string;
  entryFile: string;
  entry: string;
  exportName: string;
  /**
   * Facade value exports the API generator walks (docs-site.md §8). Explicit names —
   * never a sweep of every namespace-shaped export on the entry.
   */
  apiExportNames: readonly string[];
  sourceFile: string;
  componentDir: string;
  demosDir: string;
};

function apiExportNamesFor(slug: string, exportName: string): readonly string[] {
  if (slug === "table") {
    return ["Table", "VerticalTable"];
  }
  if (slug === "checkbox") {
    return ["Checkbox", "CheckboxGroup", "CheckboxItem", "CheckboxItemGroup", "CheckboxDescription"];
  }
  if (slug === "radio-group") {
    return ["RadioGroup", "RadioGroupItem", "Radio", "RadioItem", "RadioItemGroup", "RadioIconButton"];
  }
  return [exportName];
}

/** Where a slug's inputs and its co-located generated artifact live. */
export function resolveComponentPaths(slug: string): ComponentPaths {
  const componentDir = path.join(uiSrc, "components", slug);
  const routeDir = path.join(componentRoutesDir, slug);
  const exportName = pascalCase(slug);
  return {
    pageFile: path.join(routeDir, "page.mdx"),
    apiFile: path.join(routeDir, "api.json"),
    entryFile: path.join(uiSrc, `${slug}.ts`),
    entry: `@elmeragroup/ui/${slug}`,
    exportName,
    apiExportNames: apiExportNamesFor(slug, exportName),
    sourceFile: path.join(componentDir, `${slug}.tsx`),
    componentDir,
    demosDir: path.join(routeDir, "demos"),
  };
}
