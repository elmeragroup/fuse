/**
 * Unit project. Every expectation below is a handwritten table, never a value recomputed through
 * the model under test.
 */
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { defineFilterFields } from "./filter-fields";
import type { FilterFieldMap } from "./filter-fields";
import { createDataTableFilterFn } from "./filter-fn";
import { matchesFilter } from "./filter-match";
import {
  addDays,
  allowedOperators,
  fieldAdmits,
  filterValuesEqual,
  isIsoDate,
  isToggleOn,
  OPERATORS,
  operatorChoices,
  setFilterOperator,
  setFilterValues,
  toFilterValue,
  toggleBoolean,
  toggleOption,
} from "./filter-model";
import type { DataTableFilterState, FilterKind, FilterOperator, FilterValue } from "./filter-model";
import { parseColumnFilters } from "./filter-parse";

describe("OPERATORS negations", () => {
  const NEGATIONS: ReadonlyArray<readonly [FilterKind, FilterOperator, FilterOperator]> = [
    ["option", "is", "isNot"],
    ["option", "isNot", "is"],
    ["option", "isAnyOf", "isNoneOf"],
    ["option", "isNoneOf", "isAnyOf"],
    ["multiOption", "includes", "excludes"],
    ["multiOption", "excludes", "includes"],
    ["multiOption", "includesAnyOf", "excludesAnyOf"],
    ["multiOption", "includesAllOf", "excludesAllOf"],
    ["multiOption", "excludesAnyOf", "includesAnyOf"],
    ["multiOption", "excludesAllOf", "includesAllOf"],
    ["text", "contains", "doesNotContain"],
    ["text", "doesNotContain", "contains"],
    ["text", "startsWith", "doesNotStartWith"],
    ["text", "doesNotStartWith", "startsWith"],
    ["number", "is", "isNot"],
    ["number", "isNot", "is"],
    ["number", "isGreaterThan", "isLessThanOrEqual"],
    ["number", "isGreaterThanOrEqual", "isLessThan"],
    ["number", "isLessThan", "isGreaterThanOrEqual"],
    ["number", "isLessThanOrEqual", "isGreaterThan"],
    ["number", "isBetween", "isNotBetween"],
    ["number", "isNotBetween", "isBetween"],
    ["date", "is", "isNot"],
    ["date", "isNot", "is"],
    ["date", "isBefore", "isOnOrAfter"],
    ["date", "isOnOrAfter", "isBefore"],
    ["date", "isAfter", "isOnOrBefore"],
    ["date", "isOnOrBefore", "isAfter"],
    ["date", "isBetween", "isNotBetween"],
    ["date", "isNotBetween", "isBetween"],
    ["boolean", "is", "isNot"],
    ["boolean", "isNot", "is"],
  ];

  it("negates every operator as the handwritten pair table says, and lists no other operator", () => {
    const rows = (kind: FilterKind, table: Readonly<Record<string, { readonly negation: string }>>) =>
      Object.entries(table).map(([operator, spec]) => [kind, operator, spec.negation]);
    const actual = [
      ...rows("option", OPERATORS.option),
      ...rows("multiOption", OPERATORS.multiOption),
      ...rows("text", OPERATORS.text),
      ...rows("number", OPERATORS.number),
      ...rows("date", OPERATORS.date),
      ...rows("boolean", OPERATORS.boolean),
    ];
    expect(actual).toEqual(NEGATIONS);
  });
});

describe("operatorChoices", () => {
  it("offers option kinds only the operators of the current value count", () => {
    const one: FilterValue = { kind: "option", operator: "is", values: ["paid"] };
    const two: FilterValue = { kind: "option", operator: "isAnyOf", values: ["paid", "pending"] };
    expect(operatorChoices({ kind: "option" }, one)).toEqual(["is", "isNot"]);
    expect(operatorChoices({ kind: "option" }, two)).toEqual(["isAnyOf", "isNoneOf"]);
  });

  it("offers number fields every operator, in the field's own order when it sets one", () => {
    const value: FilterValue = { kind: "number", operator: "is", values: [3] };
    expect(operatorChoices({ kind: "number", operators: ["isBetween", "is"] }, value)).toEqual([
      "isBetween",
      "is",
    ]);
  });
});

