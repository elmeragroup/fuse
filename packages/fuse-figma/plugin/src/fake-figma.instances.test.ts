/**
 * The instance rules of the in-memory file in `fake-figma.ts`: an instance of a set's variant nested
 * in another component, its properties, swaps, overrides, exposure and size. The oracle is what the
 * test file `Elmera Fuse - Import test` read back in the net-zero probes N1 to N5 on 2026-10-23 and NS
 * on 2026-10-24, as the fake's header names them, and the typings where no probe ran. The planners' instance tests
 * converge against these rules, so a rule that drifts from the real file would let a plan pass that
 * Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { childNamed, color, fixtureFile, float } from "./fake-fixtures.ts";

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
