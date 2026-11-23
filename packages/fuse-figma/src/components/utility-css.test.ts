import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import { compileUtilities } from "./utility-css";

describe("compileUtilities", () => {
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
