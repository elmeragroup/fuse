/**
 * Field planners on the in-memory file in `fake-figma.ts`, each against the Figma rule it
 * exists for: `resize` turns a hugging axis of an auto layout frame fixed (rules 5 and 14), a
 * paint bound to a color variable takes the variable's alpha as its opacity (rule 1), and an image
 * paint holds its image by the SHA-1 of its bytes, which storing the image writes (rules 22 and 23).
 * The oracle is the end state the spec asks for, the write log, and a second plan over that state,
 * which must list nothing.
 */

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { ImagePaintSpec } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { BLUE_PIXEL, color, fixtureFile, fixtureRun, RED_PIXEL } from "./fake-fixtures.ts";
import { near, planLayoutSizing, planNumber, planPaints } from "./fields.ts";
import type { LayoutSizing } from "./fields.ts";
import { changeLines, newPlan, performPlan } from "./plan.ts";
import type { PlanRecorder } from "./plan.ts";

/** A root that hugs the row and keeps a fixed height, as a Button does. */
const BUTTON_SIZING: LayoutSizing = { horizontal: "HUG", vertical: "FIXED" };

/** A row 80 wide, with the height and sizing given. */
function row(figma: PluginAPI, height: number, sizing: LayoutSizing): FrameNode {
  const frame = figma.createFrame();
  frame.layoutMode = "HORIZONTAL";
  frame.resize(80, height);
  frame.layoutSizingHorizontal = sizing.horizontal;
  frame.layoutSizingVertical = sizing.vertical;
  return frame;
}

describe("planLayoutSizing", () => {
  const file = fixtureFile([]);

  /** Plan a 32px literal height on the frame, hugging its width. */
  async function planButtonHeight(frame: FrameNode): Promise<PlanRecorder> {
    const plan = newPlan();
    const run = await fixtureRun(file, plan);
    planLayoutSizing(
      run,
      frame,
      "Button",
      { direction: "HORIZONTAL", sizing: BUTTON_SIZING },
      "read",
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
        )
    );
    return plan;
  }

  it("writes the sizing again after a height write turns the hug fixed", async () => {
    const frame = row(file.figma, 24, BUTTON_SIZING);
    const plan = await planButtonHeight(frame);
    expect(changeLines(plan)).toEqual(["Button: height → 32"]);

    await Effect.runPromise(performPlan(plan));
    expect([frame.height, frame.layoutSizingHorizontal, frame.layoutSizingVertical]).toEqual([
      32,
      "HUG",
      "FIXED",
    ]);
    expect(changeLines(await planButtonHeight(frame))).toEqual([]);
  });

  it("lists a sizing that differs already on the same line as the height", async () => {
    const frame = row(file.figma, 24, { horizontal: "FIXED", vertical: "FIXED" });
    const plan = await planButtonHeight(frame);
    expect(changeLines(plan)).toEqual(["Button: height → 32, layoutSizingHorizontal → HUG"]);

    await Effect.runPromise(performPlan(plan));
    expect(changeLines(await planButtonHeight(frame))).toEqual([]);
  });

  it("plans nothing for a frame that already matches", async () => {
    expect(changeLines(await planButtonHeight(row(file.figma, 32, BUTTON_SIZING)))).toEqual([]);
  });
});

describe("planPaints", () => {
  it("matches a bound paint by its binding, since the paint's opacity is the variable's alpha", async () => {
    const file = fixtureFile([color("Fuse tokens", "error/10", { r: 0.8, g: 0.1, b: 0.1, a: 0.1 })]);
    const frame = file.figma.createFrame();
    frame.fills = [];
    const planFill = async (): Promise<PlanRecorder> => {
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
    await Effect.runPromise(performPlan(plan));
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

  /** Plan a frame's fill as an image paint at FILL. */
  async function planImage(file: FakeFigma, frame: FrameNode, image: ImagePaintSpec): Promise<PlanRecorder> {
    const plan = newPlan();
    planPaints(await fixtureRun(file, plan), "Avatar", "fill", frame.fills, image, (paints) => {
      frame.fills = paints;
    });
    return plan;
  }

  const RED_FILL: ImagePaintSpec = {
    kind: "image",
    bytes: RED_PIXEL.bytes,
    hash: RED_PIXEL.sha1,
    scaleMode: "FILL",
  };

  it("matches an image paint by its hash and its scale mode, and stores the image only when the write runs", async () => {
    const file = fixtureFile([]);
    file.figma.createImage(file.figma.base64Decode(RED_PIXEL.bytes));
    const frame = file.figma.createFrame();
    frame.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash: RED_PIXEL.sha1 }];
    const before = file.writes.length;

    const plan = await planImage(file, frame, RED_FILL);
    const image = `image ${RED_PIXEL.sha1.slice(0, 8)}`;
    expect(changeLines(plan)).toEqual([`Avatar: fill → ${image} at FILL (holds ${image} at FIT)`]);
    expect(file.writes.slice(before)).toEqual([]);
    await Effect.runPromise(performPlan(plan));
    expect(file.writes.slice(before)).toEqual([`store the image ${RED_PIXEL.sha1}`, `${frame.id} fills`]);
    expect(frame.fills).toMatchObject([{ type: "IMAGE", scaleMode: "FILL", imageHash: RED_PIXEL.sha1 }]);
    expect(changeLines(await planImage(file, frame, RED_FILL))).toEqual([]);
  });

  it("writes no fill when Figma names the stored image by another hash than the spec's", async () => {
    const file = fixtureFile([]);
    const frame = file.figma.createFrame();
    frame.fills = [];
    const plan = await planImage(file, frame, { ...RED_FILL, hash: BLUE_PIXEL.sha1 });
    expect(changeLines(plan)).toEqual([
      `Avatar: fill → image ${BLUE_PIXEL.sha1.slice(0, 8)} at FILL (holds none)`,
    ]);
    await expect(Effect.runPromise(performPlan(plan))).rejects.toThrow(
      `Figma stored the image as ${RED_PIXEL.sha1}, where the kit names it ${BLUE_PIXEL.sha1}`
    );
    expect(frame.fills).toEqual([]);
  });
});
