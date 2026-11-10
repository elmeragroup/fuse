/**
 * Unit under test: the segments, literals, placeholders and segment names DateField writes in
 * each Fuse locale, which every engine must write alike. Oracle: React Aria's DateField in
 * Chromium for the same locales and options (two-digit days, months and hours, as the interim
 * DateField forces; its placeholders table; `Intl.DisplayNames` field names), written out by hand.
 * The time isolates U+2066/U+2069 are React Aria's.
 */
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import "../../temporal-polyfill";
import { DateField } from "./date-field";
import type { DateFieldProps } from "./date-field";
import type { DateInputValue } from "./date-input";

const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

function mount<T extends DateInputValue>(locale: SupportedLocale, props: DateFieldProps<T>): HTMLElement {
  function Field(): ReactElement {
    return withLocale(locale, <DateField<T> label="Dato" {...props} />);
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
    const group = mount(locale, { defaultValue: "2026-10-05" });
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
    expect(mount<Temporal.PlainDateTime>(locale, { defaultValue: "2026-10-05T14:30" }).textContent).toBe(
      text
    );
  });

  it("writes an en-US date-time with its day period after the isolated time", () => {
    const group = mount<Temporal.PlainDateTime>("en-US", { defaultValue: "2026-10-05T14:30" });
    expect(group.textContent.replace(/\s/gu, " ")).toBe(`10/05/2026, ${LRI}02:30${PDI} PM`);
    expect(names(group)).toEqual(["month", "day", "year", "hour", "minute", "AM/PM"]);
  });

  it("writes an empty nb-NO date-time's time placeholders as two en dashes", () => {
    const group = mount<Temporal.PlainDateTime>("nb-NO", { granularity: "minute" });
    expect(group.textContent).toBe(`dd.mm.åååå, ${LRI}––:––${PDI}`);
    expect(names(group)).toEqual(["dag", "måned", "år", "time", "minutt"]);
  });
});
