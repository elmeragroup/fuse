/**
 * Which of the facts the page measured of an element its own winning declarations bear out. The page
 * reads computed styles, which cannot tell a declared `display` from an initial one, so the capture
 * keeps a fact bound to a display only on an element that declares that display itself.
 */
import type { MeasuredFacts } from "./capture-format.ts";

/**
 * The facts the page measured of an element that its winning declarations bear out. The page takes
 * an item for `inlineRow` where its display is `inline` with its row a block, which is also the
 * initial display of any element no rule displays. The build reads the fact only where the element's
 * own winning `display` is `inline`, so it stays only there.
 *
 * @param measured - What the page measured of the element.
 * @param kept - The element's winning declarations.
 * @returns The facts that stay, or undefined for none.
 */
export function factsOfWinners(
  measured: MeasuredFacts | undefined,
  kept: readonly { readonly property: string; readonly value: string }[]
): MeasuredFacts | undefined {
  if (measured === undefined) {
    return undefined;
  }
  const display = kept.find(({ property }) => property === "display")?.value.trim();
  const { inlineRow, ...rest } = measured;
  const facts: { -readonly [Key in keyof MeasuredFacts]: MeasuredFacts[Key] } = rest;
  if (inlineRow !== undefined && display === "inline") {
    facts.inlineRow = inlineRow;
  }
  return Object.keys(facts).length === 0 ? undefined : facts;
}
