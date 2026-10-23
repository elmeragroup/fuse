import { isHTMLElement } from "./dom-node";

/** Input types that take no typed text, such as a Slider thumb's `range` input. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * Whether `target` takes typed text, so it keeps its native keys and paste: a text input, a text
 * area or editable content. It checks by name, so it holds for an element from another realm.
 *
 * @param target - An event target or the focused element.
 * @returns `true` for an element that takes text.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) {
    return false;
  }
  if (target.localName === "input") {
    return !NON_TEXT_INPUT_TYPES.has((target.getAttribute("type") ?? "text").toLowerCase());
  }
  return target.localName === "textarea" || target.isContentEditable;
}
