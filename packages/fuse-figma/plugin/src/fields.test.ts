/**
 * Field planners against hand-made stand-ins that model the Figma rule each planner exists
 * for. `resize` turns both sizing modes to FIXED, a paint bound to a color variable takes the
 * variable's alpha as its opacity, and an effect written with the binding it holds keeps the
 * color written. The oracle is the end state the spec asks for, and a second plan over that
 * state must list nothing.
 */
import { describe, expect, it } from "vitest";

import type { ShadowSpec, VariableRef } from "../../src/components/kit-spec.ts";
import { near, planNumber, planPaints, planShadows, planSizing } from "./fields.ts";
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

/**
 * A run whose only variable is the role tint `error/10`. Binding a paint models the rule two
 * runs on a real file showed: the paint Figma binds takes the variable's alpha, 10%, as its
 * opacity, whatever opacity the plugin wrote.
 */
function paintRun(plan: ReturnType<typeof newPlan>): Run {
  // SAFETY: binding reads only the variable's id, and `planPaints` compares bindings by id.
  const tint = { id: "VariableID:1:1" } as Variable;
  const figma = {
    mixed: Symbol("mixed"),
    variables: {
      setBoundVariableForPaint: (paint: SolidPaint, _field: "color", variable: Variable | null) => ({
        ...paint,
        opacity: 0.1,
        boundVariables: variable === null ? {} : { color: { type: "VARIABLE_ALIAS", id: variable.id } },
      }),
    },
  };
  return {
    // SAFETY: `planPaints` reads `mixed` and binds paints, and nothing else of the plugin API.
    figma: figma as PluginAPI,
    plan,
    variables: { variable: () => tint, mode: () => expect.unreachable() },
  };
}

describe("planPaints", () => {
  it("matches a bound paint by its binding, since the paint's opacity is the variable's alpha", async () => {
    let fills: readonly Paint[] = [];
    const planFill = () => {
      const plan = newPlan();
      planPaints(
        paintRun(plan),
        "Button",
        "fill",
        fills,
        { kind: "variable", variable: { collection: "Fuse tokens", name: "error/10" } },
        (paints) => {
          fills = paints;
        }
      );
      return plan;
    };

    const plan = planFill();
    expect(changeLines(plan)).toEqual(["Button: fill → error/10 (holds none)"]);
    await performPlan(plan);
    expect(fills).toEqual([
      {
        type: "SOLID",
        color: { r: 0, g: 0, b: 0 },
        opacity: 0.1,
        visible: true,
        blendMode: "NORMAL",
        boundVariables: { color: { type: "VARIABLE_ALIAS", id: "VariableID:1:1" } },
      },
    ]);
    expect(changeLines(planFill())).toEqual([]);
  });
});

/** The gray `ring` holds in Fjordkraft's internal light theme, from the real file. */
const RING_GRAY: RGBA = { r: 0.502, g: 0.502, b: 0.502, a: 1 };

/** A root whose effects follow the rule a real file showed on 2026-10-20. */
type EffectsStandIn = Pick<FrameNode, "effects">;

function effectsStandIn(held: readonly Effect[]): EffectsStandIn {
  let stored = held;
  return {
    get effects() {
      return stored;
    },
    // A new binding stores the variable's value. An effect written with the binding the node
    // holds keeps the color written.
    set effects(written) {
      stored = written.map((effect, index) => {
        const id = effect.type === "DROP_SHADOW" ? effect.boundVariables?.color?.id : undefined;
        const before = stored[index];
        const heldId = before?.type === "DROP_SHADOW" ? before.boundVariables?.color?.id : undefined;
        return effect.type === "DROP_SHADOW" && id !== undefined && id !== heldId
          ? { ...effect, color: RING_GRAY }
          : effect;
      });
    },
  };
}

/**
 * The variables the shadow tests bind, by name, with the value each takes in any node: `ring`
 * and the outline shadow lengths of an internal theme, whose outline is 1px.
 */
