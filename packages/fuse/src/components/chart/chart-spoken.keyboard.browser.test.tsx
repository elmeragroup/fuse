// The ticket's screen reader judge, in Chromium, Firefox and WebKit: hand-written spoken arrays per
// locale for section 8.7's S07 days, section 9.4's S14 emphasis, the table, S09's change column and
// the status messages. Section 9.1's key sequence for S06 and the fall-back day lives in
// chart-pattern.keyboard.browser.test.tsx. Every date comes from layer 03's literal fixtures, every
// word from CONTRACT section 12's drafted dictionary, every value from the committed Elhub days,
// and the phrase grammar is vsr's own: role, name, state, position and set size, joined by ", ".
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartQuality } from "./chart-types";
import "./chart.css";
import lastOctober from "./format/fixtures/elhub/no1-household-daily-2024-10.json" with { type: "json" };
import thisOctober from "./format/fixtures/elhub/no1-household-daily-2025-10.json" with { type: "json" };
import { TIME_CASES } from "./format/fixtures/time-literals";

const LOCALES = ["nb-NO", "sv-SE", "fi-FI", "en-US"] as const;

/** A date literal of layer 03's fixtures, by case name and locale. */
function date(name: string, locale: SupportedLocale): string {
  const found = TIME_CASES.find((entry) => entry.name === name)?.spoken[locale];
  if (found === undefined) throw new Error(`no time literal ${name}`);
  return found;
}

/** CONTRACT section 12's drafted words, and the unit words of layer 03's value literals. */
const WORDS = {
  "nb-NO": {
    day: "Dag",
    consumption: "Forbruk",
    peak: "Høyeste time",
    thisYear: "I år",
    lastYear: "I fjor",
    kwh: "kilowattimer",
    missing: "mangler",
    corrected: "korrigert",
    estimated: "estimert",
    pending: "ingen data ennå",
    now: "nå",
    emphasised: "uthevet",
    selected: (label: string) => `${label} valgt`,
    cleared: "Ingen serie valgt",
  },
  "sv-SE": {
    day: "Dag",
    consumption: "Förbrukning",
    peak: "Högsta timme",
    thisYear: "I år",
    lastYear: "I fjol",
    kwh: "kilowattimmar",
    missing: "saknas",
    corrected: "korrigerad",
    estimated: "uppskattad",
    pending: "inga data ännu",
    now: "nu",
    emphasised: "framhävd",
    selected: (label: string) => `${label} vald`,
    cleared: "Ingen serie vald",
  },
  "fi-FI": {
    day: "Päivä",
    consumption: "Kulutus",
    peak: "Korkein tunti",
    thisYear: "Tänä vuonna",
    lastYear: "Viime vuonna",
    kwh: "kilowattituntia",
    missing: "puuttuu",
    corrected: "korjattu",
    estimated: "arvioitu",
    pending: "ei vielä tietoja",
    now: "nyt",
    emphasised: "korostettu",
    selected: (label: string) => `${label} valittu`,
    cleared: "Ei valittua sarjaa",
  },
  "en-US": {
    day: "Day",
    consumption: "Consumption",
    peak: "Highest hour",
    thisYear: "This year",
    lastYear: "Last year",
    kwh: "kilowatt-hours",
    missing: "missing",
    corrected: "corrected",
    estimated: "estimated",
    pending: "no data yet",
    now: "now",
    emphasised: "highlighted",
    selected: (label: string) => `${label} selected`,
    cleared: "No series selected",
  },
} as const;

/**
 * The committed days' values at one fraction digit, rounded half away from zero, with each
 * locale's decimal sign: 33.58 kWh on 9 October, 35.48 on the 16th, 2.218 at the 31st's peak, and
 * last year's 31.29 and 40.22.
 */
const NUMBERS = {
  day9: { comma: "33,6", point: "33.6" },
  day16: { comma: "35,5", point: "35.5" },
  peak31: { comma: "2,2", point: "2.2" },
  last9: { comma: "31,3", point: "31.3" },
  last16: { comma: "40,2", point: "40.2" },
} as const;

function number(key: keyof typeof NUMBERS, locale: SupportedLocale): string {
  return locale === "en-US" ? NUMBERS[key].point : NUMBERS[key].comma;
}

/**
 * S09's change on 9 October, (33.58 − 31.29) / 31.29 = +7.3 %, and on 16 October,
 * (35.48 − 40.22) / 40.22 = −11.8 %, in layer 03's spoken signed percent forms.
 */
