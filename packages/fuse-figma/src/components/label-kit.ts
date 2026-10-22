/**
 * Label, as one component set: the label a form shows above its control, at rest and disabled, 2
 * cells. Fuse has no standalone Label. This is `Field.Label`, Base UI's `<label
 * data-slot="field-label">` inside a `Field.Root`, with the `label` slot of `fieldVariants`.
 *
 * - The label is the root's own text, `Email`, as the docs' field label. It hugs its text, set in
 *   the label type pair at Medium.
 * - Disabled draws at 50% opacity, through `group-data-disabled/field:`, which holds while the
 *   Field root around the label carries `data-disabled`. Base UI stamps the same `data-disabled`
 *   on the label itself.
 * - The recipe's `has-[>[data-slot=field]]:`, `*:data-[slot=field]:`, `has-[>[data-slot=checkbox]]:`
 *   and `has-data-checked:` arms style a label that wraps a Field card or a Checkbox. That is
 *   Field composition, which waits for wave 3, so they drop.
 */
import { fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { ComponentDefinition } from "./component-spec";

/** Why the kit drops the arms that style a label wrapping a control or a Field card. */
const COMPOSITION =
  "a label that wraps a control or a Field card is Field composition, which waits for wave 3";

/** A label, as `<Field.Root disabled={…}><Field.Label>Email</Field.Label></Field.Root>`. */
export const LABEL: ComponentDefinition = {
  key: "label",
  name: "Label",
  slot: "field-label",
  rootKind: "base-ui-field-label",
  axes: [{ name: "state", values: ["rest", "disabled"] }],
  columnAxis: "state",
  classesFor: () => fieldVariants().label(),
  // The Field root carries `data-disabled` and the `group/field` marker that this variant reads.
  states: { disabled: ["group-data-disabled/field"] },
  facts: new Map(),
  omittedStates: new Set(),
  omittedCompositions: new Map(
    ["has-[>[data-slot=field]]", "*", "has-[>[data-slot=checkbox]]", "has-data-checked"].map((variant) => [
      variant,
      COMPOSITION,
    ])
  ),
  label: { key: "label", name: "label", characters: "Email", textProperty: "Label", shownIn: () => true },
  iconsFor: () => [],
  swapProperties: [],
};
