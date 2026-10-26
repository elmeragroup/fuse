/**
 * The box planner on the in-memory file in `fake-figma.ts`. `ringFill` is checked against what a
 * real file showed on 2026-10-20: Figma drew a focus ring's spread over a fill at alpha 0.001 and
 * not over a fill at alpha 0. The fill must also change no pixel, so it moves no 8-bit channel by
 * half a step. `planBox` is checked against hand-written boxes, planned as a variant's root and
 * as frames below it: the oracles are the change lines each needs from the node Figma creates,
 * the fields the file holds after Apply, and an empty second plan. The sizing cases rest on the
 * fake's rules 12 to 16, which follow what a real file read on 2026-10-22: a resize or a width
 * binding turns a filling axis fixed (P2), and a direction change keeps each sizing mode's role,
 * so the hug moves with it (P6).
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { NO_LIMITS, ringFill, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  BoxSpec,
  FrameLayerSpec,
  NumberSpec,
  ShadowSpec,
  SizingSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { planBox } from "./box.ts";
import type { BoxPlace } from "./box.ts";
import { planChildren } from "./child-layers.ts";
import { childNamed, color, fixtureFile, fixtureRun, float, onFixture } from "./fake-fixtures.ts";
import { setKey } from "./identity.ts";
import { changeLines, newPlan, performPlan, Plan } from "./plan.ts";
import type { PlanRecorder } from "./plan.ts";
import { currentRun } from "./services.ts";

const RING: ShadowSpec = {
  color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
  offsetX: 0,
  offsetY: 0,
  radius: { kind: "literal", value: 0 },
  spread: { kind: "literal", value: 2 },
};

describe("ringFill", () => {
  it("gives a ringed root without a fill one that Figma counts and that shows nothing", () => {
    const fill = ringFill({ fill: undefined, shadows: [RING] });
    if (fill?.kind !== "literal") {
      throw new Error("a ringed root without a fill gets no literal fill");
    }
    expect(fill.color.a).toBeGreaterThanOrEqual(0.001);
    expect(fill.color.a * 255).toBeLessThan(0.5);
  });
});

/**
 * A 16px root that puts its content at the end of the row, centered across it, with a stroke, a
 * ring and no fill of its own. It clips, as the build makes every root clip.
 */
