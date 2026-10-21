/**
 * `reconcileKit` end to end against the in-memory file in `fake-figma.ts`, with the kit
 * `buildKit()` writes from the Button, Toggle and Badge recipes and the variables `fuseVariableSet()` syncs. The
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
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";
import { exportSnapshots } from "./snapshots.ts";

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

const BUTTON_PAGE = "page/button";
const TOGGLE_PAGE = "page/toggle";
const BADGE_PAGE = "page/badge";
const ICONS_PAGE = "page/icons";
const DEFAULT_BUTTON = "variant=default, size=default, state=rest, icon=none";
const LAY_OUT_BUTTONS = "Button: lay out 420 variants in 5 columns and 84 rows";
const PLACE = "Button: place Button and Icon button in a row and stack 4 previews below them";
const PREVIEWS = [
  "Button / Fjordkraft internal private, light",
  "Button / Fjordkraft internal private, dark",
  "Button / Fjordkraft external private, light",
  "Button / Fjordkraft external private, dark",
];
const CREATE_PREVIEWS = PREVIEWS.map((name) => `Button: create the preview ${name}`);
const PLACE_TOGGLES = "Toggle: place Toggle and Icon toggle in a row and stack 4 previews below them";
const TOGGLE_PREVIEWS = PREVIEWS.map((name) => name.replace("Button", "Toggle"));
const CREATE_TOGGLE_PREVIEWS = TOGGLE_PREVIEWS.map((name) => `Toggle: create the preview ${name}`);
const PLACE_BADGES = "Badge: place Badge in a row and stack 4 previews below them";
const BADGE_PREVIEWS = PREVIEWS.map((name) => name.replace("Button", "Badge"));
const CREATE_BADGE_PREVIEWS = BADGE_PREVIEWS.map((name) => `Badge: create the preview ${name}`);

/** The page the plugin put the whole kit on before each component got a page of its own. */
const LEGACY_PAGE = { key: "page/components", name: "Fuse components" };

/** The gray `ring` holds in Fjordkraft's internal private light theme, the file's default modes. */
const RING_GRAY = 0.502;

/** A synced file without the kit pages. */
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

/**
 * The kit in the layout the plugin wrote before each component got a page: the sets, the icons
 * and the previews on the legacy page, with each preview keyed by its theme and density.
 */
function singlePageKit(): KitSpec {
  const page = LEGACY_PAGE.key;
  return {
    ...kit,
    pages: [LEGACY_PAGE],
    icons: { ...kit.icons, page },
    componentSets: kit.componentSets.map((set) => ({ ...set, page })),
    previews: kit.previews.map((preview) => {
      const key = `${preview.key}/dense`;
      const groups = preview.groups.map((group) => ({ ...group, key: `${key}/${group.componentSet}` }));
      return { ...preview, key, page, groups };
    }),
  };
}

/** A synced file the plugin applied the single-page kit to, opened again for the next run. */
async function singlePageFile(): Promise<FakeFigma> {
  const file = syncedFile();
  await reconcileKit(file.figma, singlePageKit(), true);
  file.reopen();
  return file;
}

async function changes(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, kit, false)).changes;
}

/** The page that carries a kit page key, loaded for reading. */
async function kitPage(file: FakeFigma, key = BUTTON_PAGE): Promise<PageNode> {
  const page = file.figma.root.children.find((candidate) => keyOf(candidate) === key);
  if (page === undefined) {
    throw new Error(`the file has no page with the key ${key}`);
  }
  await page.loadAsync();
  return page;
}

async function iconLibrary(file: FakeFigma): Promise<FrameNode> {
  return childNamed(await kitPage(file, ICONS_PAGE), "FRAME", "Icons");
}

