/**
 * `reconcileKit` with a kit whose Alert set holds an instance of its Button set's variant, on the
 * in-memory file in `fake-figma.ts`. The oracles are the fake's rules 32 to 41, which follow what a
 * real file did with a nested instance on 2026-10-23 and 2026-10-24 (N1 to N5, NS, NA), the change
 * lines Plan lists, and a second Plan that lists nothing.
 */
import { describe, expect, it } from "vitest";

import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  ColorSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  KitSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { FILL, frame, literal } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, color, fixtureFile, float } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const BLACK: ColorSpec = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } };
const HUG = { kind: "hug" } as const;

const token = (name: string): ColorSpec => ({
  kind: "variable",
  variable: { collection: "Fuse tokens", name },
});

/** The Button's icon, which its `Glyph` property swaps. */
const GLYPH: IconLayerSpec = {
  kind: "icon",
  key: "button/glyph",
  name: "Glyph",
  icon: "icon/Check",
  swapProperty: "Glyph",
  size: literal(16),
  color: BLACK,
};

/** The Button's label, which its `Label` property sets. */
const LABEL: TextLayerSpec = {
  kind: "text",
  key: "button/label",
  name: "Label",
  characters: "Button",
  textProperty: "Label",
  fontFamily: { kind: "literal", value: "Roboto" },
  fontStyle: "Medium",
  fontSize: literal(14),
  lineHeight: literal(20),
  color: BLACK,
  underline: undefined,
  sizing: HUGGING_TEXT,
  align: TOP_LEFT,
  truncation: undefined,
};

/** A Button root: a row of the icon, which its `Icon` property shows, and the label, filled with a token. */
function buttonRoot(fill: ColorSpec, height = 36, padding = 12): ComponentRootSpec {
  return {
    name: "button",
    direction: "HORIZONTAL",
    sizing: { horizontal: HUG, vertical: { kind: "fixed", length: literal(height) } },
    limits: NO_LIMITS,
    clips: true,
    paddingTop: literal(0),
    paddingRight: literal(padding),
    paddingBottom: literal(0),
    paddingLeft: literal(padding),
    itemSpacing: literal(8),
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: literal(6),
    fill,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [{ ...frame("button/adornment", "Adornment", [GLYPH]), visibleProperty: "Icon" }, LABEL],
  };
}

/** The inner set: two variants, a TEXT, a BOOLEAN and a swap property, and a bound fill. */
function buttonSet(root: (variant: "default" | "outline") => ComponentRootSpec): ComponentSetSpec {
  return {
    key: "button",
    page: "page",
    name: "Button",
    axes: [{ name: "variant", values: ["default", "outline"] }],
    columnAxis: "variant",
    textProperties: [{ name: "Label", defaultValue: "Button" }],
    booleanProperties: [{ name: "Icon", defaultValue: true }],
    swapProperties: [{ name: "Glyph", defaultIcon: "icon/Check" }],
    variants: (["default", "outline"] as const).map((variant) => ({
      key: `button/variant=${variant}`,
      properties: { variant },
      root: root(variant),
    })),
  };
}

const BUTTON = buttonSet((variant) => buttonRoot(token(variant === "default" ? "primary" : "background")));

/**
 * The Alert's action: the default Button with its label, icon and glyph set, a fill override on its
 * root and a text color override on its label, filling the Alert's width, exposed, and shown by the
 * Alert's `Action` property.
 */
const ROOT_FILL: InstanceOverride = { path: [], field: "fill", color: token("destructive") };
const LABEL_COLOR: InstanceOverride = {
  path: ["button/label"],
  field: "textColor",
  color: token("background"),
};
const LABEL_CENTER: InstanceOverride = { path: ["button/label"], field: "textAlign", horizontal: "CENTER" };
const GLYPH_COLOR: InstanceOverride = {
  path: ["button/adornment", "button/glyph"],
  field: "glyph",
  color: token("success"),
};

const ACTION: InstanceLayerSpec = {
  kind: "instance",
  key: "alert/action",
  name: "button",
  componentSet: "button",
  variant: "button/variant=default",
  properties: { text: { Label: "Retry" }, boolean: { Icon: false }, swap: { Glyph: "icon/Plus" } },
  overrides: [ROOT_FILL, LABEL_COLOR],
  sizing: { horizontal: FILL, vertical: HUG },
  exposed: true,
  visibleProperty: "Action",
};

