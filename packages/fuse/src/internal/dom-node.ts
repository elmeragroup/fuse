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

/**
 * Whether `node` is inside `element`, or inside a shadow root hosted there, at any depth. A plain
 * `contains` stops at a shadow root, such as one a custom control renders into.
 *
 * @param element - The element that may hold `node`.
 * @param node - The node to look for, such as the element that has focus.
 * @returns `true` when `node` is `element` or inside it.
 */
export function containsAcrossShadowRoots(element: Element, node: Node): boolean {
  let current: Node | null = node;
  while (current !== null) {
    if (element.contains(current)) {
      return true;
    }
    const root = current.getRootNode();
    current = isFocusRoot(root) && "host" in root ? root.host : null;
  }
  return false;
}

/**
 * Compare two nodes by document order, for sorting.
 *
 * @param left - One node.
 * @param right - The other node.
 * @returns A negative number when `left` comes first, a positive one otherwise.
 */
export function documentOrder(left: Node, right: Node): number {
  return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Whether a node is a text node, from any realm.
 *
 * @param node - A node.
 * @returns `true` for a text node.
 */
export function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

/**
 * Whether a node is an element, from any realm.
 *
 * @param node - A node.
 * @returns `true` for an element.
 */
export function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/**
 * The window a node belongs to: a same-origin frame's own for a node in the frame, so its
 * computed styles, observers, frames and constructors are the ones that see it.
 *
 * @param node - A node in a document with a window.
 * @returns The node's window.
 * @throws Error for a node whose document has no window, as one that was never attached does not.
 */
export function windowOf(node: Node): Window & typeof globalThis {
  const view = (node.ownerDocument ?? (isDocument(node) ? node : null))?.defaultView;
  if (view === null || view === undefined) throw new Error("expected a node in a document with a window");
  return view;
}

/** Whether a node is a document, from any realm. */
function isDocument(node: Node): node is Document {
  return node.nodeType === Node.DOCUMENT_NODE;
}
