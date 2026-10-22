/**
 * `reconcileKit` with a one-variant kit on the in-memory file in `fake-figma.ts`, for a file
 * whose kit page holds a stale preview and no component set. The label's family follows
 * `font-sans`, which aliases a brand variable, so the run resolves it across collections before
 * it writes (rule 8) and needs the font it names (rule 7). The oracles are the change lines Plan
 * lists and the writes the file took.
 */
import { describe, expect, it } from "vitest";

import { NO_LIMITS } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  KitSpec,
  NumberSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { aliasOf, childNamed, color, fixtureFile, string } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const literal = (value: number): NumberSpec => ({ kind: "literal", value });

/** The label of the one Button variant, whose family follows `font-sans`. */
const LABEL: TextLayerSpec = {
  kind: "text",
  key: "button/label",
  name: "Label",
  characters: "Button",
  textProperty: undefined,
  fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
  fontStyle: "Medium",
  fontSize: literal(14),
  lineHeight: literal(20),
  color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
  underline: undefined,
};

/** A kit with one Button variant, no icons and no previews, which bundles Roboto Medium. */
const KIT: KitSpec = {
  pages: [{ key: "page", name: "Fuse components" }],
  fonts: [{ family: "Roboto", style: "Medium" }],
  icons: {
    key: "icons",
    page: "page",
    name: "Icons",
    size: 16,
    color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
    icons: [],
  },
  componentSets: [
    {
      key: "button",
      page: "page",
      name: "Button",
      axes: [{ name: "size", values: ["md"] }],
      columnAxis: "size",
      textProperties: [],
      swapProperties: [],
      variants: [
        {
          key: "button/size=md",
          properties: { size: "md" },
          root: {
            name: "button",
            direction: "HORIZONTAL",
            sizing: { horizontal: { kind: "hug" }, vertical: { kind: "fixed", length: literal(36) } },
            limits: NO_LIMITS,
            clips: true,
            paddingTop: literal(0),
            paddingRight: literal(16),
            paddingBottom: literal(0),
            paddingLeft: literal(16),
            itemSpacing: literal(8),
            primaryAlign: "CENTER",
            counterAlign: "CENTER",
            cornerRadius: literal(6),
            fill: undefined,
            stroke: undefined,
            shadows: [],
            opacity: 1,
            children: [LABEL],
          },
        },
      ],
    },
  ],
  previews: [],
};

const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

/** A frame layer with no padding, gap, corner, paint or ring, centered on both axes. */
function frame(key: string, name: string, children: readonly ChildLayerSpec[]): FrameLayerSpec {
  return {
    kind: "frame",
    key,
    name,
    direction: "HORIZONTAL",
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: literal(0),
    paddingRight: literal(0),
    paddingBottom: literal(0),
    paddingLeft: literal(0),
    itemSpacing: literal(0),
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: literal(0),
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children,
  };
}

/** A fixed Check icon, as a checkbox's indicator shows one. */
const CHECK: IconLayerSpec = {
  kind: "icon",
  key: "button/check",
  name: "Check",
  icon: "icon/Check",
  swapProperty: undefined,
  size: literal(12),
  color: BLACK,
};

/** The Button variant's layers moved two frames down: Control holds Indicator, which holds both. */
const NESTED_LAYERS = [
  frame("button/control", "Control", [frame("button/indicator", "Indicator", [CHECK, LABEL])]),
];

/**
 * `KIT` with the variant's root holding the given layers and a library holding Check. It
 * bundles no font, so only the walks over the variant's layers require the label's font.
 */
function nestedKit(children: readonly ChildLayerSpec[] = NESTED_LAYERS): KitSpec {
  return {
    ...KIT,
    fonts: [],
    icons: {
      ...KIT.icons,
      icons: [
        {
          key: "icon/Check",
          name: "Check",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2 8l4 4 8-8"/></svg>',
        },
      ],
    },
    componentSets: KIT.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({ ...variant, root: { ...variant.root, children } })),
    })),
  };
}

/** `KIT` with its one variant's root changed as `edit` says. */
function kitWithRoot(edit: (root: ComponentRootSpec) => ComponentRootSpec): KitSpec {
  return {
    ...KIT,
    componentSets: KIT.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({ ...variant, root: edit(variant.root) })),
    })),
  };
}

const FILL = { kind: "fill" } as const;

