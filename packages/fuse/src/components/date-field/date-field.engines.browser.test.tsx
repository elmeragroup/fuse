/**
 * Unit under test: the segments, literals, placeholders and segment names DateField writes in
 * each Fuse locale, which every engine must write alike. Oracle: React Aria's DateField in
 * Chromium for the same locales and options (two-digit days, months and hours, as DateField
 * forces; its placeholders table; `Intl.DisplayNames` field names), written out by hand.
 * The time isolates U+2066/U+2069 are React Aria's.
 */
import type { ReactElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { definedProps } from "../../internal/defined-props";
import type { SupportedLocale } from "../../intl/locale-context";
import "../../temporal-polyfill";
import { DateField } from "./date-field";
import type { DateFieldProps } from "./date-field";
import type { DateInputValue } from "./date-input";

const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

function mount<T extends DateInputValue>(locale: SupportedLocale, props: DateFieldProps<T>): HTMLElement {
  function Field(): ReactElement {
    return withLocale(locale, <DateField label="Dato" {...props} />);
  }
  renderThemed(<Field />);
  return roleNamed("group", "Dato");
}

/** Every editable segment's accessible name, in order. */
function names(group: HTMLElement): string[] {
  return [...group.querySelectorAll('[role="spinbutton"], [role="textbox"]')].map((element) =>
    (element.getAttribute("aria-label") ?? "").replace(/, $/u, "")
  );
}

describe("DateField text in every engine", () => {
  it.each([
    ["en-US", "10/05/2026", ["month", "day", "year"]],
    ["nb-NO", "05.10.2026", ["dag", "måned", "år"]],
    ["sv-SE", "2026-10-05", ["år", "månad", "dag"]],
    ["fi-FI", "05.10.2026", ["päivä", "kuukausi", "vuosi"]],
  ] as const)("writes a %s date as %s with its segment names", (locale, text, segmentNames) => {
    const group = mount(locale, { defaultValue: Temporal.PlainDate.from("2026-10-05") });
    expect(group.textContent).toBe(text);
    expect(names(group)).toEqual(segmentNames);
  });

  it.each([
    ["en-US", "mm/dd/yyyy"],
    ["nb-NO", "dd.mm.åååå"],
    ["sv-SE", "åååå-mm-dd"],
    ["fi-FI", "pp.kk.vvvv"],
  ] as const)("writes an empty %s date as %s", (locale, text) => {
    expect(mount(locale, {}).textContent).toBe(text);
  });

  it.each([
    ["nb-NO", `05.10.2026, ${LRI}14:30${PDI}`],
    ["sv-SE", `2026-10-05 ${LRI}14:30${PDI}`],
    ["fi-FI", `05.10.2026 klo ${LRI}14.30${PDI}`],
  ] as const)("writes a %s 24-hour date-time as %s", (locale, text) => {
    expect(mount(locale, { defaultValue: Temporal.PlainDateTime.from("2026-10-05T14:30") }).textContent).toBe(
      text
    );
  });

  it("writes an en-US date-time with its day period after the isolated time", () => {
    const group = mount("en-US", {
      defaultValue: Temporal.PlainDateTime.from("2026-10-05T14:30"),
    });
    expect(group.textContent.replace(/\s/gu, " ")).toBe(`10/05/2026, ${LRI}02:30${PDI} PM`);
    expect(names(group)).toEqual(["month", "day", "year", "hour", "minute", "AM/PM"]);
  });

  it("writes an empty nb-NO date-time's time placeholders as two en dashes", () => {
    const group = mount<Temporal.PlainDateTime>("nb-NO", { granularity: "minute" });
    expect(group.textContent).toBe(`dd.mm.åååå, ${LRI}––:––${PDI}`);
    expect(names(group)).toEqual(["dag", "måned", "år", "time", "minutt"]);
  });
});

describe("DateField zone name in every engine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // React Aria names an empty zoned field's zone for today: Oslo's summer name in June, its winter
  // one in January. The clock is read once the field has mounted, never while it renders.
  it.each([
    ["2030-06-15T12:00:00Z", "GMT+2"],
    ["2030-01-15T12:00:00Z", "GMT+1"],
  ] as const)("names an empty Oslo field's zone for today at %s as %s", async (now, name) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    const group = mount<Temporal.ZonedDateTime>("en-US", { granularity: "minute", timeZone: "Europe/Oslo" });

    await expect.poll(() => group.querySelector('[data-type="timeZoneName"]')?.textContent).toBe(name);
  });
});

