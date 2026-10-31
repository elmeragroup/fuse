import { numberFormat } from "../../../internal/intl-cache";
/**
 * The chart dictionary of CONTRACT section 12, in four locales. Every string is a draft that the
 * owner or the content owner signs off, as `TODO.md` lists. An explicit prop replaces its string
 * verbatim. The module calls no hook, so a server component reads it too.
 */
import { canonicalSpaces } from "../../../intl/canonical-spaces";
import type { SupportedLocale } from "../../../intl/locale-context";
import { inflect } from "./inflection";
import type { Inflected } from "./inflection";
import type { Interval } from "./time-format";

/** One locale's chart strings. */
export type ChartStrings = {
  readonly surfaceName: (name: string) => string;
  readonly allSeries: string;
  readonly seriesGroup: string;
  readonly instructionsCartesian: string;
  readonly instructionsPolar: string;
  readonly selected: (label: string) => string;
  readonly selectionCleared: string;
  readonly estimated: string;
  readonly corrected: string;
  readonly missing: string;
  readonly pending: string;
  readonly incomplete: string;
  readonly projected: string;
  readonly emphasised: string;
  readonly now: string;
  readonly descriptionNow: (x: string) => string;
  readonly total: string;
  readonly referenceLine: (value: string) => string;
  readonly referenceArea: (value: string) => string;
  readonly valueRange: (from: string, to: string) => string;
  readonly other: string;
  readonly otherCount: (count: string) => string;
  readonly ofMax: (value: string, max: string) => string;
  readonly showTable: string;
  readonly hideTable: string;
  readonly pageStatus: (page: string, count: string, period: string) => string;
  readonly rowRange: (from: string, to: string) => string;
  readonly xHeaderTime: string;
  readonly xHeaderDay: string;
  readonly xHeaderWeek: string;
  readonly xHeaderMonth: string;
  readonly xHeaderYear: string;
  readonly xHeaderCategory: string;
  readonly brushGroup: string;
  readonly brushStart: string;
  readonly brushEnd: string;
  readonly brushWindow: string;
  readonly brushRange: (from: string, to: string) => string;
  readonly brushWindowValue: (from: string, to: string) => string;
  readonly loading: string;
  readonly noData: string;
  readonly sparklineRange: (min: string, max: string) => string;
  readonly sparklineRangeAt: (min: string, minAt: string, max: string, maxAt: string) => string;
  /** The span sentence of a cartesian description, such as `Fra søndag 26. oktober, 25 timer.` */
  readonly descriptionSpan: (from: string, to: string | undefined, count: string) => string;
  /** One series' extremes, such as `Forbruk i kilowattimer: lavest 0,33 kl. 03 til 04, høyest …` */
  readonly descriptionSeries: (
    label: string,
    low: string,
    lowAt: string,
    high: string,
    highAt: string
  ) => string;
  /**
   * A series or stack label with its spoken unit, which the description states once before the
   * unitless extremes, such as `Forbruk i kilowattimer`.
   */
  readonly descriptionLabel: (label: string, unit: string) => string;
  /** One stack's extremes, built like a series sentence on the stack's total. */
  readonly descriptionStack: (
    label: string,
    low: string,
    lowAt: string,
    high: string,
    highAt: string
  ) => string;
  /** A count of non-measured readings, such as `2 timer mangler.` */
  readonly descriptionQuality: (count: string, state: "missing" | "estimated" | "corrected") => string;
  /** Where a projection starts, such as `Forbruk er prognose fra 17. oktober.` */
  readonly descriptionProjection: (label: string, from: string) => string;
  /** The interval's slot words, counted. */
  readonly slots: { readonly [I in Interval | "category"]: Inflected };
};