describe("allowedOperators", () => {
  it.each([
    ["option without a list", { kind: "option" }, ["is", "isNot", "isAnyOf", "isNoneOf"]],
    ["option single-select", { kind: "option", operators: ["is", "isNot"] }, ["is", "isNot"]],
    ["option with only isAnyOf", { kind: "option", operators: ["isAnyOf"] }, ["isAnyOf", "is"]],
    [
      "multi-option with only includesAllOf",
      { kind: "multiOption", operators: ["includesAllOf"] },
      ["includesAllOf", "includes"],
    ],
    ["number without isBetween", { kind: "number", operators: ["isGreaterThan"] }, ["isGreaterThan"]],
    ["text without a list", { kind: "text" }, ["contains", "doesNotContain"]],
    ["text listing startsWith", { kind: "text", operators: ["startsWith"] }, ["startsWith"]],
  ] as const)("%s allows %j", (_name, field, expected) => {
    expect(allowedOperators(field)).toEqual(expected);
  });

  it("admits an opt-in text operator only from a field that lists it", () => {
    const filters = [{ id: "customer", value: { kind: "text", operator: "startsWith", values: ["caf"] } }];
    expect(parseColumnFilters(filters, { customer: { kind: "text", label: "Customer" } })).toEqual([]);
    expect(
      parseColumnFilters(filters, {
        customer: { kind: "text", label: "Customer", operators: ["contains", "startsWith"] },
      })
    ).toEqual([{ id: "customer", value: { kind: "text", operator: "startsWith", values: ["caf"] } }]);
  });
});

describe("toFilterValue", () => {
  it.each([
    ["text", "isAnyOf", ["a"]],
    ["number", "isBetween", [1]],
    ["number", "isBetween", [5, 1]],
    ["number", "is", [Number.NaN]],
    ["option", "isAnyOf", ["a"]],
    ["option", "isAnyOf", ["a", "a"]],
    ["option", "is", [1]],
    ["text", "contains", ["  "]],
    ["date", "is", ["2026-02-30"]],
    ["date", "isBetween", ["2026-10-12", "2026-10-02"]],
  ] as const)("rejects %s %s %j", (kind, operator, values) => {
    expect(toFilterValue(kind, operator, values)).toBeNull();
  });

  it("builds a value whose operator, kind and values fit", () => {
    expect(toFilterValue("date", "isBetween", ["2026-10-02", "2026-10-12"])).toEqual({
      kind: "date",
      operator: "isBetween",
      values: ["2026-10-02", "2026-10-12"],
    });
  });
});

