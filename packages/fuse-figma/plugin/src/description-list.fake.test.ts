/**
 * The upgrade of a file whose Description list item draws its term's side padding on the term, as
 * the kit at fc9dab20b drew it, to the kit that moves that padding to a frame keyed `inset` inside
 * the term, on the in-memory file in `fake-figma.ts`. Unit under test: `reconcileKit`. Oracles: the
 * kit spec's change to the term (its side padding and the layout of its text move to `inset`, and
 * the term lays out at MIN), and the README's rule that layer keys inside a variant are not frozen,
 * so a text the spec moves into a new frame is one delete and one create while an instance keeps the
 * value it gives the set's TEXT property. The next Plan lists nothing.
 */
import { describe, expect, it } from "vitest";

import type { BoxSpec, ChildLayerSpec, KitSpec } from "../../src/components/kit-spec.ts";
import { childNamed } from "./fake-fixtures.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * A layer with each `inset` frame below it folded back into its parent: the frame's side padding and
 * layout on the parent, its layers in its place. On 2026-11-20 this gave the Description list item set
 * the kit built at fc9dab20b, byte for byte.
 */
function withoutInset<Layer extends BoxSpec | ChildLayerSpec>(layer: Layer): Layer {
  if (!("children" in layer)) {
    return layer;
  }
  const children = layer.children.map(withoutInset);
  const at = layer.children.findIndex((child) => child.kind === "frame" && child.key === "inset");
  const inset = layer.children[at];
  if (inset?.kind !== "frame") {
    return { ...layer, children };
  }
  return {
    ...layer,
    paddingLeft: inset.paddingLeft,
    paddingRight: inset.paddingRight,
    direction: inset.direction,
    itemSpacing: inset.itemSpacing,
    primaryAlign: inset.primaryAlign,
    counterAlign: inset.counterAlign,
    children: [...children.slice(0, at), ...inset.children.map(withoutInset), ...children.slice(at + 1)],
  };
}

/** The kit with its Description list item as the kit at fc9dab20b built it. */
function beforeInset(kit: KitSpec): KitSpec {
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) =>
      set.key !== "description-list-item"
        ? set
        : {
            ...set,
            variants: set.variants.map((variant) => ({ ...variant, root: withoutInset(variant.root) })),
          }
    ),
  };
}

const VARIANTS = [
  "position=first, dividers=false",
  "position=first, dividers=true",
  "position=later, dividers=false",
  "position=later, dividers=true",
];

describe("a Description list item file from before the term's inset frame", () => {
  it("deletes the term's text and creates it in the inset, keeps an instance's Term value, then converges", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    await reconcileKit(file.figma, beforeInset(kit), true);
    file.reopen();
    const page = await kitPage(file, "page/description-list");
    const variant = setOn(page, "Description list item").children.find(
      (child) => child.name === "position=first, dividers=false"
    );
    if (variant?.type !== "COMPONENT") {
      throw new Error("the Description list item set holds no position=first, dividers=false variant");
    }
    const instance = variant.createInstance();
    const term = Object.keys(instance.componentProperties).find((id) => id.startsWith("Term#"));
    if (term === undefined) {
      throw new Error("the Description list item set has no Term property");
    }
    // Figma writes a TEXT property's characters into the label, which needs the label's font.
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    instance.setProperties({ [term]: "Telefon" });

    const plan = await reconcileKit(file.figma, kit, false);
    // The order of Plan's lines is not part of the contract. Sorted lists still catch a missing, an
    // extra or a repeated line.
    expect(plan.changes.filter((line) => line.startsWith("Description list item /")).sort()).toEqual(
      VARIANTS.flatMap((name) => {
        const at = `Description list item / ${name} / description-list-term`;
        return [
          `${at}: primaryAxisAlignItems → MIN`,
          `${at}: counterAxisAlignItems → MIN`,
          `${at}: paddingRight → 0`,
          `${at}: delete the layer text`,
          `${at}: create the frame layer inset`,
        ];
      }).sort()
    );
    await reconcileKit(file.figma, kit, true);
    const shown = childNamed(
      childNamed(childNamed(instance, "FRAME", "description-list-term"), "FRAME", "inset"),
      "TEXT",
      "text"
    );
    expect([instance.componentProperties[term]?.value, shown.characters]).toEqual(["Telefon", "Telefon"]);
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});
