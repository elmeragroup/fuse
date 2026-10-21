import type { ReactElement } from "react";

/**
 * Public type guarantees of `@elmeragroup/fuse/data-table-filter`. Each positive case has a
 * negative control: a field must fit its column's type, a value's operator fixes its kind and
 * arity, facets fit their field's kind, the Root rejects a table without column filtering, and the
 * overlays take no focus routing.
 */
import { columnFilteringFeature, rowPaginationFeature, tableFeatures, useTable } from "@tanstack/react-table";
import { expectTypeOf, test } from "vitest";

import { DataTableFilter, defineFilterFields } from "@elmeragroup/fuse/data-table-filter";
import type {
  DataTableFilterRootProps,
  DateEditorState,
  FilterFieldMap,
  FilterOperator,
  FilterValue,
} from "@elmeragroup/fuse/data-table-filter";

type Order = {
  readonly status: "paid" | "pending";
  readonly tags: readonly ("priority" | "export")[];
  readonly customer: string;
  readonly amount: number;
  readonly created: Date;
};

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
] as const;

const defineOrderFields = defineFilterFields<Order>();

const NO_ORDERS: Order[] = [];

test("a field must fit its column's type", () => {
  const fields = defineOrderFields({
    status: { kind: "option", label: "Status", options: STATUS_OPTIONS },
    tags: { kind: "multiOption", label: "Tags", options: [{ value: "priority", label: "Priority" }] },
    customer: { kind: "text", label: "Customer" },
    amount: { kind: "number", label: "Amount" },
    created: { kind: "date", label: "Created" },
    // An accessor function column's id is not a row key, so it takes any field.
    total: { kind: "number", label: "Total" },
  });
  expectTypeOf(fields.status.kind).toEqualTypeOf<"option">();

  defineOrderFields({
    // @ts-expect-error -- "unknown" is not a status the column can hold
    status: { kind: "option", label: "Status", options: [{ value: "unknown", label: "Unknown" }] },
  });
  defineOrderFields({
    // @ts-expect-error -- a number column cannot take a text field
    amount: { kind: "text", label: "Amount" },
  });
  defineOrderFields({
    // @ts-expect-error -- an array column takes a multi-option field, not an option field
    tags: { kind: "option", label: "Tags", options: [{ value: "priority", label: "Priority" }] },
  });
  defineOrderFields({
    // @ts-expect-error -- a text field takes text operators only
    customer: { kind: "text", label: "Customer", operators: ["isBetween"] },
  });
  defineOrderFields({ customer: { kind: "text", label: "Customer", operators: ["startsWith"] } });
});

test("an operator fixes its value's kind and arity", () => {
  expectTypeOf<FilterOperator<"text">>().toEqualTypeOf<
    "contains" | "doesNotContain" | "startsWith" | "doesNotStartWith"
  >();
  const range: FilterValue = { kind: "number", operator: "isBetween", values: [1, 2] };
  expectTypeOf(range.values).toEqualTypeOf<readonly [number, number]>();
  // @ts-expect-error -- isAnyOf is not a text operator
  const text: FilterValue = { kind: "text", operator: "isAnyOf", values: ["a"] };
  // @ts-expect-error -- a range holds exactly two values
  const short: FilterValue = { kind: "number", operator: "isBetween", values: [1] };
  // @ts-expect-error -- isAnyOf holds two or more values
  const single: FilterValue = { kind: "option", operator: "isAnyOf", values: ["a"] };
  expectTypeOf([text, short, single]).toBeArray();
});

test("facets fit each field's kind", () => {
  const fields = defineOrderFields({
    status: { kind: "option", label: "Status", options: STATUS_OPTIONS },
    amount: { kind: "number", label: "Amount" },
  });
  type Facets = NonNullable<DataTableFilterRootProps<typeof fields>["facets"]>;
  const facets: Facets = { status: { counts: { paid: 3 } }, amount: { range: [0, 10] } };
  expectTypeOf(facets).toEqualTypeOf<Facets>();
  // @ts-expect-error -- an option field takes counts, not a range
  const wrongStatus: Facets = { status: { range: [0, 1] } };
  // @ts-expect-error -- a number field takes a range, not counts
  const wrongAmount: Facets = { amount: { counts: {} } };
  expectTypeOf([wrongStatus, wrongAmount]).toBeArray();
});

test("a map typed as FilterFieldMap takes facets of any kind", () => {
  type Facets = NonNullable<DataTableFilterRootProps<FilterFieldMap>["facets"]>;
  const facets: Facets = { status: { counts: { paid: 3 } }, amount: { range: [0, 10] } };
  expectTypeOf(facets).toEqualTypeOf<Facets>();
  // @ts-expect-error -- a facet is counts or a range
  const wrong: Facets = { status: { total: 3 } };
  expectTypeOf(wrong).toEqualTypeOf<Facets>();
});

test("the Root takes a table with column filtering and rejects one without it", () => {
  const filtering = tableFeatures({ columnFilteringFeature });
  const pagingOnly = tableFeatures({ rowPaginationFeature });
  const fields = defineOrderFields({ customer: { kind: "text", label: "Customer" } });

  function WithFiltering(): ReactElement {
    const table = useTable({ features: filtering, columns: [], data: NO_ORDERS });
    return <DataTableFilter.Root table={table} fields={fields} />;
  }

  function WithoutFiltering(): ReactElement {
    const table = useTable({ features: pagingOnly, columns: [], data: NO_ORDERS });
    // @ts-expect-error -- the Root reads setColumnFilters and the columnFilters atom
    return <DataTableFilter.Root table={table} fields={fields} />;
  }

  expectTypeOf(WithFiltering).toBeFunction();
  expectTypeOf(WithoutFiltering).toBeFunction();
});

test("the date editor's function child receives a single or range target", () => {
  const editor = (
    <DataTableFilter.DateEditor>
      {(state) => {
        expectTypeOf(state).toEqualTypeOf<DateEditorState>();
        expectTypeOf(state.target).toEqualTypeOf<"single" | "range">();
        expectTypeOf(state.operator).toEqualTypeOf<FilterOperator<"date">>();
        return null;
      }}
    </DataTableFilter.DateEditor>
  );
  expectTypeOf(editor).toBeObject();
});

test("the overlays leave focus routing to the Root", () => {
  const overlays = (
    <>
      <DataTableFilter.Content className="w-72" />
      <DataTableFilter.ValueContent className="w-72" />
      {/* @ts-expect-error -- the Root decides where focus goes as the menu closes */}
      <DataTableFilter.Content finalFocus={false} />
      {/* @ts-expect-error -- the Root decides where focus goes as the popover closes */}
      <DataTableFilter.ValueContent finalFocus={false} />
      {/* @ts-expect-error -- the Root decides where focus goes as the popover opens */}
      <DataTableFilter.ValueContent initialFocus={false} />
    </>
  );
  expectTypeOf(overlays).toBeObject();
});
