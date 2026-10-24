/**
 * `reconcileKit` end to end against the in-memory file in `fake-figma.ts`, with the kit
 * `buildKit()` writes from the recipes and the variables `fuseVariableSet()` syncs. The fake models
 * the Figma rules the real runs in 2026-10 confirmed, and throws for any Plugin API member it does
 * not model. The oracles are hand-written: the pages, sets and previews of `test/kit-inventory.ts`,
 * from which the change lines Plan must list are built, the values the Button recipe and the theme
 * catalog give, and the order the kit's axes declare.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { walkLayers } from "../../src/components/kit-spec.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import { ICONS_PAGE, inventoryPage, KIT_PAGES, pageKey } from "../../test/kit-inventory.ts";
import { drawsShadowSpread, paintsAbove } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, RED_PIXEL } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";
import {
  appliedFile,
  componentSet,
  CREATE_AND_PLACE_PREVIEWS,
  CREATE_PAGES,
  iconLibrary,
  kitFixture,
  kitPage,
  previewNames,
  setOn,
  syncedFile,
} from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  ({ kit, collections } = await kitFixture());
}, 60_000);

const DEFAULT_BUTTON = "variant=default, size=default, state=rest, icon=none";
const LAY_OUT_BUTTONS = "Button: lay out 420 variants in 5 columns and 84 rows";
const PLACE = "Button: place Button, Icon button and Confirm button in a row and stack 4 previews below them";

/** The change line of an instance that waits for Button's changes, at its label. */
const waitsForButton = (label: string) => `${label} / button: plan again once Button's changes land`;

/**
 * What any change to the Button set makes Plan list for the sets that hold Button instances, in kit
 * order: Empty's two actions in each of its 3 variants and Alert's action in each of its 10. Each
 * instance plans again once Button's changes land, and each set's grid, which reads the instances'
 * sizes, lays out again after them.
 */
const AFTER_BUTTON = [
  ...["default", "outline", "outline-dashed"].flatMap((frame) => [
    waitsForButton(`Empty / variant=${frame} / empty-content`),
    waitsForButton(`Empty / variant=${frame} / empty-content`),
  ]),
  "Empty: lay out 3 variants in 3 columns and 1 rows",
  ...["default", "destructive", "warning", "success", "info"].flatMap((tone) =>
    ["off", "on"].map((described) =>
      waitsForButton(`Alert / variant=${tone}, described=${described} / item-actions`)
    )
  ),
  "Alert: lay out 10 variants in 2 columns and 5 rows",
];

/** The pages of the sets that hold Button instances, which place their sets and previews again after them. */
const PLACE_AFTER_BUTTON = [
  "Empty: place Empty in a row and stack 4 previews below them",
  "Alert: place Alert in a row and stack 4 previews below them",
];

/** The component sets a run creates, page by page. */
const CREATE_SETS = KIT_PAGES.flatMap((page) =>
  page.sets.map((set) => `${page.name}: create the component set ${set.name} with ${set.variants} variants`)
);

/** The gray `ring` holds in Fjordkraft's internal private light theme, the file's default modes. */
const RING_GRAY = 0.502;

async function changes(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, kit, false)).changes;
}

/** The modes a frame pins, as collection and mode names. */
async function pinnedModes(file: FakeFigma, frame: FrameNode): Promise<Record<string, string | undefined>> {
  const collectionsById = new Map(
    (await file.figma.variables.getLocalVariableCollectionsAsync()).map((collection) => [
      collection.id,
      collection,
    ])
  );
  return Object.fromEntries(
    Object.entries(frame.explicitVariableModes).map(([id, modeId]) => {
      const collection = collectionsById.get(id);
      return [
        collection?.name ?? id,
        collection?.modes.find((mode) => mode.modeId === modeId)?.name,
      ] as const;
    })
  );
}

function variantNamed(set: ComponentSetNode, name: string): ComponentNode {
  const variant = set.children.find(
    (node): node is ComponentNode => node.type === "COMPONENT" && node.name === name
  );
  if (variant === undefined) {
    throw new Error(`${set.name} has no variant ${name}`);
  }
  return variant;
}

