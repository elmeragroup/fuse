/**
 * A one-variant Button kit on the in-memory file in `fake-figma.ts`, shared by the suites that run
 * `reconcileKit` on a single set: the kit and the builders that change its variant, a file whose
 * kit page holds a stale preview and no set, and the set and variant an Apply leaves there. Small
 * kits of their own build their sets from `bareRoot` and `oneVariant` and apply them with
 * `applyTo`. The label's family follows `font-sans`, which aliases a brand variable, so a run
 * resolves it across collections before it writes (rule 8) and needs the font it names (rule 7).
 */
import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  KitSpec,
  NumberSpec,
  StrokeSpec,
  TextLayerSpec,
  TextStyleSpec,
} from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { aliasOf, color, fixtureFile, GLYPH_FONT, string } from "./fake-fixtures.ts";
import type { FixtureVariable } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

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

/** Opaque black, the color the fixture's icons draw in. */
export const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

/** The one kit page and an Icons frame on it with no icons, which a small kit spreads into its spec. */
const ONE_PAGE = {
  pages: [{ key: "page", name: "Fuse components" }],
  icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
} as const satisfies Pick<KitSpec, "pages" | "icons">;

/**
 * The one text style the kit's docs link, in Roboto Medium, which the kit bundles, at literal type so
 * it binds no variable the fixture file lacks.
 */
const FIXTURE_STYLE: TextStyleSpec = {
  key: "text-style/caption",
  name: "Caption",
  description: "The docs' captions.",
  fontFamily: { kind: "literal", value: "Roboto" },
  fontWeight: { kind: "literal", style: "Medium" },
  fontSize: literal(12),
  lineHeight: literal(16),
  letterSpacing: { unit: "PERCENT", value: 0 },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textWrapStyle: "AUTO",
};

/**
 * A kit with one Button variant, no icons and no previews, which bundles Roboto Medium, and the
 * minimal docs every kit page holds: a title, the Button's labels, the `Examples` header and the
 * Button's example.
 */
export const KIT: KitSpec = {
  ...ONE_PAGE,
  fonts: [{ family: "Roboto", style: "Medium" }],
  glyphFont: GLYPH_FONT,
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
  textStyles: [FIXTURE_STYLE],
  docs: [
    {
      page: "page",
      title: {
        kind: "text",
        key: "docs/page/title",
        name: "Header",
        page: "page",
        text: "Fuse components",
        style: FIXTURE_STYLE.key,
      },
      description: {
        kind: "text",
        key: "docs/page/description",
        name: "Description",
        page: "page",
        text: "Triggers an action.",
        style: FIXTURE_STYLE.key,
      },
      docsLink: {
        kind: "link",
        key: "docs/page/docs-link",
        name: "View documentation",
        page: "page",
        text: "View documentation",
        style: FIXTURE_STYLE.key,
        url: "https://fuse.elmeragroup.no/components/button",
        color: { kind: "literal", color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } },
        underline: {
          offset: 2.8,
          thickness: 1,
          color: { kind: "literal", color: { r: 0.1, g: 0.1, b: 0.1, a: 0.35 } },
        },
      },
      rule: {
        kind: "rule",
        key: "docs/page/rule",
        name: "Rule",
        page: "page",
        color: { kind: "literal", color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } },
      },
      labels: [
        {
          kind: "labels",
          key: "docs/page/labels/button",
          name: "Button labels",
          page: "page",
          componentSet: "button",
          nameStyle: FIXTURE_STYLE.key,
          axisStyle: FIXTURE_STYLE.key,
        },
      ],
      themesHeader: {
        kind: "text",
        key: "docs/page/themes-header",
        name: "Header",
        page: "page",
        text: "Themes",
        style: FIXTURE_STYLE.key,
      },
      examplesHeader: {
        kind: "text",
        key: "docs/page/examples-header",
        name: "Header",
        page: "page",
        text: "Examples",
        style: FIXTURE_STYLE.key,
      },
      example: {
        kind: "example",
        key: "docs/page/example",
        name: "Example",
        page: "page",
        componentSet: "button",
        variant: "button/size=md",
      },
    },
  ],
};

/** An axis that fills the room its parent's auto layout gives the layer. */
export const FILL = { kind: "fill" } as const;

