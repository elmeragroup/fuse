/**
 * How the spec builder records a class whose variant the matrix does not model. The unit under
 * test is `buildComponentSet`, with a one-cell definition and Tailwind's compiled utilities.
 * The oracle is the definition: a variant it omits is dropped, and any other unknown variant
 * is unmapped, which the coverage gate refuses.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { buildComponentSet } from "./component-spec";
import type { BuildContext, ComponentDefinition } from "./component-spec";
import { makeVariableIndex } from "./css-values";
import { compileUtilities } from "./utility-css";

const CHIP: ComponentDefinition = {
  key: "chip",
  name: "Chip",
  slot: "chip",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  classesFor: () => "aria-invalid:bg-muted data-pressed:bg-muted",
  conditions: new Map(),
  omittedStates: new Set(["aria-invalid"]),
  childSelectors: new Map(),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

let context: BuildContext;

beforeAll(async () => {
  context = { compiled: await compileUtilities(["bg-muted"]), variables: makeVariableIndex([]), page: [] };
});

function outcomes(className: string): ReadonlySet<string> {
  const { coverage } = buildComponentSet(CHIP, context);
  return new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));
}

describe("a class whose variant no cell models", () => {
  it("is dropped when the definition omits the state", () => {
    expect(outcomes("aria-invalid:bg-muted")).toEqual(new Set(["dropped"]));
  });

  it("is unmapped when the definition does not know the state", () => {
    expect(outcomes("data-pressed:bg-muted")).toEqual(new Set(["unmapped"]));
  });
});