function onlyShadow(node: ComponentNode, index = 0): DropShadowEffect {
  const effect = node.effects[index];
  if (effect?.type !== "DROP_SHADOW") {
    throw new Error(`${node.name} casts no drop shadow at ${index}`);
  }
  return effect;
}

function onlySolid(paints: ReadonlyArray<Paint> | PluginAPI["mixed"], figma: PluginAPI): SolidPaint {
  if (paints === figma.mixed || paints.length !== 1) {
    throw new Error("the layer holds no single paint");
  }
  const [paint] = paints;
  if (paint?.type !== "SOLID") {
    throw new Error("the layer's paint is not solid");
  }
  return paint;
}

/** The text layers below a node, at any depth, in layer order. */
/** The texts of a node's own layers, down to its instances, whose texts are their main's, as the spec walks them. */
function textsIn(node: BaseNode): TextNode[] {
  if (node.type === "TEXT") {
    return [node];
  }
  return "children" in node && node.type !== "INSTANCE" ? node.children.flatMap(textsIn) : [];
}

function property(set: ComponentSetNode, name: string): ComponentPropertyDefinitions[string] {
  const found = Object.entries(set.componentPropertyDefinitions).find(
    ([id]) => id === name || id.startsWith(`${name}#`)
  );
  if (found === undefined) {
    throw new Error(`${set.name} has no property ${name}`);
  }
  return found[1];
}

