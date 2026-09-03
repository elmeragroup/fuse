import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { isTextNode } from "./is-text-node";

describe("isTextNode", () => {
  it("accepts a plain string, including the empty one", () => {
    expect(isTextNode("Remove")).toBe(true);
    expect(isTextNode("")).toBe(true);
  });

  it("rejects every non-string ReactNode", () => {
    expect(isTextNode(42)).toBe(false);
    expect(isTextNode(null)).toBe(false);
    expect(isTextNode(undefined)).toBe(false);
    expect(isTextNode(false)).toBe(false);
    expect(isTextNode(["Remove", "Ada"])).toBe(false);
    expect(isTextNode(createElement("span", null, "Remove"))).toBe(false);
  });
});
