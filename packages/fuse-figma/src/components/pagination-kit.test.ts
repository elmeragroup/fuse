/**
 * Unit under test: the four Pagination component sets as the build produces them. Oracle: the
 * Fuse variable or literal each Figma field of a cell must carry, read by hand from
 * `pagination.tsx`, `pagination-variants.ts`, `button-variants.ts` and `control-size.ts`, from the
 * docs Basic demo, and from the host page the compare draws: the browser's 16px `medium` font size
 * and preflight's `line-height: 1.5` on `<html>`, which the link's number inherits, since the
 * `icon` square sets no type. Each link cell is also cross-checked against the Icon button cell of
 * its variant and state: a link renders that recipe at `size="icon"` with the `gap-1` of
 * `paginationVariants`, so the two agree on everything but the gap and what the box holds.
 * `build-kit.test.ts` pins the square's box and each variant's paint by hand. The row's root is a
 * `flex-col items-center justify-center` column around the `flex-row items-center justify-center
 * gap-1` row, whose items carry no class and hug their parts, as Chromium measured the Basic demo on
 * the compare page on 2026-10-24: each item as wide and tall as its link or edge, the items 4px
 * apart, and the root as wide as the row.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  fixed,
  fixedSize,
  FOCUS_RING,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec, InstanceLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const transparent = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;

function link(current: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `pagination-link/current=${current},state=${state}`);
}

function edge(direction: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `pagination-edge/direction=${direction},state=${state}`);
}

function set(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** The variants a link or edge leaves out, read from the coverage table's dropped rows. */
function omittedBy(component: string): ReadonlySet<string> {
  return new Set(
    coverage.flatMap((row) =>
      row.outcome === "dropped" && row.component === component
        ? (/^no cell of the matrix shows `(.+)`$/.exec(row.detail)?.[1] ?? [])
        : []
    )
  );
}

const STATES = ["rest", "hover", "focus"];

/**
 * The number a link shows, in the host page's type: 16px, the browser's `medium`, at preflight's
 * 1.5 line height. The link's root is `font-medium` and sets no color, so the page's `foreground`
 * holds.
 */
const NUMBER = {
  kind: "text",
  key: "label",
  name: "label",
  characters: "1",
  textProperty: "Label",
  fontFamily: token("font-sans"),
  fontStyle: "Medium",
  fontSize: literal(16),
  lineHeight: literal(24),
  color: paint("foreground"),
  ...HUGGING_LABEL,
} as const;

/** An edge's copy in the md control type, which `size="default"` sets. */
const copy = (characters: string) =>
  ({
    kind: "text",
    key: "label",
    name: "label",
    characters,
    textProperty: undefined,
    fontFamily: token("font-sans"),
    fontStyle: "Medium",
    fontSize: density("control-text"),
    lineHeight: density("control-leading"),
    color: paint("foreground"),
    ...HUGGING_LABEL,
  }) as const;

/** An edge's chevron: the fixed caret the component draws, at the `size-4` of `linkIcon`. */
const caret = (icon: string) =>
  ({
    kind: "icon",
    key: "caret",
    name: "Caret",
    icon: `icon/${icon}`,
    swapProperty: undefined,
    size: literal(16),
    color: paint("foreground"),
  }) as const;

/** What a link and an edge leave out: Button's omissions, and every disabled and pending arm. */
const LINK_OMISSIONS = new Set([
  "aria-invalid",
  "data-invalid",
  "enabled-active",
  "aria-expanded",
  "in-data-[slot=button-group]",
  "aria-disabled",
  "data-[pending-indicator]",
  "disabled",
  "data-disabled",
]);