/** The outer set: a 240px column, padded 16, that hugs the action's height. */
function alertSet(action: InstanceLayerSpec): ComponentSetSpec {
  return {
    key: "alert",
    page: "page",
    name: "Alert",
    axes: [{ name: "tone", values: ["default"] }],
    columnAxis: "tone",
    textProperties: [],
    booleanProperties: [{ name: "Action", defaultValue: true }],
    swapProperties: [],
    variants: [
      {
        key: "alert/tone=default",
        properties: { tone: "default" },
        root: {
          ...buttonRoot({ kind: "literal", color: { r: 0.95, g: 0.95, b: 0.95, a: 1 } }),
          name: "alert",
          direction: "VERTICAL",
          sizing: { horizontal: { kind: "fixed", length: literal(240) }, vertical: HUG },
          paddingTop: literal(16),
          paddingRight: literal(16),
          paddingBottom: literal(16),
          paddingLeft: literal(16),
          primaryAlign: "MIN",
          counterAlign: "MIN",
          children: [action],
        },
      },
    ],
  };
}

const svg = (path: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="${path}"/></svg>`;

/** The Plus icon's path, which a run that changes it draws again. */
const PLUS = "M8 2v12M2 8h12";

/** The kit: the Button set, then the Alert set, and a preview of both. */
function kitWith(
  button: ComponentSetSpec,
  action: InstanceLayerSpec = ACTION,
  plus = PLUS,
  iconColor: ColorSpec = BLACK
): KitSpec {
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [{ family: "Roboto", style: "Medium" }],
    icons: {
      key: "icons",
      page: "page",
      name: "Icons",
      size: 16,
      color: iconColor,
      icons: [
        { key: "icon/Check", name: "Check", svg: svg("M2 8l4 4 8-8") },
        { key: "icon/Plus", name: "Plus", svg: svg(plus) },
      ],
    },
    componentSets: [button, alertSet(action)],
    previews: [
      {
        key: "preview/light",
        name: "Light",
        page: "page",
        modes: [],
        groups: [
          {
            key: "preview/light/button",
            name: "Button",
            componentSet: "button",
            variants: button.variants.map((variant) => variant.key),
          },
          {
            key: "preview/light/alert",
            name: "Alert",
            componentSet: "alert",
            variants: ["alert/tone=default"],
          },
        ],
      },
    ],
  };
}

const KIT = kitWith(BUTTON);

/** A file with the tokens the kit binds and no kit page. */
function tokenFile(): FakeFigma {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    color("Fuse tokens", "primary", { r: 0, g: 0, b: 1, a: 1 }),
    color("Fuse tokens", "destructive", { r: 1, g: 0, b: 0, a: 1 }),
    color("Fuse tokens", "success", { r: 0, g: 1, b: 0, a: 1 }),
    float("Fuse density", "row-h", 32),
  ]);
}

/** A file the kit was applied to, opened again for the next run. */
async function appliedFile(kit: KitSpec = KIT): Promise<FakeFigma> {
  const file = tokenFile();
  await reconcileKit(file.figma, kit, true);
  file.reopen();
  return file;
}

/** A component set of the kit page by its key. */
async function setOf(file: FakeFigma, key: string): Promise<ComponentSetNode> {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => keyOf(node) === key);
  if (set?.type !== "COMPONENT_SET") {
    throw new Error(`the kit page holds no set ${key}`);
  }
  return set;
}

/** The Alert variant and the action instance it holds. */
async function alertAction(file: FakeFigma) {
  const [variant] = (await setOf(file, "alert")).children;
  if (variant?.type !== "COMPONENT") {
    throw new Error("the Alert set holds no variant");
  }
  return { variant, action: childNamed(variant, "INSTANCE", "button") };
}

/** A layer's fills, none where they are mixed. */
function paintsOf(file: FakeFigma, layer: MinimalFillsMixin): readonly Paint[] {
  return layer.fills === file.figma.mixed ? [] : layer.fills;
}

/** The variable id a single bound paint names, or undefined for mixed paints or none bound. */
function boundId(figma: PluginAPI, paints: ReadonlyArray<Paint> | PluginAPI["mixed"]): string | undefined {
  const [paint] = paints === figma.mixed ? [] : paints;
  return paint?.type === "SOLID" ? paint.boundVariables?.color?.id : undefined;
}

/**
 * What the action shows, as a designer reads it: its variant, its properties by name, a swap by the
 * icon's name, its paints, its sizing, its exposure, and the Alert property its visibility follows.
 */
async function shownBy(file: FakeFigma, action: InstanceNode) {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const icons = page === undefined ? [] : childNamed(page, "FRAME", "Icons").children;
  const properties = Object.fromEntries(
    Object.entries(action.componentProperties).map(
      ([id, { type, value }]): readonly [string, string | boolean | undefined] => [
        id.split("#")[0] ?? id,
        type === "INSTANCE_SWAP" ? icons.find((icon) => icon.id === value)?.name : value,
      ]
    )
  );
  const linked = Object.entries((await setOf(file, "alert")).componentPropertyDefinitions).find(
    ([id]) => id === action.componentPropertyReferences?.visible
  );
  return {
    main: (await action.getMainComponentAsync())?.name,
    properties,
    fill: boundId(file.figma, action.fills),
    labelColor: boundId(file.figma, childNamed(action, "TEXT", "Label").fills),
    sizing: [action.layoutSizingHorizontal, action.layoutSizingVertical],
    exposed: action.isExposedInstance,
    visibleFollows: linked === undefined ? undefined : [linked[0].split("#")[0], linked[1].type],
  };
}

describe("the kit check of instance layers", () => {
  const withAction = (action: Partial<InstanceLayerSpec>): KitSpec =>
    kitWith(BUTTON, { ...ACTION, ...action });
  const where = "Alert: button in the variant alert/tone=default";
  it.each([
    [
      "an instance of its own set",
      withAction({ componentSet: "alert", variant: "alert/tone=default" }),
      `${where} is an instance of its own set.`,
    ],
    [
      "an instance of a set the kit lists later",
      { ...KIT, componentSets: [alertSet(ACTION), BUTTON] },
      `${where} shows Button, which the kit lists after Alert, and the plugin plans the sets in kit order.`,
    ],
    [
      "an instance of a set the kit lacks",
      withAction({ componentSet: "card" }),
      `${where} shows card, which the kit does not define.`,
    ],
    [
      "an instance of a variant the set lacks",
      withAction({ variant: "button/variant=ghost" }),
      `${where} shows button/variant=ghost, which Button does not define.`,
    ],
    [
      "a property the inner set lacks",
      withAction({ properties: { text: { Title: "Retry" } } }),
      `${where} sets the property Title, which Button does not define.`,
    ],
    [
      "a property of the wrong type",
      withAction({ properties: { boolean: { Label: true } } }),
      `${where} sets Label as a BOOLEAN property, which Button defines as a TEXT property.`,
    ],
    [
      "a swap to an icon the library lacks",
      withAction({ properties: { swap: { Glyph: "icon/Star" } } }),
      `${where} swaps Glyph to icon/Star, which the kit's icon library lacks.`,
    ],
    [
      "an override at a path the inner variant lacks",
      withAction({ overrides: [{ path: ["button/caption"], field: "textColor", color: BLACK }] }),
      `${where} overrides button/caption, which Button button/variant=default lacks.`,
    ],
    [
      "a text color override on the root",
      withAction({ overrides: [{ path: [], field: "textColor", color: BLACK }] }),
      `${where} overrides the textColor of the root, a box, which takes none.`,
    ],
    [
      "a text alignment override on the root",
      withAction({ overrides: [{ path: [], field: "textAlign", horizontal: "CENTER" }] }),
      `${where} overrides the textAlign of the root, a box, which takes none.`,
    ],
    [
      "a BOOLEAN link the outer set lacks",
      withAction({ visibleProperty: "Dismiss" }),
      "Alert: the variant alert/tone=default links Dismiss, which the set does not define.",
    ],
    [
      "two overrides of one field on one layer",
      withAction({
        overrides: [
          { path: [], field: "fill", color: token("primary") },
          { path: [], field: "fill", color: token("success") },
        ],
      }),
      `${where} overrides the fill of the root twice, and the plugin would write each in turn on every run.`,
    ],
  ])("stops Plan before any write for %s", async (_, kit, message) => {
    const file = tokenFile();
    const setup = file.writes.length;
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

describe("a set that holds an instance of an earlier set's variant", () => {
  it("converges in one Apply, and the action shows its variant, properties, overrides and sizing", async () => {
    const file = await appliedFile();
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
    const { action } = await alertAction(file);
    expect(await shownBy(file, action)).toEqual({
      main: "variant=default",
      properties: { variant: "default", Label: "Retry", Icon: false, Glyph: "Plus" },
      fill: file.variable("Fuse tokens", "destructive").id,
      labelColor: file.variable("Fuse tokens", "background").id,
      sizing: ["FILL", "HUG"],
      exposed: true,
      visibleFollows: ["Action", "BOOLEAN"],
    });
  });

  it("keeps the action's node, properties and overrides through an in-place edit of its variant, in one Apply", async () => {
    const file = await appliedFile();
    const before = (await alertAction(file)).action.id;
    const edited = kitWith(
      buttonSet((variant) =>
        variant === "default" ? buttonRoot(token("success"), 36, 16) : buttonRoot(token("background"))
      )
    );
    expect((await reconcileKit(file.figma, edited, false)).changes).toEqual([
      "Button / variant=default: paddingRight → 16",
      "Button / variant=default: paddingLeft → 16",
      "Button / variant=default: fill → success (holds variable at 100%)",
      "Button: lay out 2 variants in 2 columns and 1 rows",
      "Alert / tone=default / button: plan again once Button's changes land",
      "Alert: lay out 1 variants in 1 columns and 1 rows",
      "Fuse components: place Button, Alert and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, edited, true);
    file.reopen();
    expect(await reconcileKit(file.figma, edited, false)).toEqual({ changes: [], warnings: [] });
    const { action } = await alertAction(file);
    const shown = await shownBy(file, action);
    expect([action.id, shown.properties, shown.fill, shown.labelColor]).toEqual([
      before,
      { variant: "default", Label: "Retry", Icon: false, Glyph: "Plus" },
      file.variable("Fuse tokens", "destructive").id,
      file.variable("Fuse tokens", "background").id,
    ]);
  });

  it("swaps the action to another variant without creating it again, in one Apply", async () => {
    const file = await appliedFile();
    const before = (await alertAction(file)).action.id;
    const outline = kitWith(BUTTON, { ...ACTION, variant: "button/variant=outline" });
    expect((await reconcileKit(file.figma, outline, false)).changes).toEqual([
      "Alert / tone=default / button: show Button variant=outline",
      "Alert: lay out 1 variants in 1 columns and 1 rows",
      "Fuse components: place Button, Alert and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, outline, true);
    file.reopen();
    expect(await reconcileKit(file.figma, outline, false)).toEqual({ changes: [], warnings: [] });
    const { action } = await alertAction(file);
    const shown = await shownBy(file, action);
    expect([action.id, shown.main, shown.properties, shown.fill]).toEqual([
      before,
      "variant=outline",
      { variant: "outline", Label: "Retry", Icon: false, Glyph: "Plus" },
      file.variable("Fuse tokens", "destructive").id,
    ]);
  });

  // NS: an override equal to the main's value is no override, so the fill follows the main again.
  it("puts a property and an override the spec drops back to the variant's own, which then follows the variant, in one Apply each", async () => {
    const file = await appliedFile();
    const plain = {
      ...ACTION,
      properties: { text: { Label: "Retry" } },
      overrides: [LABEL_COLOR],
    };
    const dropped = kitWith(BUTTON, plain);
    expect((await reconcileKit(file.figma, dropped, false)).changes).toEqual([
      "Alert / tone=default / button: properties → Icon true, Glyph Check",
      "Alert: lay out 1 variants in 1 columns and 1 rows",
      "Fuse components: place Button, Alert and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, dropped, true);
    file.reopen();
    expect(await reconcileKit(file.figma, dropped, false)).toEqual({ changes: [], warnings: [] });
    const { action } = await alertAction(file);
    expect([
      boundId(file.figma, action.fills),
      action.overrides.find((entry) => entry.id === action.id)?.overriddenFields,
    ]).toEqual([file.variable("Fuse tokens", "primary").id, ["name"]]);
    const edited = kitWith(
      buttonSet((variant) => buttonRoot(token(variant === "default" ? "success" : "background"))),
      plain
    );
    await reconcileKit(file.figma, edited, true);
    file.reopen();
    expect(await reconcileKit(file.figma, edited, false)).toEqual({ changes: [], warnings: [] });
    expect(boundId(file.figma, (await alertAction(file)).action.fills)).toBe(
      file.variable("Fuse tokens", "success").id
    );
  });

  // A swap property replaces the icon and its glyph, so the glyph's override waits for the write. The
  // swapped icon reads Plus's key (PK), so the override finds it by the Button's layer at its place.
  it("creates an action that swaps its glyph to Plus and colors it, and converges", async () => {
    const colored = kitWith(BUTTON, {
      ...ACTION,
      overrides: [ROOT_FILL, LABEL_COLOR, GLYPH_COLOR],
    });
    const file = await appliedFile(colored);
    expect(await reconcileKit(file.figma, colored, false)).toEqual({ changes: [], warnings: [] });
    const glyph = childNamed(
      childNamed(childNamed((await alertAction(file)).action, "FRAME", "Adornment"), "INSTANCE", "Glyph"),
      "VECTOR",
      "glyph"
    );
    expect(boundId(file.figma, glyph.fills)).toBe(file.variable("Fuse tokens", "success").id);
  });

  // The Button's own changes run before the Alert's, so the action compares with what they leave.
  it.each([
    [
      "an override equal to the fill the Button changes",
      kitWith(BUTTON, { ...ACTION, overrides: [LABEL_COLOR] }),
      kitWith(
        buttonSet((variant) => buttonRoot(token(variant === "default" ? "success" : "background"))),
        {
          ...ACTION,
          overrides: [{ path: [], field: "fill", color: token("primary") }, LABEL_COLOR],
        }
      ),
      async (file: FakeFigma) =>
        boundId(file.figma, (await alertAction(file)).action.fills) ===
        file.variable("Fuse tokens", "primary").id,
    ],
    [
      "a label equal to the default the Button changes",
      kitWith(BUTTON, { ...ACTION, properties: { ...ACTION.properties, text: {} } }),
      kitWith(
        { ...BUTTON, textProperties: [{ name: "Label", defaultValue: "Go" }] },
        { ...ACTION, properties: { ...ACTION.properties, text: { Label: "Button" } } }
      ),
      async (file: FakeFigma) => {
        const { action } = await alertAction(file);
        return Object.entries(action.componentProperties).some(
          ([id, { value }]) => id.startsWith("Label#") && value === "Button"
        );
      },
    ],
    [
      "a glyph override on a Plus the run draws again",
      kitWith(BUTTON, {
        ...ACTION,
        overrides: [GLYPH_COLOR],
      }),
      kitWith(
        BUTTON,
        {
          ...ACTION,
          overrides: [GLYPH_COLOR],
        },
        "M8 1v14M1 8h14"
      ),
      async (file: FakeFigma) => {
        const adornment = childNamed((await alertAction(file)).action, "FRAME", "Adornment");
        const glyph = childNamed(childNamed(adornment, "INSTANCE", "Glyph"), "VECTOR", "glyph");
        return boundId(file.figma, glyph.fills) === file.variable("Fuse tokens", "success").id;
      },
    ],
  ])("converges in one Apply on %s", async (_, before, after, holds) => {
    const file = await appliedFile(before);
    await reconcileKit(file.figma, after, true);
    file.reopen();
    expect([await reconcileKit(file.figma, after, false), await holds(file)]).toEqual([
      { changes: [], warnings: [] },
      true,
    ]);
  });

  it("overrides a layer the Button gains in the same run once that layer exists, in one Apply", async () => {
    const file = await appliedFile();
    const badge = { ...frame("button/badge", "Badge", []), fill: token("primary") };
    const gained = kitWith(
      buttonSet((variant) => {
        const root = buttonRoot(token(variant === "default" ? "primary" : "background"));
        return { ...root, children: [...root.children, badge] };
      }),
      {
        ...ACTION,
        overrides: [
          ROOT_FILL,
          LABEL_COLOR,
          { path: ["button/badge"], field: "fill", color: token("success") },
        ],
      }
    );
    expect((await reconcileKit(file.figma, gained, false)).changes).toContain(
      "Alert / tone=default / button: plan again once Button's changes land"
    );
    await reconcileKit(file.figma, gained, true);
    file.reopen();
    expect(await reconcileKit(file.figma, gained, false)).toEqual({ changes: [], warnings: [] });
    expect(boundId(file.figma, childNamed((await alertAction(file)).action, "FRAME", "Badge").fills)).toBe(
      file.variable("Fuse tokens", "success").id
    );
  });

  // N4: a height bound while the instance hugs it keeps the hug height, so the height is fixed first.
  it("fixes the action's height before it binds row-h, so the action takes row-h's length, and converges", async () => {
    const file = await appliedFile();
    const rowH = { kind: "variable", variable: { collection: "Fuse density", name: "row-h" } } as const;
    const bound = kitWith(BUTTON, {
      ...ACTION,
      sizing: { horizontal: FILL, vertical: { kind: "fixed", length: rowH } },
    });
    await reconcileKit(file.figma, bound, true);
    file.reopen();
    expect(await reconcileKit(file.figma, bound, false)).toEqual({ changes: [], warnings: [] });
    const { action } = await alertAction(file);
    expect([action.height, action.layoutSizingVertical, action.boundVariables?.height?.id]).toEqual([
      32,
      "FIXED",
      file.variable("Fuse density", "row-h").id,
    ]);
  });

  // N2: a component reads its old size until the instance nested in it is read, so the Alert's grid and
  // the previews read the Button instances first, and lay out again whenever the Button set changes.
  it("moves the Alert's grid and the previews when the Button shrinks, in one Apply", async () => {
    const file = await appliedFile();
    const shorter = kitWith(
      buttonSet((variant) => buttonRoot(token(variant === "default" ? "primary" : "background"), 28))
    );
    await reconcileKit(file.figma, shorter, true);
    file.reopen();
    expect(await reconcileKit(file.figma, shorter, false)).toEqual({ changes: [], warnings: [] });
    expect((await alertAction(file)).variant.height).toBe(16 + 28 + 16);
  });

  // N2 and N4: an axis the instance hugs follows its content after a resize fixed the other axis.
  it("moves the Alert's grid and the previews when the Button shrinks under an action fixed across and hugging down, in one Apply", async () => {
    const wide = {
      ...ACTION,
      sizing: { horizontal: { kind: "fixed", length: literal(200) }, vertical: HUG },
    } as const;
    const file = await appliedFile(kitWith(BUTTON, wide));
    const shorter = kitWith(
      buttonSet((variant) => buttonRoot(token(variant === "default" ? "primary" : "background"), 28)),
      wide
    );
    await reconcileKit(file.figma, shorter, true);
    file.reopen();
    const { variant, action } = await alertAction(file);
    expect([
      await reconcileKit(file.figma, shorter, false),
      action.width,
      action.height,
      variant.height,
    ]).toEqual([{ changes: [], warnings: [] }, 200, 28, 16 + 28 + 16]);
  });

  // N4: a height bound while the instance hugs it stays at the hug height until the height is fixed.
  it("writes row-h again when the action's height turns fixed, though its height already binds row-h", async () => {
    const file = await appliedFile();
    const rowH = file.variable("Fuse density", "row-h");
    (await alertAction(file)).action.setBoundVariable("height", rowH);
    file.reopen();
    const bound = kitWith(BUTTON, {
      ...ACTION,
      sizing: {
        horizontal: FILL,
        vertical: {
          kind: "fixed",
          length: { kind: "variable", variable: { collection: "Fuse density", name: "row-h" } },
        },
      },
    });
    await reconcileKit(file.figma, bound, true);
    file.reopen();
    const { action } = await alertAction(file);
    expect([
      await reconcileKit(file.figma, bound, false),
      action.height,
      action.layoutSizingVertical,
    ]).toEqual([{ changes: [], warnings: [] }, 32, "FIXED"]);
  });

  // NA: an alignment override on the label stays through the main's edits and an equal write, so the
  // plan reads the label's alignment against the spec's, and puts back the variant's own where the spec
  // drops the override.
  it("centers the action's label with its override, keeps it through an in-place Button edit, and puts back the variant's own, each converging", async () => {
    const centered = { ...ACTION, overrides: [ROOT_FILL, LABEL_COLOR, LABEL_CENTER] };
    const file = await appliedFile(kitWith(BUTTON, centered));
    const label = async () => childNamed((await alertAction(file)).action, "TEXT", "Label");
    expect([
      await reconcileKit(file.figma, kitWith(BUTTON, centered), false),
      (await label()).textAlignHorizontal,
    ]).toEqual([{ changes: [], warnings: [] }, "CENTER"]);
    const padded = buttonSet((variant) =>
      variant === "default" ? buttonRoot(token("primary"), 36, 16) : buttonRoot(token("background"))
    );
    const edited = kitWith(padded, centered);
    await reconcileKit(file.figma, edited, true);
    file.reopen();
    expect([await reconcileKit(file.figma, edited, false), (await label()).textAlignHorizontal]).toEqual([
      { changes: [], warnings: [] },
      "CENTER",
    ]);
    const dropped = kitWith(padded, { ...ACTION, overrides: [ROOT_FILL, LABEL_COLOR] });
    expect((await reconcileKit(file.figma, dropped, false)).changes).toContain(
      "Alert / tone=default / button / Label: textAlignHorizontal → LEFT"
    );
    await reconcileKit(file.figma, dropped, true);
    file.reopen();
    expect([await reconcileKit(file.figma, dropped, false), (await label()).textAlignHorizontal]).toEqual([
      { changes: [], warnings: [] },
      "LEFT",
    ]);
  });

  // Rule 21: an alignment write needs every font the label holds, as a TEXT write does.
  it("loads the font a designer gave the action's label before it aligns the label, and converges", async () => {
    const file = await appliedFile();
    const bold = { family: "Roboto", style: "Bold" };
    await file.figma.loadFontAsync(bold);
    childNamed((await alertAction(file)).action, "TEXT", "Label").fontName = bold;
    file.reopen();
    const centered = kitWith(BUTTON, { ...ACTION, overrides: [ROOT_FILL, LABEL_COLOR, LABEL_CENTER] });
    await reconcileKit(file.figma, centered, true);
    file.reopen();
    expect([
      await reconcileKit(file.figma, centered, false),
      childNamed((await alertAction(file)).action, "TEXT", "Label").textAlignHorizontal,
    ]).toEqual([{ changes: [], warnings: [] }, "CENTER"]);
  });

  // A TEXT write changes the label's characters, which needs every font the label holds.
  it("loads the font a designer gave the action's label before it writes the label, and converges", async () => {
    const file = await appliedFile();
    const bold = { family: "Roboto", style: "Bold" };
    await file.figma.loadFontAsync(bold);
    childNamed((await alertAction(file)).action, "TEXT", "Label").fontName = bold;
    file.reopen();
    const undo = kitWith(BUTTON, {
      ...ACTION,
      properties: { ...ACTION.properties, text: { Label: "Undo" } },
    });
    await reconcileKit(file.figma, undo, true);
    file.reopen();
    expect([
      await reconcileKit(file.figma, undo, false),
      childNamed((await alertAction(file)).action, "TEXT", "Label").characters,
    ]).toEqual([{ changes: [], warnings: [] }, "Undo"]);
  });

  // NS: the glyph shows the library's color until an override differs from it, so the action's
  // glyph color, equal to the library's before the run, waits for the library's repaint.
  it("keeps the action's glyph black when the library recolors its glyphs, in one Apply", async () => {
    const black = { ...GLYPH_COLOR, color: BLACK };
    const action = { ...ACTION, overrides: [ROOT_FILL, LABEL_COLOR, black] };
    const file = await appliedFile(kitWith(BUTTON, action));
    const recolored = kitWith(BUTTON, action, PLUS, token("primary"));
    await reconcileKit(file.figma, recolored, true);
    file.reopen();
    const adornment = childNamed((await alertAction(file)).action, "FRAME", "Adornment");
    const [paint] = paintsOf(file, childNamed(childNamed(adornment, "INSTANCE", "Glyph"), "VECTOR", "glyph"));
    expect([
      await reconcileKit(file.figma, recolored, false),
      paint?.type === "SOLID" && paint.color,
    ]).toEqual([
      { changes: [], warnings: [] },
      { r: 0, g: 0, b: 0 },
    ]);
  });
});

// Unit under test: `reconcileKit` on a Button whose icon hides behind a BOOLEAN property and swaps
// through an INSTANCE_SWAP one, as a menu row's icon does, and an Alert whose action shows the icon
// and swaps it to Plus. Oracle: the fake's rule 43, which follows what a real file did on 2026-10-25
// (PI2): one icon instance holds both links, hides while the property starts false and keeps both
// through a swap. The second Plan lists nothing.
describe("an icon that hides behind a BOOLEAN property and swaps through another", () => {
  const OPTIONAL_GLYPH: IconLayerSpec = { ...GLYPH, visibleProperty: "Icon" };
  const button: ComponentSetSpec = {
    ...buttonSet((variant) => ({
      ...buttonRoot(token(variant === "default" ? "primary" : "background")),
      children: [OPTIONAL_GLYPH, LABEL],
    })),
    booleanProperties: [{ name: "Icon", defaultValue: false }],
  };
  const action: InstanceLayerSpec = {
    ...ACTION,
    properties: { boolean: { Icon: true }, swap: { Glyph: "icon/Plus" } },
  };
  const kit = kitWith(button, action);

  it("links the icon's visibility and glyph in one Apply, and a second Plan lists nothing", async () => {
    const file = await appliedFile(kit);
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    const set = await setOf(file, "button");
    const [variant] = set.children;
    if (variant?.type !== "COMPONENT") {
      throw new Error("the Button set holds no variant");
    }
    const ids = Object.keys(set.componentPropertyDefinitions);
    const glyph = childNamed(variant, "INSTANCE", "Glyph");
    expect([glyph.componentPropertyReferences, glyph.visible]).toEqual([
      {
        visible: ids.find((id) => id.startsWith("Icon#")),
        mainComponent: ids.find((id) => id.startsWith("Glyph#")),
      },
      false,
    ]);
  });

  it("shows the action's icon as Plus, swapped through the property, and keeps it in a second run", async () => {
    const file = await appliedFile(kit);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    const icon = childNamed((await alertAction(file)).action, "INSTANCE", "Glyph");
    expect([icon.visible, (await icon.getMainComponentAsync())?.name]).toEqual([true, "Plus"]);
  });
});

// Unit under test: `reconcileKit` on an instance that hugs across from a minimum width, as a popup's
// widest row does. Oracle: the fake's rule 44, which follows what a real file did on 2026-10-25 (PH3):
// the root takes the `minWidth`, lists it and `minHeight` among its overrides, and keeps them listed.
// The second Plan lists nothing, so the plan reads neither as an override to drop.
describe("an instance that hugs across from a minimum width", () => {
  const action: InstanceLayerSpec = {
    ...ACTION,
    sizing: { horizontal: HUG, vertical: HUG },
    minWidth: literal(88),
  };
  const kit = kitWith(BUTTON, action);

  it("writes the minimum in one Apply, and a second Plan lists nothing", async () => {
    const file = await appliedFile(kit);
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    const { action: held } = await alertAction(file);
    expect([held.minWidth, held.layoutSizingHorizontal]).toEqual([88, "HUG"]);
  });

  it("stops Plan before any write where the minimum binds a color variable", async () => {
    const file = tokenFile();
    const bound = kitWith(BUTTON, {
      ...action,
      minWidth: { kind: "variable", variable: { collection: "Fuse tokens", name: "background" } },
    });
    await expect(reconcileKit(file.figma, bound, false)).rejects.toThrow(
      "Fuse tokens/background is a COLOR variable, and the kit binds it to a field that takes a FLOAT."
    );
  });

  it("takes the minimum back to none when the spec drops it, and converges", async () => {
    const file = await appliedFile(kit);
    const { minWidth: _dropped, ...plain } = action;
    const kitWithout = kitWith(BUTTON, plain);
    expect((await reconcileKit(file.figma, kitWithout, false)).changes).toContain(
      "Alert / tone=default / button: minWidth → none"
    );
    await reconcileKit(file.figma, kitWithout, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kitWithout, false)).toEqual({ changes: [], warnings: [] });
  });
});
