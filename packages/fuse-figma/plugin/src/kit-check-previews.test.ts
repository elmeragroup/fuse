/**
 * The kit check's hold on preview coverage of BOOLEAN properties, and on the docs every page carries.
 *
 * Unit under test: `checkKitSpec` over the built kit and over the kit with its Item previews edited.
 * Oracles: the rule that every BOOLEAN property is placed by some preview instance at `true` and by
 * some at `false`, each instance at the value it sets or else at the property's default, written out
 * here for Item's `Media`, which starts true; and the rule that every page that holds a set has a
 * title and an example, and every set a labels frame, written out here for the Badge page.
 */
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { ChildLayerSpec, KitSpec, PageDocsSpec } from "../../src/components/kit-spec.ts";
import { base64Decode } from "./fake/paints.ts";
import { kitFixture } from "./kit-fixture.ts";

/** The kit with every Item preview instance setting `Media` to one value. */
function withItemMedia(kit: KitSpec, value: boolean): KitSpec {
  return {
    ...kit,
    previews: kit.previews.map((preview) => ({
      ...preview,
      groups: preview.groups.map((group) =>
        group.componentSet !== "item"
          ? group
          : {
              ...group,
              instances: group.instances.map((instance) => ({
                ...instance,
                booleans: { ...instance.booleans, Media: value },
              })),
            }
      ),
    })),
  };
}

/** The check's verdict: `accepted`, or the contradiction's message. */
function verdict(kit: KitSpec): string {
  const checked = checkKitSpec(kit, base64Decode);
  return Result.isSuccess(checked) ? "accepted" : checked.failure.message;
}

describe("the kit check's preview coverage of BOOLEAN properties", () => {
  it("accepts the built kit", async () => {
    const { kit } = await kitFixture();
    expect(verdict(kit)).toBe("accepted");
  });

  it.each([
    [false, "Item: no preview places its Media property at true, so no comparison renders that state."],
    [true, "Item: no preview places its Media property at false, so no comparison renders that state."],
  ])("refuses a kit whose every Item preview sets Media to %s", async (value, message) => {
    const { kit } = await kitFixture();
    expect(verdict(withItemMedia(kit, value))).toBe(message);
  });
});

describe("the kit check's docs", () => {
  /** The kit's docs as the build makes them, with the Badge page's record edited or dropped. */
  const badgeEdited = (kit: KitSpec, edit: (record: PageDocsSpec) => readonly PageDocsSpec[]): KitSpec => ({
    ...kit,
    docs: kit.docs.flatMap((record) => (record.page === "page/badge" ? edit(record) : [record])),
  });

  it.each<readonly [string, (record: PageDocsSpec) => readonly PageDocsSpec[], string]>([
    ["drops the Badge page's docs", () => [], "The Badge page has no docs."],
    ["documents the Badge page twice", (record) => [record, record], "The Badge page has 2 docs records."],
    ["labels no Badge set", (record) => [{ ...record, labels: [] }], "Badge: no labels frame reads the set."],
  ])("refuses a kit that %s", async (_name, edit, message) => {
    const { kit } = await kitFixture();
    expect(verdict(badgeEdited(kit, edit))).toBe(message);
  });

  it("refuses a kit that documents no page", async () => {
    const { kit } = await kitFixture();
    expect(verdict({ ...kit, docs: [] })).toBe("The Button page has no docs.");
  });
});

describe("the kit check's lengths a placement sets", () => {
  /** A layer and the layers below it, with every `::before`'s placement dropped. */
  const unplaced = (layer: ChildLayerSpec): ChildLayerSpec => {
    if (layer.kind !== "frame") {
      return layer;
    }
    const { placement: _placement, ...rest } = layer;
    const own = layer.key === "::before" ? rest : layer;
    return { ...own, children: own.children.map(unplaced) };
  };

  it("refuses a length left to a placement the layer does not hold", async () => {
    const { kit } = await kitFixture();
    const edited: KitSpec = {
      ...kit,
      componentSets: kit.componentSets.map((set) =>
        set.key !== "timeline-list"
          ? set
          : {
              ...set,
              variants: set.variants.map((variant) => ({
                ...variant,
                root: { ...variant.root, children: variant.root.children.map(unplaced) },
              })),
            }
      ),
    };
    expect(verdict(edited)).toBe(
      "Timeline list: ::before in the variant timeline-list/state=rest leaves its vertical length to a placement that does not stretch it."
    );
  });
});
