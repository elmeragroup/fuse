/**
 * `reconcileKit` end to end against the in-memory file in `fake-figma.ts`, with the kit
 * `buildKit()` writes from the Button recipe and the variables `fuseVariableSet()` syncs. The
 * fake models the Figma rules the real runs in 2026-10 confirmed, and throws for any Plugin API
 * member it does not model. The oracles are hand-written: the change lines Plan must list, the
 * values the Button recipe and the theme catalog give, and the order the kit's axes declare.
 */
import { Result } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { AliasCycle, CollectionSpec, InvalidVariableSet, VariableSet } from "../../src/variable-set.ts";
import { createFakeFigma, drawsShadowSpread } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * The spec builder and the token sync import Node and Fuse modules that the plugin's type check
 * cannot follow, so the test loads them by paths the check does not read.
 */
const SPEC_BUILDER = "../../src/components/build-kit.ts";
const TOKEN_SYNC = "../../src/fuse-variable-set.ts";

type SpecBuilder = { readonly buildKit: () => Promise<{ readonly spec: KitSpec }> };
type TokenSync = {
  readonly fuseVariableSet: () => Result.Result<VariableSet, InvalidVariableSet | AliasCycle>;
};

let kit: KitSpec;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  // SAFETY: the path names build-kit.ts, whose `buildKit` resolves to the kit and its coverage.
  const builder = (await import(SPEC_BUILDER)) as SpecBuilder;
  // SAFETY: the path names fuse-variable-set.ts, whose `fuseVariableSet` returns the set or why
  // it does not build.
  const sync = (await import(TOKEN_SYNC)) as TokenSync;
  const variableSet = sync.fuseVariableSet();
  if (Result.isFailure(variableSet)) {
    throw new Error(`the Fuse variable set does not build: ${String(variableSet.failure)}`);
  }
  collections = variableSet.success.collections;
  ({ spec: kit } = await builder.buildKit());
}, 60_000);

const PAGE = "Fuse components";
const DEFAULT_BUTTON = "variant=default, size=default, state=rest, icon=none";
const LAY_OUT_BUTTONS = "Button: lay out 420 variants in 5 columns and 84 rows";
const PLACE = `${PAGE}: place 2 component sets and the icons in a row and stack 12 previews below them`;

/** The gray `ring` holds in Fjordkraft's internal private light theme, the file's default modes. */
const RING_GRAY = 0.502;

/** A synced file without the kit page. */
function syncedFile(unavailableFonts: readonly FontName[] = []): FakeFigma {
  return createFakeFigma({ collections, unavailableFonts });
}

/** A synced file the plugin applied the kit to, opened again for the next run. */
async function appliedFile(): Promise<FakeFigma> {
  const file = syncedFile();
  await reconcileKit(file.figma, kit, true);
  file.reopen();
  return file;
}

async function changes(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, kit, false)).changes;
}

async function kitPage(file: FakeFigma): Promise<PageNode> {
  const page = file.figma.root.children.find((candidate) => candidate.name === PAGE);
  if (page === undefined) {
    throw new Error(`the file has no page ${PAGE}`);
  }
  await page.loadAsync();
  return page;
}

