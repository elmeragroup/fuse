/**
 * The shared state table against the `chip` fixture of `test/fixture-sets.ts`. The unit under test
 * is `makeStateTable`. The oracle is what each variant means in the browser: fuse.css gates
 * `enabled-hover:` on hover of an enabled control, and `hover:` holds on hover with no gate, since
 * tailwindcss-react-aria-components compiles it to `:hover`, or to `[data-hovered]` on an element
 * marked `data-rac`. Tailwind's `focus-visible:` holds on keyboard focus, `disabled:` on a native disabled
 * control, `aria-disabled:` on a disabled Base UI span, which never matches `:disabled`,
 * `aria-invalid:` and `data-invalid:` on a control inside an invalid Field, `has-data-[icon=…]:`
 * while a descendant carries that `data-icon`, and each child selector picks the `<svg>` elements
 * its CSS selector matches. `[&>a]:` and `[&>a:hover]:` compile to `> a` and `> a:hover`, a link
 * child of the box, which no kit box holds. `sm:` and `md:` compile to `@media (width >= 40rem)` and
 * `(width >= 48rem)`, which a desktop window matches.
 */
import { describe, expect, it } from "vitest";

import { chip } from "../../test/fixture-sets";
import type { Cell, IconSlot } from "./component-spec";
import { INPUT } from "./input-kit";
import { makeStateTable, withInPlaceFacts } from "./state-table";

type Definition = Parameters<typeof makeStateTable>[0];

/** The chip as a native control with no axes, with the fields a test gives it. */
function definition(overrides: Partial<Definition>): Definition {
  return chip("", { rootKind: "native-control", axes: [], ...overrides });
}

/**
 * The values of one axis at which a variant holds, or how the table classes a variant that
 * holds in no cell of its own.
 */
function holdsAt(fixture: Definition, axis: string, variant: string): readonly string[] | string {
  const meaning = makeStateTable(fixture)(variant);
  if (meaning.kind !== "condition") {
    return meaning.kind;
  }
  const values = fixture.axes.find((candidate) => candidate.name === axis)?.values ?? [];
  return values.filter((value) => meaning.holds({ [axis]: value }));
}

const CONTROL_STATES = { name: "state", values: ["rest", "hover", "focus", "disabled"] };

