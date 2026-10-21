/**
 * How the spec builder records a class whose variant the matrix does not model. The unit under
 * test is `buildComponentSet`, with a one-cell definition and Tailwind's compiled utilities.
 * The oracle is the definition: a variant it omits is dropped, and any other variant no cell
 * models is unmapped, which the coverage gate refuses. That includes `focus-visible`, since the
 * definition's state axis has no focus value.
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
  classesFor: () => "in-data-[slot=group]:bg-muted data-pressed:bg-muted focus-visible:bg-muted",
  states: {},
  facts: new Map(),
  omittedStates: new Set(["in-data-[slot=group]"]),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

let context: BuildContext;

beforeAll(async () => {
  context = {
    compiled: await compileUtilities(["bg-muted"]),
    variables: makeVariableIndex([]),
    page: [],
    base: [],
  };
});

function outcomes(className: string): ReadonlySet<string> {
  const { coverage } = buildComponentSet(CHIP, context);
  return new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));
}

describe("a class whose variant no cell models", () => {
  it("is dropped when the definition omits the state", () => {
    expect(outcomes("in-data-[slot=group]:bg-muted")).toEqual(new Set(["dropped"]));
  });

  it("is unmapped when the definition does not know the state", () => {
    expect(outcomes("data-pressed:bg-muted")).toEqual(new Set(["unmapped"]));
  });

  it("is unmapped when the state axis lacks the value that renders a shared state", () => {
    expect(outcomes("focus-visible:bg-muted")).toEqual(new Set(["unmapped"]));
  });
});

// Unit under test: `buildComponentSet` on a root whose class sets a border width and style and
// nothing sets a color. Oracle: the coverage contract, under which a declaration that does not
// reach Figma lands as unmapped. The stroke cannot draw without a color, so the missing color
// must fail the gate rather than vanish.
describe("a border with no color", () => {
  it("records the missing color as unmapped, under the class that drew the border", async () => {
    const bordered: ComponentDefinition = { ...CHIP, classesFor: () => "border" };
    const { componentSet, coverage } = buildComponentSet(bordered, {
      ...context,
      compiled: await compileUtilities(["border"]),
    });
    expect(componentSet.variants[0]?.root.stroke).toBeUndefined();
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "border", property: "border-color", outcome: "unmapped" })
    );
  });
});

// Unit under test: `buildComponentSet`, which applies the base-layer declarations of its context
// to the root below every recipe class. Oracle: fuse.css's base rule
// `border-color: var(--border, currentcolor)`, and CSS cascade layers, under which any utility
// beats a base-layer declaration.
describe("the base-layer border color", () => {
  const variables = makeVariableIndex(
    ["border", "error"].map((name) => ({
      ref: { collection: "Fuse tokens", name },
      webSyntax: `var(--${name})`,
    }))
  );
  const base = [
    { className: "fuse.css base layer", property: "border-color", value: "var(--border, currentcolor)" },
  ];

  async function build(classes: string) {
    return buildComponentSet(
      { ...CHIP, classesFor: () => classes },
      {
        ...context,
        compiled: await compileUtilities(classes.split(" ")),
        variables,
        base,
      }
    );
  }

  it("colors a border no class colors with the border role", async () => {
    const { componentSet, coverage } = await build("border");
    expect(componentSet.variants[0]?.root.stroke).toEqual({
      color: { kind: "variable", variable: { collection: "Fuse tokens", name: "border" } },
      weight: { kind: "literal", value: 1 },
    });
    expect(coverage).toContainEqual(
      expect.objectContaining({
        className: "fuse.css base layer",
        property: "border-color",
        outcome: "bound",
      })
    );
  });

  it("loses to a class that colors the border", async () => {
    const strokeOf = async (classes: string) => (await build(classes)).componentSet.variants[0]?.root.stroke;
    expect((await strokeOf("border border-transparent"))?.color).toEqual({
      kind: "literal",
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
    expect((await strokeOf("border border-error"))?.color).toEqual({
      kind: "variable",
      variable: { collection: "Fuse tokens", name: "error" },
    });
  });
});

// Unit under test: `buildComponentSet` on a root with a transparent background and a ring.
// Oracle: CSS, where `background-color: transparent` paints nothing, as an unset background
// does, so the root gets no fill.
describe("a transparent background", () => {
  const RING: ComponentDefinition = { ...CHIP, classesFor: () => "bg-transparent ring-2 ring-[rgb(0_0_0)]" };

  it("gives the root no fill, whatever shadow it casts", async () => {
    const ringContext = {
      ...context,
      compiled: await compileUtilities(["bg-transparent", "ring-2", "ring-[rgb(0_0_0)]"]),
    };
    const { componentSet, coverage } = buildComponentSet(RING, ringContext);
    const [variant] = componentSet.variants;
    expect(variant?.root.shadows).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
        offsetX: 0,
        offsetY: 0,
        radius: { kind: "literal", value: 0 },
        spread: { kind: "literal", value: 2 },
      },
    ]);
    expect(variant?.root.fill).toBeUndefined();
    expect(coverage.filter((row) => row.className === "bg-transparent").map((row) => row.outcome)).toEqual([
      "literal",
    ]);
  });
});
