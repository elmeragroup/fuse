/**
 * `planChildren` against hand-made stand-ins for a variant component, its label and a stale
 * layer. The stand-ins model two Figma rules from the plugin typings and the text guide.
 * `getRangeBoundVariable` returns `figma.mixed` when the characters bind different variables,
 * or some bind none, while `boundVariables` still lists the alias the rest bind.
 * `loadFontAsync` rejects a font the machine cannot load. The oracles are the change lines the
 * spec asks for and a log of every write the stand-ins receive.
 */
import { describe, expect, it } from "vitest";

import type { TextLayerSpec } from "../../src/components/kit-spec.ts";
import { planChildren } from "./child-layers.ts";
import type { Run } from "./fields.ts";
import { changeLines, newPlan, runPlan } from "./plan.ts";
import type { Plan } from "./plan.ts";
import type { KitVariables } from "./variables.ts";

/** The fields of a text layer that planning a label reads and writes. */
type TextStandIn = Pick<
  TextNode,
  | "type"
  | "name"
  | "characters"
  | "fontName"
  | "fontSize"
  | "lineHeight"
  | "fills"
  | "textAutoResize"
  | "textDecoration"
  | "textDecorationOffset"
  | "boundVariables"
  | "componentPropertyReferences"
  | "getSharedPluginData"
  | "getRangeAllFontNames"
  | "getRangeBoundVariable"
  | "setBoundVariable"
>;

/** The fields of a stale layer that planning its deletion reads and calls. */
type StaleStandIn = Pick<RectangleNode, "type" | "name" | "getSharedPluginData" | "remove">;

/** What a label binds across its characters, by field. A field it leaves out binds nothing. */
type RangeBindings = ReadonlyMap<VariableBindableTextField, VariableAlias | PluginAPI["mixed"]>;

/** The parts of a variant component that `planChildren` reads and calls. */
type ComponentStandIn = Pick<ComponentNode, "children" | "insertChild">;

/** The plugin API and the log of the fonts it loaded. */
type FigmaStandIn = {
  readonly figma: PluginAPI;
  readonly loaded: readonly string[];
};

const ROBOTO_MEDIUM: FontName = { family: "Roboto", style: "Medium" };
const COMIC_SANS_BOLD: FontName = { family: "Comic Sans", style: "Bold" };

const alias = (id: string): VariableAlias => ({ type: "VARIABLE_ALIAS", id });

/** The Button label as the spec builder writes it, with a literal family. */
const LABEL: TextLayerSpec = {
  kind: "text",
  key: "button/label",
  name: "Label",
  characters: "Button",
  textProperty: undefined,
  fontFamily: { kind: "literal", value: "Roboto" },
  fontStyle: "Medium",
  fontSize: { kind: "variable", variable: { collection: "Fuse density", name: "control-text" } },
  lineHeight: { kind: "variable", variable: { collection: "Fuse density", name: "control-leading" } },
  color: { kind: "variable", variable: { collection: "Fuse tokens", name: "foreground" } },
  underline: undefined,
};

/** A plugin API that loads every font except the ones the machine lacks. */
function figmaStandIn(missing: readonly FontName[]): FigmaStandIn {
  const loaded: string[] = [];
  const figma = {
    mixed: Symbol("mixed"),
    loadFontAsync: (font: FontNameInput): Promise<void> => {
      if (missing.some((lacking) => lacking.family === font.family && lacking.style === font.style)) {
        return Promise.reject(new Error(`${font.family} is not installed`));
      }
      loaded.push(`${font.family} ${font.style ?? ""}`);
      return Promise.resolve();
    },
  };
  // SAFETY: planning and performing a label reads only `mixed` and `loadFontAsync` when the
  // label's paint already matches.
  return { figma: figma as PluginAPI, loaded };
}

/** The file's variables, each with its name as its id. A bound family resolves to Roboto. */
const VARIABLES: KitVariables = {
  variable: (ref) => {
    const variable: Pick<Variable, "id" | "resolveForConsumer"> = {
      id: ref.name,
      resolveForConsumer: () => ({ value: "Roboto", resolvedType: "STRING" }),
    };
    // SAFETY: the planners read a variable's id, and `resolveForConsumer` for a bound family.
    return variable as Variable;
  },
  mode: () => {
    throw new Error("a label pins no mode");
  },
};

/**
 * A label that matches `LABEL` and logs each write it receives.
 *
 * @param writes - The log of writes.
 * @param fields - The fields that differ from a matching label.
 * @param ranges - What the characters bind, field by field, when it differs.
 */
