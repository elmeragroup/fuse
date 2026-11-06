// Why a test: pr-shots runs on plain Node type stripping, which cannot load Fuse's TypeScript
// sources, so it keeps its own copy of the theme axes. This holds that copy to Fuse's registry.
import { describe, expect, it } from "vitest";

import { THEME_AXES } from "../packages/fuse/src/theme/theme-input.ts";
import {
  THEME_AXIS_ATTRIBUTES,
  THEME_IDENTITIES,
  THEME_SEGMENTS,
} from "../tooling/pr-shots/src/theme-axes.ts";

describe("pr-shots theme axes", () => {
  it("names Fuse's theme attributes in slug order", () => {
    expect(THEME_AXIS_ATTRIBUTES).toEqual(THEME_AXES.map((axis) => axis.attribute));
  });

  it("names Fuse's identity and segment values", () => {
    const values = (name) => THEME_AXES.find((axis) => axis.name === name)?.values;
    expect(THEME_IDENTITIES).toEqual(values("identity"));
    expect(THEME_SEGMENTS).toEqual(values("segment"));
  });
});
