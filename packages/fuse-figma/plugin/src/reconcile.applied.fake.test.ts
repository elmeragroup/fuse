/**
 * `reconcileKit` on parts of an applied file whose writes real Figma probes settled: Avatar's
 * image fills, the Number field's steppers, the Tooltip's arrow, and a file whose label font the
 * machine cannot load. Each suite names its oracle.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import { inventoryPage, pageKey } from "../../test/kit-inventory.ts";
import { childNamed, RED_PIXEL } from "./fake-fixtures.ts";
import { appliedFile, kitFixture, kitPage, setOn, syncedFile } from "./kit-fixture.ts";
import { changes, variantNamed, arrowPlace } from "./reconcile-fake-support.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  ({ kit, collections } = await kitFixture());
}, 60_000);

// Unit under test: `reconcileKit` on Avatar's image fills. Oracle: the hash a real file gave the
// portrait, `1e57f3da…`, the SHA-1 of its bytes (P9b), the fake's rule 22, which logs storing an
// image as a write, and the change lines `test/kit-inventory.ts` gives the Avatar page. Avatar
// group's three avatars are instances of Avatar, so each plans again once Avatar's changes land, and
// the group's grid lays out again after them.
describe("Avatar's image fills on an applied file", () => {
  const PORTRAIT_SHA1 = "1e57f3da2ad606fcd410ba17f62d2fc032aa669c";
  const AVATAR_PAGE = pageKey(inventoryPage("avatar"));

  it("stores no image when Plan finds the Avatar set missing, and Apply stores each image cell's", async () => {
    const file = await appliedFile();
    setOn(await kitPage(file, AVATAR_PAGE), "Avatar").remove();
    file.reopen();
    const before = file.writes.length;
    expect(await changes(file)).toContain("Avatar: create the component set Avatar with 8 variants");
    expect(file.writes.slice(before)).toEqual([]);

    await reconcileKit(file.figma, kit, true);
    expect(file.writes.slice(before).filter((line) => line.startsWith("store the image"))).toEqual(
      Array.from({ length: 4 }, () => `store the image ${PORTRAIT_SHA1}`)
    );
    file.reopen();
    expect(await changes(file)).toEqual([]);
  });

  it("lists the one fill change and stores nothing when Plan finds an Avatar holding other bytes", async () => {
    const file = await appliedFile();
    const avatar = setOn(await kitPage(file, AVATAR_PAGE), "Avatar");
    const image = childNamed(variantNamed(avatar, "content=image, size=32"), "FRAME", "avatar-image");
    file.figma.createImage(file.figma.base64Decode(RED_PIXEL.bytes));
    image.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: RED_PIXEL.sha1 }];
    file.reopen();
    const before = file.writes.length;

    expect(await changes(file)).toEqual([
      `Avatar / content=image, size=32 / avatar-image: fill → image ${PORTRAIT_SHA1.slice(0, 8)} at FILL (holds image ${RED_PIXEL.sha1.slice(0, 8)} at FILL)`,
      "Avatar: lay out 8 variants in 4 columns and 2 rows",
      ...Array.from(
        { length: 3 },
        () => "Avatar group / avatars=3 / avatar: plan again once Avatar's changes land"
      ),
      "Avatar group: lay out 1 variants in 1 columns and 1 rows",
      "Avatar: place Avatar and Avatar group in a row and stack 4 previews below them",
    ]);
    expect(file.writes.slice(before)).toEqual([]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await changes(file)).toEqual([]);
  });
});

// Unit under test: the Number field as Apply writes it. Oracle: probe W5-P8 in Figma. The decrease
// stepper's swapped glyph reads Minus in the main and in an instance of it.
describe("Number field's steppers on an applied file", () => {
  const NUMBER_FIELD_PAGE = pageKey(inventoryPage("number-field"));

  it("shows Minus on the decrease stepper and Plus on the increase one, in the main and an instance (W5-P8)", async () => {
    const page = await kitPage(await appliedFile(), NUMBER_FIELD_PAGE);
    const main = setOn(page, "Number field").children.find((node) => node.name === "state=rest");
    // The name of each `Icon` instance's main component, in layer order.
    const glyphs = async (node: SceneNode): Promise<readonly (string | undefined)[]> => {
      const own =
        node.type === "INSTANCE" && node.name === "Icon" ? [(await node.getMainComponentAsync())?.name] : [];
      const below = "children" in node ? await Promise.all(node.children.map(glyphs)) : [];
      return [...own, ...below.flat()];
    };
    expect(main?.type).toBe("COMPONENT");
    if (main?.type !== "COMPONENT") {
      return;
    }
    expect([await glyphs(main), await glyphs(main.createInstance())]).toEqual([
      ["Minus", "Plus"],
      ["Minus", "Plus"],
    ]);
  });
});

// Unit under test: the Tooltip content set's arrow as Apply writes it. Oracle: Chromium on 2026-10-27
// centred Tooltip's turned arrow at (W/2, H - 2) in a W × H popup, at 92 × 28 dense and 100 × 32
// comfortable, and Figma's transform at a turn r is [[cos r, sin r, x], [-sin r, cos r, y]] (PQ), so
// the centre of the 10px square is its origin moved by that transform's image of (5, 5). The arrow's
// constraints keep the centre as the popup's size changes with the density (fake rule 59, unprobed).
describe("Tooltip's arrow on an applied file", () => {
  const TOOLTIP_PAGE = pageKey(inventoryPage("tooltip"));

  // The fake lays out no hugging main, so the popup takes Chromium's sizes by a resize, which moves
  // an absolute layer by its constraints (fake rules 9, 59), as a density switch resizes it in Figma.
  it("keeps the arrow's centre as the popup takes its dense and comfortable sizes, in the main and an instance", async () => {
    const page = await kitPage(await appliedFile(), TOOLTIP_PAGE);
    const main = setOn(page, "Tooltip content").children[0];
    expect(main?.type).toBe("COMPONENT");
    if (main?.type !== "COMPONENT") {
      return;
    }
    const instance = main.createInstance();
    const at = (width: number, height: number) => {
      main.resize(width, height);
      return [arrowPlace(main), arrowPlace(instance)].map(({ fromCentre, aboveBottom }) => [
        fromCentre,
        aboveBottom,
      ]);
    };
    expect([at(92, 28), at(100, 32)]).toEqual([
      [
        [0, 2],
        [0, 2],
      ],
      [
        [0, 2],
        [0, 2],
      ],
    ]);
  });
});

describe("a file whose label font the machine cannot load", () => {
  it("fails Plan, and stops Apply before any write", async () => {
    const file = syncedFile(collections, [{ family: "Roboto", style: "Medium" }]);
    const message = "The kit needs the font Roboto Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
    expect(file.writes).toEqual([]);
  });
});
