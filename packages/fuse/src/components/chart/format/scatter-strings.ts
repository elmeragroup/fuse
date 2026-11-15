/**
 * The scatter family's own words in the four locales. They live apart from `CHART_STRINGS`, so a
 * cartesian route ships none of them. The point word that a scatter and a live line chart both count
 * with is in `point-words.ts`, so a live line route ships none of these.
 */
import type { SupportedLocale } from "../../../intl/locale-context";

/** The words only a scatter Root and its Table read. */
export type ScatterStrings = {
  /** A scatter series' sentence: its label, its point count and its x and y ranges. */
  readonly scatterSeries: (label: string, count: string, x: string, y: string) => string;
  /** The x values' name in a scatter readout when Root has no `xLabel`. */
  readonly xValue: string;
  /** The y values' name in a scatter readout when Root has no `yLabel`. */
  readonly yValue: string;
  /** The series column's header in a scatter table. */
  readonly seriesHeader: string;
};

const NB_NO: ScatterStrings = {
  scatterSeries: (label, count, x, y) => `${label}: ${count}, ${x}, ${y}.`,
  xValue: "x-verdi",
  yValue: "y-verdi",
  seriesHeader: "Serie",
};

const SV_SE: ScatterStrings = {
  scatterSeries: (label, count, x, y) => `${label}: ${count}, ${x}, ${y}.`,
  xValue: "x-värde",
  yValue: "y-värde",
  seriesHeader: "Serie",
};

const FI_FI: ScatterStrings = {
  scatterSeries: (label, count, x, y) => `${label}: ${count}, ${x}, ${y}.`,
  xValue: "x-arvo",
  yValue: "y-arvo",
  seriesHeader: "Sarja",
};

const EN_US: ScatterStrings = {
  scatterSeries: (label, count, x, y) => `${label}: ${count}, ${x}, ${y}.`,
  xValue: "x value",
  yValue: "y value",
  seriesHeader: "Series",
};

/** The scatter words per locale. */
export const SCATTER_STRINGS = {
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
  "fi-FI": FI_FI,
  "en-US": EN_US,
} as const satisfies { readonly [L in SupportedLocale]: ScatterStrings };