describe("boolean fields", () => {
  const PLAIN = { kind: "boolean" } as const;
  const TOGGLE = { kind: "boolean", toggle: true } as const;
  const RUSH_TRUE = { kind: "boolean", operator: "is", values: [true] } as const;
  const RUSH_FALSE = { kind: "boolean", operator: "is", values: [false] } as const;
  const NOT_TRUE = { kind: "boolean", operator: "isNot", values: [true] } as const;
  const PAID = { kind: "option", operator: "is", values: ["paid"] } as const;

  it("builds a value from one real boolean only", () => {
    expect(toFilterValue("boolean", "is", [true])).toEqual(RUSH_TRUE);
    expect(toFilterValue("boolean", "is", ["true"])).toBeNull();
    expect(toFilterValue("boolean", "is", [1])).toBeNull();
    expect(toFilterValue("boolean", "is", [true, false])).toBeNull();
    expect(toFilterValue("boolean", "is", [])).toBeNull();
  });

  it("allows is by default, isNot when listed, and only is on a toggle", () => {
    expect(allowedOperators(PLAIN)).toEqual(["is"]);
    expect(allowedOperators({ kind: "boolean", operators: ["is", "isNot"] })).toEqual(["is", "isNot"]);
    expect(allowedOperators({ kind: "boolean", toggle: true, operators: ["isNot", "is"] })).toEqual(["is"]);
  });

  it.each([
    ["is true", RUSH_TRUE, true],
    ["is false", RUSH_FALSE, false],
    ["isNot true", NOT_TRUE, false],
  ] as const)("lets a toggle admit %s: %s, and reads it on the same way", (_name, value, expected) => {
    expect(fieldAdmits(TOGGLE, value)).toBe(expected);
    expect(isToggleOn(TOGGLE, value)).toBe(expected);
  });

  it("reads a plain boolean field, or no filter, as no toggle that is on", () => {
    expect(isToggleOn(PLAIN, RUSH_TRUE)).toBe(false);
    expect(isToggleOn(TOGGLE, undefined)).toBe(false);
  });

  it.each([
    ["a plain field with no filter picks true", PLAIN, [], true, [{ id: "rush", value: RUSH_TRUE }]],
    ["a plain field picks its applied true again", PLAIN, [{ id: "rush", value: RUSH_TRUE }], true, []],
    [
      "a plain field picks false over true in the same place",
      PLAIN,
      [
        { id: "rush", value: RUSH_TRUE },
        { id: "status", value: PAID },
      ],
      false,
      [
        { id: "rush", value: RUSH_FALSE },
        { id: "status", value: PAID },
      ],
    ],
    ["a toggle with no filter turns on", TOGGLE, [], true, [{ id: "rush", value: RUSH_TRUE }]],
    ["a toggle that is on turns off", TOGGLE, [{ id: "rush", value: RUSH_TRUE }], true, []],
    [
      "a stale is false turns on",
      TOGGLE,
      [{ id: "rush", value: RUSH_FALSE }],
      true,
      [{ id: "rush", value: RUSH_TRUE }],
    ],
    [
      "a stale isNot true turns on",
      TOGGLE,
      [{ id: "rush", value: NOT_TRUE }],
      true,
      [{ id: "rush", value: RUSH_TRUE }],
    ],
    ["a toggle ignores a pick of false", TOGGLE, [], false, []],
  ] as const)("toggles where %s", (_name, field, state, picked, expected) => {
    expect(toggleBoolean(state, "rush", field, picked, "is")).toEqual(expected);
  });

  it.each([
    [true, RUSH_TRUE, true],
    [false, RUSH_TRUE, false],
    [false, RUSH_FALSE, true],
    [null, RUSH_FALSE, false],
    [null, NOT_TRUE, true],
    ["true", RUSH_TRUE, false],
    [1, RUSH_TRUE, false],
  ] as const)("matches the cell %j against %j: %s", (cell, value, expected) => {
    expect(matchesFilter(value, cell)).toBe(expected);
  });
});

