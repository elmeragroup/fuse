/** The elements whose keys belong to the text typed into them. */
const TEXT_FIELDS = "input, textarea, select";

/**
 * Whether keys pressed on `target` belong to a text field, so a page shortcut leaves them alone.
 *
 * @param target - The key event's target.
 * @param extra - More selectors whose descendants keep their keys too, such as open overlays.
 * @returns True inside an editable element, a text field or a match for `extra`.
 */
export function isTypingTarget(target: EventTarget | null, extra?: string): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(extra === undefined ? TEXT_FIELDS : `${TEXT_FIELDS}, ${extra}`) !== null)
  );
}

/** The input types whose keys edit the text typed into them. */
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

/**
 * Whether `target` edits text, so its own undo owns ⌘Z: a text input, a textarea or an editable
 * element. Unlike {@link isTypingTarget}, a range input, a checkbox or a select is not one.
 *
 * @param target - The key event's target.
 */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)))
  );
}