/**
 * A file whose `font-sans` aliases a brand variable that holds `family` in its default mode.
 * The machine cannot load Comic Sans.
 *
 * @param family - The family the brand variable holds.
 * @param withPage - Whether the file holds the kit page, with its stale preview.
 * @returns The file, opened for a new run, and the number of writes its setup made.
 */
function fixture(family: string, withPage = true) {
  const file = fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", {
      collection: "Fuse brand",
      variable: "light/external/private/font-sans",
    }),
    string("Fuse brand", "light/external/private/font-sans", family),
  ]);
  if (withPage) {
    const page = file.figma.createPage();
    page.name = "Fuse components";
    setKey(page, "page");
    const stale = file.figma.createFrame();
    page.appendChild(stale);
    stale.name = "Old preview";
    setKey(stale, "preview/old");
  }
  file.reopen({ unavailableFonts: [{ family: "Comic Sans" }] });
  return { file, setup: file.writes.length };
}

describe("reconcileKit on a file without the component set", () => {
  it("plans to delete the stale preview and create the set when the family loads", async () => {
    const { file, setup } = fixture("Roboto");
    const report = await reconcileKit(file.figma, KIT, false);
    expect(report.changes).toEqual([
      "Fuse components: delete Old preview",
      "Fuse components: create the Icons frame with 0 icons",
      "Fuse components: create the component set Button with 1 variants",
      "Fuse components: place Button and Icons in a row",
    ]);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, when the file's family cannot load", async () => {
    const { file, setup } = fixture("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, for a file without the kit page", async () => {
    const { file, setup } = fixture("Comic Sans", false);
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

describe("the kit check", () => {
  const OTHER_PAGE = { key: "page/other", name: "Other" };
  const PREVIEW_ELSEWHERE: KitSpec = {
    ...KIT,
    pages: [...KIT.pages, OTHER_PAGE],
    previews: [
      {
        key: "preview/other",
        name: "Other / Light",
        page: OTHER_PAGE.key,
        modes: [],
        groups: [
          {
            key: "preview/other/button",
            name: "Button",
            componentSet: "button",
            variants: ["button/size=md"],
          },
        ],
      },
    ],
  };

  it.each([
    [
      "a page key listed twice",
      { ...KIT, pages: [...KIT.pages, ...KIT.pages] },
      "The kit lists the page key page twice.",
    ],
    [
      "a preview of a set on another page",
      PREVIEW_ELSEWHERE,
      "Other / Light places Button, which sits on another page.",
    ],
    [
      "a text two frames down that links a property the set lacks",
      nestedKit([
        frame("button/control", "Control", [
          frame("button/indicator", "Indicator", [{ ...LABEL, textProperty: "Label" }]),
        ]),
      ]),
      "Button: the variant button/size=md links Label, which the set does not define.",
    ],
    [
      "an icon two frames down whose color binds a string variable",
      nestedKit([
        frame("button/control", "Control", [
          frame("button/indicator", "Indicator", [
            {
              ...CHECK,
              color: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
            },
          ]),
        ]),
      ]),
      "Fuse tokens/font-sans is a STRING variable, and the kit binds it to a field that takes a COLOR.",
    ],
    [
      "a root that fills its width, which its component set cannot give it",
      kitWithRoot((root) => ({ ...root, sizing: { ...root.sizing, horizontal: FILL } })),
      "Button: the variant button/size=md fills its width, and a variant sits in its component set, which has no auto layout. Give it a fixed width.",
    ],
    [
      "a frame that fills the width of a root that hugs it",
      nestedKit([
        {
          ...frame("button/control", "Control", [LABEL]),
          sizing: { horizontal: FILL, vertical: { kind: "hug" } },
        },
      ]),
      "Button: Control in the variant button/size=md fills the width of a parent that hugs it, so Figma would shrink it to its smallest width.",
    ],
    [
      "a limit that binds a string variable",
      kitWithRoot((root) => ({
        ...root,
        limits: {
          ...root.limits,
          maxWidth: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
        },
      })),
      "Fuse tokens/font-sans is a STRING variable, and the kit binds it to a field that takes a FLOAT.",
    ],
    [
      "a root that limits its fixed height",
      kitWithRoot((root) => ({ ...root, limits: { ...root.limits, minHeight: literal(40) } })),
      "Button: button in the variant button/size=md sets minHeight on its fixed height. Fold the limit into the height, as CSS resolves a height against its own limits.",
    ],
    [
      "a frame that limits its fixed width",
      nestedKit([
        {
          ...frame("button/control", "Control", [LABEL]),
          sizing: { horizontal: { kind: "fixed", length: literal(100) }, vertical: { kind: "hug" } },
          limits: { ...NO_LIMITS, maxWidth: literal(24) },
        },
      ]),
      "Button: Control in the variant button/size=md sets maxWidth on its fixed width. Fold the limit into the width, as CSS resolves a width against its own limits.",
    ],
  ])("stops Plan before any write for %s", async (_, kit, message) => {
    const { file, setup } = fixture("Roboto");
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

describe("a set that moves to a page pinning other modes", () => {
  const GRAY = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const LEGACY = { key: "page/components", name: "Fuse components" };
  const BUTTON = { key: "page/button", name: "Button" };
  const [set] = KIT.componentSets;
  if (set === undefined) {
    throw new Error("the kit has no component set");
  }
  /** A ring bound to `ring`, which is gray in the light mode and red in the dark one. */
  const ringed = {
    ...set,
    variants: set.variants.map((variant) => ({
      ...variant,
      root: {
        ...variant.root,
        children: [],
        shadows: [
          {
            color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
            offsetX: 0,
            offsetY: 0,
            radius: literal(0),
            spread: literal(2),
          } as const,
        ],
      },
    })),
  };
  const kitOn = (page: typeof BUTTON): KitSpec => ({
    ...KIT,
    pages: [page],
    fonts: [],
    icons: { ...KIT.icons, page: page.key },
    componentSets: [{ ...ringed, page: page.key }],
  });

  it("plans the set in its new page's modes, so one Apply converges", async () => {
    const file = createFakeFigma({
      collections: [
        {
          name: "Fuse tokens",
          modes: ["Light", "Dark"],
          variables: [
            ["background", { r: 1, g: 1, b: 1, a: 1 }, { r: 0, g: 0, b: 0, a: 1 }] as const,
            ["ring", GRAY, RED] as const,
          ].map(([name, light, dark]) => ({
            name,
            type: "COLOR",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Light", { _tag: "Color", color: light }],
              ["Dark", { _tag: "Color", color: dark }],
            ]),
          })),
        },
      ],
    });
    const [tokens] = await file.figma.variables.getLocalVariableCollectionsAsync();
    const dark = tokens?.modes.find((mode) => mode.name === "Dark");
    if (tokens === undefined || dark === undefined) {
      throw new Error("the file has no dark mode");
    }
    const legacy = file.figma.createPage();
    legacy.name = LEGACY.name;
    setKey(legacy, LEGACY.key);
    legacy.setExplicitVariableModeForCollection(tokens, dark.modeId);
    await reconcileKit(file.figma, kitOn(LEGACY), true);
    file.reopen();
    await legacy.loadAsync();
    const variant = legacy.children.find((node) => node.type === "COMPONENT_SET")?.children[0];
    const ring = () => (variant?.type === "COMPONENT" ? variant.effects[0] : undefined);
    expect(ring()).toMatchObject({ type: "DROP_SHADOW", color: RED });

    await reconcileKit(file.figma, kitOn(BUTTON), true);
    file.reopen();
    expect(await reconcileKit(file.figma, kitOn(BUTTON), false)).toEqual({ changes: [], warnings: [] });
    expect(ring()).toMatchObject({ type: "DROP_SHADOW", color: GRAY });
  });
});

/** A layer the plugin keyed, and the layers a frame among them holds. */
type LayerTree = {
  readonly type: SceneNode["type"];
  readonly name: string;
  readonly key: string;
  readonly children?: readonly LayerTree[];
};

/** The layers below a node, each frame with the layers it holds. */
function layerTree(parent: ChildrenMixin): LayerTree[] {
  return parent.children.map((node): LayerTree => {
    const layer = { type: node.type, name: node.name, key: keyOf(node) };
    return node.type === "FRAME" ? { ...layer, children: layerTree(node) } : layer;
  });
}

/** The Button variant the kit page holds. */
async function buttonVariant(file: FakeFigma): Promise<ComponentNode> {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => node.type === "COMPONENT_SET");
  const variant = set?.type === "COMPONENT_SET" ? set.children[0] : undefined;
  if (variant?.type !== "COMPONENT") {
    throw new Error("the kit page holds no Button variant");
  }
  return variant;
}

/** A file the nested kit was applied to, opened for the next run, and its two frames. */
async function nestedFile(): Promise<{
  readonly file: FakeFigma;
  readonly control: FrameNode;
  readonly indicator: FrameNode;
}> {
  const { file } = fixture("Roboto");
  await reconcileKit(file.figma, nestedKit(), true);
  file.reopen();
  const control = childNamed(await buttonVariant(file), "FRAME", "Control");
  return { file, control, indicator: childNamed(control, "FRAME", "Indicator") };
}

/**
 * The lines a plan that changes anything in the Button set ends with: it lays out the set's grid
 * and the page again.
 */
const RELAYOUT = [
  "Button: lay out 1 variants in 1 columns and 1 rows",
  "Fuse components: place Button and Icons in a row",
];

describe("a variant whose layers sit in a frame inside a frame", () => {
  it("creates both frames, the icon and the label in one Apply, and the next Plan lists nothing", async () => {
    const { file, control } = await nestedFile();
    expect(await reconcileKit(file.figma, nestedKit(), false)).toEqual({ changes: [], warnings: [] });
    expect(layerTree(await buttonVariant(file))).toEqual([
      {
        type: "FRAME",
        name: "Control",
        key: "button/control",
        children: [
          {
            type: "FRAME",
            name: "Indicator",
            key: "button/indicator",
            children: [
              { type: "INSTANCE", name: "Check", key: "button/check" },
              { type: "TEXT", name: "Label", key: "button/label" },
            ],
          },
        ],
      },
    ]);
    // A part below the root shows its overflow and paints nothing its spec does not ask for.
    expect([control.clipsContent, control.fills]).toEqual([false, []]);
  });

  it("fails Plan, and stops Apply before any write, when the label's family cannot load", async () => {
    const { file, setup } = fixture("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, nestedKit(), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, nestedKit(), true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("requires the label's font for a frame it creates again, and for a variant it creates again", async () => {
    const message = "Button / size=md / Label needs the font Roboto Medium, which Figma cannot load.";
    const deletedFrame = await nestedFile();
    deletedFrame.control.remove();
    deletedFrame.file.reopen({ unavailableFonts: [{ family: "Roboto" }] });
    await expect(reconcileKit(deletedFrame.file.figma, nestedKit(), false)).rejects.toThrow(message);

    const deletedVariant = await nestedFile();
    (await buttonVariant(deletedVariant.file)).remove();
    deletedVariant.file.reopen({ unavailableFonts: [{ family: "Roboto" }] });
    await expect(reconcileKit(deletedVariant.file.figma, nestedKit(), false)).rejects.toThrow(message);
  });

  it("keeps the keys of a renamed frame and a renamed label inside it, and plans only their names back", async () => {
    const { file, indicator } = await nestedFile();
    const label = childNamed(indicator, "TEXT", "Label");
    indicator.name = "Dot";
    label.name = "Caption";
    expect((await reconcileKit(file.figma, nestedKit(), false)).changes).toEqual([
      "Button / size=md / Control / Indicator: name → Indicator",
      "Button / size=md / Control / Indicator / Label: name → Label",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, nestedKit(), true);
    expect([indicator.name, label.name]).toEqual(["Indicator", "Label"]);
    const control = childNamed(await buttonVariant(file), "FRAME", "Control");
    expect([childNamed(control, "FRAME", "Indicator"), childNamed(indicator, "TEXT", "Label")]).toEqual([
      indicator,
      label,
    ]);
  });

  it("deletes a label the spec moves to another frame and creates it there, then converges", async () => {
    const { file } = await nestedFile();
    const moved = [
      frame("button/control", "Control", [frame("button/indicator", "Indicator", [CHECK]), LABEL]),
    ];
    expect((await reconcileKit(file.figma, nestedKit(moved), false)).changes).toEqual([
      "Button / size=md / Control / Indicator: delete the layer Label",
      "Button / size=md / Control: create the text layer Label",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, nestedKit(moved), true);
    file.reopen();
    expect(await reconcileKit(file.figma, nestedKit(moved), false)).toEqual({ changes: [], warnings: [] });
  });

  it("stops Plan and Apply before any write when a designer duplicates the label inside a frame", async () => {
    const { file, indicator } = await nestedFile();
    const copy = file.figma.createText();
    indicator.appendChild(copy);
    setKey(copy, LABEL.key);
    const before = file.writes.length;
    const message = "Button / size=md / Control / Indicator holds 2 layers with the key button/label.";
    await expect(reconcileKit(file.figma, nestedKit(), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, nestedKit(), true)).rejects.toThrow(message);
    expect(file.writes.slice(before)).toEqual([]);
  });
});
