/**
 * Unit under test: the Avatar component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from the four class constants in
 * `avatar-class.ts`, the docs demos' sizes (`size-6`, `size-8`, `size-10`, `size-12`) and
 * `research/avatar-meter.md` §3: a `muted` circle, 32px by default and 24, 40 or 48px at the other
 * sizes, whose `rounded-full` CSS draws as half the side, and which clips what it holds. The
 * fallback and the image fill the circle. The fallback centers the initials `AL` at 14/20 Medium in
 * `muted-foreground`. The image is the checked-in docs portrait, a 96px PNG, which covers the
 * circle as `object-fit: cover` draws it, an image paint at FILL, named by the hash a real file gave
 * it (P9b).
 *
 * The Avatar group oracle is `avatarGroupClass` and the docs Group demo: three avatars at the recipe's
 * 32px, Ada Lovelace's, Grace Hopper's and Katherine Johnson's, whose initials the fallback holds.
 * Tailwind compiles `-space-x-2` to a -8px `margin-inline-end` on every avatar but the last, so each
 * starts 8px over the one before, the later on top, which a Figma row draws with an item spacing of
 * -8 (probe N7). `[:where(&>*)]:ring-2 [:where(&>*)]:ring-background` gives each avatar a 2px
 * `background` spread ring, which the Avatar set's root does not draw, so each instance carries it.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  FILL,
  fixedSize,
  HUG,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

/** The checked-in portrait, read here as the file it is. */
const PORTRAIT = readFileSync(new URL("./portrait.png", import.meta.url));

function avatar(content: string, size: string): ComponentRootSpec {
  return variantRoot(spec, `avatar/content=${content},size=${size}`);
}

/** A box with no limits, padding or gap that centers its layers, with no stroke or shadow. */
const CENTERED = {
  direction: "HORIZONTAL",
  limits: UNLIMITED,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  stroke: undefined,
  shadows: [],
  opacity: 1,
} as const;

/** The 32px `muted` circle, which clips what it holds, without its layers. */
const CIRCLE = {
  ...CENTERED,
  name: "avatar",
  sizing: fixedSize(literal(32), literal(32)),
  clips: true,
  cornerRadius: literal(16),
  fill: paint("muted"),
} as const;

/** A part that fills the circle on both axes and draws no corner, clip or fill of its own. */
const FILLING_PART = {
  ...CENTERED,
  kind: "frame",
  sizing: { horizontal: FILL, vertical: FILL },
  clips: false,
  cornerRadius: literal(0),
} as const;

/** A 32px fallback avatar of the group, exposed to its panel, ringed in `background`. */
const member = (key: string) =>
  ({
    kind: "instance",
    key,
    name: "avatar",
    componentSet: "avatar",
    variant: "avatar/content=fallback,size=32",
    sizing: fixedSize(literal(32), literal(32)),
    overrides: [
      {
        path: [],
        field: "effects",
        shadows: [
          { color: paint("background"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(2) },
        ],
      },
    ],
    exposed: true,
  }) as const;

describe("the Avatar component set", () => {
  it("holds the fallback and the image at four sizes, 32 first, with columns by size and one Label property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "avatar");
    expect(set?.axes).toEqual([
      { name: "content", values: ["fallback", "image"] },
      { name: "size", values: ["32", "24", "40", "48"] },
    ]);
    expect(set?.columnAxis).toBe("size");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(8);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[{ name: "Label", defaultValue: "AL" }], []]);
  });

  it("centers the initials at 14/20 Medium in muted-foreground in a fallback that fills the circle", () => {
    expect(avatar("fallback", "32")).toEqual({
      ...CIRCLE,
      children: [
        {
          ...FILLING_PART,
          key: "fallback",
          name: "avatar-fallback",
          fill: undefined,
          children: [
            {
              kind: "text",
              key: "label",
              name: "label",
              characters: "AL",
              textProperty: "Label",
              fontFamily: token("font-sans"),
              fontStyle: "Medium",
              fontSize: literal(14),
              lineHeight: literal(20),
              color: paint("muted-foreground"),
              underline: undefined,
              sizing: { horizontal: HUG, vertical: HUG },
              align: { horizontal: "LEFT", vertical: "TOP" },
              truncation: undefined,
            },
          ],
        },
      ],
    });
  });

  it("covers the circle with the portrait as an image paint at FILL", () => {
    expect(avatar("image", "32")).toEqual({
      ...CIRCLE,
      children: [
        {
          ...FILLING_PART,
          key: "image",
          name: "avatar-image",
          fill: {
            kind: "image",
            bytes: PORTRAIT.toString("base64"),
            // The hash a real file gave the portrait on 2026-10-22 (P9b).
            hash: "1e57f3da2ad606fcd410ba17f62d2fc032aa669c",
            scaleMode: "FILL",
          },
          children: [],
        },
      ],
    });
  });

  it.each([
    ["32", 32, 16],
    ["24", 24, 12],
    ["40", 40, 20],
    ["48", 48, 24],
  ])("draws the %s size as a %ipx circle on a %ipx corner", (size, side, corner) => {
    for (const content of ["fallback", "image"]) {
      const root = avatar(content, size);
      expect([root.sizing, root.cornerRadius]).toEqual([
        fixedSize(literal(side), literal(side)),
        literal(corner),
      ]);
    }
  });

  it("clips through overflow-hidden, drops align-middle and reads object-cover as the image's scale mode", () => {
    const reasons = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Avatar" && row.className === className)
          .map((row) => `${row.outcome}: ${row.detail}`)
      );
    expect(reasons("overflow-hidden")).toEqual(new Set(["literal: the box clips its content"]));
    expect(reasons("align-middle")).toEqual(
      new Set(["dropped: the component's root sits in no line box, so no line aligns it"])
    );
    expect(reasons("object-cover")).toEqual(
      new Set(["literal: the image covers the box and crops what overflows, an image paint at FILL"])
    );
  });

  it("draws the portrait from a 96px PNG, twice the largest size", () => {
    // A PNG opens with its 8-byte signature, then the IHDR chunk's length and type, then the width
    // and height as 32-bit big-endian numbers (PNG specification §5.2, §11.2.2).
    expect([...PORTRAIT.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect([PORTRAIT.readUInt32BE(16), PORTRAIT.readUInt32BE(20)]).toEqual([96, 96]);
  });
});

describe("the Avatar group component set", () => {
  it("holds one variant on the Avatar page under a one-value avatars property, with no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "avatar-group");
    expect([set?.name, set?.page]).toEqual(["Avatar group", "page/avatar"]);
    expect(set?.axes).toEqual([{ name: "avatars", values: ["3"] }]);
    expect([set?.textProperties, set?.swapProperties, set?.booleanProperties]).toEqual([[], [], undefined]);
  });

  it("overlaps the three ringed avatars by 8px, AL keeping the fallback's own initials", () => {
    expect(variantRoot(spec, "avatar-group/avatars=3")).toEqual({
      name: "avatar-group",
      ...CENTERED,
      itemSpacing: literal(-8),
      sizing: { horizontal: HUG, vertical: HUG },
      // CSS leaves the group unclipped, so each avatar's ring shows past its edges.
      clips: false,
      cornerRadius: literal(0),
      children: [
        member("al"),
        { ...member("gh"), properties: { text: { Label: "GH" } } },
        { ...member("kj"), properties: { text: { Label: "KJ" } } },
      ],
    });
  });
});
