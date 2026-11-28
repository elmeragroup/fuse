import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Catalog } from "@elmeragroup/docs-catalog";

import { buildIndex, search } from "../src/search.ts";

// Unit under test: the search ranking, on the catalog that `docs#generate` writes. Oracle:
// hand-written expectations for queries that agents send, the build-ui skill's own examples among
// them. A query that names a page and asks for its API lands on its API reference, a description
// of a need finds the component for it before pages whose demo source holds the words, and an
// excerpt shows the identifier the query names. A need that two pages serve equally well accepts
// either, so the pin fails only when neither ranks.

const catalogFile = join(import.meta.dirname, "..", "..", "docs", "src", "generated", "catalog.json");
const catalog = Schema.decodeSync(Schema.fromJsonString(Catalog))(readFileSync(catalogFile, "utf8"));
const index = buildIndex(catalog.documents);

const hrefs = (query: string, limit = 8) => search(index, query, limit).map((hit) => hit.href);

/** The page of an href, without its section fragment. */
const pageOf = (href: string) => href.split("#", 1)[0];

/** Where the first of the pages ranks for a query, or -1 when none is in the first eight. */
const rankOf = (query: string, pages: readonly string[]) =>
  hrefs(query).findIndex((href) => pages.includes(pageOf(href) ?? ""));

describe("search on the generated catalog", () => {
  it("lands a page name and API on that page's API reference", () => {
    expect(hrefs("select API", 1)).toEqual(["/components/select#api-reference"]);
    expect(hrefs("button API", 1)).toEqual(["/components/button#api-reference"]);
  });

  it("finds a select or radio group first for picking one option, above any data table filter demo", () => {
    const found = hrefs("pick one option from a list");
    const pick = found.findIndex((href) => /^\/components\/(?:select|select-field|radio-group)#/u.test(href));
    expect(pick).toBe(0);
  });

  it("shows the prop a query names in the excerpt", () => {
    const [hit] = search(index, "select onValueChange", 1);
    expect(hit?.href).toMatch(/^\/components\/select#/u);
    expect(hit?.excerpt).toContain("onValueChange");
  });

  it("lands a page name and a topic on that page", () => {
    expect(hrefs("button pending", 1)[0]).toMatch(/^\/components\/button#/u);
  });

  it.each([
    { query: "show a loading state on a button", pages: ["/components/button"], within: 1 },
    {
      query: "multi-line text input",
      pages: ["/components/textarea", "/components/textarea-field"],
      within: 2,
    },
    { query: "confirmation dialog", pages: ["/components/alert-dialog", "/components/dialog"], within: 2 },
    { query: "choose a date range", pages: ["/components/date-range-picker"], within: 2 },
    { query: "table with sorting", pages: ["/components/data-table"], within: 2 },
    { query: "text field label", pages: ["/components/text-field"], within: 2 },
    { query: "toast", pages: ["/components/toast"], within: 1 },
    { query: "date picker", pages: ["/components/date-picker"], within: 1 },
    { query: "dialog", pages: ["/components/dialog"], within: 1 },
    { query: "theme", pages: ["/handbook/theming"], within: 1 },
    { query: "isPending", pages: ["/components/button", "/components/confirm-button"], within: 1 },
    { query: "breaking change", pages: ["/releases"], within: 3 },
    { query: "language switcher", pages: ["/handbook/localization"], within: 3 },
  ])("ranks $pages within the first $within for $query", ({ query, pages, within }) => {
    const rank = rankOf(query, pages);
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(within);
  });

  it("finds a confirmation for deleting above every chart whose demo steps before a point", () => {
    const found = hrefs("confirm before deleting", 20);
    const confirmations = found.filter((href) =>
      /^\/components\/(?:alert-dialog|confirm-button)#/u.test(href)
    );
    const firstChart = found.findIndex((href) => href.includes("chart") || href.includes("sparkline"));
    expect(confirmations).toHaveLength(2);
    expect(found.indexOf(confirmations[1] ?? "")).toBeLessThan(firstChart === -1 ? found.length : firstChart);
  });

  it.each([
    { query: "DatePicker", href: "/components/date-picker#overview" },
    { query: "AlertDialog", href: "/components/alert-dialog#overview" },
    { query: "Line Chart", href: "/components/line-chart#overview" },
  ])("lands the component name $query on its page", ({ query, href }) => {
    expect(hrefs(query, 1)).toEqual([href]);
  });

  it.each([
    { query: "Tabs.List", href: "/components/tabs#api-tabs-list" },
    { query: "Select.Item", href: "/components/select#api-select-item" },
    { query: "Dialog.Trigger", href: "/components/dialog#api-dialog-trigger" },
    // Each part shares its words with a chart page's title, such as Line chart.
    { query: "Chart.Line", href: "/components/chart#api-chart-line" },
    { query: "Chart.Bar", href: "/components/chart#api-chart-bar" },
    { query: "Chart.Area", href: "/components/chart#api-chart-area" },
  ])("lands the part $query on its API section", ({ query, href }) => {
    expect(hrefs(query, 1)).toEqual([href]);
  });

  it("lands on the section that holds the rarer of two query words", () => {
    expect(hrefs("keyboard shortcut", 1)).toEqual(["/components/kbd#shortcut-hint"]);
  });

  it("lands a question about importing on the usage section, whose import line is code", () => {
    expect(hrefs("how do I import a dialog", 1)).toEqual(["/components/dialog#usage"]);
  });

  it("lands a chart, a curve and its variant on that demo", () => {
    expect(hrefs("line chart step before", 1)).toEqual(["/components/line-chart#step-before"]);
  });

  // ColorSchemeScript is documented in the colour-scheme section. The TanStack and Vite sections both
  // call colorSchemeScriptSource, and the TanStack one comes first and shows the call in its code.
  it.each([
    { query: "ColorSchemeScript", href: "/handbook/theming#colour-scheme" },
    { query: "colorSchemeScriptSource", href: "/handbook/theming#tanstack-start" },
  ])("lands the export $query on the section that documents it", ({ query, href }) => {
    expect(hrefs(query, 1)).toEqual([href]);
  });

  it.each([
    { query: "kanban board drag and drop", lacks: ["kanban", "board"] },
    { query: "rich text editor", lacks: ["rich", "editor"] },
  ])("names the words that $query's best hit lacks", ({ query, lacks }) => {
    expect(search(index, query, 1)[0]?.missing).toEqual(lacks);
  });

  it.each(["button pending", "Chart.Line", "date picker", "set up", "how do I import a dialog"])(
    "marks no word missing from the best hit for %s",
    (query) => {
      expect(search(index, query, 1)[0]?.missing).toEqual([]);
    }
  );

  it("answers applying a brand theme with the section on setting the document theme", () => {
    expect(hrefs("how do I apply a brand theme", 1)).toEqual(["/handbook/theming#document-theme"]);
  });
});
