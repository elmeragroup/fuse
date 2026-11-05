/**
 * The polar families' own words in the four locales, drafts until the content owner signs them off
 * with the rest of the chart dictionary (S11). They live apart from `CHART_STRINGS`, so a cartesian
 * route ships none of them.
 */
import type { SupportedLocale } from "../../../intl/locale-context";
import type { Inflected } from "./inflection";

/** The words a polar Root and its Table read. */
export type PolarStrings = {
  /** A pie's or a radial chart's LegendToggleGroup name, which lists categories, not series (S9). */
  readonly categoryGroup: string;
  /** A pie's opening sentence: the family word, the slice count and the total. */
  readonly descriptionPie: (count: string, total: string) => string;
  /** A radial chart's opening sentence: the family word and the ring count. */
  readonly descriptionRadial: (count: string) => string;
  /** A radar chart's opening sentence: the family word, the series count and the category count. */
  readonly descriptionRadar: (series: string, categories: string) => string;
  /** A pie's slice word, counted. */
  readonly slices: Inflected;
  /** A radial chart's ring word, counted. */
  readonly rings: Inflected;
  /** A radar chart's series word, counted. */
  readonly seriesWord: Inflected;
  /** The value column's header in a pie or radial table. */
  readonly valueHeader: string;
  /** The share column's header in a pie table. */
  readonly shareHeader: string;
  /** The maximum column's header in a radial table. */
  readonly maxHeader: string;
};

// oxlint-disable-next-line elmera/no-raw-class-map -- a dictionary, not classes: `ring` is the word for a ring
const NB_NO: PolarStrings = {
  categoryGroup: "Kategorier",
  descriptionPie: (count, total) => `Kakediagram med ${count}, totalt ${total}.`,
  descriptionRadial: (count) => `Ringdiagram med ${count}.`,
  descriptionRadar: (series, categories) => `Radardiagram med ${series} over ${categories}.`,
  slices: { one: "del", other: "deler" },
  rings: { one: "ring", other: "ringer" },
  seriesWord: { one: "serie", other: "serier" },
  valueHeader: "Verdi",
  shareHeader: "Andel",
  maxHeader: "Maksimum",
};

// oxlint-disable-next-line elmera/no-raw-class-map -- a dictionary, not classes: `ring` is the word for a ring
const SV_SE: PolarStrings = {
  categoryGroup: "Kategorier",
  descriptionPie: (count, total) => `Cirkeldiagram med ${count}, totalt ${total}.`,
  descriptionRadial: (count) => `Ringdiagram med ${count}.`,
  descriptionRadar: (series, categories) => `Radardiagram med ${series} över ${categories}.`,
  slices: { one: "del", other: "delar" },
  rings: { one: "ring", other: "ringar" },
  seriesWord: { one: "serie", other: "serier" },
  valueHeader: "Värde",
  shareHeader: "Andel",
  maxHeader: "Maximum",
};

const FI_FI: PolarStrings = {
  categoryGroup: "Luokat",
  descriptionPie: (count, total) => `Ympyräkaavio, ${count}, yhteensä ${total}.`,
  descriptionRadial: (count) => `Rengaskaavio, ${count}.`,
  descriptionRadar: (series, categories) => `Tutkakaavio, ${series}, ${categories}.`,
  slices: { one: "osa", other: "osaa" },
  rings: { one: "rengas", other: "rengasta" },
  seriesWord: { one: "sarja", other: "sarjaa" },
  valueHeader: "Arvo",
  shareHeader: "Osuus",
  maxHeader: "Enimmäisarvo",
};

// oxlint-disable-next-line elmera/no-raw-class-map -- a dictionary, not classes: `ring` is the word for a ring
const EN_US: PolarStrings = {
  categoryGroup: "Categories",
  descriptionPie: (count, total) => `Pie chart with ${count}, ${total} in total.`,
  descriptionRadial: (count) => `Radial chart with ${count}.`,
  descriptionRadar: (series, categories) => `Radar chart with ${series} across ${categories}.`,
  slices: { one: "slice", other: "slices" },
  rings: { one: "ring", other: "rings" },
  seriesWord: { one: "series", other: "series" },
  valueHeader: "Value",
  shareHeader: "Share",
  maxHeader: "Maximum",
};

/** The polar words per locale. */
export const POLAR_STRINGS = {
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
  "fi-FI": FI_FI,
  "en-US": EN_US,
} as const satisfies { readonly [L in SupportedLocale]: PolarStrings };