describe("DateField paste in every engine", () => {
  /** Paste `text` into the group's first segment; returns what the field committed, or `[]`. */
  function pasteInto(locale: SupportedLocale, props: DateFieldProps<DateInputValue>, text: string): string[] {
    const commits: string[] = [];
    const group = mount(locale, { ...props, onChange: (value) => commits.push(String(value)) });
    const data = new DataTransfer();
    data.setData("text/plain", text);
    // The first segment, whose unit and name differ by locale; any segment takes a paste.
    group
      .querySelector('[data-slot="date-input-segment"][tabindex]')
      ?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    return commits;
  }

  // The text each locale's field writes, as the rows above pin it, reads back into its segments.
  it.each([
    ["en-US", "10/05/2026"],
    ["nb-NO", "05.10.2026"],
    ["sv-SE", "2026-10-05"],
    ["fi-FI", "5.10.2026"],
  ] as const)("commits %s text in its own format, %s, as October 5, 2026", async (locale, text) => {
    const commits = pasteInto(locale, {}, text);
    await expect.poll(() => commits).toEqual(["2026-10-05"]);
  });

  it.each([
    ["nb-NO", "05.10.2026, 14:30", {}],
    ["en-US", "10/05/2026, 2:30 PM", {}],
    ["en-US", "10/05/2026, 14:30", { hourCycle: 24 }],
  ] as const)("commits a %s date-time written %s", async (locale, text, options) => {
    const commits = pasteInto(locale, { granularity: "minute", ...options }, text);
    await expect.poll(() => commits).toEqual(["2026-10-05T14:30:00"]);
  });

  // The field's own text, as it shows a value, read back into an empty field of the same options.
  // A zoned field writes its zone's name after the time, which carries a digit of its own.
  it.each([
    ["en-US", "Europe/Oslo", 12],
    ["en-US", "Europe/Oslo", 24],
    ["nb-NO", "Europe/Oslo", undefined],
    ["sv-SE", "Europe/Oslo", undefined],
    ["fi-FI", "Europe/Oslo", undefined],
    ["en-US", "America/New_York", 12],
    ["en-US", undefined, 12],
    ["nb-NO", undefined, undefined],
    ["sv-SE", undefined, undefined],
    ["fi-FI", undefined, undefined],
  ] as const)(
    "reads back the %s field's own text in zone %s with hour cycle %s",
    async (locale, timeZone, hourCycle) => {
      const value =
        timeZone === undefined
          ? Temporal.PlainDateTime.from("2026-10-05T14:30")
          : Temporal.PlainDateTime.from("2026-10-05T14:30").toZonedDateTime(timeZone);
      const options = definedProps({ granularity: "minute", timeZone, hourCycle } as const);
      const shown = mount(locale, { ...options, defaultValue: value }).textContent;
      document.body.replaceChildren();

      const commits = pasteInto(locale, options, shown);
      await expect.poll(() => commits).toEqual([value.toString()]);
    }
  );

  // October 25, 2026 sets Oslo's clocks back at 03:00, so 02:30 comes twice: first in summer time
  // (+02:00), then in winter time (+01:00). Only the zone's name tells the two apart.
  it.each([
    ["en-US", "+02:00"],
    ["en-US", "+01:00"],
    ["nb-NO", "+02:00"],
    ["nb-NO", "+01:00"],
    ["sv-SE", "+02:00"],
    ["sv-SE", "+01:00"],
    ["fi-FI", "+02:00"],
    ["fi-FI", "+01:00"],
  ] as const)("reads back the %s field's own text for the repeated 02:30 at %s", async (locale, offset) => {
    const value = Temporal.ZonedDateTime.from(`2026-10-25T02:30${offset}[Europe/Oslo]`);
    const options = { granularity: "minute", timeZone: "Europe/Oslo" } as const;
    const shown = mount(locale, { ...options, defaultValue: value }).textContent;
    document.body.replaceChildren();

    const commits = pasteInto(locale, options, shown);
    await expect.poll(() => commits).toEqual([`2026-10-25T02:30:00${offset}[Europe/Oslo]`]);
  });

  // A day field holding a time keeps that time, which it does not show, when text sets its date,
  // as typing the date does. sv-SE writes a date as ISO text, which names a PlainDate.
  it.each([
    ["en-US", "10/12/2026", "2026-10-05T14:30", undefined, "2026-10-12T14:30:00"],
    ["en-US", "10/12/2026", "2026-10-05T14:30", 24, "2026-10-12T14:30:00"],
    [
      "en-US",
      "10/12/2026",
      "2026-10-05T14:30[Europe/Oslo]",
      undefined,
      "2026-10-12T14:30:00+02:00[Europe/Oslo]",
    ],
    ["sv-SE", "2026-10-12", "2026-10-05T14:30", undefined, "2026-10-12T14:30:00"],
    [
      "sv-SE",
      "2026-10-12",
      "2026-10-05T14:30[Europe/Oslo]",
      undefined,
      "2026-10-12T14:30:00+02:00[Europe/Oslo]",
    ],
  ] as const)(
    "sets only the date of a %s day field's %s paste over %s (hour cycle %s)",
    async (locale, text, iso, hourCycle, expected) => {
      const value = iso.includes("[") ? Temporal.ZonedDateTime.from(iso) : Temporal.PlainDateTime.from(iso);
      const commits = pasteInto(
        locale,
        { granularity: "day", defaultValue: value, ...definedProps({ hourCycle }) },
        text
      );
      await expect.poll(() => commits).toEqual([expected]);
    }
  );

  // The reading takes the whole text: between numbers only spaces and punctuation, and no letters
  // but the field's own (its literal words, its day period, its zone's name). A UTC `Z`, an ISO `T`
  // or another word than the locale's is no part of the field's text.
  it.each([
    ["sv-SE", "second", "2026-10-25T09:30:00Z"],
    ["sv-SE", "minute", "2026-10-25T09:30Z"],
    ["sv-SE", "minute", "2026-10-25 09:30 Z"],
    ["fi-FI", "minute", "25.10.2026 kello 09.30"],
    // Words match by case alone, never by accent, composed or decomposed.
    ["fi-FI", "minute", "25.10.2026 kl\u00f3 09.30"],
    ["fi-FI", "minute", "25.10.2026 klo\u0301 09.30"],
  ] as const)(
    "ignores %s %s text %s, which holds letters the field never writes",
    async (locale, granularity, text) => {
      const commits = pasteInto(locale, { granularity }, text);
      // A paste commits synchronously, so nothing has come by the next frame.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(commits).toEqual([]);
    }
  );

  it.each([
    ["sv-SE", "2026-10-25T09:30", "2026-10-25T09:30:00"],
    ["fi-FI", "25.10.2026 klo 09.30", "2026-10-25T09:30:00"],
    ["fi-FI", "25.10.2026 KLO 09.30", "2026-10-25T09:30:00"],
    ["en-US", "10/25/2026, 09:30 am", "2026-10-25T09:30:00"],
    ["en-US", "10/25/2026, 09:30 PM", "2026-10-25T21:30:00"],
  ] as const)("reads %s text %s", async (locale, text, expected) => {
    const commits = pasteInto(
      locale,
      { granularity: "minute", hourCycle: locale === "en-US" ? 12 : 24 },
      text
    );
    await expect.poll(() => commits).toEqual([expected]);
  });

  it("ignores Oslo's repeated 02:30 written with a zone name of neither of its offsets", async () => {
    const commits = pasteInto(
      "en-US",
      { granularity: "minute", timeZone: "Europe/Oslo" },
      "10/25/2026, 02:30 AM GMT+5"
    );
    // A paste commits synchronously, so nothing has come by the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(commits).toEqual([]);
  });

  it.each([
    ["en-US", "13/05/2026", "a month past 12"],
    ["en-US", "10/05", "too few fields"],
    ["nb-NO", "05.10.2026, 14:30", "a time for a date field"],
  ] as const)("ignores %s text %s, %s", async (locale, text, _why) => {
    const commits = pasteInto(locale, {}, text);
    // A paste commits synchronously, so nothing has come by the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(commits).toEqual([]);
  });
});
