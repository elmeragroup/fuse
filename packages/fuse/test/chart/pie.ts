/**
 * The DOM readers the pie browser suites share. Slices, the centre and the labels are aria-hidden
 * plot output, so their slots are the only locators.
 */
import { page } from "vitest/browser";

/** The pie's drawn slices, in sweep order. */
export function sectors(host: HTMLElement): SVGPathElement[] {
  // DOM audit: slices are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<SVGPathElement>('[data-slot="pie-chart-sector"]')];
}

/** The figure a polar Root renders. */
export function polarFigure(host: HTMLElement): HTMLElement {
  // DOM audit: every polar Root marks its figure with data-polar.
  const figure = host.querySelector<HTMLElement>("[data-polar]");
  if (figure === null) throw new Error("no polar figure");
  return figure;
}

/** The active option's place, as Root writes it for the slices, or null with nothing active. */
export function activeSlice(host: HTMLElement): number | null {
  const value = polarFigure(host).style.getPropertyValue("--chart-active");
  return value === "" ? null : Number(value);
}

/**
 * The text a centre part shows: each digit reel's digit and every other character as it is.
 *
 * @param part - The part, such as `pie-chart-center-value`.
 * @param host - The rendered chart's host.
 * @returns The shown text, empty for an empty part.
 */
export function centreText(host: HTMLElement, part: string): string {
  // DOM audit: the centre is aria-hidden plot output, read by its slot.
  const element = host.querySelector(`[data-slot="${part}"]`);
  if (element === null) throw new Error(`no ${part}`);
  const digits = element.querySelector('[data-part="digits"]');
  if (digits === null) return "";
  return [...digits.children]
    .map((child) => {
      const reel = child.querySelector<HTMLElement>('[data-part="reel"]');
      return reel === null ? child.textContent : reel.style.getPropertyValue("--_digit");
    })
    .join("");
}

/** A point in the dial's units, from the centre, as client pixels over the pie's SVG. */
export function clientPoint(svg: SVGSVGElement, x: number, y: number): readonly [number, number] {
  const matrix = svg.getScreenCTM();
  if (matrix === null) throw new Error("no screen transform");
  const point = new DOMPoint(x, y).matrixTransform(matrix);
  return [point.x, point.y];
}

/** The pie's SVG, the layer that holds its slices. */
export function pieSvg(host: HTMLElement): SVGSVGElement {
  // DOM audit: the pie layer is aria-hidden plot output.
  const svg = host.querySelector<SVGSVGElement>('[data-slot="pie-chart-pie"]');
  if (svg === null) throw new Error("no pie");
  return svg;
}

/** Dispatch a pointer move onto the listbox at a client point and wait one frame. */
export async function hoverAt(x: number, y: number): Promise<void> {
  const surface = page.getByRole("listbox").element();
  surface.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" })
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * The outer arc's start and end angles of a slice path that d3's arc wrote with no pad and no
 * corner, in degrees from 12 o'clock, clockwise, or null for a path that draws nothing.
 *
 * @param d - The path data.
 * @returns The start and the end, the end unwrapped to lie after the start.
 */
export function outerArc(d: string): readonly [number, number] | null {
  const numbers = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gu) ?? []).map(Number);
  // M x0,y0 A r,r,rotation,large,sweep,x1,y1: the arc's start, then its end.
  const [x0, y0, , , , large, , x1, y1] = numbers;
  if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) return null;
  const angle = (x: number, y: number) => ((((Math.atan2(x, -y) * 180) / Math.PI) % 360) + 360) % 360;
  const start = angle(x0, y0);
  let end = angle(x1, y1);
  if (end < start || (end === start && large === 1)) end += 360;
  return [start, end];
}

/** A radial chart's value rings, first outermost. */
export function rings(host: HTMLElement): SVGPathElement[] {
  // DOM audit: rings are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<SVGPathElement>('[data-slot="radial-chart-ring"]:not([data-part])')];
}

/** The radial chart's SVG, the layer that holds its rings. */
export function radialSvg(host: HTMLElement): SVGSVGElement {
  // DOM audit: the ring layer is aria-hidden plot output.
  const svg = host.querySelector<SVGSVGElement>('[data-slot="radial-chart-bar"]');
  if (svg === null) throw new Error("no rings");
  return svg;
}

/** A point at an angle and a radius in the dial's units, x right and y down. */
export function dialPoint(angle: number, radius: number): DOMPoint {
  const radians = (angle * Math.PI) / 180;
  const round = (value: number) => Math.round(value * 1e9) / 1e9;
  return new DOMPoint(round(radius * Math.sin(radians)), round(-radius * Math.cos(radians)));
}
