/**
 * Field planners on the in-memory file in `fake-figma.ts`, each against the Figma rule it
 * exists for: `resize` turns both sizing modes of an auto layout frame to FIXED (rule 5), and a
 * paint bound to a color variable takes the variable's alpha as its opacity (rule 1). The
 * oracle is the end state the spec asks for, and a second plan over that state must list
 * nothing.
 */
import { describe, expect, it } from "vitest";

import { color, fixtureFile, fixtureRun } from "./fake-fixtures.ts";
import { near, planNumber, planPaints, planSizing } from "./fields.ts";
import type { SizingModes } from "./fields.ts";
import { changeLines, newPlan, performPlan } from "./plan.ts";
import type { Plan } from "./plan.ts";

/** A root that hugs the row and keeps a fixed height, as a Button does. */
const BUTTON_MODES: SizingModes = { primary: "AUTO", counter: "FIXED" };

/** An auto layout frame 80 wide, with the height and sizing modes given. */
function autoLayoutFrame(figma: PluginAPI, height: number, modes: SizingModes): FrameNode {
  const frame = figma.createFrame();
  frame.layoutMode = "HORIZONTAL";
  frame.resize(80, height);
  frame.primaryAxisSizingMode = modes.primary;
  frame.counterAxisSizingMode = modes.counter;
  return frame;
}

describe("planSizing", () => {
  const file = fixtureFile([]);

  /** Plan a 32px literal height on the frame. */
  async function planButtonHeight(frame: FrameNode): Promise<Plan> {
    const plan = newPlan();
    const run = await fixtureRun(file, plan);
    planSizing(
      run,
      frame,
      "Button",
      (group) =>
        planNumber(
          group,
          frame,
          "Button",
          {
            name: "height",
            bindings: ["height"],
            matches: (value) => near(frame.height, value),
            write: (value) => frame.resize(frame.width, value),
          },
          { kind: "literal", value: 32 }
        ),
      BUTTON_MODES
    );
    return plan;
  }

  it("writes the sizing modes again after a height write resets them", async () => {
    const frame = autoLayoutFrame(file.figma, 24, BUTTON_MODES);
    const plan = await planButtonHeight(frame);
    expect(changeLines(plan)).toEqual(["Button: height → 32"]);

    await performPlan(plan);
    expect(frame.height).toBe(32);
    expect(frame.primaryAxisSizingMode).toBe("AUTO");
    expect(frame.counterAxisSizingMode).toBe("FIXED");
    expect(changeLines(await planButtonHeight(frame))).toEqual([]);
  });

  it("lists a sizing mode that differs already on the same line as the height", async () => {
    const frame = autoLayoutFrame(file.figma, 24, { primary: "FIXED", counter: "FIXED" });
    const plan = await planButtonHeight(frame);
    expect(changeLines(plan)).toEqual(["Button: height → 32, primaryAxisSizingMode → AUTO"]);

    await performPlan(plan);
    expect(changeLines(await planButtonHeight(frame))).toEqual([]);
  });

  it("plans nothing for a frame that already matches", async () => {
    expect(changeLines(await planButtonHeight(autoLayoutFrame(file.figma, 32, BUTTON_MODES)))).toEqual([]);
  });
});

describe("planPaints", () => {
  it("matches a bound paint by its binding, since the paint's opacity is the variable's alpha", async () => {
    const file = fixtureFile([color("Fuse tokens", "error/10", { r: 0.8, g: 0.1, b: 0.1, a: 0.1 })]);
    const frame = file.figma.createFrame();
    frame.fills = [];
    const planFill = async (): Promise<Plan> => {
      const plan = newPlan();
      planPaints(
        await fixtureRun(file, plan),
        "Button",
        "fill",
        frame.fills,
        { kind: "variable", variable: { collection: "Fuse tokens", name: "error/10" } },
        (paints) => {
          frame.fills = paints;
        }
      );
      return plan;
    };

    const plan = await planFill();
    expect(changeLines(plan)).toEqual(["Button: fill → error/10 (holds none)"]);
    await performPlan(plan);
    const [fill] = frame.fills;
    expect(fill).toMatchObject({
      type: "SOLID",
      visible: true,
      blendMode: "NORMAL",
      boundVariables: { color: { type: "VARIABLE_ALIAS", id: file.variable("Fuse tokens", "error/10").id } },
    });
    expect(fill?.opacity).toBeCloseTo(0.1, 5);
    expect(changeLines(await planFill())).toEqual([]);
  });
});
