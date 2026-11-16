/**
 * The point word in the four locales. A scatter chart counts its points with it, a live line chart
 * its readings, and a cartesian chart the slots of a linear x axis. It is a leaf apart from every
 * family's dictionary, with no runtime dependencies, so each route that counts points shares one
 * set of inflections and a live line route ships no scatter words.
 */
import type { Inflected } from "../../../intl/count-of";
import type { SupportedLocale } from "../../../intl/locale-context";

/** The point word per locale, counted. */
export const POINT_WORDS = {
  "nb-NO": { one: "punkt", other: "punkter" },
  "sv-SE": { one: "punkt", other: "punkter" },
  "fi-FI": { one: "piste", other: "pistettä" },
  "en-US": { one: "point", other: "points" },
} as const satisfies { readonly [L in SupportedLocale]: Inflected };