describe("Apply on a synced file without the kit pages", () => {
  let file: FakeFigma;
  let applied: Awaited<ReturnType<typeof reconcileKit>>;

  beforeAll(async () => {
    file = syncedFile(collections);
    applied = await reconcileKit(file.figma, kit, true);
    file.reopen();
  }, 60_000);

  it("creates each page and each node on it once, and a second Plan lists nothing", async () => {
    expect(applied).toEqual({
      changes: [
        ...CREATE_PAGES,
        "Icons: create the Icons frame with 135 icons",
        ...CREATE_SETS,
        ...CREATE_AND_PLACE_PREVIEWS,
      ],
      warnings: [],
    });
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });

  it("shows the Button page and leaves nothing behind on the page that was current", async () => {
    const [first, ...pages] = file.figma.root.children;
    expect(first?.name).toBe("Page 1");
    await first?.loadAsync();
    expect(first?.children).toEqual([]);
    expect(pages.map((page) => page.name)).toEqual([...KIT_PAGES, ICONS_PAGE].map((page) => page.name));
    expect(file.figma.currentPage).toBe(pages[0]);
    for (const page of KIT_PAGES) {
      expect(
        (await kitPage(file, pageKey(page))).children.map((node) => node.name),
        page.name
      ).toEqual([...page.sets.map((set) => set.name), ...previewNames(page)]);
    }
    expect((await kitPage(file, ICONS_PAGE.key)).children.map((node) => node.name)).toEqual(["Icons"]);
  });

  it("pins each preview's theme at Auto density, with a row of instances per set on the page", async () => {
    const page = await kitPage(file);
    const sets = new Map(
      page.children.flatMap((node) =>
        node.type === "COMPONENT_SET" ? [[node.name, new Set(node.children.map((child) => child.id))]] : []
      )
    );
    const previews = page.children.filter((node): node is FrameNode => node.type === "FRAME");
    const internal = { "Fuse variant": "Internal", "Fuse segment": "Private", "Fuse brand": "Fjordkraft" };
    const external = { ...internal, "Fuse variant": "External" };
    expect(await Promise.all(previews.map((preview) => pinnedModes(file, preview)))).toEqual([
      { "Fuse tokens": "Light", ...internal, "Fuse density": "Auto" },
      { "Fuse tokens": "Dark", ...internal, "Fuse density": "Auto" },
      { "Fuse tokens": "Light", ...external, "Fuse density": "Auto" },
      { "Fuse tokens": "Dark", ...external, "Fuse density": "Auto" },
    ]);
    for (const preview of previews) {
      const groups = preview.children.filter((node): node is FrameNode => node.type === "FRAME");
      expect(groups.map((group) => [group.name, group.children.length])).toEqual(
        inventoryPage("button").sets.map((set) => [set.name, set.previewed])
      );
      // A group has no padding, so it must not clip a focus ring at its edge.
      expect(groups.map((group) => group.clipsContent)).toEqual([false, false, false]);
      for (const group of groups) {
        const variants = sets.get(group.name);
        for (const instance of group.children) {
          if (instance.type !== "INSTANCE") {
            throw new Error(`${group.name} holds a ${instance.type}`);
          }
          expect(variants?.has((await instance.getMainComponentAsync())?.id ?? "")).toBe(true);
        }
      }
    }
  });

  // Rule 31 (PZ): a fill never widens a 0-wide text, so a text that fills across must have a width
  // before its fill is written, or its characters stack one per line.
  it("gives every text the spec fills across a width", async () => {
    const filling = kit.componentSets.flatMap((set) =>
      set.variants.flatMap((variant) =>
        walkLayers(variant.root).filter(
          (layer) => layer.kind === "text" && layer.sizing.horizontal.kind === "fill"
        )
      )
    );
    const texts = [];
    for (const page of KIT_PAGES) {
      const sets = (await kitPage(file, pageKey(page))).children.filter(
        (node) => node.type === "COMPONENT_SET"
      );
      texts.push(...sets.flatMap(textsIn));
    }
    const filled = texts.filter((text) => text.layoutSizingHorizontal === "FILL");
    expect(filled).toHaveLength(filling.length);
    expect(filled.filter((text) => text.width < 1).map((text) => text.id)).toEqual([]);
  });

  // A real file drew a part's spread ring only over a visible fill with clipping on (PR2), as rule 3
  // reads for a root.
  it("draws the ring of a focused Accordion trigger, a part below the item", async () => {
    const focused = variantNamed(
      setOn(await kitPage(file, "page/accordion"), "Accordion item"),
      "variant=default, radius=none, open=off, state=focus"
    );
    const header = childNamed(focused, "FRAME", "accordion-header");
    const trigger = childNamed(header, "FRAME", "accordion-trigger");
    expect([trigger.effects.length, drawsShadowSpread(trigger)]).toEqual([1, true]);
  });

  // The trigger paints after the open panel's fill in the browser (CSS Flexbox 1 §4.3), and Figma
  // paints it above the panel only once the item puts its first layer on top (rule 33, PZ2).
  it("paints the ring of a focused trigger above the open card panel, and a resting one below it", async () => {
    const set = setOn(await kitPage(file, "page/accordion"), "Accordion item");
    const ringAbovePanel = (state: string) => {
      const open = variantNamed(set, `variant=card, radius=none, open=on, state=${state}`);
      const trigger = childNamed(childNamed(open, "FRAME", "accordion-header"), "FRAME", "accordion-trigger");
      return paintsAbove(trigger, childNamed(open, "FRAME", "accordion-content"));
    };
    expect([ringAbovePanel("focus"), ringAbovePanel("rest")]).toEqual([true, false]);
  });

  it("writes nothing on a second Apply but showing the page", async () => {
    const before = file.writes.length;
    expect((await reconcileKit(file.figma, kit, true)).changes).toEqual([]);
    expect(file.writes.slice(before)).toEqual([`${(await kitPage(file)).id} show the page`]);
  });

  it("gives a ghost Button in focus a fill Figma counts and that changes no pixel, so its ring draws", async () => {
    const ghost = variantNamed(
      await componentSet(file, "Button"),
      "variant=ghost, size=default, state=focus, icon=none"
    );
    expect(drawsShadowSpread(ghost)).toBe(true);
    const fill = onlySolid(ghost.fills, file.figma);
    expect(fill.opacity).toBeGreaterThan(0);
    expect((fill.opacity ?? 1) * 255).toBeLessThan(0.5);
    const ring = onlyShadow(ghost);
    expect(ring).toMatchObject({ offset: { x: 0, y: 0 }, radius: 0, spread: 2 });
    expect(ring.boundVariables?.color?.id).toBe(file.variable("Fuse tokens", "ring").id);
    expect(ring.color.r).toBeCloseTo(RING_GRAY, 2);
    expect(ring.color.a).toBe(1);
  });

  it("binds the outline Button's shadow to the outline lengths, which a 1px outline sets to shadow-xs", async () => {
    const outline = variantNamed(
      await componentSet(file, "Button"),
      "variant=outline, size=default, state=rest, icon=none"
    );
    const shadow = onlyShadow(outline);
    // max(0, 4 - 2 * 1) and min(0, 2 - 2 * 1): Tailwind's shadow-xs, 0 1px 2px.
    expect(shadow).toMatchObject({ offset: { x: 0, y: 1 }, radius: 2, spread: 0 });
    expect(shadow.color.a).toBeCloseTo(0.05, 5);
    expect(shadow.boundVariables).toEqual({
      radius: { type: "VARIABLE_ALIAS", id: file.variable("Fuse tokens", "button-outline-shadow-blur").id },
      spread: { type: "VARIABLE_ALIAS", id: file.variable("Fuse tokens", "button-outline-shadow-spread").id },
    });
  });

  it("lists each axis in the recipe's order and makes the default Button each set's default", async () => {
    const button = await componentSet(file, "Button");
    expect(property(button, "variant")).toEqual({
      type: "VARIANT",
      defaultValue: "default",
      variantOptions: ["default", "outline", "secondary", "ghost", "destructive", "success", "link"],
    });
    expect(property(button, "size")).toEqual({
      type: "VARIANT",
      defaultValue: "default",
      variantOptions: ["default", "xs", "sm", "lg"],
    });
    expect(property(button, "state").variantOptions).toEqual([
      "rest",
      "hover",
      "focus",
      "disabled",
      "pending",
    ]);
    expect(property(button, "icon").variantOptions).toEqual(["none", "start", "end"]);
    expect(button.defaultVariant.name).toBe(DEFAULT_BUTTON);

    const iconButton = await componentSet(file, "Icon button");
    expect(property(iconButton, "size").variantOptions).toEqual(["icon", "icon-xs", "icon-sm", "icon-lg"]);
    expect(iconButton.defaultVariant.name).toBe("variant=default, size=icon, state=rest");
  });

  it("starts each swap property with its icon and offers all 135 library icons", async () => {
    const icons = await iconLibrary(file);
    const plus = childNamed(icons, "COMPONENT", "Plus");
    const arrow = childNamed(icons, "COMPONENT", "ArrowRight");
    const button = await componentSet(file, "Button");
    const start = property(button, "Start icon");
    expect(start).toMatchObject({ type: "INSTANCE_SWAP", defaultValue: plus.id });
    expect(start.preferredValues).toHaveLength(135);
    expect(start.preferredValues).toContainEqual({ type: "COMPONENT", key: plus.key });
    expect(property(button, "End icon")).toMatchObject({ type: "INSTANCE_SWAP", defaultValue: arrow.id });
    expect(property(await componentSet(file, "Icon button"), "Icon")).toMatchObject({
      type: "INSTANCE_SWAP",
      defaultValue: plus.id,
    });
  });

  it("shows Plus at the start of a default Button, its glyph in the label's primary-foreground", async () => {
    const variant = variantNamed(
      await componentSet(file, "Button"),
      "variant=default, size=default, state=rest, icon=start"
    );
    const icon = childNamed(variant, "INSTANCE", "Start icon");
    expect((await icon.getMainComponentAsync())?.name).toBe("Plus");
    expect(icon.componentPropertyReferences?.mainComponent).toMatch(/^Start icon#/);
    const glyph = childNamed(icon, "VECTOR", "glyph");
    expect(onlySolid(glyph.fills, file.figma).boundVariables?.color?.id).toBe(
      file.variable("Fuse tokens", "primary-foreground").id
    );
  });

  it("draws each icon as one glyph in the library's foreground, and leaves the artwork out", async () => {
    const icons = await iconLibrary(file);
    const plus = childNamed(icons, "COMPONENT", "Plus");
    expect(plus.children.map((node) => [node.type, node.name])).toEqual([["VECTOR", "glyph"]]);
    expect(onlySolid(childNamed(plus, "VECTOR", "glyph").fills, file.figma).boundVariables?.color?.id).toBe(
      file.variable("Fuse tokens", "foreground").id
    );
    // vipps.tsx draws white shapes and signing.tsx paints with token classes, so neither is an
    // icon that follows the label's color.
    expect(icons.children.map((node) => node.name)).not.toContain("Vipps");
    expect(icons.children.map((node) => node.name)).not.toContain("Signing");
  });
});

describe("a later run on an applied file", () => {
  // The owner's file on 2026-10-23 held every filling text at width 0, written by a plugin that laid
  // a new text out before its characters. Under rule 31 that text stays 0 wide whatever FILL it
  // reads, until a positive width lets the fill take over (PZ). An interrupted Apply can also leave
  // it empty and unlinked, and the run that gives its characters back must widen it too.
  it.each([
    ["holding its characters", (characters: string) => characters],
    ["empty and unlinked", () => ""],
  ])("repairs a filling text an earlier run left 0 wide and %s, in one Apply", async (_case, held0) => {
    const file = await appliedFile();
    // Input's text is its root's own label, a filling text the variant holds directly.
    const parent = setOn(await kitPage(file, "page/input"), "Input").children[0];
    const held = parent?.type === "COMPONENT" ? textsIn(parent)[0] : undefined;
    if (parent?.type !== "COMPONENT" || held?.layoutSizingHorizontal !== "FILL") {
      throw new Error("the Input set's first variant holds no filling text");
    }
    const { name, characters } = held;
    const index = parent.children.indexOf(held);
    const key = keyOf(held);
    held.remove();
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const stale = file.figma.createText();
    parent.insertChild(index, stale);
    setKey(stale, key);
    stale.name = name;
    stale.textAutoResize = "HEIGHT";
    stale.layoutSizingHorizontal = "FILL";
    stale.characters = held0(characters);
    expect([stale.width, stale.componentPropertyReferences?.characters]).toEqual([0, undefined]);

    expect(await changes(file)).toContainEqual(
      expect.stringContaining(`${name}: width → 1 for the fill to take over, layoutSizingHorizontal → FILL`)
    );
    await reconcileKit(file.figma, kit, true);
    expect([stale.layoutSizingHorizontal, stale.width >= 1, stale.characters]).toEqual([
      "FILL",
      true,
      characters,
    ]);
    expect(stale.componentPropertyReferences?.characters).toBeDefined();
    expect(await changes(file)).toEqual([]);
  });

  // On the owner's file on 2026-10-23 an Apply that shrank variants stacked the previews by their
  // instances' old heights, since an instance takes its main component's new size only when read
  // (PI, rule 32), and the next Plan listed the page placement again.
  it("stacks the previews by the heights their instances settle at when a variant shrinks, in one Apply", async () => {
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/checkbox"), "Checkbox");
    const variant = variantNamed(set, "checked=off, state=rest");
    variant.resize(variant.width, 200);
    file.reopen();

    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect([variant.height, await changes(file)]).toEqual([16, []]);
  });

  it("keeps the keys of a renamed variant and a renamed label, and plans only their names back", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    const variant = variantNamed(button, DEFAULT_BUTTON);
    const label = childNamed(variant, "TEXT", "label");
    variant.name = "Primary";
    label.name = "Title";

    expect(await changes(file)).toEqual([
      `Button / ${DEFAULT_BUTTON}: name → ${DEFAULT_BUTTON}`,
      `Button / ${DEFAULT_BUTTON} / label: name → label`,
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(variant.name).toBe(DEFAULT_BUTTON);
    expect(label.name).toBe("label");
    expect(await changes(file)).toEqual([]);
  });

  it("stops Plan and Apply before any write when a designer duplicates a variant", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    button.appendChild(variantNamed(button, DEFAULT_BUTTON).clone());
    const before = file.writes.length;

    const message =
      "Button holds 2 layers with the key button/variant=default,size=default,state=rest,icon=none. Delete the copies, then run the plugin again.";
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
    expect(file.writes.slice(before)).toEqual([]);
  });

  it("recreates a deleted variant alone, in its place among the variants", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    const name = "variant=outline, size=xs, state=hover, icon=end";
    variantNamed(button, name).remove();

    expect(await changes(file)).toEqual([
      `Button: create the variant ${name}`,
      "Button: reorder the variants",
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    // Variant 1 of 7, size 1 of 4, state 1 of 5 and icon 2 of 3, counted from 0, with the icon
    // varying fastest: ((1 × 4 + 1) × 5 + 1) × 3 + 2.
    expect(button.children[80]?.name).toBe(name);
  });

  it("puts back a variant a designer moved last, and the icon menu keeps its order throughout", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    button.appendChild(variantNamed(button, DEFAULT_BUTTON));
    expect(property(button, "icon").variantOptions).toEqual(["none", "start", "end"]);

    expect(await changes(file)).toEqual([
      "Button: reorder the variants",
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect(button.children[0]?.name).toBe(DEFAULT_BUTTON);
    expect(property(button, "icon").variantOptions).toEqual(["none", "start", "end"]);
  });

  it("swaps an icon layer a designer swapped back to its icon, and colors the new glyph", async () => {
    const file = await appliedFile();
    const variant = variantNamed(
      await componentSet(file, "Button"),
      "variant=default, size=default, state=rest, icon=start"
    );
    const icon = childNamed(variant, "INSTANCE", "Start icon");
    icon.swapComponent(childNamed(await iconLibrary(file), "COMPONENT", "ArrowLeft"));

    const label = "Button / variant=default, size=default, state=rest, icon=start / Start icon";
    expect(await changes(file)).toEqual([
      `${label}: show Plus`,
      `${label}: glyph fill → primary-foreground`,
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect((await icon.getMainComponentAsync())?.name).toBe("Plus");
  });

  it("rebuilds a deleted icon library and points every icon layer at the new icons", async () => {
    const file = await appliedFile();
    (await iconLibrary(file)).remove();

    const plan = await changes(file);
    expect(plan.slice(0, 3)).toEqual([
      "Icons: create the Icons frame with 135 icons",
      "Button: Start icon → Plus and the 135 library icons",
      "Button: End icon → ArrowRight and the 135 library icons",
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    const plus = childNamed(await iconLibrary(file), "COMPONENT", "Plus");
    const variant = variantNamed(
      await componentSet(file, "Icon button"),
      "variant=default, size=icon, state=rest"
    );
    expect(await childNamed(variant, "INSTANCE", "Icon").getMainComponentAsync()).toBe(plus);
  });

  it("redraws an icon whose markup changed and colors every glyph that redraw replaced, in one Apply", async () => {
    const file = await appliedFile();
    const changed: KitSpec = {
      ...kit,
      icons: {
        ...kit.icons,
        icons: kit.icons.icons.map((icon) =>
          icon.name === "Plus"
            ? { ...icon, svg: icon.svg.replace("<path ", '<path data-version="2" ') }
            : icon
        ),
      },
    };
    await reconcileKit(file.figma, changed, true);
    expect((await reconcileKit(file.figma, changed, false)).changes).toEqual([]);
    const start = childNamed(
      variantNamed(
        await componentSet(file, "Button"),
        "variant=default, size=default, state=rest, icon=start"
      ),
      "INSTANCE",
      "Start icon"
    );
    expect(onlySolid(childNamed(start, "VECTOR", "glyph").fills, file.figma).boundVariables?.color?.id).toBe(
      file.variable("Fuse tokens", "primary-foreground").id
    );
  });

  it("unclips a preview group a designer set to clip, in one Apply", async () => {
    const file = await appliedFile();
    const preview = childNamed(await kitPage(file), "FRAME", "Button / Fjordkraft internal private, light");
    const group = childNamed(preview, "FRAME", "Button");
    group.clipsContent = true;

    expect(await changes(file)).toEqual([
      "Button / Fjordkraft internal private, light / Button: clipsContent → false",
      PLACE,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(group.clipsContent).toBe(false);
    expect(await changes(file)).toEqual([]);
  });

  it("warns about a layer a designer dropped into a preview, and keeps it", async () => {
    const file = await appliedFile();
    const preview = childNamed(await kitPage(file), "FRAME", "Button / Fjordkraft internal private, light");
    const note = file.figma.createFrame();
    note.name = "Note";
    preview.appendChild(note);

    const { changes: planned, warnings } = await reconcileKit(file.figma, kit, false);
    // The note makes the preview, which hugs its height, taller, so the previews below it move down
    // (rule 32).
    expect(planned).toEqual([PLACE]);
    expect(warnings).toEqual([
      "Button / Fjordkraft internal private, light: keeps the layer Note, which the kit does not own",
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(preview.children).toContain(note);
  });

  it("brings an icon a designer scaled back to 16px with its glyph, in one Apply", async () => {
    const file = await appliedFile();
    const plus = childNamed(await iconLibrary(file), "COMPONENT", "Plus");
    const glyph = childNamed(plus, "VECTOR", "glyph");
    plus.resize(32, 32);
    expect([glyph.width, glyph.height]).toEqual([32, 32]);

    await reconcileKit(file.figma, kit, true);
    expect([plus.width, plus.height, glyph.width, glyph.height]).toEqual([16, 16, 16, 16]);
    expect(await changes(file)).toEqual([]);
  });

  it.each([
    ["moved", (glyph: VectorNode) => (glyph.x += 2)],
    ["scaled", (glyph: VectorNode) => glyph.resize(glyph.width * 2, glyph.height * 2)],
  ])("redraws an icon whose glyph a designer %s inside it, in one Apply", async (_, edit) => {
    const file = await appliedFile();
    const plus = childNamed(await iconLibrary(file), "COMPONENT", "Plus");
    const drawn = childNamed(plus, "VECTOR", "glyph");
    const box = [drawn.x, drawn.y, drawn.width, drawn.height];
    edit(drawn);

    expect(await changes(file)).toContain("Icons / Plus: draw the icon from its Fuse markup");
    await reconcileKit(file.figma, kit, true);
    const glyph = childNamed(plus, "VECTOR", "glyph");
    expect([glyph.x, glyph.y, glyph.width, glyph.height]).toEqual(box);
    expect(await changes(file)).toEqual([]);
  });

  it("repairs a focus ring that keeps a stale black under its ring binding in one Apply", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    const focus = variantNamed(button, "variant=default, size=default, state=focus, icon=none");
    focus.effects = [{ ...onlyShadow(focus), color: { r: 0, g: 0, b: 0, a: 1 } }];
    expect(onlyShadow(focus).color).toEqual({ r: 0, g: 0, b: 0, a: 1 });

    expect(await changes(file)).toEqual([
      "Button / variant=default, size=default, state=focus, icon=none: shadows → ring 0 0 0 2 (holds variable, stored #000000 at 100%, 0 0 0 2)",
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect(onlyShadow(focus).color.r).toBeCloseTo(RING_GRAY, 2);
  });

  it("plans nothing for the Button, Separator and Switch boxes as a real file held them on 2026-10-22", async () => {
    const file = await appliedFile();
    const button = variantNamed(await componentSet(file, "Button"), DEFAULT_BUTTON);
    const label = childNamed(button, "TEXT", "label");
    const separators = setOn(await kitPage(file, "page/separator"), "Separator");
    const across = variantNamed(separators, "orientation=horizontal");
    const down = variantNamed(separators, "orientation=vertical");
    const track = variantNamed(
      setOn(await kitPage(file, "page/switch"), "Switch"),
      "size=default, checked=off, state=rest"
    );
    const thumb = childNamed(track, "FRAME", "switch-thumb");
    const dot = childNamed(thumb, "FRAME", "dot");

    // Write each box's layout through the members the plugin wrote before sizing became a
    // projection, into the state the real file held: a resize, then both sizing modes.
    const writeAsBefore = (box: FrameNode | ComponentNode, primary: "AUTO" | "FIXED"): void => {
      box.layoutMode = "HORIZONTAL";
      box.resize(box.width, box.height);
      box.primaryAxisSizingMode = primary;
      box.counterAxisSizingMode = "FIXED";
      box.minWidth = null;
      box.maxWidth = null;
      box.minHeight = null;
      box.maxHeight = null;
    };
    writeAsBefore(button, "AUTO");
    for (const box of [across, down, track, thumb, dot]) {
      writeAsBefore(box, "FIXED");
    }
    const font = label.fontName;
    if (font !== file.figma.mixed) {
      await file.figma.loadFontAsync(font);
    }
    label.textAutoResize = "WIDTH_AND_HEIGHT";

    // What the real file read on each, probe P0 of the batch run.
    const layout = (box: FrameNode | ComponentNode) => [
      box.layoutMode,
      box.layoutSizingHorizontal,
      box.layoutSizingVertical,
      box.primaryAxisSizingMode,
      box.counterAxisSizingMode,
      box.clipsContent,
    ];
    expect(layout(button)).toEqual(["HORIZONTAL", "HUG", "FIXED", "AUTO", "FIXED", true]);
    expect([button.minWidth, button.maxWidth, button.minHeight, button.maxHeight]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect([label.layoutSizingHorizontal, label.layoutSizingVertical]).toEqual(["HUG", "HUG"]);
    expect([...layout(across), across.width, across.height]).toEqual([
      "HORIZONTAL",
      "FIXED",
      "FIXED",
      "FIXED",
      "FIXED",
      true,
      256,
      1,
    ]);
    expect([down.width, down.height]).toEqual([1, 16]);
    expect([...layout(track), track.primaryAxisAlignItems, track.counterAxisAlignItems]).toEqual([
      "HORIZONTAL",
      "FIXED",
      "FIXED",
      "FIXED",
      "FIXED",
      true,
      "MIN",
      "CENTER",
    ]);
    for (const box of [thumb, dot]) {
      expect(layout(box)).toEqual(["HORIZONTAL", "FIXED", "FIXED", "FIXED", "FIXED", false]);
    }
    expect(await changes(file)).toEqual([]);
  });
});

// Unit under test: `reconcileKit` on Avatar's image fills. Oracle: the hash a real file gave the
// portrait, `1e57f3da…`, the SHA-1 of its bytes (P9b), the fake's rule 22, which logs storing an
// image as a write, and the change lines `test/kit-inventory.ts` gives the Avatar page.
describe("Avatar's image fills on an applied file", () => {
  const PORTRAIT_SHA1 = "1e57f3da2ad606fcd410ba17f62d2fc032aa669c";
  const AVATAR_PAGE = pageKey(inventoryPage("avatar"));

  it("stores no image when Plan finds the Avatar set missing, and Apply stores each image cell's", async () => {
    const file = await appliedFile();
    setOn(await kitPage(file, AVATAR_PAGE), "Avatar").remove();
    file.reopen();
    const before = file.writes.length;
    expect(await changes(file)).toContain("Avatar: create the component set Avatar with 8 variants");
    expect(file.writes.slice(before)).toEqual([]);

    await reconcileKit(file.figma, kit, true);
    expect(file.writes.slice(before).filter((line) => line.startsWith("store the image"))).toEqual(
      Array.from({ length: 4 }, () => `store the image ${PORTRAIT_SHA1}`)
    );
    file.reopen();
    expect(await changes(file)).toEqual([]);
  });

  it("lists the one fill change and stores nothing when Plan finds an Avatar holding other bytes", async () => {
    const file = await appliedFile();
    const avatar = setOn(await kitPage(file, AVATAR_PAGE), "Avatar");
    const image = childNamed(variantNamed(avatar, "content=image, size=32"), "FRAME", "avatar-image");
    file.figma.createImage(file.figma.base64Decode(RED_PIXEL.bytes));
    image.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: RED_PIXEL.sha1 }];
    file.reopen();
    const before = file.writes.length;

    expect(await changes(file)).toEqual([
      `Avatar / content=image, size=32 / avatar-image: fill → image ${PORTRAIT_SHA1.slice(0, 8)} at FILL (holds image ${RED_PIXEL.sha1.slice(0, 8)} at FILL)`,
      "Avatar: lay out 8 variants in 4 columns and 2 rows",
      "Avatar: place Avatar in a row and stack 4 previews below them",
    ]);
    expect(file.writes.slice(before)).toEqual([]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await changes(file)).toEqual([]);
  });
});

describe("a file whose label font the machine cannot load", () => {
  it("fails Plan, and stops Apply before any write", async () => {
    const file = syncedFile(collections, [{ family: "Roboto", style: "Medium" }]);
    const message = "The kit needs the font Roboto Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });
});
