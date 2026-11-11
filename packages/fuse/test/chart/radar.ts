/**
 * The DOM readers the radar browser suites share. Rings, spokes, series layers and labels are
 * aria-hidden plot output, so their slots are the only locators.
 */

/** Every layer of one slot, such as each series' `radar-chart-line`, in render order. */
export function radarLayers(host: HTMLElement, slot: string): SVGSVGElement[] {
  // Radar layers are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<SVGSVGElement>(`[data-slot="${slot}"]`)];
}

/** The layer of a slot at an index, such as the second series' `radar-chart-area`. */
export function radarLayer(host: HTMLElement, slot: string, index = 0): SVGSVGElement {
  const layer = radarLayers(host, slot)[index];
  if (layer === undefined) throw new Error(`no ${slot} at ${String(index)}`);
  return layer;
}

/** One path of a series layer by its part, such as a Line's "solid" run or its "marked" one. */
export function layerPath(layer: Element | undefined, part: string): SVGPathElement {
  // A layer's paths are named by their part, which the stylesheet styles them by.
  const path = layer?.querySelector<SVGPathElement>(`[data-part="${part}"]`);
  if (path === null || path === undefined) throw new Error(`no ${part} path`);
  return path;
}

/** The points a path of M and L commands visits, in order, each closing Z skipped. */
export function pathPoints(d: string): { readonly x: number; readonly y: number }[] {
  return [...d.matchAll(/[ML](-?[\d.]+(?:e-?\d+)?),(-?[\d.]+(?:e-?\d+)?)/gu)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

/** How many subpaths a path draws, one per M. */
export function subpaths(d: string): number {
  return (d.match(/M/gu) ?? []).length;
}
