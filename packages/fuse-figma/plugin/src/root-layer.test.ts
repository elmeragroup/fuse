/**
 * The box planner on the in-memory file in `fake-figma.ts`. `rootFill` is checked against what a
 * real file showed on 2026-10-20: Figma drew a focus ring's spread over a fill at alpha 0.001 and
 * not over a fill at alpha 0. The fill must also change no pixel, so it moves no 8-bit channel by
 * half a step. `planBox` is checked against one hand-written box, planned as a variant's root and
 * as a frame below it: the oracles are the change lines each needs from the node Figma creates,
 * the fields the file holds after Apply, and an empty second plan.
 */
import { describe, expect, it } from "vitest";

import type { BoxSpec, ShadowSpec } from "../../src/components/kit-spec.ts";
import { color, fixtureFile, fixtureRun, float } from "./fake-fixtures.ts";
import { changeLines, newPlan, performPlan } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { planBox, rootFill } from "./root-layer.ts";
import type { BoxRole } from "./root-layer.ts";

const RING: ShadowSpec = {
  color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
  offsetX: 0,
  offsetY: 0,
  radius: { kind: "literal", value: 0 },
  spread: { kind: "literal", value: 2 },
};

describe("rootFill", () => {
  it("gives a ringed root without a fill one that Figma counts and that shows nothing", () => {
    const fill = rootFill({ fill: undefined, shadows: [RING] });
    if (fill?.kind !== "literal") {
      throw new Error("a ringed root without a fill gets no literal fill");
    }
    expect(fill.color.a).toBeGreaterThanOrEqual(0.001);
    expect(fill.color.a * 255).toBeLessThan(0.5);
  });
});

/**
 * A 16px box that puts its content at the end of the row, centered across it, with a stroke, a
 * ring and no fill of its own.
 */
const BOX: BoxSpec = {
  width: { kind: "literal", value: 16 },
  height: { kind: "variable", variable: { collection: "Fuse density", name: "size-4" } },
  minWidth: undefined,
  paddingTop: { kind: "literal", value: 0 },
  paddingRight: { kind: "literal", value: 0 },
  paddingBottom: { kind: "literal", value: 0 },
  paddingLeft: { kind: "literal", value: 2 },
  itemSpacing: { kind: "literal", value: 4 },
  primaryAlign: "MAX",
  counterAlign: "CENTER",
  cornerRadius: { kind: "variable", variable: { collection: "Fuse tokens", name: "radius-sm" } },
  fill: undefined,
  stroke: {
    color: { kind: "variable", variable: { collection: "Fuse tokens", name: "primary" } },
    weight: { kind: "literal", value: 1 },
  },
  shadows: [RING],
  opacity: 0.5,
  children: [],
};

describe("planBox", () => {
  const file = fixtureFile([
    float("Fuse density", "size-4", 16),
    float("Fuse tokens", "radius-sm", 4),
    color("Fuse tokens", "primary", { r: 0.1, g: 0.2, b: 0.6, a: 1 }),
    color("Fuse tokens", "ring", { r: 0.5, g: 0.5, b: 0.5, a: 1 }),
  ]);

  async function planOn(node: FrameNode | ComponentNode, label: string, role: BoxRole): Promise<Plan> {
    const plan = newPlan();
    planBox(await fixtureRun(file, plan), node, label, BOX, role);
    return plan;
  }

  /** The lines a root and a frame share, in planner order around the clip and the fill. */
  const shared = (label: string, clipAndFill: readonly string[]): string[] => [
    `${label}: layoutMode → HORIZONTAL`,
    `${label}: primaryAxisAlignItems → MAX`,
    `${label}: counterAxisAlignItems → CENTER`,
    `${label}: width → 16, height → size-4`,
    `${label}: paddingLeft → 2`,
    `${label}: itemSpacing → 4`,
    `${label}: cornerRadius → radius-sm`,
    ...clipAndFill,
    `${label}: stroke → primary (holds none)`,
    `${label}: strokesIncludedInLayout → true`,
    `${label}: shadows → ring 0 0 0 2 (holds none)`,
    `${label}: opacity → 0.5`,
  ];

  function expectBoxFields(node: FrameNode | ComponentNode): void {
    expect([node.layoutMode, node.primaryAxisAlignItems, node.counterAxisAlignItems]).toEqual([
      "HORIZONTAL",
      "MAX",
      "CENTER",
    ]);
    expect([node.width, node.height, node.primaryAxisSizingMode, node.counterAxisSizingMode]).toEqual([
      16,
      16,
      "FIXED",
      "FIXED",
    ]);
    expect([node.paddingLeft, node.itemSpacing, node.opacity]).toEqual([2, 4, 0.5]);
    expect(node.boundVariables?.topLeftRadius?.id).toBe(file.variable("Fuse tokens", "radius-sm").id);
  }

  it("draws a variant's root, which clips and takes a clear fill under its ring", async () => {
    const root = file.figma.createComponent();
    const plan = await planOn(root, "Radio", "root");
    expect(changeLines(plan)).toEqual(
      shared("Radio", [
        "Radio: clipsContent → true",
        "Radio: fill → #000000 at 0.15% (holds #ffffff at 100%)",
      ])
    );

    await performPlan(plan);
    expectBoxFields(root);
    expect(root.clipsContent).toBe(true);
    expect(root.fills).toMatchObject([{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]);
    // Figma stores the opacity as a 32-bit float.
    expect(root.fills !== file.figma.mixed && root.fills[0]?.opacity).toBeCloseTo(0.0015, 6);
    expect(changeLines(await planOn(root, "Radio", "root"))).toEqual([]);
  });

  it("draws a frame below the root, which shows its overflow and takes no fill the spec lacks", async () => {
    const root = file.figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    const frame = file.figma.createFrame();
    root.appendChild(frame);
    const plan = await planOn(frame, "Radio / Indicator", "frame");
    expect(changeLines(plan)).toEqual(
      shared("Radio / Indicator", [
        "Radio / Indicator: clipsContent → false",
        "Radio / Indicator: fill → none",
      ])
    );

    await performPlan(plan);
    expectBoxFields(frame);
    expect([frame.clipsContent, frame.fills]).toEqual([false, []]);
    expect(changeLines(await planOn(frame, "Radio / Indicator", "frame"))).toEqual([]);
  });
});
