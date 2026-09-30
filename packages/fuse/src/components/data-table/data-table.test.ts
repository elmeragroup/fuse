/**
 * Unit project (node). Pure DataTable logic: page status, skeleton sizing, locale formatting with
 * the raw-text fallback, the dictionary rows and the recipe. Expected strings are written out by
 * hand from each locale's conventions: nb-NO, sv-SE and fi-FI group with U+00A0 and use a decimal
 * comma; en-US groups with a comma.
 */
import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { cellValueText, formatCurrencyCell, formatDateCell, formatNumberCell } from "./data-table-format";
import { pageStatus, skeletonRowCount } from "./data-table-pagination-status";
import { dataTableVariants } from "./data-table-variants";
import { dataTableStrings } from "./intl";

const NBSP = " ";

describe("pageStatus", () => {
  it("allows next and last inside a known total and neither on its last page", () => {
    expect(pageStatus(0, { kind: "known", pageCount: 3 })).toEqual({
      kind: "known",
      page: 1,
      pageCount: 3,
      canPrevious: false,
      canNext: true,
    });
    expect(pageStatus(1, { kind: "known", pageCount: 3 })).toEqual({
      kind: "known",
      page: 2,
      pageCount: 3,
      canPrevious: true,
      canNext: true,
    });
    expect(pageStatus(2, { kind: "known", pageCount: 3 })).toEqual({
      kind: "known",
      page: 3,
      pageCount: 3,
      canPrevious: true,
      canNext: false,
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "reads a known page count of %s as one empty page, never 'of 0'",
    (pageCount) => {
      expect(pageStatus(0, { kind: "known", pageCount })).toEqual({
        kind: "known",
        page: 1,
        pageCount: 1,
        canPrevious: false,
        canNext: false,
      });
    }
  );

  it("takes Next for an unknown total from hasMore alone, and never reports a page count", () => {
    expect(pageStatus(4, { kind: "unknown", hasMore: true })).toEqual({
      kind: "unknown",
      page: 5,
      canPrevious: true,
      canNext: true,
    });
    expect(pageStatus(0, { kind: "unknown", hasMore: false })).toEqual({
      kind: "unknown",
      page: 1,
      canPrevious: false,
      canNext: false,
    });
  });
});

describe("skeletonRowCount", () => {
  it.each([
    [undefined, 5],
    [3, 3],
    [10, 10],
    [100, 10],
    [Number.POSITIVE_INFINITY, 10],
    [0, 1],
  ])("shows page size %s as %i skeleton rows", (pageSize, rows) => {
    expect(skeletonRowCount(pageSize)).toBe(rows);
  });
});

describe("cell formatting", () => {
  const placed = new Date(Date.UTC(2026, 8, 30, 14, 5));

  it.each([
    ["nb-NO", `1${NBSP}234,5`],
    ["sv-SE", `1${NBSP}234,5`],
    ["fi-FI", `1${NBSP}234,5`],
    ["en-US", "1,234.5"],
  ] as const)("groups and separates decimals for %s", (locale, text) => {
    expect(formatNumberCell(locale, 1234.5, {})).toBe(text);
  });

  it("passes digit options through", () => {
    expect(formatNumberCell("en-US", 1234.5, { maximumFractionDigits: 0 })).toBe("1,235");
  });

  it("formats an amount in the given currency", () => {
    expect(formatCurrencyCell("nb-NO", 1234.5, "NOK", {})).toBe(`1${NBSP}234,50${NBSP}kr`);
    expect(formatCurrencyCell("en-US", 1234.5, "USD", {})).toBe("$1,234.50");
  });

  it("formats dates and date-times in the locale's order", () => {
    expect(formatDateCell("nb-NO", placed, { dateStyle: "short", timeZone: "UTC" })).toBe("30.09.2026");
    expect(formatDateCell("en-US", placed, { dateStyle: "short", timeZone: "UTC" })).toBe("9/30/26");
    expect(formatDateCell("sv-SE", placed, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })).toBe(
      "2026-09-30 14:05"
    );
  });

  it("renders an invalid date as its raw text instead of throwing", () => {
    expect(formatDateCell("en-US", new Date(Number.NaN), { dateStyle: "short" })).toBe("Invalid Date");
  });

  it("gives a parsed value of any kind its raw text", () => {
    expect(cellValueText({ kind: "text", value: "Ada" })).toBe("Ada");
    expect(cellValueText({ kind: "number", value: 4711 })).toBe("4711");
    expect(cellValueText({ kind: "date", value: new Date(Number.NaN) })).toBe("Invalid Date");
  });
});

describe("dataTable dictionary", () => {
  const PAGE_OF = {
    "nb-NO": "Side 2 av 5",
    "sv-SE": "Sida 2 av 5",
    "en-US": "Page 2 of 5",
    "fi-FI": "Sivu 2/5",
  } as const;

  const ACTIONS = {
    "nb-NO": ["Handlinger", "Handlinger for Kontorstol"],
    "sv-SE": ["Åtgärder", "Åtgärder för Kontorstol"],
    "en-US": ["Actions", "Actions for Kontorstol"],
    "fi-FI": ["Toiminnot", "Toiminnot: Kontorstol"],
  } as const;

  it("owns the same rows in all four locales and interpolates the page status and the row name", () => {
    for (const locale of ["nb-NO", "sv-SE", "en-US", "fi-FI"] as const) {
      expect(Object.keys(dataTableStrings.getStringsForLocale(locale)).toSorted(), locale).toEqual([
        "actions",
        "actionsFor",
        "columns",
        "goToFirstPage",
        "goToLastPage",
        "goToNextPage",
        "goToPreviousPage",
        "noResults",
        "page",
        "pageOf",
        "rowsPerPage",
        "selectAllOnPage",
      ]);
      const formatter = new LocalizedStringFormatter(locale, dataTableStrings);
      expect(formatter.format("pageOf", { page: 2, pageCount: 5 }), locale).toBe(PAGE_OF[locale]);
      expect(
        [formatter.format("actions"), formatter.format("actionsFor", { name: "Kontorstol" })],
        locale
      ).toEqual(ACTIONS[locale]);
    }
  });
});

describe("dataTableVariants", () => {
  it("adds the pointer cursor only to a pressable row", () => {
    expect(dataTableVariants({ pressable: true }).row()).toBe("cursor-pointer");
    expect(dataTableVariants().row()).toBeUndefined();
  });
});
