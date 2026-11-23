/**
 * Moves of layers that hold a font Figma cannot load, on the in-memory file in `fake-figma.ts`. Unit
 * under test: the plan's reorder of a set's variants and its page placement. Oracle: the fake's rule
 * 69, after the owner's Apply on 2026-11-23 stopped with `in insertChild: unloaded font "Neo Sans
 * Medium"`, under which Figma refuses to move a layer whose texts hold a font it cannot load. A Button
 * label binds `font-sans`, which names Neo Sans in the brand's `fkas` mode, so a layer pinned to that
 * mode holds Neo Sans Medium, which this machine lacks, as the owner's lacks it (#525).
 */
import { describe, expect, it } from "vitest";

import type { ComponentSetSpec, KitSpec, VariantSpec } from "../../src/components/kit-spec.ts";
import { KIT, LABEL, outerKit } from "./button-kit-fixture.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const NEO_SANS = { family: "Neo Sans", style: "Medium" };

/** The fixture kit's Button set. */
function button(): ComponentSetSpec {
  const [set] = KIT.componentSets;
  if (set === undefined) {
    throw new Error("The fixture kit holds no Button set.");
  }
  return set;
}

const BUTTON = button();

/** The fixture Button set's one variant. */
function md(): VariantSpec {
  const [found] = BUTTON.variants;
  if (found === undefined) {
    throw new Error("The fixture Button set holds no variant.");
  }
  return found;
}

const MD = md();

/** The Button variant of a size. */
function sized(size: string): VariantSpec {
  return { ...MD, key: `button/size=${size}`, properties: { size } };
}

/** The fixture kit with a Button set of the given sizes, in kit order. */
function kitOf(sizes: readonly string[]): KitSpec {
  const set: ComponentSetSpec = {
    ...BUTTON,
    axes: [{ name: "size", values: sizes }],
    variants: sizes.map(sized),
  };
  return { ...KIT, componentSets: [set] };
}

const kit = kitOf(["sm", "md", "lg"]);

/** A synced file whose `font-sans` names Roboto in the brand's default mode and Neo Sans in `fkas`. */
function brandedFile(): FakeFigma {
  return createFakeFigma({
    collections: [
      {
        name: "Fuse tokens",
        modes: ["Default"],
        variables: [
          {
            name: "background",
            type: "COLOR",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([["Default", { _tag: "Color", color: { r: 1, g: 1, b: 1, a: 1 } }]]),
          },
          {
            name: "font-sans",
            type: "STRING",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Default", { _tag: "Alias", target: { collection: "Fuse brand", variable: "font-sans" } }],
            ]),
          },
        ],
      },
      {
        name: "Fuse brand",
        modes: ["Default", "fkas"],
        variables: [
          {
            name: "font-sans",
            type: "STRING",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Default", { _tag: "String", value: "Roboto" }],
              ["fkas", { _tag: "String", value: "Neo Sans" }],
            ]),
          },
        ],
      },
    ],
  });
}

/** The kit page, loaded. */
async function kitPage(file: FakeFigma): Promise<PageNode> {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  if (page === undefined) {
    throw new Error("the file holds no kit page");
  }
  await page.loadAsync();
  return page;
}

/** The Button set on the kit page. */
async function buttonSet(file: FakeFigma): Promise<ComponentSetNode> {
  const set = (await kitPage(file)).children.find((node) => node.type === "COMPONENT_SET");
  if (set?.type !== "COMPONENT_SET") {
    throw new Error("the kit page holds no Button set");
  }
  return set;
}

/** The variant of a size. */
function variant(set: ComponentSetNode, size: string): ComponentNode {
  const found = set.children.find((node) => keyOf(node) === `button/size=${size}`);
  if (found?.type !== "COMPONENT") {
    throw new Error(`the set holds no ${size} variant`);
  }
  return found;
}

/** Pin a layer to the brand's `fkas` mode, where its labels bound to `font-sans` show Neo Sans. */
async function brand(file: FakeFigma, node: SceneNode): Promise<void> {
  const collections = await file.figma.variables.getLocalVariableCollectionsAsync();
  const collection = collections.find((each) => each.name === "Fuse brand");
  const mode = collection?.modes.find((each) => each.name === "fkas");
  if (collection === undefined || mode === undefined) {
    throw new Error("the file holds no fkas mode");
  }
  node.setExplicitVariableModeForCollection(collection, mode.modeId);
}

/** The keys of a parent's children, in layer order. */
function order(parent: ChildrenMixin): string[] {
  return parent.children.map(keyOf);
}

/**
 * A file the kit was applied to, with the variants of the given sizes pinned to `fkas`, its set's
 * variants then put in the given order, and the file reopened on a machine without Neo Sans.
 */
