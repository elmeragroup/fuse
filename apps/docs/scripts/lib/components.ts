/**
 * The component-page inventory and where each page's inputs live.
 *
 * Each directory under the components route is one page, so no registry can miss a page.
 * The slug fixes the rest by convention: the title, the public entry, the export it
 * walks and the implementation file. The generation pass and the `api.json` drift check
 * both resolve pages through this module.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { componentRoutesDir, fuseSrc } from "./paths.ts";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function pascalCase(slug: string): string {
  return slug.split("-").map(capitalize).join("");
}

/** Slug parts spelled in a fixed casing, so `ui-providers` is the `UI Providers` page. */
const FIXED_CASE_SLUG_PARTS = new Map<string, string>([["ui", "UI"]]);

/**
 * The reader-facing name of a component. `alert-dialog` becomes `Alert Dialog`. The
 * SideNav label, the H1, the search hit, the `llms.txt` row, the `<title>` and the
 * markdown heading all read this one spelling.
 */
function displayName(slug: string): string {
  return slug
    .split("-")
    .map((part) => FIXED_CASE_SLUG_PARTS.get(part) ?? capitalize(part))
    .join(" ");
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
  /** The page's reader-facing name, derived from the slug. */
  title: string;
  /** The committed, generated API artifact next to the page. */
  apiFile: string;
  entryFile: string;
  entry: string;
  /**
   * Facade value exports the API generator walks. Explicit names —
   * never a sweep of every namespace-shaped export on the entry.
   */
  apiExportNames: readonly string[];
  sourceFile: string;
  componentDir: string;
  demosDir: string;
};

/**
 * The pages whose entry publishes more than the one name `pascalCase(slug)` produces.
 * A page absent from this table walks only that name.
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

function apiExportNamesFor(slug: string): readonly string[] {
  return EXTRA_API_EXPORT_NAMES.get(slug) ?? [pascalCase(slug)];
}

/** Where a slug's inputs and its co-located generated artifact live. */
export function resolveComponentPaths(slug: string): ComponentPaths {
  const routeDir = path.join(componentRoutesDir, slug);
  const racFacade = path.join(fuseSrc, "react-aria", `${slug}.ts`);
  const isRac = existsSync(racFacade);
  const componentDir = isRac
    ? path.join(fuseSrc, "react-aria", slug)
    : path.join(fuseSrc, "components", slug);
  return {
    pageFile: path.join(routeDir, "page.mdx"),
    title: displayName(slug),
    apiFile: path.join(routeDir, "api.json"),
    entryFile: isRac ? racFacade : path.join(fuseSrc, `${slug}.ts`),
    entry: isRac ? `@elmeragroup/fuse/react-aria/${slug}` : `@elmeragroup/fuse/${slug}`,
    apiExportNames: apiExportNamesFor(slug),
    sourceFile: path.join(componentDir, `${slug}.tsx`),
    componentDir,
    demosDir: path.join(routeDir, "demos"),
  };
}
