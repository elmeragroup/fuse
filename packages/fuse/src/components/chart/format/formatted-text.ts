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

/**
 * A formatted value split between its number and its unit, so the two can sit on two lines. `side`
 * says where the formatter wrote the unit: after the number, as in `1 837 kWh`, or before it, as in
 * `NOK 1,386`.
 */
export type NumberAndUnit =
  | { readonly number: string; readonly unit: null }
  | { readonly number: string; readonly unit: string; readonly side: "before" | "after" };

/** A space a formatter writes between a number and its unit: a space, a no-break space or a narrow one. */
const SPACE_LIKE = /[\u0020\u00a0\u202f]/u;

const DIGIT = /[0-9]/u;

/**
 * Split a formatted value at the space-like separator between its number and its unit, so
 * `1 837 kWh` becomes `1 837` and `kWh`, `−0,05 kr/kWh` becomes `−0,05` and `kr/kWh`, and
 * `NOK 1,386` becomes `NOK` and `1,386`. A thousands separator has digits on both sides, so it never
 * splits. A value with no unit, or a unit joined to its number, such as `12` or `$1,234`, keeps its
 * text whole. The centre lays the two parts apart so its value can wrap between them; a tooltip, a
 * legend and a table keep the no-break text.
 *
 * @param text - The formatted value.
 * @returns The number and the unit with the unit's side, or the whole text and null.
 */
export function numberAndUnit(text: string): NumberAndUnit {
  const whole = { number: text, unit: null } as const;
  if (!DIGIT.test(text)) return whole;
  const last = lastSpace(text);
  if (last > 0) {
    const unit = text.slice(last + 1);
    const number = text.slice(0, last);
    if (unit !== "" && !DIGIT.test(unit)) return { number, unit, side: "after" };
  }
  const first = firstSpace(text);
  if (first > 0) {
    const unit = text.slice(0, first);
    const number = text.slice(first + 1);
    if (number !== "" && !DIGIT.test(unit)) return { number, unit, side: "before" };
  }
  return whole;
}

function lastSpace(text: string): number {
  for (let index = text.length - 1; index >= 0; index -= 1)
    if (SPACE_LIKE.test(text.charAt(index))) return index;
  return -1;
}

function firstSpace(text: string): number {
  for (let index = 0; index < text.length; index += 1) if (SPACE_LIKE.test(text.charAt(index))) return index;
  return -1;
}