describe("the shared state entries", () => {
  it.each([
    ["enabled-hover", ["hover"]],
    // A state axis holds one value per cell, so no cell is hovered and disabled at once, and the
    // ungated `hover:` holds exactly where `enabled-hover:` does.
    ["hover", ["hover"]],
    ["focus-visible", ["focus"]],
    ["disabled", ["disabled"]],
    ["data-disabled", ["disabled"]],
  ])("hold %s only at %j", (variant, states) => {
    expect(holdsAt(definition({ axes: [CONTROL_STATES] }), "state", variant)).toEqual(states);
  });

  it("leave a variant unmodelled when the state axis lacks its value", () => {
    const noFocus = definition({ axes: [{ name: "state", values: ["rest", "hover", "disabled"] }] });
    expect(holdsAt(noFocus, "state", "focus-visible")).toBe("unmodelled");
    expect(holdsAt(noFocus, "state", "enabled-hover")).toEqual(["hover"]);
  });

  it("omit a shared state's variants that a definition without the state omits", () => {
    // A row that renders a `<div>` takes no focus or hover, so its set has no state axis, and the
    // variants of the states it never shows land in its coverage as dropped.
    const still = definition({ axes: [], omittedStates: new Set(["focus-visible", "enabled-hover"]) });
    const table = makeStateTable(still);
    expect(table("focus-visible")).toEqual({ kind: "omitted" });
    expect(table("enabled-hover")).toEqual({ kind: "omitted" });
    expect(table("hover")).toEqual({ kind: "unmodelled" });
  });

  it.each(["enabled-hover", "hover", "focus-visible", "disabled", "data-disabled"])(
    "leave %s unmodelled without a state axis",
    (variant) => {
      expect(holdsAt(definition({ axes: [{ name: "size", values: ["sm", "lg"] }] }), "size", variant)).toBe(
        "unmodelled"
      );
    }
  );

  it("add the attributes a definition's own state renders", () => {
    // A pending Button stays focusable, so Base UI marks it aria-disabled and data-disabled.
    const pending = definition({
      axes: [{ name: "state", values: [...CONTROL_STATES.values, "pending"] }],
      states: { pending: ["data-disabled", "aria-disabled", "data-[pending-indicator]"] },
    });
    expect(holdsAt(pending, "state", "data-disabled")).toEqual(["disabled", "pending"]);
    expect(holdsAt(pending, "state", "aria-disabled")).toEqual(["pending"]);
    expect(holdsAt(pending, "state", "data-[pending-indicator]")).toEqual(["pending"]);
    expect(holdsAt(pending, "state", "disabled")).toEqual(["disabled"]);
  });

  it("hold aria-disabled and data-disabled at disabled on a Base UI span, which never matches disabled:", () => {
    // Base UI keeps a disabled span focusable-when-disabled: it stamps `aria-disabled="true"` and
    // `data-disabled`, and a span has no `:disabled` state.
    const span = definition({ rootKind: "base-ui-span", axes: [CONTROL_STATES] });
    expect(holdsAt(span, "state", "aria-disabled")).toEqual(["disabled"]);
    expect(holdsAt(span, "state", "data-disabled")).toEqual(["disabled"]);
    expect(holdsAt(span, "state", "disabled")).toBe("unmodelled");
  });

  it("hold only data-disabled at disabled on a Base UI Field part, which takes its Field's state", () => {
    // Base UI's `Field.Label` maps the Field's state to data attributes: a label in a disabled
    // Field renders `<label data-disabled="">`, with neither `disabled` nor `aria-disabled`.
    const label = definition({ rootKind: "base-ui-field-part", axes: [CONTROL_STATES] });
    expect(holdsAt(label, "state", "data-disabled")).toEqual(["disabled"]);
    expect(holdsAt(label, "state", "disabled")).toBe("unmodelled");
    expect(holdsAt(label, "state", "aria-disabled")).toBe("unmodelled");
  });

  it("hold only data-invalid at invalid on a Base UI Field part, which takes its Field's state", () => {
    // An error in an invalid Field renders `<div data-invalid="" role="alert">`, with no
    // `aria-invalid`, which Base UI stamps on the control alone.
    const error = definition({
      rootKind: "base-ui-field-part",
      axes: [{ name: "state", values: ["invalid"] }],
    });
    expect(holdsAt(error, "state", "data-invalid")).toEqual(["invalid"]);
    expect(holdsAt(error, "state", "aria-invalid")).toBe("omitted");
  });

  it("hold no attribute at disabled on a plain element, which shows its Field's state only through a group variant", () => {
    // Field's title is a `<div>` Base UI does not render, so a disabled Field stamps nothing on it,
    // and its `group-data-disabled/field:` reads the Field root around it.
    const title = definition({
      rootKind: "plain-element",
      axes: [CONTROL_STATES],
      states: { disabled: ["group-data-disabled/field"] },
    });
    expect(holdsAt(title, "state", "group-data-disabled/field")).toEqual(["disabled"]);
    for (const variant of ["disabled", "data-disabled", "aria-disabled"]) {
      expect(holdsAt(title, "state", variant), variant).toBe("unmodelled");
    }
  });

  it("hold the disabled and invalid attributes React Aria stamps, and invalid:, on a React Aria element", () => {
    // React Aria Components renders a disabled Calendar day cell with `aria-disabled="true"` and
    // `data-disabled="true"`, and an invalid one with `aria-invalid="true"` and `data-invalid="true"`.
    // tailwindcss-react-aria-components compiles `invalid:` to `[data-invalid]` on an element marked
    // `data-rac`, and an element is never natively `:disabled` there.
    const day = definition({
      rootKind: "react-aria-element",
      axes: [{ name: "state", values: [...CONTROL_STATES.values, "invalid"] }],
    });
    expect(holdsAt(day, "state", "aria-disabled")).toEqual(["disabled"]);
    expect(holdsAt(day, "state", "data-disabled")).toEqual(["disabled"]);
    expect(holdsAt(day, "state", "disabled")).toBe("unmodelled");
    for (const variant of ["aria-invalid", "data-invalid", "invalid"]) {
      expect(holdsAt(day, "state", variant), variant).toEqual(["invalid"]);
    }
  });

  it("leave aria-disabled to the definition on a native control", () => {
    expect(holdsAt(definition({ axes: [CONTROL_STATES] }), "state", "aria-disabled")).toBe("unmodelled");
  });

  it("refuse a disabled state on a definition that names no root kind", () => {
    const { rootKind: _, ...unnamed } = definition({ axes: [CONTROL_STATES] });
    expect(() => makeStateTable(unnamed)).toThrow("Chip has a disabled state and names no root kind");
  });

  it.each(["aria-invalid", "data-invalid"])(
    "hold %s exactly at state=invalid for a set whose state axis has that value",
    (variant) => {
      const invalidAxis = { name: "state", values: [...CONTROL_STATES.values, "invalid"] };
      expect(holdsAt(definition({ axes: [invalidAxis] }), "state", variant)).toEqual(["invalid"]);
    }
  );

  it("omit the states no standalone component shows, a link inside a box's text, and the definition's own omissions", () => {
    const grouped = definition({
      axes: [CONTROL_STATES],
      omittedStates: new Set(["in-data-[slot=button-group]"]),
    });
    const table = makeStateTable(grouped);
    for (const variant of [
      "enabled-active",
      "aria-invalid",
      "data-invalid",
      "aria-expanded",
      "[&>a]",
      "[&>a:hover]",
      "in-data-[slot=button-group]",
    ]) {
      expect(table(variant)).toEqual({ kind: "omitted" });
    }
    expect(table("data-pressed")).toEqual({ kind: "unmodelled" });
  });
});

