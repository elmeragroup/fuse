/**
 * Unit under test: Sidebar's section sets as the build produces them. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `sidebarSectionClass`,
 * `sidebarGroupClass`, `sidebarMenuClass`, `sidebarMenuItemClass`, `sidebarMenuSubClass` and
 * `sidebarInputClass` in `sidebar-class.ts`, the sub row's `-translate-x-px`, the section shell in `inner-corner/sidebar.ts`, the menu button's `row-h` and
 * `size-8!` rail square in `sidebar-variants.ts`, the badge's offsets there, Tailwind's spacing scale,
 * and the docs demos' rows:
 *
 * - A section is 256px wide, the docs' 16rem Sidebar, padded `row-px` all round, or 8px collapsed
 *   (`group-data-[collapsible=icon]:p-2`). The header and footer space their rows 8px apart (`gap-2`);
 *   the group and its menu stack theirs with no gap.
 * - The group holds the label, a 32px row that fills the group, then the five rows of the icon collapse
 *   demo, each filling its menu at `row-h`, `Orders` active. Collapsed, the label's `-mt-8 opacity-0`
 *   takes it out, and each row is the rail's 32px square.
 * - The header's input fills it at `row-h` (`h-(--row-h)`) on the `background` fill with no shadow
 *   (`bg-background shadow-none`), where the Input set draws `control-h-md` on `card` with its shadow.
 * - The footer's large row is 48px tall, or the rail's 32px square collapsed.
 * - The sub menu sits in a 240px row less its `mx-3.5`, 212px, padded 2px down (`py-0.5`) and 10px
 *   across (`px-2.5`), behind a 1px left border in `sidebar-border` (`border-l`), its rows 4px apart
 *   (`gap-1`). Each row is `-translate-x-px`, which moves it 1px left over the padding, so the paddings
 *   draw 9px left and 11px right. The rows fill it at `control-h-md`, or `control-h-sm` at `sm`.
 * - The item is 240px wide and holds its row at `row-h` and its badge, 20px tall (`h-5`), 4px from the
 *   item's end (`right-1`), its centre on the row's at both densities
 *   (`top-[calc(var(--row-h)/2-0.625rem)]`).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, FILL, fixed, HUG, literal, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import { layerAt } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const ROW_H = fixed(density("row-h"));
const SQUARE = { horizontal: fixed(literal(32)), vertical: fixed(literal(32)) };

/** The root's paddings, top, right, bottom, left, and its gap. */
function spacing(root: ComponentRootSpec) {
  return [root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft, root.itemSpacing];
}

/** An instance layer's variant, sizing, property values and overrides. */
function instanceOf(layer: BoxSpec | ChildLayerSpec | undefined) {
  return layer !== undefined && "kind" in layer && layer.kind === "instance"
    ? {
        variant: layer.variant,
        sizing: layer.sizing,
        properties: layer.properties,
        overrides: layer.overrides,
      }
    : undefined;
}

/** The instance layer at a key path below a root, as {@link instanceOf} reads it. */
const instanceAt = (root: ComponentRootSpec, path: readonly string[]) => instanceOf(layerAt(root, path));

/** The menu button variant a section's row shows. */
const button = (size: string, collapsed: string, active: string) =>
  `sidebar-menu-button/variant=default,size=${size},collapsed=${collapsed},active=${active},state=rest`;

