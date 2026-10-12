import { describe, expect, it } from "vitest";

import { densityLengthInPx } from "./density-length";

describe("densityLengthInPx", () => {
  it.each([
    ["2rem", 16, 32],
    [" 2.25rem", 16, 36],
    ["0.25rem", 20, 5],
    [".5rem", 16, 8],
    ["36px", 16, 36],
  ] as const)("reads %j at a %ipx root as %ipx", (value, root, expected) => {
    expect(densityLengthInPx(value, root)).toBe(expected);
  });

  it.each(["", "auto", "calc(2rem + 1px)", "2em", "-1rem", "2 rem"])("reads %j as no length", (value) => {
    expect(densityLengthInPx(value, 16)).toBeUndefined();
  });
});
