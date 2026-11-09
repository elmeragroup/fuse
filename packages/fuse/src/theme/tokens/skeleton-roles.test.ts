/**
 * Unit under test: skeleton role lookup. Oracle: the precedence the module documents, written out
 * per element by hand: a `data-skeleton` hint naming a role, then the slot's role, then `block` for
 * a media or form tag, else a container. The table's keys are checked against `PART_DENSITY`, the
 * table of every slot the package writes, so a role never names a part that does not exist.
 */
import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "./density-roles";
import { PART_SKELETON, skeletonRoleOf } from "./skeleton-roles";
import type { SkeletonRoleSource } from "./skeleton-roles";

const CASES: ReadonlyArray<readonly [string, SkeletonRoleSource, ReturnType<typeof skeletonRoleOf>]> = [
  ["a Fuse Button", { hint: null, slot: "button", tagName: "button" }, "block"],
  ["a Fuse Avatar", { hint: null, slot: "avatar", tagName: "span" }, "block"],
  ["a Fuse Switch", { hint: null, slot: "switch", tagName: "button" }, "block"],
  ["a Fuse Loader", { hint: null, slot: "loader", tagName: "div" }, "ignore"],
  ["a Fuse Card", { hint: null, slot: "card", tagName: "div" }, undefined],
  ["a Fuse card title", { hint: null, slot: "card-title", tagName: "div" }, undefined],
  ["an image", { hint: null, slot: null, tagName: "img" }, "block"],
  ["an svg icon", { hint: null, slot: null, tagName: "svg" }, "block"],
  ["a consumer div", { hint: null, slot: null, tagName: "div" }, undefined],
  ["a consumer chip marked block", { hint: "block", slot: null, tagName: "span" }, "block"],
  ["a consumer image marked ignore", { hint: "ignore", slot: null, tagName: "img" }, "ignore"],
  ["a Loader marked block", { hint: "block", slot: "loader", tagName: "div" }, "block"],
  ["a Button marked ignore", { hint: "ignore", slot: "button", tagName: "button" }, "ignore"],
  ["an unknown hint on an Avatar", { hint: "card", slot: "avatar", tagName: "span" }, "block"],
  ["an empty hint on a div", { hint: "", slot: null, tagName: "div" }, undefined],
];

describe("skeletonRoleOf", () => {
  it.each(CASES)("%s", (_name, source, expected) => {
    expect(skeletonRoleOf(source)).toBe(expected);
  });
});

describe("PART_SKELETON", () => {
  it("names only parts the package writes", () => {
    const unknown = Object.keys(PART_SKELETON).filter((slot) => !Object.hasOwn(PART_DENSITY, slot));
    expect(unknown).toEqual([]);
  });
});
