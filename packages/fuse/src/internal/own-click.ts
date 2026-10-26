import { isNode } from "./dom-node";

/**
 * Elements that keep their own click inside a region that routes clicks elsewhere, such as a
 * selectable SubSection band: native controls, links, editable regions, and anything else that
 * takes focus. `closest()` matches an SVG icon inside one of them, too.
 */
export const OWN_CLICK_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[role=button]",
  "[role=link]",
  "[tabindex]",
].join(",");

/**
 * Elements a click on a pressable region, such as a table row or a drop zone, must not also
 * press the region through: the shared own-click set, plus the ARIA widgets Fuse renders as
 * non-native elements (Base UI's checkbox and radio spans, a slider thumb, a date segment) that
 * such a region can hold. The slider's track has no role, so its control is named by slot.
 */
export const INTERACTIVE_DESCENDANT = [
  OWN_CLICK_SELECTOR,
  "[role=checkbox]",
  "[role=radio]",
  "[role=switch]",
  "[role=slider]",
  "[role=spinbutton]",
  "[role=textbox]",
  "[role=combobox]",
  "[role=menuitem]",
  "[data-slot=slider-control]",
].join(",");

/**
 * Whether the page's text selection reaches into `node`, so the click that ended a drag across
 * it selects rather than presses. A selection elsewhere on the page outlives a click in a
 * `select-none` region, so only one that intersects `node` counts.
 *
 * @param node - The region the click landed in.
 * @returns `true` when a non-collapsed selection intersects `node`.
 */
export function selectionReaches(node: Node): boolean {
  const selection = window.getSelection();
  const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  return range !== null && !range.collapsed && range.intersectsNode(node);
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/**
 * Whether a click on a pressable region, such as a table row or a drop zone, presses it. React
 * bubbles a click from portalled content, such as an open menu or a dialog, to the region that
 * owns it in the React tree, though its DOM sits outside the region; such a click never presses
 * it. Inside the region, an {@link INTERACTIVE_DESCENDANT} owns its click, and a click that ends
 * a text selection reaching into the region (a drag to copy an order number) selects, not
 * presses. The checks read node types, so a target from another realm counts too.
 *
 * @param target - The click's target.
 * @param region - The element that received the click.
 * @returns `true` when the target sits inside the region's DOM and outside every interactive
 * element in it, and no text selection reaches into the region.
 */
export function pressesRegion(target: EventTarget | null, region: Element): boolean {
  if (!isNode(target) || !region.contains(target)) {
    return false;
  }
  const element = isElementNode(target) ? target : target.parentElement;
  const interactive = element?.closest(INTERACTIVE_DESCENDANT) ?? null;
  if (interactive !== null && interactive !== region && region.contains(interactive)) {
    return false;
  }
  return !selectionReaches(region);
}
