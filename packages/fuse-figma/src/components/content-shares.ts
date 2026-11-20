/**
 * A flex row of several layers that grow, as Tabs triggers' `flex-1` in their `w-fit` list. A row
 * that hugs its layers is as wide as their content widths together, as Chromium sizes it, which the
 * capture measured as `itemsAtContent`. Each layer grows from its basis into that width, and none
 * shrinks under its automatic minimum (CSS Flexbox 1 §4.5, §9.7).
 *
 * The layers keep their own content widths, which a hugging Figma layer draws, for any text a
 * designer types into them, where each grows from a zero basis (`flex: 1`), keeps the automatic
 * minimum of its content (`min-width: auto`, with no `width` or `max-width` to lower it) and sets
 * text that does not wrap, so its min-content is its max-content. Their minimums then add up to the
 * row's whole width, so each takes exactly its own, whatever its text. A minimum of zero, a basis of
 * its own, a width, text that wraps, and a row of a width of its own or with a `min-width` or
 * `max-width` let the layers take other widths once the text changes, so their `flex` stays unmapped,
 * and so does every case equal shares draw, which a row of a width of its own takes.
 */
import type { Holder } from "./box-sizing";
import { normalizeCss } from "./css-values";
import type { LayerStyle } from "./layer-style";

/** The `flex` values that grow from a zero basis: `flex: 1` and its longhands spelled out. */
const ZERO_BASIS: ReadonlySet<string> = new Set(["1", "1 1 0%", "1 1 0", "1 1 0px"]);

/**
 * Whether a growing layer keeps its own content width for any text, as the module doc says: it grows
 * from a zero basis, keeps its automatic minimum, and sets text that does not wrap.
 */
function keepsContentWidth(style: LayerStyle): boolean {
  const value = (property: string, initial: string) => normalizeCss(style.resolved(property) ?? initial);
  return (
    ZERO_BASIS.has(value("flex", "")) &&
    !["flex-grow", "flex-shrink", "flex-basis", "width", "max-width"].some((property) =>
      style.has(property)
    ) &&
    value("min-width", "auto") === "auto" &&
    value("text-wrap-mode", "wrap") === "nowrap"
  );
}

/** Why each growing layer's `flex` drops where the capture measured it at its own content width. */
const AT_CONTENT =
  "the row hugs its layers, the capture measured each layer that grows as wide as its own content in every mode, and its zero basis, automatic minimum and unwrapped text keep it there for any text, so it draws hugging its content";

/**
 * Read the `flex` of a hugging row's growing layers where the capture measured each at its own
 * content width, as the module doc says.
 *
 * @param holder - The row.
 * @param growing - The row's layers that set a `flex` that lets them grow.
 * @param itemsAtContent - Whether the capture measured the row's growing items at their content widths.
 * @returns Whether the read placed them.
 */
export function readContentShares(
  holder: Holder,
  growing: readonly LayerStyle[],
  itemsAtContent: boolean
): boolean {
  const { layout, sizing, style } = holder;
  // A limit along the row can leave room past its layers or take room away, as `readGrowth` says.
  const limited = ["min-width", "max-width"].some(
    (property) => !["", "auto", "none", "0", "0px"].includes(normalizeCss(style.resolved(property) ?? ""))
  );
  const applies =
    itemsAtContent &&
    growing.every(keepsContentWidth) &&
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    sizing.horizontal.kind === "hug" &&
    !limited &&
    growing.length > 1;
  if (!applies) {
    return false;
  }
  for (const part of growing) {
    part.read(
      "flex",
      (value) => value,
      () => ({ outcome: "dropped", detail: AT_CONTENT }),
      []
    );
  }
  return true;
}