describe("the Pagination link component set", () => {
  it("holds the 2 × 3 matrix on the Pagination page, with columns by state and the demo's number", () => {
    const links = set("pagination-link");
    expect([links?.name, links?.page]).toEqual(["Pagination link", "page/pagination"]);
    expect(links?.axes).toEqual([
      { name: "current", values: ["off", "on"] },
      { name: "state", values: STATES },
    ]);
    expect(links?.columnAxis).toBe("state");
    expect(new Set(links?.variants.map((cell) => cell.key)).size).toBe(6);
    // The docs Basic demo's current page.
    expect(links?.textProperties).toEqual([{ name: "Label", defaultValue: "1" }]);
    expect(links?.swapProperties).toEqual([]);
  });

  it("draws a link that is not current as the ghost md square around the number, in the host's type", () => {
    expect(link("off", "rest")).toEqual({
      name: "pagination-link",
      direction: "HORIZONTAL",
      sizing: fixedSize(density("control-h-md"), density("control-h-md")),
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: literal(0),
      paddingBottom: literal(0),
      paddingLeft: literal(0),
      itemSpacing: literal(4),
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      cornerRadius: token("radius-button"),
      stroke: { color: transparent, weight: literal(1) },
      shadows: [],
      opacity: 1,
      children: [NUMBER],
    });
  });

  it("draws each cell as the Icon button box of its variant and state, with the gap and the number", () => {
    for (const [current, variant] of [
      ["off", "ghost"],
      ["on", "outline"],
    ] as const) {
      for (const state of STATES) {
        const square = variantRoot(spec, `icon-button/variant=${variant},size=icon,state=${state}`);
        expect(link(current, state), `${current} ${state}`).toEqual({
          ...square,
          name: "pagination-link",
          itemSpacing: literal(4),
          children: [NUMBER],
        });
      }
    }
  });

  it("drops Button's group corners and every disabled and pending arm, which an <a> never shows", () => {
    expect(omittedBy("Pagination link")).toEqual(LINK_OMISSIONS);
  });
});

describe("the Pagination edge component set", () => {
  it("holds the previous and next links in 3 states, with columns by state and no properties", () => {
    const edges = set("pagination-edge");
    expect([edges?.name, edges?.page]).toEqual(["Pagination edge", "page/pagination"]);
    expect(edges?.axes).toEqual([
      { name: "direction", values: ["previous", "next"] },
      { name: "state", values: STATES },
    ]);
    expect(edges?.columnAxis).toBe("state");
    expect(new Set(edges?.variants.map((cell) => cell.key)).size).toBe(6);
    // Each direction shows its own en-US copy, and one text property holds one default.
    expect(edges?.textProperties).toEqual([]);
    expect(edges?.swapProperties).toEqual([]);
  });

  it("draws Previous as the ghost md label with the caret before the copy, 10px from the start", () => {
    expect(edge("previous", "rest")).toEqual({
      name: "pagination-edge",
      direction: "HORIZONTAL",
      sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: density("control-px-button-md"),
      paddingBottom: literal(0),
      paddingLeft: literal(10),
      itemSpacing: literal(4),
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      cornerRadius: token("radius-button"),
      stroke: { color: transparent, weight: literal(1) },
      shadows: [],
      opacity: 1,
      children: [caret("CaretLeft"), copy("Previous")],
    });
  });

  it("draws Next with the caret after the copy, 10px from the end", () => {
    const next = edge("next", "rest");
    expect([next.paddingLeft, next.paddingRight]).toEqual([density("control-px-button-md"), literal(10)]);
    expect(next.children).toEqual([copy("Next"), caret("CaretRight")]);
  });

  it("fills an edge with muted on hover and rings it on focus", () => {
    for (const direction of ["previous", "next"]) {
      expect(edge(direction, "hover").fill, direction).toEqual(paint("muted"));
      expect(edge(direction, "focus").shadows, direction).toEqual([FOCUS_RING]);
    }
  });

  it("drops what a link drops", () => {
    expect(omittedBy("Pagination edge")).toEqual(LINK_OMISSIONS);
  });
});

