/**
 * The alignment List detail's rows give their Button instances, on the in-memory file in
 * `fake-figma.ts`. Unit under test: the override stage of `instance-layers.ts`, through `reconcileKit`
 * on a synced file. Oracle: the kit spec, under which each row's Button fills the row at MIN where
 * the Button set draws CENTER, as the docs demo's `justify-start` sets its label at the start; and
 * probe LD1 of 2026-11-19, where a real file listed `primaryAxisAlignItems` in such an instance's
 * `overrides` and kept MIN, so a Plan after an Apply finds nothing to write. A kit that no longer
 * overrides a row's alignment draws that Button at its main's alignment, the Button set's CENTER.
 */
import { describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { kitFixture } from "./kit-fixture.ts";
import { firstRow, onFirstRowButton } from "./list-detail-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** The changes a Plan, or an Apply where `apply` is true, of `kit`, the built kit by default, lists on `file`. */
async function reconcile(file: FakeFigma, apply = false, kit?: KitSpec) {
  const spec = kit ?? (await kitFixture()).kit;
  file.reopen();
  return (await reconcileKit(file.figma, spec, apply)).changes;
}

/** The kit with `List detail`'s `content=empty` first row's Button no longer overriding its alignment. */
function firstRowAtMain(kit: KitSpec): KitSpec {
  return onFirstRowButton(kit, (button) => ({
    ...button,
    overrides: (button.overrides ?? []).filter(({ field }) => field !== "primaryAlign"),
  }));
}

/** The alignment along its direction of the variant the `content=empty` first row's Button points at. */
function mainAlignment(kit: KitSpec) {
  const variant = kit.componentSets
    .find(({ name }) => name === "List detail")
    ?.variants.find(({ properties }) => properties.content === "empty");
  const list = variant?.root.children.find(({ key }) => key === "list");
  const row = list?.kind === "frame" ? list.children.find(({ key }) => key === "row-1") : undefined;
  const button = row?.kind === "frame" ? row.children.find(({ key }) => key === "button") : undefined;
  return button?.kind !== "instance"
    ? undefined
    : kit.componentSets
        .find(({ key }) => key === button.componentSet)
        ?.variants.find(({ key }) => key === button.variant)?.root.primaryAlign;
}

describe("List detail's row Buttons on an applied file", () => {
  it("align their labels at the start as an override, and the next Plan lists nothing", async () => {
    const { file, button } = await firstRow();
    const own = button.overrides.find(({ id }) => id === button.id);
    expect([button.primaryAxisAlignItems, own?.overriddenFields.includes("primaryAxisAlignItems")]).toEqual([
      "MIN",
      true,
    ]);
    expect(await reconcile(file)).toEqual([]);
  });

  it("lists a row whose alignment a designer centred, and Apply aligns it at the start again", async () => {
    const { file, button } = await firstRow();
    button.primaryAxisAlignItems = "CENTER";
    expect(await reconcile(file)).toEqual([
      "List detail / content=empty / list-detail-list / row-1 / button: primaryAxisAlignItems → MIN",
      // A Plan that changes a set lays its page out again.
      "List detail: place List detail pane, List detail, List detail sheet and List detail (open), with their labels and the page's title and example, in sections, and 4 previews side by side",
    ]);
    await reconcile(file, true);
    expect([button.primaryAxisAlignItems, await reconcile(file)]).toEqual(["MIN", []]);
  });

  it("set a row back to its main's alignment where the kit drops its override", async () => {
    const { kit } = await kitFixture();
    const atMain = firstRowAtMain(kit);
    const centre = mainAlignment(atMain);
    expect(centre).toBe("CENTER");
    const { file, button } = await firstRow();
    expect(await reconcile(file, false, atMain)).toEqual([
      "List detail / content=empty / list-detail-list / row-1 / button: primaryAxisAlignItems → CENTER",
      "List detail: place List detail pane, List detail, List detail sheet and List detail (open), with their labels and the page's title and example, in sections, and 4 previews side by side",
    ]);
    await reconcile(file, true, atMain);
    expect([button.primaryAxisAlignItems, await reconcile(file, false, atMain)]).toEqual([centre, []]);
  });
});
