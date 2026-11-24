// The range a reference area prints through its label's {value}, and the range readers hear, in
// Chromium and WebKit. Units under test: Chart.ReferenceArea, ClockChart.ReferenceArea and
// Chart.Table's caption. Oracles, written by hand: a band of slots finer than a day in a format that
// prints a time of day runs from the first slot's start to the last slot's end, each end a complete
// label, in its visible and its spoken text. Any other range joins its first and last labels. Date,
// time and category ranges join with CLDR's date interval fallback, ` – ` in en-US and `–` in nb-NO.
// Number ranges join with the chart's bare en dash and write a shared unit once. Readers hear the
// dictionary's range words, "to" in en-US and "til" in nb-NO, and nb-NO speaks a time after "kl.".
// Intl's text and the range separator write each space as U+00A0. The label template, the range
// words and the dictionary's join of a date and a time write ordinary spaces.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { XFormat } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";

const HOUR = 3_600_000;

/** Midnight in Oslo on Saturday 17 October 2026, which is UTC+2. */
const DAY = Date.UTC(2026, 9, 16, 22);

const hours = Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * HOUR, kwh: 1 + (hour % 3) }));

const config = { kwh: { label: "kWh", color: "chart-1" } } as const;

type Row = { readonly start: number; readonly kwh: number };

