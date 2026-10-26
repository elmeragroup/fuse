/**
 * Rule 56 of the in-memory file in `fake-figma.ts`: the lengths of an instance whose explicit variable
 * modes give it another size than its main. The oracle is what the test file `Elmera Fuse - Import
 * test` read back in the net-zero probes G13 to G19 on 2026-10-26, as the fake's header names them.
 * The preview planner's length tests converge against these rules, so a rule that drifts from the real
 * file would let a plan pass that Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";

/**
 * G13 to G19's file: `row-h` is 32 Dense and 36 Comfortable and `item-w` 100 and 140, Dense the
 * default, and a hugging auto layout frame pinned Comfortable holds the instances. `pin` pins another
 * frame Comfortable.
 */
async function densityProbe() {
  const float = (name: string, dense: number, comfortable: number) => ({
    name,
    type: "FLOAT" as const,
    scopes: [],
    webSyntax: undefined,
    description: "",
    values: new Map([
      ["Dense", { _tag: "Float" as const, value: dense }],
      ["Comfortable", { _tag: "Float" as const, value: comfortable }],
    ]),
  });
  const file = createFakeFigma({
    collections: [
      {
        name: "Fuse density",
        modes: ["Dense", "Comfortable"],
        variables: [float("row-h", 32, 36), float("item-w", 100, 140)],
      },
    ],
  });
  const { figma } = file;
  const [collection] = await figma.variables.getLocalVariableCollectionsAsync();
  const comfortable = collection?.modes.find((mode) => mode.name === "Comfortable")?.modeId;
  if (collection === undefined || comfortable === undefined) {
    throw new Error("the file holds no Comfortable density mode");
  }
  const frame = figma.createFrame();
  frame.layoutMode = "HORIZONTAL";
  frame.layoutSizingHorizontal = "HUG";
  frame.layoutSizingVertical = "HUG";
  const pin = (target: FrameNode): void =>
    target.setExplicitVariableModeForCollection(collection, comfortable);
  pin(frame);
  return { file, figma, frame, pin };
}

/**
 * G13's main: a row 404 wide that hugs its height. The probe's padding bound `row-h`'s neighbour
 * `row-py` around a text, which the fake does not lay out, so here the main hugs an instance of a
 * 40 × `row-h` row, which makes it 32 tall and an instance pinned Comfortable 36 (rule 32).
 */
function hugMain(figma: PluginAPI, file: FakeFigma, width = 404): ComponentNode {
  const row = figma.createComponent();
  row.name = "state=rest";
  row.layoutMode = "HORIZONTAL";
  row.resize(40, 32);
  row.setBoundVariable("height", file.variable("Fuse density", "row-h"));
  figma.combineAsVariants([row], figma.currentPage);
  const main = figma.createComponent();
  main.layoutMode = "HORIZONTAL";
  main.resize(width, 32);
  main.layoutSizingVertical = "HUG";
  main.appendChild(row.createInstance());
  return main;
}

/** G14's main: a fixed row whose width binds `item-w`, 100 in the main's Dense. */
function boundMain(figma: PluginAPI, file: FakeFigma): ComponentNode {
  const main = figma.createComponent();
  main.layoutMode = "HORIZONTAL";
  main.resize(100, 32);
  main.setBoundVariable("width", file.variable("Fuse density", "item-w"));
  return main;
}

