/**
 * DOM type checks that hold across realms. `instanceof HTMLElement` compares against the running
 * window's constructor, so it is false for a node in a same-origin iframe that this window's React
 * renders into through a portal. These read the node type, or the node's own window.
 */

/**
 * Whether an event target is a DOM node, from any realm.
 *
 * @param target - The event target.
 * @returns `true` for a node.
 */
export function isNode(target: EventTarget | null): target is Node {
  return target !== null && "nodeType" in target;
}

/**
 * Whether an event target is an HTML element, checked against its own window's constructor.
 *
 * @param target - The event target.
 * @returns `true` for an HTML element.
 */
export function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  if (!isNode(target) || target.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const view = target.ownerDocument?.defaultView;
  return view !== null && view !== undefined && target instanceof view.HTMLElement;
}

/**
 * Whether a node is a document or a shadow root, the two roots that report `activeElement`.
 *
 * @param node - A node, such as the result of `getRootNode()`.
 * @returns `true` for a document or a shadow root.
 */
export function isFocusRoot(node: Node): node is Document | ShadowRoot {
  return (
    node.nodeType === Node.DOCUMENT_NODE || (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in node)
  );
}