const NB_NO: ChartStrings = {
  surfaceName: (name) => `${name}, datapunkter`,
  allSeries: "Alle serier",
  seriesGroup: "Serier",
  instructionsCartesian:
    "Bruk venstre og høyre pil for å gå mellom punktene, og opp og ned for å velge serie.",
  instructionsPolar: "Bruk piltastene for å gå mellom delene.",
  selected: (label) => `${label} valgt`,
  selectionCleared: "Ingen serie valgt",
  estimated: "estimert",
  corrected: "korrigert",
  missing: "mangler",
  pending: "ingen data ennå",
  incomplete: "ufullstendig",
  projected: "prognose",
  emphasised: "uthevet",
  now: "nå",
  descriptionNow: (x) => `Nå: ${x}.`,
  total: "Totalt",
  referenceLine: (value) => `Referanselinje: ${value}`,
  referenceArea: (value) => `Område: ${value}`,
  valueRange: (from, to) => `${from} til ${to}`,
  other: "Annet",
  otherCount: (count) => `${count} kategorier`,
  ofMax: (value, max) => `${value} av ${max}`,
  showTable: "Vis som tabell",
  hideTable: "Skjul tabell",
  pageStatus: (page, count, period) => `Side ${page} av ${count} · ${period}`,
  rowRange: (from, to) => `Rad ${from} til ${to}`,
  xHeaderTime: "Tidspunkt",
  xHeaderDay: "Dag",
  xHeaderWeek: "Uke",
  xHeaderMonth: "Måned",
  xHeaderYear: "År",
  xHeaderCategory: "Kategori",
  brushGroup: "Periode",
  brushStart: "fra",
  brushEnd: "til",
  brushWindow: "Flytt periode",
  brushRange: (from, to) => `Viser ${from} til ${to}`,
  brushWindowValue: (from, to) => `fra ${from} til og med ${to}`,
  loading: "Laster diagram",
  noData: "Ingen data for perioden",
  sparklineRange: (min, max) => `Lavest ${min}, høyest ${max}.`,
  sparklineRangeAt: (min, minAt, max, maxAt) => `Lavest ${min} ${minAt}, høyest ${max} ${maxAt}.`,
  descriptionSpan: (from, to, count) =>
    to === undefined ? `${from}, ${count}.` : `Fra ${from} til ${to}, ${count}.`,
  descriptionSeries: (label, low, lowAt, high, highAt) =>
    `${label}: lavest ${low} ${lowAt}, høyest ${high} ${highAt}.`,
  descriptionLabel: (label, unit) => `${label} i ${unit}`,
  descriptionStack: (label, low, lowAt, high, highAt) =>
    `${label}: lavest ${low} ${lowAt}, høyest ${high} ${highAt}.`,
  descriptionQuality: (count, state) =>
    `${count} ${state === "missing" ? "mangler" : state === "estimated" ? "er estimert" : "er korrigert"}.`,
  descriptionProjection: (label, from) => `${label} er prognose fra ${from}.`,
  slots: {
    second: { one: "sekund", other: "sekunder" },
    minute: { one: "minutt", other: "minutter" },
    "quarter-hour": { one: "kvarter", other: "kvarter" },
    hour: { one: "time", other: "timer" },
    day: { one: "dag", other: "dager" },
    week: { one: "uke", other: "uker" },
    month: { one: "måned", other: "måneder" },
    year: { one: "år", other: "år" },
    category: { one: "kategori", other: "kategorier" },
  },
};

const SV_SE: ChartStrings = {
  surfaceName: (name) => `${name}, datapunkter`,
  allSeries: "Alla serier",
  seriesGroup: "Serier",
  instructionsCartesian:
    "Använd vänster- och högerpil för att gå mellan punkterna, och upp och ner för att välja serie.",
  instructionsPolar: "Använd piltangenterna för att gå mellan delarna.",
  selected: (label) => `${label} vald`,
  selectionCleared: "Ingen serie vald",
  estimated: "uppskattad",
  corrected: "korrigerad",
  missing: "saknas",
  pending: "inga data ännu",
  incomplete: "ofullständig",
  projected: "prognos",
  emphasised: "framhävd",
  now: "nu",
  descriptionNow: (x) => `Nu: ${x}.`,
  total: "Totalt",
  referenceLine: (value) => `Referenslinje: ${value}`,
  referenceArea: (value) => `Område: ${value}`,
  valueRange: (from, to) => `${from} till ${to}`,
  other: "Övrigt",
  otherCount: (count) => `${count} kategorier`,
  ofMax: (value, max) => `${value} av ${max}`,
  showTable: "Visa som tabell",
  hideTable: "Dölj tabell",
  pageStatus: (page, count, period) => `Sida ${page} av ${count} · ${period}`,
  rowRange: (from, to) => `Rad ${from} till ${to}`,
  xHeaderTime: "Tidpunkt",
  xHeaderDay: "Dag",
  xHeaderWeek: "Vecka",
  xHeaderMonth: "Månad",
  xHeaderYear: "År",
  xHeaderCategory: "Kategori",
  brushGroup: "Period",
  brushStart: "från",
  brushEnd: "till",
  brushWindow: "Flytta period",
  brushRange: (from, to) => `Visar ${from} till ${to}`,
  brushWindowValue: (from, to) => `från ${from} till och med ${to}`,
  loading: "Laddar diagram",
  noData: "Ingen data för perioden",
  sparklineRange: (min, max) => `Lägst ${min}, högst ${max}.`,
  sparklineRangeAt: (min, minAt, max, maxAt) => `Lägst ${min} ${minAt}, högst ${max} ${maxAt}.`,
  descriptionSpan: (from, to, count) =>
    to === undefined ? `${from}, ${count}.` : `Från ${from} till ${to}, ${count}.`,
  descriptionSeries: (label, low, lowAt, high, highAt) =>
    `${label}: lägst ${low} ${lowAt}, högst ${high} ${highAt}.`,
  descriptionLabel: (label, unit) => `${label} i ${unit}`,
  descriptionStack: (label, low, lowAt, high, highAt) =>
    `${label}: lägst ${low} ${lowAt}, högst ${high} ${highAt}.`,
  descriptionQuality: (count, state) =>
    `${count} ${state === "missing" ? "saknas" : state === "estimated" ? "är uppskattade" : "är korrigerade"}.`,
  descriptionProjection: (label, from) => `${label} är prognos från ${from}.`,
  slots: {
    second: { one: "sekund", other: "sekunder" },
    minute: { one: "minut", other: "minuter" },
    "quarter-hour": { one: "kvart", other: "kvartar" },
    hour: { one: "timme", other: "timmar" },
    day: { one: "dag", other: "dagar" },
    week: { one: "vecka", other: "veckor" },
    month: { one: "månad", other: "månader" },
    year: { one: "år", other: "år" },
    category: { one: "kategori", other: "kategorier" },
  },
};