describe("the Pagination ellipsis component set", () => {
  it("holds one variant, the md square, under a one-value size property", () => {
    const ellipsis = set("pagination-ellipsis");
    expect([ellipsis?.name, ellipsis?.page]).toEqual(["Pagination ellipsis", "page/pagination"]);
    expect(ellipsis?.axes).toEqual([{ name: "size", values: ["md"] }]);
    expect(ellipsis?.columnAxis).toBe("size");
    expect(ellipsis?.textProperties).toEqual([]);
    expect(ellipsis?.swapProperties).toEqual([]);
  });

  it("centers the 16px DotsThree in the md control square, and draws no text for the hidden copy", () => {
    expect(variantRoot(spec, "pagination-ellipsis/size=md")).toEqual({
      name: "pagination-ellipsis",
      direction: "HORIZONTAL",
      sizing: fixedSize(density("control-h-md"), density("control-h-md")),
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: literal(0),
      paddingBottom: literal(0),
      paddingLeft: literal(0),
      itemSpacing: literal(0),
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      cornerRadius: literal(0),
      shadows: [],
      opacity: 1,
      children: [
        {
          kind: "icon",
          key: "icon",
          name: "Icon",
          icon: "icon/DotsThree",
          swapProperty: undefined,
          size: literal(16),
          color: paint("foreground"),
        },
      ],
    });
  });
});

/** A box with no paint, padding or limits that hugs what it holds, centered on both axes. */
const box = (direction: string, itemSpacing: number) => ({
  direction,
  sizing: { horizontal: HUG, vertical: HUG },
  limits: UNLIMITED,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(itemSpacing),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  shadows: [],
  opacity: 1,
});

/** A `Pagination.Item` around one part, as a frame that hugs it. */
const item = (key: string, part: InstanceLayerSpec) => ({
  kind: "frame",
  key: `${key}-item`,
  name: "pagination-item",
  ...box("HORIZONTAL", 0),
  clips: false,
  children: [part],
});

/** An edge, at the md label height and hugging its copy, as the edge set draws it. */
const edgeInstance = (direction: string): InstanceLayerSpec => ({
  kind: "instance",
  key: direction,
  name: "pagination-edge",
  componentSet: "pagination-edge",
  variant: `pagination-edge/direction=${direction},state=rest`,
  sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
});

/** A page link, the md square, exposed to the row's panel. */
const pageInstance = (number: string, current: string): InstanceLayerSpec => ({
  kind: "instance",
  key: `page-${number}`,
  name: "pagination-link",
  componentSet: "pagination-link",
  variant: `pagination-link/current=${current},state=rest`,
  sizing: fixedSize(density("control-h-md"), density("control-h-md")),
  exposed: true,
});

describe("the Pagination row component set", () => {
  it("holds one variant on the Pagination page under a one-value pages property, with no properties of its own", () => {
    const rows = set("pagination-row");
    expect([rows?.name, rows?.page]).toEqual(["Pagination row", "page/pagination"]);
    expect(rows?.axes).toEqual([{ name: "pages", values: ["3"] }]);
    expect(rows?.columnAxis).toBe("pages");
    expect([rows?.textProperties, rows?.swapProperties, rows?.booleanProperties]).toEqual([
      [],
      [],
      undefined,
    ]);
  });

  it("centers the row of previous, pages 1 to 3 with 1 current, and next, 4px apart, in a column that hugs it", () => {
    expect(variantRoot(spec, "pagination-row/pages=3")).toEqual({
      name: "pagination",
      ...box("VERTICAL", 0),
      clips: true,
      children: [
        {
          kind: "frame",
          key: "content",
          name: "pagination-content",
          ...box("HORIZONTAL", 4),
          clips: false,
          children: [
            item("previous", edgeInstance("previous")),
            item("page-1", pageInstance("1", "on")),
            item("page-2", { ...pageInstance("2", "off"), properties: { text: { Label: "2" } } }),
            item("page-3", { ...pageInstance("3", "off"), properties: { text: { Label: "3" } } }),
            item("next", edgeInstance("next")),
          ],
        },
      ],
    });
  });
});