describe("Sidebar's section sets", () => {
  it("lay out the group, the header, the footer, the sub menu and the item with badge on the Sidebar page", () => {
    const keys = [
      "sidebar-group",
      "sidebar-header",
      "sidebar-footer",
      "sidebar-menu-sub",
      "sidebar-menu-item-with-badge",
    ];
    const sets = keys.map((key) => spec.componentSets.find((set) => set.key === key));
    expect(sets.map((set) => [set?.name, set?.page, set?.axes])).toEqual([
      ["Sidebar group", "page/sidebar", [{ name: "collapsed", values: ["off", "on"] }]],
      ["Sidebar header", "page/sidebar", [{ name: "collapsed", values: ["off", "on"] }]],
      ["Sidebar footer", "page/sidebar", [{ name: "collapsed", values: ["off", "on"] }]],
      ["Sidebar sub menu", "page/sidebar", [{ name: "rows", values: ["3"] }]],
      ["Sidebar menu item with badge", "page/sidebar", [{ name: "active", values: ["off", "on"] }]],
    ]);
  });

  it("pad each section by row-px, or 8px in the rail, 256px wide", () => {
    const sections = ["sidebar-group", "sidebar-header", "sidebar-footer"];
    const roots = sections.flatMap((key) =>
      ["off", "on"].map((collapsed) => variantRoot(spec, `${key}/collapsed=${collapsed}`))
    );
    expect(roots.map((root) => root.sizing)).toEqual(
      roots.map(() => ({ horizontal: fixed(literal(256)), vertical: HUG }))
    );
    const rowPx = density("row-px");
    expect(roots.map(spacing)).toEqual([
      [rowPx, rowPx, rowPx, rowPx, literal(0)],
      [literal(8), literal(8), literal(8), literal(8), literal(0)],
      [rowPx, rowPx, rowPx, rowPx, literal(8)],
      [literal(8), literal(8), literal(8), literal(8), literal(8)],
      [rowPx, rowPx, rowPx, rowPx, literal(8)],
      [literal(8), literal(8), literal(8), literal(8), literal(8)],
    ]);
  });
});

describe("the Sidebar group", () => {
  /** The five rows' instances, below the group content, the menu and each item. */
  const rows = (root: ComponentRootSpec) =>
    ["dashboard", "orders", "customers", "invoices", "reports"].map((item) =>
      instanceAt(root, ["content", "menu", `item-${item}`, "button"])
    );

  it("holds the label and the demo's five rows, each filling its menu at row-h, Orders active", () => {
    const root = variantRoot(spec, "sidebar-group/collapsed=off");
    expect(instanceAt(root, ["label"])).toEqual({
      variant: "sidebar-group-label/state=rest",
      sizing: { horizontal: FILL, vertical: fixed(literal(32)) },
      properties: undefined,
      overrides: undefined,
    });
    const sizing = { horizontal: FILL, vertical: ROW_H };
    expect(rows(root)).toEqual([
      { variant: button("default", "off", "off"), sizing, properties: undefined, overrides: undefined },
      {
        variant: button("default", "off", "on"),
        sizing,
        properties: { text: { Label: "Orders" }, swap: { Icon: "icon/Package" } },
        overrides: undefined,
      },
      {
        variant: button("default", "off", "off"),
        sizing,
        properties: { text: { Label: "Customers" }, swap: { Icon: "icon/Users" } },
        overrides: undefined,
      },
      {
        variant: button("default", "off", "off"),
        sizing,
        properties: { text: { Label: "Invoices" }, swap: { Icon: "icon/Receipt" } },
        overrides: undefined,
      },
      {
        variant: button("default", "off", "off"),
        sizing,
        properties: { text: { Label: "Reports" }, swap: { Icon: "icon/ChartBar" } },
        overrides: undefined,
      },
    ]);
  });

  it("draws no label in the rail, and each row as the rail's 32px square", () => {
    const root = variantRoot(spec, "sidebar-group/collapsed=on");
    expect(root.children.map((child) => child.name)).toEqual(["sidebar-group-content"]);
    expect(rows(root).map((row) => [row?.variant, row?.sizing, row?.overrides])).toEqual([
      [button("default", "on", "off"), SQUARE, undefined],
      [button("default", "on", "on"), SQUARE, undefined],
      [button("default", "on", "off"), SQUARE, undefined],
      [button("default", "on", "off"), SQUARE, undefined],
      [button("default", "on", "off"), SQUARE, undefined],
    ]);
  });
});

describe("the Sidebar header", () => {
  it("fills with the input at row-h on the background fill, without its shadow", () => {
    for (const collapsed of ["off", "on"]) {
      expect(instanceAt(variantRoot(spec, `sidebar-header/collapsed=${collapsed}`), ["input"])).toEqual({
        variant: "input/content=placeholder,state=rest",
        sizing: { horizontal: FILL, vertical: ROW_H },
        properties: { text: { Text: "Search orders" } },
        overrides: [
          { path: [], field: "fill", color: token("background") },
          { path: [], field: "effects", shadows: [] },
        ],
      });
    }
  });
});

