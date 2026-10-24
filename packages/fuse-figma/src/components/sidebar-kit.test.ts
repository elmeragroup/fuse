/**
 * Unit under test: Sidebar's four row sets as the build produces them. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `sidebarMenuButtonVariants` and
 * `sidebarMenuSubButtonVariants` in `sidebar-variants.ts`, the group label and badge strings in
 * `sidebar-class.ts`, the row shell in `inner-corner/sidebar.ts`, the focus ring in `styles/utils.ts`,
 * the state face in `state-face.ts`, Tailwind's spacing and type scales, and the docs demos' rows:
 *
 * - A menu row is a 240px row, the docs' 16rem Sidebar inside a group's dense 8px row inset. At the
 *   default size it is `row-h` tall, padded `row-px` across and 8px down, and at `sm` and `lg` 28px
 *   and 48px tall, padded 8px all round. It holds the 16px House and `Dashboard`, 14/20 or 12/16 at
 *   `sm`, 8px apart, on `rounded-md`. The label fills the room the row leaves it and ends in an
 *   ellipsis after one line, through `[&>span:last-child]:truncate`. The row takes the Sidebar's
 *   `sidebar-foreground`, `outline` fills `background` inside a 1px `sidebar-border` ring, hover and
 *   active fill `sidebar-accent` under `sidebar-accent-foreground`, active sets the label Medium, focus
 *   draws the 2px `ring`, and disabled dims to 50%. Collapsed, `size-8!` and `p-2!` make every row a
 *   32px square padded 8px, `lg`'s `p-0!` unpadded, and the row packs its layers at its start.
 * - A sub row is 191px wide, `control-h-md` tall at `md` with the control type pair, and
 *   `control-h-sm` at `sm` with 14/20, padded 8px across, holding `Open` in `sidebar-foreground`.
 * - The group label is a 240 by 32 row padded `row-px` across, holding `Navigation` at 12/16 Medium in
 *   `sidebar-foreground` at 70%.
 * - The badge is 20px tall and at least 20px wide, hugging `12` at 12/16 Medium padded 4px across,
 *   in `sidebar-foreground`, or `sidebar-accent-foreground` beside a hovered or active menu button.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  literal,
  paint,
  token,
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

const STATES = ["rest", "hover", "focus", "disabled"];
const OFF_ON = ["off", "on"];

function menuButton(
  variant: string,
  size: string,
  collapsed: string,
  active: string,
  state: string
): ComponentRootSpec {
  return variantRoot(
    spec,
    `sidebar-menu-button/variant=${variant},size=${size},collapsed=${collapsed},active=${active},state=${state}`
  );
}

function subButton(size: string, active: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `sidebar-menu-sub-button/size=${size},active=${active},state=${state}`);
}

/** The set with a key. */
function setOf(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** The root's paddings, top, right, bottom, left. */
function paddings(root: ComponentRootSpec) {
  return [root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft];
}

/** The text layer a root holds. */
function textOf(root: ComponentRootSpec) {
  return root.children.find((child) => child.kind === "text");
}

/** The 2px ring the focus ring draws around a focused row. */
const FOCUS_RING = { color: paint("ring"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(2) };

/** A 1px ring of a color, as the outline row's `shadow-[0_0_0_1px_…]` draws. */
const outlineRing = (color: string) => ({
  color: paint(color),
  offsetX: 0,
  offsetY: 0,
  radius: literal(0),
  spread: literal(1),
});

describe("Sidebar's row sets", () => {
  it("lay out the menu button, the sub button, the group label and the badge on the Sidebar page", () => {
    const sets = [
      "sidebar-menu-button",
      "sidebar-menu-sub-button",
      "sidebar-group-label",
      "sidebar-menu-badge",
    ].map(setOf);
    expect(sets.map((set) => [set?.name, set?.page, set?.columnAxis, set?.variants.length])).toEqual([
      ["Sidebar menu button", "page/sidebar", "state", 96],
      ["Sidebar menu sub button", "page/sidebar", "state", 16],
      ["Sidebar group label", "page/sidebar", "state", 1],
      ["Sidebar menu badge", "page/sidebar", "state", 3],
    ]);
    expect(sets.map((set) => set?.axes)).toEqual([
      [
        { name: "variant", values: ["default", "outline"] },
        { name: "size", values: ["default", "sm", "lg"] },
        { name: "collapsed", values: OFF_ON },
        { name: "active", values: OFF_ON },
        { name: "state", values: STATES },
      ],
      [
        { name: "size", values: ["md", "sm"] },
        { name: "active", values: OFF_ON },
        { name: "state", values: STATES },
      ],
      [{ name: "state", values: ["rest"] }],
      [{ name: "state", values: ["rest", "hover", "active"] }],
    ]);
    expect(sets.map((set) => [set?.textProperties, set?.swapProperties])).toEqual([
      [[{ name: "Label", defaultValue: "Dashboard" }], [{ name: "Icon", defaultIcon: "icon/House" }]],
      [[{ name: "Label", defaultValue: "Open" }], []],
      [[{ name: "Label", defaultValue: "Navigation" }], []],
      [[{ name: "Count", defaultValue: "12" }], []],
    ]);
  });

  it("leave no Sidebar declaration unmapped", () => {
    const unmapped = coverage.filter(
      (row) => row.component.startsWith("Sidebar ") && row.outcome === "unmapped"
    );
    expect(unmapped).toEqual([]);
  });
});

describe("the Sidebar menu button", () => {
  it("draws the default row at rest as a 240px row of the House and its label", () => {
    const root = menuButton("default", "default", "off", "off", "rest");
    expect([root.direction, root.sizing, root.clips, root.primaryAlign, root.counterAlign]).toEqual([
      "HORIZONTAL",
      { horizontal: fixed(literal(240)), vertical: fixed(density("row-h")) },
      true,
      "MIN",
      "CENTER",
    ]);
    expect(paddings(root)).toEqual([literal(8), density("row-px"), literal(8), density("row-px")]);
    expect([root.itemSpacing, root.cornerRadius, root.fill, root.stroke, root.shadows, root.opacity]).toEqual(
      [literal(8), token("radius-md"), undefined, undefined, [], 1]
    );
    expect(root.children).toMatchObject([
      { kind: "icon", icon: "icon/House", size: literal(16), color: paint("sidebar-foreground") },
      {
        kind: "text",
        characters: "Dashboard",
        fontFamily: token("font-sans"),
        fontStyle: "Regular",
        fontSize: literal(14),
        lineHeight: literal(20),
        color: paint("sidebar-foreground"),
        sizing: { horizontal: FILL, vertical: HUG },
        align: { horizontal: "LEFT", vertical: "TOP" },
        truncation: { maxLines: 1 },
      },
    ]);
  });

  it.each([
    ["sm", literal(28), literal(8), literal(12), literal(16)],
    ["lg", literal(48), literal(8), literal(14), literal(20)],
  ])(
    "draws the %s row at its fixed height, padded 8px all round",
    (size, height, inset, fontSize, lineHeight) => {
      const root = menuButton("default", size, "off", "off", "rest");
      expect(root.sizing).toEqual({ horizontal: fixed(literal(240)), vertical: fixed(height) });
      expect(paddings(root)).toEqual([inset, inset, inset, inset]);
      expect(textOf(root)).toMatchObject({ fontSize, lineHeight });
    }
  );

  it.each([
    ["default", "rest", "off", undefined, [], "sidebar-foreground"],
    ["default", "hover", "off", paint("sidebar-accent"), [], "sidebar-accent-foreground"],
    ["default", "rest", "on", paint("sidebar-accent"), [], "sidebar-accent-foreground"],
    ["outline", "rest", "off", paint("background"), [outlineRing("sidebar-border")], "sidebar-foreground"],
    [
      "outline",
      "hover",
      "off",
      paint("sidebar-accent"),
      [outlineRing("sidebar-accent")],
      "sidebar-accent-foreground",
    ],
    ["default", "focus", "off", undefined, [FOCUS_RING], "sidebar-foreground"],
    // CSS paints the ring, the first shadow, above the 1px outline, and Figma paints the last effect
    // on top (PE2), so the ring comes last.
    [
      "outline",
      "focus",
      "off",
      paint("background"),
      [outlineRing("sidebar-border"), FOCUS_RING],
      "sidebar-foreground",
    ],
  ])(
    "fills the %s row at %s, active %s, and colors its icon and label",
    (variant, state, active, fill, shadows, color) => {
      const root = menuButton(variant, "default", "off", active, state);
      expect([root.fill, root.shadows]).toEqual([fill, shadows]);
      expect(
        root.children.map((child) => (child.kind === "text" || child.kind === "icon") && child.color)
      ).toEqual([paint(color), paint(color)]);
    }
  );

  it("sets an active row's label at Medium and dims a disabled row to 50%", () => {
    expect([
      textOf(menuButton("default", "default", "off", "on", "rest"))?.fontStyle,
      textOf(menuButton("default", "default", "off", "off", "rest"))?.fontStyle,
    ]).toEqual(["Medium", "Regular"]);
    expect([
      menuButton("default", "default", "off", "off", "disabled").opacity,
      menuButton("outline", "lg", "on", "on", "disabled").opacity,
    ]).toEqual([0.5, 0.5]);
  });

  it.each([
    ["default", "default", literal(8)],
    ["default", "sm", literal(8)],
    ["outline", "default", literal(8)],
    ["default", "lg", literal(0)],
  ])("collapses the %s %s row to the rail's 32px square", (variant, size, inset) => {
    const root = menuButton(variant, size, "on", "off", "rest");
    expect([root.sizing, root.primaryAlign, root.clips]).toEqual([
      { horizontal: fixed(literal(32)), vertical: fixed(literal(32)) },
      "MIN",
      true,
    ]);
    expect(paddings(root)).toEqual([inset, inset, inset, inset]);
  });

  it("drops the arms of a floating Sidebar and of a row beside a menu action", () => {
    const details = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Sidebar menu button" && row.className === className)
          .map((row) => `${row.outcome}: ${row.detail}`)
      );
    expect(
      details("in-data-[slot=sidebar-inner]:group-data-[variant=floating]:[:where(&)]:rounded-inner")
    ).toEqual(new Set(["dropped: a floating Sidebar, which no docs demo shows"]));
    expect(details("group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8")).toEqual(
      new Set(["dropped: a menu item that holds a menu action, which waits for a set of its own"])
    );
  });
});

describe("the Sidebar menu sub button", () => {
  it.each([
    ["md", density("control-h-md"), density("control-text"), density("control-leading")],
    ["sm", density("control-h-sm"), literal(14), literal(20)],
  ])(
    "draws the %s sub row 191px wide, padded 8px across, holding its label",
    (size, height, fontSize, lineHeight) => {
      const root = subButton(size, "off", "rest");
      expect([root.sizing, root.primaryAlign, root.cornerRadius, root.fill]).toEqual([
        { horizontal: fixed(literal(191)), vertical: fixed(height) },
        "MIN",
        token("radius-md"),
        undefined,
      ]);
      expect(paddings(root)).toEqual([literal(0), literal(8), literal(0), literal(8)]);
      expect(root.children).toMatchObject([
        {
          kind: "text",
          characters: "Open",
          fontStyle: "Regular",
          fontSize,
          lineHeight,
          color: paint("sidebar-foreground"),
          sizing: { horizontal: FILL, vertical: HUG },
          truncation: { maxLines: 1 },
        },
      ]);
    }
  );

  it("fills a hovered or active sub row, rings a focused one and dims a disabled one", () => {
    const faces = [
      subButton("md", "off", "hover"),
      subButton("md", "on", "rest"),
      subButton("md", "off", "focus"),
      subButton("md", "off", "disabled"),
    ].map((root) => [root.fill, root.shadows, root.opacity, textOf(root)?.color]);
    expect(faces).toEqual([
      [paint("sidebar-accent"), [], 1, paint("sidebar-accent-foreground")],
      [paint("sidebar-accent"), [], 1, paint("sidebar-accent-foreground")],
      [undefined, [FOCUS_RING], 1, paint("sidebar-foreground")],
      [undefined, [], 0.5, paint("sidebar-foreground")],
    ]);
  });
});

describe("the Sidebar group label", () => {
  it("draws a 240 by 32 row padded row-px across, holding its label in the muted sidebar text", () => {
    const root = variantRoot(spec, "sidebar-group-label/state=rest");
    expect([root.sizing, root.counterAlign, root.cornerRadius]).toEqual([
      { horizontal: fixed(literal(240)), vertical: fixed(literal(32)) },
      "CENTER",
      token("radius-md"),
    ]);
    expect(paddings(root)).toEqual([literal(0), density("row-px"), literal(0), density("row-px")]);
    expect(root.children).toMatchObject([
      {
        kind: "text",
        characters: "Navigation",
        fontStyle: "Medium",
        fontSize: literal(12),
        lineHeight: literal(16),
        color: paint("sidebar-foreground/70"),
      },
    ]);
  });
});

describe("the Sidebar menu badge", () => {
  it.each([
    ["rest", "sidebar-foreground"],
    ["hover", "sidebar-accent-foreground"],
    ["active", "sidebar-accent-foreground"],
  ])("hugs its count at %s, at least 20px wide, in %s", (state, color) => {
    const root = variantRoot(spec, `sidebar-menu-badge/state=${state}`);
    expect([root.sizing, root.limits.minWidth, root.primaryAlign, root.counterAlign]).toEqual([
      { horizontal: HUG, vertical: fixed(literal(20)) },
      literal(20),
      "CENTER",
      "CENTER",
    ]);
    expect(paddings(root)).toEqual([literal(0), literal(4), literal(0), literal(4)]);
    expect(root.children).toMatchObject([
      {
        kind: "text",
        characters: "12",
        fontStyle: "Medium",
        fontSize: literal(12),
        lineHeight: literal(16),
        color: paint(color),
        sizing: { horizontal: HUG, vertical: HUG },
      },
    ]);
  });

  it("drops the offset that places it in its menu item", () => {
    const rows = coverage.filter(
      (row) => row.component === "Sidebar menu badge" && ["position", "top", "right"].includes(row.property)
    );
    expect(new Set(rows.map((row) => `${row.className} ${row.outcome}`))).toEqual(
      new Set([
        "absolute dropped",
        "top-[calc(var(--row-h)/2-0.625rem)] dropped",
        "right-1 dropped",
        "peer-data-[size=lg]/menu-button:top-2.5 dropped",
        "peer-data-[size=sm]/menu-button:top-1 dropped",
      ])
    );
  });
});
