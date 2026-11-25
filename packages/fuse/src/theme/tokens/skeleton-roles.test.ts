/**
 * Unit under test: skeleton role lookup. Oracle: the precedence the module documents, written out
 * per element by hand: a `data-skeleton` hint naming a role, then the role of the part its marker
 * names, then `block` for a media or form tag, else a container. The table's keys are checked
 * against `PART_DENSITY`, the table of every slot the package writes, so a role never names a part
 * that does not exist.
 */
import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "./density-roles";
import { PART_SKELETON, skeletonRoleOf } from "./skeleton-roles";
import type { SkeletonRoleSource } from "./skeleton-roles";

const CASES: ReadonlyArray<readonly [string, SkeletonRoleSource, ReturnType<typeof skeletonRoleOf>]> = [
  ["a Fuse Button", { hint: null, part: "button", tagName: "button" }, "block"],
  ["a Fuse Avatar", { hint: null, part: "avatar", tagName: "span" }, "block"],
  ["a Fuse Switch", { hint: null, part: "switch", tagName: "button" }, "block"],
  ["a Fuse Loader", { hint: null, part: "loader", tagName: "div" }, "ignore"],
  ["a marker naming a part with no role", { hint: null, part: "card", tagName: "div" }, undefined],
  ["an image", { hint: null, part: null, tagName: "img" }, "block"],
  ["an svg icon", { hint: null, part: null, tagName: "svg" }, "block"],
  ["a consumer div", { hint: null, part: null, tagName: "div" }, undefined],
  ["a consumer chip marked block", { hint: "block", part: null, tagName: "span" }, "block"],
  ["a consumer image marked ignore", { hint: "ignore", part: null, tagName: "img" }, "ignore"],
  ["a Loader marked block", { hint: "block", part: "loader", tagName: "div" }, "block"],
  ["a Button marked ignore", { hint: "ignore", part: "button", tagName: "button" }, "ignore"],
  ["an unknown hint on an Avatar", { hint: "card", part: "avatar", tagName: "span" }, "block"],
  ["an empty hint on a div", { hint: "", part: null, tagName: "div" }, undefined],
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
