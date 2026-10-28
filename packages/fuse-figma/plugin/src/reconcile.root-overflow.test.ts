/**
 * `reconcileKit` on the in-memory file in `fake-figma.ts`, with a Button kit whose variant root stops
 * clipping in a later kit, as Radio row's root does once its definition leaves its ring unclipped.
 * Oracle: `box.ts` plans a root's `clipsContent` as one scalar field of the node it found, so the
 * next Plan lists that one change on the existing variant, beside the set's and the page's layout
 * passes, Apply writes it in place on the same node, and the Plan after lists nothing.
 */
import { describe, expect, it } from "vitest";

import { buttonSet, fixture, kitWithRoot } from "./button-kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

const CLIPPING = kitWithRoot((root) => ({ ...root, clips: true }));
const UNCLIPPED = kitWithRoot((root) => ({ ...root, clips: false }));

describe("a variant root that stops clipping", () => {
  it("changes clipsContent in place on the existing variant, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, CLIPPING, true);
    file.reopen();
    const [before] = (await buttonSet(file)).children;
    const { changes } = await reconcileKit(file.figma, UNCLIPPED, false);
    // The set and the page lay out again after a variant changes; nothing is created.
    expect(changes.filter((line) => line.startsWith("Button / "))).toEqual([
      "Button / size=md: clipsContent → false",
    ]);
    expect(changes.filter((line) => line.includes("create"))).toEqual([]);
    await reconcileKit(file.figma, UNCLIPPED, true);
    file.reopen();
    const [after] = (await buttonSet(file)).children;
    expect([after?.id, after?.type === "COMPONENT" && after.clipsContent]).toEqual([before?.id, false]);
    expect(await reconcileKit(file.figma, UNCLIPPED, false)).toEqual({ changes: [], warnings: [] });
  });
});
