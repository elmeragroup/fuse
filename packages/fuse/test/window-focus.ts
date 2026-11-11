/**
 * Play a window switch on the focused element: the events a browser fires when the page's window
 * loses focus and gets it back. It fires `blur`, then `focusout`, with no related target, and keeps
 * the element as the document's active element; on the window's return it fires `focus`, then
 * `focusin`. A headless page emulates focus and fires none of them, so they are dispatched here.
 *
 * @param element - The focused element.
 */
export function switchWindowAndBack(element: Element): void {
  element.dispatchEvent(new FocusEvent("blur", { relatedTarget: null }));
  element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  element.dispatchEvent(new FocusEvent("focus", { relatedTarget: null }));
  element.dispatchEvent(new FocusEvent("focusin", { bubbles: true, relatedTarget: null }));
}
