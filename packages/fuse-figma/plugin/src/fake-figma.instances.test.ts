/**
 * The instance rules of the in-memory file in `fake-figma.ts`: an instance of a set's variant nested
 * in another component, its properties, swaps, overrides, exposure and size. The oracle is what the
 * test file `Elmera Fuse - Import test` read back in the net-zero probes N1 to N5 on 2026-10-23 and NS
 * and NA on 2026-10-24, as the fake's header names them, and the typings where no probe ran. The planners' instance tests
 * converge against these rules, so a rule that drifts from the real file would let a plan pass that
 * Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { childNamed, color, fixtureFile, float, onlyChildOfType } from "./fake-fixtures.ts";

const PRIMARY = { r: 0, g: 0, b: 1, a: 1 };

/** A file that holds the tokens N1 to N4 bound: three roles and `row-h`. */
function probeFile() {
  return fixtureFile([
    color("Fuse tokens", "primary", PRIMARY),
    color("Fuse tokens", "destructive", { r: 1, g: 0, b: 0, a: 1 }),
    color("Fuse tokens", "success", { r: 0, g: 1, b: 0, a: 1 }),
    float("Fuse density", "row-h", 32),
  ]);
}

/**
 * The sets N1 built: set A, two 70 × 26 rows `variant=default` and `variant=outline`, each holding a
 * `Label` text linked to the TEXT property `Label` and an `Icon` frame linked to the BOOLEAN `Show
 * icon`, with the default row's fill bound to `primary`, and a component B that hugs, padded 16 on
 * each side, holding an instance of the default row. The fake does not lay a row out, so the rows
 * are fixed where the probe's hugged.
 */