/** Icons as the DOM holds them. The spinner's `<svg>` sits in a span that carries the data-icon. */
const slot = (key: string, direct: boolean, dataIcon: IconSlot["dataIcon"]): IconSlot => ({
  key,
  name: key,
  side: dataIcon === "inline-end" ? "end" : "start",
  direct,
  dataIcon,
  icon: "Plus",
  swapProperty: undefined,
});
const START = slot("start", true, "inline-start");
const END = slot("end", true, "inline-end");
const BARE = slot("bare", true, undefined);
const SPINNER = slot("spinner", false, "inline-start");

const ICONS = new Map([
  ["none", []],
  ["start", [START]],
  ["end", [END]],
  ["bare", [BARE]],
  ["spinner", [SPINNER, BARE]],
]);

describe("the icon edge", () => {
  const iconned = definition({
    axes: [{ name: "icon", values: [...ICONS.keys()] }],
    iconsFor: (cell: Cell) => ICONS.get(cell.icon ?? "") ?? [],
  });

  it("holds has-data-[icon=inline-start] wherever a slot carries that data-icon, nested or not", () => {
    expect(holdsAt(iconned, "icon", "has-data-[icon=inline-start]")).toEqual(["start", "spinner"]);
  });

  it("holds has-data-[icon=inline-end] only with an end icon", () => {
    expect(holdsAt(iconned, "icon", "has-data-[icon=inline-end]")).toEqual(["end"]);
  });
});

describe("the shared child selectors", () => {
  const table = makeStateTable(definition({}));
  const selected = (variant: string): readonly string[] | string => {
    const meaning = table(variant);
    return meaning.kind === "child"
      ? [START, END, BARE, SPINNER].filter((candidate) => meaning.selects(candidate)).map(({ key }) => key)
      : meaning.kind;
  };

  it("reach every icon with [&_svg], nested ones included", () => {
    expect(selected("[&_svg]")).toEqual(["start", "end", "bare", "spinner"]);
  });

  it("reach every kit icon with [&_svg:not([class*='size-'])], since none carries a size class", () => {
    expect(selected("[&_svg:not([class*='size-'])]")).toEqual(["start", "end", "bare", "spinner"]);
  });

  it("reach every direct icon with [&>svg], and not the spinner inside its span", () => {
    expect(selected("[&>svg]")).toEqual(["start", "end", "bare"]);
  });

  it("reach only a direct icon that is not an end icon with [&>svg:not([data-icon=inline-end])]", () => {
    expect(selected("[&>svg:not([data-icon=inline-end])]")).toEqual(["start", "bare"]);
  });
});

describe("the desktop breakpoints", () => {
  it.each(["sm", "md"])("hold %s in every cell, whatever its axes", (variant) => {
    const sized = definition({ axes: [CONTROL_STATES, { name: "size", values: ["sm", "lg"] }] });
    expect(holdsAt(sized, "state", variant)).toEqual(CONTROL_STATES.values);
    expect(holdsAt(sized, "size", variant)).toEqual(["sm", "lg"]);
  });

  it("leave the wider breakpoints and the ranges below a breakpoint unmodelled", () => {
    for (const variant of ["lg", "xl", "max-sm", "max-md"]) {
      expect(holdsAt(definition({ axes: [CONTROL_STATES] }), "state", variant)).toBe("unmodelled");
    }
  });
});

