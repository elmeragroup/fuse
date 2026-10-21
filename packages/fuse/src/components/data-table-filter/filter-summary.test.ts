/**
 * Unit project. Summaries, list order, the cap and the dictionary, against handwritten
 * expectations.
 */
import { describe, expect, it } from "vitest";

import type { OptionFilterField } from "./filter-fields";
import { OPERATORS } from "./filter-model";
import { summarize } from "./filter-summary";
import { enUS } from "./intl/en-US";
import { fiFI } from "./intl/fi-FI";
import { nbNO } from "./intl/nb-NO";
import { svSE } from "./intl/sv-SE";
import { matchOptions, OPTION_LIMIT, snapshotOrder } from "./option-list";

const STATUS: OptionFilterField = {
  kind: "option",
  label: "Status",
  options: [
    { value: "draft", label: "Draft" },
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Pending" },
    { value: "overdue", label: "Overdue" },
    { value: "cancelled", label: "Cancelled" },
  ],
};

const plain = { moreValues: (count: string) => `+${count}`, quoted: (text: string) => `“${text}”` };

describe("summarize", () => {
  it("lists up to two option labels, then a bare count of the rest", () => {
    expect(summarize({ kind: "option", operator: "is", values: ["paid"] }, STATUS, "en-US", plain)).toEqual({
      text: "Paid",
      full: "Paid",
    });
    expect(
      summarize(
        { kind: "option", operator: "isAnyOf", values: ["paid", "pending", "overdue"] },
        STATUS,
        "en-US",
        plain
      )
    ).toEqual({ text: "Paid, Pending +1", full: "Paid, Pending, Overdue" });
  });

  it("quotes text and formats number and date ranges in the locale", () => {
    expect(
      summarize({ kind: "text", operator: "contains", values: ["nord"] }, STATUS, "en-US", plain).text
    ).toBe("“nord”");
    const amount = {
      kind: "number",
      label: "Amount",
      format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
    } as const;
    expect(
      summarize({ kind: "number", operator: "isBetween", values: [100, 500] }, amount, "en-US", plain).text
    ).toBe("NOK\u00a0100–500");
    const created = { kind: "date", label: "Created" } as const;
    expect(
      summarize(
        { kind: "date", operator: "isBetween", values: ["2026-10-02", "2026-10-12"] },
        created,
        "en-US",
        plain
      ).text
    ).toBe("Oct 2\u2009–\u200912, 2026");
    expect(
      summarize({ kind: "date", operator: "is", values: ["2026-10-02"] }, created, "en-US", plain).text
    ).toBe("Oct 2, 2026");
  });

  it("formats the more count and the list in the locale", () => {
    const norwegian: OptionFilterField = {
      ...STATUS,
      options: [
        { value: "paid", label: "Betalt" },
        { value: "pending", label: "Venter" },
        { value: "overdue", label: "Forfalt" },
      ],
    };
    const quoted = { moreValues: (count: string) => `+${count}`, quoted: (text: string) => `«${text}»` };
    expect(
      summarize(
        { kind: "option", operator: "isAnyOf", values: ["paid", "pending", "overdue"] },
        norwegian,
        "nb-NO",
        quoted
      ).text
    ).toBe("Betalt, Venter +1");
  });
});

describe("snapshotOrder", () => {
  const counts = new Map([
    ["draft", 2],
    ["paid", 9],
    ["pending", 4],
    ["overdue", 4],
    ["cancelled", 0],
  ]);

  it("puts picked values first in config order, then the rest in config order", () => {
    const order = snapshotOrder(STATUS, ["pending", "draft"], counts);
    expect(order.pinned.map((option) => option.value)).toEqual(["draft", "pending"]);
    expect(order.rest.map((option) => option.value)).toEqual(["paid", "overdue", "cancelled"]);
  });

  it("orders the rest by count with config order between equal counts", () => {
    const order = snapshotOrder({ ...STATUS, order: "count" }, [], counts);
    expect(order.rest.map((option) => option.value)).toEqual([
      "paid",
      "pending",
      "overdue",
      "draft",
      "cancelled",
    ]);
  });
});

describe("matchOptions", () => {
  const contains = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());
  const order = snapshotOrder(STATUS, [], undefined);

  it("caps the rows and says more match", () => {
    const capped = matchOptions(order, "", contains, 3);
    expect(capped.rest.map((option) => option.value)).toEqual(["draft", "paid", "pending"]);
    expect(capped.more).toBe(true);
  });

  it("says nothing more when the matches fill the cap exactly", () => {
    const exact = matchOptions(order, "e", contains, 3);
    // Draft has no "e"; Pending, Overdue and Cancelled do.
    expect(exact.rest.map((option) => option.value)).toEqual(["pending", "overdue", "cancelled"]);
    expect(exact.more).toBe(false);
  });

  it("matches every option for an empty query, and caps lists at 50 rows", () => {
    expect(matchOptions(order, "  ", contains, 10).rest).toHaveLength(5);
    expect(OPTION_LIMIT).toBe(50);
  });
});

describe("dictionary", () => {
  // Cross-check: the operator table and the four dictionaries must agree on every row.
  const operatorRows = Object.entries(OPERATORS).flatMap(([kind, table]) =>
    Object.keys(table).map((operator) => `${kind}.${operator}`)
  );

  it.each([
    ["en-US", enUS],
    ["fi-FI", fiFI],
    ["nb-NO", nbNO],
    ["sv-SE", svSE],
  ] as const)("%s has a row for every operator", (_locale, rows) => {
    const missing = operatorRows.filter((key) => !Object.hasOwn(rows, key));
    expect(missing).toEqual([]);
  });

  it("names a value list's search in each locale", () => {
    expect(nbNO.searchValues({ field: "Status" })).toBe("Søk i Status");
    expect(svSE.quoted({ text: "nord" })).toBe("”nord”");
    expect(nbNO.quoted({ text: "nord" })).toBe("«nord»");
  });
});