function HourChart({
  locale,
  data = hours,
  children,
}: {
  readonly locale: SupportedLocale;
  readonly data?: readonly Row[];
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale={locale}>
      <div style={{ width: 640 }}>
        <Chart.Root
          data={data}
          config={config}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          data-intro="none"
          aria-label="Usage">
          <Chart.Bar dataKey="kwh" />
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

const months = [
  { month: "Jan", kwh: 3 },
  { month: "Feb", kwh: 2 },
  { month: "Mar", kwh: 4 },
  { month: "Apr", kwh: 1 },
];

function MonthChart({
  locale,
  children,
}: {
  readonly locale: SupportedLocale;
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale={locale}>
      <div style={{ width: 640 }}>
        <Chart.Root data={months} config={config} xKey="month" data-intro="none" aria-label="Usage">
          <Chart.Bar dataKey="kwh" />
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The cartesian band's label, which the first render writes. */
function cartesianLabel(host: HTMLElement): string | null | undefined {
  return host.querySelector('[data-slot="chart-reference-area"] [data-slot="chart-reference-label"]')
    ?.textContent;
}

/** The cartesian band's spoken sentence. */
function cartesianSpoken(host: HTMLElement): string | null | undefined {
  return host.querySelector('[data-slot="chart-reference-area"] [data-slot="chart-reference-text"]')
    ?.textContent;
}

describe.each([
  {
    locale: "en-US",
    hourBand: "Peak 5\u00a0PM\u00a0–\u00a08\u00a0PM",
    spokenHourBand: "Peak 5\u00a0PM to 8\u00a0PM",
    shortTimeBand: "Peak 5:00\u00a0PM\u00a0–\u00a08:00\u00a0PM",
    spokenShortTimeBand: "Peak 5:00\u00a0PM to 8:00\u00a0PM",
    categoryBand: "Peak Jan\u00a0–\u00a0Mar",
    valueBand: "Peak 1,000–2,000",
    unitBand: "Peak 1–1.4\u00a0kWh",
  },
  {
    locale: "nb-NO",
    hourBand: "Peak 17–20",
    spokenHourBand: "Peak kl.\u00a017 til kl.\u00a020",
    shortTimeBand: "Peak 17:00–20:00",
    spokenShortTimeBand: "Peak 17:00 til 20:00",
    categoryBand: "Peak Jan–Mar",
    valueBand: "Peak 1\u00a0000–2\u00a0000",
    unitBand: "Peak 1–1,4\u00a0kWh",
  },
] as const)(
  "Chart.ReferenceArea's printed range in $locale",
  ({
    locale,
    hourBand,
    spokenHourBand,
    shortTimeBand,
    spokenShortTimeBand,
    categoryBand,
    valueBand,
    unitBand,
  }) => {
    // Each hour band holds the hours from 17:00 to 19:00, so it runs from 17:00 to 20:00.
    it.each([
      { name: "the default format", area: {}, expected: hourBand, spoken: spokenHourBand },
      { name: '"hour"', area: { format: "hour" }, expected: hourBand, spoken: spokenHourBand },
      {
        name: "a short timeStyle",
        area: { format: { timeStyle: "short" } },
        expected: shortTimeBand,
        spoken: spokenShortTimeBand,
      },
    ] as const satisfies readonly {
      name: string;
      area: { format?: XFormat };
      expected: string;
      spoken: string;
    }[])(
      "prints and speaks an hour band in $name from its first slot's start to its last slot's end",
      ({ area, expected, spoken }) => {
        const { host } = renderThemed(
          <HourChart locale={locale}>
            <Chart.ReferenceArea x1={DAY + 17 * HOUR} x2={DAY + 19 * HOUR} {...area} label="Peak {value}" />
          </HourChart>
        );
        expect(cartesianLabel(host)).toBe(expected);
        expect(cartesianSpoken(host)).toBe(spoken);
      }
    );

    it("joins a category band's first and last names", () => {
      const { host } = renderThemed(
        <MonthChart locale={locale}>
          <Chart.ReferenceArea x1="Jan" x2="Mar" label="Peak {value}" />
        </MonthChart>
      );
      expect(cartesianLabel(host)).toBe(categoryBand);
    });

    it("writes both values of a value band in full, though they end alike", () => {
      const thousands = hours.map((row) => ({ ...row, kwh: row.kwh * 1000 }));
      const { host } = renderThemed(
        <HourChart locale={locale} data={thousands}>
          <Chart.ReferenceArea y1={1000} y2={2000} label="Peak {value}" />
        </HourChart>
      );
      expect(cartesianLabel(host)).toBe(valueBand);
    });

    it("writes a value band's shared unit once", () => {
      const { host } = renderThemed(
        <HourChart locale={locale}>
          <Chart.ReferenceArea
            y1={1}
            y2={1.4}
            format={{ preset: "energy", unit: "kWh", maximumFractionDigits: 2 }}
            label="Peak {value}"
          />
        </HourChart>
      );
      expect(cartesianLabel(host)).toBe(unitBand);
    });
  }
);

describe("Chart.ReferenceArea's printed range on one axis", () => {
  it("ends an nb-NO band across the spring-forward gap at 03:00", () => {
    // Oslo moves from 02:00 to 03:00 on Sunday 30 March 2025. The band holds the slots that start
    // at 00:00 and at 01:00, and the 01:00 slot ends at 03:00.
    const night = Date.UTC(2025, 2, 29, 23);
    const springDay = Array.from({ length: 23 }, (_, hour) => ({ start: night + hour * HOUR, kwh: 1 }));
    const { host } = renderThemed(
      <HourChart locale="nb-NO" data={springDay}>
        <Chart.ReferenceArea x1={night} x2={night + HOUR} format="time" label="Natt {value}" />
      </HourChart>
    );
    expect(cartesianLabel(host)).toBe("Natt 00:00–03:00");
    expect(cartesianSpoken(host)).toBe("Natt kl.\u00a000:00 til kl.\u00a003:00");
  });

  it("leads each end of an en-US hour band on a two-day axis with its date, visible and spoken", () => {
    // The dictionary's `slotOnDate` joins the date and the hour with a comma and a plain space.
    const twoDays = Array.from({ length: 48 }, (_, hour) => ({ start: DAY + hour * HOUR, kwh: 1 }));
    const { host } = renderThemed(
      <HourChart locale="en-US" data={twoDays}>
        <Chart.ReferenceArea x1={DAY + 17 * HOUR} x2={DAY + 19 * HOUR} label="Peak {value}" />
      </HourChart>
    );
    expect(cartesianLabel(host)).toBe(
      "Peak Saturday,\u00a0October\u00a017, 5\u00a0PM\u00a0–\u00a0Saturday,\u00a0October\u00a017, 8\u00a0PM"
    );
    expect(cartesianSpoken(host)).toBe(
      "Peak Saturday,\u00a0October\u00a017, 5\u00a0PM to Saturday,\u00a0October\u00a017, 8\u00a0PM"
    );
  });

  it.each([
    { name: '"weekday"', format: "weekday" },
    { name: "a short weekday", format: { weekday: "short" } },
  ] as const satisfies readonly { name: string; format: XFormat }[])(
    "joins the first and the last hour's weekday on an en-US hour axis in $name",
    ({ format }) => {
      const twoDays = Array.from({ length: 48 }, (_, hour) => ({ start: DAY + hour * HOUR, kwh: 1 }));
      const { host } = renderThemed(
        <HourChart locale="en-US" data={twoDays}>
          <Chart.ReferenceArea x1={DAY} x2={DAY + 47 * HOUR} format={format} label="Weekend {value}" />
        </HourChart>
      );
      expect(cartesianLabel(host)).toBe("Weekend Sat\u00a0–\u00a0Sun");
    }
  );

  it("writes an en-US percent band's sign once, though no space leads it", () => {
    const { host } = renderThemed(
      <HourChart locale="en-US">
        <Chart.ReferenceArea y1={0.05} y2={0.1} format={{ style: "percent" }} label="Share {value}" />
      </HourChart>
    );
    expect(cartesianLabel(host)).toBe("Share 5–10%");
  });

  it("keeps both closing parentheses of an en-US accounting band", () => {
    const { host } = renderThemed(
      <HourChart locale="en-US">
        <Chart.ReferenceArea
          y1={-10}
          y2={-5}
          format={{ style: "currency", currency: "USD", currencySign: "accounting" }}
          label="Loss {value}"
        />
      </HourChart>
    );
    expect(cartesianLabel(host)).toBe("Loss ($10.00)–($5.00)");
  });

  it("writes a fi-FI price band's VAT suffix once, though it holds a digit", () => {
    // fi-FI writes a price without VAT as `0,12 €/kWh alv 0 %`, so the shared text after each
    // number is ` €/kWh alv 0 %`.
    const { host } = renderThemed(
      <HourChart locale="fi-FI">
        <Chart.ReferenceArea
          y1={0.12}
          y2={0.15}
          format={{ preset: "unit-price", currency: "EUR", vat: "excluded" }}
          label="Huippu {value}"
        />
      </HourChart>
    );
    expect(cartesianLabel(host)).toBe("Huippu 0,12–0,15\u00a0€/kWh\u00a0alv\u00a00\u00a0%");
  });
});

describe("Chart.Table's caption", () => {
  it("shows an en-US category period joined as a band prints it and speaks it in words", () => {
    const { host } = renderThemed(
      <MonthChart locale="en-US">
        <Chart.Table />
      </MonthChart>
    );
    // The caption's visible text is everything but its screen-reader copy.
    const caption = host.querySelector('[data-slot="chart-table-content"] > caption')?.cloneNode(true);
    if (!(caption instanceof HTMLElement)) throw new Error("expected the table's caption");
    for (const copy of caption.querySelectorAll(".sr-only")) copy.remove();
    expect(caption.textContent).toBe("Usage, Jan\u00a0–\u00a0Apr");
    // The dictionary's range words, which the caption speaks, name the table.
    expect(roleNamed("table", "Usage, Jan to Apr").tagName).toBe("TABLE");
  });
});

/** The first of each month of 2026 in Oslo, which is UTC+2 from April to October. */
const monthStarts = Array.from({ length: 12 }, (_, month) => ({
  start: Date.parse(
    `2026-${String(month + 1).padStart(2, "0")}-01T00:00:00${month >= 3 && month <= 9 ? "+02:00" : "+01:00"}`
  ),
  kwh: 1,
}));

function Dial({ cycle, children }: { readonly cycle: "day" | "year"; readonly children: React.ReactNode }) {
  const [data, interval] = cycle === "day" ? ([hours, "hour"] as const) : ([monthStarts, "month"] as const);
  return (
    <LocaleProvider locale="en-US">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={data}
          config={config}
          xKey="start"
          cycle={cycle}
          interval={interval}
          timeZone="Europe/Oslo"
          data-intro="none"
          aria-label="Dial">
          <ClockChart.Column dataKey="kwh" />
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The sector's label, which the first render writes. */
function sectorLabel(host: HTMLElement): string | null | undefined {
  return host.querySelector('[data-slot="clock-chart-reference-area"] > [data-part="label"]')?.textContent;
}

describe("ClockChart.ReferenceArea's printed range in en-US", () => {
  it("joins a sector's start and end with the spaced en dash", () => {
    // The sector holds the hours from 17:00 to 19:00, so it runs from 5:00 PM to 8:00 PM.
    const { host } = renderThemed(
      <Dial cycle="day">
        <ClockChart.ReferenceArea x1={DAY + 17 * HOUR} x2={DAY + 19 * HOUR} label="Peak {value}" />
      </Dial>
    );
    expect(sectorLabel(host)).toBe("Peak 5:00\u00a0PM\u00a0–\u00a08:00\u00a0PM");
  });

  it("writes both dates of a year-dial sector in full, though they end in the same day number", () => {
    // The sector holds March to May, so it runs from 1 March to 1 June.
    const { host } = renderThemed(
      <Dial cycle="year">
        <ClockChart.ReferenceArea
          x1={Date.parse("2026-03-01T00:00:00+01:00")}
          x2={Date.parse("2026-05-01T00:00:00+02:00")}
          format="date"
          label="Spring {value}"
        />
      </Dial>
    );
    expect(sectorLabel(host)).toBe("Spring Sunday,\u00a0March\u00a01\u00a0–\u00a0Monday,\u00a0June\u00a01");
  });

  it("writes both ends of a long day period in full", () => {
    // The sector holds the hours from 14:00 to 15:00, so it runs from 2 to 4 in the afternoon.
    const { host } = renderThemed(
      <Dial cycle="day">
        <ClockChart.ReferenceArea
          x1={DAY + 14 * HOUR}
          x2={DAY + 15 * HOUR}
          format={{ hour: "numeric", dayPeriod: "long" }}
          label="Nap {value}"
        />
      </Dial>
    );
    expect(sectorLabel(host)).toBe(
      "Nap 2\u00a0in\u00a0the\u00a0afternoon\u00a0–\u00a04\u00a0in\u00a0the\u00a0afternoon"
    );
  });
});
