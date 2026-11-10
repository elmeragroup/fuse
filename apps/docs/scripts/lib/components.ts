/**
 * The component-page inventory and where each page's inputs live.
 *
 * Each directory under the components route is one page, so no registry can miss a page.
 * The slug fixes the rest by convention: the title, the public entry, the export it
 * walks and the implementation file. The generation pass and the `api.json` drift check
 * both resolve pages through this module.
 *
 * A page documents its own entry, plus any entry `EXTRA_API_ENTRIES` assigns it, in one ordered
 * `apis` list, and each entry gets one committed artifact: `api.json` for the page's own,
 * `<entry>.api.json` beside it for each extra one. Extraction, rendering, markdown and search all
 * enumerate a page's artifacts from that list.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { componentApiFileName } from "../../src/lib/docs-route-files.ts";
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

/**
 * One entry a page documents: its public specifier, the modules and exports the API generator
 * walks, and the committed artifact the generator writes for it.
 */
export type ApiEntryPaths = {
  /**
   * The artifact's slug, which names its file and its drift record: the page's own slug for the
   * page's own entry, the entry's (such as `command-virtual`) for an extra one.
   */
  readonly slug: string;
  /** Public import specifier, e.g. `@elmeragroup/fuse/command-virtual`. */
  readonly entry: string;
  /** The public entry module, which the shared-part identity pass reads. */
  readonly entryFile: string;
  /** The module the API extractor reads: `entryFile`, or a facade the extractor can model. */
  readonly apiEntryFile: string;
  /**
   * Facade value exports the API generator walks. Explicit names —
   * never a sweep of every namespace-shaped export on the entry.
   */
  readonly exportNames: readonly string[];
  /** The committed, generated API artifact in the page's route directory. */
  readonly apiFile: string;
};

export type ComponentPaths = {
  pageFile: string;
  /** The page's reader-facing name, derived from the slug. */
  title: string;
  /**
   * Every entry the page's API reference documents, in reading order: the page's own first, then
   * each extra one `EXTRA_API_ENTRIES` assigns it.
   */
  apis: readonly [ApiEntryPaths, ...ApiEntryPaths[]];
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
  ["date-range-picker", ["DateRangePicker", "DateRangePickerPresetGroup", "DateRangePickerPresetItem"]],
  ["combobox", ["Combobox", "useComboboxAnchor"]],
  ["kbd", ["Kbd", "KbdGroup"]],
  ["skeleton", ["Skeleton", "SkeletonReveal"]],
  ["sidebar", ["Sidebar", "useSidebar"]],
  ["file-upload", ["FileUpload", "useFileUpload"]],
  ["carousel", ["Carousel", "useCarousel"]],
  ["chart", ["Chart", "useChartPoint", "formatChartValue", "formatChartSlot"]],
  ["temporal-calendar", ["Calendar"]],
  ["temporal-range-calendar", ["RangeCalendar"]],
]);

/**
 * Pages that document one export of another page's entry. Every chart page reads
 * `@elmeragroup/fuse/chart`, and its implementation file is the family's Root.
 */
export const SHARED_ENTRY_PAGES = new Map<string, { readonly entry: string; readonly source: string }>([
  ["chart", { entry: "chart", source: "chart-root" }],
  ["area-chart", { entry: "chart", source: "chart-root" }],
  ["bar-chart", { entry: "chart", source: "chart-root" }],
  ["line-chart", { entry: "chart", source: "chart-root" }],
  ["pie-chart", { entry: "chart", source: "pie-chart-root" }],
  ["radial-chart", { entry: "chart", source: "radial-chart-root" }],
  ["radar-chart", { entry: "chart", source: "radar-chart-root" }],
  ["clock-chart", { entry: "chart", source: "clock-chart-root" }],
  ["scatter-chart", { entry: "chart", source: "scatter-chart-root" }],
  ["sparkline", { entry: "chart", source: "sparkline" }],
]);