const FI_FI: ChartStrings = {
  surfaceName: (name) => `${name}, datapisteet`,
  allSeries: "Kaikki sarjat",
  seriesGroup: "Sarjat",
  instructionsCartesian:
    "Siirry pisteestä toiseen vasemmalla ja oikealla nuolella. Valitse sarja ylä- ja alanuolella.",
  instructionsPolar: "Siirry osasta toiseen nuolinäppäimillä.",
  selected: (label) => `${label} valittu`,
  selectionCleared: "Ei valittua sarjaa",
  estimated: "arvioitu",
  corrected: "korjattu",
  missing: "puuttuu",
  pending: "ei vielä tietoja",
  incomplete: "epätäydellinen",
  projected: "ennuste",
  emphasised: "korostettu",
  now: "nyt",
  descriptionNow: (x) => `Nyt: ${x}.`,
  total: "Yhteensä",
  referenceLine: (value) => `Viiteviiva: ${value}`,
  referenceArea: (value) => `Alue: ${value}`,
  valueRange: (from, to) => `${from}–${to}`,
  other: "Muut",
  otherCount: (count) => `${count} luokkaa`,
  ofMax: (value, max) => `${value} / ${max}`,
  showTable: "Näytä taulukkona",
  hideTable: "Piilota taulukko",
  pageStatus: (page, count, period) => `Sivu ${page}/${count} · ${period}`,
  rowRange: (from, to) => `Rivit ${from}–${to}`,
  xHeaderTime: "Ajankohta",
  xHeaderDay: "Päivä",
  xHeaderWeek: "Viikko",
  xHeaderMonth: "Kuukausi",
  xHeaderYear: "Vuosi",
  xHeaderCategory: "Luokka",
  brushGroup: "Jakso",
  brushStart: "alku",
  brushEnd: "loppu",
  brushWindow: "Siirrä jaksoa",
  brushRange: (from, to) => `Näytetään ${from}–${to}`,
  brushWindowValue: (from, to) => `${from}–${to}`,
  loading: "Ladataan kaaviota",
  noData: "Ei tietoja jaksolta",
  sparklineRange: (min, max) => `Alin ${min}, korkein ${max}.`,
  sparklineRangeAt: (min, minAt, max, maxAt) => `Alin ${min} ${minAt}, korkein ${max} ${maxAt}.`,
  descriptionSpan: (from, to, count) =>
    to === undefined ? `${from}, ${count}.` : `${from} – ${to}, ${count}.`,
  descriptionSeries: (label, low, lowAt, high, highAt) =>
    `${label}: alin ${low} ${lowAt}, korkein ${high} ${highAt}.`,
  descriptionLabel: (label, unit) => `${label}, ${unit}`,
  descriptionStack: (label, low, lowAt, high, highAt) =>
    `${label}: alin ${low} ${lowAt}, korkein ${high} ${highAt}.`,
  descriptionQuality: (count, state) =>
    `${count} ${state === "missing" ? "puuttuu" : state === "estimated" ? "on arvioitu" : "on korjattu"}.`,
  descriptionProjection: (label, from) => `${label} on ennuste alkaen ${from}.`,
  slots: {
    second: { one: "sekunti", other: "sekuntia" },
    minute: { one: "minuutti", other: "minuuttia" },
    "quarter-hour": { one: "vartti", other: "varttia" },
    hour: { one: "tunti", other: "tuntia" },
    day: { one: "päivä", other: "päivää" },
    week: { one: "viikko", other: "viikkoa" },
    month: { one: "kuukausi", other: "kuukautta" },
    year: { one: "vuosi", other: "vuotta" },
    category: { one: "luokka", other: "luokkaa" },
  },
};

