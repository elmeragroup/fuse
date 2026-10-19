import { describe, expect, it } from "vitest";

import { compileUtilities } from "./utility-css";

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

  it("reads the theme values and registered property defaults the utilities use", async () => {
    const compiled = await compileUtilities(["font-medium", "ring-2", "size-4"]);
    expect(compiled.themeValues.get("--font-weight-medium")).toBe("500");
    expect(compiled.propertyInitials.get("--tw-ring-offset-width")).toBe("0px");
    expect(compiled.propertyInitials.get("--tw-shadow")).toBe("0 0 #0000");
  });
});
