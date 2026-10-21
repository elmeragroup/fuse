import { describe, expect, it } from "vitest";

import { splitClassName } from "./class-name";

describe("splitClassName", () => {
  it("separates each variant from the utility", () => {
    expect(splitClassName("bg-primary")).toEqual({ variants: [], utility: "bg-primary" });
    expect(splitClassName("enabled-hover:bg-primary/80")).toEqual({
      variants: ["enabled-hover"],
      utility: "bg-primary/80",
    });
    expect(splitClassName("aria-invalid:focus-visible:ring-error/20")).toEqual({
      variants: ["aria-invalid", "focus-visible"],
      utility: "ring-error/20",
    });
  });

  it("keeps colons inside arbitrary variants and values", () => {
    expect(splitClassName("[&_svg:not([class*='size-'])]:size-4")).toEqual({
      variants: ["[&_svg:not([class*='size-'])]"],
      utility: "size-4",
    });
    expect(splitClassName("data-[pending-indicator]:[&>svg:not([data-icon=inline-end])]:hidden")).toEqual({
      variants: ["data-[pending-indicator]", "[&>svg:not([data-icon=inline-end])]"],
      utility: "hidden",
    });
    expect(splitClassName("has-data-[icon=inline-start]:pl-(--control-px-button-icon-md)")).toEqual({
      variants: ["has-data-[icon=inline-start]"],
      utility: "pl-(--control-px-button-icon-md)",
    });
    expect(splitClassName("border-[length:var(--button-outline-width,1px)]")).toEqual({
      variants: [],
      utility: "border-[length:var(--button-outline-width,1px)]",
    });
  });
});