const BOX: BoxSpec = {
  direction: "HORIZONTAL",
  sizing: {
    horizontal: { kind: "fixed", length: { kind: "literal", value: 16 } },
    vertical: {
      kind: "fixed",
      length: { kind: "variable", variable: { collection: "Fuse density", name: "size-4" } },
    },
  },
  limits: NO_LIMITS,
  clips: true,
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

/** A variant's root, and a frame below a box that keeps its direction in the run. */
const ROOT: BoxPlace = { kind: "root" };
const PART: BoxPlace = { kind: "frame", parent: "read" };

describe("planBox", () => {
  const file = fixtureFile([
    float("Fuse density", "size-4", 16),
    float("Fuse tokens", "radius-sm", 4),
    color("Fuse tokens", "primary", { r: 0.1, g: 0.2, b: 0.6, a: 1 }),
    color("Fuse tokens", "ring", { r: 0.5, g: 0.5, b: 0.5, a: 1 }),
  ]);

  async function planOn(
    node: FrameNode | ComponentNode,
    label: string,
    place: BoxPlace,
    spec: BoxSpec = BOX
  ): Promise<PlanRecorder> {
    const plan = newPlan();
    planBox(await fixtureRun(file, plan), node, label, spec, place);
    return plan;
  }

  /** The lines a root and a frame share, in planner order around the clip and the fill. */
  const shared = (label: string, clipAndFill: readonly string[]): string[] => [
    `${label}: layoutMode → HORIZONTAL`,
    `${label}: primaryAxisAlignItems → MAX`,
    `${label}: counterAxisAlignItems → CENTER`,
    `${label}: width → 16, height → size-4, layoutSizingHorizontal → FIXED, layoutSizingVertical → FIXED`,
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
    const plan = await planOn(root, "Radio", ROOT);
    expect(changeLines(plan)).toEqual(
      shared("Radio", [
        "Radio: clipsContent → true",
        "Radio: fill → #000000 at 0.15% (holds #ffffff at 100%)",
      ])
    );

    await Effect.runPromise(performPlan(plan));
    expectBoxFields(root);
    expect(root.clipsContent).toBe(true);
    expect(root.fills).toMatchObject([{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]);
    // Figma stores the opacity as a 32-bit float.
    expect(root.fills !== file.figma.mixed && root.fills[0]?.opacity).toBeCloseTo(0.0015, 6);
    expect(changeLines(await planOn(root, "Radio", ROOT))).toEqual([]);
  });

  it("draws a frame below the root, which shows its overflow and takes no fill the spec lacks", async () => {
    const root = file.figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    const frame = file.figma.createFrame();
    root.appendChild(frame);
    // A part shows what overflows it, as the build draws every part.
    const part = { ...BOX, clips: false };
    const plan = await planOn(frame, "Radio / Indicator", PART, part);
    expect(changeLines(plan)).toEqual(
      shared("Radio / Indicator", [
        "Radio / Indicator: clipsContent → false",
        "Radio / Indicator: fill → none",
      ])
    );

    await Effect.runPromise(performPlan(plan));
    expectBoxFields(frame);
    expect([frame.clipsContent, frame.fills]).toEqual([false, []]);
    expect(changeLines(await planOn(frame, "Radio / Indicator", PART, part))).toEqual([]);
  });

  // Oracle: a real file on 2026-10-23, where a later effect painted above an earlier one (PE2), so
  // the spec lists a ring above a 1px border last. A frame a run wrote in CSS's order, the ring
  // first, takes the new order once, and the next Plan lists nothing.
  it("writes the shadows in the spec's order once where the frame holds them in another", async () => {
    const root = file.figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    const frame = file.figma.createFrame();
    root.appendChild(frame);
    const border: ShadowSpec = { ...RING, spread: { kind: "literal", value: 1 } };
    await Effect.runPromise(
      performPlan(await planOn(frame, "Row", PART, { ...BOX, shadows: [RING, border] }))
    );

    const plan = await planOn(frame, "Row", PART, { ...BOX, shadows: [border, RING] });
    expect(changeLines(plan)).toContain(
      "Row: shadows → ring 0 0 0 1, ring 0 0 0 2 (holds variable, stored #808080 at 100%, 0 0 0 2, variable, stored #808080 at 100%, 0 0 0 1)"
    );
    await Effect.runPromise(performPlan(plan));
    expect(
      frame.effects.map((effect) => (effect.type === "DROP_SHADOW" ? effect.spread : undefined))
    ).toEqual([1, 2]);
    expect(changeLines(await planOn(frame, "Row", PART, { ...BOX, shadows: [border, RING] }))).toEqual([]);
  });

  // Oracle: CSS Basic UI 4 §5, where an outline takes no layout space, and the typings'
  // `strokesIncludedInLayout`, whose false lets the stroke overlap the frame's children.
  it("leaves a stroke drawn from an outline out of the frame's layout", async () => {
    const root = file.figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    const frame = file.figma.createFrame();
    root.appendChild(frame);
    // As a run that drew a border there left it.
    frame.layoutMode = "HORIZONTAL";
    frame.strokesIncludedInLayout = true;
    const outlined: BoxSpec = {
      ...BOX,
      clips: false,
      stroke: {
        color: { kind: "variable", variable: { collection: "Fuse tokens", name: "primary" } },
        weight: { kind: "literal", value: 1 },
        inLayout: false,
      },
    };
    const plan = await planOn(frame, "Item / Media", PART, outlined);
    expect(changeLines(plan)).toContain("Item / Media: strokesIncludedInLayout → false");
    await Effect.runPromise(performPlan(plan));
    expect(frame.strokesIncludedInLayout).toBe(false);
    expect(changeLines(await planOn(frame, "Item / Media", PART, outlined))).toEqual([]);
  });
});

const px = (value: number): NumberSpec => ({ kind: "literal", value });
const HUG = { kind: "hug" } as const;
const FILL = { kind: "fill" } as const;
const fixed = (length: NumberSpec) => ({ kind: "fixed", length }) as const;

/** A box with no limits, padding, gap, corner, paint, ring or layers, at the start of both axes, not clipping. */
function plainBox(direction: BoxSpec["direction"], sizing: SizingSpec): BoxSpec {
  return {
    direction,
    sizing,
    limits: NO_LIMITS,
    clips: false,
    paddingTop: px(0),
    paddingRight: px(0),
    paddingBottom: px(0),
    paddingLeft: px(0),
    itemSpacing: px(0),
    primaryAlign: "MIN",
    counterAlign: "MIN",
    cornerRadius: px(0),
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [],
  };
}

function frameLayer(key: string, sizing: SizingSpec): FrameLayerSpec {
  return { kind: "frame", key, name: key, ...plainBox("HORIZONTAL", sizing) };
}

const sizingOf = (node: LayoutMixin): readonly string[] => [
  node.layoutSizingHorizontal,
  node.layoutSizingVertical,
];

describe("planBox sizing, direction, limits and clipping", () => {
  const file = fixtureFile([float("Fuse density", "size-4", 16), float("Fuse density", "control-h-xs", 24)]);
  const { figma } = file;

  /** Plan a box and the layers it holds, as a variant's root or as a frame below one. */
  function planTree(node: ComponentNode | FrameNode, spec: BoxSpec, place: BoxPlace) {
    return Effect.gen(function* () {
      const plan = newPlan();
      yield* Effect.gen(function* () {
        const size = planBox(yield* currentRun, node, "Box", spec, place);
        yield* planChildren(
          node,
          "Box",
          spec,
          { properties: new Map(), icons: new Map(), sets: new Map() },
          size
        );
      }).pipe(Effect.provideService(Plan, plan), onFixture(file));
      return plan;
    });
  }

  /** An existing row with no fill or clip, inside a column, as a part sits in its root. */
  function partInColumn(): FrameNode {
    const column = figma.createComponent();
    column.layoutMode = "VERTICAL";
    const part = figma.createFrame();
    column.appendChild(part);
    part.layoutMode = "HORIZONTAL";
    part.fills = [];
    part.clipsContent = false;
    return part;
  }

  it.effect("builds a column that fills one layer across and lets another hug, in one Apply", () =>
    Effect.gen(function* () {
      const column: BoxSpec = {
        ...plainBox("VERTICAL", { horizontal: fixed(px(200)), vertical: HUG }),
        children: [
          frameLayer("bar", { horizontal: FILL, vertical: fixed(px(6)) }),
          frameLayer("caption", { horizontal: HUG, vertical: HUG }),
        ],
      };
      const root = figma.createComponent();
      const plan = yield* planTree(root, column, ROOT);
      expect(changeLines(plan)).toEqual([
        "Box: layoutMode → VERTICAL",
        "Box: width → 200, layoutSizingHorizontal → FIXED, layoutSizingVertical → HUG",
        "Box: fill → none",
        "Box: create the frame layer bar",
        "Box: create the frame layer caption",
      ]);

      yield* performPlan(plan);
      const bar = childNamed(root, "FRAME", "bar");
      expect([root.layoutMode, root.width, ...sizingOf(root)]).toEqual(["VERTICAL", 200, "FIXED", "HUG"]);
      expect([bar.height, ...sizingOf(bar)]).toEqual([6, "FILL", "FIXED"]);
      expect(sizingOf(childNamed(root, "FRAME", "caption"))).toEqual(["HUG", "HUG"]);
      expect(changeLines(yield* planTree(root, column, ROOT))).toEqual([]);
    })
  );

  // No probe has shown what Figma stores in the sizing modes, or how it sizes a box, when the box
  // first gets an auto layout, as every new box does. So a box without one writes its sizing even
  // where the modes it stores would read as the spec once it turns.
  it.effect("writes the sizing of a box that has no auto layout yet, whatever its stored modes predict", () =>
    Effect.gen(function* () {
      const root = figma.createComponent();
      root.layoutMode = "HORIZONTAL";
      root.primaryAxisSizingMode = "AUTO";
      root.counterAxisSizingMode = "AUTO";
      root.layoutMode = "NONE";
      root.fills = [];
      const hugging = plainBox("HORIZONTAL", { horizontal: HUG, vertical: HUG });
      const plan = yield* planTree(root, hugging, ROOT);
      expect(changeLines(plan)).toEqual([
        "Box: layoutMode → HORIZONTAL",
        "Box: layoutSizingHorizontal → HUG, layoutSizingVertical → HUG",
      ]);

      yield* performPlan(plan);
      expect(sizingOf(root)).toEqual(["HUG", "HUG"]);
      expect(changeLines(yield* planTree(root, hugging, ROOT))).toEqual([]);
    })
  );

  it.effect("turns a row that hugs its width into a column that keeps hugging it, in one Apply (P6)", () =>
    Effect.gen(function* () {
      const row = figma.createComponent();
      row.layoutMode = "HORIZONTAL";
      row.resize(100, 40);
      row.primaryAxisSizingMode = "AUTO";
      row.fills = [];
      const column = plainBox("VERTICAL", { horizontal: HUG, vertical: fixed(px(40)) });
      // The row reads as hugging its width already, and would read as hugging its height once it
      // turns. On a real file the turn took such a row from 40 to 14 tall, so the plan writes the
      // height and the sizing again after the turn, though the height matches before it.
      expect(sizingOf(row)).toEqual(["HUG", "FIXED"]);
      const plan = yield* planTree(row, column, ROOT);
      expect(changeLines(plan)).toEqual([
        "Box: layoutMode → VERTICAL",
        "Box: height → 40, layoutSizingHorizontal → HUG, layoutSizingVertical → FIXED",
      ]);

      yield* performPlan(plan);
      expect([row.height, ...sizingOf(row)]).toEqual([40, "HUG", "FIXED"]);
      expect(changeLines(yield* planTree(row, column, ROOT))).toEqual([]);
    })
  );

  it.effect(
    "writes a layer's sizing again when its parent turns, which moves its fill across, in one Apply",
    () =>
      Effect.gen(function* () {
        const row = figma.createComponent();
        row.layoutMode = "HORIZONTAL";
        row.resize(200, 40);
        row.fills = [];
        const bar = figma.createFrame();
        row.appendChild(bar);
        setKey(bar, "bar");
        bar.name = "bar";
        bar.layoutMode = "HORIZONTAL";
        bar.resize(100, 6);
        bar.fills = [];
        bar.clipsContent = false;
        bar.layoutSizingHorizontal = "FILL";
        const column: BoxSpec = {
          ...plainBox("VERTICAL", { horizontal: fixed(px(200)), vertical: fixed(px(40)) }),
          children: [frameLayer("bar", { horizontal: FILL, vertical: fixed(px(6)) })],
        };
        // The bar fills the row's width by growing along it, so it reads as the spec asks until the
        // row turns, when the grow runs down the column instead.
        expect(sizingOf(bar)).toEqual(["FILL", "FIXED"]);
        const plan = yield* planTree(row, column, ROOT);
        expect(changeLines(plan).filter((line) => line.startsWith("Box / bar:"))).toEqual([
          "Box / bar: height → 6, layoutSizingHorizontal → FILL, layoutSizingVertical → FIXED",
        ]);

        yield* performPlan(plan);
        expect([bar.height, ...sizingOf(bar)]).toEqual([6, "FILL", "FIXED"]);
        expect(changeLines(yield* planTree(row, column, ROOT))).toEqual([]);
      })
  );

  it.effect(
    "writes a label's sizing again when its box turns, which moves its fill across, in one Apply",
    () =>
      Effect.gen(function* () {
        const row = figma.createComponent();
        row.layoutMode = "HORIZONTAL";
        row.resize(200, 40);
        row.fills = [];
        const text = figma.createText();
        row.appendChild(text);
        setKey(text, "label");
        yield* Effect.promise(() => figma.loadFontAsync({ family: "Inter", style: "Regular" }));
        text.characters = "label";
        text.lineHeight = { unit: "PIXELS", value: 16 };
        text.layoutSizingHorizontal = "FILL";
        const label: TextLayerSpec = {
          kind: "text",
          key: "label",
          name: "label",
          characters: "label",
          textProperty: undefined,
          fontFamily: { kind: "literal", value: "Inter" },
          fontStyle: "Regular",
          fontSize: px(12),
          lineHeight: px(16),
          color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
          underline: undefined,
          sizing: { horizontal: FILL, vertical: HUG },
          align: TOP_LEFT,
          truncation: undefined,
        };
        const column: BoxSpec = {
          ...plainBox("VERTICAL", { horizontal: fixed(px(200)), vertical: fixed(px(40)) }),
          children: [label],
        };
        // The label fills the row by growing along it, which runs down the column once the row turns.
        expect(sizingOf(text)).toEqual(["FILL", "HUG"]);
        const plan = yield* planTree(row, column, ROOT);
        expect(changeLines(plan).filter((line) => line.startsWith("Box / label:"))).toEqual([
          "Box / label: layoutSizingHorizontal → FILL, layoutSizingVertical → HUG",
        ]);

        yield* performPlan(plan);
        expect(sizingOf(text)).toEqual(["FILL", "HUG"]);
        expect(changeLines(yield* planTree(row, column, ROOT))).toEqual([]);
      })
  );

  it.effect("keeps a width bound to a variable fixed, where the part filled its column before (P2)", () =>
    Effect.gen(function* () {
      const part = partInColumn();
      part.layoutSizingHorizontal = "FILL";
      const bound = plainBox("HORIZONTAL", {
        horizontal: fixed({ kind: "variable", variable: { collection: "Fuse density", name: "size-4" } }),
        vertical: HUG,
      });
      const plan = yield* planTree(part, bound, PART);
      expect(changeLines(plan)).toEqual([
        "Box: width → size-4, layoutSizingHorizontal → FIXED, layoutSizingVertical → HUG",
      ]);

      yield* performPlan(plan);
      expect([part.width, part.boundVariables?.width?.id, ...sizingOf(part)]).toEqual([
        16,
        file.variable("Fuse density", "size-4").id,
        "FIXED",
        "HUG",
      ]);
      expect(changeLines(yield* planTree(part, bound, PART))).toEqual([]);
    })
  );

  it.effect("fills a part again after the resize its height needs, which turns a fill fixed (P2)", () =>
    Effect.gen(function* () {
      const part = partInColumn();
      part.layoutSizingHorizontal = "FILL";
      const filling = plainBox("HORIZONTAL", { horizontal: FILL, vertical: fixed(px(6)) });
      const plan = yield* planTree(part, filling, PART);
      expect(changeLines(plan)).toEqual(["Box: height → 6"]);

      yield* performPlan(plan);
      expect([part.height, ...sizingOf(part)]).toEqual([6, "FILL", "FIXED"]);
      expect(changeLines(yield* planTree(part, filling, PART))).toEqual([]);
    })
  );

  it.effect(
    "binds a limit on a hugging width, writes one on a filling height, clears a third, then converges (P7)",
    () =>
      Effect.gen(function* () {
        const part = partInColumn();
        part.maxHeight = 300;
        const limited: BoxSpec = {
          ...plainBox("HORIZONTAL", { horizontal: HUG, vertical: FILL }),
          limits: {
            ...NO_LIMITS,
            maxWidth: { kind: "variable", variable: { collection: "Fuse density", name: "control-h-xs" } },
            minHeight: px(64),
          },
        };
        const plan = yield* planTree(part, limited, PART);
        expect(changeLines(plan)).toEqual([
          "Box: layoutSizingHorizontal → HUG, layoutSizingVertical → FILL",
          "Box: maxWidth → control-h-xs",
          "Box: minHeight → 64",
          "Box: maxHeight → none",
        ]);

        yield* performPlan(plan);
        expect(sizingOf(part)).toEqual(["HUG", "FILL"]);
        expect([part.minWidth, part.maxWidth, part.minHeight, part.maxHeight]).toEqual([null, 24, 64, null]);
        expect(part.boundVariables?.maxWidth?.id).toBe(file.variable("Fuse density", "control-h-xs").id);
        expect(changeLines(yield* planTree(part, limited, PART))).toEqual([]);
      })
  );

  it.effect("clips a part whose spec clips, as a CSS box with hidden overflow does", () =>
    Effect.gen(function* () {
      const part = partInColumn();
      const clipping = {
        ...plainBox("HORIZONTAL", { horizontal: fixed(px(100)), vertical: fixed(px(100)) }),
        clips: true,
      };
      const plan = yield* planTree(part, clipping, PART);
      expect(changeLines(plan)).toEqual(["Box: clipsContent → true"]);
      yield* performPlan(plan);
      expect(part.clipsContent).toBe(true);
    })
  );

  // Oracle: the fake's rule 33, after a real file on 2026-10-23 (PZ2): a vertical stack paints a
  // later child above an earlier one, and the first on top with `itemReverseZIndex` true.
  it.effect(
    "puts the stack's first layer on top where the spec says, and back in Figma's order where it no longer does",
    () =>
      Effect.gen(function* () {
        const part = partInColumn();
        const column = plainBox("VERTICAL", { horizontal: fixed(px(100)), vertical: fixed(px(100)) });
        const lifted: BoxSpec = { ...column, firstOnTop: true };
        const plan = yield* planTree(part, lifted, PART);
        expect(changeLines(plan)).toEqual([
          "Box: layoutMode → VERTICAL",
          "Box: width → 100, height → 100",
          "Box: itemReverseZIndex → true",
        ]);
        yield* performPlan(plan);
        expect([part.itemReverseZIndex, changeLines(yield* planTree(part, lifted, PART))]).toEqual([
          true,
          [],
        ]);

        yield* performPlan(yield* planTree(part, column, PART));
        expect([part.itemReverseZIndex, changeLines(yield* planTree(part, column, PART))]).toEqual([
          false,
          [],
        ]);
      })
  );
});
