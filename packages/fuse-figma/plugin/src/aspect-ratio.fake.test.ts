/**
 * Aspect ratio on a file the plugin applied the whole kit to, on the in-memory file in
 * `fake-figma.ts`. Unit under test: the aspect lock `planBox` writes through Apply and Plan. Oracles,
 * written by hand: each docs demo's width times its ratio (CSS Sizing 4 §4.2), so 16:9 at 448px is
 * 252px tall and 9:16 at 176px is 312.888…px; probe PG18, where a lock read back as the width and
 * height it was taken at, and a 9:16 height as the 32-bit float 312.8888854980469; and the kit spec,
 * where only Aspect ratio's variants carry a lock.
 */
import { describe, expect, it } from "vitest";

import type { FakeFigma } from "./fake-figma.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** Each variant's lock, in the docs page's order, as PG18 reads a lock back. */
const LOCKS = [
  ["ratio=16:9", { x: 448, y: 252 }],
  ["ratio=1:1", { x: 240, y: 240 }],
  ["ratio=4:3", { x: 384, y: 288 }],
  ["ratio=3:4", { x: 240, y: 320 }],
  ["ratio=3:2", { x: 384, y: 256 }],
  ["ratio=2:3", { x: 208, y: 312 }],
  ["ratio=9:16", { x: 176, y: 312.8888854980469 }],
];

/** The line a Plan lists for a set it changes, which it lays out on its page again. */
function relayout(set: string): string {
  return `${set}: place ${set}, with their labels and the page's title and example, in sections, and 4 previews side by side`;
}

/** The previews on the Aspect ratio page, each an instance of a variant. */
const PREVIEWS = [
  "Fjordkraft neutral private, light",
  "Fjordkraft neutral private, dark",
  "Fjordkraft branded private, light",
  "Fjordkraft branded private, dark",
];

/** The variant named `name` in the set `setName` on the page `page` of a freshly applied file. */
async function variant(page: string, setName: string, name: string) {
  const file = await appliedFile();
  const set = setOn(await kitPage(file, page), setName);
  const found = set.children.find((child) => child.name === name);
  if (found?.type !== "COMPONENT") {
    throw new Error(`the ${setName} set holds no variant ${name}`);
  }
  return { file, set, main: found };
}

/** The changes a Plan, or an Apply where `apply` is true, of the kit lists on `file`. */
async function reconcile(file: FakeFigma, apply = false) {
  const { kit } = await kitFixture();
  file.reopen();
  return (await reconcileKit(file.figma, kit, apply)).changes;
}

describe("Aspect ratio on an applied file", () => {
  it("locks each variant at its CSS ratio, and the next Plan lists nothing", async () => {
    const { file, set } = await variant("page/aspect-ratio", "Aspect ratio", "ratio=16:9");
    expect(
      set.children.map((child) => [
        child.name,
        "targetAspectRatio" in child ? child.targetAspectRatio : "none",
      ])
    ).toEqual(LOCKS);
    expect(await reconcile(file)).toEqual([]);
  });

  it("lists a variant with no lock, and Apply locks it", async () => {
    const { file, main } = await variant("page/aspect-ratio", "Aspect ratio", "ratio=1:1");
    main.unlockAspectRatio();
    expect(await reconcile(file)).toEqual([
      "Aspect ratio / ratio=1:1: aspect lock → 240 by 240 (holds none)",
      relayout("Aspect ratio"),
    ]);
    await reconcile(file, true);
    expect([main.targetAspectRatio, await reconcile(file)]).toEqual([{ x: 240, y: 240 }, []]);
  });

  it("locks a variant locked at another ratio again once its height is back", async () => {
    const { file, main } = await variant("page/aspect-ratio", "Aspect ratio", "ratio=9:16");
    // The resize moves the lock to 176 by 100, and each preview instance of the variant follows it.
    main.resize(176, 100);
    expect(await reconcile(file)).toEqual([
      "Aspect ratio / ratio=9:16: height → 312.89",
      "Aspect ratio / ratio=9:16: aspect lock → 176 by 312.88888888888886 (holds 176 by 100)",
      ...PREVIEWS.map(
        (preview) => `Aspect ratio / ${preview} / Aspect ratio / aspect-ratio/ratio=9:16: height → 312.89`
      ),
      relayout("Aspect ratio"),
    ]);
    await reconcile(file, true);
    expect([main.height, main.targetAspectRatio, await reconcile(file)]).toEqual([
      312.8888854980469,
      { x: 176, y: 312.8888854980469 },
      [],
    ]);
  });

  it("lists a lock on a box the spec does not lock, and Apply unlocks it", async () => {
    const { file, main } = await variant("page/card", "Card", "size=default");
    main.lockAspectRatio();
    const held = `${String(main.width)} by ${String(main.height)}`;
    expect(await reconcile(file)).toEqual([
      `Card / size=default: aspect lock → none (holds ${held})`,
      relayout("Card"),
    ]);
    await reconcile(file, true);
    expect([main.targetAspectRatio, await reconcile(file)]).toEqual([null, []]);
  });
});
