/**
 * Unit under test: the Item and Item link component sets as the build produces them. Oracle: the
 * Fuse variable or literal each Figma field of a cell must carry, read by hand from
 * `item-variants.ts`, `item-media-variants.ts`, `item-class.ts`, `item-title-classes.ts`,
 * `item-description-classes.ts`, `inner-corner/item.ts`, the `item-described` variant in
 * `fuse.css`, Tailwind's spacing and type scales, and the docs Basic and As a link demos' copy.
 *
 * - The row is 384px wide, the preview width its `w-full` takes, on `radius-md` with a 1px border:
 *   `border-transparent` in the default and muted variants, the `border` role in outline, and a
 *   `muted/50` fill in muted. Default rows pad with `surface-pad-md` and space with
 *   `surface-gap-md`; sm rows pad `surface-pad-md` across and `row-px` down; xs rows pad `row-px`
 *   across and `row-py` down; both space with `surface-gap-sm`.
 * - Icon media hugs the 16px Lightning in `foreground`, and is one title line tall beside a
 *   description: `--text-sm` 0.875rem × `--leading-snug` 1.375, 19.25px. Image media is a
 *   `radius-sm` square of 40, 32 or 24px by the row's size (`size-10`, and `size-8` and `size-6`
 *   under `group-data-[size]/item`), clipping the portrait, which fills it, under a 1px inside
 *   stroke of black at 10% (`outline-1 -outline-offset-1 outline-black/10`).
 * - The content column fills what the media and the actions leave (`flex-1`), with a 4px gap, none
 *   in an xs row. The title is `Spot` at 14/19.25 Medium in `foreground` (`text-sm leading-snug`).
 *   Its `w-fit` box is as wide as its text up to the column's width (CSS Sizing 3 §5.1), where an
 *   edited long title wraps, so the title fills the column and its text fills and wraps there.
 *   The description is `Hourly price with no lock-in.` at 14/21 Regular (`text-sm leading-normal`),
 *   12/18 in an xs row, in `muted-foreground`, across the column, two lines at most.
 * - The actions hold `Active` at the row's 14/20 Regular in `foreground`.
 * - Beside a description, `item-described:self-start` tops the media and the content, so the row
 *   aligns its layers at the start, and the `flex items-center` actions fill its height and center
 *   their text, where CSS centers them on the row.
 * - Item link draws the `<a>` row: hover fills it `muted`, focus draws the 2px `ring`, and an
 *   `aria-disabled` link dims to 50%.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  fixedSize,
  FOCUS_RING,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ChildLayerSpec, ComponentRootSpec, FrameLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const PORTRAIT = readFileSync(new URL("./portrait.png", import.meta.url));

function item(variant: string, size: string, described: string, media: string): ComponentRootSpec {
  return variantRoot(spec, `item/variant=${variant},size=${size},described=${described},media=${media}`);
}

/** The frame of a layer's children that carries a name, or a failure naming it. */
function frame(box: { readonly children: readonly ChildLayerSpec[] }, name: string): FrameLayerSpec {
  const found = box.children.find((child) => child.name === name);
  if (found?.kind !== "frame") {
    throw new Error(`no frame ${name}`);
  }
  return found;
}

/** The one layer a box holds, which a test reads by its kind. */
function only(box: { readonly children: readonly ChildLayerSpec[] }): ChildLayerSpec | undefined {
  expect(box.children).toHaveLength(1);
  return box.children[0];
}

const TRANSPARENT = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;

