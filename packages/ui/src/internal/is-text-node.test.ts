import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { isTextNode, isTextValueNode } from "./is-text-node";

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

describe("isTextValueNode", () => {
  it("accepts the nodes that render as their own text", () => {
    expect(isTextValueNode("Remove")).toBe(true);
    expect(isTextValueNode("")).toBe(true);
    expect(isTextValueNode(42)).toBe(true);
    expect(isTextValueNode(0)).toBe(true);
  });

  it("rejects everything else, so a node still has to be rendered to read it", () => {
    expect(isTextValueNode(null)).toBe(false);
    expect(isTextValueNode(undefined)).toBe(false);
    expect(isTextValueNode(false)).toBe(false);
    expect(isTextValueNode(["Remove", 42])).toBe(false);
    expect(isTextValueNode(createElement("span", null, "Remove"))).toBe(false);
  });

  it("differs from isTextNode only on the number arm", () => {
    expect(isTextNode(42)).toBe(false);
    expect(isTextValueNode(42)).toBe(true);
  });
});