async function arranged(pinned: readonly string[], sizes: readonly string[]): Promise<FakeFigma> {
  const file = brandedFile();
  await reconcileKit(file.figma, kit, true);
  await file.figma.loadFontAsync(NEO_SANS);
  for (const size of pinned) {
    await brand(file, variant(await buttonSet(file), size));
  }
  // A run gives each pinned variant's label the face its modes name, Neo Sans Medium, which drops
  // the family binding (rule 50), and the next run binds the family again.
  file.reopen();
  await reconcileKit(file.figma, kit, true);
  file.reopen();
  await reconcileKit(file.figma, kit, true);
  const set = await buttonSet(file);
  for (const [index, size] of sizes.entries()) {
    set.insertChild(index, variant(set, size));
  }
  file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
  return file;
}

describe("a move of a layer that holds a font Figma cannot load", () => {
  it("reorders the other variants around a variant that holds one, and the next Plan lists nothing", async () => {
    const file = await arranged(["lg"], ["lg", "sm", "md"]);
    const report = await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect({
      order: order(await buttonSet(file)),
      reorder: report.changes.filter((line) => line.includes("reorder")),
    }).toEqual({
      order: ["button/size=sm", "button/size=md", "button/size=lg"],
      reorder: [
        "Button: reorder the variants around size=lg (Neo Sans Medium), whose fonts Figma cannot load",
      ],
    });
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });

  it("warns and keeps the order where two variants that hold one stand out of order", async () => {
    const file = await arranged(["sm", "lg"], ["lg", "md", "sm"]);
    const warning =
      "Button: keeps its variants out of order, since Figma cannot load the fonts of size=sm (Neo Sans Medium), size=lg (Neo Sans Medium)";
    const report = await reconcileKit(file.figma, kit, true);
    expect({
      order: order(await buttonSet(file)),
      reorder: report.changes.filter((line) => line.includes("reorder")),
      warnings: report.warnings,
    }).toEqual({
      order: ["button/size=lg", "button/size=md", "button/size=sm"],
      reorder: [],
      warnings: [warning],
    });
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [warning] });
  });

  it("puts the set above a labels frame that holds one, and the next Plan lists nothing", async () => {
    const file = brandedFile();
    await reconcileKit(file.figma, kit, true);
    await file.figma.loadFontAsync(NEO_SANS);
    const page = await kitPage(file);
    const frame = page.children.find((node) => keyOf(node) === "docs/page/labels/button");
    if (frame?.type !== "FRAME") {
      throw new Error("the kit page holds no Button labels frame");
    }
    // A designer's note in Neo Sans Medium in the labels frame, which then stands above the set.
    const note = file.figma.createText();
    note.fontName = NEO_SANS;
    note.characters = "Note";
    frame.appendChild(note);
    page.appendChild(frame);
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    await reconcileKit(file.figma, kit, true);
    const keys = order(await kitPage(file)).filter(
      (key) => key === "docs/page/labels/button" || key === "button"
    );
    expect(keys).toEqual(["docs/page/labels/button", "button"]);
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});

/**
 * The nested kit: a Button set of sizes sm and md, and an Outer set of sizes sm and md, each Outer
 * variant holding an instance of the md Button.
 */
function swappedKit(): KitSpec {
  const base = outerKit(LABEL);
  const [inner, outer] = base.componentSets;
  if (inner === undefined || outer === undefined) {
    throw new Error("the nested kit holds no Button and Outer sets");
  }
  const sizes = ["sm", "md"];
  const [innerMd] = inner.variants;
  const [outerMd] = outer.variants;
  if (innerMd === undefined || outerMd === undefined) {
    throw new Error("the nested kit's sets hold no variant");
  }
  return {
    ...base,
    componentSets: [
      {
        ...inner,
        axes: [{ name: "size", values: sizes }],
        variants: sizes.map((size) => ({ ...innerMd, key: `button/size=${size}`, properties: { size } })),
      },
      {
        ...outer,
        axes: [{ name: "size", values: sizes }],
        variants: sizes.map((size) => ({ ...outerMd, key: `outer/size=${size}`, properties: { size } })),
      },
    ],
  };
}

/**
 * A file the nested kit was applied to, with the md Button pinned to `fkas`, so it and every Outer
 * variant, through its instance, hold Neo Sans Medium, and the sm Outers' instances given in `swapped`
 * pointed at the sm Button, which holds Roboto, as a designer might.
 */
async function nestedFile(swapped: readonly string[]) {
  const nested = swappedKit();
  const file = brandedFile();
  await reconcileKit(file.figma, nested, true);
  await file.figma.loadFontAsync(NEO_SANS);
  const page = await kitPage(file);
  const layer = (key: string): SceneNode => {
    const found = page.children.find((node) => keyOf(node) === key);
    if (found === undefined) {
      throw new Error(`the kit page holds no ${key}`);
    }
    return found;
  };
  const setOf = (key: string): ComponentSetNode => {
    const found = layer(key);
    if (found.type !== "COMPONENT_SET") {
      throw new Error(`${key} is no set`);
    }
    return found;
  };
  const member = (set: ComponentSetNode, key: string): ComponentNode => {
    const found = set.children.find((node) => keyOf(node) === key);
    if (found?.type !== "COMPONENT") {
      throw new Error(`the set holds no ${key}`);
    }
    return found;
  };
  await brand(file, member(setOf("button"), "button/size=md"));
  file.reopen();
  await reconcileKit(file.figma, nested, true);
  file.reopen();
  await reconcileKit(file.figma, nested, true);
  for (const key of swapped) {
    const [instance] = member(setOf("outer"), key).children;
    if (instance?.type !== "INSTANCE") {
      throw new Error(`${key} holds no instance`);
    }
    instance.swapComponent(member(setOf("button"), "button/size=sm"));
  }
  return { file, nested, page, layer, setOf, member };
}