describe("a definition's own facts", () => {
  it("hold where the fact says", () => {
    const toggle = definition({
      axes: [{ name: "pressed", values: ["off", "on"] }],
      facts: new Map([["aria-pressed", (cell: Cell) => cell.pressed === "on"]]),
    });
    expect(holdsAt(toggle, "pressed", "aria-pressed")).toEqual(["on"]);
  });
});

describe("one meaning per variant", () => {
  const always = () => true;
  it.each([
    ["a fact for a shared state entry", { facts: new Map([["enabled-hover", always]]) }, "enabled-hover"],
    ["a fact for a child selector", { facts: new Map([["[&_svg]", always]]) }, "[&_svg]"],
    ["an omission of a desktop breakpoint", { omittedStates: new Set(["md"]) }, "md"],
    [
      "an omission of the icon edge",
      { omittedStates: new Set(["has-data-[icon=inline-start]"]) },
      "has-data-[icon=inline-start]",
    ],
    ["an omission of a shared state entry", { omittedStates: new Set(["focus-visible"]) }, "focus-visible"],
    ["a state that renders a shared omission", { states: { pending: ["aria-invalid"] } }, "aria-invalid"],
    ["a fact for a shared omission", { facts: new Map([["aria-invalid", always]]) }, "aria-invalid"],
    [
      "a fact for the invalid state's variant",
      {
        axes: [{ name: "state", values: [...CONTROL_STATES.values, "invalid"] }],
        facts: new Map([["data-invalid", always]]),
      },
      "data-invalid",
    ],
    [
      "both a fact and an omission",
      { facts: new Map([["aria-pressed", always]]), omittedStates: new Set(["aria-pressed"]) },
      "aria-pressed",
    ],
    [
      "both a fact and an omitted pseudo-element",
      { facts: new Map([["after", always]]), omittedPseudoElements: new Map([["after", "a hit area"]]) },
      "after",
    ],
    [
      "both an omitted state and an omitted composition",
      { omittedStates: new Set(["*"]), omittedCompositions: new Map([["*", "a label around a field"]]) },
      "*",
    ],
  ])("refuses %s", (_case, overrides: Partial<Definition>, variant) => {
    expect(() => makeStateTable(definition({ axes: [CONTROL_STATES], ...overrides }))).toThrow(
      `Chip gives \`${variant}\` a second meaning`
    );
  });
});

// Unit under test: `withInPlaceFacts`. Oracle: Base UI stamps `aria-expanded="true"` on the trigger
// of an open popup, so `aria-expanded:` holds on that instance alone, while every set omits it.
describe("the facts an instance part declares in place", () => {
  const states = definition({ axes: [CONTROL_STATES] });
  const expanded = new Map([["aria-expanded", () => true]]);

  it("hold a variant the kit omits for every set, and leave the set's own meanings", () => {
    const inPlace = withInPlaceFacts(makeStateTable(states), expanded, "Chip");
    const holdsWhere = (variant: string) => {
      const meaning = inPlace(variant);
      return meaning.kind === "condition"
        ? CONTROL_STATES.values.filter((state) => meaning.holds({ state }))
        : meaning.kind;
    };
    expect([holdsWhere("aria-expanded"), holdsWhere("disabled")]).toEqual([
      CONTROL_STATES.values,
      ["disabled"],
    ]);
    expect(makeStateTable(states)("aria-expanded")).toEqual({ kind: "omitted" });
  });

  it("refuse a state's variant, which the set gives a meaning", () => {
    expect(() =>
      withInPlaceFacts(makeStateTable(states), new Map([["disabled", () => true]]), "Chip")
    ).toThrow("an instance of Chip gives `disabled` a second meaning");
  });

  // Oracle: Input's `invalid` state renders `aria-invalid` and `data-invalid`, the attributes an
  // invalid Field stamps on its control, though every set without an invalid state drops them.
  it.each(
    ["aria-invalid", "data-invalid"].flatMap((variant) =>
      ["rest", "invalid"].map((state) => [variant, state])
    )
  )("refuse %s on an Input instance, holding at state=%s", (variant, state) => {
    expect(() =>
      withInPlaceFacts(
        makeStateTable(INPUT),
        new Map([[variant, (cell: Cell) => cell.state === state]]),
        "Input"
      )
    ).toThrow(`an instance of Input gives \`${variant}\` a second meaning`);
  });
});
