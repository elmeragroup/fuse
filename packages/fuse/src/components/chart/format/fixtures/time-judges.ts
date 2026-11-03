/**
 * The time judges. Each pairs Fuse's time labels with an expectation from outside Fuse: the
 * zoneinfo slot oracle in `slots.json`, the frozen market data, or the literals in
 * `time-literals.ts`. `README.md` names each source. The hand-written slot labels run through the
 * public `formatChartSlot`, so every engine places each slot by its own zone data.
 */
import { formatDateTime } from "../../../../intl/date-time-join";
import type { SupportedLocale } from "../../../../intl/locale-context";
import { formatChartSlot } from "../../chart-format";
import { formatTime } from "../time-format";
import type { Interval, TimePreset } from "../time-format";
import consumption from "./elhub/no1-consumption-2025-10-26.json" with { type: "json" };
import production from "./elhub/no1-production-15min-2025-10-26.json" with { type: "json" };
import { LOCALES, ZONES, labelJudgement, literalJudgements } from "./judgement";
import type { Judgement, Zone } from "./judgement";
import fallBack from "./prices/fall-back-2025-10-26-quarter.json" with { type: "json" };
import slots from "./slots.json" with { type: "json" };
import { TIME_CASES } from "./time-literals";
import type { SlotLabelCase } from "./time-literals";

type Columns<T> = { readonly [L in SupportedLocale]: readonly T[] };
type SubDay = {
  readonly utc_start: readonly string[];
  readonly labels_canonical: Columns<string>;
  /** The long zone names of the repeated slots, by slot index. */
  readonly long_name: { readonly [index: string]: { readonly [L in SupportedLocale]: string } };
};
type Periods = {
  readonly utc_start: readonly string[];
  readonly iso_week?: readonly number[];
  readonly labels: { readonly [L in SupportedLocale]: { readonly [field: string]: readonly string[] } };
};
type Weeks = {
  readonly utc_start: readonly string[];
  readonly labels_canonical: {
    readonly [L in SupportedLocale]: { readonly week: readonly string[]; readonly spoken: readonly string[] };
  };
};
type Fixture = {
  readonly hour: { readonly [Z in Zone]: { readonly [day: string]: SubDay } };
  readonly "quarter-hour": { readonly [Z in Zone]: { readonly [day: string]: SubDay } };
  readonly day: { readonly [Z in Zone]: { readonly [month: string]: Periods } };
  readonly month: { readonly [Z in Zone]: { readonly [year: string]: Periods } };
  readonly week: { readonly [Z in Zone]: Weeks };
};

const FIXTURE: Fixture = slots;

/** The oracle's sub-day slot lists of one interval, as `[zone, day, slots]` triples. */
export function oracleDays(interval: "hour" | "quarter-hour"): Array<readonly [Zone, string, SubDay]> {
  return ZONES.flatMap((zone) =>
    Object.entries(FIXTURE[interval][zone]).map(([day, list]) => [zone, day, list] as const)
  );
}

const RANGE_PRESET = { hour: "hour-range", "quarter-hour": "time-range" } as const;

/**
 * The oracle writes long zone names and `month_year` with U+0020, which canonical spacing writes as
 * U+00A0, as TIME-CONVENTIONS.md tells a canonical judge to map. It is written out here so that
 * Fuse's own `canonicalSpaces` never judges itself.
 */
const oracleSpaces = (text: string): string => text.replaceAll(" ", "\u00a0");

/**
 * Every hourly and quarter-hour slot's full range label against `labels_canonical`, per zone, day
 * and locale, plus its spoken zone name against the oracle's `long_name`. A slot the oracle names
 * no zone for must speak none.
 */
export function slotJudgements(): Judgement[] {
  return (["hour", "quarter-hour"] as const).flatMap((interval) =>
    oracleDays(interval).flatMap(([zone, day, list]) =>
      LOCALES.flatMap((locale) => {
        const labels = list.utc_start.map((start) =>
          formatTime(locale, zone, { start: Date.parse(start), interval }, RANGE_PRESET[interval], "full")
        );
        const zoneNames = labels.map(({ spoken }) => {
          const comma = spoken.lastIndexOf(",\u00a0");
          return comma === -1 ? null : spoken.slice(comma + 2);
        });
        return [
          {
            name: `${interval} ${zone} ${day} ${locale}`,
            actual: labels.map((label) => label.text),
            expected: list.labels_canonical[locale],
          },
          {
            name: `${interval} ${zone} ${day} ${locale} spoken zone`,
            actual: zoneNames,
            expected: list.utc_start.map((_, index) => {
              const name = list.long_name[String(index)]?.[locale];
              return name === undefined ? null : oracleSpaces(name);
            }),
          },
        ];
      })
    )
  );
}

/**
 * Daily, monthly and ISO week labels against the oracle. The oracle keeps U+0020 in `month_year`,
 * so the expectation maps it to U+00A0, as TIME-CONVENTIONS.md tells a canonical judge to.
 */