describe("the Item component set", () => {
  it("crosses three variants, three sizes, a description and two media kinds, 36 cells, with columns by size", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "item");
    expect(set?.axes).toEqual([
      { name: "variant", values: ["default", "outline", "muted"] },
      { name: "size", values: ["default", "sm", "xs"] },
      { name: "described", values: ["off", "on"] },
      { name: "media", values: ["icon", "image"] },
    ]);
    expect(set?.columnAxis).toBe("size");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(36);
    expect([set?.textProperties, set?.booleanProperties, set?.swapProperties]).toEqual([
      [
        { name: "Title", defaultValue: "Spot" },
        { name: "Description", defaultValue: "Hourly price with no lock-in." },
        { name: "Actions text", defaultValue: "Active" },
      ],
      [
        { name: "Media", defaultValue: true },
        { name: "Actions", defaultValue: true },
      ],
      [{ name: "Icon", defaultIcon: "icon/Lightning" }],
    ]);
  });

  it.each([
    ["default", undefined, TRANSPARENT],
    ["outline", undefined, paint("border")],
    ["muted", paint("muted/50"), TRANSPARENT],
  ])("draws the %s row 384px wide on radius-md with its fill and its 1px border", (variant, fill, color) => {
    const root = item(variant, "default", "off", "icon");
    expect([root.sizing, root.cornerRadius, root.fill, root.stroke]).toEqual([
      { horizontal: fixed(literal(384)), vertical: HUG },
      token("radius-md"),
      fill,
      { color, weight: literal(1) },
    ]);
  });

  it.each([
    ["default", "surface-pad-md", "surface-pad-md", "surface-gap-md", 4],
    ["sm", "surface-pad-md", "row-px", "surface-gap-sm", 4],
    ["xs", "row-px", "row-py", "surface-gap-sm", 0],
  ])(
    "pads a %s row %s across and %s down, spaces it with %s, and gaps its content %ipx",
    (size, across, down, gap, contentGap) => {
      const root = item("default", size, "off", "icon");
      expect([
        root.paddingLeft,
        root.paddingRight,
        root.paddingTop,
        root.paddingBottom,
        root.itemSpacing,
      ]).toEqual([density(across), density(across), density(down), density(down), density(gap)]);
      expect(frame(root, "item-content").itemSpacing).toEqual(literal(contentGap));
    }
  );

  it("centers its layers without a description and tops them beside one", () => {
    expect(item("default", "default", "off", "icon").counterAlign).toBe("CENTER");
    expect(item("default", "default", "on", "icon").counterAlign).toBe("MIN");
  });

  it("hugs the 16px Lightning in icon media, one 19.25px title line tall beside a description", () => {
    for (const [described, height] of [
      ["off", HUG],
      ["on", fixed(literal(19.25))],
    ] as const) {
      const media = frame(item("default", "default", described, "icon"), "item-media");
      expect([media.sizing, media.visibleProperty, media.stroke]).toEqual([
        { horizontal: HUG, vertical: height },
        "Media",
        undefined,
      ]);
      expect(only(media)).toMatchObject({
        kind: "icon",
        icon: "icon/Lightning",
        swapProperty: "Icon",
        size: literal(16),
        color: paint("foreground"),
      });
    }
  });

  it.each([
    ["default", 40],
    ["sm", 32],
    ["xs", 24],
  ])(
    "frames the portrait in %s image media at %ipx under a 1px inside stroke of black at 10%",
    (size, side) => {
      const media = frame(item("default", size, "off", "image"), "item-media");
      expect([media.sizing, media.cornerRadius, media.clips, media.stroke]).toEqual([
        fixedSize(literal(side), literal(side)),
        token("radius-sm"),
        true,
        // Out of the layout, so the portrait fills the whole square under it, as under CSS's outline.
        {
          color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
          weight: literal(1),
          inLayout: false,
        },
      ]);
      expect(only(media)).toMatchObject({
        kind: "frame",
        name: "image",
        sizing: { horizontal: FILL, vertical: FILL },
        fill: {
          kind: "image",
          bytes: PORTRAIT.toString("base64"),
          // The hash a real file gave the portrait on 2026-10-22 (P9b).
          hash: "1e57f3da2ad606fcd410ba17f62d2fc032aa669c",
          scaleMode: "FILL",
        },
      });
    }
  );

  it.each([
    ["default", 14, 21],
    ["xs", 12, 18],
  ])(
    "sets the title, which wraps in the column, and, in a %s row, the description at %i/%ipx across the column that fills the row",
    (size, fontSize, lineHeight) => {
      const content = frame(item("default", size, "on", "icon"), "item-content");
      expect([content.direction, content.sizing]).toEqual(["VERTICAL", { horizontal: FILL, vertical: HUG }]);
      const title = frame(content, "item-title");
      expect(title.sizing).toEqual({ horizontal: FILL, vertical: HUG });
      expect(only(title)).toMatchObject({
        kind: "text",
        characters: "Spot",
        textProperty: "Title",
        fontFamily: token("font-sans"),
        fontStyle: "Medium",
        fontSize: literal(14),
        lineHeight: literal(19.25),
        color: paint("foreground"),
        sizing: { horizontal: FILL, vertical: HUG },
      });
      expect(only(frame(content, "item-description"))).toMatchObject({
        kind: "text",
        characters: "Hourly price with no lock-in.",
        textProperty: "Description",
        fontStyle: "Regular",
        fontSize: literal(fontSize),
        lineHeight: literal(lineHeight),
        color: paint("muted-foreground"),
        sizing: { horizontal: FILL, vertical: HUG },
        truncation: { maxLines: 2 },
      });
      expect(
        frame(item("default", size, "off", "icon"), "item-content").children.map((child) => child.name)
      ).toEqual(["item-title"]);
    }
  );

  it("holds the actions' text at the row's 14/20 Regular behind the Actions property", () => {
    const actions = frame(item("default", "default", "off", "icon"), "item-actions");
    expect(actions.visibleProperty).toBe("Actions");
    expect(only(actions)).toMatchObject({
      kind: "text",
      characters: "Active",
      textProperty: "Actions text",
      fontStyle: "Regular",
      fontSize: literal(14),
      lineHeight: literal(20),
      color: paint("foreground"),
    });
  });

  // `flex items-center` actions that paint nothing, stretched across the row's height, centre their
  // text where the row's `items-center` centres them in CSS, and a real file stretched such a frame
  // to the height its siblings set while the row kept hugging (PF).
  it("stretches the actions across a described row's height, centring their text, and hugs them otherwise", () => {
    for (const [described, height] of [
      ["off", HUG],
      ["on", FILL],
    ] as const) {
      const actions = frame(item("default", "default", described, "icon"), "item-actions");
      expect([actions.sizing, actions.counterAlign]).toEqual([
        { horizontal: HUG, vertical: height },
        "CENTER",
      ]);
    }
    const reasons = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Item" && row.className === className)
          .map((row) => `${row.part} ${row.property} ${row.outcome}: ${row.detail}`)
      );
    expect(reasons("items-center")).toContain(
      "item align-items literal: item-actions stretches across the counter axis and places its layers centered on it, where CSS places it centered on the counter axis"
    );
    expect(reasons("item-described:self-start")).toEqual(
      new Set([
        "item-media align-self literal: at the start of the counter axis, where the row places its layers",
        "item-content align-self literal: at the start of the counter axis, where the row places its layers",
      ])
    );
  });
});

