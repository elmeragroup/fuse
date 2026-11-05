/**
 * The DOM readers the clock browser suites share. A clock's layers, paths, dots and labels are
 * aria-hidden plot output, so their slots and parts are the only locators.
 */

/** The layer of a slot at an index, such as the second series' `clock-chart-line`. */
export function clockLayer(host: HTMLElement, slot: string, index = 0): SVGSVGElement {
  // DOM audit: clock layers are aria-hidden plot output, so their slot is the only locator.
  const layer = [...host.querySelectorAll<SVGSVGElement>(`[data-slot="${slot}"]`)][index];
  if (layer === undefined) throw new Error(`no ${slot} at ${String(index)}`);
  return layer;
}

/** The path data of a layer's path by its part or its group. */
export function clockPath(layer: Element, name: string): string {
  // DOM audit: a layer's paths are named by their part or their group, which the stylesheet reads.
  const path = layer.querySelector(`path[data-part="${name}"], path[data-group="${name}"]`);
  if (path === null) throw new Error(`no ${name} path`);
  return path.getAttribute("d") ?? "";
}

/** The dial's angle in degrees from 12 o'clock of a point in the dial's units. */
export function angleOf(x: number, y: number): number {
  return ((((Math.atan2(x, -y) * 180) / Math.PI) % 360) + 360) % 360;
}

/** Each zero-length subpath's point, as a dot path draws one per reading. */
export function dotPoints(d: string): { readonly x: number; readonly y: number }[] {
  return [...d.matchAll(/M(-?[\d.]+),(-?[\d.]+)h0/gu)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

/** Each wedge's inner and outer radius, from the two arcs d3 draws for it. */
export function wedgeRadii(d: string): (readonly [number, number])[] {
  return d
    .split("M")
    .filter((part) => part !== "")
    .map((wedge) => {
      const radii = [...wedge.matchAll(/A(-?[\d.]+),/gu)].map((match) => Number(match[1]));
      const outer = Math.max(...radii);
      // A wedge from the centre draws one arc and a line to the centre.
      const inner = radii.length > 1 ? Math.min(...radii) : 0;
      return [inner, outer] as const;
    });
}
