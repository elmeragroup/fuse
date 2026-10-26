/**
 * Field's text parts beside Label, as four component sets on the Field page: the description, the
 * error, the legend and the title, each the slot of `fieldVariants` its part renders.
 *
 * - The description is Base UI's `<p data-slot="field-description">` and the error its
 *   `<div data-slot="field-error">`, each in a `Field.Root`, which the build names by its recipe
 *   classes. The legend is Base UI's `<div data-slot="field-legend">` in a `Field.Set`, whose classes
 *   pass nothing down. The browser's default style sheet makes the three block boxes, so each fills
 *   the 384px the Field gives Input and Textarea and wraps its text there.
 * - The title is a `<div data-slot="field-title">`, a `w-fit` flex row that hugs its text with an
 *   8px gap, in a `Field.Root`. A disabled Field dims it to 50% through
 *   `group-data-disabled/field:`, as it dims Label. Nothing stamps the title itself.
 * - Each text is a docs demo's copy, which a `Text` property sets.
 * - The description draws the same in every state of its Field, so its set has one `state`, `rest`.
 *   The error shows in an invalid Field, which stamps it `data-invalid`, so its one `state` is
 *   `invalid`. The legend's `variant` sets 16/24px or the label type pair.
 * - The Field root stretches each part to its width. The description and the error fill it anyway,
 *   and the title hugs its text, as it does in `Field.Content`, where the docs place it.
 * - The description's margins place it among a Field's parts and after a legend, its
 *   `group-has-data-horizontal/field:` balances its lines in a Field that holds a horizontal Field,
 *   and the legend's `mb-3` spaces it from what follows. None of that is drawn in a set.
 */
import { fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, LabelDefinition } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { FIELD_ROOT, FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";

/** The description's text, the default of its `Text` property: the docs Basic demo's description. */
export const FIELD_DESCRIPTION_TEXT = "Work address preferred.";

/** The error's text, the default of its `Text` property: the docs Error message demo's error. */
export const FIELD_ERROR_TEXT = "Enter a work email.";

/** The legend's text, the default of its `Text` property: the docs Field set demo's legend. */
export const FIELD_LEGEND_TEXT = "Notifications";

/** The title's text, the default of its `Text` property: the docs Choice card demo's title. */
export const FIELD_TITLE_TEXT = "Fixed price";

/** The legend's variants, as `Field.Legend` takes its `variant`, its default first. */
const LEGEND_VARIANTS = ["legend", "label"] as const;

/** A legend variant, as `Field.Legend` takes it. */
type LegendVariant = (typeof LEGEND_VARIANTS)[number];

/**
 * A cell's legend variant.
 *
 * @param cell - A `field-legend` cell.
 * @returns The variant its `variant` names.
 * @throws When the cell names no variant the set declares, a defect in the caller's cell.
 */
export function legendVariantFor(cell: Cell): LegendVariant {
  const variant = LEGEND_VARIANTS.find((candidate) => candidate === cell.variant);
  if (variant === undefined) {
    throw new Error(`Field legend has no variant ${cell.variant ?? ""}`);
  }
  return variant;
}

/** The text a part shows in every cell, which its `Text` property sets. */
function text(characters: string): LabelDefinition {
  return { key: "text", name: "text", characters, textProperty: "Text", shownIn: () => true };
}

/**
 * The omissions of a part in a `Field.Root`: the root's child selectors, which reach the part, with
 * the stretch's reason for the part.
 */
function inFieldRoot(stretch: string): ReadonlyMap<string, string> {
  return new Map([FIELD_ROOT_SR_ONLY, [FIELD_ROOT_STRETCH, stretch]]);
}

/** What the four sets share: no facts, omitted states, icons or swap properties. */
const TEXT_PART = {
  facts: new Map(),
  omittedStates: new Set<string>(),
  iconsFor: () => [],
  swapProperties: [],
} as const;

/** A description, as `<Field.Root><Field.Description>…</Field.Description></Field.Root>`. */
export const FIELD_DESCRIPTION: ComponentDefinition = {
  ...TEXT_PART,
  key: "field-description",
  name: "Field description",
  slot: "field-description",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  elementDefaults: userAgentDisplay("p"),
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  classesFor: () => fieldVariants().description(),
  ancestorsFor: () => [FIELD_ROOT],
  states: {},
  omittedCompositions: new Map([
    ...inFieldRoot("the Field stretches the description to its width, which the description fills anyway"),
    [
      "group-has-data-horizontal/field",
      "a Field that holds a horizontal Field, as a choice card does, which the set does not draw",
    ],
    ["last", "the description's place among the parts of a Field, which the set does not draw"],
    [
      "[[data-variant=legend]+&]",
      "a description that follows a legend in a Field set, which the set does not draw",
    ],
  ]),
  label: text(FIELD_DESCRIPTION_TEXT),
};

/** An error, as `<Field.Root invalid><Field.Error>…</Field.Error></Field.Root>`. */
export const FIELD_ERROR: ComponentDefinition = {
  ...TEXT_PART,
  key: "field-error",
  name: "Field error",
  slot: "field-error",
  rootKind: "base-ui-field-part",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  elementDefaults: userAgentDisplay("div"),
  axes: [{ name: "state", values: ["invalid"] }],
  columnAxis: "state",
  classesFor: () => fieldVariants().error(),
  ancestorsFor: () => [FIELD_ROOT],
  states: {},
  omittedCompositions: inFieldRoot(
    "the Field stretches the error to its width, which the error fills anyway"
  ),
  label: text(FIELD_ERROR_TEXT),
};

/** A legend, as `<Field.Set><Field.Legend variant>…</Field.Legend></Field.Set>`. */
export const FIELD_LEGEND: ComponentDefinition = {
  ...TEXT_PART,
  key: "field-legend",
  name: "Field legend",
  slot: "field-legend",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  elementDefaults: userAgentDisplay("div"),
  axes: [{ name: "variant", values: LEGEND_VARIANTS }],
  columnAxis: "variant",
  classesFor: (cell) => fieldVariants({ variant: legendVariantFor(cell) }).legend(),
  states: {},
  label: text(FIELD_LEGEND_TEXT),
};

/** A title, as `<Field.Root disabled={…}><Field.Title>…</Field.Title></Field.Root>`. */
export const FIELD_TITLE: ComponentDefinition = {
  ...TEXT_PART,
  key: "field-title",
  name: "Field title",
  slot: "field-title",
  rootKind: "plain-element",
  axes: [{ name: "state", values: ["rest", "disabled"] }],
  columnAxis: "state",
  classesFor: () => fieldVariants().title(),
  ancestorsFor: () => [FIELD_ROOT],
  // The Field root carries `data-disabled` and the `group/field` marker that this variant reads.
  states: { disabled: ["group-data-disabled/field"] },
  omittedCompositions: inFieldRoot(
    "the Field stretches the title across its own width, which the set does not draw, and the title hugs its text as it does in Field.Content"
  ),
  label: text(FIELD_TITLE_TEXT),
};