describe("dates", () => {
  it.each([
    ["2026-10-20", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
  ] as const)("reads %s as an ISO date: %s", (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("filterValuesEqual", () => {
  const ANY_PAID_PENDING: FilterValue = { kind: "option", operator: "isAnyOf", values: ["paid", "pending"] };

  it("equates a deep copy and nothing with nothing", () => {
    expect(filterValuesEqual(ANY_PAID_PENDING, structuredClone(ANY_PAID_PENDING))).toBe(true);
    expect(filterValuesEqual(undefined, undefined)).toBe(true);
  });

  it("tells apart a different operator, kind, value or count, and a filter from none", () => {
    expect(filterValuesEqual(ANY_PAID_PENDING, { ...ANY_PAID_PENDING, operator: "isNoneOf" })).toBe(false);
    expect(
      filterValuesEqual(ANY_PAID_PENDING, {
        kind: "multiOption",
        operator: "includesAnyOf",
        values: ["paid", "pending"],
      })
    ).toBe(false);
    expect(filterValuesEqual(ANY_PAID_PENDING, { ...ANY_PAID_PENDING, values: ["paid", "overdue"] })).toBe(
      false
    );
    expect(
      filterValuesEqual(ANY_PAID_PENDING, { ...ANY_PAID_PENDING, values: ["paid", "pending", "draft"] })
    ).toBe(false);
    expect(filterValuesEqual(ANY_PAID_PENDING, undefined)).toBe(false);
  });

  it("counts order, for a range's ends and an option list alike", () => {
    expect(
      filterValuesEqual(
        { kind: "number", operator: "isBetween", values: [120, 950] },
        { kind: "number", operator: "isBetween", values: [950, 120] }
      )
    ).toBe(false);
    expect(filterValuesEqual(ANY_PAID_PENDING, { ...ANY_PAID_PENDING, values: ["pending", "paid"] })).toBe(
      false
    );
  });
});

describe("reducers", () => {
  const STATUS = {
    kind: "option",
    options: [{ value: "paid" }, { value: "pending" }, { value: "draft" }],
  } as const;
  const TAGS = { kind: "multiOption", options: [{ value: "a" }, { value: "b" }, { value: "c" }] } as const;
  const NUMBER = { kind: "number" } as const;
  const TEXT = { kind: "text" } as const;

  it("follows the option trace: one tick, two, untick to one, untick to none", () => {
    let state: DataTableFilterState = [];
    state = toggleOption(state, "status", STATUS, "paid", "is");
    expect(state).toEqual([{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }]);
    state = toggleOption(state, "status", STATUS, "pending", "is");
    expect(state).toEqual([
      { id: "status", value: { kind: "option", operator: "isAnyOf", values: ["paid", "pending"] } },
    ]);
    state = toggleOption(state, "status", STATUS, "paid", "is");
    expect(state).toEqual([{ id: "status", value: { kind: "option", operator: "is", values: ["pending"] } }]);
    state = toggleOption(state, "status", STATUS, "pending", "is");
    expect(state).toEqual([]);
  });

  it.each([
    ["is grows to isAnyOf", STATUS, "is", ["paid"], "pending", "isAnyOf", ["paid", "pending"]],
    ["isNot grows to isNoneOf", STATUS, "isNot", ["paid"], "pending", "isNoneOf", ["paid", "pending"]],
    ["isAnyOf shrinks to is", STATUS, "isAnyOf", ["paid", "pending"], "pending", "is", ["paid"]],
    ["isNoneOf shrinks to isNot", STATUS, "isNoneOf", ["paid", "pending"], "paid", "isNot", ["pending"]],
    [
      "isAnyOf stays at three",
      STATUS,
      "isAnyOf",
      ["paid", "pending"],
      "draft",
      "isAnyOf",
      ["paid", "pending", "draft"],
    ],
    ["includesAllOf stays at two", TAGS, "includesAllOf", ["a", "b", "c"], "c", "includesAllOf", ["a", "b"]],
    ["includesAllOf shrinks to includes", TAGS, "includesAllOf", ["a", "b"], "b", "includes", ["a"]],
    ["excludes grows to excludesAnyOf", TAGS, "excludes", ["a"], "b", "excludesAnyOf", ["a", "b"]],
    ["excludesAllOf shrinks to excludes", TAGS, "excludesAllOf", ["a", "b"], "a", "excludes", ["b"]],
  ] as const)("toggles where %s", (_name, field, from, values, toggled, operator, expected) => {
    const kind = field.kind;
    // SAFETY: each row pairs a kind with one of its operators and a value count that operator takes.
    const state: DataTableFilterState = [{ id: "x", value: { kind, operator: from, values } as FilterValue }];
    expect(toggleOption(state, "x", field, toggled, from)).toEqual([
      { id: "x", value: { kind, operator, values: expected } },
    ]);
  });

  it.each([
    ["an offered value", { kind: "option", operator: "is", values: ["paid"] }, true],
    ["a value the field does not offer", { kind: "option", operator: "is", values: ["void"] }, false],
    [
      "one unknown value among offered ones",
      { kind: "option", operator: "isAnyOf", values: ["paid", "void"] },
      false,
    ],
    ["a value of another kind", { kind: "text", operator: "contains", values: ["paid"] }, false],
  ] as const)("admits %s or not", (_name, value, expected) => {
    // SAFETY: each row is a well-formed value of its kind, written out by hand.
    expect(fieldAdmits(STATUS, value as FilterValue)).toBe(expected);
  });

  describe("an edit of a filter the config no longer admits", () => {
    const NO_PAID = {
      kind: "option",
      label: "Status",
      options: [
        { value: "pending", label: "Pending" },
        { value: "draft", label: "Draft" },
      ],
    } as const;
    const SINGLE = {
      kind: "option",
      label: "Status",
      options: [
        { value: "paid", label: "Paid" },
        { value: "pending", label: "Pending" },
        { value: "draft", label: "Draft" },
      ],
      operators: ["is", "isNot"],
    } as const;
    const ABOVE = { kind: "number", label: "Amount", operators: ["isGreaterThan"] } as const;
    const status = (operator: string, values: readonly string[]): DataTableFilterState =>
      // SAFETY: each call below pairs an option operator with a value count it takes.
      [{ id: "x", value: { kind: "option", operator, values } as FilterValue }];

    type Row = readonly [
      name: string,
      field: typeof NO_PAID | typeof SINGLE | typeof ABOVE,
      run: () => DataTableFilterState,
      expected: DataTableFilterState,
    ];
    const ROWS: readonly Row[] = [
      [
        "a tick drops the unknown value and starts over at is",
        NO_PAID,
        () => toggleOption(status("is", ["paid"]), "x", NO_PAID, "pending", "is"),
        status("is", ["pending"]),
      ],
      [
        "a tick keeps the known values beside the new one",
        NO_PAID,
        () => toggleOption(status("isAnyOf", ["paid", "pending"]), "x", NO_PAID, "draft", "is"),
        status("isAnyOf", ["pending", "draft"]),
      ],
      [
        "an untick of the last known value removes the filter",
        NO_PAID,
        () => toggleOption(status("isAnyOf", ["paid", "pending"]), "x", NO_PAID, "pending", "is"),
        [],
      ],
      [
        "a tick under an operator the field left out starts single-select at is",
        SINGLE,
        () => toggleOption(status("isAnyOf", ["paid", "pending"]), "x", SINGLE, "draft", "is"),
        status("is", ["draft"]),
      ],
      [
        "an untick from a stale multi-selection on a single-select field removes the filter",
        SINGLE,
        () => toggleOption(status("isAnyOf", ["paid", "pending", "draft"]), "x", SINGLE, "paid", "is"),
        [],
      ],
      [
        "an untick that leaves one value on a single-select field keeps it under is",
        SINGLE,
        () => toggleOption(status("isAnyOf", ["paid", "pending"]), "x", SINGLE, "paid", "is"),
        status("is", ["pending"]),
      ],
      [
        "an operator pick reconciles to the known values' count",
        NO_PAID,
        () => setFilterOperator(status("isAnyOf", ["paid", "pending"]), "x", NO_PAID, "isNoneOf"),
        status("isNot", ["pending"]),
      ],
      [
        "an operator pick with no known value left removes the filter",
        NO_PAID,
        () => setFilterOperator(status("is", ["paid"]), "x", NO_PAID, "isNot"),
        [],
      ],
      [
        "setValues under the stale operator moves to an allowed one",
        ABOVE,
        () =>
          setFilterValues(
            [{ id: "x", value: { kind: "number", operator: "isBetween", values: [100, 500] } }],
            "x",
            ABOVE,
            "isBetween",
            [200, 500]
          ),
        [{ id: "x", value: { kind: "number", operator: "isGreaterThan", values: [200] } }],
      ],
    ];

    it.each(ROWS)("%s, and the parse keeps it", (_name, field, run, expected) => {
      const next = run();
      expect(next).toEqual(expected);
      expect(parseColumnFilters(next, { x: field })).toEqual(expected);
    });
  });

  it("keeps a changed filter in its place and puts a new one last", () => {
    const state: DataTableFilterState = [
      { id: "status", value: { kind: "option", operator: "is", values: ["paid"] } },
      { id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } },
    ];
    expect(setFilterValues(state, "status", STATUS, "isNot", ["paid"]).map((entry) => entry.id)).toEqual([
      "status",
      "customer",
    ]);
    expect(setFilterValues(state, "amount", NUMBER, "is", [3]).map((entry) => entry.id)).toEqual([
      "status",
      "customer",
      "amount",
    ]);
  });

  it("converts a single number to a range up to the known maximum, and back to its first value", () => {
    const single: DataTableFilterState = [
      { id: "amount", value: { kind: "number", operator: "is", values: [43] } },
    ];
    const range = setFilterOperator(single, "amount", NUMBER, "isBetween", 100);
    expect(range).toEqual([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [43, 100] } },
    ]);
    expect(setFilterOperator(range, "amount", NUMBER, "isLessThan")).toEqual([
      { id: "amount", value: { kind: "number", operator: "isLessThan", values: [43] } },
    ]);
  });

  it("keeps the values when the operator flips to its negation", () => {
    const state: DataTableFilterState = [
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [10, 20] } },
    ];
    expect(setFilterOperator(state, "amount", NUMBER, "isNotBetween")).toEqual([
      { id: "amount", value: { kind: "number", operator: "isNotBetween", values: [10, 20] } },
    ]);
  });

  it("removes a filter whose values empty, and leaves the state as it was for an invalid set", () => {
    const state: DataTableFilterState = [
      { id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } },
    ];
    expect(setFilterValues(state, "customer", TEXT, "contains", [])).toEqual([]);
    expect(setFilterValues(state, "customer", TEXT, "isBetween", ["a", "b"])).toEqual(state);
  });
});

