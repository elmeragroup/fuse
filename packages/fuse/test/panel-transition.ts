/**
 * Frame-level observations for a height tween. `sampleFrames` and `hasIntermediateFrame` serve
 * any suite that pins one, such as `Item.Footer`'s row; the assertion helper below covers the two
 * Base UI panels whose height animates through the shared `panelHeightTransition` constant
 * (`Collapsible.Content`, `Accordion.Content`). End-state
 * assertions cannot tell a transition from a snap, so the assertion helper samples the
 * rendered box once per animation frame, watches the height transition events, and waits
 * for the animation to settle before checking either direction.
 */

/**
 * The panel a trigger controls *while the panel is open*: `aria-controls` is the semantic
 * seam and works for the keepMounted, hiddenUntilFound, and default (unmounted-when-closed)
 * content variants, unlike a `closest("[hidden]")` walk, which depends on the mount mode.
 * Base UI exposes the attribute only while open, so suites resolve the panel after the
 * opening click.
 */
export function panelControlledBy(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute("aria-controls");
  if (!id) {
    return null;
  }
  const element = document.getElementById(id);
  return element instanceof HTMLElement ? element : null;
}
