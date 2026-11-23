/**
 * Unit under test: `manifestDefinition`'s refusal of an icon that declares a place it does not own.
 * Oracle: the kit's rule that only Accordion item's `infodropdown` caret takes a declared place
 * (`components/declared-icon-place.ts`): the CaretDown icon of the set's trigger, in the cells of its
 * `infodropdown` variant. An icon anywhere else that carries the place is a defect in its kit module,
 * at another set's root or part, as another icon of the trigger, or in another variant's cells.
 */
import { describe, expect, it } from "vitest";

import { chip, ICON, part } from "../../test/capture-fixtures.ts";
import type { PartDefinition } from "../components/component-spec.ts";
import type { DeclaredIconPlace } from "../components/declared-icon-place.ts";
import type { IconManifest, PartManifest } from "./manifest.ts";
import { manifestDefinition } from "./manifest.ts";

/** The `infodropdown` caret's place, as `accordion-kit.ts` declares it in a closed item. */
const CARET_PLACE: DeclaredIconPlace = {
  set: "accordion-item",
  part: "trigger",
  icon: "CaretDown",
  variant: "infodropdown",
  end: 0,
  size: 16,
  turn: 0,
};

/** The fixtures' Plus icon, carrying the caret's place. */
const PLACED: IconManifest = { ...ICON, placed: CARET_PLACE };

/** The caret, as an Accordion item's trigger lists it, carrying its place. */
const CARET: IconManifest = { ...ICON, key: "caret", icon: "CaretDown", placed: CARET_PLACE };

/** The first part of a definition's first part, which a manifest of header and trigger holds. */
function nestedPart(parts: ReturnType<typeof manifestDefinition>["parts"]): PartDefinition {
  const [outer] = parts ?? [];
  const [inner] = outer !== undefined && !("kind" in outer) ? (outer.parts ?? []) : [];
  if (inner === undefined || "kind" in inner) {
    throw new Error("the definition holds no part in its first part");
  }
  return inner;
}

/** An Accordion item's manifest of a header around a trigger that lists one icon. */
function accordionItem(icon: IconManifest) {
  const trigger: PartManifest = part({ key: "trigger", slot: "accordion-trigger", iconsFor: () => [icon] });
  const header: PartManifest = part({ key: "header", slot: "accordion-header", parts: [trigger] });
  return manifestDefinition(chip({ key: "accordion-item", parts: [header] }));
}

describe("an icon that declares a place it does not own", () => {
  it("fails the chip's root where its icon declares the caret's place", () => {
    const definition = manifestDefinition(chip({ iconsFor: () => [PLACED] }));
    expect(() => definition.iconsFor({ state: "rest", variant: "infodropdown" })).toThrow(
      "chip: the Plus icon icon of the root declares a place at variant infodropdown, which only the CaretDown icon of accordion-item's trigger takes, in its infodropdown cells"
    );
  });

  it("fails the chip's part where its icon declares the caret's place", () => {
    const definition = manifestDefinition(chip({ parts: [part({ iconsFor: () => [PLACED] })] }));
    const [dot] = definition.parts ?? [];
    if (dot === undefined || "kind" in dot) {
      throw new Error("the chip's definition holds no dot part");
    }
    expect(() => dot.iconsFor({ state: "rest", variant: "infodropdown" })).toThrow(
      "chip: the Plus icon icon of dot declares a place at variant infodropdown, which only the CaretDown icon of accordion-item's trigger takes, in its infodropdown cells"
    );
  });

  it("fails Accordion item's trigger where another icon declares the caret's place", () => {
    const trigger = nestedPart(accordionItem(PLACED).parts);
    expect(() => trigger.iconsFor({ state: "rest", variant: "infodropdown" })).toThrow(
      "accordion-item: the Plus icon icon of trigger declares a place at variant infodropdown, which only the CaretDown icon of accordion-item's trigger takes, in its infodropdown cells"
    );
  });

  it("fails Accordion item's trigger where the caret declares its place in another variant's cell", () => {
    const trigger = nestedPart(accordionItem(CARET).parts);
    expect(() => trigger.iconsFor({ state: "rest", variant: "default" })).toThrow(
      "accordion-item: the CaretDown icon caret of trigger declares a place at variant default, which only the CaretDown icon of accordion-item's trigger takes, in its infodropdown cells"
    );
  });
});
