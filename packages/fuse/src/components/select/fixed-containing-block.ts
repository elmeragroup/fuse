/**
 * Whether `position: fixed` content placed inside `container` resolves against the viewport.
 *
 * Measured, not read from computed styles: which properties make an ancestor the containing
 * block of fixed content has changed across the CSS specifications and differs between engines.
 * Query containers no longer do; `content-visibility: auto` does without changing `contain`. Two
 * zero-size fixed probes pinned to opposite corners land on the viewport's origin and far corner
 * exactly when the viewport is their containing block. The origin alone is not enough: Base UI's
 * item alignment can pin a long list with `bottom: 0`, which a shorter block at the origin would
 * resolve against its own bottom. The probes use physical insets so a right-to-left scope still
 * pins them to those corners. It forces a layout, so call it outside render and not per frame.
 */
export function fixedPositionsAgainstViewport(container: Element): boolean {
  const document = container.ownerDocument;
  const origin = fixedProbe(document, "top: 0; left: 0");
  const corner = fixedProbe(document, "bottom: 0; right: 0");
  container.append(origin, corner);
  const start = origin.getBoundingClientRect();
  const end = corner.getBoundingClientRect();
  origin.remove();
  corner.remove();
  const { clientWidth, clientHeight } = document.documentElement;
  // `clientWidth` and `clientHeight` round to whole pixels; a zoomed viewport can measure a
  // fraction off them.
  return (
    start.left === 0 &&
    start.top === 0 &&
    Math.abs(end.right - clientWidth) < 1 &&
    Math.abs(end.bottom - clientHeight) < 1
  );
}

function fixedProbe(document: Document, insets: string): HTMLElement {
  const probe = document.createElement("div");
  probe.style.cssText = `position: fixed; ${insets}; width: 0; height: 0; visibility: hidden; pointer-events: none`;
  return probe;
}
