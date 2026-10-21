/**
 * Unit project. Where each field's counts and range come from, against handwritten facets and a
 * stub table whose faceting returns fixed values.
 */
import { describe, expect, it } from "vitest";

import type { FilterColumnSource, FilterTableSource } from "./data-table-filter-source";
import { createFacetReader } from "./filter-facets";
import type { AnyFilterFacets, FilterFieldMap } from "./filter-fields";

const FIELDS: FilterFieldMap = {
  status: { kind: "option", label: "Status", options: [{ value: "paid", label: "Paid" }] },
  amount: { kind: "number", label: "Amount", min: 0, max: 1000 },
  quantity: { kind: "number", label: "Quantity" },
};

/** TanStack's faceting for the stub: Status counts paid 5 and pending 1, Amount spans 20 to 640. */
const TANSTACK_STATUS = new Map<unknown, number>([
  ["paid", 5],
  ["pending", 1],
]);
const TANSTACK_AMOUNT: [number, number] = [20, 640];

/** Columns with TanStack faceting. */
const FACETED: readonly FilterColumnSource[] = [
  { id: "status", getFacetedUniqueValues: () => TANSTACK_STATUS },
  { id: "amount", getFacetedMinMaxValues: () => TANSTACK_AMOUNT },
  { id: "quantity" },
];

/** The same columns from a table built without faceting. */
const BARE: readonly FilterColumnSource[] = [{ id: "status" }, { id: "amount" }, { id: "quantity" }];

function table(
  manualFiltering: boolean,
  columns: readonly FilterColumnSource[] = FACETED
): FilterTableSource {
  return {
    getColumn: (columnId) => columns.find((column) => column.id === columnId),
    options: { manualFiltering },
    setColumnFilters: () => undefined,
    atoms: { columnFilters: { get: () => [], subscribe: () => ({ unsubscribe: () => undefined }) } },
  };
}

const SERVER: AnyFilterFacets = { status: { counts: { paid: 2 } }, amount: { range: [100, 300] } };

describe("createFacetReader counts", () => {
  it("takes the server's counts over TanStack's", () => {
    expect(createFacetReader(table(false), FIELDS, SERVER).counts("status")).toEqual(new Map([["paid", 2]]));
  });

  it("takes TanStack's counts without server counts, keyed by the value's string", () => {
    expect(createFacetReader(table(false), FIELDS, undefined).counts("status")).toEqual(
      new Map([
        ["paid", 5],
        ["pending", 1],
      ])
    );
  });

  it("knows no counts in server mode without server counts, nor without faceting", () => {
    expect(createFacetReader(table(true), FIELDS, undefined).counts("status")).toBeUndefined();
    expect(createFacetReader(table(false, BARE), FIELDS, undefined).counts("status")).toBeUndefined();
  });

  it("normalizes each source once, across readers", () => {
    const first = createFacetReader(table(false), FIELDS, SERVER).counts("status");
    const second = createFacetReader(table(false), FIELDS, SERVER).counts("status");
    expect(second).toBe(first);
    expect(createFacetReader(table(false), FIELDS, undefined).counts("status")).toBe(
      createFacetReader(table(false), FIELDS, undefined).counts("status")
    );
  });
});

describe("createFacetReader range", () => {
  it("takes the server's range over TanStack's and the config's", () => {
    expect(createFacetReader(table(false), FIELDS, SERVER).range("amount")).toEqual([100, 300]);
  });

  it("takes TanStack's range over the config's", () => {
    expect(createFacetReader(table(false), FIELDS, undefined).range("amount")).toEqual([20, 640]);
  });

  it("takes the config's range in server mode, and without faceting", () => {
    expect(createFacetReader(table(true), FIELDS, undefined).range("amount")).toEqual([0, 1000]);
    expect(createFacetReader(table(false, BARE), FIELDS, undefined).range("amount")).toEqual([0, 1000]);
  });

  it("knows no range for a number field without min and max and without facets", () => {
    expect(createFacetReader(table(true), FIELDS, undefined).range("quantity")).toBeUndefined();
  });
});
