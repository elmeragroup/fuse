/**
 * The DOM readers the pie browser suites share. Slices, the centre and the labels are aria-hidden
 * plot output, so their slots are the only locators.
 */
import { page } from "vitest/browser";

import { nextFrames } from "../animation-frames";

/** The pie's drawn slices, in sweep order. */
export function sectors(host: HTMLElement): SVGPathElement[] {
  // Slices are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<SVGPathElement>('[data-slot="pie-chart-sector"]')];
}

/** The figure a polar Root renders. */
export function polarFigure(host: HTMLElement): HTMLElement {
  // Every polar Root marks its figure with data-polar.
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
 * The text a centre part shows, as the formatter wrote it: each digit reel's digit and every other
 * character as it is, then the unit after a no-break space.
 *
 * @param part - The part, such as `pie-chart-center-value`.
 * @param host - The rendered chart's host.
 * @returns The shown text, empty for an empty part.
 */
export function centreText(host: HTMLElement, part: string): string {
  // The centre is aria-hidden plot output, read by its slot.
  const element = host.querySelector(`[data-slot="${part}"]`);
  if (element === null) throw new Error(`no ${part}`);
  const digits = element.querySelector('[data-part="digits"]');
  if (digits === null) return "";
  const number = [...digits.children]
    .map((child) => {
      const reel = child.querySelector<HTMLElement>('[data-part="reel"]');
      return reel === null ? child.textContent : reel.style.getPropertyValue("--_digit");
    })
    .join("");
  // A value lays its unit apart, on the side the formatter wrote it, so it can wrap, and the
  // formatter joins the two by a no-break space.
  const unit = element.querySelector('[data-part="unit"]');
  if (unit === null) return number;
  const before = (unit.compareDocumentPosition(digits) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  return before ? `${unit.textContent}\u00a0${number}` : `${number}\u00a0${unit.textContent}`;
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
  // The pie layer is aria-hidden plot output.
  const svg = host.querySelector<SVGSVGElement>('[data-slot="pie-chart-pie"]');
  if (svg === null) throw new Error("no pie");
  return svg;
}

/** Dispatch a mouse pointer move onto the listbox at a client point, at once. */
function moveAt(x: number, y: number): void {
  page
    .getByRole("listbox")
    .element()
    .dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" })
    );
}

/** Dispatch a pointer move onto the listbox at a client point and wait one frame. */
export async function hoverAt(x: number, y: number): Promise<void> {
  moveAt(x, y);
  await nextFrames(1);
}

/** A radial chart's value rings, first outermost. */
export function rings(host: HTMLElement): SVGPathElement[] {
  // Rings are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<SVGPathElement>('[data-slot="radial-chart-ring"]:not([data-part])')];
}

/** The radial chart's SVG, the layer that holds its rings. */
export function radialSvg(host: HTMLElement): SVGSVGElement {
  // The ring layer is aria-hidden plot output.
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
