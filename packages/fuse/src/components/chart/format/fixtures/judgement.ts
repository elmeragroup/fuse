import type { SupportedLocale } from "../../../../intl/locale-context";
import type { FormattedText } from "../formatted-text";

/** The locales every judge covers. */
export const LOCALES = ["nb-NO", "sv-SE", "fi-FI", "en-US"] as const satisfies readonly SupportedLocale[];

/** The zones the slot oracle covers. */
export const ZONES = ["Europe/Oslo", "Europe/Stockholm", "Europe/Helsinki"] as const;

/** A zone the slot oracle covers. */
export type Zone = (typeof ZONES)[number];

/**
 * One comparison: Fuse's output against the expected output, in order. Labels compare strings, and
 * the x-domain judges compare slot starts and indexes.
 */
export type Judgement<T = string | null> = {
  readonly name: string;
  readonly actual: readonly T[];
  readonly expected: readonly T[];
};

/**
 * The names of the judgements whose output differs from the expected output.
 *
 * @param judgements - The judgements.
 * @returns Their names, in order.
 */
export function mismatches(judgements: readonly Judgement<unknown>[]): string[] {
  return judgements
    .filter((judgement) => JSON.stringify(judgement.actual) !== JSON.stringify(judgement.expected))
    .map((judgement) => judgement.name);
}

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

/**
 * One hand-written label against Fuse's, its spoken form included when the case writes one.
 *
 * @param name - The judgement's name.
 * @param label - Fuse's label.
 * @param text - The expected visual label.
 * @param spoken - The expected spoken label, if the case checks it.
 * @returns One judgement.
 */
export function labelJudgement(
  name: string,
  label: FormattedText,
  text: string,
  spoken: string | undefined
): Judgement {
  return spoken === undefined
    ? { name, actual: [label.text], expected: [text] }
    : { name, actual: [label.text, label.spoken], expected: [text, spoken] };
}
