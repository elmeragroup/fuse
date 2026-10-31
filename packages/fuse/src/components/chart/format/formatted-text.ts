import { canonicalSpaces } from "../../../intl/canonical-spaces";

/**
 * A label in two forms. Screen readers read `spoken`, and every visual place shows `text`.
 *
 * @beta
 */
export type FormattedText = {
  /** The visual label, such as `−0,05 kr/kWh`. */
  readonly text: string;
  /** The label a speech engine reads, such as `minus 0,05 norske kroner per kilowattime`. */
  readonly spoken: string;
};

/**
 * Where a label appears. A `tick` is the short axis form. A `full` label appears in tooltips, aria
 * text and tables, and carries the VAT basis of a price and the zone of a repeated hour.
 */
export type LabelRole = "tick" | "full";

/**
 * Build a {@link FormattedText} with canonical spaces in both forms.
 *
 * @param text - The visual label.
 * @param spoken - The spoken label.
 * @returns Both labels with every space written as U+00A0.
 */
export function makeFormattedText(text: string, spoken: string): FormattedText {
  return { text: canonicalSpaces(text), spoken: canonicalSpaces(spoken) };
}