function labelStandIn(
  writes: string[],
  fields: Partial<TextStandIn>,
  ranges: RangeBindings = new Map()
): TextNode {
  const bindings = new Map<VariableBindableTextField, VariableAlias | PluginAPI["mixed"]>([
    ["fontSize", alias("control-text")],
    ["lineHeight", alias("control-leading")],
    ...ranges,
  ]);
  const label: TextStandIn = {
    type: "TEXT",
    name: "Label",
    characters: "Button",
    fontName: ROBOTO_MEDIUM,
    fontSize: 14,
    lineHeight: { unit: "PIXELS", value: 20 },
    fills: [
      {
        type: "SOLID",
        color: { r: 0, g: 0, b: 0 },
        opacity: 1,
        visible: true,
        blendMode: "NORMAL",
        boundVariables: { color: alias("foreground") },
      },
    ],
    textAutoResize: "WIDTH_AND_HEIGHT",
    textDecoration: "NONE",
    textDecorationOffset: null,
    boundVariables: { fontSize: [alias("control-text")], lineHeight: [alias("control-leading")] },
    componentPropertyReferences: null,
    getSharedPluginData: () => "button/label",
    getRangeAllFontNames: () => [ROBOTO_MEDIUM],
    getRangeBoundVariable: (_start, _end, field) => bindings.get(field) ?? null,
    setBoundVariable: (field, variable) => {
      writes.push(variable === null ? `unbind ${field}` : `bind ${field}`);
      for (const bound of bindings.keys()) {
        if (bound === field && variable === null) {
          bindings.delete(bound);
        }
      }
    },
    ...fields,
  };
  const logged = new Proxy(label, {
    set: (target, property, value) => {
      writes.push(`set ${String(property)}`);
      return Reflect.set(target, property, value);
    },
  });
  // SAFETY: the stand-in carries every field and method of a text layer that planning and
  // performing a label touch.
  return logged as TextNode;
}

function staleStandIn(writes: string[]): RectangleNode {
  const stale: StaleStandIn = {
    type: "RECTANGLE",
    name: "Old badge",
    getSharedPluginData: () => "button/badge",
    remove: () => {
      writes.push("remove Old badge");
    },
  };
  // SAFETY: planning a stale layer reads its key and name, and deleting it calls `remove`.
  return stale as RectangleNode;
}

/** Plan the Button's child layers on a stand-in component that holds `children`. */
async function planButton(
  plan: Plan,
  figma: PluginAPI,
  children: readonly SceneNode[],
  spec: TextLayerSpec = LABEL
): Promise<void> {
  const component: ComponentStandIn = { children, insertChild: () => undefined };
  const run: Run = { figma, variables: VARIABLES, plan };
  // SAFETY: `planChildren` reads a component's children and reorders them through
  // `insertChild`, and the stand-in children carry every field the planners read.
  await planChildren(run, component as ComponentNode, "Button", [spec], {
    properties: new Map(),
    icons: new Map(),
  });
}

async function changesFor(figma: PluginAPI, label: TextNode, spec: TextLayerSpec = LABEL): Promise<string[]> {
  const plan = newPlan();
  await planButton(plan, figma, [label], spec);
  return changeLines(plan);
}

/** Apply the Button's child layers to a stand-in label, and return the lines Apply made. */
async function applyTo(figma: PluginAPI, label: TextNode): Promise<string[]> {
  const { plan } = await runPlan(true, (pass) => planButton(pass, figma, [label]));
  return changeLines(plan);
}