describe("a move of a layer that a write earlier in the run gives such a font", () => {
  it("leaves the order the plan cannot restore any more, and the next Plan warns", async () => {
    // Plan reads the sm Outer without Neo Sans, and Apply's swap back to the md Button gives it Neo
    // Sans before the reorder runs.
    const { file, nested, setOf, member } = await nestedFile(["outer/size=sm"]);
    const outer = setOf("outer");
    outer.insertChild(0, member(outer, "outer/size=md"));
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    await reconcileKit(file.figma, nested, true);
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    expect({
      order: order(setOf("outer")),
      plan: await reconcileKit(file.figma, nested, false),
    }).toEqual({
      order: ["outer/size=md", "outer/size=sm"],
      plan: {
        changes: [],
        warnings: [
          "Outer: keeps its variants out of order, since Figma cannot load the fonts of size=sm (Neo Sans Medium), size=md (Neo Sans Medium)",
        ],
      },
    });
  });

  it("leaves a labels frame above its set where the swaps give the set one too", async () => {
    // Plan reads the Outer set without Neo Sans and plans to move it above its labels frame, which
    // holds a note in Neo Sans. Apply's swaps give the set Neo Sans before the placement runs.
    const { file, nested, page, layer } = await nestedFile(["outer/size=sm", "outer/size=md"]);
    const frame = layer("docs/page/labels/outer");
    if (frame.type !== "FRAME") {
      throw new Error("the Outer labels frame is no frame");
    }
    const note = file.figma.createText();
    note.fontName = NEO_SANS;
    note.characters = "Note";
    frame.appendChild(note);
    page.appendChild(frame);
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    await reconcileKit(file.figma, nested, true);
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    const plan = await reconcileKit(file.figma, nested, false);
    expect({
      order: order(await kitPage(file)).filter((key) => key === "docs/page/labels/outer" || key === "outer"),
      changes: plan.changes,
      warnings: plan.warnings.filter((line) => line.startsWith("Fuse components: keeps")),
    }).toEqual({
      order: ["outer", "docs/page/labels/outer"],
      changes: [],
      warnings: [
        "Fuse components: keeps Outer labels above Outer, since Figma cannot load Neo Sans Medium in Outer labels or Neo Sans Medium in Outer",
      ],
    });
  });
});

describe("the fake's moves", () => {
  /** A page with three frames, A, B and C, the first of which holds a Neo Sans Medium text. */
  async function frames(): Promise<{ file: FakeFigma; page: PageNode; nodes: readonly FrameNode[] }> {
    const file = brandedFile();
    const page = file.figma.currentPage;
    const nodes = ["A", "B", "C"].map((name) => {
      const frame = file.figma.createFrame();
      frame.name = name;
      page.appendChild(frame);
      return frame;
    });
    await file.figma.loadFontAsync(NEO_SANS);
    const text = file.figma.createText();
    text.fontName = NEO_SANS;
    text.characters = "Heading";
    nodes[0]?.appendChild(text);
    return { file, page, nodes };
  }

  it("refuses to move a layer that holds a font the machine cannot load, with Figma's message", async () => {
    const { file, page, nodes } = await frames();
    file.reopen({ unavailableFonts: [{ family: "Neo Sans" }] });
    const [a] = nodes;
    if (a === undefined) {
      throw new Error("no frame A");
    }
    const message =
      'unloaded font "Neo Sans Medium". Please call figma.loadFontAsync({ family: "Neo Sans", style: "Medium" }) and await the returned promise first.';
    expect(() => page.insertChild(2, a)).toThrow(`in insertChild: ${message}`);
    expect(() => page.appendChild(a)).toThrow(`in appendChild: ${message}`);
  });

  it("moves a layer that holds a font the run has not loaded but can (MV1, MV2)", async () => {
    const { file, page, nodes } = await frames();
    file.reopen();
    const [a] = nodes;
    if (a === undefined) {
      throw new Error("no frame A");
    }
    page.appendChild(a);
    expect(page.children.map((node) => node.name)).toEqual(["B", "C", "A"]);
  });

  it("counts insertChild's index among the children before the move (MV3)", async () => {
    const { page, nodes } = await frames();
    const [a, , c] = nodes;
    if (a === undefined || c === undefined) {
      throw new Error("no frames A and C");
    }
    page.insertChild(2, a);
    const later = page.children.map((node) => node.name);
    page.insertChild(1, c);
    expect([later, page.children.map((node) => node.name)]).toEqual([
      ["B", "A", "C"],
      ["B", "C", "A"],
    ]);
  });
});
