import type { SupportedLocale } from "../../../../intl/locale-context";
import type { FormattedText } from "../formatted-text";

/** The locales every judge covers. */
export const LOCALES = ["nb-NO", "sv-SE", "fi-FI", "en-US"] as const satisfies readonly SupportedLocale[];

/** The zones the slot oracle covers. */
export const ZONES = ["Europe/Oslo", "Europe/Stockholm", "Europe/Helsinki"] as const;

/** A zone the slot oracle covers. */
export type Zone = (typeof ZONES)[number];

/** One comparison: Fuse's labels against the expected labels, in order. */
export type Judgement = {
  readonly name: string;
  readonly actual: readonly (string | null)[];
  readonly expected: readonly (string | null)[];
};

/** One value per supported locale. */
export type PerLocale<T> = { readonly [L in SupportedLocale]: T };

/** A case with one hand-written visual and spoken literal per locale. */
export type LiteralCase = {
  readonly name: string;
  readonly text: PerLocale<string>;
  readonly spoken: PerLocale<string>;
};

/**
 * Each case's labels against its literals, as a `text` and a `spoken` judgement per case.
 *
 * @param cases - The cases.
 * @param label - Formats one case for one locale.
 * @returns Two judgements per case.
 */
export function literalJudgements<C extends LiteralCase>(
  cases: readonly C[],
  label: (literalCase: C, locale: SupportedLocale) => FormattedText
): Judgement[] {
  return cases.flatMap((literalCase) => {
    const labels = LOCALES.map((locale) => label(literalCase, locale));
    return [
      {
        name: `${literalCase.name} text`,
        actual: labels.map((formatted) => formatted.text),
        expected: LOCALES.map((locale) => literalCase.text[locale]),
      },
      {
        name: `${literalCase.name} spoken`,
        actual: labels.map((formatted) => formatted.spoken),
        expected: LOCALES.map((locale) => literalCase.spoken[locale]),
      },
    ];
  });
}
