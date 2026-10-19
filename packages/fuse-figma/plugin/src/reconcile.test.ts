/**
 * `reconcileKit` against a hand-made stand-in for a file whose kit page holds a stale preview
 * and no component set. The stand-in file models the Figma rules the run reads before it
 * writes. A variable reads its collection's default mode on a node that pins no mode, an alias
 * names the variable it follows by id, and `loadFontAsync` rejects a font the machine cannot
 * load. The oracles are the change lines Plan lists and a log of every write the stand-in
 * receives.
 */
import { describe, expect, it } from "vitest";

import type { KitSpec, NumberSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
import { reconcileKit } from "./reconcile.ts";

/** The parts of the plugin API a run reads and calls before it creates a set. */
type FigmaStandIn = Pick<
  PluginAPI,
  "loadFontAsync" | "setCurrentPageAsync" | "createComponent" | "combineAsVariants"
> & {
  readonly root: Pick<DocumentNode, "children">;
  readonly variables: Pick<
    VariablesAPI,
    | "getLocalVariableCollectionsAsync"
    | "getLocalVariablesAsync"
    | "getVariableByIdAsync"
    | "getVariableCollectionByIdAsync"
  >;
};

/** The file a test runs against, and the logs of its writes and of the fonts it loaded. */
type FileStandIn = {
  readonly figma: PluginAPI;
  readonly writes: readonly string[];
  readonly loaded: readonly string[];
};

type CollectionStandIn = Pick<
  VariableCollection,
  "id" | "name" | "remote" | "isExtension" | "modes" | "defaultModeId"
>;
type VariableStandIn = Pick<
  Variable,
  "id" | "name" | "variableCollectionId" | "resolvedType" | "valuesByMode"
>;
type PageStandIn = Pick<
  PageNode,
  "type" | "name" | "children" | "explicitVariableModes" | "getSharedPluginData" | "loadAsync"
>;
type FrameStandIn = Pick<FrameNode, "type" | "name" | "getSharedPluginData" | "remove">;

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
};

/** A kit with one Button variant and no previews, which bundles Roboto Medium. */
const KIT: KitSpec = {
  page: { key: "page", name: "Fuse components" },
  fonts: [{ family: "Roboto", style: "Medium" }],
  componentSets: [
    {
      key: "button",
      name: "Button",
      axes: [{ name: "size", values: ["md"] }],
      columnAxis: "size",
      textProperties: [],
      variants: [
        {
          key: "button/size=md",
          properties: { size: "md" },
          root: {
            name: "button",
            height: literal(36),
            minWidth: undefined,
            paddingTop: literal(0),
            paddingRight: literal(16),
            paddingBottom: literal(0),
            paddingLeft: literal(16),
            itemSpacing: literal(8),
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

/**
 * A file whose `font-sans` aliases a brand variable that holds `family` in its default mode.
 * The machine cannot load Comic Sans.
 *
 * @param family - The family the brand variable holds.
 * @param withPage - Whether the file holds the kit page, with its stale preview.
 */
function fileStandIn(family: string, withPage = true): FileStandIn {
  const writes: string[] = [];
  const loaded: string[] = [];
  const collections: CollectionStandIn[] = [
    {
      id: "tokens",
      name: "Fuse tokens",
      remote: false,
      isExtension: false,
      modes: [{ modeId: "light", name: "Light" }],
      defaultModeId: "light",
    },
    {
      id: "brand",
      name: "Fuse brand",
      remote: false,
      isExtension: false,
      modes: [{ modeId: "fjordkraft", name: "Fjordkraft" }],
      defaultModeId: "fjordkraft",
    },
  ];
  const variables: VariableStandIn[] = [
    {
      id: "font-sans",
      name: "font-sans",
      variableCollectionId: "tokens",
      resolvedType: "STRING",
      valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "brand-font-sans" } },
    },
    {
      id: "brand-font-sans",
      name: "light/external/private/font-sans",
      variableCollectionId: "brand",
      resolvedType: "STRING",
      valuesByMode: { fjordkraft: family },
    },
  ];
  // SAFETY: the run reads only these fields of a collection and a variable.
  const asCollection = (collection: CollectionStandIn): VariableCollection =>
    collection as VariableCollection;
  // SAFETY: as above, for a variable.
  const asVariable = (variable: VariableStandIn): Variable => variable as Variable;

  const stale: FrameStandIn = {
    type: "FRAME",
    name: "Old preview",
    getSharedPluginData: () => "preview/old",
    remove: () => {
      writes.push("delete Old preview");
    },
  };
  const page: PageStandIn = {
    type: "PAGE",
    name: "Fuse components",
    // SAFETY: the run reads a stale preview's key and name, and deletes it through `remove`.
    children: [stale as FrameNode],
    explicitVariableModes: {},
    getSharedPluginData: () => "page",
    loadAsync: () => Promise.resolve(),
  };
  const figma: FigmaStandIn = {
    // SAFETY: the run reads a page's key, name, modes and children, and loads it.
    root: { children: withPage ? [page as PageNode] : [] },
    loadFontAsync: (font) => {
      if (font.family === "Comic Sans") {
        return Promise.reject(new Error("Comic Sans is not installed"));
      }
      loaded.push(`${font.family} ${font.style ?? ""}`);
      return Promise.resolve();
    },
    setCurrentPageAsync: () => {
      writes.push("show the page");
      return Promise.resolve();
    },
    createComponent: () => {
      writes.push("create a component");
      throw new Error("the stand-in file creates no components");
    },
    combineAsVariants: () => {
      writes.push("combine the variants");
      throw new Error("the stand-in file combines no variants");
    },
    variables: {
      getLocalVariableCollectionsAsync: () => Promise.resolve(collections.map(asCollection)),
      getLocalVariablesAsync: () => Promise.resolve(variables.map(asVariable)),
      getVariableByIdAsync: (id) => {
        const variable = variables.find((candidate) => candidate.id === id);
        return Promise.resolve(variable === undefined ? null : asVariable(variable));
      },
      getVariableCollectionByIdAsync: (id) => {
        const collection = collections.find((candidate) => candidate.id === id);
        return Promise.resolve(collection === undefined ? null : asCollection(collection));
      },
    },
  };
  // SAFETY: a run that stops before it creates the set reads only these parts of the API.
  return { figma: figma as PluginAPI, writes, loaded };
}

describe("reconcileKit on a file without the component set", () => {
  it("plans to delete the stale preview and create the set when the family loads", async () => {
    const file = fileStandIn("Roboto");
    const report = await reconcileKit(file.figma, KIT, false);
    expect(report.changes).toEqual([
      "Fuse components: delete Old preview",
      "Fuse components: create the component set Button with 1 variants",
    ]);
    expect(file.loaded).toEqual(["Roboto Medium"]);
    expect(file.writes).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, when the file's family cannot load", async () => {
    const file = fileStandIn("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, for a file without the kit page", async () => {
    const file = fileStandIn("Comic Sans", false);
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });
});
