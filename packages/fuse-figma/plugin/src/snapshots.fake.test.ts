/**
 * `exportSnapshots` over a file the plugin applied the whole kit to, on the in-memory file in
 * `fake-figma.ts`. The oracles are hand-written: the snapshot format `figma:compare` reads, the
 * previews and the instance count of each from the cells its sets place, in `test/kit-inventory.ts`,
 * and the modes each preview pins.
 */
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { inventoryPage, KIT_PAGES, pageKey, previewedOn, previewsOn } from "../../test/kit-inventory.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { appliedFile, kitFixture, kitPage } from "./kit-fixture.ts";
import { FigmaPlugin } from "./services.ts";
import { exportSnapshots } from "./snapshots.ts";
import type { SnapshotProgress } from "./snapshots.ts";

/** Export the snapshots of a file's pages, as the plugin does over the file it runs on. */
function exportFrom(file: FakeFigma, pageKeys: readonly string[], progress: SnapshotProgress) {
  return Effect.runPromise(
    Effect.provideService(exportSnapshots(pageKeys, progress), FigmaPlugin, file.figma)
  );
}

const BADGE = inventoryPage("badge");
const KBD = inventoryPage("kbd");

describe("Export snapshots from an applied file", () => {
  let kit: KitSpec;
  let file: FakeFigma;

  beforeAll(async () => {
    ({ kit } = await kitFixture());
    file = await appliedFile();
  }, 60_000);

  it("exports every instance of the four previews, with the snapshot's fields", async () => {
    let progress: readonly [number, number] | undefined;
    const snapshot = await exportFrom(
      file,
      kit.pages.map((page) => page.key),
      (done, total) =>
        Effect.sync(() => {
          progress = [done, total];
        })
    );
    expect(new Set(Object.keys(snapshot))).toEqual(
      new Set(["format", "version", "exportedAt", "file", "scale", "previews"])
    );
    // The format `figma:compare` reads, at version 1, with every PNG at 2x.
    expect([snapshot.format, snapshot.version, snapshot.scale]).toEqual(["fuse-kit-snapshots", 1, 2]);
    expect(snapshot.previews.map((preview) => [preview.key, preview.name, preview.instances.length])).toEqual(
      KIT_PAGES.flatMap((page) => previewsOn(page).map(({ key, name }) => [key, name, previewedOn(page)]))
    );
    const instances = KIT_PAGES.reduce((sum, page) => sum + 4 * previewedOn(page), 0);
    expect(progress).toEqual([instances, instances]);
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

  it("exports the density a Badge or Kbd preview pins, though none of their layers binds density", async () => {
    const snapshot = await exportFrom(file, [pageKey(BADGE), pageKey(KBD)], () => Effect.void);
    // The collections the real file's first Badge preview resolved on 2026-10-21 (rule 11): no
    // density, which the preview pins and no Badge layer binds.
    const names = new Map(
      (await file.figma.variables.getLocalVariableCollectionsAsync()).map((collection) => [
        collection.id,
        collection.name,
      ])
    );
    const [badgePreview] = (await kitPage(file, pageKey(BADGE))).children.filter(
      (node): node is FrameNode => node.type === "FRAME"
    );
    expect(
      new Set(Object.keys(badgePreview?.resolvedVariableModes ?? {}).map((id) => names.get(id)))
    ).toEqual(new Set(["Fuse brand", "Fuse segment", "Fuse variant", "Fuse tokens"]));
    const pins = (tokens: string, variant: string) => [
      { collection: "Fuse brand", mode: "Fjordkraft" },
      { collection: "Fuse density", mode: "Auto" },
      { collection: "Fuse segment", mode: "Private" },
      { collection: "Fuse tokens", mode: tokens },
      { collection: "Fuse variant", mode: variant },
    ];
    const themes = [
      pins("Light", "Internal"),
      pins("Dark", "Internal"),
      pins("Light", "External"),
      pins("Dark", "External"),
    ];
    expect(snapshot.previews.map((preview) => [preview.name, preview.modes])).toEqual([
      ...previewsOn(BADGE).map(({ name }, index) => [name, themes[index]]),
      ...previewsOn(KBD).map(({ name }, index) => [name, themes[index]]),
    ]);
  });
});
