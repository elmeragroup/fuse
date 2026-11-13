/** What names an action button that belongs to a field. */
export type FieldActionNameInput = {
  /** The button's own id, which its `aria-labelledby` lists first. */
  readonly id: string;
  /** The button's own word, such as "Calendar" or "Increase". */
  readonly name: string;
  /** The id of the field's visible label, when it has one. */
  readonly fieldLabelId: string | undefined;
  /** The field's `aria-label`, which names it when no visible label does. */
  readonly fieldAriaLabel: string | undefined;
};

/** The naming attributes of an action button that belongs to a field. */
export type FieldActionName = {
  /** The button's own word, or that word and the field's `aria-label`. */
  readonly "aria-label": string;
  /** The button's own id then the field's label id, present only with a visible label. */
  readonly "aria-labelledby"?: string;
};

/**
 * Names an action button after the field it acts on ("Calendar Start date", "Increase Quantity"),
 * as React Aria names a date picker's button and a number field's steppers: a screen reader
 * reaching the button alone, by swiping, still hears which field it changes.
 *
 * With a visible label, the button keeps its own word as `aria-label` and lists its own id, then
 * the label's, in `aria-labelledby`; the self-reference reads that `aria-label`, so the label's
 * text follows the word and tracks the label as it changes. Without one, the field's `aria-label`
 * follows the word in the button's own `aria-label`. A field with neither leaves the word alone.
 * Referencing the field's input instead would read its value (accname's embedded-control step).
 *
 * @param input - The button's id and word, and what names its field.
 * @returns The `aria-label` and, with a visible label, the `aria-labelledby` to spread on the button.
 */
export function fieldActionName({
  id,
  name,
  fieldLabelId,
  fieldAriaLabel,
}: FieldActionNameInput): FieldActionName {
  if (fieldLabelId !== undefined) {
    return { "aria-label": name, "aria-labelledby": `${id} ${fieldLabelId}` };
  }
  return { "aria-label": fieldAriaLabel === undefined ? name : `${name} ${fieldAriaLabel}` };
}
