import { describe, expect, it } from "vitest";

import * as Oklch from "./oklch.ts";
import { getOrThrow } from "./result.ts";

describe("getOrThrow", () => {
  it("throws the failure's own tagged error", () => {
    expect(() => getOrThrow(Oklch.parse("nope"))).toThrowError('Expected an oklch() color, received "nope"');
    let thrown: unknown;
    try {
      getOrThrow(Oklch.parse("nope"));
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof Error).toBe(true);
    expect(thrown).toMatchObject({ _tag: "InvalidColor" });
  });
});
