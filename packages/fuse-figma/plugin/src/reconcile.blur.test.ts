/**
 * `reconcileKit` with a Button kit whose variant root blurs what lies behind it, as an overlay scrim
 * does, on the in-memory file in `fake-figma.ts`. Oracle: the plugin typings' `BlurEffect`, a
 * `BACKGROUND_BLUR` with `blurType` NORMAL, a `radius` and `visible`, written after the node's drop
 * shadows, and the spec's radius, which Plan compares, so a second Plan lists nothing.
 */
import { describe, expect, it } from "vitest";

import { buttonSet, fixture, kitWithRoot, literal } from "./button-kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

const BLURRED = kitWithRoot((root) => ({ ...root, backgroundBlur: literal(8) }));

describe("a variant root that blurs what lies behind it", () => {
  it("writes a background blur after its shadows in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, BLURRED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, BLURRED, false)).toEqual({ changes: [], warnings: [] });
    const [variant] = (await buttonSet(file)).children;
    expect(variant?.type === "COMPONENT" ? variant.effects.map((effect) => effect.type) : []).toEqual([
      "BACKGROUND_BLUR",
    ]);
    const [blur] = variant?.type === "COMPONENT" ? variant.effects : [];
    expect(blur?.type === "BACKGROUND_BLUR" ? [blur.blurType, blur.radius, blur.visible] : []).toEqual([
      "NORMAL",
      8,
      true,
    ]);
  });

  it("plans a blur a designer changed back to the spec's radius", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, BLURRED, true);
    file.reopen();
    const [variant] = (await buttonSet(file)).children;
    if (variant?.type !== "COMPONENT") {
      throw new Error("the Button set holds no variant");
    }
    variant.effects = [{ type: "BACKGROUND_BLUR", blurType: "NORMAL", radius: 4, visible: true }];
    expect((await reconcileKit(file.figma, BLURRED, false)).changes).toContain(
      "Button / size=md: shadows → none, background blur 8 (holds background blur 4)"
    );
  });
});
