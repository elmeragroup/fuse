/**
 * The fake-file round trip of the kit the capture builds. Unit under test: the plugin's Apply and
 * Plan over that kit. Oracle: Apply writes the whole kit, so a Plan of the same kit on the file it
 * wrote lists nothing; a line it lists is a field Apply does not write or Plan reads back otherwise.
 */
import { describe, expect, it } from "@effect/vitest";

import { createFakeFigma } from "./fake-figma.ts";
import { kitFixture } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

describe("Plan of the capture build over the file its Apply wrote", () => {
  it("lists nothing", async () => {
    const { kit, collections } = await kitFixture();
    const file = createFakeFigma({ collections, unavailableFonts: [] });
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});