const EN_US: ChartStrings = {
  surfaceName: (name) => `${name}, data points`,
  allSeries: "All series",
  seriesGroup: "Series",
  instructionsCartesian:
    "Use the left and right arrows to move between points, and up and down to choose a series.",
  instructionsPolar: "Use the arrow keys to move between parts.",
  selected: (label) => `${label} selected`,
  selectionCleared: "No series selected",
  estimated: "estimated",
  corrected: "corrected",
  missing: "missing",
  pending: "no data yet",
  incomplete: "incomplete",
  projected: "projected",
  emphasised: "highlighted",
  now: "now",
  descriptionNow: (x) => `Now: ${x}.`,
  total: "Total",
  referenceLine: (value) => `Reference line: ${value}`,
  referenceArea: (value) => `Range: ${value}`,
  valueRange: (from, to) => `${from} to ${to}`,
  other: "Other",
  otherCount: (count) => `${count} categories`,
  ofMax: (value, max) => `${value} of ${max}`,
  showTable: "Show as table",
  hideTable: "Hide table",
  pageStatus: (page, count, period) => `Page ${page} of ${count} · ${period}`,
  rowRange: (from, to) => `Rows ${from} to ${to}`,
  xHeaderTime: "Time",
  xHeaderDay: "Day",
  xHeaderWeek: "Week",
  xHeaderMonth: "Month",
  xHeaderYear: "Year",
  xHeaderCategory: "Category",
  brushGroup: "Period",
  brushStart: "start",
  brushEnd: "end",
  brushWindow: "Move period",
  brushRange: (from, to) => `Showing ${from} to ${to}`,
  brushWindowValue: (from, to) => `from ${from} through ${to}`,
  loading: "Loading chart",
  noData: "No data for the period",
  sparklineRange: (min, max) => `Lowest ${min}, highest ${max}.`,
  sparklineRangeAt: (min, minAt, max, maxAt) => `Lowest ${min} ${minAt}, highest ${max} ${maxAt}.`,
  descriptionSpan: (from, to, count) =>
    to === undefined ? `${from}, ${count}.` : `From ${from} to ${to}, ${count}.`,
  descriptionSeries: (label, low, lowAt, high, highAt) =>
    `${label}: lowest ${low} ${lowAt}, highest ${high} ${highAt}.`,
  descriptionLabel: (label, unit) => `${label} in ${unit}`,
  descriptionStack: (label, low, lowAt, high, highAt) =>
    `${label}: lowest ${low} ${lowAt}, highest ${high} ${highAt}.`,
  descriptionQuality: (count, state) =>
    `${count} ${state === "missing" ? "missing" : state === "estimated" ? "estimated" : "corrected"}.`,
  descriptionProjection: (label, from) => `${label} is projected from ${from}.`,
  slots: {
    second: { one: "second", other: "seconds" },
    minute: { one: "minute", other: "minutes" },
    "quarter-hour": { one: "quarter-hour", other: "quarter-hours" },
    hour: { one: "hour", other: "hours" },
    day: { one: "day", other: "days" },
    week: { one: "week", other: "weeks" },
    month: { one: "month", other: "months" },
    year: { one: "year", other: "years" },
    category: { one: "category", other: "categories" },
  },
};

/** The chart strings of every supported locale. */
export const CHART_STRINGS = {
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
  "fi-FI": FI_FI,
  "en-US": EN_US,
} as const satisfies { readonly [L in SupportedLocale]: ChartStrings };

/**
 * A count of slots in words, such as `25 timer` or `1 day`.
 *
 * @param locale - The active supported locale.
 * @param count - The number of slots.
 * @param unit - The interval, or `category` on a category axis.
 * @returns The count and its word in the locale's plural form.
 */
export function countSlots(locale: SupportedLocale, count: number, unit: Interval | "category"): string {
  const word = CHART_STRINGS[locale].slots[unit];
  const number = canonicalSpaces(numberFormat(locale, {}).format(count));
  return `${number}\u00a0${inflect(locale, count, word)}`;
}
