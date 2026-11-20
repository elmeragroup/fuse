/**
 * The stroke weights an instance overrides on its inner variant's root, on the in-memory file in
 * `fake-figma.ts`. Unit under test: `instance-overrides.ts`, through `reconcileKit` on a synced file.
 * Oracle: the kit spec, here List detail's first row Button with a `strokeSides` override added, as a
 * chip segment's `border-0 border-s` keeps only its start edge of Button's 1px border, and what a real
 * file's `overrides` listed on 2026-11-20: each side a write changed, kept listed after the main's
 * weight was written back (SW). No real file has run the plugin's write yet: the owner's Apply is its
 * check.
 */
import { describe, expect, it } from "vitest";

import type { InstanceOverride, KitSpec } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { kitFixture } from "./kit-fixture.ts";
import { firstRow, onFirstRowButton } from "./list-detail-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** The changes a Plan, or an Apply where `apply` is true, of `kit` lists on `file`. */
async function reconcile(file: FakeFigma, kit: KitSpec, apply = false) {
  const report = await reconcileKit(file.figma, kit, apply);
  file.reopen();
  return report.changes;
}

/** The first row's Button of `List detail`'s `content=empty` variant, with `added` among its overrides. */
function withOverride(kit: KitSpec, added: InstanceOverride): KitSpec {
  return onFirstRowButton(kit, (button) => ({ ...button, overrides: [...(button.overrides ?? []), added] }));
}

/** `kit` with every Button variant's stroke of one weight dashed by `dashPattern`. */
function withDashedButton(kit: KitSpec, dashPattern: readonly number[]): KitSpec {
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) =>
      set.name !== "Button"
        ? set
        : {
            ...set,
            variants: set.variants.map((variant) => {
              const { stroke } = variant.root;
              return stroke === undefined || "sides" in stroke
                ? variant
                : { ...variant, root: { ...variant.root, stroke: { ...stroke, dashPattern } } };
            }),
          }
    ),
  };
}

const START = { top: 0, right: 0, bottom: 0, left: 1 };

describe("an instance's stroke weights on an applied file", () => {
  it("override the main's on the instance, and the next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const sided = withOverride(kit, { path: [], field: "strokeSides", sides: START });
    const { file, button } = await firstRow();
    expect(await reconcile(file, sided)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button: stroke weights → 0 0 0 1"
    );
    await reconcile(file, sided, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, sided),
    ]).toEqual([[0, 0, 0, 1], []]);
  });

  it("go back to the main's where the kit drops the override", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "strokeSides", sides: START }), true);
    expect(await reconcile(file, kit)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button: strokeWeight → 1"
    );
    await reconcile(file, kit, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, kit),
    ]).toEqual([[1, 1, 1, 1], []]);
  });

  it("go back to the main's one weight where the kit drops the override as the main turns dashed", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "strokeSides", sides: START }), true);
    const dashed = withDashedButton(kit, [2, 2]);
    await reconcile(file, dashed, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, dashed),
    ]).toEqual([[1, 1, 1, 1], []]);
  });
});
