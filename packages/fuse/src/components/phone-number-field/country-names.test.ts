import { afterEach, describe, expect, it, vi } from "vitest";

import { countryNameResolver, resetCountryNameCache } from "./country-names";

afterEach(() => {
  resetCountryNameCache();
  vi.restoreAllMocks();
});

describe("countryNameResolver", () => {
  it("reuses a per-locale cache across resolver instances", () => {
    const ofSpy = vi.spyOn(Intl.DisplayNames.prototype, "of");
    expect(countryNameResolver("en-US")("SE")).toBe("Sweden");
    expect(ofSpy).toHaveBeenCalledTimes(1);
    expect(countryNameResolver("en-US")("SE")).toBe("Sweden");
    expect(ofSpy).toHaveBeenCalledTimes(1);
  });
});
