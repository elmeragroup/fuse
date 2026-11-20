import { describe, expect, it } from "vitest";

import { bareUtility } from "./bare-utility.ts";

describe("bareUtility", () => {
  it("drops every variant", () => {
    expect(
      ["bg-primary", "enabled-hover:bg-primary/80", "aria-invalid:focus-visible:ring-error/20"].map(
        bareUtility
      )
    ).toEqual(["bg-primary", "bg-primary/80", "ring-error/20"]);
  });

  it("keeps colons inside arbitrary variants and values", () => {
    expect(
      [
        "[&_svg:not([class*='size-'])]:size-4",
        "data-[pending-indicator]:[&>svg:not([data-icon=inline-end])]:hidden",
        "has-data-[icon=inline-start]:pl-(--control-px-button-icon-md)",
        "border-[length:var(--button-outline-width,1px)]",
      ].map(bareUtility)
    ).toEqual([
      "size-4",
      "hidden",
      "pl-(--control-px-button-icon-md)",
      "border-[length:var(--button-outline-width,1px)]",
    ]);
  });
});
