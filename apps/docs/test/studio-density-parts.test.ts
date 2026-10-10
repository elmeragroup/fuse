import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "@elmeragroup/fuse/theme-catalog";

import {
  FUSE_PART_ROLES,
  keepInspected,
  partRoleTable,
  resolvePartRole,
} from "../src/lib/studio/density-parts";
import type { InspectedPart } from "../src/lib/studio/density-parts";

/** A hand-written slice of `PART_DENSITY`, in its table order. */
const TABLE = partRoleTable([
  ["button", "control"],
  ["card", "layout"],
  ["card[data-direction=horizontal]", "surface"],
  ["sidebar-group:where([data-collapsible=icon] *)", "fixed"],
  ["sidebar-group", "surface"],
  ["sidebar-menu-button:where([data-collapsible=icon] *)", "fixed"],
  ["sidebar-menu-button", "row"],
  ["sidebar-menu-button[data-size=sm]", "label"],
]);

const NEVER = (): boolean => false;

describe("resolvePartRole", () => {
  it("gives a plain slot its own role", () => {
    expect(resolvePartRole(TABLE, "button", NEVER)).toEqual({ key: "button", role: "control" });
  });

  it("lets an override key whose suffix matches win over the slot", () => {
    const matches = (suffix: string) => suffix === "[data-direction=horizontal]";
    expect(resolvePartRole(TABLE, "card", matches)).toEqual({
      key: "card[data-direction=horizontal]",
      role: "surface",
    });
  });

  it("keeps the slot's role when no override suffix matches", () => {
    expect(resolvePartRole(TABLE, "card", NEVER)).toEqual({ key: "card", role: "layout" });
  });

  it("resolves the Sidebar icon rail's container override, listed before its slot", () => {
    const inRail = (suffix: string) => suffix === ":where([data-collapsible=icon] *)";
    expect(resolvePartRole(TABLE, "sidebar-group", inRail)).toEqual({
      key: "sidebar-group:where([data-collapsible=icon] *)",
      role: "fixed",
    });
    expect(resolvePartRole(TABLE, "sidebar-group", NEVER)).toEqual({ key: "sidebar-group", role: "surface" });
  });

  it("takes the first matching override in table order", () => {
    const always = (): boolean => true;
    expect(resolvePartRole(TABLE, "sidebar-menu-button", always)).toEqual({
      key: "sidebar-menu-button:where([data-collapsible=icon] *)",
      role: "fixed",
    });
  });

  it("asks only about the slot's own suffixes, in table order", () => {
    const asked: string[] = [];
    resolvePartRole(TABLE, "sidebar-menu-button", (suffix) => {
      asked.push(suffix);
      return false;
    });
    expect(asked).toEqual([":where([data-collapsible=icon] *)", "[data-size=sm]"]);
  });

  it("gives no role to a slot the table does not declare", () => {
    expect(resolvePartRole(TABLE, "studio-swatch", NEVER)).toBeUndefined();
  });

  it("does not take a slot that only prefixes a declared one", () => {
    expect(resolvePartRole(TABLE, "card-header", () => true)).toBeUndefined();
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
