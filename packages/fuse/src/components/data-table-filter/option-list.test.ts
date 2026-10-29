/**
 * Unit project. Select all's scope: the list's order taken as it opened, read against the field's
 * current options. Every expectation is a handwritten list of values.
 */
import { describe, expect, it } from "vitest";

import type { FilterOption } from "./filter-fields";
import { currentOrder, unpickedMatches } from "./option-list";
import type { OptionOrder } from "./option-list";

const option = (value: string, label = value): FilterOption => ({ value, label });

/** The order as a list opened: b picked, then c, a and d by count. */
const OPENED: OptionOrder = {
  pinned: [option("b", "Bravo")],
  rest: [option("c", "Charlie"), option("a", "Alpha"), option("d", "Delta")],
};

const values = (order: OptionOrder) => ({
  pinned: order.pinned.map((item) => item.value),
  rest: order.rest.map((item) => item.value),
});

/** The locale-free matcher the rows use: a case-insensitive "contains". */
const contains = (text: string, query: string): boolean => text.toLowerCase().includes(query.toLowerCase());

describe("currentOrder", () => {
  type Row = readonly [
    name: string,
    options: readonly FilterOption[],
    expected: { readonly pinned: readonly string[]; readonly rest: readonly string[] },
  ];
  const ROWS: readonly Row[] = [
    [
      "keeps the opened order when the options are the same",
      [option("a"), option("b"), option("c"), option("d")],
      { pinned: ["b"], rest: ["c", "a", "d"] },
    ],
    [
      "appends new options after the rest, in config order",
      [option("f"), option("a"), option("b"), option("c"), option("d"), option("e")],
      { pinned: ["b"], rest: ["c", "a", "d", "f", "e"] },
    ],
    [
      "drops options the field no longer offers, pinned ones too",
      [option("a"), option("d")],
      { pinned: [], rest: ["a", "d"] },
    ],
    [
      "keeps the survivors' places while new options join and old ones go",
      [option("e"), option("d"), option("b")],
      { pinned: ["b"], rest: ["d", "e"] },
    ],
  ];

  it.each(ROWS)("%s", (_name, options, expected) => {
    expect(values(currentOrder(OPENED, options))).toEqual(expected);
  });

  it("reads each survivor's current label", () => {
    const order = currentOrder(OPENED, [option("a", "Alpha"), option("c", "Cobalt")]);
    expect(order.rest.map((item) => item.label)).toEqual(["Cobalt", "Alpha"]);
  });
});

describe("Select all's scope", () => {
  const CURRENT = [option("a", "Alpha"), option("c", "Charlie"), option("e", "Echo"), option("x", "Xray")];

  it.each([
    [
      "no query: every unpicked current option, survivors first",
      "",
      Number.POSITIVE_INFINITY,
      ["c", "a", "e", "x"],
    ],
    ["a query that matches a survivor and a new option", "h", Number.POSITIVE_INFINITY, ["c", "a", "e"]],
    ["a query that only a new option matches", "ray", Number.POSITIVE_INFINITY, ["x"]],
    ["a query that only a removed option matched", "delta", Number.POSITIVE_INFINITY, []],
    ["the walk stops at the limit", "", 2, ["c", "a"]],
  ] as const)("adds %s", (_name, query, limit, expected) => {
    const scope = currentOrder(OPENED, CURRENT);
    const added = unpickedMatches(scope, query, contains, new Set(["b"]), limit);
    expect(added.map((item) => item.value)).toEqual(expected);
  });
});
