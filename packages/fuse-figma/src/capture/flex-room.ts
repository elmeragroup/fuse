/**
 * The room a flex line leaves along its direction past its items and the gaps between them, as the
 * capture's page function measures it for the facts `freeAlongMain` and `fitsAlongMain`, which say
 * whether the auto margins along the line take room and whether its items fit it. The page calls
 * `roomAlong` on each flex container whose items hold auto margins along its direction, in every
 * mode it stamps, and compares the least reading with each fact's clearance. The function is passed
 * to the page as its source, so it reads nothing outside its own body and the helpers it is handed.
 */

/** One auto margin of a flex container's item along the container's direction. */
type AutoMargin = { readonly child: Element; readonly side: string };

/** The helpers the page hands {@link roomAlong}. */
type PageHelpers = {
  /** Writes styles for a measure and puts them back. */
  readonly withStyles: (
    writes: readonly (readonly [Element, string, string])[],
    measure: () => number
  ) => number;
  /** The auto margins of a flex container's items along its direction. */
  readonly autoMargins: (element: Element) => readonly AutoMargin[];
  /** Whether an element sits in its parent's flow. */
  readonly inFlow: (element: Element) => boolean;
};

/**
 * Read the room a flex line leaves along its direction once the auto margins along it give their
 * room back. A box that is no single-line flex container in the mode it measures has no such room,
 * since auto margins take the room of each line on its own (CSS Flexbox 1 §9.5). The line packs its
 * items at its start while it measures, since the auto margins take the free space before
 * `justify-content` could move them (CSS Flexbox 1 §8.1). Runs in the page.
 *
 * @param element - The flex container.
 * @param helpers - What the page hands in.
 * @returns The room in CSS pixels, or -Infinity for a line in neither direction or a box that is no
 *   single-line flex container.
 */
export function roomAlong(element: Element, helpers: PageHelpers): number {
  const { withStyles, autoMargins, inFlow } = helpers;
  const style = getComputedStyle(element);
  if (!style.display.endsWith("flex") || style.flexWrap !== "nowrap") {
    return -Infinity;
  }
  const row = style.flexDirection === "row";
  if (!row && style.flexDirection !== "column") {
    return -Infinity;
  }
  const writes: (readonly [Element, string, string])[] = [
    [element, "justify-content", "flex-start"],
    ...autoMargins(element).map(({ child, side }) => [child, "margin-" + side, "0px"] as const),
  ];
  return withStyles(writes, () => {
    const box = element.getBoundingClientRect();
    const px = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const end = row
      ? box.right - px("border-right-width") - px("padding-right")
      : box.bottom - px("border-bottom-width") - px("padding-bottom");
    const used = Math.max(
      ...[...element.children].filter(inFlow).map((child) => {
        const edges = child.getBoundingClientRect();
        const after =
          Number.parseFloat(
            getComputedStyle(child).getPropertyValue(row ? "margin-right" : "margin-bottom")
          ) || 0;
        return (row ? edges.right : edges.bottom) + after;
      })
    );
    return end - used;
  });
}
