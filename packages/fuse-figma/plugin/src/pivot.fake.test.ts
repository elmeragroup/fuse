/**
 * Unit under test: `planPivotPositioning` and `planPivotPlace` through Apply, on the in-memory file in
 * `fake-figma.ts`, for the Tooltip arrow on each edge of its popup. Oracles, written by hand from
 * Tooltip's CSS: the arrow is a 10px square, and on the `top` side `bottom: -10px` with a translate
 * of `calc(-50% - 2px)` puts its centre 2px above the popup's bottom edge; on `bottom`, `top: 4px`
 * with the same translate puts it 2px below the top edge; on `left`, `right: -4px` puts it 1px inside
 * the right edge, and on `right`, `left: -4px` 1px inside the left edge, each centred along the edge.
 * The constraints keep that place: CENTER along the edge, and MIN for a top or left edge, MAX for a
 * bottom or right one. The centre is read from the layer's `x`, `y`, turn and size through Figma's
 * transform `[[cos r, sin r, x], [-sin r, cos r, y]]` (PQ), and again after the popup grows by an
 * even width and height, so the constraints, not the first write, keep it.
 */
import { describe, expect, it } from "vitest";

import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";

/** Each side's arrow: its constraints and its centre in a popup of `width` × `height`. */
const SIDES = [
  {
    side: "top",
    constraints: { horizontal: "CENTER", vertical: "MAX" },
    centre: (width: number, height: number) => ({ x: width / 2, y: height - 2 }),
  },
  {
    side: "bottom",
    constraints: { horizontal: "CENTER", vertical: "MIN" },
    centre: (width: number) => ({ x: width / 2, y: 2 }),
  },
  {
    side: "left",
    constraints: { horizontal: "MAX", vertical: "CENTER" },
    centre: (width: number, height: number) => ({ x: width - 1, y: height / 2 }),
  },
  {
    side: "right",
    constraints: { horizontal: "MIN", vertical: "CENTER" },
    centre: (_width: number, height: number) => ({ x: 1, y: height / 2 }),
  },
] as const;

/** Every layer below a node, depth first. */
function layersBelow(node: BaseNode): readonly BaseNode[] {
  return "children" in node ? node.children.flatMap((child) => [child, ...layersBelow(child)]) : [];
}

/** A turned frame's centre, from its origin, turn and size. */
function centreOf(frame: FrameNode) {
  const radians = (frame.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: frame.x + (cos * frame.width) / 2 + (sin * frame.height) / 2,
    y: frame.y - (sin * frame.width) / 2 + (cos * frame.height) / 2,
  };
}

describe("a Tooltip arrow placed by its centre", () => {
  it.each(SIDES)(
    "hangs from the edge facing the trigger on the $side side, and keeps its place",
    async ({ side, constraints, centre }) => {
      const { kit } = await kitFixture();
      const key = kit.componentSets
        .find((each) => each.key === "tooltip-content")
        ?.variants.find((each) => each.properties.side === side)?.key;
      const file = await appliedFile();
      const set = setOn(await kitPage(file, "page/tooltip"), "Tooltip content");
      const variant = set.children.find((child) => key !== undefined && keyOf(child) === key);
      if (variant?.type !== "COMPONENT") {
        throw new Error(`Tooltip content holds no ${side} variant`);
      }
      const arrow = layersBelow(variant).find(
        (node) => node.type === "FRAME" && node.layoutPositioning === "ABSOLUTE"
      );
      if (arrow?.type !== "FRAME") {
        throw new Error(`the ${side} variant holds no absolute arrow`);
      }
      expect([arrow.constraints, arrow.rotation]).toEqual([constraints, -45]);
      const placed = centre(variant.width, variant.height);
      expect(centreOf(arrow).x).toBeCloseTo(placed.x, 3);
      expect(centreOf(arrow).y).toBeCloseTo(placed.y, 3);
      variant.resize(variant.width + 40, variant.height + 20);
      const grown = centre(variant.width, variant.height);
      expect(centreOf(arrow).x).toBeCloseTo(grown.x, 3);
      expect(centreOf(arrow).y).toBeCloseTo(grown.y, 3);
    }
  );
});
