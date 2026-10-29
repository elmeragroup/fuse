import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "@elmeragroup/fuse/theme-catalog";

import {
  FUSE_PART_ROLES,
  keepInspected,
  partRoleTable,
  resolvePartRole,
} from "../../src/studio/lib/density-parts";
import type { InspectedPart } from "../../src/studio/lib/density-parts";

/** A hand-written slice of `PART_DENSITY`, in its table order. */
const TABLE = partRoleTable([
  ["button", "control"],
  ["card", "layout"],
  ["card[data-direction=horizontal]", "surface"],
  ["sidebar-menu-button:where([data-collapsible=icon] *)", "fixed"],
  ["sidebar-menu-button", "row"],
  ["sidebar-menu-button[data-size=sm]", "label"],
]);

const NEVER = (): boolean => false;
const ALWAYS = (): boolean => true;
const HORIZONTAL = (suffix: string) => suffix === "[data-direction=horizontal]";

describe("resolvePartRole", () => {
  it.each([
    ["gives a plain slot its own role", "button", NEVER, { key: "button", role: "control" }],
    [
      "lets an override key whose suffix matches win over the slot",
      "card",
      HORIZONTAL,
      { key: "card[data-direction=horizontal]", role: "surface" },
    ],
    ["keeps the slot's role when no override suffix matches", "card", NEVER, { key: "card", role: "layout" }],
    [
      "takes the first matching override in table order",
      "sidebar-menu-button",
      ALWAYS,
      { key: "sidebar-menu-button:where([data-collapsible=icon] *)", role: "fixed" },
    ],
    ["gives no role to a slot the table does not declare", "studio-swatch", NEVER, undefined],
    ["does not take a slot that only prefixes a declared one", "card-header", ALWAYS, undefined],
  ] as const)("%s", (_case, slot, matches, role) => {
    expect(resolvePartRole(TABLE, slot, matches)).toEqual(role);
  });
});

/** Each `PART_DENSITY` key split by hand into its slot and suffix, in table order. */
const FUSE_KEYS = Object.entries(PART_DENSITY).map(([key, role]) => {
  const cut = key.search(/[[:]/u);
  return cut === -1
    ? { key, role, slot: key, suffix: undefined }
    : { key, role, slot: key.slice(0, cut), suffix: key.slice(cut) };
});

// Unit under test: FUSE_PART_ROLES, built from the generated catalog, which groups keys by role.
// Oracle: PART_DENSITY in Fuse's source, read in its own table order.
describe("FUSE_PART_ROLES", () => {
  it.each(FUSE_KEYS)("resolves $key to PART_DENSITY's role", ({ key, role, slot, suffix }) => {
    expect(resolvePartRole(FUSE_PART_ROLES, slot, (asked) => asked === suffix)).toEqual({ key, role });
  });

  it("asks each slot's suffixes in PART_DENSITY's table order", () => {
    for (const slot of new Set(FUSE_KEYS.map((entry) => entry.slot))) {
      const asked: string[] = [];
      resolvePartRole(FUSE_PART_ROLES, slot, (suffix) => {
        asked.push(suffix);
        return false;
      });
      const declared = FUSE_KEYS.flatMap((entry) =>
        entry.slot === slot && entry.suffix !== undefined ? [entry.suffix] : []
      );
      expect(asked, slot).toEqual(declared);
    }
  });
});

const BUTTON: InspectedPart = {
  slot: "button",
  key: "button",
  role: "control",
  artboard: "density-twin-dense",
};

describe("keepInspected", () => {
  it("keeps the current part while the pointer moves within it", () => {
    expect(keepInspected(BUTTON, { ...BUTTON })).toBe(BUTTON);
  });

  it.each([
    ["slot", { ...BUTTON, slot: "button-group" }],
    ["key", { ...BUTTON, key: "button[data-size=xs]" }],
    ["role", { ...BUTTON, role: "fixed" }],
    ["artboard", { ...BUTTON, artboard: "density-twin-comfortable" }],
  ] as const)("takes the next part when its %s differs", (_field, next) => {
    expect(keepInspected(BUTTON, next)).toBe(next);
  });

  it("takes the first part when nothing was inspected", () => {
    expect(keepInspected(undefined, BUTTON)).toBe(BUTTON);
  });
});