describe("rule 56: an instance its modes give another size than its main holds its lengths (G13 to G19)", () => {
  it("holds 404 once read, while instances first read after the main narrows take 366, and all hold through 300 (G13)", async () => {
    const { file, figma, frame } = await densityProbe();
    const main = hugMain(figma, file);
    const [first, second, third] = [0, 1, 2].map(() => {
      const instance = main.createInstance();
      frame.appendChild(instance);
      return instance;
    });
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("the frame holds no three instances");
    }
    expect([main.width, main.height, first.width, first.height]).toEqual([404, 32, 404, 36]);
    expect([first.layoutSizingHorizontal, first.layoutSizingVertical]).toEqual(["FIXED", "HUG"]);
    expect(first.overrides).toEqual([{ id: first.id, overriddenFields: ["width", "height"] }]);
    main.resize(366, main.height);
    main.layoutSizingVertical = "HUG";
    expect([first.width, second.width, third.width]).toEqual([404, 366, 366]);
    main.resize(300, main.height);
    main.layoutSizingVertical = "HUG";
    expect([first.width, second.width, third.width]).toEqual([404, 366, 366]);
  });

  it("moves a held instance only by a width write, which holds through the main's next resize (G13)", async () => {
    const { file, figma, frame } = await densityProbe();
    const main = hugMain(figma, file);
    const instance = main.createInstance();
    frame.appendChild(instance);
    expect(instance.width).toBe(404);
    main.resize(366, main.height);
    main.layoutSizingVertical = "HUG";
    instance.resize(366, instance.height);
    instance.layoutSizingVertical = "HUG";
    expect([
      instance.width,
      instance.height,
      instance.layoutSizingHorizontal,
      instance.layoutSizingVertical,
    ]).toEqual([366, 36, "FIXED", "HUG"]);
    main.resize(300, main.height);
    main.layoutSizingVertical = "HUG";
    expect(instance.width).toBe(366);
  });

  it("reads a bound width as the variable in its modes, and keeps it unbound when the main unbinds (G14)", async () => {
    const { file, figma, frame } = await densityProbe();
    const main = boundMain(figma, file);
    const itemW = file.variable("Fuse density", "item-w");
    const instance = main.createInstance();
    frame.appendChild(instance);
    expect([main.width, instance.width, instance.boundVariables?.width?.id]).toEqual([100, 140, itemW.id]);
    expect(instance.overrides).toEqual([{ id: instance.id, overriddenFields: ["width", "height"] }]);
    main.setBoundVariable("width", null);
    main.resize(90, main.height);
    expect([instance.width, instance.boundVariables?.width]).toEqual([140, undefined]);
  });

  it("binds the instance again when the main or the instance itself binds the width (G15)", async () => {
    const { file, figma, frame } = await densityProbe();
    const main = boundMain(figma, file);
    const itemW = file.variable("Fuse density", "item-w");
    const [followsMain, bindsItself] = [0, 1].map(() => {
      const instance = main.createInstance();
      frame.appendChild(instance);
      return instance;
    });
    if (followsMain === undefined || bindsItself === undefined) {
      throw new Error("the frame holds no two instances");
    }
    expect([followsMain.width, bindsItself.width]).toEqual([140, 140]);
    main.setBoundVariable("width", null);
    main.resize(90, main.height);
    bindsItself.setBoundVariable("width", itemW);
    expect([followsMain.boundVariables?.width, bindsItself.boundVariables?.width?.id]).toEqual([
      undefined,
      itemW.id,
    ]);
    main.setBoundVariable("width", itemW);
    expect([followsMain.width, followsMain.boundVariables?.width?.id]).toEqual([140, itemW.id]);
  });

  // G19 changed `item-w`'s values after the unbind, and the instances kept their lengths. The fake
  // has no `setValueForMode`, so a frame pinned Comfortable after the unbind stands in for the change
  // in what `item-w` resolves to for the instance.
  it("keeps its length on its own unbind, listing the binding and both lengths, until bound again (G19)", async () => {
    const { file, figma, frame, pin } = await densityProbe();
    const main = boundMain(figma, file);
    const itemW = file.variable("Fuse density", "item-w");
    const inModeB = main.createInstance();
    frame.appendChild(inModeB);
    const matching = figma.createFrame();
    matching.layoutMode = "HORIZONTAL";
    const inMatchingMode = main.createInstance();
    matching.appendChild(inMatchingMode);
    expect([inModeB.width, inMatchingMode.width]).toEqual([140, 100]);

    inModeB.setBoundVariable("width", null);
    inMatchingMode.setBoundVariable("width", null);
    expect([inModeB.width, inModeB.boundVariables?.width, main.boundVariables?.width?.id]).toEqual([
      140,
      undefined,
      itemW.id,
    ]);
    expect([inMatchingMode.width, inMatchingMode.boundVariables?.width]).toEqual([100, undefined]);
    for (const instance of [inModeB, inMatchingMode]) {
      expect(instance.overrides).toEqual([
        { id: instance.id, overriddenFields: ["width", "height", "boundVariables"] },
      ]);
    }

    pin(matching);
    expect(inMatchingMode.width).toBe(100);
    inMatchingMode.setBoundVariable("width", itemW);
    expect([inMatchingMode.width, inMatchingMode.boundVariables?.width?.id]).toEqual([140, itemW.id]);
  });

  // G13 ran the deprecated `resetOverrides()`. The fake models its replacement, `removeOverrides()`,
  // which the typings describe the same way.
  it("keeps a held instance's lengths, listed, through an override reset (G13)", async () => {
    const { file, figma, frame } = await densityProbe();
    const main = hugMain(figma, file, 366);
    const instance = main.createInstance();
    frame.appendChild(instance);
    expect([instance.width, instance.height]).toEqual([366, 36]);
    main.resize(300, main.height);
    main.layoutSizingVertical = "HUG";
    instance.removeOverrides();
    expect([instance.width, instance.height]).toEqual([366, 36]);
    expect(instance.overrides).toEqual([{ id: instance.id, overriddenFields: ["width", "height"] }]);
  });

  it("reads the main's width binding at the main's size, with no overrides, where its modes match (G16)", async () => {
    const { file, figma } = await densityProbe();
    const main = boundMain(figma, file);
    const frame = figma.createFrame();
    frame.layoutMode = "HORIZONTAL";
    const instance = main.createInstance();
    frame.appendChild(instance);
    expect([instance.width, instance.height, instance.boundVariables?.width?.id]).toEqual([
      100,
      32,
      file.variable("Fuse density", "item-w").id,
    ]);
    expect(instance.overrides).toEqual([]);
  });

  it("gives a held instance the new variant's width on a swap and keeps both lengths listed (G17)", async () => {
    const { file, figma, frame } = await densityProbe();
    const wide = hugMain(figma, file);
    const narrow = hugMain(figma, file, 366);
    const held = wide.createInstance();
    frame.appendChild(held);
    expect([held.width, held.height, held.boundVariables?.width]).toEqual([404, 36, undefined]);
    held.swapComponent(narrow);
    expect([held.width, held.height]).toEqual([366, 36]);
    expect(held.overrides).toEqual([{ id: held.id, overriddenFields: ["width", "height"] }]);

    const matching = figma.createFrame();
    matching.layoutMode = "HORIZONTAL";
    const fresh = wide.createInstance();
    matching.appendChild(fresh);
    expect(fresh.width).toBe(404);
    fresh.swapComponent(narrow);
    expect([fresh.width, fresh.height, fresh.overrides]).toEqual([366, 32, []]);
  });
});
