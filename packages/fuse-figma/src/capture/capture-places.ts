/**
 * The places of a captured cell's elements, as the build's coverage accounting and its record of
 * drawn parts name them: the measured root's index, then `around/` and the element's index among the
 * elements around it, outermost first, or `root` and the element child index at each step down, as
 * `0/root/1/0`. `figma:probe` names the boxes it measures the same way.
 */
import type { CapturedCell, CapturedElement } from "./capture-format.ts";

/**
 * Each captured element of a cell by its place, as the module comment names places.
 *
 * @param cell - The captured cell.
 * @returns Each element's place.
 */
export function placesOf(cell: CapturedCell): Map<CapturedElement, string> {
  const places = new Map<CapturedElement, string>();
  const below = (element: CapturedElement, place: string): void => {
    places.set(element, place);
    element.children.forEach((child, index) => {
      below(child, `${place}/${String(index)}`);
    });
  };
  cell.roots.forEach(({ around, root }, index) => {
    around.forEach((element, at) => places.set(element, `${String(index)}/around/${String(at)}`));
    below(root, `${String(index)}/root`);
  });
  return places;
}
