/**
 * The point word in the four locales. A scatter chart counts its points with it, and a live line
 * chart its readings. It is a leaf apart from both families' dictionaries, so a live line route ships
 * no scatter words and no cartesian route ships it.
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