/** Each child's id, by its name. */
function idsByName(parent: ChildrenMixin): ReadonlyMap<string, string> {
  return new Map(parent.children.map((node) => [node.name, node.id]));
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

function setOn(page: PageNode, name: string): ComponentSetNode {
  const set = page.children.find(
    (node): node is ComponentSetNode => node.type === "COMPONENT_SET" && node.name === name
  );
  if (set === undefined) {
    throw new Error(`${page.name} has no component set ${name}`);
  }
  return set;
}

async function componentSet(file: FakeFigma, name: string): Promise<ComponentSetNode> {
  return setOn(await kitPage(file), name);
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

describe("Apply on a synced file without the kit pages", () => {
  let file: FakeFigma;
  let applied: Awaited<ReturnType<typeof reconcileKit>>;

  beforeAll(async () => {
    file = syncedFile();
    applied = await reconcileKit(file.figma, kit, true);
    file.reopen();
  }, 60_000);

  it("creates each page and each node on it once, and a second Plan lists nothing", async () => {
    expect(applied).toEqual({
      changes: [
        "Document: create the page Button",
        "Document: create the page Toggle",
        "Document: create the page Badge",
        "Document: create the page Icons",
        "Icons: create the Icons frame with 135 icons",
        "Button: create the component set Button with 420 variants",
        "Button: create the component set Icon button with 140 variants",
        "Toggle: create the component set Toggle with 192 variants",
        "Toggle: create the component set Icon toggle with 64 variants",
        "Badge: create the component set Badge with 57 variants",
        ...CREATE_PREVIEWS,
        PLACE,
        ...CREATE_TOGGLE_PREVIEWS,
        PLACE_TOGGLES,
        ...CREATE_BADGE_PREVIEWS,
        PLACE_BADGES,
      ],
      warnings: [],
    });
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });

  it("shows the Button page and leaves nothing behind on the page that was current", async () => {
    const [first, button, toggle, badge, icons] = file.figma.root.children;
    expect(first?.name).toBe("Page 1");
    await first?.loadAsync();
    expect(first?.children).toEqual([]);
    expect([button?.name, toggle?.name, badge?.name, icons?.name]).toEqual([
      "Button",
      "Toggle",
      "Badge",
      "Icons",
    ]);
    expect(file.figma.currentPage).toBe(button);
    expect((await kitPage(file)).children.map((node) => node.name)).toEqual([
      "Button",
      "Icon button",
      ...PREVIEWS,
    ]);
    expect((await kitPage(file, TOGGLE_PAGE)).children.map((node) => node.name)).toEqual([
      "Toggle",
      "Icon toggle",
      ...TOGGLE_PREVIEWS,
    ]);
    expect((await kitPage(file, BADGE_PAGE)).children.map((node) => node.name)).toEqual([
      "Badge",
      ...BADGE_PREVIEWS,
    ]);
    expect((await kitPage(file, ICONS_PAGE)).children.map((node) => node.name)).toEqual(["Icons"]);
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
      // Button: 7 variants in 5 states, 7 at each of 3 other sizes, and 7 with each of 2 icons.
      // Icon button: 7 variants in 5 states, and 7 at each of 3 other sizes.
      expect(groups.map((group) => [group.name, group.children.length])).toEqual([
        ["Button", 70],
        ["Icon button", 56],
      ]);
      // A group has no padding, so it must not clip a focus ring at its edge.
      expect(groups.map((group) => group.clipsContent)).toEqual([false, false]);
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

  it("exports every instance of the four previews, with the snapshot's fields", async () => {
    let progress: readonly [number, number] | undefined;
    const snapshot = await exportSnapshots(
      file.figma,
      kit.pages.map((page) => page.key),
      (done, total) => {
        progress = [done, total];
      }
    );
    expect(new Set(Object.keys(snapshot))).toEqual(
      new Set(["format", "version", "exportedAt", "file", "scale", "previews"])
    );
    // The format `figma:compare` reads, at version 1, with every PNG at 2x.
    expect([snapshot.format, snapshot.version, snapshot.scale]).toEqual(["fuse-kit-snapshots", 1, 2]);
    expect(snapshot.previews.map((preview) => [preview.key, preview.name, preview.instances.length])).toEqual(
      [
        ["preview/button/internal-fkas-private-light", PREVIEWS[0], 126],
        ["preview/button/internal-fkas-private-dark", PREVIEWS[1], 126],
        ["preview/button/external-fkas-private-light", PREVIEWS[2], 126],
        ["preview/button/external-fkas-private-dark", PREVIEWS[3], 126],
        // Toggle: 2 variants in 4 states off and on, 2 at each of 3 other sizes, and 2 with
        // each of 2 icons. Icon toggle: the same without the icons.
        ["preview/toggle/internal-fkas-private-light", TOGGLE_PREVIEWS[0], 48],
        ["preview/toggle/internal-fkas-private-dark", TOGGLE_PREVIEWS[1], 48],
        ["preview/toggle/external-fkas-private-light", TOGGLE_PREVIEWS[2], 48],
        ["preview/toggle/external-fkas-private-dark", TOGGLE_PREVIEWS[3], 48],
        // Badge: 19 variants at 3 sizes.
        ["preview/badge/internal-fkas-private-light", BADGE_PREVIEWS[0], 57],
        ["preview/badge/internal-fkas-private-dark", BADGE_PREVIEWS[1], 57],
        ["preview/badge/external-fkas-private-light", BADGE_PREVIEWS[2], 57],
        ["preview/badge/external-fkas-private-dark", BADGE_PREVIEWS[3], 57],
      ]
    );
    expect(progress).toEqual([924, 924]);
    const [first] = snapshot.previews;
    expect(new Set(Object.keys(first ?? {}))).toEqual(new Set(["key", "name", "modes", "instances"]));
    expect(first?.modes).toEqual(
      expect.arrayContaining([
        { collection: "Fuse tokens", mode: "Light" },
        { collection: "Fuse density", mode: "Auto" },
      ])
    );
    const [instance] = first?.instances ?? [];
    expect(new Set(Object.keys(instance ?? {}))).toEqual(new Set(["key", "variant", "box", "image"]));
    expect(instance?.key).toBe(
      "preview/button/internal-fkas-private-light/button/variant=default,size=default,state=rest,icon=none"
    );
    expect(instance?.variant).toBe("button/variant=default,size=default,state=rest,icon=none");
    expect(new Set(Object.keys(instance?.box ?? {}))).toEqual(new Set(["x", "y", "width", "height"]));
    expect(new Set(Object.keys(instance?.image ?? {}))).toEqual(new Set(["renderBounds", "png"]));
    // The fake draws no effects, so the render bounds are the box.
    expect(instance?.image?.renderBounds).toEqual(instance?.box);
    expect(instance?.image?.png).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(first?.instances[70]?.variant).toBe("icon-button/variant=default,size=icon,state=rest");
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
      PLACE,
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
    expect(planned).toEqual([]);
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
    const message = "The kit needs the font Roboto Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });
});

describe("a file the plugin laid out on one page", () => {
  it("moves the sets and the icons onto their pages with their ids, then deletes the old page", async () => {
    const file = await singlePageFile();
    const legacy = await kitPage(file, LEGACY_PAGE.key);
    const before = idsByName(legacy);
    const variantsBefore = [setOn(legacy, "Button"), setOn(legacy, "Icon button")].map(idsByName);
    const pagePhase = [
      "Document: create the page Button",
      "Document: create the page Toggle",
      "Document: create the page Badge",
      "Document: create the page Icons",
      ...[...PREVIEWS, ...TOGGLE_PREVIEWS, ...BADGE_PREVIEWS].map(
        (name) => `Fuse components: delete ${name}`
      ),
      "Fuse components: move Icons to the Icons page",
      "Fuse components: move Button to the Button page",
      "Fuse components: move Icon button to the Button page",
      "Fuse components: move Toggle to the Toggle page",
      "Fuse components: move Icon toggle to the Toggle page",
      "Fuse components: move Badge to the Badge page",
    ];

    expect(await reconcileKit(file.figma, kit, false)).toEqual({
      changes: [...pagePhase, "Document: plan the rest of the kit again once the 6 moves land"],
      warnings: [],
    });
    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied).toEqual({
      changes: [
        ...pagePhase,
        ...CREATE_PREVIEWS,
        PLACE,
        ...CREATE_TOGGLE_PREVIEWS,
        PLACE_TOGGLES,
        ...CREATE_BADGE_PREVIEWS,
        PLACE_BADGES,
        "Document: delete the page Fuse components",
      ],
      warnings: [],
    });
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });

    expect(legacy.removed).toBe(true);
    expect(file.figma.root.children.map((page) => page.name)).toEqual([
      "Page 1",
      "Button",
      "Toggle",
      "Badge",
      "Icons",
    ]);
    const button = await componentSet(file, "Button");
    const iconButton = await componentSet(file, "Icon button");
    expect([button.id, iconButton.id, (await iconLibrary(file)).id]).toEqual([
      before.get("Button"),
      before.get("Icon button"),
      before.get("Icons"),
    ]);
    expect([button, iconButton].map(idsByName)).toEqual(variantsBefore);
  });

  it("keeps the old page and warns while it holds a layer the kit does not own", async () => {
    const file = await singlePageFile();
    const legacy = await kitPage(file, LEGACY_PAGE.key);
    const notes = file.figma.createFrame();
    legacy.appendChild(notes);
    notes.name = "Notes";
    const warning =
      "Fuse components: the kit no longer uses this page, and keeps it for Notes, which the kit does not own";

    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied.warnings).toEqual([warning]);
    expect(applied.changes).not.toContain("Document: delete the page Fuse components");
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [warning] });
    await legacy.loadAsync();
    expect(legacy.children).toEqual([notes]);
  });

  it("leaves pages named Button and Icons that it does not own alone, and creates its own", async () => {
    const file = syncedFile();
    const imported = ["Button", "Icons"].map((name) => {
      const page = file.figma.createPage();
      page.name = name;
      const frame = file.figma.createFrame();
      page.appendChild(frame);
      frame.name = name;
      return { page, frame };
    });
    file.reopen();

    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied.changes.slice(0, 4)).toEqual([
      "Document: create the page Button",
      "Document: create the page Toggle",
      "Document: create the page Badge",
      "Document: create the page Icons",
    ]);
    expect(file.figma.root.children.map((page) => page.name)).toEqual([
      "Page 1",
      "Button",
      "Icons",
      "Button",
      "Toggle",
      "Badge",
      "Icons",
    ]);
    for (const { page, frame } of imported) {
      await page.loadAsync();
      expect(page.children).toEqual([frame]);
      expect([keyOf(page), keyOf(frame)]).toEqual(["", ""]);
    }
  });
});