const SHADOW_VARIABLES = new Map<string, { readonly id: string; readonly value: RGBA | number }>([
  ["ring", { id: "VariableID:2:300", value: RING_GRAY }],
  ["button-outline-shadow-blur", { id: "VariableID:9:1", value: 2 }],
  ["button-outline-shadow-spread", { id: "VariableID:9:2", value: 0 }],
]);

function shadowRun(plan: ReturnType<typeof newPlan>): Run {
  const variable = (ref: VariableRef): Variable => {
    const entry = SHADOW_VARIABLES.get(ref.name);
    if (entry === undefined) {
      throw new Error(`the shadow tests bind no ${ref.name}`);
    }
    const standIn: Pick<Variable, "id" | "resolveForConsumer"> = {
      id: entry.id,
      resolveForConsumer: () => ({ value: entry.value, resolvedType: "FLOAT" }),
    };
    // SAFETY: the shadow planner reads a variable's id and resolves it for a node.
    return standIn as Variable;
  };
  const figma = {
    variables: {
      setBoundVariableForEffect: (
        effect: DropShadowEffect,
        field: VariableBindableEffectField,
        bound: Variable | null
      ) => ({
        ...effect,
        boundVariables: {
          ...effect.boundVariables,
          [field]: bound === null ? undefined : { type: "VARIABLE_ALIAS", id: bound.id },
        },
      }),
    },
  };
  return {
    // SAFETY: `planShadows` binds effects, and nothing else of the plugin API.
    figma: figma as PluginAPI,
    plan,
    variables: { variable, mode: () => expect.unreachable() },
  };
}

describe("planShadows", () => {
  it("repairs a ring that holds its binding but stores a stale color", async () => {
    // What a run before 2026-10-20 left: the ring bound to `ring`, storing the black it wrote.
    const node = effectsStandIn([
      {
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 2,
        visible: true,
        blendMode: "NORMAL",
        showShadowBehindNode: false,
        boundVariables: { color: { type: "VARIABLE_ALIAS", id: "VariableID:2:300" } },
      },
    ]);
    const planRing = () => {
      const plan = newPlan();
      // SAFETY: `planShadows` reads and writes only the node's effects.
      planShadows(shadowRun(plan), node as FrameNode, "Button", [
        {
          color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
          offsetX: 0,
          offsetY: 0,
          radius: { kind: "literal", value: 0 },
          spread: { kind: "literal", value: 2 },
        },
      ]);
      return plan;
    };

    const plan = planRing();
    expect(changeLines(plan)).toEqual([
      "Button: shadows → ring 0 0 0 2 (holds variable, stored #000000 at 100%, 0 0 0 2)",
    ]);
    await performPlan(plan);
    expect(node.effects[0]).toMatchObject({ color: RING_GRAY, spread: 2 });
    expect(changeLines(planRing())).toEqual([]);
  });

  it("binds the outline shadow's blur and spread, and writes what they hold in the node", async () => {
    const node = effectsStandIn([]);
    const outline: ShadowSpec = {
      color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
      offsetX: 0,
      offsetY: 1,
      radius: {
        kind: "variable",
        variable: { collection: "Fuse tokens", name: "button-outline-shadow-blur" },
      },
      spread: {
        kind: "variable",
        variable: { collection: "Fuse tokens", name: "button-outline-shadow-spread" },
      },
    };
    const planOutline = () => {
      const plan = newPlan();
      // SAFETY: `planShadows` reads and writes only the node's effects.
      planShadows(shadowRun(plan), node as FrameNode, "Button", [outline]);
      return plan;
    };

    const plan = planOutline();
    expect(changeLines(plan)).toEqual([
      "Button: shadows → #000000 at 5% 0 1 button-outline-shadow-blur button-outline-shadow-spread (holds none)",
    ]);
    await performPlan(plan);
    expect(node.effects[0]).toMatchObject({
      offset: { x: 0, y: 1 },
      radius: 2,
      spread: 0,
      boundVariables: {
        radius: { type: "VARIABLE_ALIAS", id: "VariableID:9:1" },
        spread: { type: "VARIABLE_ALIAS", id: "VariableID:9:2" },
      },
    });
    expect(changeLines(planOutline())).toEqual([]);
  });
});
