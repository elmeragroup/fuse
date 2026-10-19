/**
 * `planSizing` against a hand-made stand-in for an auto layout frame. The stand-in models the
 * Figma rule the planner exists for: `resize` turns both sizing modes to FIXED. The oracle is
 * the end state the spec asks for, a fixed height with a hugging width, and a second plan over
 * that state must list nothing.
 */
import { describe, expect, it } from "vitest";

import { near, planNumber, planSizing } from "./fields.ts";
import type { Run, SizingModes } from "./fields.ts";
import { changeLines, newPlan, performPlan } from "./plan.ts";

/** The fields of an auto layout frame that its height and sizing modes touch. */
type FrameStandIn = Pick<FrameNode, "boundVariables" | "resize" | "setBoundVariable"> & {
  width: number;
  height: number;
  primaryAxisSizingMode: FrameNode["primaryAxisSizingMode"];
  counterAxisSizingMode: FrameNode["counterAxisSizingMode"];
};

/** A root that hugs the row and keeps a fixed height, as a Button does. */
const BUTTON_MODES: SizingModes = { primary: "AUTO", counter: "FIXED" };

function frameStandIn(height: number, modes: SizingModes): FrameStandIn {
  const frame: FrameStandIn = {
    width: 80,
    height,
    primaryAxisSizingMode: modes.primary,
    counterAxisSizingMode: modes.counter,
    boundVariables: {},
    resize: (width, nextHeight) => {
      frame.width = width;
      frame.height = nextHeight;
      frame.primaryAxisSizingMode = "FIXED";
      frame.counterAxisSizingMode = "FIXED";
    },
    setBoundVariable: () => undefined,
  };
  return frame;
}

/** Plan a 32px literal height on the stand-in and return the plan's change lines. */
function planButtonHeight(standIn: FrameStandIn): ReturnType<typeof newPlan> {
  const plan = newPlan();
  // SAFETY: a literal height reads neither the plugin API nor the file's variables, which are
  // all a run adds to its plan.
  const run = { plan } as Run;
  // SAFETY: with a literal height, `planSizing` reads and writes only the stand-in's fields.
  const frame = standIn as FrameNode;
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

describe("planSizing", () => {
  it("writes the sizing modes again after a height write resets them", async () => {
    const standIn = frameStandIn(24, BUTTON_MODES);
    const plan = planButtonHeight(standIn);
    expect(changeLines(plan)).toEqual(["Button: height → 32"]);

    await performPlan(plan);
    expect(standIn.height).toBe(32);
    expect(standIn.primaryAxisSizingMode).toBe("AUTO");
    expect(standIn.counterAxisSizingMode).toBe("FIXED");
    expect(changeLines(planButtonHeight(standIn))).toEqual([]);
  });

  it("lists a sizing mode that differs already on the same line as the height", async () => {
    const standIn = frameStandIn(24, { primary: "FIXED", counter: "FIXED" });
    const plan = planButtonHeight(standIn);
    expect(changeLines(plan)).toEqual(["Button: height → 32, primaryAxisSizingMode → AUTO"]);

    await performPlan(plan);
    expect(changeLines(planButtonHeight(standIn))).toEqual([]);
  });

  it("plans nothing for a frame that already matches", () => {
    expect(changeLines(planButtonHeight(frameStandIn(32, BUTTON_MODES)))).toEqual([]);
  });
});