describe("matchesFilter", () => {
  const is: FilterValue = { kind: "option", operator: "is", values: ["paid"] };
  const isNot: FilterValue = { kind: "option", operator: "isNot", values: ["paid"] };

  it("compares option values exactly, and lets a missing cell pass only a negation", () => {
    expect(matchesFilter(is, "paid")).toBe(true);
    expect(matchesFilter(is, "Paid")).toBe(false);
    expect(matchesFilter(is, null)).toBe(false);
    expect(matchesFilter(isNot, null)).toBe(true);
  });

  it.each([
    [{ kind: "multiOption", operator: "includesAllOf", values: ["priority", "export"] }, true],
    [{ kind: "multiOption", operator: "includesAllOf", values: ["priority", "disputed"] }, false],
    [{ kind: "multiOption", operator: "excludesAnyOf", values: ["disputed", "manual"] }, true],
    [{ kind: "multiOption", operator: "excludesAllOf", values: ["priority", "disputed"] }, true],
    [{ kind: "multiOption", operator: "excludesAllOf", values: ["priority", "export"] }, false],
  ] as const)("reads %j on the row [priority, export] as %s", (value, expected) => {
    expect(matchesFilter(value, ["priority", "export"])).toBe(expected);
  });

  it.each([
    ["cafe", "Café Nord", true],
    ["bølg", "Bølgen Frisør", true],
    ["bolg", "Bølgen", false],
  ] as const)("finds %s in %s: %s", (needle, cell, expected) => {
    expect(matchesFilter({ kind: "text", operator: "contains", values: [needle] }, cell)).toBe(expected);
  });

  it.each([
    ["Café Nord", "startsWith", "cafe", true],
    ["Café Nord", "startsWith", "nord", false],
    ["Café Nord", "doesNotStartWith", "nord", true],
    [7070123, "startsWith", "707", true],
    [null, "doesNotStartWith", "x", true],
    [null, "startsWith", "x", false],
  ] as const)("matches %j %s %s: %s", (cell, operator, needle, expected) => {
    expect(matchesFilter({ kind: "text", operator, values: [needle] }, cell)).toBe(expected);
  });

  it("includes both ends of a number range", () => {
    const between: FilterValue = { kind: "number", operator: "isBetween", values: [100, 500] };
    expect(matchesFilter(between, 100)).toBe(true);
    expect(matchesFilter(between, 500)).toBe(true);
    expect(matchesFilter(between, 99.99)).toBe(false);
    expect(matchesFilter({ kind: "number", operator: "isNotBetween", values: [100, 500] }, 501)).toBe(true);
  });

  it("compares a Date cell as its calendar day in the given zone", () => {
    const cell = new Date("2026-10-19T23:30:00Z");
    expect(
      matchesFilter({ kind: "date", operator: "is", values: ["2026-10-20"] }, cell, {
        timeZone: "Europe/Oslo",
      })
    ).toBe(true);
    expect(
      matchesFilter({ kind: "date", operator: "is", values: ["2026-10-20"] }, cell, { timeZone: "UTC" })
    ).toBe(false);
    expect(
      matchesFilter({ kind: "date", operator: "isOnOrAfter", values: ["2026-10-20"] }, cell, {
        timeZone: "Europe/Oslo",
      })
    ).toBe(true);
    expect(
      matchesFilter({ kind: "date", operator: "isBefore", values: ["2026-10-20"] }, cell, {
        timeZone: "Europe/Oslo",
      })
    ).toBe(false);
  });
});