describe("the Item link component set", () => {
  function link(variant: string, state: string): ComponentRootSpec {
    return variantRoot(spec, `item-link/variant=${variant},state=${state}`);
  }

  it("crosses the default and outline rows with four states, 8 cells, with icon media and a title", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "item-link");
    expect(set?.axes).toEqual([
      { name: "variant", values: ["default", "outline"] },
      { name: "state", values: ["rest", "hover", "focus", "disabled"] },
    ]);
    expect(set?.variants).toHaveLength(8);
    expect([set?.textProperties, set?.booleanProperties]).toEqual([
      [{ name: "Title", defaultValue: "Open order" }],
      [{ name: "Media", defaultValue: true }],
    ]);
    expect(link("default", "rest").children.map((child) => child.name)).toEqual([
      "item-media",
      "item-content",
    ]);
  });

  it("fills the hovered row muted, rings the focused one, and dims the disabled one", () => {
    const faces = (state: string) => {
      const root = link("outline", state);
      return [root.fill, root.shadows, root.opacity];
    };
    expect(faces("rest")).toEqual([undefined, [], 1]);
    expect(faces("hover")).toEqual([paint("muted"), [], 1]);
    expect(faces("focus")).toEqual([undefined, [FOCUS_RING], 1]);
    expect(faces("disabled")).toEqual([undefined, [], 0.5]);
  });
});
