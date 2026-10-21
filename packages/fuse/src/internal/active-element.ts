import { isFocusRoot } from "./dom-node";

/**
 * The element that has focus, read from `root` and down through every open shadow root on the
 * way. A document or shadow root reports only the host for focus inside a shadow root below it,
 * so a plain `activeElement` read names the host, never the focused control.
 *
 * @param root - The document or shadow root to read from.
 * @returns The focused element, or null when nothing in `root` has focus.
 */
export function deepActiveElement(root: Document | ShadowRoot): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Whether `node` itself has focus. Read from the node's own root, so it holds inside a closed
 * shadow root, which a read from the document cannot enter, and in a same-origin iframe.
 *
 * @param node - The element to check.
 * @returns `true` when `node` is the focused element.
 */
export function hasFocus(node: Element): boolean {
  const root = node.getRootNode();
  return isFocusRoot(root) && deepActiveElement(root) === node;
}
