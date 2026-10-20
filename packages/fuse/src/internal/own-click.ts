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