/**
 * Pages whose slug is not their entry's, because another page already holds the entry's slug.
 * `calendar` and `range-calendar` are the interim React Aria calendars' pages until that tier is
 * removed, so the Temporal calendars of `@elmeragroup/fuse/calendar` and
 * `@elmeragroup/fuse/range-calendar` document themselves as `temporal-calendar` and
 * `temporal-range-calendar`. The entry's
 * own conventions still apply: `src/calendar.ts`, `components/calendar/calendar.tsx` and the
 * `Calendar` export.
 */
const ENTRY_SLUG_OF_PAGE = new Map<string, string>([
  ["temporal-calendar", "calendar"],
  ["temporal-range-calendar", "range-calendar"],
]);

/**
 * The module the API extractor reads for the chart entry's pages. `@elmeragroup/internal` cannot
 * model an ES module namespace's type, so it reads the plain objects of
 * `packages/fuse/test/chart/api-facade.ts`, which hold the same parts under the same keys.
 */
const CHART_API_FACADE = path.join(fuseSrc, "..", "test", "chart", "api-facade.ts");

function apiExportNamesFor(slug: string): readonly string[] {
  return EXTRA_API_EXPORT_NAMES.get(slug) ?? [pascalCase(slug)];
}

/**
 * Entries that have no page of their own, keyed by the page that documents them. Without a page
 * an entry has no committed artifact, so its API changes would reach neither a reviewable diff
 * nor the drift check. Each extra entry resolves by the same slug conventions as a page's own:
 * `packages/fuse/src/<slug>.ts`, its `pascalCase` export unless `EXTRA_API_EXPORT_NAMES` lists
 * more, and an artifact named for it beside the page's `api.json`.
 *
 * `command-virtual` is a subpath of its own only because it imports the optional
 * `@tanstack/react-virtual` peer; it is one more `Command.List` render element, so the Command
 * page's "Long lists" section documents it.
 */
const EXTRA_API_ENTRIES = new Map<string, readonly string[]>([["command", ["command-virtual"]]]);

function resolveExtraApi(pageSlug: string, slug: string): ApiEntryPaths {
  const entryFile = path.join(fuseSrc, `${slug}.ts`);
  return {
    slug,
    entry: `@elmeragroup/fuse/${slug}`,
    entryFile,
    apiEntryFile: entryFile,
    exportNames: apiExportNamesFor(slug),
    apiFile: path.join(componentRoutesDir, pageSlug, componentApiFileName(pageSlug, slug)),
  };
}

/** Where a slug's inputs and its co-located generated artifacts live. */
export function resolveComponentPaths(slug: string): ComponentPaths {
  const routeDir = path.join(componentRoutesDir, slug);
  const racFacade = path.join(fuseSrc, "react-aria", `${slug}.ts`);
  const isRac = existsSync(racFacade);
  const shared = SHARED_ENTRY_PAGES.get(slug);
  const entrySlug = shared?.entry ?? ENTRY_SLUG_OF_PAGE.get(slug) ?? slug;
  const componentDir = isRac
    ? path.join(fuseSrc, "react-aria", slug)
    : path.join(fuseSrc, "components", entrySlug);
  const entryFile = isRac ? racFacade : path.join(fuseSrc, `${entrySlug}.ts`);
  const own: ApiEntryPaths = {
    slug,
    entry: isRac ? `@elmeragroup/fuse/react-aria/${slug}` : `@elmeragroup/fuse/${entrySlug}`,
    entryFile,
    apiEntryFile: shared?.entry === "chart" ? CHART_API_FACADE : entryFile,
    exportNames: apiExportNamesFor(slug),
    apiFile: path.join(routeDir, componentApiFileName(slug, slug)),
  };
  return {
    pageFile: path.join(routeDir, "page.mdx"),
    title: displayName(slug),
    apis: [own, ...(EXTRA_API_ENTRIES.get(slug) ?? []).map((extra) => resolveExtraApi(slug, extra))],
    sourceFile: path.join(componentDir, `${shared?.source ?? entrySlug}.tsx`),
    componentDir,
    demosDir: path.join(routeDir, "demos"),
  };
}