async function componentSet(file: FakeFigma, name: string): Promise<ComponentSetNode> {
  const set = (await kitPage(file)).children.find(
    (node): node is ComponentSetNode => node.type === "COMPONENT_SET" && node.name === name
  );
  if (set === undefined) {
    throw new Error(`the kit page has no component set ${name}`);
  }
  return set;
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

function childNamed<Type extends SceneNode["type"]>(
  parent: ChildrenMixin,
  type: Type,
  name: string
): Extract<SceneNode, { readonly type: Type }> {
  const child = parent.children.find(
    (node): node is Extract<SceneNode, { readonly type: Type }> => node.type === type && node.name === name
  );
  if (child === undefined) {
    throw new Error(`no ${type} named ${name}`);
  }
  return child;
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

function property(set: ComponentSetNode, name: string): ComponentPropertyDefinitions[string] {
  const found = Object.entries(set.componentPropertyDefinitions).find(
    ([id]) => id === name || id.startsWith(`${name}#`)
  );
  if (found === undefined) {
    throw new Error(`${set.name} has no property ${name}`);
  }
  return found[1];
}

describe("Apply on a synced file without the kit page", () => {
  let file: FakeFigma;
  let applied: Awaited<ReturnType<typeof reconcileKit>>;

  beforeAll(async () => {
    file = syncedFile();
    applied = await reconcileKit(file.figma, kit, true);
    file.reopen();
  }, 60_000);

  it("creates the page as one change, and a second Plan lists nothing", async () => {
    expect(applied).toEqual({
      changes: [`Document: create the page ${PAGE} with Button, Icon button and 12 previews`],
      warnings: [],
    });
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });

  it("shows the kit page and leaves nothing behind on the page that was current", async () => {
    const [first, second] = file.figma.root.children;
    expect(first?.name).toBe("Page 1");
    await first?.loadAsync();
    expect(first?.children).toEqual([]);
    expect(second?.name).toBe(PAGE);
    expect(file.figma.currentPage).toBe(second);
    const page = await kitPage(file);
    expect(page.children.map((node) => node.name).slice(0, 3)).toEqual(["Icons", "Button", "Icon button"]);
    expect(page.children).toHaveLength(15);
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
    const icons = childNamed(await kitPage(file), "FRAME", "Icons");
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
    const icons = childNamed(await kitPage(file), "FRAME", "Icons");
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
      PLACE,
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
      PLACE,
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

    expect(await changes(file)).toEqual(["Button: reorder the variants", LAY_OUT_BUTTONS, PLACE]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect(button.children[0]?.name).toBe(DEFAULT_BUTTON);
    expect(property(button, "icon").variantOptions).toEqual(["none", "start", "end"]);
  });

  it("swaps an icon layer a designer swapped back to its icon, and colors the new glyph", async () => {
    const file = await appliedFile();
    const page = await kitPage(file);
    const variant = variantNamed(
      await componentSet(file, "Button"),
      "variant=default, size=default, state=rest, icon=start"
    );
    const icon = childNamed(variant, "INSTANCE", "Start icon");
    icon.swapComponent(childNamed(childNamed(page, "FRAME", "Icons"), "COMPONENT", "ArrowLeft"));

    const label = "Button / variant=default, size=default, state=rest, icon=start / Start icon";
    expect(await changes(file)).toEqual([
      `${label}: show Plus`,
      `${label}: glyph fill → primary-foreground`,
      LAY_OUT_BUTTONS,
      PLACE,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect((await icon.getMainComponentAsync())?.name).toBe("Plus");
  });

  it("rebuilds a deleted icon library and points every icon layer at the new icons", async () => {
    const file = await appliedFile();
    childNamed(await kitPage(file), "FRAME", "Icons").remove();

    const plan = await changes(file);
    expect(plan.slice(0, 3)).toEqual([
      `${PAGE}: create the Icons frame with 135 icons`,
      "Button: Start icon → Plus and the 135 library icons",
      "Button: End icon → ArrowRight and the 135 library icons",
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    const plus = childNamed(childNamed(await kitPage(file), "FRAME", "Icons"), "COMPONENT", "Plus");
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

  it("repairs a focus ring that keeps a stale black under its ring binding in one Apply", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    const focus = variantNamed(button, "variant=default, size=default, state=focus, icon=none");
    focus.effects = [{ ...onlyShadow(focus), color: { r: 0, g: 0, b: 0, a: 1 } }];
    expect(onlyShadow(focus).color).toEqual({ r: 0, g: 0, b: 0, a: 1 });

    expect(await changes(file)).toEqual([
      "Button / variant=default, size=default, state=focus, icon=none: shadows → ring 0 0 0 2 (holds variable, stored #000000 at 100%, 0 0 0 2)",
      LAY_OUT_BUTTONS,
      PLACE,
    ]);
    await reconcileKit(file.figma, kit, true);
    expect(await changes(file)).toEqual([]);
    expect(onlyShadow(focus).color.r).toBeCloseTo(RING_GRAY, 2);
  });
});

describe("a file whose label font the machine cannot load", () => {
  it("fails Plan, and stops Apply before any write", async () => {
    const file = syncedFile([{ family: "Roboto", style: "Medium" }]);
    const message = `${PAGE} needs the font Roboto Medium, which Figma cannot load.`;
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });
});