describe("parseColumnFilters", () => {
  type Row = { readonly status: "paid" | "pending"; readonly amount: number; readonly note: string };
  const FIELDS: FilterFieldMap = defineFilterFields<Row>()({
    status: {
      kind: "option",
      label: "Status",
      options: [
        { value: "paid", label: "Paid" },
        { value: "pending", label: "Pending" },
      ],
    },
    amount: { kind: "number", label: "Amount", operators: ["isBetween", "is"] },
    note: { kind: "text", label: "Note" },
  });
  const status = { id: "status", value: { kind: "option", operator: "is", values: ["paid"] } };

  it.each([
    ["an unknown id", { id: "ghost", value: { kind: "text", operator: "contains", values: ["x"] } }],
    [
      "a kind the field does not have",
      { id: "note", value: { kind: "option", operator: "is", values: ["x"] } },
    ],
    [
      "an operator foreign to the kind",
      { id: "note", value: { kind: "text", operator: "isBetween", values: ["x"] } },
    ],
    [
      "an operator the field leaves out",
      { id: "amount", value: { kind: "number", operator: "isLessThan", values: [1] } },
    ],
    ["a wrong arity", { id: "amount", value: { kind: "number", operator: "isBetween", values: [1] } }],
    [
      "an option value the field does not offer",
      { id: "status", value: { kind: "option", operator: "is", values: ["void"] } },
    ],
    ["an entry that is not an object", "status"],
  ])("drops %s", (_case, entry) => {
    expect(parseColumnFilters([entry, status], FIELDS)).toEqual([status]);
  });

  it("keeps the first entry of a duplicate id", () => {
    const second = { id: "status", value: { kind: "option", operator: "is", values: ["pending"] } };
    expect(parseColumnFilters([status, second], FIELDS)).toEqual([status]);
  });

  it("keeps an entry created in another realm, such as an iframe", () => {
    const foreign: unknown = runInNewContext(
      '[{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }]'
    );
    expect(parseColumnFilters(foreign, FIELDS)).toEqual([status]);
  });

  it("gives no filters for input that is not an array", () => {
    expect(parseColumnFilters({ status: "paid" }, FIELDS)).toEqual([]);
    expect(parseColumnFilters(null, FIELDS)).toEqual([]);
  });
});

describe("createDataTableFilterFn", () => {
  const filterFn = createDataTableFilterFn({ timeZone: "UTC" });

  it("drops a missing or emptied value and keeps a valid one", () => {
    expect(filterFn.autoRemove(undefined)).toBe(true);
    expect(filterFn.autoRemove({ kind: "option", operator: "is", values: [] })).toBe(true);
    expect(filterFn.autoRemove({ kind: "option", operator: "is", values: ["paid"] })).toBe(false);
  });

  it("reads the row's value in the filtered column", () => {
    const row = { getValue: (columnId: string) => (columnId === "status" ? "paid" : "other") };
    expect(filterFn(row, "status", { kind: "option", operator: "is", values: ["paid"] })).toBe(true);
    expect(filterFn(row, "kind", { kind: "option", operator: "is", values: ["paid"] })).toBe(false);
  });

  it("applies and keeps a value created in another realm, such as an iframe", () => {
    const foreign: unknown = runInNewContext('({ kind: "option", operator: "is", values: ["paid"] })');
    const row = { getValue: () => "pending" };
    expect(filterFn.autoRemove(foreign)).toBe(false);
    expect(filterFn(row, "status", foreign)).toBe(false);
  });
});