export function calendarJudgements(): Judgement[] {
  const periods = (
    kind: "day" | "month",
    interval: Interval,
    fields: ReadonlyArray<readonly [string, TimePreset]>
  ): Judgement[] =>
    ZONES.flatMap((zone) =>
      Object.entries(FIXTURE[kind][zone]).flatMap(([key, list]) =>
        LOCALES.flatMap((locale) =>
          fields.map(([field, preset]) => ({
            name: `${kind} ${zone} ${key} ${locale} ${preset}`,
            actual: list.utc_start.map(
              (start) => formatTime(locale, zone, { start: Date.parse(start), interval }, preset, "full").text
            ),
            expected: (list.labels[locale][field] ?? []).map(oracleSpaces),
          }))
        )
      )
    );
  // Every day of the daily file, labelled with the week preset, against Python's isocalendar().
  const dayWeeks = ZONES.flatMap((zone) =>
    Object.entries(FIXTURE.day[zone]).map(([month, list]) => ({
      name: `week of each day ${zone} ${month}`,
      actual: list.utc_start.map((start) =>
        formatTime("en-US", zone, { start: Date.parse(start), interval: "day" }, "week", "tick").text.replace(
          "W",
          ""
        )
      ),
      expected: (list.iso_week ?? []).map(String),
    }))
  );
  const weeks = ZONES.flatMap((zone) =>
    LOCALES.flatMap((locale) => {
      const list = FIXTURE.week[zone];
      const labels = list.utc_start.map((start) =>
        formatTime(locale, zone, { start: Date.parse(start), interval: "week" }, "week", "full")
      );
      return [
        {
          name: `week ${zone} ${locale}`,
          actual: labels.map((label) => label.text),
          expected: list.labels_canonical[locale].week,
        },
        {
          name: `week ${zone} ${locale} spoken`,
          actual: labels.map((label) => label.spoken),
          expected: list.labels_canonical[locale].spoken,
        },
      ];
    })
  );
  return [
    ...periods("day", "day", [
      ["day", "day"],
      ["weekday", "weekday"],
    ]),
    ...periods("month", "month", [
      ["month", "month"],
      ["month_year", "month-year"],
    ]),
    ...weeks,
    ...dayWeeks,
  ];
}

/**
 * Three fall-back day sources, each row placed by its start plus the interval. The hand-written
 * price day ends its 02:45+02:00 quarter at 03:00+01:00, a 75-minute span, as the real price
 * source does, so a parser that read the ends would differ. Elhub ends every row correctly, so its
 * hourly consumption and quarter-hour production cross-check the slot list.
 */
export function marketJudgements(): Judgement[] {
  const household = consumption.rows.filter((row) => row.consumptionGroup === "household");
  const sources = [
    ["hand-written fall-back day", fallBack.map((row) => row.time_start), "Europe/Stockholm", "quarter-hour"],
    ["Elhub NO1 household consumption", household.map((row) => row.startTime), "Europe/Oslo", "hour"],
    [
      "Elhub NO1 hydro production",
      production.rows.map((row) => row.startTime),
      "Europe/Oslo",
      "quarter-hour",
    ],
  ] as const;
  return sources.flatMap(([name, starts, zone, interval]) =>
    LOCALES.map((locale) => ({
      name: `${name} ${locale}`,
      actual: starts.map(
        (start) =>
          formatTime(locale, zone, { start: Date.parse(start), interval }, RANGE_PRESET[interval], "full")
            .text
      ),
      expected: FIXTURE[interval][zone]["2025-10-26"]?.labels_canonical[locale] ?? [],
    }))
  );
}

/** Each time case's output against its literals. */
export function timeLiteralJudgements(): Judgement[] {
  return literalJudgements(TIME_CASES, (timeCase, locale) =>
    formatTime(
      locale,
      timeCase.zone,
      { start: Date.parse(timeCase.start), interval: timeCase.interval },
      timeCase.preset,
      timeCase.role
    )
  );
}

/**
 * Each hand-written case's label through the public `formatChartSlot`, one judgement per case.
 *
 * @param cases - The cases.
 * @returns One judgement per case.
 */
export function publicSlotJudgements(cases: readonly SlotLabelCase[]): Judgement[] {
  return cases.map((slotCase) => {
    const { locale, zone: timeZone, format } = slotCase;
    const options = format === undefined ? { locale, timeZone } : { locale, timeZone, format };
    const label = formatChartSlot(Date.parse(slotCase.at), slotCase.interval, options);
    return labelJudgement(slotCase.name, label, slotCase.text, slotCase.spoken);
  });
}

/**
 * A language outside the four keeps Intl's own join. The expectation is the engine's own Intl
 * output, built without Fuse's formatter cache, so the judge claims no text across engines.
 */
export function foreignJoinJudgements(): Judgement[] {
  const options = { timeZone: "Europe/Oslo", dateStyle: "long", timeStyle: "short" } as const;
  const at = Date.parse("2026-10-18T10:30:00Z");
  return [
    {
      name: "a de-DE date-time keeps Intl's join",
      actual: [formatDateTime("de-DE", options, at)],
      expected: [new Intl.DateTimeFormat("de-DE", options).format(at)],
    },
  ];
}
