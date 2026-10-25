/**
 * Unit under test: the `Sidebar` panel set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `sidebarPanelVariants`'s
 * `container` and `inner` slots in `sidebar-variants.ts`, `sidebarContentClass` in
 * `sidebar-class.ts`, the Provider's `--sidebar-width: 16rem` and `--sidebar-width-icon: 3rem` in
 * `sidebar-width.ts`, and the app frame demo's `h-[28rem]` frame and `className="h-full"`:
 *
 * - The container is 256px wide (`w-(--sidebar-width)`), or 48px in the icon rail
 *   (`group-data-[collapsible=icon]:w-(--sidebar-width-icon)`), and 448px tall (`h-full` of the 28rem
 *   frame). It pads nothing and draws a 1px end border in `sidebar-border`
 *   (`border-sidebar-border group-data-[side=left]:border-r`), and it lays its surface out in a row
 *   (`md:flex`).
 * - The surface fills it and stacks its sections (`flex size-full flex-col`) on the `sidebar` fill.
 * - The header and footer hug their height, and the content takes the rest (`flex-1`), clipping
 *   what overflows it (`overflow-auto`, or `overflow-hidden` in the rail) and stacking its group and
 *   separator (`flex-col gap-0`). Each section fills the surface across, as a stretched flex item does.
 * - The separator is 1px tall (`data-horizontal:h-px`) and as wide as the content
 *   (`data-horizontal:w-full`, which `w-auto` does not beat) past its 8px start margin (`mx-2`), so the
 *   content's clip cuts its end: Chromium draws it 255px wide at x 8 in the 255px content, showing
 *   247px, or 39px of the rail's 47px. It fills a frame padded 8px at the start in `sidebar-border`.
 * - `inset` pads the container 8px on every side with no border (`p-2`), 66px wide in the rail
 *   (`calc(var(--sidebar-width-icon)+(--spacing(4))+2px)`), on the `sidebar` fill the Provider's
 *   wrapper paints behind it (`has-data-[variant=inset]:bg-sidebar`). Chromium draws its surface 240px
 *   wide, or 50px in the rail.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, FILL, fixed, HUG, literal, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import { layerAt } from "./kit-spec";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

/** A frame layer's direction, sizing, paddings, gap, clipping and fill, at a key path below a root. */
function frameAt(root: ComponentRootSpec, path: readonly string[]) {
  const layer = layerAt(root, path);
  return layer !== undefined && "kind" in layer && layer.kind === "frame"
    ? {
        direction: layer.direction,
        sizing: layer.sizing,
        padding: [layer.paddingTop, layer.paddingRight, layer.paddingBottom, layer.paddingLeft],
        gap: layer.itemSpacing,
        clips: layer.clips,
        fill: layer.fill,
      }
    : undefined;
}

/** An instance layer's variant, sizing, property values and overrides, at a key path below a root. */
function instanceAt(root: ComponentRootSpec, path: readonly string[]) {
  const layer = layerAt(root, path);
  return layer !== undefined && "kind" in layer && layer.kind === "instance"
    ? {
        variant: layer.variant,
        sizing: layer.sizing,
        properties: layer.properties,
        overrides: layer.overrides,
      }
    : undefined;
}

const NONE = [literal(0), literal(0), literal(0), literal(0)];

/** A section instance at a variant, filling the surface across and hugging its height. */
const section = (variant: string) => ({
  variant,
  sizing: { horizontal: FILL, vertical: HUG },
  properties: undefined,
  overrides: undefined,
});

