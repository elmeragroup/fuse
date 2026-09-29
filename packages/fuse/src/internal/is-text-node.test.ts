import { createElement } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import { isTextNode, isTextValueNode } from "./is-text-node";

describe("isTextNode", () => {
  // A plain string, including the empty one, is text; every other ReactNode is not.
  it.each<[string, ReactNode, boolean]>([
    ["a string", "Remove", true],
    ["the empty string", "", true],
    ["a number", 42, false],
    ["null", null, false],
    ["undefined", undefined, false],
    ["false", false, false],
    ["an array of strings", ["Remove", "Ada"], false],
    ["an element", createElement("span", null, "Remove"), false],
  ])("classifies %s as %s", (_name, node, expected) => {
    expect(isTextNode(node)).toBe(expected);
  });
});

describe("isTextValueNode", () => {
  // The nodes that render as their own text are accepted; everything else still has to be
  // rendered to read it.
  it.each<[string, ReactNode, boolean]>([
    ["a string", "Remove", true],
    ["the empty string", "", true],
    ["a number", 42, true],
    ["zero", 0, true],
    ["null", null, false],
    ["undefined", undefined, false],
    ["false", false, false],
    ["an array", ["Remove", 42], false],
    ["an element", createElement("span", null, "Remove"), false],
  ])("classifies %s as %s", (_name, node, expected) => {
    expect(isTextValueNode(node)).toBe(expected);
  });
});
