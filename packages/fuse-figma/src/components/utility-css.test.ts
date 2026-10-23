import { describe, expect, it } from "vitest";

import { baseBorderColor, compileUtilities } from "./utility-css";

describe("compileUtilities", () => {
  it("reads each utility's declarations from Tailwind's build of fuse.css", async () => {
    const compiled = await compileUtilities([
      "bg-primary/80",
      "px-(--control-px-button-md)",
      "rounded-(--radius-button)",
      "border-[length:var(--button-outline-width,1px)]",
      "size-4",
      "no-such-utility",
    ]);
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
    const compiled = await compileUtilities(["font-medium", "ring-2", "size-4"]);
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

  // Oracle: fuse.css's `@custom-variant item-described` puts the class after a parent context,
  // `:where(:has( > [data-slot="item-content"] > [data-slot="item-description"])) > .item-described\:…`.
  // `:where()` weighs nothing (Selectors 4 §17), so the rule weighs (0,1,0), as the bare utility does,
  // and Tailwind prints a variant's rule after every bare utility's.
  it("places a class whose rule selects it as the child of a parent context", async () => {
    const compiled = await compileUtilities(["self-start", "item-described:self-start"]);
    const bare = compiled.classes.get("self-start");
    const described = compiled.classes.get("item-described:self-start");
    expect(described?.specificity).toEqual([0, 1, 0]);
    expect((described?.order ?? -1) > (bare?.order ?? Number.POSITIVE_INFINITY)).toBe(true);
  });
});

// Unit under test: `baseBorderColor`, which reads the base-layer border color every Fuse part gets
// from a compile against `fuse.css`. Oracle: the base layer of `packages/fuse/src/styles/fuse.css`,
// whose rule for every element but a native form widget without a `data-slot` sets
// `border-color: var(--border, currentcolor)`.
describe("baseBorderColor", () => {
  const PART_ARM = ":where(:not(:is(button, input, select, textarea, meter, progress):not([data-slot])))";

  it("reads the border color fuse.css's base layer gives every part", async () => {
    expect(baseBorderColor(await compileUtilities([]))).toEqual({
      property: "border-color",
      value: "var(--border, currentcolor)",
    });
  });

  it("follows the rule's value, and fails when the rule or its border color is gone", async () => {
    const compiled = await compileUtilities([]);
    const withBase = (baseRules: typeof compiled.baseRules) => ({ ...compiled, baseRules });
    expect(
      baseBorderColor(
        withBase([
          {
            selector: `${PART_ARM}, ::after`,
            declarations: [{ property: "border-color", value: "var(--input)" }],
          },
        ])
      )
    ).toEqual({ property: "border-color", value: "var(--input)" });
    expect(() => baseBorderColor(withBase([]))).toThrow(/base layer/);
    expect(() =>
      baseBorderColor(
        withBase([{ selector: PART_ARM, declarations: [{ property: "outline-color", value: "red" }] }])
      )
    ).toThrow(/border-color/);
  });
});