/** An axis that hugs the layer's content. */
export const HUG = { kind: "hug" } as const;

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
const NESTED_LAYERS = [
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
    glyphFont: GLYPH_FONT,
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
 * The Button set, whose one label links its TEXT property `Label`, and an Outer set whose one variant
 * holds an instance of it.
 *
 * @param label - The label, its characters the main shows.
 * @param shown - The value the instance gives `Label`, or none, so it shows the default.
 * @param defaultValue - `Label`'s default, the label's characters unless a case gives another.
 * @returns The kit.
 * @throws When the nested kit holds no Button set.
 */
export function outerKit(label: TextLayerSpec, shown?: string, defaultValue = label.characters): KitSpec {
  const base = nestedKit([{ ...label, textProperty: "Label" }]);
  const [button] = base.componentSets;
  if (button === undefined) {
    throw new Error("the kit holds no Button set");
  }
  const inner = { ...button, textProperties: [{ name: "Label", defaultValue }] };
  const instance: InstanceLayerSpec = {
    kind: "instance",
    key: "inner",
    name: "Inner",
    componentSet: "button",
    variant: "button/size=md",
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
  };
  const outer = {
    ...inner,
    key: "outer",
    name: "Outer",
    textProperties: [],
    variants: inner.variants.map((variant) => ({
      ...variant,
      key: "outer/size=md",
      root: {
        ...variant.root,
        children: [shown === undefined ? instance : { ...instance, properties: { text: { Label: shown } } }],
      },
    })),
  };
  return {
    ...base,
    componentSets: [inner, outer],
    docs: base.docs.map((doc) => ({
      ...doc,
      labels: [
        ...doc.labels,
        ...doc.labels.slice(0, 1).map((first) => ({
          ...first,
          key: "docs/page/labels/outer",
          name: "Outer labels",
          componentSet: "outer",
        })),
      ],
    })),
  };
}

/** An override that leaves the root's left side bare, as a group member's `border-l-0` does. */
export const BARE_LEFT: InstanceOverride = { path: [], field: "strokeSides", bare: ["left"] };

/**
 * The outer kit with its inner root stroked by `stroke` and its instance carrying `overrides`.
 *
 * @param stroke - The inner root's stroke, or undefined for none.
 * @param overrides - The instance's overrides.
 * @returns The kit.
 */
export function strokedOuterKit(
  stroke: StrokeSpec | undefined,
  overrides: readonly InstanceOverride[]
): KitSpec {
  const base = outerKit(LABEL);
  const [inner, outer] = base.componentSets;
  if (inner === undefined || outer === undefined) {
    throw new Error("the outer kit holds no two sets");
  }
  return {
    ...base,
    componentSets: [
      {
        ...inner,
        variants: inner.variants.map((variant) => ({ ...variant, root: { ...variant.root, stroke } })),
      },
      {
        ...outer,
        variants: outer.variants.map((variant) => ({
          ...variant,
          root: {
            ...variant.root,
            children: variant.root.children.map((layer) =>
              layer.kind === "instance" ? { ...layer, overrides } : layer
            ),
          },
        })),
      },
    ],
  };
}

/**
 * A file whose `font-sans` aliases a brand variable that holds `family` in its default mode.
 * The machine cannot load Comic Sans.
 *
 * @param family - The family the brand variable holds.
 * @param withPage - Whether the file holds the kit page, with its stale preview.
 * @param variables - Further variables the file holds.
 * @returns The file, opened for a new run, and the number of writes its setup made.
 */
export function fixture(family: string, withPage = true, variables: readonly FixtureVariable[] = []) {
  const file = fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", {
      collection: "Fuse brand",
      variable: "light/branded/private/font-sans",
    }),
    string("Fuse brand", "light/branded/private/font-sans", family),
    ...variables,
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
async function buttonSet(file: FakeFigma): Promise<ComponentSetNode> {
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
 * The line a plan that changes anything in the Button set ends with: it lays out the page again,
 * the set's grid with it.
 */
export const RELAYOUT = [
  "Fuse components: place Button and Icons, with their labels and the page's title and example, in sections",
];

/**
 * Apply a kit to a file and open the file again for the next run.
 *
 * @param file - The file.
 * @param kit - The kit.
 * @returns The same file.
 */
export async function applyTo(file: FakeFigma, kit: KitSpec): Promise<FakeFigma> {
  await reconcileKit(file.figma, kit, true);
  file.reopen();
  return file;
}
