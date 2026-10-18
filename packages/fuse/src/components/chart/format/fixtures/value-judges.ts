/**
 * The value judges. Each pairs Fuse's value labels with the literals in `value-literals.ts`, which
 * are written by hand from CLDR 48 and from the drafted chart words. The public cases run through
 * `formatChartValue`, as a figure beside a chart prints them.
 */
import { formatChartValue } from "../../chart-format";
import { formatValue } from "../value-format";
import type { ValueFormat } from "../value-format";
import { LOCALES, labelJudgement, literalJudgements } from "./judgement";
import type { Judgement } from "./judgement";
import { PRESET_CASES, PUBLIC_VALUE_CASES, SPOKEN_PER_KWH, WORDS } from "./value-literals";

/** Each preset case's output against its literals. */
export function presetJudgements(): Judgement[] {
  return literalJudgements(PRESET_CASES, (presetCase, locale) =>
    formatValue(locale, presetCase.value, presetCase.format, presetCase.role)
  );
}

/** Each spoken unit name and subunit form against {@link WORDS}, for the values 1 and 2. */
export function wordJudgements(): Judgement[] {
  const unitFormats = [
    ...(["Wh", "kWh", "MWh"] as const).map((unit) => [unit, { preset: "energy", unit }] as const),
    ...(["W", "kW", "MW"] as const).map((unit) => [unit, { preset: "power", unit }] as const),
  ];
  return LOCALES.flatMap((locale) => {
    const { units, minor } = WORDS[locale];
    const unitJudgements = unitFormats.map(([unit, format]) => ({
      name: `${locale} ${unit} words`,
      actual: [1, 2].map((value) => formatValue(locale, value, format, "tick").spoken),
      expected: [`1\u00a0${units[unit][0]}`, `2\u00a0${units[unit][1]}`],
    }));
    const minorJudgements = (["NOK", "SEK", "EUR"] as const).map((currency) => {
      const format: ValueFormat = { preset: "unit-price", currency, minor: true, vat: "excluded" };
      const [symbol, one, other] = minor[currency];
      const single = formatValue(locale, 1, format, "tick");
      const double = formatValue(locale, 2, format, "tick");
      return {
        name: `${locale} ${currency} subunit words`,
        actual: [single.text, single.spoken, double.spoken],
        expected: [
          `1\u00a0${symbol}/kWh`,
          `1\u00a0${one}\u00a0${SPOKEN_PER_KWH[locale]}`,
          `2\u00a0${other}\u00a0${SPOKEN_PER_KWH[locale]}`,
        ],
      };
    });
    return [...unitJudgements, ...minorJudgements];
  });
}

/** Each public value case's label through `formatChartValue`, one judgement per case. */
export function publicValueJudgements(): Judgement[] {
  return PUBLIC_VALUE_CASES.map((valueCase) =>
    labelJudgement(
      valueCase.name,
      formatChartValue(valueCase.value, valueCase.format, { locale: valueCase.locale }),
      valueCase.text,
      valueCase.spoken
    )
  );
}
