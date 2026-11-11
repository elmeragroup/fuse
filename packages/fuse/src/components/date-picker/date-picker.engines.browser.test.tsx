/*
 * DatePicker text in every engine: the zone name its popup time writes before any day is picked,
 * read back from a paste. Expectations are literals: Oslo's zone names and ISO values.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { waitForPopupSettled } from "../../../test/popup-settled";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { DatePickerField } from "./index";

afterEach(() => {
  vi.useRealTimers();
});

/** An empty Oslo minute picker that stays open on a pick, logging what it commits. */
function OsloPicker(): ReactElement {
  const [values, setValues] = useState<string[]>([]);
  return (
    <>
      <DatePickerField
        label="Starts"
        granularity="minute"
        hourCycle={24}
        timeZone="Europe/Oslo"
        shouldCloseOnSelect={false}
        onChange={(value) => setValues((current) => [...current, String(value)])}
      />
      <div role="log" aria-label="Changes">
        {values.join(" | ")}
      </div>
    </>
  );
}

describe("DatePicker popup time zone name in every engine", () => {
  // Before any day is picked, the popup time names Oslo's zone for today, as React Aria's empty
  // input does: GMT+2 in June, GMT+1 in January. Pasting the time as it writes it, with that name,
  // holds the time; the other name is no text the input writes. The held time commits on the day
  // picked next.
  it.each([
    {
      today: "2026-06-15T12:00:00Z",
      name: "GMT+2",
      other: "GMT+1",
      day: "Monday, June 22, 2026",
      committed: "2026-06-22T14:30:00+02:00[Europe/Oslo]",
    },
    {
      today: "2026-01-15T12:00:00Z",
      name: "GMT+1",
      other: "GMT+2",
      day: "Thursday, January 22, 2026",
      committed: "2026-01-22T14:30:00+01:00[Europe/Oslo]",
    },
  ])(
    "holds 14:30 $name pasted on $today, and ignores 14:30 $other",
    async ({ today, name, other, day, committed }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(today));
      renderThemed(withLocale("en-US", <OsloPicker />));
      await userEvent.click(roleNamed("button", "Calendar Starts"));
      await waitForPopupSettled();
      const time = page.getByRole("group", { name: "Time", exact: true });
      await expect.poll(() => time.element().textContent).toContain(name);

      const paste = (text: string) => {
        const data = new DataTransfer();
        data.setData("text/plain", text);
        roleNamed("spinbutton", "hour, Time").dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
        );
      };
      paste(`14:30 ${other}`);
      // A paste commits synchronously, so nothing has come by the next frame.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(roleNamed("spinbutton", "hour, Time").textContent).toBe("––");

      paste(`14:30 ${name}`);
      await expect
        .element(page.getByRole("spinbutton", { name: "hour, Time", exact: true }))
        .toHaveTextContent("14");
      await userEvent.click(roleNamed("button", day));

      await expect.element(page.getByRole("log", { name: "Changes" })).toHaveTextContent(committed);
    }
  );
});