describe("the Sidebar footer", () => {
  it("holds the seller's large row, 48px tall, or the rail's 32px square", () => {
    const properties = { text: { Label: "Reodor Felgen" }, swap: { Icon: "icon/User" } };
    expect(
      ["off", "on"].map((collapsed) =>
        instanceAt(variantRoot(spec, `sidebar-footer/collapsed=${collapsed}`), ["menu", "item", "button"])
      )
    ).toEqual([
      {
        variant: button("lg", "off", "off"),
        sizing: { horizontal: FILL, vertical: fixed(literal(48)) },
        properties,
        overrides: undefined,
      },
      { variant: button("lg", "on", "off"), sizing: SQUARE, properties, overrides: undefined },
    ]);
  });
});

describe("the Sidebar sub menu", () => {
  it("draws the rows' 1px move left in its paddings, behind its left border", () => {
    const root = variantRoot(spec, "sidebar-menu-sub/rows=3");
    expect([root.sizing, root.direction]).toEqual([
      { horizontal: fixed(literal(212)), vertical: HUG },
      "VERTICAL",
    ]);
    expect([...spacing(root), root.stroke]).toEqual([
      literal(2),
      literal(11),
      literal(2),
      literal(9),
      literal(4),
      { color: token("sidebar-border"), sides: { top: 0, right: 0, bottom: 0, left: 1 } },
    ]);
    const sub = (size: string, active: string) =>
      `sidebar-menu-sub-button/size=${size},active=${active},state=rest`;
    expect(
      ["open", "shipped", "archived"].map((item) => instanceAt(root, [`item-${item}`, "button"]))
    ).toEqual([
      {
        variant: sub("md", "on"),
        sizing: { horizontal: FILL, vertical: fixed(density("control-h-md")) },
        properties: undefined,
        overrides: undefined,
      },
      {
        variant: sub("md", "off"),
        sizing: { horizontal: FILL, vertical: fixed(density("control-h-md")) },
        properties: { text: { Label: "Shipped" } },
        overrides: undefined,
      },
      {
        variant: sub("sm", "off"),
        sizing: { horizontal: FILL, vertical: fixed(density("control-h-sm")) },
        properties: { text: { Label: "Archived (small)" } },
        overrides: undefined,
      },
    ]);
  });
});

describe("the Sidebar menu item with badge", () => {
  it("holds its row at row-h and the badge 4px from its end, centred on the row", () => {
    const properties = { text: { Label: "Orders" }, swap: { Icon: "icon/Package" } };
    const items = ["off", "on"].map((active) =>
      variantRoot(spec, `sidebar-menu-item-with-badge/active=${active}`)
    );
    expect(items.map((item) => [item.sizing, item.direction])).toEqual([
      [{ horizontal: fixed(literal(240)), vertical: HUG }, "VERTICAL"],
      [{ horizontal: fixed(literal(240)), vertical: HUG }, "VERTICAL"],
    ]);
    expect(items.map((item) => item.children.map(instanceOf))).toEqual([
      [
        {
          variant: button("default", "off", "off"),
          sizing: { horizontal: FILL, vertical: ROW_H },
          properties,
          overrides: undefined,
        },
        {
          variant: "sidebar-menu-badge/state=rest",
          sizing: { horizontal: HUG, vertical: fixed(literal(20)) },
          properties: undefined,
          overrides: undefined,
        },
      ],
      [
        {
          variant: button("default", "off", "on"),
          sizing: { horizontal: FILL, vertical: ROW_H },
          properties,
          overrides: undefined,
        },
        {
          variant: "sidebar-menu-badge/state=active",
          sizing: { horizontal: HUG, vertical: fixed(literal(20)) },
          properties: undefined,
          overrides: undefined,
        },
      ],
    ]);
    expect(
      items.map(({ children: [, badge] }) => (badge?.kind === "instance" ? badge.absolute : undefined))
    ).toEqual([
      { constraints: { horizontal: "MAX", vertical: "CENTER" }, endInset: 4, centerOffset: 0 },
      { constraints: { horizontal: "MAX", vertical: "CENTER" }, endInset: 4, centerOffset: 0 },
    ]);
  });

  it("names the badge as what its relative anchors, and draws the badge's other sizes nowhere", () => {
    const rows = coverage.filter((row) => row.component === "Sidebar menu item with badge");
    expect(rows.filter((row) => row.className === "relative").map((row) => row.detail)).toEqual([
      "it anchors the absolute instance it holds, whose MAX × CENTER constraints place it against this frame (N11)",
    ]);
    expect(rows.filter((row) => row.className.includes("peer-data-[size="))).toEqual([]);
  });
});