describe("planChildren on a label", () => {
  it("underlines a link label, then sets the offset an underline holds, in one operation", async () => {
    const { figma } = figmaStandIn([]);
    const writes: string[] = [];
    const label = labelStandIn(writes, {});
    const link: TextLayerSpec = { ...LABEL, underline: { offset: 4 } };
    expect(await changesFor(figma, label, link)).toEqual([
      "Button / Label: textDecoration → UNDERLINE, offset 4",
    ]);

    const { plan } = await runPlan(true, (pass) => planButton(pass, figma, [label], link));
    expect(changeLines(plan)).toEqual(["Button / Label: textDecoration → UNDERLINE, offset 4"]);
    expect(writes).toEqual(["set textDecoration", "set textDecorationOffset"]);
    expect(label.textDecorationOffset).toEqual({ unit: "PIXELS", value: 4 });
    expect(await changesFor(figma, label, link)).toEqual([]);
  });

  it("plans nothing for a label that matches the spec", async () => {
    const { figma } = figmaStandIn([]);
    expect(await changesFor(figma, labelStandIn([], {}))).toEqual([]);
  });

  it("rebinds a font size that one character no longer follows", async () => {
    const { figma } = figmaStandIn([]);
    const label = labelStandIn([], {}, new Map([["fontSize", figma.mixed]]));
    expect(await changesFor(figma, label)).toEqual(["Button / Label: fontSize → control-text"]);
  });

  it("unbinds a literal line height that one character still binds", async () => {
    const { figma } = figmaStandIn([]);
    const literal: TextLayerSpec = { ...LABEL, lineHeight: { kind: "literal", value: 20 } };
    const label = labelStandIn([], {}, new Map([["lineHeight", figma.mixed]]));
    expect(await changesFor(figma, label, literal)).toEqual(["Button / Label: lineHeight → 20"]);
  });

  it("unbinds a literal font family that some characters still bind, in the font write", async () => {
    const { figma } = figmaStandIn([]);
    const writes: string[] = [];
    const label = labelStandIn(writes, {}, new Map([["fontFamily", figma.mixed]]));
    const { plan } = await runPlan(true, (pass) => planButton(pass, figma, [label]));
    expect(changeLines(plan)).toEqual(["Button / Label: font → Roboto Medium"]);
    expect(writes).toEqual(["unbind fontFamily", "set fontName"]);
  });

  it("clears a weight binding in the font write, and keeps the font", async () => {
    const { figma } = figmaStandIn([]);
    const writes: string[] = [];
    const label = labelStandIn(writes, {}, new Map([["fontWeight", alias("selection-title-weight")]]));
    expect(await applyTo(figma, label)).toEqual(["Button / Label: font → Roboto Medium"]);
    expect(writes).toEqual(["unbind fontWeight", "set fontName"]);
    expect(label.fontName).toEqual(ROBOTO_MEDIUM);
    expect(await changesFor(figma, label)).toEqual([]);
  });

  it("clears a style binding that some characters keep, in the font write", async () => {
    const { figma } = figmaStandIn([]);
    const writes: string[] = [];
    const label = labelStandIn(writes, {}, new Map([["fontStyle", figma.mixed]]));
    expect(await applyTo(figma, label)).toEqual(["Button / Label: font → Roboto Medium"]);
    expect(writes).toEqual(["unbind fontStyle", "set fontName"]);
    expect(label.fontName).toEqual(ROBOTO_MEDIUM);
    expect(await changesFor(figma, label)).toEqual([]);
  });

  it("rebinds a font family that one character no longer follows", async () => {
    const { figma } = figmaStandIn([]);
    const bound: TextLayerSpec = {
      ...LABEL,
      fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
    };
    const label = labelStandIn(
      [],
      {
        boundVariables: {
          fontFamily: [alias("font-sans")],
          fontSize: [alias("control-text")],
          lineHeight: [alias("control-leading")],
        },
      },
      new Map([["fontFamily", figma.mixed]])
    );
    expect(await changesFor(figma, label, bound)).toEqual(["Button / Label: fontFamily → font-sans"]);
  });
});

describe("planChildren with a font the machine cannot load", () => {
  /** A label whose first word is in a font the file holds and the machine lacks. */
  const mixedLabel = (figma: PluginAPI, writes: string[]): TextNode =>
    labelStandIn(writes, {
      fontName: figma.mixed,
      getRangeAllFontNames: () => [COMIC_SANS_BOLD, ROBOTO_MEDIUM],
    });

  const planner =
    (figma: PluginAPI, children: readonly SceneNode[]) =>
    (plan: Plan): Promise<void> =>
      planButton(plan, figma, children);

  it("repairs a label that holds the font, because the font write needs only the new font", async () => {
    const { figma, loaded } = figmaStandIn([COMIC_SANS_BOLD]);
    const writes: string[] = [];
    const children = [staleStandIn(writes), mixedLabel(figma, writes)];

    const { plan } = await runPlan(true, planner(figma, children));
    expect(changeLines(plan)).toEqual([
      "Button: delete the layer Old badge",
      "Button / Label: font → Roboto Medium",
    ]);
    expect(loaded).toEqual(["Roboto Medium"]);
    expect(writes).toEqual(["remove Old badge", "set fontName"]);
  });

  it("stops Apply before any write, and fails Plan the same way, for a label that keeps the font", async () => {
    const { figma } = figmaStandIn([ROBOTO_MEDIUM]);
    const writes: string[] = [];
    const label = labelStandIn(writes, {}, new Map([["fontSize", figma.mixed]]));
    const children = [staleStandIn(writes), label];

    await expect(runPlan(true, planner(figma, children))).rejects.toThrow(
      "Button / Label needs the font Roboto Medium, which Figma cannot load."
    );
    await expect(runPlan(false, planner(figma, children))).rejects.toThrow(
      "Button / Label needs the font Roboto Medium, which Figma cannot load."
    );
    expect(writes).toEqual([]);
  });
});
