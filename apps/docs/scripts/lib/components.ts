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

/**
 * The pages whose entry publishes more than the one name `pascalCase(slug)` produces.
 * A page absent from this table walks exactly its `exportName` — the common case, and
 * the reason this is a lookup rather than a branch per page.
 *
 * A `Map` rather than a `Record`: an open `Record<string, …>` annotation on a literal is
 * the widening the anti-slop plugin rejects, and `Map#get` gives the `undefined` arm the
 * `??` below needs without an assertion.
 */
const EXTRA_API_EXPORT_NAMES = new Map<string, readonly string[]>([
  ["table", ["Table", "VerticalTable"]],
  ["checkbox", ["Checkbox", "CheckboxGroup", "CheckboxItem", "CheckboxItemGroup", "CheckboxDescription"]],
  [
    "radio-group",
    ["RadioGroup", "RadioGroupItem", "Radio", "RadioItem", "RadioItemGroup", "RadioIconButton"],
  ],
  ["date-field", ["DateField", "DateInput"]],
  ["focusable", ["Focusable", "useFocusable"]],
  ["grid-list", ["GridList", "GridListItem"]],
  ["calendar", ["Calendar", "CalendarHeader", "CalendarGridHeader"]],
  ["date-picker", ["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]],
  ["combobox", ["Combobox", "useComboboxAnchor"]],
  ["sidebar", ["Sidebar", "useSidebar"]],
]);

function apiExportNamesFor(slug: string, exportName: string): readonly string[] {
  return EXTRA_API_EXPORT_NAMES.get(slug) ?? [exportName];
}

/** Where a slug's inputs and its co-located generated artifact live. */
export function resolveComponentPaths(slug: string): ComponentPaths {
  const routeDir = path.join(componentRoutesDir, slug);
  const exportName = pascalCase(slug);
  const racFacade = path.join(uiSrc, "react-aria", `${slug}.ts`);
  const isRac = existsSync(racFacade);
  const componentDir = isRac ? path.join(uiSrc, "react-aria", slug) : path.join(uiSrc, "components", slug);
  return {
    pageFile: path.join(routeDir, "page.mdx"),
    apiFile: path.join(routeDir, "api.json"),
    entryFile: isRac ? racFacade : path.join(uiSrc, `${slug}.ts`),
    entry: isRac ? `@elmeragroup/ui/react-aria/${slug}` : `@elmeragroup/ui/${slug}`,
    exportName,
    apiExportNames: apiExportNamesFor(slug, exportName),
    sourceFile: path.join(componentDir, `${slug}.tsx`),
    componentDir,
    demosDir: path.join(routeDir, "demos"),
  };
}
