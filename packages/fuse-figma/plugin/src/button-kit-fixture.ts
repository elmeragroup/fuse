/**
 * A one-variant Button kit on the in-memory file in `fake-figma.ts`, shared by the suites that run
 * `reconcileKit` on a single set: the kit and the builders that change its variant, a file whose
 * kit page holds a stale preview and no set, and the set and variant an Apply leaves there. The
 * label's family follows `font-sans`, which aliases a brand variable, so a run resolves it across
 * collections before it writes (rule 8) and needs the font it names (rule 7).
 */
import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  KitSpec,
  NumberSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { aliasOf, color, fixtureFile, string } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";

/**
 * A literal number field.
 *
 * @param value - The pixels.
 * @returns The field.
 */
export const literal = (value: number): NumberSpec => ({ kind: "literal", value });

/** The label of the one Button variant, whose family follows `font-sans`. */
export const LABEL: TextLayerSpec = {
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
  sizing: HUGGING_TEXT,
  align: TOP_LEFT,
  truncation: undefined,
};

/** A kit with one Button variant, no icons and no previews, which bundles Roboto Medium. */
export const KIT: KitSpec = {
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

/** Opaque black, the color the fixture's icons draw in. */
export const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

/** An axis that fills the room its parent's auto layout gives the layer. */
export const FILL = { kind: "fill" } as const;

/**
 * A frame layer with no padding, gap, corner, paint or ring, centered on both axes.
 *
 * @param key - The layer's key.
 * @param name - The layer's name.
 * @param children - The layers it holds.
 * @returns The frame.
 */
export function frame(key: string, name: string, children: readonly ChildLayerSpec[]): FrameLayerSpec {
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
export const CHECK: IconLayerSpec = {
  kind: "icon",
  key: "button/check",
  name: "Check",
  icon: "icon/Check",
  swapProperty: undefined,
  size: literal(12),
  color: BLACK,
};

/** The Button variant's layers moved two frames down: Control holds Indicator, which holds both. */
export const NESTED_LAYERS = [
  frame("button/control", "Control", [frame("button/indicator", "Indicator", [CHECK, LABEL])]),
];

/**
 * `KIT` with the variant's root holding the given layers and a library holding Check. It
 * bundles no font, so only the walks over the variant's layers require the label's font.
 *
 * @param children - The root's layers.
 * @returns The kit.
 */
export function nestedKit(children: readonly ChildLayerSpec[] = NESTED_LAYERS): KitSpec {
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

/**
 * `KIT` with its one variant's root changed.
 *
 * @param edit - Changes the root.
 * @returns The kit.
 */
export function kitWithRoot(edit: (root: ComponentRootSpec) => ComponentRootSpec): KitSpec {
  return {
    ...KIT,
    componentSets: KIT.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({ ...variant, root: edit(variant.root) })),
    })),
  };
}

/**
 * A file whose `font-sans` aliases a brand variable that holds `family` in its default mode.
 * The machine cannot load Comic Sans.
 *
 * @param family - The family the brand variable holds.
 * @param withPage - Whether the file holds the kit page, with its stale preview.
 * @returns The file, opened for a new run, and the number of writes its setup made.
 */
export function fixture(family: string, withPage = true) {
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

/**
 * The Button set the kit page holds.
 *
 * @param file - A file the kit was applied to.
 * @returns The set.
 * @throws When the kit page holds no set.
 */
export async function buttonSet(file: FakeFigma): Promise<ComponentSetNode> {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => node.type === "COMPONENT_SET");
  if (set?.type !== "COMPONENT_SET") {
    throw new Error("the kit page holds no Button set");
  }
  return set;
}

/**
 * The Button variant the kit page holds.
 *
 * @param file - A file the kit was applied to.
 * @returns The variant.
 * @throws When the set holds no variant.
 */
export async function buttonVariant(file: FakeFigma): Promise<ComponentNode> {
  const [variant] = (await buttonSet(file)).children;
  if (variant?.type !== "COMPONENT") {
    throw new Error("the kit page holds no Button variant");
  }
  return variant;
}

/**
 * The lines a plan that changes anything in the Button set ends with: it lays out the set's grid
 * and the page again.
 */
export const RELAYOUT = [
  "Button: lay out 1 variants in 1 columns and 1 rows",
  "Fuse components: place Button and Icons in a row",
];