const CHANGES = {
  "nb-NO": ["pluss 7,3 prosent", "minus 11,8 prosent"],
  "sv-SE": ["plus 7,3 procent", "minus 11,8 procent"],
  "fi-FI": ["plus 7,3 prosenttia", "miinus 11,8 prosenttia"],
  "en-US": ["plus 7.3 percent", "minus 11.8 percent"],
} as const;

/** Oslo midnight of an October date, in summer time up to the 26th. */
function osloMidnight(day: string): Date {
  return new Date(`${day}T00:00:00${day <= "2025-10-26" ? "+02:00" : "+01:00"}`);
}

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

afterEach(async () => {
  await virtual.stop();
});

/** Start vsr on the host with focus on the button before the chart. */
async function start(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await virtual.start({ container: host });
}

/** Press each key and return the last phrase after it. */
async function phrasesAfter(keys: readonly (readonly [string, number])[]): Promise<string[]> {
  const heard: string[] = [];
  for (const [key, times] of keys) {
    for (let press = 0; press < times; press += 1) await virtual.press(key);
    heard.push((await virtual.spokenPhraseLog()).at(-1) ?? "");
  }
  return heard;
}

/** Read on with vsr's virtual cursor until the table ends, and return the row phrases. */
async function tableRows(): Promise<string[]> {
  for (let step = 0; step < 400; step += 1) {
    await virtual.next();
    if ((await virtual.lastSpokenPhrase()).startsWith("end of table")) break;
  }
  return (await virtual.spokenPhraseLog()).filter((phrase) => phrase.startsWith("row, "));
}

function S07({ locale }: { readonly locale: SupportedLocale }) {
  // S07's fixed rule: day 5 missing, day 9 corrected, day 16 estimated, days 17 to 31 pending.
  const quality = (day: number): ChartQuality =>
    day === 5 ? "missing" : day === 9 ? "corrected" : day === 16 ? "estimated" : "measured";
  return (
    <LocaleProvider locale={locale}>
      <button type="button">før</button>
      <Chart.Root
        data={thisOctober.days.slice(0, 16).map((row, index) => ({
          day: osloMidnight(row.date),
          kwh: index === 4 ? null : row.kwh,
          quality: quality(index + 1),
        }))}
        config={{
          kwh: { label: WORDS[locale].consumption, color: "chart-1", qualityKey: "quality", format: energy },
        }}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        period={[osloMidnight("2025-10-01"), osloMidnight("2025-11-01")]}
        now={new Date("2025-10-16T12:00:00+02:00")}
        aria-label="S07">
        <Chart.Bar dataKey="kwh" />
        <Chart.Table />
      </Chart.Root>
    </LocaleProvider>
  );
}

describe.each(LOCALES)("S07's quality states in %s", (locale) => {
  const words = WORDS[locale];
  const unit = (key: keyof typeof NUMBERS) => `${number(key, locale)} ${words.kwh}`;

  it("speaks the missing, corrected, estimated and pending days", async () => {
    const { host } = renderThemed(<S07 locale={locale} />);
    await start(host);
    const heard = await phrasesAfter([
      ["Tab", 1],
      ["ArrowRight", 4],
      ["ArrowRight", 4],
      ["ArrowRight", 7],
      ["ArrowRight", 4],
    ]);
    expect(heard.slice(1)).toEqual([
      `option, ${date("S07 missing day date", locale)}: ${words.consumption} ${words.missing}, not selected, position 5, set size 31`,
      `option, ${date("S07 corrected day date", locale)}: ${words.consumption} ${unit("day9")}, ${words.corrected}, not selected, position 9, set size 31`,
      `option, ${date("S07 estimated day date", locale)}, ${words.now}: ${words.consumption} ${unit("day16")}, ${words.estimated}, not selected, position 16, set size 31`,
      `option, ${date("S07 pending day date", locale)}: ${words.pending}, not selected, position 20, set size 31`,
    ]);
  });

  it("reads the table's rows with the quality word after the value", async () => {
    const { host } = renderThemed(<S07 locale={locale} />);
    await start(host);
    const [header, ...rows] = await tableRows();
    // CONTRACT section 9.6: the interval's header word and each series' label with its unit, which
    // section 9.7 speaks as the unit's word, then 16 rows, one per day with a reading or a missing
    // reading.
    expect(header).toBe(`row, ${words.day} ${words.consumption} (${words.kwh})`);
    expect(rows).toHaveLength(16);
    expect([rows[4], rows[8], rows[15]]).toEqual([
      `row, ${date("S07 missing day date", locale)} ${words.missing}`,
      `row, ${date("S07 corrected day date", locale)} ${number("day9", locale)} (${words.corrected})`,
      `row, ${date("S07 estimated day date", locale)} ${number("day16", locale)} (${words.estimated})`,
    ]);
  });
});

