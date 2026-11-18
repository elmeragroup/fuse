/**
 * Whether a label's manifest text is the text the browser rendered. A manifest gives each label its
 * copy by hand, the TEXT property's default or the characters a cell shows, and the kit draws that
 * copy, so a label whose copy differs from the text the capture recorded for its element in the cell
 * would show text the component never renders (#779), as a Date field's day once read `5` where the
 * browser renders `05`.
 *
 * The text compares as the label's own white space rules render it (CSS Text 3 §4.1.1), since a
 * Figma text keeps every character as written:
 *
 * - `white-space-collapse: collapse`, as `normal` and `nowrap` set it, folds each run of spaces, tabs
 *   and line feeds into one space and drops the spaces at the text's ends.
 * - `preserve-breaks`, as `pre-line` sets it, folds runs of spaces and tabs, drops the spaces beside a
 *   line feed and keeps the line feed.
 * - `preserve` and `break-spaces`, as `pre`, `pre-wrap` and `break-spaces` set them, keep every
 *   character.
 *
 * Only those characters are white space here, so a no-break space (U+00A0) stays one. A control's
 * value or placeholder renders every space it holds, so text from an attribute compares as it is.
 *
 * A label none of whose text paints, under `visibility: hidden` or `collapse` (CSS 2.1 §11.2), has a
 * hidden layer in Figma, so its copy may differ, as an outside calendar day's hidden button holds its
 * own date while the set keeps its `Day` property's one default. A painted label whose text the
 * capture cannot resolve fails, since nothing then shows its copy is right.
 */
import type { CapturedText } from "./box-cascade";
import { KitUnmappable } from "./build-errors";
import { normalizeCss } from "./css-values";
import type { LayerStyle } from "./layer-style";

/**
 * Text nodes' characters as the label's white space rules render them, as the module doc says.
 *
 * @param text - The characters the capture recorded.
 * @param collapse - The label's resolved `white-space-collapse`.
 * @returns The characters the browser shows.
 */
function rendered(text: string, collapse: string): string {
  if (collapse === "preserve" || collapse === "break-spaces") {
    return text;
  }
  if (collapse === "preserve-breaks") {
    return text
      .replaceAll(/[ \t]+/gu, " ")
      .replaceAll(/ ?\n ?/gu, "\n")
      .replaceAll(/^ +| +$/gu, "");
  }
  return text.replaceAll(/[ \t\n]+/gu, " ").replaceAll(/^ +| +$/gu, "");
}

/**
 * Fail where a painted label shows characters other than the text the capture recorded for it, or
 * where the capture holds no text for it.
 *
 * @param style - The style the label maps from, whose `white-space-collapse` the text renders by.
 * @param characters - The characters the label shows in the cell, as its manifest gives them.
 * @param captured - The text the capture recorded for the label in the cell.
 * @param where - The variant's key, set and cell, and the keys of the layers down to the label.
 * @throws `KitUnmappable` naming the variant, the label and both texts where they differ, or why the
 *   capture holds no text for a painted label.
 */
export function checkLabelText(
  style: LayerStyle,
  characters: string,
  captured: CapturedText,
  where: { readonly variant: string; readonly path: readonly string[] }
): void {
  const label = `${where.variant}: the label ${where.path.join("/")}`;
  if (captured._tag === "Hidden") {
    return;
  }
  if (captured._tag === "Unresolved") {
    throw new KitUnmappable({ message: `${label} shows "${characters}", and ${captured.reason}` });
  }
  const shown =
    captured.source === "attribute"
      ? captured.text
      : rendered(captured.text, normalizeCss(style.resolved("white-space-collapse") ?? "collapse"));
  if (shown !== characters) {
    throw new KitUnmappable({
      message: `${label} shows ${JSON.stringify(characters)}, where the browser renders ${JSON.stringify(shown)}`,
    });
  }
}
