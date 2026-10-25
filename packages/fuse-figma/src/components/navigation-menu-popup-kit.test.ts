/**
 * Unit under test: the `Navigation menu popup` set as the build produces it. Oracle: the Figma field
 * each cell must carry, read by hand from `navigation-menu-variants.ts`, `inner-corner/navigation.ts`
 * and `overlay-classes.ts`, Tailwind's `shadow-md` and `ring-1`, and the docs Basic demo:
 *
 * - The popup is `bg-popover`, `rounded-md`, `shadow-md` and a 1px `foreground/10` ring, as wide as
 *   Base UI measures its content: the demo's list, `w-64` (256px) or `w-72` (288px), plus
 *   `surface-pad-sm` on each side, 4px at both densities, so 264px and 296px. Its height is the
 *   content's, which hugs. Chromium measured the popups on the compare page on 2026-10-25 at 264 × 112
 *   and 296 × 76 dense, and 264 × 124 and 296 × 84 comfortable.
 * - The viewport is `relative size-full overflow-hidden`: as wide as the popup, as tall as the content
 *   (CSS 2.1 §10.5), clipping. The content pads by `surface-pad-sm`, `w-auto`, `h-full`,
 *   `overflow-auto`.
 * - The list is `grid w-64 gap-1` or `grid w-72 gap-1`: one column whose rows stretch across it, 4px
 *   apart. Each `<li>` is a block box holding a row link, which fills it.
 * - A row link inside the popup rounds with `rounded-inner`, the content's published corner,
 *   `radius-md` less `surface-pad-sm`, and inherits the popup's `popover-foreground`.
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
import type { ChildLayerSpec, InstanceLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** The first layer of a frame, down the given number of levels. */
function descend(layer: ChildLayerSpec | undefined, levels: number): ChildLayerSpec | undefined {
  if (levels === 0 || layer?.kind !== "frame") {
    return levels === 0 ? layer : undefined;
  }
  return descend(layer.children[0], levels - 1);
}

/** The popup's list: the viewport's content's first layer. */
function listOf(content: string) {
  const list = descend(variantRoot(spec, `navigation-menu-popup/content=${content}`).children[0], 2);
  if (list?.kind !== "frame") {
    throw new Error(`the ${content} popup draws no list`);
  }
  return list;
}

/** The row link instance each `<li>` of a list holds. */
function linksOf(content: string): readonly InstanceLayerSpec[] {
  return listOf(content).children.map((item) => {
    const link = descend(item, 1);
    if (link?.kind !== "instance") {
      throw new Error(`an item of the ${content} popup holds no instance`);
    }
    return link;
  });
}

describe("the Navigation menu popup component set", () => {
  it("holds the Basic demo's two popups on the Navigation menu page", () => {
    const popup = spec.componentSets.find((candidate) => candidate.key === "navigation-menu-popup");
    expect([popup?.name, popup?.page, popup?.axes, popup?.columnAxis]).toEqual([
      "Navigation menu popup",
      "page/navigation-menu",
      [{ name: "content", values: ["customers", "business"] }],
      "content",
    ]);
  });

  it.each([
    ["customers", 264],
    ["business", 296],
  ])("draws the %s popup on the shared surface, %ipx wide and as tall as its content", (content, width) => {
    expect(variantRoot(spec, `navigation-menu-popup/content=${content}`)).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(width)), vertical: HUG },
      clips: true,
      fill: paint("popover"),
      cornerRadius: token("radius-md"),
      shadows: [
        {
          color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
          offsetX: 0,
          offsetY: 2,
          radius: literal(4),
          spread: literal(-2),
        },
        {
          color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
          offsetX: 0,
          offsetY: 4,
          radius: literal(6),
          spread: literal(-1),
        },
        { color: paint("foreground/10"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(1) },
      ],
    });
  });

  it("clips the viewport and the content, which fill the popup across and hug its height, the content padding its list", () => {
    const viewport = variantRoot(spec, "navigation-menu-popup/content=customers").children[0];
    const content = descend(viewport, 1);
    expect([viewport, content]).toEqual([
      expect.objectContaining({ sizing: { horizontal: FILL, vertical: HUG }, clips: true }),
      expect.objectContaining({
        sizing: { horizontal: FILL, vertical: HUG },
        clips: true,
        paddingTop: density("surface-pad-sm"),
        paddingRight: density("surface-pad-sm"),
        paddingBottom: density("surface-pad-sm"),
        paddingLeft: density("surface-pad-sm"),
      }),
    ]);
  });

  it.each([
    ["customers", 256, ["Electricity", "Solar panels", "Home charging"]],
    ["business", 288, ["Power contracts", "Energy reporting"]],
  ])("stacks the %s list's rows 4px apart across its %ipx", (content, width, labels) => {
    const list = listOf(content);
    expect(list).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(width)), vertical: HUG },
      itemSpacing: literal(4),
      primaryAlign: "MIN",
      counterAlign: "MIN",
    });
    expect(list.children.map((item) => (item.kind === "frame" ? item.sizing.horizontal : undefined))).toEqual(
      labels.map(() => FILL)
    );
    // An instance carries a label only where it differs from the row link set's default, `Electricity`.
    expect(linksOf(content).map((link) => link.properties?.text?.Label ?? "Electricity")).toEqual(labels);
  });

  it.each(["customers", "business"])(
    "draws each %s row as a row link at rest that fills its item, with the popup's inner corner and text color",
    (content) => {
      for (const link of linksOf(content)) {
        expect(link).toMatchObject({
          componentSet: "navigation-menu-row-link",
          variant: "navigation-menu-row-link/state=rest,active=off",
          sizing: { horizontal: FILL, vertical: HUG },
          exposed: true,
          overrides: [
            { path: [], field: "cornerRadius", value: density("radius-inner/md-pad-sm") },
            { path: ["text"], field: "textColor", color: paint("popover-foreground") },
          ],
        });
      }
    }
  );
});