function S09({ locale }: { readonly locale: SupportedLocale }) {
  const words = WORDS[locale];
  return (
    <LocaleProvider locale={locale}>
      <button type="button">før</button>
      <Chart.Root
        data={thisOctober.days.map((row, index) => {
          const last = lastOctober.days[index]?.kwh ?? 0;
          return {
            day: osloMidnight(row.date),
            thisYear: row.kwh,
            lastYear: last,
            change: (row.kwh - last) / last,
          };
        })}
        config={{
          thisYear: { label: words.thisYear, color: "chart-1", format: energy },
          lastYear: { label: words.lastYear, color: "chart-2", format: energy },
        }}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        aria-label="S09">
        <Chart.BarGroup series={["thisYear", "lastYear"]}>
          <Chart.Bar dataKey="thisYear" />
          <Chart.Bar dataKey="lastYear" />
        </Chart.BarGroup>
        <Chart.LegendToggleGroup />
        <Chart.Table>
          <Chart.TableColumn
            dataKey="change"
            header="Δ"
            format={{ style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }}
          />
        </Chart.Table>
      </Chart.Root>
    </LocaleProvider>
  );
}

describe.each(LOCALES)("S09 in %s", (locale) => {
  const words = WORDS[locale];

  it("reads the change column with the locale's sign words", async () => {
    // SCENARIOS.md S09's judge: the virtual screen reader announces the change in all four locales.
    const { host } = renderThemed(<S09 locale={locale} />);
    await start(host);
    const [header, ...rows] = await tableRows();
    expect(header).toBe(
      `row, ${words.day} ${words.thisYear} (${words.kwh}) ${words.lastYear} (${words.kwh}) Δ`
    );
    expect(rows).toHaveLength(31);
    const [up, down] = CHANGES[locale];
    expect([rows[8], rows[15]]).toEqual([
      `row, ${date("S07 corrected day date", locale)} ${number("day9", locale)} ${number("last9", locale)} ${up}`,
      `row, ${date("S07 estimated day date", locale)} ${number("day16", locale)} ${number("last16", locale)} ${down}`,
    ]);
  });

  it("announces a selection and its clearing in the status region", async () => {
    // CONTRACT section 9.10: the status region announces selection. vsr speaks a polite region
    // as "polite: " and its text.
    const { host } = renderThemed(<S09 locale={locale} />);
    await start(host);
    for (const key of ["Tab", "ArrowDown", "Enter", "Enter"]) await virtual.press(key);
    const log = await virtual.spokenPhraseLog();
    expect(log.filter((phrase) => phrase.startsWith("polite: "))).toEqual([
      `polite: ${words.selected(words.thisYear)}`,
      `polite: ${words.cleared}`,
    ]);
  });
});

function S14({ locale, label }: { readonly locale: SupportedLocale; readonly label?: string }) {
  // The three highest daily peaks, 31, 30 and 19 October, which scenario_goldens.py prints.
  const top = ["2025-10-31", "2025-10-30", "2025-10-19"].map(osloMidnight);
  return (
    <LocaleProvider locale={locale}>
      <button type="button">før</button>
      <Chart.Root
        data={thisOctober.days.map((row) => ({ day: osloMidnight(row.date), peak: row.peakKwh }))}
        config={{ peak: { label: WORDS[locale].peak, color: "chart-1", format: energy } }}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        aria-label="S14">
        <Chart.Bar dataKey="peak" emphasis={{ x: top }} emphasisLabel={label} />
      </Chart.Root>
    </LocaleProvider>
  );
}

describe("S14's emphasised days", () => {
  it.each(LOCALES)("speak the dictionary's emphasis word in %s", async (locale) => {
    const words = WORDS[locale];
    const { host } = renderThemed(<S14 locale={locale} />);
    await start(host);
    const heard = await phrasesAfter([
      ["Tab", 1],
      ["End", 1],
    ]);
    expect(heard[1]).toBe(
      `option, ${date("S14 last day date", locale)}: ${words.peak} ${number("peak31", locale)} ${words.kwh}, ${words.emphasised}, not selected, position 31, set size 31`
    );
  });

  it("speak an explicit emphasisLabel in its place, as section 9.4's S14 phrase does", async () => {
    const { host } = renderThemed(<S14 locale="nb-NO" label="teller i effekttrinnet" />);
    await start(host);
    const heard = await phrasesAfter([
      ["Tab", 1],
      ["End", 1],
    ]);
    expect(heard[1]).toBe(
      `option, ${date("S14 last day date", "nb-NO")}: Høyeste time 2,2 kilowattimer, teller i effekttrinnet, not selected, position 31, set size 31`
    );
  });
});
