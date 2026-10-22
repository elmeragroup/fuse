/**
 * `exportSnapshots` over a file the plugin applied the whole kit to, on the in-memory file in
 * `fake-figma.ts`. The oracles are hand-written: the snapshot format `figma:compare` reads, the
 * instance count of each preview from the cells its sets place, and the modes each preview pins.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { appliedFile, kitFixture, kitPage, PREVIEWS, previewsOf } from "./kit-fixture.ts";
import { exportSnapshots } from "./snapshots.ts";

const BADGE_PAGE = "page/badge";
const KBD_PAGE = "page/kbd";
const TOGGLE_PREVIEWS = previewsOf("Toggle");
const BADGE_PREVIEWS = previewsOf("Badge");
const KBD_PREVIEWS = previewsOf("Kbd");
const RADIO_PREVIEWS = previewsOf("Radio");
const CHECKBOX_PREVIEWS = previewsOf("Checkbox");
const SWITCH_PREVIEWS = previewsOf("Switch");
const SEPARATOR_PREVIEWS = previewsOf("Separator");
const SKELETON_PREVIEWS = previewsOf("Skeleton");
const LOADER_PREVIEWS = previewsOf("Loader");
const LABEL_PREVIEWS = previewsOf("Label");

describe("Export snapshots from an applied file", () => {
  let kit: KitSpec;
  let file: FakeFigma;

  beforeAll(async () => {
    ({ kit } = await kitFixture());
    file = await appliedFile();
  }, 60_000);

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
        // Kbd: the text cap and the icon cap.
        ["preview/kbd/internal-fkas-private-light", KBD_PREVIEWS[0], 2],
        ["preview/kbd/internal-fkas-private-dark", KBD_PREVIEWS[1], 2],
        ["preview/kbd/external-fkas-private-light", KBD_PREVIEWS[2], 2],
        ["preview/kbd/external-fkas-private-dark", KBD_PREVIEWS[3], 2],
        // Radio icon button: 5 sizes, off and on, in 5 states. Radio: off and on, in 4 states.
        ["preview/radio/internal-fkas-private-light", RADIO_PREVIEWS[0], 58],
        ["preview/radio/internal-fkas-private-dark", RADIO_PREVIEWS[1], 58],
        ["preview/radio/external-fkas-private-light", RADIO_PREVIEWS[2], 58],
        ["preview/radio/external-fkas-private-dark", RADIO_PREVIEWS[3], 58],
        // Checkbox: off, on and mixed, in 4 states.
        ["preview/checkbox/internal-fkas-private-light", CHECKBOX_PREVIEWS[0], 12],
        ["preview/checkbox/internal-fkas-private-dark", CHECKBOX_PREVIEWS[1], 12],
        ["preview/checkbox/external-fkas-private-light", CHECKBOX_PREVIEWS[2], 12],
        ["preview/checkbox/external-fkas-private-dark", CHECKBOX_PREVIEWS[3], 12],
        // Switch: 2 sizes, off and on, in 4 states.
        ["preview/switch/internal-fkas-private-light", SWITCH_PREVIEWS[0], 16],
        ["preview/switch/internal-fkas-private-dark", SWITCH_PREVIEWS[1], 16],
        ["preview/switch/external-fkas-private-light", SWITCH_PREVIEWS[2], 16],
        ["preview/switch/external-fkas-private-dark", SWITCH_PREVIEWS[3], 16],
        // Separator: horizontal and vertical.
        ["preview/separator/internal-fkas-private-light", SEPARATOR_PREVIEWS[0], 2],
        ["preview/separator/internal-fkas-private-dark", SEPARATOR_PREVIEWS[1], 2],
        ["preview/separator/external-fkas-private-light", SEPARATOR_PREVIEWS[2], 2],
        ["preview/separator/external-fkas-private-dark", SEPARATOR_PREVIEWS[3], 2],
        // Skeleton: a line and a circle.
        ["preview/skeleton/internal-fkas-private-light", SKELETON_PREVIEWS[0], 2],
        ["preview/skeleton/internal-fkas-private-dark", SKELETON_PREVIEWS[1], 2],
        ["preview/skeleton/external-fkas-private-light", SKELETON_PREVIEWS[2], 2],
        ["preview/skeleton/external-fkas-private-dark", SKELETON_PREVIEWS[3], 2],
        // Loader: 5 sizes.
        ["preview/loader/internal-fkas-private-light", LOADER_PREVIEWS[0], 5],
        ["preview/loader/internal-fkas-private-dark", LOADER_PREVIEWS[1], 5],
        ["preview/loader/external-fkas-private-light", LOADER_PREVIEWS[2], 5],
        ["preview/loader/external-fkas-private-dark", LOADER_PREVIEWS[3], 5],
        // Label: rest and disabled.
        ["preview/label/internal-fkas-private-light", LABEL_PREVIEWS[0], 2],
        ["preview/label/internal-fkas-private-dark", LABEL_PREVIEWS[1], 2],
        ["preview/label/external-fkas-private-light", LABEL_PREVIEWS[2], 2],
        ["preview/label/external-fkas-private-dark", LABEL_PREVIEWS[3], 2],
      ]
    );
    expect(progress).toEqual([1320, 1320]);
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
    const snapshot = await exportSnapshots(file.figma, [BADGE_PAGE, KBD_PAGE], () => undefined);
    // The collections the real file's first Badge preview resolved on 2026-10-21 (rule 11): no
    // density, which the preview pins and no Badge layer binds.
    const names = new Map(
      (await file.figma.variables.getLocalVariableCollectionsAsync()).map((collection) => [
        collection.id,
        collection.name,
      ])
    );
    const [badgePreview] = (await kitPage(file, BADGE_PAGE)).children.filter(
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
      ...BADGE_PREVIEWS.map((name, index) => [name, themes[index]]),
      ...KBD_PREVIEWS.map((name, index) => [name, themes[index]]),
    ]);
  });
});