describe("the Sidebar panel", () => {
  it("lays out the sidebar and inset variants, expanded and collapsed, on the Sidebar page", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "sidebar");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Sidebar",
      "page/sidebar",
      [
        { name: "variant", values: ["sidebar", "inset"] },
        { name: "collapsed", values: ["off", "on"] },
      ],
    ]);
  });

  it.each([
    { collapsed: "off", width: 256 },
    { collapsed: "on", width: 48 },
  ])(
    "draws the rail $width px wide and the frame's 448px tall, behind its end border",
    ({ collapsed, width }) => {
      const root = variantRoot(spec, `sidebar/variant=sidebar,collapsed=${collapsed}`);
      expect([
        root.direction,
        root.sizing,
        [root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft],
      ]).toEqual(["HORIZONTAL", { horizontal: fixed(literal(width)), vertical: fixed(literal(448)) }, NONE]);
      expect(root.stroke).toEqual({
        color: token("sidebar-border"),
        sides: { top: 0, right: 1, bottom: 0, left: 0 },
      });
      expect([root.fill, root.shadows]).toEqual([undefined, []]);
    }
  );

  it.each(["off", "on"])("stacks the sections on the sidebar fill, collapsed=%s", (collapsed) => {
    const root = variantRoot(spec, `sidebar/variant=sidebar,collapsed=${collapsed}`);
    expect(frameAt(root, ["inner"])).toEqual({
      direction: "VERTICAL",
      sizing: { horizontal: FILL, vertical: FILL },
      padding: NONE,
      gap: literal(0),
      clips: false,
      fill: token("sidebar"),
    });
    expect(frameAt(root, ["inner", "content"])).toEqual({
      direction: "VERTICAL",
      sizing: { horizontal: FILL, vertical: FILL },
      padding: NONE,
      gap: literal(0),
      clips: true,
      fill: undefined,
    });
    expect([
      instanceAt(root, ["inner", "header"]),
      instanceAt(root, ["inner", "content", "group"]),
      instanceAt(root, ["inner", "footer"]),
    ]).toEqual([
      section(`sidebar-header/collapsed=${collapsed}`),
      section(`sidebar-group/collapsed=${collapsed}`),
      section(`sidebar-footer/collapsed=${collapsed}`),
    ]);
  });

  it.each(["off", "on"])(
    "draws the separator filling a frame padded 8px at the start, collapsed=%s",
    (collapsed) => {
      const root = variantRoot(spec, `sidebar/variant=sidebar,collapsed=${collapsed}`);
      expect(frameAt(root, ["inner", "content", "separator"])).toEqual({
        direction: "VERTICAL",
        sizing: { horizontal: FILL, vertical: HUG },
        padding: [literal(0), literal(0), literal(0), literal(8)],
        gap: literal(0),
        clips: false,
        fill: undefined,
      });
      const line = layerAt(root, ["inner", "content", "separator", "box"]);
      expect(
        line !== undefined && "kind" in line && line.kind === "frame" ? [line.sizing, line.fill] : undefined
      ).toEqual([{ horizontal: FILL, vertical: fixed(literal(1)) }, token("sidebar-border")]);
    }
  );

  it.each([
    { collapsed: "off", width: 256 },
    { collapsed: "on", width: 66 },
  ])("pads the inset rail 8px, $width px wide, on the sidebar fill behind it", ({ collapsed, width }) => {
    const root = variantRoot(spec, `sidebar/variant=inset,collapsed=${collapsed}`);
    const eight = literal(8);
    expect([
      root.sizing,
      [root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft],
      root.stroke,
      root.fill,
    ]).toEqual([
      { horizontal: fixed(literal(width)), vertical: fixed(literal(448)) },
      [eight, eight, eight, eight],
      undefined,
      token("sidebar"),
    ]);
    expect(frameAt(root, ["inner"])?.sizing).toEqual({ horizontal: FILL, vertical: FILL });
  });

  it("resolves the rail widths through the Provider's style to literals", () => {
    const widths = coverage
      .filter(
        (row) => row.component === "Sidebar" && row.part === "sidebar-container" && row.property === "width"
      )
      .map((row) => [row.className, row.outcome, row.detail]);
    expect(widths).toEqual([
      ["w-(--sidebar-width)", "literal", "256px"],
      ["group-data-[collapsible=icon]:w-(--sidebar-width-icon)", "literal", "48px"],
      [
        "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]",
        "literal",
        "66px",
      ],
    ]);
  });
});
