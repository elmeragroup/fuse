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
import { ICONS_PAGE, inventoryPage, KIT_PAGES, pageKey } from "../../test/kit-inventory.ts";
import { drawsShadowSpread, paintsAbove } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import {
  appliedKit,
  componentSet,
  CREATE_AND_PLACE_PREVIEWS,
  CREATE_PAGES,
  iconLibrary,
  kitFixture,
  kitPage,
  previewNames,
  setOn,
} from "./kit-fixture.ts";
import {
  DEFAULT_BUTTON,
  CREATE_SETS,
  RING_GRAY,
  pinnedModes,
  variantNamed,
  onlyShadow,
  onlySolid,
  textsIn,
  property,
  arrowPlace,
} from "./reconcile-fake-support.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;

beforeAll(async () => {
  ({ kit } = await kitFixture());
}, 60_000);

describe("Apply on a synced file without the kit pages", () => {
  let file: FakeFigma;
  let applied: Awaited<ReturnType<typeof reconcileKit>>;

  beforeAll(async () => {
    ({ file, applied } = await appliedKit());
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

  // PK: the swapped icon reads its new icon's key, so the override finds it by the Icon button's layer.
  it.each([
    ["caret", "CaretDown"],
    ["caret open", "CaretUp"],
    ["clear", "X"],
  ])("colors the %s Input group's swapped %s glyph in muted-foreground", async (form, icon) => {
    const set = setOn(await kitPage(file, "page/input"), "Input group");
    const variant = variantNamed(set, `form=${form}, state=rest`);
    const button = childNamed(childNamed(variant, "FRAME", "input-group-addon"), "INSTANCE", "button");
    const swapped = childNamed(button, "INSTANCE", "Icon");
    expect([
      (await swapped.getMainComponentAsync())?.name,
      onlySolid(childNamed(swapped, "VECTOR", "glyph").fills, file.figma).boundVariables?.color?.id,
    ]).toEqual([icon, file.variable("Fuse tokens", "muted-foreground").id]);
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

  // Oracle: probe W5-P7 in Figma. A stepper centred both ways with no padding and a 1px left stroke
  // that counts in layout centres its 16px glyph in the 23px or 31px content box, at x 4.5 dense and
  // 8.5 comfortable, as CSS's border box does; the fake places no layer in a flow, so the test pins
  // the fields that placement follows from.
  it("writes the stepper centred, unpadded, with a left stroke alone that counts in layout (W5-P7)", async () => {
    const page = await kitPage(file, pageKey(inventoryPage("number-field")));
    const stepper = setOn(page, "Number field stepper").children[0];
    expect(
      stepper?.type === "COMPONENT"
        ? [
            stepper.primaryAxisAlignItems,
            stepper.counterAxisAlignItems,
            [stepper.paddingLeft, stepper.paddingRight],
            [
              stepper.strokeTopWeight,
              stepper.strokeRightWeight,
              stepper.strokeBottomWeight,
              stepper.strokeLeftWeight,
            ],
            stepper.strokesIncludedInLayout,
          ]
        : []
    ).toEqual(["CENTER", "CENTER", [0, 0], [0, 0, 0, 1], true]);
  });

  // Oracle: Chromium on 2026-10-27 centred Tooltip's turned arrow at (W/2, H - 2) in a W × H popup,
  // and Figma's transform at a turn r is [[cos r, sin r, x], [-sin r, cos r, y]] (PQ).
  it("turns the arrow -45 and centres it on the popup, 2px above its bottom edge (W5 U9)", async () => {
    const page = await kitPage(file, pageKey(inventoryPage("tooltip")));
    const main = setOn(page, "Tooltip content").children[0];
    expect(main?.type === "COMPONENT" ? arrowPlace(main) : undefined).toEqual({
      rotation: -45,
      constraints: { horizontal: "CENTER", vertical: "MAX" },
      positioning: "ABSOLUTE",
      fromCentre: 0,
      aboveBottom: 2,
    });
  });
});