async function nested() {
  const file = probeFile();
  const { figma } = file;
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const rows = ["default", "outline"].map((variant) => {
    const row = figma.createComponent();
    row.name = `variant=${variant}`;
    row.layoutMode = "HORIZONTAL";
    row.resize(70, 26);
    const label = figma.createText();
    label.name = "Label";
    label.characters = "Button";
    row.appendChild(label);
    const icon = figma.createFrame();
    icon.name = "Icon";
    row.appendChild(icon);
    return row;
  });
  const [a1, a2] = rows;
  if (a1 === undefined || a2 === undefined) {
    throw new Error("set A holds no rows");
  }
  a1.fills = [
    figma.variables.setBoundVariableForPaint(
      { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
      "color",
      file.variable("Fuse tokens", "primary")
    ),
  ];
  const setA = figma.combineAsVariants(rows, figma.currentPage);
  const label = setA.addComponentProperty("Label", "TEXT", "Button");
  const showIcon = setA.addComponentProperty("Show icon", "BOOLEAN", true);
  for (const row of rows) {
    childNamed(row, "TEXT", "Label").componentPropertyReferences = { characters: label };
    childNamed(row, "FRAME", "Icon").componentPropertyReferences = { visible: showIcon };
  }
  const b = figma.createComponent();
  b.layoutMode = "HORIZONTAL";
  b.layoutSizingHorizontal = "HUG";
  b.layoutSizingVertical = "HUG";
  b.paddingLeft = 16;
  b.paddingRight = 16;
  const instance = a1.createInstance();
  b.appendChild(instance);
  return { file, figma, a1, a2, setA, b, instance, ids: { label, showIcon } };
}

/**
 * NS's additions to N1's sets: Star and Circle icons, each a component that holds a `glyph` layer,
 * and in each row of set A a `Glyph` icon, an instance of Star linked to the INSTANCE_SWAP property
 * `Glyph`.
 */
function withGlyph(probe: Awaited<ReturnType<typeof nested>>) {
  const { figma, setA } = probe;
  const [star, circle] = ["Star", "Circle"].map((name) => {
    const icon = figma.createComponent();
    icon.name = name;
    const glyph = figma.createFrame();
    glyph.name = "glyph";
    icon.appendChild(glyph);
    return icon;
  });
  if (star === undefined || circle === undefined) {
    throw new Error("no icons");
  }
  const glyphId = setA.addComponentProperty("Glyph", "INSTANCE_SWAP", star.id);
  for (const row of setA.children) {
    if (row.type === "COMPONENT") {
      const icon = star.createInstance();
      icon.name = "Glyph";
      row.appendChild(icon);
      icon.componentPropertyReferences = { mainComponent: glyphId };
    }
  }
  return { ...probe, star, circle, glyphId };
}

/** An opaque red paint as the file stores it. */
const RED: SolidPaint = {
  type: "SOLID",
  color: { r: 1, g: 0, b: 0 },
  opacity: 1,
  visible: true,
  blendMode: "NORMAL",
};

/** The variable id a single bound paint names, or undefined for mixed paints or none bound. */
function boundId(figma: PluginAPI, paints: ReadonlyArray<Paint> | PluginAPI["mixed"]): string | undefined {
  const [paint] = paints === figma.mixed ? [] : paints;
  return paint?.type === "SOLID" ? paint.boundVariables?.color?.id : undefined;
}

describe("rule 32: a nested instance stays at its old size until it is read, depth first (N2)", () => {
  it("keeps the hugging component at 102 after its nested row grows, until the row reads 94, then 126", async () => {
    const { a1, b, instance } = await nested();
    expect(b.width).toBe(102);
    a1.resize(94, 26);
    expect(b.width).toBe(102);
    expect(instance.width).toBe(94);
    expect(b.width).toBe(126);
  });

  it("keeps an instance of the hugging component stale until the nested row is read first", async () => {
    const { a1, b, instance } = await nested();
    const outer = b.createInstance();
    a1.resize(94, 26);
    expect(outer.width).toBe(102);
    expect(instance.width).toBe(94);
    expect(outer.width).toBe(126);
  });

  // N4: a resize fixed both axes, and HUG again gave the instance its content's size on that axis.
  it("keeps a resized instance's width and lets the height it hugs again follow the row", async () => {
    const { a1, instance } = await nested();
    instance.resize(80, 20);
    instance.layoutSizingVertical = "HUG";
    a1.resize(94, 30);
    expect([instance.width, instance.height]).toEqual([80, 30]);
  });

  it("settles the nested row before the instance around it in a new run", async () => {
    const { file, a1, b } = await nested();
    const outer = b.createInstance();
    a1.resize(94, 26);
    file.reopen();
    expect(outer.width).toBe(126);
  });
});

describe("rule 34: setProperties writes a nested instance's TEXT, BOOLEAN and VARIANT properties (N1)", () => {
  it("lists the TEXT and BOOLEAN properties by name and id, and the variant by its bare name", async () => {
    const { instance, ids } = await nested();
    expect(instance.componentProperties).toEqual({
      variant: { type: "VARIANT", value: "default" },
      [ids.label]: { type: "TEXT", value: "Button" },
      [ids.showIcon]: { type: "BOOLEAN", value: true },
    });
  });

  it("sets the label's characters, hides the icon and shows the outline row, keeping the node and the values", async () => {
    const { instance, a2, ids } = await nested();
    const id = instance.id;
    instance.setProperties({ [ids.label]: "Retry", [ids.showIcon]: false });
    expect([
      childNamed(instance, "TEXT", "Label").characters,
      childNamed(instance, "FRAME", "Icon").visible,
    ]).toEqual(["Retry", false]);
    instance.setProperties({ variant: "outline" });
    expect((await instance.getMainComponentAsync())?.id).toBe(a2.id);
    expect(instance.id).toBe(id);
    expect(instance.componentProperties).toEqual({
      variant: { type: "VARIANT", value: "outline" },
      [ids.label]: { type: "TEXT", value: "Retry" },
      [ids.showIcon]: { type: "BOOLEAN", value: false },
    });
  });

  it("refuses a variant value the set lacks, a value of the wrong type, and a TEXT write while the label's font is not loaded", async () => {
    const { file, instance, ids } = await nested();
    expect(() => {
      instance.setProperties({ variant: "ghost" });
    }).toThrow("ghost");
    expect(() => {
      instance.setProperties({ [ids.label]: true });
    }).toThrow(ids.label);
    file.reopen();
    expect(() => {
      instance.setProperties({ [ids.label]: "Retry" });
    }).toThrow("unloaded font");
  });

  it("swaps the nested instance's icon to the component whose id it is given, reads the id back and keeps the glyph's override (NS)", async () => {
    const { instance, circle, glyphId } = withGlyph(await nested());
    childNamed(childNamed(instance, "INSTANCE", "Glyph"), "FRAME", "glyph").fills = [RED];
    instance.setProperties({ [glyphId]: circle.id });
    const icon = childNamed(instance, "INSTANCE", "Glyph");
    expect([
      instance.componentProperties[glyphId],
      (await icon.getMainComponentAsync())?.id,
      childNamed(icon, "FRAME", "glyph").fills,
    ]).toEqual([{ type: "INSTANCE_SWAP", value: circle.id }, circle.id, [RED]]);
  });
});

describe("rule 34: an outer instance shows and applies the values its main set", () => {
  // N1: an outer instance shows the values the component set on the instance nested in it.
  it("keeps the nested action's Circle when the outer instance changes the action's variant", async () => {
    const { b, instance, circle, glyphId } = withGlyph(await nested());
    instance.setProperties({ [glyphId]: circle.id });
    const shown = childNamed(b.createInstance(), "INSTANCE", instance.name);
    shown.setProperties({ variant: "outline" });
    expect([
      shown.componentProperties[glyphId],
      (await childNamed(shown, "INSTANCE", "Glyph").getMainComponentAsync())?.id,
    ]).toEqual([{ type: "INSTANCE_SWAP", value: circle.id }, circle.id]);
  });
});

describe("rule 35: swapComponent keeps a nested instance's node, its property values, its link and its exposure (N1, NS)", () => {
  it("keeps the visibility link, the exposure and the swap value through a swap to the outline row (NS)", async () => {
    const { figma, a2, b, instance, circle, glyphId } = withGlyph(await nested());
    b.name = "kind=default";
    const setB = figma.combineAsVariants([b], figma.currentPage);
    const showAction = setB.addComponentProperty("Show action", "BOOLEAN", true);
    instance.componentPropertyReferences = { visible: showAction };
    instance.isExposedInstance = true;
    instance.setProperties({ [glyphId]: circle.id });
    instance.swapComponent(a2);
    expect([
      instance.componentPropertyReferences.visible,
      instance.isExposedInstance,
      instance.componentProperties[glyphId],
      (await childNamed(instance, "INSTANCE", "Glyph").getMainComponentAsync())?.id,
    ]).toEqual([showAction, true, { type: "INSTANCE_SWAP", value: circle.id }, circle.id]);
  });

  it("keeps the id, the label and the hidden icon through a swap to the outline row and back", async () => {
    const { a1, a2, instance, ids } = await nested();
    const id = instance.id;
    instance.setProperties({ [ids.label]: "Retry", [ids.showIcon]: false });
    instance.swapComponent(a2);
    instance.swapComponent(a1);
    expect([
      instance.id,
      instance.componentProperties[ids.label],
      childNamed(instance, "FRAME", "Icon").visible,
    ]).toEqual([id, { type: "TEXT", value: "Retry" }, false]);
  });
});

describe("rule 36: an instance's sublayers carry their main layers' ids and shared plugin data (N1, N3)", () => {
  it("names each sublayer I, the instance's id, a semicolon and the main layer's id, and reads the main layer's key", async () => {
    const { a1, instance } = await nested();
    const label = childNamed(a1, "TEXT", "Label");
    label.setSharedPluginData("fuse", "key", "a/label");
    const shown = childNamed(instance, "TEXT", "Label");
    expect([shown.id, shown.getSharedPluginData("fuse", "key")]).toEqual([
      `I${instance.id};${label.id}`,
      "a/label",
    ]);
  });
});

describe("rules 37 and 38: overrides stay through the main's edits, and the rest follows the main (N1, N2, N3)", () => {
  /** The overrides N3 made: a fill bound to `success`, corner 2 and a shadow on the root, the label's fill bound to `primary`. */
  async function overridden() {
    const probe = await nested();
    const { figma, file, instance } = probe;
    const bound = (name: string): SolidPaint =>
      figma.variables.setBoundVariableForPaint(
        { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
        "color",
        file.variable("Fuse tokens", name)
      );
    instance.fills = [bound("success")];
    instance.cornerRadius = 2;
    instance.effects = [
      {
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 1 },
        radius: 2,
        spread: 0,
        visible: true,
        blendMode: "NORMAL",
      },
    ];
    const label = childNamed(instance, "TEXT", "Label");
    label.fills = [bound("primary")];
    return { ...probe, bound, label };
  }

  /** Each overridden node's id and its fields, in a fixed order. */
  const listed = (instance: InstanceNode) =>
    instance.overrides.map(({ id, overriddenFields }) => [id, [...overriddenFields].sort()]);

  it("lists the instance's own name, width and height, and no property value (N1)", async () => {
    const { instance, ids } = await nested();
    instance.name = "Action";
    instance.resize(80, 26);
    instance.setProperties({ [ids.label]: "Retry" });
    expect(listed(instance)).toEqual([[instance.id, ["height", "name", "width"]]]);
  });

  it("lists the root's fills, effects and corner fields and the label's fills (N3)", async () => {
    const { instance, label } = await overridden();
    expect(listed(instance)).toEqual([
      [
        instance.id,
        [
          "bottomLeftRadius",
          "bottomRightRadius",
          "cornerRadius",
          "effects",
          "fills",
          "topLeftRadius",
          "topRightRadius",
        ],
      ],
      [label.id, ["fills"]],
    ]);
  });

  it("keeps each override when the main changes the same field (N3)", async () => {
    const { a1, file, instance, label, bound } = await overridden();
    a1.fills = [bound("destructive")];
    a1.cornerRadius = 10;
    a1.effects = [];
    childNamed(a1, "TEXT", "Label").fills = [bound("destructive")];
    expect([
      boundId(file.figma, instance.fills),
      instance.cornerRadius,
      instance.effects.length,
      boundId(file.figma, label.fills),
    ]).toEqual([
      file.variable("Fuse tokens", "success").id,
      2,
      1,
      file.variable("Fuse tokens", "primary").id,
    ]);
  });

  it("shows the main's new fill binding and corner where the instance overrides neither, keeping its label (N2)", async () => {
    const { a1, file, instance, ids } = await nested();
    instance.setProperties({ [ids.label]: "Retry" });
    a1.fills = [
      file.figma.variables.setBoundVariableForPaint(
        { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
        "color",
        file.variable("Fuse tokens", "destructive")
      ),
    ];
    a1.cornerRadius = 10;
    expect([
      boundId(file.figma, instance.fills),
      instance.cornerRadius,
      childNamed(instance, "TEXT", "Label").characters,
    ]).toEqual([file.variable("Fuse tokens", "destructive").id, 10, "Retry"]);
  });

  it("drops an override written equal to the main's, so the field follows the main again (NS)", async () => {
    const { a1, file, instance, label, bound } = await overridden();
    instance.name = "Action";
    instance.fills = [bound("primary")];
    instance.cornerRadius = 0;
    instance.effects = [];
    label.fills = childNamed(a1, "TEXT", "Label").fills;
    expect(listed(instance)).toEqual([[instance.id, ["name"]]]);
    a1.fills = [bound("destructive")];
    a1.cornerRadius = 10;
    expect([boundId(file.figma, instance.fills), instance.cornerRadius]).toEqual([
      file.variable("Fuse tokens", "destructive").id,
      10,
    ]);
  });

  // The typings: `removeOverrides` removes every direct override. N3 showed only that it exists.
  it("removes every listed override and keeps the property values, as the typings say", async () => {
    const { file, instance, label, ids } = await overridden();
    instance.setProperties({ [ids.label]: "Retry" });
    instance.removeOverrides();
    expect([
      listed(instance),
      boundId(file.figma, instance.fills),
      instance.cornerRadius,
      boundId(file.figma, label.fills),
      instance.componentProperties[ids.label],
    ]).toEqual([
      [],
      file.variable("Fuse tokens", "primary").id,
      0,
      undefined,
      { type: "TEXT", value: "Retry" },
    ]);
  });
});

describe("rule 39: an instance inside a component in a set can be exposed to the instances around it (N5)", () => {
  it("reads true once exposed, lists it in an outer instance's exposedInstances, and sets its TEXT there", async () => {
    const { figma, b, instance, ids } = await nested();
    b.name = "kind=default";
    figma.combineAsVariants([b], figma.currentPage);
    instance.isExposedInstance = true;
    expect(instance.isExposedInstance).toBe(true);
    const outer = b.createInstance();
    const [exposed, ...others] = outer.exposedInstances;
    expect([exposed?.id, others]).toEqual([`I${outer.id};${instance.id}`, []]);
    exposed?.setProperties({ [ids.label]: "Undo" });
    expect(exposed?.componentProperties[ids.label]).toEqual({ type: "TEXT", value: "Undo" });
  });

  it("stops listing the nested instance in an outer instance once its main layer is no longer exposed", async () => {
    const { figma, b, instance } = await nested();
    b.name = "kind=default";
    figma.combineAsVariants([b], figma.currentPage);
    instance.isExposedInstance = true;
    const outer = b.createInstance();
    const listedBefore = outer.exposedInstances.length;
    instance.isExposedInstance = false;
    expect([
      listedBefore,
      outer.exposedInstances,
      childNamed(outer, "INSTANCE", instance.name).isExposedInstance,
    ]).toEqual([1, [], false]);
  });

  // The typings make it writable only on an instance inside a component or a set, and N5 probed one in a set.
  it("refuses exposure on an instance outside a component in a set", async () => {
    const { b, instance } = await nested();
    expect(() => {
      instance.isExposedInstance = true;
    }).toThrow("only on an instance inside a component in a set");
    expect(() => {
      b.createInstance().isExposedInstance = true;
    }).toThrow("only on an instance inside a component in a set");
  });
});

describe("rule 40: a bound height on an instance that hugs it records the binding and keeps the hug height (N4, NS)", () => {
  // Rule 5 already resizes a frame on a binding; NS read it on a frame that hugged.
  it("turns a frame that hugs its 28px height FIXED at row-h's 32 when the height binds row-h (NS)", () => {
    const { figma, variable } = probeFile();
    const frame = figma.createFrame();
    frame.layoutMode = "HORIZONTAL";
    frame.resize(100, 28);
    frame.layoutSizingVertical = "HUG";
    frame.setBoundVariable("height", variable("Fuse density", "row-h"));
    expect([frame.height, frame.layoutSizingVertical, frame.counterAxisSizingMode]).toEqual([
      32,
      "FIXED",
      "FIXED",
    ]);
  });

  it("keeps the 26px hug height under a row-h binding, and takes row-h's 32 once the height is fixed first", async () => {
    const { file, a1, instance } = await nested();
    a1.layoutSizingVertical = "HUG";
    instance.layoutSizingVertical = "HUG";
    const rowH = file.variable("Fuse density", "row-h");
    instance.setBoundVariable("height", rowH);
    expect([instance.height, instance.boundVariables?.height?.id, instance.layoutSizingVertical]).toEqual([
      26,
      rowH.id,
      "HUG",
    ]);
    instance.layoutSizingVertical = "FIXED";
    instance.setBoundVariable("height", rowH);
    expect([instance.height, instance.layoutSizingVertical]).toEqual([32, "FIXED"]);
  });
});

describe("rule 41: an instance's label keeps a text alignment override (NA)", () => {
  /** Each overridden node's id and its fields, in a fixed order. */
  const listed = (instance: InstanceNode) =>
    instance.overrides.map(({ id, overriddenFields }) => [id, [...overriddenFields].sort()]);

  it("lists the label's alignment override and keeps it through the main's alignment and characters", async () => {
    const { a1, instance } = await nested();
    const label = childNamed(instance, "TEXT", "Label");
    label.textAlignHorizontal = "CENTER";
    expect(listed(instance)).toEqual([[label.id, ["textAlignHorizontal"]]]);
    const main = childNamed(a1, "TEXT", "Label");
    main.textAlignHorizontal = "RIGHT";
    main.characters = "Button now";
    expect([label.textAlignHorizontal, label.characters]).toEqual(["CENTER", "Button now"]);
  });

  it("keeps the override listed after a write equal to the main's, unlike a fill (NA, NS)", async () => {
    const { a1, instance } = await nested();
    const label = childNamed(instance, "TEXT", "Label");
    label.textAlignHorizontal = "CENTER";
    label.textAlignHorizontal = childNamed(a1, "TEXT", "Label").textAlignHorizontal;
    expect(listed(instance)).toEqual([[label.id, ["textAlignHorizontal"]]]);
  });

  // Rule 38's model: a sublayer shows its main layer's field until it overrides it.
  it("shows the main's alignment on a label that overrides none", async () => {
    const { a1, instance } = await nested();
    childNamed(a1, "TEXT", "Label").textAlignHorizontal = "RIGHT";
    expect(childNamed(instance, "TEXT", "Label").textAlignHorizontal).toBe("RIGHT");
  });
});

describe("an empty TEXT property keeps a filling text's width and one line's height (PE3)", () => {
  /**
   * The component PE3 built: a row fixed at 256 × 36, padded 10 and centred, holding a text that fills
   * across and follows its lines, linked to the TEXT property `Text`, and an instance of it filling a
   * column fixed at 256. The real file read the text 236 wide; the fake lays out no fill along a row's
   * direction, so the text keeps the width the fake measures, and the tests read what PE3 says the
   * empty value keeps.
   */
  async function inputLike() {
    const { figma } = probeFile();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const main = figma.createComponent();
    main.layoutMode = "HORIZONTAL";
    main.resize(256, 36);
    main.paddingLeft = 10;
    main.paddingRight = 10;
    main.paddingTop = 10;
    main.paddingBottom = 10;
    main.counterAxisAlignItems = "CENTER";
    const text = figma.createText();
    text.name = "Text";
    text.characters = "Value";
    main.appendChild(text);
    text.layoutSizingHorizontal = "FILL";
    const property = main.addComponentProperty("Text", "TEXT", "Value");
    text.componentPropertyReferences = { characters: property };
    const column = figma.createFrame();
    column.layoutMode = "VERTICAL";
    column.resize(256, 100);
    const instance = main.createInstance();
    column.appendChild(instance);
    instance.layoutSizingHorizontal = "FILL";
    return { property, instance, mainText: text };
  }

  /** What PE3 read unchanged by the empty value: the text's size, sizing and resize, and the instance's height. */
  const kept = (instance: InstanceNode) => {
    const text = childNamed(instance, "TEXT", "Text");
    return [text.width, text.height, text.layoutSizingHorizontal, text.textAutoResize, instance.height];
  };

  it("keeps the text's size, its fill and its lines, and the instance's 36px height, with no override", async () => {
    const { property, instance, mainText } = await inputLike();
    expect(mainText.width).toBeGreaterThan(0);
    const before = kept(instance);
    instance.setProperties({ [property]: "" });
    expect([childNamed(instance, "TEXT", "Text").characters, ...kept(instance), instance.overrides]).toEqual([
      "",
      mainText.width,
      mainText.height,
      "FILL",
      "HEIGHT",
      36,
      [],
    ]);
    expect(kept(instance)).toEqual(before);
  });

  it("reads the same for an instance set to the empty value before any read", async () => {
    const { property, instance, mainText } = await inputLike();
    instance.setProperties({ [property]: "" });
    expect(kept(instance)).toEqual([mainText.width, mainText.height, "FILL", "HEIGHT", 36]);
  });
});

describe("rule 43: one icon instance links a BOOLEAN's visible and an INSTANCE_SWAP together (PI2, PI3)", () => {
  /**
   * The set PI2 built: two 16px glyph components, `Icon/A` and `Icon/B`, and a variant row that hugs,
   * gap 8 and padded 8 across, holding an instance of `Icon/A` named `icon` and a 14px text. The set
   * has a BOOLEAN `Icon`, default false, and an INSTANCE_SWAP `Icon glyph`, default `Icon/A`, and the
   * icon links both.
   */
  async function iconRow() {
    const { figma } = probeFile();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const [a, b] = ["Icon/A", "Icon/B"].map((name) => {
      const glyph = figma.createComponent();
      glyph.name = name;
      glyph.resize(16, 16);
      return glyph;
    });
    if (a === undefined || b === undefined) {
      throw new Error("no glyphs");
    }
    const row = figma.createComponent();
    row.name = "state=rest";
    row.layoutMode = "HORIZONTAL";
    row.layoutSizingHorizontal = "HUG";
    row.layoutSizingVertical = "HUG";
    row.itemSpacing = 8;
    row.paddingLeft = 8;
    row.paddingRight = 8;
    const icon = a.createInstance();
    icon.name = "icon";
    row.appendChild(icon);
    const text = figma.createText();
    text.characters = "Rename";
    row.appendChild(text);
    const set = figma.combineAsVariants([row], figma.currentPage);
    const shown = set.addComponentProperty("Icon", "BOOLEAN", false);
    const glyph = set.addComponentProperty("Icon glyph", "INSTANCE_SWAP", a.id);
    icon.componentPropertyReferences = { visible: shown, mainComponent: glyph };
    return { a, b, row, icon, ids: { shown, glyph } };
  }

  it("reads both links back and hides the main's icon while the BOOLEAN starts false", async () => {
    const { icon, ids } = await iconRow();
    expect([icon.componentPropertyReferences, icon.visible]).toEqual([
      { visible: ids.shown, mainComponent: ids.glyph },
      false,
    ]);
  });

  it("shows, swaps and hides an instance's icon, keeping both links and the swap value", async () => {
    const { a, b, row, ids } = await iconRow();
    const instance = row.createInstance();
    const read = async () => {
      const icon = childNamed(instance, "INSTANCE", "icon");
      return [icon.visible, (await icon.getMainComponentAsync())?.name, icon.componentPropertyReferences];
    };
    const links = { visible: ids.shown, mainComponent: ids.glyph };
    expect(await read()).toEqual([false, a.name, links]);
    instance.setProperties({ [ids.shown]: true });
    expect(await read()).toEqual([true, a.name, links]);
    instance.setProperties({ [ids.glyph]: b.id });
    expect(await read()).toEqual([true, b.name, links]);
    instance.setProperties({ [ids.shown]: false });
    expect([...(await read()), instance.componentProperties[ids.glyph]]).toEqual([
      false,
      b.name,
      links,
      { type: "INSTANCE_SWAP", value: b.id },
    ]);
    instance.setProperties({ [ids.shown]: true });
    expect(await read()).toEqual([true, b.name, links]);
  });

  /** The icon's name and whether the instance lists its `name` among the overrides. */
  const nameOf = (instance: InstanceNode) => {
    const icon = onlyChildOfType(instance, "INSTANCE");
    return [
      icon.name,
      instance.overrides.find((entry) => entry.id === icon.id)?.overriddenFields.includes("name") === true,
    ];
  };

  // PI3: the swap keeps `icon` and lists `name`; a swap back to `Icon/A` keeps it listed.
  it("keeps the icon's name through a swap and back, and lists its name among the overrides (PI3)", async () => {
    const { a, b, row, ids } = await iconRow();
    const instance = row.createInstance();
    instance.setProperties({ [ids.shown]: true });
    expect(nameOf(instance)).toEqual(["icon", false]);
    instance.setProperties({ [ids.glyph]: b.id });
    expect(nameOf(instance)).toEqual(["icon", true]);
    instance.setProperties({ [ids.glyph]: a.id });
    expect(nameOf(instance)).toEqual(["icon", true]);
  });

  // PI3: a name a designer gave the icon stays through the swap.
  it("keeps a hand-set name through a swap (PI3)", async () => {
    const { b, row, ids } = await iconRow();
    const instance = row.createInstance();
    onlyChildOfType(instance, "INSTANCE").name = "custom";
    instance.setProperties({ [ids.shown]: true, [ids.glyph]: b.id });
    expect(nameOf(instance)).toEqual(["custom", true]);
  });
});

describe("rule 44: a minimum width on an instance root is an override that stays listed (PH3)", () => {
  /** PH3's row: a component fixed 88 wide with a text, and an instance of it in a hugging column. */
  async function minimumRow() {
    const { figma } = probeFile();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const row = figma.createComponent();
    row.layoutMode = "HORIZONTAL";
    row.resize(88, 36);
    const label = figma.createText();
    label.characters = "Messages";
    row.appendChild(label);
    const column = figma.createFrame();
    column.layoutMode = "VERTICAL";
    column.layoutSizingHorizontal = "HUG";
    column.layoutSizingVertical = "HUG";
    const instance = row.createInstance();
    column.appendChild(instance);
    return instance;
  }

  /** The fields the instance's root lists among its overrides. */
  const listed = (instance: InstanceNode) =>
    instance.overrides.find((entry) => entry.id === instance.id)?.overriddenFields ?? [];

  it("lists minWidth and minHeight once minWidth is written, with minHeight reading null", async () => {
    const instance = await minimumRow();
    instance.minWidth = 88;
    expect([instance.minWidth, instance.minHeight, listed(instance)]).toEqual([
      88,
      null,
      expect.arrayContaining(["minWidth", "minHeight"]),
    ]);
  });

  it("keeps both listed after a reset to null", async () => {
    const instance = await minimumRow();
    instance.minWidth = 88;
    instance.minWidth = null;
    expect([instance.minWidth, listed(instance)]).toEqual([
      null,
      expect.arrayContaining(["minWidth", "minHeight"]),
    ]);
  });
});

/**
 * PN's sets: a `Kbd` cap whose 12px text links the TEXT property `Label`, default `K`; a `Kbd group`
 * holding two exposed caps, `kbd-1` set to `Ctrl` and `kbd-2`; and a `Command item` set of two rows,
 * `highlighted=false` and `true`, each holding a text linked to `Label` and an exposed `kbd-group`.
 */
async function twoLevels(capNames: readonly [string, string] = ["kbd-1", "kbd-2"]) {
  const file = probeFile();
  const { figma } = file;
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const labelled = (name: string, characters: string) => {
    const component = figma.createComponent();
    component.name = name;
    component.layoutMode = "HORIZONTAL";
    const text = figma.createText();
    text.name = "label";
    text.characters = characters;
    component.appendChild(text);
    return { component, text };
  };
  const cap = labelled("content=text", "K");
  const kbd = figma.combineAsVariants([cap.component], figma.currentPage);
  const capLabel = kbd.addComponentProperty("Label", "TEXT", "K");
  cap.text.componentPropertyReferences = { characters: capLabel };
  const group = figma.createComponent();
  group.name = "keys=2";
  group.layoutMode = "HORIZONTAL";
  const caps = capNames.map((name) => {
    const instance = cap.component.createInstance();
    instance.name = name;
    group.appendChild(instance);
    return instance;
  });
  figma.combineAsVariants([group], figma.currentPage);
  caps[0]?.setProperties({ [capLabel]: "Ctrl" });
  for (const instance of caps) {
    instance.isExposedInstance = true;
  }
  const rows = ["false", "true"].map((highlighted) => {
    const row = labelled(`highlighted=${highlighted}`, "New customer");
    const shortcut = group.createInstance();
    shortcut.name = "kbd-group";
    row.component.appendChild(shortcut);
    return { ...row, shortcut };
  });
  const item = figma.combineAsVariants(
    rows.map(({ component }) => component),
    figma.currentPage
  );
  const rowLabel = item.addComponentProperty("Label", "TEXT", "New customer");
  for (const row of rows) {
    row.text.componentPropertyReferences = { characters: rowLabel };
    row.shortcut.isExposedInstance = true;
  }
  const [first] = rows;
  if (first === undefined) {
    throw new Error("the item set holds no rows");
  }
  return { figma, group, kbd, cap, row: first.component.createInstance(), ids: { capLabel, rowLabel } };
}

/** The caps a row shows through its exposed group, and their TEXT values, in layer order. */
function capsOf(row: InstanceNode, capLabel: string) {
  const group = row.exposedInstances.find((instance) => instance.name === "kbd-group");
  const caps = group?.exposedInstances ?? [];
  return { caps, values: caps.map((instance) => instance.componentProperties[capLabel]?.value) };
}

describe("rule 45: TEXT values set through exposure two levels down stay through the outer instance's writes (PN)", () => {
  it("lists instances exposed two levels down, and each cap shows its group's value", async () => {
    const { row, ids } = await twoLevels();
    expect(row.exposedInstances.map((instance) => instance.name)).toEqual(["kbd-group", "kbd-1", "kbd-2"]);
    expect(capsOf(row, ids.capLabel).values).toEqual(["Ctrl", "K"]);
  });

  it("sets each cap's TEXT through exposure and lists `componentProperties` among the row's overrides", async () => {
    const { row, ids } = await twoLevels();
    const { caps } = capsOf(row, ids.capLabel);
    caps[0]?.setProperties({ [ids.capLabel]: "Alt" });
    caps[1]?.setProperties({ [ids.capLabel]: "N" });
    expect(capsOf(row, ids.capLabel).values).toEqual(["Alt", "N"]);
    expect(
      row.overrides
        .filter(({ id }) => caps.some((instance) => instance.id === id))
        .map((entry) => entry.overriddenFields)
    ).toEqual([["componentProperties"], ["componentProperties"]]);
  });

  it("keeps the caps' values through the row's own TEXT write, a variant switch and edits of the mains, which give the caps new ids", async () => {
    const { row, ids, group, cap } = await twoLevels();
    const { caps } = capsOf(row, ids.capLabel);
    caps[0]?.setProperties({ [ids.capLabel]: "Alt" });
    caps[1]?.setProperties({ [ids.capLabel]: "N" });
    const before = caps.map((instance) => instance.id);
    row.setProperties({ [ids.rowLabel]: "Customers" });
    expect(capsOf(row, ids.capLabel).values).toEqual(["Alt", "N"]);
    row.setProperties({ highlighted: "true" });
    const after = capsOf(row, ids.capLabel);
    expect(after.values).toEqual(["Alt", "N"]);
    expect(after.caps.map((instance) => instance.id).some((id) => before.includes(id))).toBe(false);
    group.itemSpacing = 6;
    cap.component.paddingLeft = 4;
    expect(capsOf(row, ids.capLabel).values).toEqual(["Alt", "N"]);
  });
});

// PN2: the kit names both caps `kbd`, their data-slot, and Figma keeps each value with the same-named
// cap in the same place.
describe("rule 45: same-named caps keep their own values through a variant switch (PN2)", () => {
  it("keeps the first cap's and the second cap's values on each", async () => {
    const { row, ids } = await twoLevels(["kbd", "kbd"]);
    const { caps } = capsOf(row, ids.capLabel);
    caps[0]?.setProperties({ [ids.capLabel]: "Alt" });
    caps[1]?.setProperties({ [ids.capLabel]: "N" });
    row.setProperties({ highlighted: "true" });
    expect(capsOf(row, ids.capLabel).values).toEqual(["Alt", "N"]);
    row.setProperties({ highlighted: "false" });
    expect(capsOf(row, ids.capLabel).values).toEqual(["Alt", "N"]);
  });

  it("keeps a value set on the second cap alone on the second", async () => {
    const { row, ids } = await twoLevels(["kbd", "kbd"]);
    capsOf(row, ids.capLabel).caps[1]?.setProperties({ [ids.capLabel]: "M" });
    row.setProperties({ highlighted: "true" });
    expect(capsOf(row, ids.capLabel).values).toEqual(["Ctrl", "M"]);
  });
});

describe("rule 48: a swapped sublayer reads its new main component's shared plugin data (PK)", () => {
  /**
   * The owner's file as PK read it: the Icons `Plus` and `CaretDown` keyed `icon/Plus` and
   * `icon/CaretDown`, and an `Icon button` variant holding a Plus instance named `Icon`, keyed
   * `icon-only` and linked to the INSTANCE_SWAP property `Icon`.
   */
  function iconButton() {
    const { figma } = probeFile();
    const [plus, caret] = ["Plus", "CaretDown"].map((name) => {
      const glyph = figma.createComponent();
      glyph.name = name;
      glyph.setSharedPluginData("fuse", "key", `icon/${name}`);
      return glyph;
    });
    if (plus === undefined || caret === undefined) {
      throw new Error("no icons");
    }
    const button = figma.createComponent();
    button.name = "variant=ghost, size=icon-sm, state=rest";
    const icon = plus.createInstance();
    icon.name = "Icon";
    icon.setSharedPluginData("fuse", "key", "icon-only");
    button.appendChild(icon);
    const set = figma.combineAsVariants([button], figma.currentPage);
    const swap = set.addComponentProperty("Icon", "INSTANCE_SWAP", plus.id);
    icon.componentPropertyReferences = { mainComponent: swap };
    return { figma, button, caret, icon, instance: button.createInstance(), swap };
  }

  /** The swapped layer's key, name, place and id, and the key of the main's layer at that place. */
  const read = (instance: InstanceNode, icon: InstanceNode) => {
    const [only, ...rest] = instance.children;
    return [
      only?.getSharedPluginData("fuse", "key"),
      only?.name,
      rest.length,
      only?.id,
      icon.getSharedPluginData("fuse", "key"),
    ];
  };

  it("reads icon/CaretDown on a layer the Icon property swaps, and icon-only on the main's layer", () => {
    const { caret, icon, instance, swap } = iconButton();
    instance.setProperties({ [swap]: caret.id });
    expect(read(instance, icon)).toEqual([
      "icon/CaretDown",
      "Icon",
      0,
      `I${instance.id};${icon.id}`,
      "icon-only",
    ]);
  });

  it("reads icon/CaretDown on a layer swapComponent swaps, and icon-only on the main's layer", () => {
    const { caret, icon, instance } = iconButton();
    onlyChildOfType(instance, "INSTANCE").swapComponent(caret);
    expect(read(instance, icon)).toEqual([
      "icon/CaretDown",
      "Icon",
      0,
      `I${instance.id};${icon.id}`,
      "icon-only",
    ]);
  });

  // PK read the swap inside the Input group's variant; an Input group instance shows that variant.
  it("shows the swapped icon's main and key on an instance of the component that holds it", async () => {
    const { figma, button, caret, swap } = iconButton();
    const group = figma.createComponent();
    const held = button.createInstance();
    group.appendChild(held);
    const icon = onlyChildOfType(onlyChildOfType(group.createInstance(), "INSTANCE"), "INSTANCE");
    held.setProperties({ [swap]: caret.id });
    expect([(await icon.getMainComponentAsync())?.name, icon.getSharedPluginData("fuse", "key")]).toEqual([
      "CaretDown",
      "icon/CaretDown",
    ]);
  });

  // PK2: a swap made on the main's own layer keeps that layer's key, and the instance follows it.
  it("keeps icon-only on a main's own swapped layer and on an instance's sublayer that shows Q (PK2)", async () => {
    const { figma } = probeFile();
    const [p, q] = ["P", "Q"].map((name) => {
      const component = figma.createComponent();
      component.name = name;
      component.resize(16, 16);
      component.setSharedPluginData("fuse", "key", `icon/${name}`);
      const glyph = figma.createFrame();
      glyph.name = "glyph";
      component.appendChild(glyph);
      return component;
    });
    if (p === undefined || q === undefined) {
      throw new Error("no components");
    }
    const m = figma.createComponent();
    m.layoutMode = "HORIZONTAL";
    m.layoutSizingHorizontal = "HUG";
    m.layoutSizingVertical = "HUG";
    const icon = p.createInstance();
    icon.name = "Icon";
    icon.setSharedPluginData("fuse", "key", "icon-only");
    m.appendChild(icon);
    const i = m.createInstance();
    const row = async () => {
      const sublayer = onlyChildOfType(i, "INSTANCE");
      return [
        icon.getSharedPluginData("fuse", "key"),
        (await icon.getMainComponentAsync())?.name,
        sublayer.getSharedPluginData("fuse", "key"),
        (await sublayer.getMainComponentAsync())?.name,
        sublayer.children.map((child) => child.name),
        i.overrides,
      ];
    };
    expect(await row()).toEqual(["icon-only", "P", "icon-only", "P", ["glyph"], []]);
    icon.swapComponent(q);
    expect(await row()).toEqual(["icon-only", "Q", "icon-only", "Q", ["glyph"], []]);
  });
});
