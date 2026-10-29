/**
 * `reconcileKit` on a file the kit was applied to, as a designer's edits or an earlier run left it:
 * texts, previews and variants. Each test changes its own fork of the applied file, then expects one Apply to repair it
 * and the next Plan to list nothing. `reconcile.fake.test.ts` names the oracles.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { childNamed } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";
import { appliedFile, componentSet, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import {
  DEFAULT_BUTTON,
  LAY_OUT_BUTTONS,
  PLACE,
  AFTER_BUTTON,
  PLACE_AFTER_BUTTON,
  changes,
  applies,
  variantNamed,
  textsIn,
} from "./reconcile-fake-support.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;

beforeAll(async () => {
  ({ kit } = await kitFixture());
}, 60_000);

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

    expect(await applies(file)).toContainEqual(
      expect.stringContaining(`${name}: width → 1 for the fill to take over, layoutSizingHorizontal → FILL`)
    );
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

    expect(await applies(file)).toEqual([
      `Button / ${DEFAULT_BUTTON}: name → ${DEFAULT_BUTTON}`,
      `Button / ${DEFAULT_BUTTON} / label: name → label`,
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
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

    expect(await applies(file)).toEqual([
      `Button: create the variant ${name}`,
      "Button: reorder the variants",
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    expect(await changes(file)).toEqual([]);
    // Variant 1 of 7, size 1 of 4, state 1 of 5 and icon 2 of 3, counted from 0, with the icon
    // varying fastest: ((1 × 4 + 1) × 5 + 1) × 3 + 2.
    expect(button.children[80]?.name).toBe(name);
  });
});
