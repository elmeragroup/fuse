/**
 * The DOM readers the Sparkline browser suites share. A Sparkline is one image whose marks are its
 * presentational content, so their slots are the only locators, and its geometry reads as shares of
 * the image's box.
 */
import { page, userEvent } from "vitest/browser";

/**
 * A Sparkline's svg by its role and its whole accessible name.
 *
 * @param name - The name, the generated range sentence included.
 * @returns The svg.
 */
export function imageNamed(name: string): SVGSVGElement {
  const element = page.getByRole("img", { name, exact: true }).element();
  if (!(element instanceof SVGSVGElement)) throw new Error("expected the Sparkline's svg");
  return element;
}

/** A place relative to the image's top left corner, as a share of its width and its height. */
export type Share = { readonly x: number; readonly y: number };

/**
 * The one element a selector matches inside a Sparkline that the page shows, failing while none or
 * several show.
 *
 * @param image - The Sparkline's svg.
 * @param selector - The marks to look among.
 * @returns The one shown element.
 */
export function shownIn(image: SVGSVGElement, selector: string): SVGGraphicsElement {
  const showing = [...image.querySelectorAll(selector)].filter(
    (element) => getComputedStyle(element).display !== "none"
  );
  const [only] = showing;
  if (showing.length !== 1 || !(only instanceof SVGGraphicsElement)) {
    throw new Error(`expected one ${selector} to show, found ${String(showing.length)}`);
  }
  return only;
}

/**
 * Where an element's center sits in a Sparkline, as a share of the image's width and height.
 *
 * @param image - The Sparkline's svg.
 * @param element - A mark inside it.
 * @returns The share.
 */
export function shareIn(image: SVGSVGElement, element: Element): Share {
  const box = image.getBoundingClientRect();
  const own = element.getBoundingClientRect();
  return { x: (own.x + own.width / 2 - box.x) / box.width, y: (own.y + own.height / 2 - box.y) / box.height };
}

/**
 * `shareIn` rounded to hundredths, so a settled glide reads exactly.
 *
 * @param image - The Sparkline's svg.
 * @param element - A mark inside it.
 * @returns The rounded share.
 */
export function placeIn(image: SVGSVGElement, element: Element): Share {
  const { x, y } = shareIn(image, element);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

/**
 * Hover a Sparkline at a share of its width, halfway down.
 *
 * @param image - The Sparkline's svg.
 * @param x - The share of its width.
 */
export async function hoverIn(image: SVGSVGElement, x: number): Promise<void> {
  const box = image.getBoundingClientRect();
  await userEvent.hover(image, { position: { x: box.width * x, y: box.height / 2 } });
}

/** End every animation the stylesheet runs, such as the entrance and the hover fades. */
export function settleStylesheet(): void {
  for (const animation of document.getAnimations()) {
    if (animation instanceof CSSAnimation || animation instanceof CSSTransition) animation.finish();
  }
}
