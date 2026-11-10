/**
 * A series' or a category's name from config, which every chart family prints and speaks. The
 * module calls no hook, so the server reads it too.
 */
import type { ChartConfig } from "../chart-types";
import type { FormattedText } from "./formatted-text";

/**
 * A series' name. A plain string reads verbatim in both forms, and a `FormattedText` keeps its
 * spoken form for options, the description and the table.
 *
 * @param text - Anything that holds the Root's config.
 * @param key - A config key.
 * @returns The visual and spoken name, the key itself for a key the config lacks.
 */
export function seriesLabel(text: { readonly config: ChartConfig }, key: string): FormattedText {
  const label = text.config[key]?.label ?? key;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a config label is a string or a FormattedText
  return typeof label === "string" ? { text: label, spoken: label } : label;
}
