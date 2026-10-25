/**
 * Unit under test: the Dropdown menu popup sets as the build produces them. Oracle: the row widths
 * Chromium measured on the compare page on 2026-10-25, each row at `width: max-content` in its docs
 * demo's open popup, in the dense theme and the comfortable one, and the popup's own minimum, `min-w-32`
 * less `surface-pad-sm` on each side: 120px for the popup, 88px for the submenu's `min-w-[96px]`. A
 * popup sizes to its widest row past that minimum, so that row hugs from the minimum and every other
 * one fills (PH3).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, FILL, HUG, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { BoxSpec, ChildLayerSpec, InstanceLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A docs demo's rows, each with its width in pixels at max-content, dense then comfortable, from Chromium. */
type Measured = {
  readonly content: string;
  readonly rows: readonly { readonly label: string; readonly widths: readonly [number, number] }[];
};

const MEASURED: readonly Measured[] = [
  {
    content: "basic",
    rows: [
      { label: "Profile", widths: [98.0, 106.0] },
      { label: "Billing", widths: [82.84, 90.84] },
      { label: "Keyboard shortcuts", widths: [166.42, 174.42] },
      { label: "Log out", widths: [63.14, 71.14] },
    ],
  },
  {
    content: "checkboxes",
    rows: [
      { label: "Show toolbar", widths: [122.05, 130.05] },
      { label: "Show minimap", widths: [132.58, 140.58] },
    ],
  },
  {
    content: "radio",
    rows: [
      { label: "Status bar", widths: [103.73, 111.73] },
      { label: "Activity bar", widths: [109.53, 117.53] },
      { label: "Panel", widths: [74.94, 82.94] },
    ],
  },
  {
    content: "destructive",
    rows: [
      { label: "Profile", widths: [104.02, 112.02] },
      { label: "Billing", widths: [77.94, 85.94] },
      { label: "Delete", widths: [103.45, 111.45] },
    ],
  },
  {
    content: "submenu",
    rows: [
      { label: "New tab", widths: [67.47, 75.47] },
      { label: "New window", widths: [95.47, 103.47] },
      { label: "Share", widths: [75.69, 83.69] },
    ],
  },
];

/** The popup's content box at its minimum. */
const MINIMUM = 128 - 2 * 4;

/** The submenu's rows, measured as the popup's are. */
const SUBMENU: Measured = {
  content: "submenu",
  rows: [
    { label: "Email link", widths: [75.78, 83.78] },
    { label: "Copy link", widths: [72.63, 80.63] },
    { label: "Messages", widths: [80.23, 88.23] },
  ],
};

/** The label of the row a demo draws widest, at both densities alike. */
function widestOf({ rows: measured }: Measured): string {
  const [dense, comfortable] = [0, 1].map(
    (density) =>
      measured.reduce((best, next) =>
        (next.widths[density] ?? 0) > (best.widths[density] ?? 0) ? next : best
      ).label
  );
  if (dense !== comfortable) {
    throw new Error(
      `the measurements name ${String(dense)} widest dense and ${String(comfortable)} comfortable`
    );
  }
  return dense ?? "";
}

/** The label of each row instance a box holds that hugs across, at any depth, with its minimum width. */
function hugging(box: BoxSpec): readonly (readonly [string, unknown])[] {
  return rows(box).flatMap(([label, layer]) =>
    layer.sizing.horizontal.kind === "hug" ? [[label, layer.minWidth] as const] : []
  );
}

/** The label of each row instance a box holds, at any depth, with its layer. */
function rows(box: BoxSpec): readonly (readonly [string, InstanceLayerSpec])[] {
  return box.children.flatMap((layer: ChildLayerSpec): readonly (readonly [string, InstanceLayerSpec])[] => {
    if (layer.kind === "frame") {
      return rows(layer);
    }
    if (layer.kind !== "instance" || !/item|sub-trigger/.test(layer.componentSet)) {
      return [];
    }
    const label =
      layer.properties?.text?.Label ??
      (layer.componentSet === "dropdown-menu-sub-trigger" ? "Share" : "Profile");
    return [[label, layer]];
  });
}

describe("the Dropdown menu popup component set", () => {
  it("holds the five docs demos' popups", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "dropdown-menu-popup");
    expect([set?.page, set?.axes]).toEqual([
      "page/dropdown-menu",
      [{ name: "content", values: ["basic", "checkboxes", "radio", "destructive", "submenu"] }],
    ]);
  });

  it.each(MEASURED.map((demo) => [demo.content, demo] as const))(
    "hugs in %s only the widest row, from the popup's 120px content minimum",
    (content, demo) => {
      expect(hugging(variantRoot(spec, `dropdown-menu-popup/content=${content}`))).toEqual([
        [widestOf(demo), literal(MINIMUM)],
      ]);
    }
  );

  it("draws the surface hugging its rows from the 128px minimum, the runs between separators in sections", () => {
    const root = variantRoot(spec, "dropdown-menu-popup/content=basic");
    expect(root).toMatchObject({
      sizing: { horizontal: HUG, vertical: HUG },
      limits: { minWidth: literal(128) },
      paddingLeft: literal(0),
      paddingRight: literal(0),
      fill: paint("popover"),
      clips: true,
    });
    expect(
      root.children.map((layer) => [layer.name, "sizing" in layer ? layer.sizing.horizontal : layer.kind])
    ).toEqual([
      ["section", HUG],
      ["menu-separator", FILL],
      ["section", FILL],
    ]);
  });
});

describe("the Dropdown menu sub content component set", () => {
  // Messages measured 80.23px dense and 88.23px comfortable against an 88px content minimum, so it
  // fills to the minimum at dense and hugs past it at comfortable, where filling would wrap it (PH3).
  it("hugs its widest row from the submenu's 88px content minimum", () => {
    const root = variantRoot(spec, "dropdown-menu-sub-content/content=submenu");
    expect([root.limits.minWidth, hugging(root)]).toEqual([
      literal(96),
      [[widestOf(SUBMENU), literal(96 - 2 * 4)]],
    ]);
  });
});

describe("the Dropdown menu (open) component set", () => {
  it("packs the expanded trigger and the Basic demo's popup at its start, 4px apart", () => {
    const root = variantRoot(spec, "dropdown-menu-open/placement=below");
    expect([root.direction, root.counterAlign, root.itemSpacing, root.clips]).toEqual([
      "VERTICAL",
      "MIN",
      literal(4),
      false,
    ]);
    const [trigger, popup] = root.children;
    expect(trigger).toMatchObject({
      kind: "instance",
      variant: "button/variant=outline,size=default,state=rest,icon=none",
      overrides: [{ path: [], field: "fill", color: paint("muted") }],
    });
    expect(popup).toMatchObject({ kind: "instance", variant: "dropdown-menu-popup/content=basic" });
  });
});
