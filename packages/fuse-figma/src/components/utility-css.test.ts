import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileUtilities, elementReach } from "./utility-css";

describe("compileUtilities", () => {
  it("reads each utility's declarations from Tailwind's build of fuse.css", async () => {
    const compiled = await Effect.runPromise(
      compileUtilities([
        "bg-primary/80",
        "px-(--control-px-button-md)",
        "rounded-(--radius-button)",
        "border-[length:var(--button-outline-width,1px)]",
        "size-4",
        "no-such-utility",
      ])
    );
    const declarations = (utility: string) =>
      compiled.rules
        .get(utility)
        ?.declarations.map((declaration) => [declaration.property, declaration.value]);

    // The color-mix() declaration follows its fallback, so it wins in a browser that has it.
    expect(declarations("bg-primary/80")).toEqual([
      ["background-color", "var(--primary)"],
      ["background-color", "color-mix(in oklab, var(--primary) 80%, transparent)"],
    ]);
    expect(declarations("px-(--control-px-button-md)")).toEqual([
      ["padding-inline", "var(--control-px-button-md)"],
    ]);
    expect(declarations("rounded-(--radius-button)")).toEqual([["border-radius", "var(--radius-button)"]]);
    expect(declarations("border-[length:var(--button-outline-width,1px)]")).toEqual([
      ["border-style", "var(--tw-border-style)"],
      ["border-width", "var(--button-outline-width,1px)"],
    ]);
    // fuse.css declares `--spacing: 0.25rem` in `@theme inline`, so Tailwind inlines it.
    expect(declarations("size-4")).toEqual([
      ["width", "calc(0.25rem * 4)"],
      ["height", "calc(0.25rem * 4)"],
    ]);
    expect(compiled.rules.has("no-such-utility")).toBe(false);
  });

  // Oracle: Tailwind's utilities.css registers `@property --tw-ring-offset-width { syntax:
  // "<length>"; inherits: false; initial-value: 0px }`, and the other ring and shadow layers alike.
  it("reads the theme values and the registered properties the utilities use", async () => {
    const compiled = await Effect.runPromise(compileUtilities(["font-medium", "ring-2", "size-4"]));
    expect(compiled.themeValues.get("--font-weight-medium")).toBe("500");
    expect(compiled.registeredProperties.get("--tw-ring-offset-width")).toEqual({
      initialValue: "0px",
      inherits: false,
    });
    expect(compiled.registeredProperties.get("--tw-shadow")).toEqual({
      initialValue: "0 0 #0000",
      inherits: false,
    });
  });
});

// Oracle: Tailwind compiles `uppercase` to `.uppercase`, `[&]:uppercase` to the plain rule
// `.\[\&\]\:uppercase` although the class carries a variant, `sm:uppercase` inside `@media (width >= 40rem)`,
// `*:text-sm` to `:is(.\*\:text-sm > *)` and `**:text-sm` to `:is(.\*\*\:text-sm *)`, and an
// unknown utility to nothing.
describe("elementReach", () => {
  const reachOf = async (className: string) =>
    elementReach(await Effect.runPromise(compileUtilities([className])), className);

  it("applies a plain rule of a class with no variant", async () => {
    const reach = await reachOf("uppercase");
    expect(reach.kind === "own" ? reach.rule.declarations : reach).toEqual([
      { property: "text-transform", value: "uppercase" },
    ]);
  });

  it.each([
    ["*:text-sm", { kind: "below", reach: "children" }],
    ["**:text-sm", { kind: "below", reach: "descendants" }],
    ["[&]:uppercase", { kind: "unread", reason: "it carries the variant `[&]:`" }],
    ["sm:uppercase", { kind: "unread", reason: "it carries the variant `sm:`" }],
    [
      "no-such-utility",
      { kind: "unread", reason: "Tailwind compiles no rule that selects it alone, outside any condition" },
    ],
  ])("reads %s as the compile places it", async (className, expected) => {
    expect(await reachOf(className)).toEqual(expected);
  });
});
