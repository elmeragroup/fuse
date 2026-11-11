/*
 * DatePicker and DatePickerField in the browser: opening and closing, focus moving into the
 * calendar and back, Alt+ArrowDown, presets, time values, forms, cancelable details and the
 * computed faces of the trigger, the group and a checked preset. The consumer contract both tiers
 * share (names, typing, popup naming, preset radios) follows React Aria's; these cases cover what
 * only this tier has.
 * Expectations are literals: ISO values, accessible names, reasons.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { parentHandle } from "../../../test/parent-handle";
import type { ParentHandle } from "../../../test/parent-handle";
import { popupFocusRestored } from "../../../test/popup-focus";
import { waitForPopupSettled } from "../../../test/popup-settled";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { definedProps } from "../../internal/defined-props";
import "../../temporal-polyfill";
import type { DateInputValue } from "../date-field/date-input";
import { Field } from "../field";
import { Form } from "../form/form";
import type { DatePickerRootProps } from "./date-picker";
import { DatePicker, DatePickerField } from "./index";
import type { DatePickerPresetValue } from "./picker-change-details";

// Playwright waits for a target to stop moving before it clicks; no case here is about motion.
beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

function log() {
  return page.getByRole("log", { name: "Changes" });
}

function ChangeLog({ lines }: { readonly lines: readonly string[] }): ReactElement {
  return (
    <div role="log" aria-label="Changes">
      {lines.join(" | ")}
    </div>
  );
}

/** Choose a calendar day by keyboard once it renders: focus it and press Enter. */
async function pickDay(name: string): Promise<void> {
  await expect.element(page.getByRole("button", { name, exact: true })).toBeInTheDocument();
  roleNamed("button", name).focus();
  await userEvent.keyboard("{Enter}");
}

function segmentTexts(): string[] {
  return page
    .getByRole("spinbutton")
    .elements()
    .map((element) => element.textContent);
}

/** A DatePickerField that logs every value change and open change, with their reasons. */
function LoggedPicker({
  cancelValue = [],
  cancelOpen = [],
  ...props
}: Omit<DatePickerRootProps<DateInputValue>, "onValueChange" | "onOpenChange" | "children"> & {
  readonly cancelValue?: readonly string[];
  readonly cancelOpen?: readonly string[];
}): ReactElement {
  const [lines, setLines] = useState<string[]>([]);
  return (
    <>
      <button type="button">Before</button>
      <DatePicker.Root
        {...props}
        onValueChange={(value, details) => {
          setLines((current) => [...current, `value:${details.reason}:${value?.toString() ?? "null"}`]);
          if (cancelValue.includes(details.reason)) details.cancel();
        }}
        onOpenChange={(open, details) => {
          setLines((current) => [...current, `open:${String(open)}:${details.reason}`]);
          if (cancelOpen.includes(details.reason)) details.cancel();
        }}>
        <DatePicker.Group>
          <DatePicker.Input />
          <DatePicker.Trigger />
        </DatePicker.Group>
        <DatePicker.Popup>
          <DatePicker.Calendar />
          {/* Renders nothing in a date picker. */}
          <DatePicker.TimeInput />
        </DatePicker.Popup>
      </DatePicker.Root>
      <ChangeLog lines={lines} />
    </>
  );
}

describe("DatePicker opening and closing", () => {
  it("moves focus to the selected day on open and back to the trigger on Escape", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
      )
    );
    const trigger = roleNamed("button", "Calendar Start date");
    await userEvent.click(trigger);

    await expect
      .element(page.getByRole("dialog", { name: "Calendar Start date", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    await expect.element(log()).toHaveTextContent("open:true:trigger-press | open:false:escape-key");
  });

  it("commits a day chosen with Enter and closes with the keyboard reason", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await userEvent.keyboard("{ArrowRight}{Enter}");

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(segmentTexts()).toEqual(["10", "6", "2026"]);
    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:keyboard:2026-10-06 | open:false:keyboard");
  });
  it("returns focus to the opening segment only for a popup the picker opened itself", async () => {
    function ParentOpened(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <>
          <DatePickerField
            label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            isOpen={open}
            onOpenChange={setOpen}
          />
          <button type="button" onClick={() => setOpen(true)}>
            Show calendar
          </button>
        </>
      );
    }
    renderThemed(withLocale("en-US", <ParentOpened />));
    const year = roleNamed("spinbutton", "year, Start date");
    await userEvent.click(year);
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(year);

    await userEvent.click(roleNamed("button", "Show calendar"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(year);
  });

  it("disables the trigger of a read-only picker", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DatePickerField label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} isReadOnly />
      )
    );
    expect(roleNamed("button", "Calendar Start date")).toBeDisabled();
  });
});

describe("DatePicker values", () => {
  it("commits a date typed digit by digit into an empty picker", async () => {
    renderThemed(withLocale("en-US", <LoggedPicker aria-label="Birth date" />));
    expect(segmentTexts()).toEqual(["mm", "dd", "yyyy"]);
    await userEvent.click(page.getByRole("spinbutton").first());
    await userEvent.keyboard("03152008");

    expect(segmentTexts()).toEqual(["3", "15", "2008"]);
    // Each digit commits the date it completes; the last one is March 15, 2008.
    await expect
      .poll(() => log().element().textContent.split(" | ").at(-1))
      .toBe("value:input-change:2008-03-15");
    await expect.element(page.getByRole("spinbutton", { name: "year, Birth date" })).toHaveFocus();
  });

  it("keeps the value's time and zone when a day is picked", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          defaultValue={Temporal.ZonedDateTime.from("2026-10-05T14:30[Europe/Oslo]")}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Starts"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));

    // October 26 is after the clocks go back, so the offset changes and the wall time stays.
    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:day-press:2026-10-26T14:30:00+01:00[Europe/Oslo] | open:false:day-press"
      );
  });

  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'DatePicker.Root minValue: received the string "2026-10-01"',
      <DatePickerField
        label="Start date"
        // @ts-expect-error -- text reaches the prop past the types, as from plain JavaScript
        minValue="2026-10-01"
      />
    );
  });
});

describe("DatePicker.TimeInput", () => {
  beforeEach(() => {
    // An empty picker opens on today's month; the calendar reads today from Date.now().
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function timeSegment(unit: string) {
    return page.getByRole("spinbutton", { name: `${unit}, Time`, exact: true });
  }

  async function open(): Promise<void> {
    await userEvent.click(roleNamed("button", "Calendar Starts"));
    await waitForPopupSettled();
  }

  it("commits a day held in an empty picker at the time typed under the calendar, not at midnight", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
        />
      )
    );
    await open();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    expect(log().element().textContent).toBe("open:true:trigger-press");

    // Only the time's segments, 24-hour, with no zone name.
    const time = roleNamed("group", "Time");
    expect(time.textContent).toBe(`${String.fromCodePoint(0x2066)}––:––${String.fromCodePoint(0x2069)}`);
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("1430");

    // The time commits as soon as every segment holds a digit, as the picker's own input does.
    const committed =
      "open:true:trigger-press | value:input-change:2026-10-12T14:03:00+02:00[Europe/Oslo] | value:input-change:2026-10-12T14:30:00+02:00[Europe/Oslo]";
    await expect.element(log()).toHaveTextContent(committed);
    expect(segmentTexts()).toEqual(["10", "12", "2026", "14", "30", "14", "30"]);
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(log().element().textContent).toBe(`${committed} | open:false:escape-key`);
  });

  it("keeps every time digit typed for a held day whose offset differs from today's", async () => {
    // Today, October 15, is summer time in Oslo; October 26 is after the clocks go back.
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
        />
      )
    );
    await open();
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("1430");

    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:input-change:2026-10-26T14:03:00+01:00[Europe/Oslo] | value:input-change:2026-10-26T14:30:00+01:00[Europe/Oslo]"
      );
  });

  it("steps the popup hour of a time typed before a DST day through that day's repeated hour", async () => {
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter time.
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
        />
      )
    );
    await open();
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("0230");
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("{ArrowUp}");

    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:day-press:2026-10-25T02:30:00+02:00[Europe/Oslo] | value:input-change:2026-10-25T02:30:00+01:00[Europe/Oslo]"
      );
  });

  it("steps a half-cleared popup time on the day picked since, through its repeated DST hour", async () => {
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter time.
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="second"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          defaultValue={Temporal.ZonedDateTime.from("2026-10-24T02:30:00+02:00[Europe/Oslo]")}
        />
      )
    );
    await open();
    await userEvent.click(timeSegment("second"));
    await userEvent.keyboard("{Backspace}");
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.click(timeSegment("second"));
    await userEvent.keyboard("00");

    await expect
      .poll(() => log().element().textContent.split(" | ").at(-1))
      .toBe("value:input-change:2026-10-25T02:30:00+01:00[Europe/Oslo]");
  });

  it("keeps a popup time stepped to the repeated hour's later instant when its day is picked again", async () => {
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter
    // time. React Aria moves a picked day under its time with `ZonedDateTime.set`, which keeps a value
    // whose wall clock the day leaves unchanged.
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
        />
      )
    );
    await open();
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("0230");
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("{ArrowUp}");
    await expect
      .poll(() => log().element().textContent.split(" | ").at(-1))
      .toBe("value:input-change:2026-10-25T02:30:00+01:00[Europe/Oslo]");
    await userEvent.click(page.getByRole("button", { name: /^Sunday, October 25, 2026/u }));

    await expect
      .poll(() => log().element().textContent.split(" | ").at(-1))
      .toBe("value:day-press:2026-10-25T02:30:00+01:00[Europe/Oslo]");
  });

  it("commits nothing for a UTC time pasted into the popup time, which names no wall time", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          defaultValue={Temporal.ZonedDateTime.from("2026-10-05T08:00:00+02:00[Europe/Oslo]")}
        />
      )
    );
    await open();
    const data = new DataTransfer();
    data.setData("text/plain", "09:30Z");
    roleNamed("spinbutton", "hour, Time").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
    );
    // A paste commits synchronously, so nothing has come by the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(log().element().textContent).toBe("open:true:trigger-press");
  });

  describe("a time held before a day, across a change of the empty picker's zone or kind", () => {
    /** An empty Oslo picker whose parent switches its `timeZone` to `to`, logging its values. */
    function Switching({ to }: { readonly to: string | undefined }): ReactElement {
      const [zone, setZone] = useState<string | undefined>("Europe/Oslo");
      const [values, setValues] = useState<string[]>([]);
      return (
        <>
          <button type="button" onClick={() => setZone(to)}>
            Switch
          </button>
          <DatePickerField
            label="Starts"
            granularity="minute"
            hourCycle={24}
            shouldCloseOnSelect={false}
            {...definedProps({ timeZone: zone })}
            onChange={(value) => setValues((current) => [...current, String(value)])}
          />
          <ChangeLog lines={values} />
        </>
      );
    }

    // The held time is a wall time: 09:30 on November 11 in the picker's zone and kind at the pick.
    it.each([
      {
        change: "zone to New York",
        to: "America/New_York",
        expected: "2026-11-11T09:30:00-05:00[America/New_York]",
      },
      { change: "kind to a plain date-time", to: undefined, expected: "2026-11-11T09:30:00" },
    ])("commits the held 09:30 on the day picked after its $change", async ({ to, expected }) => {
      renderThemed(withLocale("en-US", <Switching to={to} />));
      await userEvent.click(roleNamed("button", "Calendar Starts"));
      await waitForPopupSettled();
      await userEvent.click(timeSegment("hour"));
      await userEvent.keyboard("0930");

      // `click()` switches without moving focus, so the popup stays open.
      roleNamed("button", "Switch").click();
      await expect.element(timeSegment("hour")).toHaveTextContent("09");
      expect(roleNamed("spinbutton", "minute, Time").textContent).toBe("30");
      // The month button pages to November; the popup repositions after the switch, so the month
      // button and the days are reached without a pointer.
      roleNamed("button", "Next").click();
      await pickDay("Wednesday, November 11, 2026");

      await expect.element(log()).toHaveTextContent(expected);
      expect(log().element().textContent).toBe(expected);
    });
  });

  describe("the popup time on October 25, 2026 in Oslo, whose 02:00–03:00 comes twice", () => {
    // From the popup time 02:30:–– (seconds empty) on October 25, each gesture edits the time; the
    // seconds then filled commit it. Expected values worked out by hand from Oslo's rules: the
    // clocks go back at 03:00+02:00 to 02:00+01:00, so the hour after 02:30 summer time is 02:30
    // winter time, and October 25 at 23:30 is winter time.
    const GESTURES = [
      { name: "ArrowUp on the hour", keys: "{ArrowUp}", expected: "2026-10-25T02:30:00+01:00" },
      {
        name: "ArrowUp twice and ArrowDown on the hour",
        keys: "{ArrowUp}{ArrowUp}{ArrowDown}",
        expected: "2026-10-25T02:30:00+01:00",
      },
      {
        name: "03 typed, then ArrowDown on the hour",
        keys: "03{ArrowLeft}{ArrowDown}",
        expected: "2026-10-25T02:30:00+01:00",
      },
      { name: "End on the hour", keys: "{End}", expected: "2026-10-25T23:30:00+01:00" },
      { name: "Home on the hour", keys: "{Home}", expected: "2026-10-25T00:30:00+02:00" },
    ] as const;

    /** The picker, empty with October 25 picked, or holding October 25 at 02:30 with its seconds cleared. */
    async function startAt0230(start: "empty" | "filled"): Promise<void> {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="second"
            hourCycle={24}
            hideTimeZone
            shouldCloseOnSelect={false}
            timeZone="Europe/Oslo"
            {...definedProps({
              defaultValue:
                start === "filled"
                  ? Temporal.ZonedDateTime.from("2026-10-25T02:30:00+02:00[Europe/Oslo]")
                  : undefined,
            })}
          />
        )
      );
      await open();
      if (start === "empty") {
        await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
        await userEvent.click(timeSegment("hour"));
        await userEvent.keyboard("0230");
      } else {
        await userEvent.click(timeSegment("second"));
        await userEvent.keyboard("{Backspace}");
      }
      await expect.element(timeSegment("second")).toHaveTextContent("––");
    }

    const lastCommit = () => log().element().textContent.split(" | ").at(-1);

    /** Paste `text` into the popup time's hour, without moving focus. */
    function pasteTime(text: string): void {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      roleNamed("spinbutton", "hour, Time").dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
      );
    }

    for (const start of ["empty", "filled"] as const) {
      it.each(GESTURES)(`$name from a ${start} picker`, async ({ keys, expected }) => {
        await startAt0230(start);
        await userEvent.click(timeSegment("hour"));
        await userEvent.keyboard(keys);
        await userEvent.click(timeSegment("second"));
        await userEvent.keyboard("00");

        await expect.poll(lastCommit).toBe(`value:input-change:${expected}[Europe/Oslo]`);
      });

      // A time-only input takes only the wall time of ISO text; the clipboard's date, zone and
      // offset are dropped. 02:30:15 on October 25 resolves as typed 02:30:15 does: to the earlier,
      // summer-time instant of the repeated hour (Temporal's "compatible"), +02:00. On March 29,
      // the clipboard's date, 02:30 falls in the spring-forward gap and would resolve to 03:30.
      // The clipboard's zone is dropped with its date: zoned or not, the text names 02:30:15.
      it.each([
        "2026-03-29T02:30:15",
        "2026-03-29T02:30:15[Europe/Oslo]",
        "2026-03-29T02:30:15+01:00[Europe/Oslo]",
      ])(`pastes the wall time of ISO text %s onto October 25 in a ${start} picker`, async (text) => {
        await startAt0230(start);
        pasteTime(text);

        await expect.poll(lastCommit).toBe("value:input-paste:2026-10-25T02:30:15+02:00[Europe/Oslo]");
      });

      // A UTC time names an instant, not a wall time, and a date names no time at all: neither is
      // read as the field's own text either, so nothing commits.
      it.each(["2026-10-25T02:30:15Z", "0010-05-01"])(
        `commits nothing for ISO text %s in a ${start} picker`,
        async (text) => {
          await startAt0230(start);
          pasteTime(text);
          // A paste commits synchronously, so nothing has come by the next frame.
          await new Promise((resolve) => requestAnimationFrame(resolve));

          expect(log().element().textContent).toBe("open:true:trigger-press");
        }
      );

      it(`pastes a time on October 25 into a ${start} picker`, async () => {
        await startAt0230(start);
        const data = new DataTransfer();
        data.setData("text/plain", "02:30:15");
        roleNamed("spinbutton", "hour, Time").dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
        );

        await expect.poll(lastCommit).toBe("value:input-paste:2026-10-25T02:30:15+02:00[Europe/Oslo]");
      });
    }

    it("pastes an ISO time from the March 29 gap onto October 25, as typed there, from a held day", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="minute"
            hourCycle={24}
            hideTimeZone
            shouldCloseOnSelect={false}
            timeZone="Europe/Oslo"
          />
        )
      );
      await open();
      await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
      const data = new DataTransfer();
      data.setData("text/plain", "2026-03-29T02:30");
      roleNamed("spinbutton", "hour, Time").dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
      );

      // Typed 02:30 on October 25 is the earlier, summer-time 02:30.
      await expect.poll(lastCommit).toBe("value:input-paste:2026-10-25T02:30:00+02:00[Europe/Oslo]");
    });

    // 02:30 does not exist on March 29, 2026 in Oslo: the clocks go from 02:00 to 03:00. Typed,
    // such a time stays a draft until blur constrains it; pasted, it commits nothing either.
    it.each<{
      readonly how: string;
      readonly enter: () => void | Promise<void>;
      readonly shown: readonly string[];
    }>([
      {
        how: "pasted as ISO text dated October 25",
        enter: () => pasteTime("2026-10-25T02:30:00"),
        shown: ["01", "00", "00"],
      },
      {
        how: "pasted as ISO text in Oslo's zone",
        enter: () => pasteTime("2026-03-29T02:30:00[Europe/Oslo]"),
        shown: ["01", "00", "00"],
      },
      {
        how: "typed into the cleared hour and the minute",
        enter: async () => {
          await userEvent.click(timeSegment("hour"));
          await userEvent.keyboard("{Backspace}2");
          await userEvent.click(timeSegment("minute"));
          await userEvent.keyboard("30");
        },
        shown: ["02", "30", "00"],
      },
    ])("commits nothing for 02:30 on March 29 $how", async ({ enter, shown }) => {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="second"
            hourCycle={24}
            hideTimeZone
            shouldCloseOnSelect={false}
            defaultValue={Temporal.ZonedDateTime.from("2026-03-29T01:00:00+01:00[Europe/Oslo]")}
          />
        )
      );
      await open();
      await enter();

      await expect.element(timeSegment("minute")).toHaveTextContent(shown[1] ?? "");
      expect(log().element().textContent).toBe("open:true:trigger-press");
      expect(segmentTexts().slice(-3)).toEqual(shown);
    });

    it("steps the time typed for October 24 on October 25 once that day is picked", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="second"
            hourCycle={24}
            hideTimeZone
            shouldCloseOnSelect={false}
            timeZone="Europe/Oslo"
          />
        )
      );
      await open();
      await userEvent.click(roleNamed("button", "Saturday, October 24, 2026"));
      await userEvent.click(timeSegment("hour"));
      await userEvent.keyboard("0230");
      await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
      await userEvent.click(timeSegment("hour"));
      await userEvent.keyboard("{ArrowUp}");
      await userEvent.click(timeSegment("second"));
      await userEvent.keyboard("00");

      await expect.poll(lastCommit).toBe("value:input-change:2026-10-25T02:30:00+01:00[Europe/Oslo]");
    });
  });

  describe("a day picked over a time, on October 25, 2026 in Oslo, whose 02:00–03:00 comes twice", () => {
    // React Aria moves a picked day under the time it held with `ZonedDateTime.set`: a wall clock
    // that changes resolves as typed (the earlier, summer-time instant of a repeated hour), and one
    // that does not keeps the value as it is.
    const winter = "2026-10-25T02:30:00+01:00[Europe/Oslo]";

    async function pickOver(value: string): Promise<void> {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="minute"
            hourCycle={24}
            defaultValue={Temporal.ZonedDateTime.from(value)}
          />
        )
      );
      await open();
      if (!value.startsWith("2026-10")) await userEvent.click(roleNamed("button", "Previous"));
      await userEvent.click(page.getByRole("button", { name: /^Sunday, October 25, 2026/u }));
    }

    it("moves a winter-time 02:30 to the repeated hour's earlier instant", async () => {
      await pickOver("2026-11-01T02:30+01:00[Europe/Oslo]");

      await expect
        .element(log())
        .toHaveTextContent(
          "open:true:trigger-press | value:day-press:2026-10-25T02:30:00+02:00[Europe/Oslo] | open:false:day-press"
        );
    });

    it("keeps the later instant of the repeated hour when its own day is picked again", async () => {
      await pickOver(winter);
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

      // React Aria commits nothing for the value it already holds; picked as typed, the value would
      // move to the earlier instant, +02:00.
      expect(log().element().textContent).not.toContain("+02:00");
    });
  });

  it("keeps a value's own zone when a day is picked, whatever the Root's timeZone", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          timeZone="Europe/Oslo"
          defaultValue={Temporal.ZonedDateTime.from("2026-10-22T17:30[America/New_York]")}
        />
      )
    );
    await open();
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));

    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:day-press:2026-10-26T17:30:00-04:00[America/New_York] | open:false:day-press"
      );
  });

  describe("a controlled value the parent changes while the popup is open", () => {
    /** A controlled New York picker under an Oslo `timeZone`, whose value the test sets through `parent`. */
    function Changing({
      parent,
    }: {
      readonly parent: ParentHandle<Temporal.ZonedDateTime | null>;
    }): ReactElement {
      const [value, setValue] = useState<Temporal.ZonedDateTime | null>(
        Temporal.ZonedDateTime.from("2026-10-22T09:00[America/New_York]")
      );
      const [lines, setLines] = useState<string[]>([]);
      useEffect(() => {
        parent.bind(setValue);
      }, [parent]);
      return (
        <>
          <DatePickerField
            label="Starts"
            granularity="minute"
            hourCycle={24}
            timeZone="Europe/Oslo"
            shouldCloseOnSelect={false}
            value={value}
            onChange={(changed) => {
              setLines((current) => [...current, String(changed)]);
              setValue(changed);
            }}
          />
          <ChangeLog lines={lines} />
        </>
      );
    }

    // A cleared picker keeps the kind its value named, its zone too, whatever `timeZone` says
    // (`resolveValueKind`), so the popup time forms in New York, as the picker's own input does.
    it("forms a time typed after the parent clears a New York value in the picker's kind, every digit kept", async () => {
      const parent = parentHandle<Temporal.ZonedDateTime | null>();
      renderThemed(withLocale("en-US", <Changing parent={parent} />));
      await open();
      parent.set(null);
      await expect.element(timeSegment("hour")).toHaveTextContent("––");
      // The popup repositions after the change, so its parts are reached without a pointer.
      await popupFocusRestored();
      roleNamed("spinbutton", "hour, Time").focus();
      await userEvent.keyboard("1730");
      await pickDay("Monday, October 26, 2026");

      await expect.element(log()).toHaveTextContent("2026-10-26T17:30:00-04:00[America/New_York]");
      expect(log().element().textContent).toBe("2026-10-26T17:30:00-04:00[America/New_York]");
    });

    it("drops a half-typed time when the parent moves the value to another zone, and forms the next in that zone", async () => {
      const parent = parentHandle<Temporal.ZonedDateTime | null>();
      renderThemed(withLocale("en-US", <Changing parent={parent} />));
      await open();
      await userEvent.click(timeSegment("hour"));
      await userEvent.keyboard("{Backspace}");
      await expect.element(timeSegment("hour")).toHaveTextContent("––");

      parent.set(Temporal.ZonedDateTime.from("2026-10-22T09:00[Asia/Tokyo]"));
      await expect.element(timeSegment("hour")).toHaveTextContent("09");
      await popupFocusRestored();
      roleNamed("spinbutton", "hour, Time").focus();
      await userEvent.keyboard("1730");

      await expect
        .poll(() => log().element().textContent.split(" | ").at(-1))
        .toBe("2026-10-22T17:30:00+09:00[Asia/Tokyo]");
    });
  });

  it("holds a time typed before any day, and commits it with the day pressed next", async () => {
    renderThemed(
      withLocale("en-US", <LoggedPicker aria-label="Starts" granularity="minute" hourCycle={24} />)
    );
    await open();
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("0915");
    expect(log().element().textContent).toBe("open:true:trigger-press");

    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:day-press:2026-10-20T09:15:00 | open:false:day-press"
      );
  });

  it("names the zone of a time held before any day for today, as the empty input does", async () => {
    // React Aria names an empty zoned input's zone for today: Oslo's summer name in June. A time
    // typed before any day is no January value, so it keeps June's name, and so does the day
    // picked next.
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          hourCycle={24}
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
        />
      )
    );
    await open();
    // The zone name is a segment of no editable role, found by its public `data-type`.
    const zoneName = () =>
      roleNamed("group", "Time").querySelector('[data-type="timeZoneName"]')?.textContent;
    await expect.poll(zoneName).toBe("GMT+2");

    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("0930");
    await expect.element(timeSegment("minute")).toHaveTextContent("30");
    expect(log().element().textContent).toBe("open:true:trigger-press");
    expect(zoneName()).toBe("GMT+2");
    // The screen-reader text names the zone the segments show.
    await expect
      .element(roleNamed("group", "Time"))
      .toHaveAccessibleDescription("Selected Time: 09:30\u00a0GMT+2");

    await userEvent.click(roleNamed("button", "Monday, June 22, 2026"));
    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:day-press:2026-06-22T09:30:00+02:00[Europe/Oslo]");
    expect(zoneName()).toBe("GMT+2");
    await expect
      .element(roleNamed("group", "Time"))
      .toHaveAccessibleDescription("Selected Time: 09:30\u00a0GMT+2");
  });

  it("changes only the time of a value, and keeps it when the time is cleared", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          hourCycle={12}
          defaultValue={Temporal.PlainDateTime.from("2026-10-05T09:30")}
        />
      )
    );
    await open();
    await userEvent.click(timeSegment("AM/PM"));
    await userEvent.keyboard("p");
    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:input-change:2026-10-05T21:30:00");

    // Clearing every time segment would leave no time: the value keeps its own, shown again.
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("{Backspace}{Backspace}");
    await userEvent.click(timeSegment("minute"));
    await userEvent.keyboard("{Backspace}{Backspace}");
    await userEvent.click(timeSegment("AM/PM"));
    await userEvent.keyboard("{Backspace}");

    // Each segment empties into the draft, so no new time commits before the last one clears.
    await expect.element(timeSegment("AM/PM")).toHaveTextContent("PM");
    expect(log().element().textContent).toBe(
      "open:true:trigger-press | value:input-change:2026-10-05T21:30:00"
    );
    expect(segmentTexts().slice(-3)).toEqual(["9", "30", "PM"]);
  });

  it("drops a half-typed time on a native form reset, showing the value's time again", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DatePickerField
            label="Starts"
            hourCycle={12}
            defaultValue={Temporal.PlainDateTime.from("2026-10-05T09:30")}
          />
        </form>
      )
    );
    await open();
    await userEvent.click(timeSegment("hour"));
    await userEvent.keyboard("{Backspace}{Backspace}");
    await expect.element(timeSegment("hour")).toHaveTextContent("––");

    // `reset()` moves no focus, so the popup stays open over the reset.
    formNamed("Booking").reset();

    await expect.element(timeSegment("hour")).toHaveTextContent("09");
    expect(roleNamed("group", "Time").textContent).toContain("09:30");
  });

  it("renders nothing in a date picker or at day granularity", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <LoggedPicker aria-label="Starts" defaultOpen />
          <LoggedPicker
            aria-label="Ends"
            granularity="day"
            defaultValue={Temporal.PlainDateTime.from("2026-10-05T09:30")}
            defaultOpen
          />
        </>
      )
    );
    await expect.element(page.getByRole("dialog").first()).toBeVisible();
    expect(page.getByRole("group", { name: "Time", exact: true }).query()).toBeNull();
  });
});

describe("DatePicker presets", () => {
  /** A preset's label, its hit area: the radio inside it is visually hidden. */
  function presetLabel(name: string): HTMLLabelElement {
    const label = roleNamed("radio", name).closest("label");
    if (label === null) throw new Error(`expected the label of preset ${name}`);
    return label;
  }

  it("syncs a controlled preset with the value and calendar, and closes on a double-click", async () => {
    const closes: string[] = [];
    function Presets(): ReactElement {
      const [preset, setPreset] = useState<string | null>(null);
      const [value, setValue] = useState<Temporal.PlainDate | null>(Temporal.PlainDate.from("2026-10-05"));
      return (
        <DatePicker.Root
          aria-label="Start date"
          value={value}
          onValueChange={setValue}
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open) closes.push(details.reason);
          }}>
          <DatePicker.Group>
            <DatePicker.Input />
            <DatePicker.Trigger />
          </DatePicker.Group>
          <DatePicker.Popup>
            <DatePicker.Presets
              value={preset}
              onValueChange={(next) => {
                setPreset(next);
                setValue(Temporal.PlainDate.from(next === "christmas" ? "2026-12-24" : "2026-10-31"));
              }}>
              <DatePicker.PresetItem value="christmas" closeOnDoubleClick>
                Christmas Eve
              </DatePicker.PresetItem>
              <DatePicker.PresetItem value="halloween" disabled>
                Halloween
              </DatePicker.PresetItem>
            </DatePicker.Presets>
            <DatePicker.Calendar />
          </DatePicker.Popup>
        </DatePicker.Root>
      );
    }
    renderThemed(withLocale("en-US", <Presets />));
    await waitForPopupSettled();
    expect(roleNamed("radio", "Halloween")).toBeDisabled();

    await userEvent.click(presetLabel("Christmas Eve"));
    await expect.element(page.getByRole("radio", { name: "Christmas Eve", exact: true })).toBeChecked();
    await expect.element(page.getByRole("grid", { name: "December 2026", exact: true })).toBeVisible();
    expect(segmentTexts()).toEqual(["12", "24", "2026"]);
    expect(closes).toEqual([]);

    await userEvent.dblClick(presetLabel("Christmas Eve"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(closes).toEqual(["preset-press"]);
  });

  it("reports a pressed preset with its reason and keeps the checked preset when canceled", async () => {
    const reports: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DatePicker.Root
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          defaultOpen>
          <DatePicker.Popup>
            <DatePicker.Presets
              defaultValue="today"
              onValueChange={(value, details) => {
                reports.push(`${value}:${details.reason}`);
                if (value === "tomorrow") details.cancel();
              }}>
              <DatePicker.PresetItem value="today">Today</DatePicker.PresetItem>
              <DatePicker.PresetItem value="tomorrow">Tomorrow</DatePicker.PresetItem>
            </DatePicker.Presets>
            <DatePicker.Calendar />
          </DatePicker.Popup>
        </DatePicker.Root>
      )
    );
    await waitForPopupSettled();
    await userEvent.click(presetLabel("Tomorrow"));
    expect(reports).toEqual(["tomorrow:preset-press"]);
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeChecked();
  });

  it("sets a preset's dateValue through onValueChange as a preset-press, which a cancel refuses whole", async () => {
    const presetReports: string[] = [];
    function PresetValues(): ReactElement {
      const [lines, setLines] = useState<string[]>([]);
      return (
        <>
          <DatePicker.Root
            aria-label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            defaultOpen
            onValueChange={(value, details) => {
              setLines((current) => [...current, `value:${details.reason}:${value?.toString() ?? "null"}`]);
              if (value?.toString() === "2026-10-31") details.cancel();
            }}
            onOpenChange={(open, details) => {
              setLines((current) => [...current, `open:${String(open)}:${details.reason}`]);
            }}>
            <DatePicker.Group>
              <DatePicker.Input />
            </DatePicker.Group>
            <DatePicker.Popup>
              <DatePicker.Presets onValueChange={(value) => presetReports.push(value)}>
                <DatePicker.PresetItem
                  value="christmas"
                  dateValue={Temporal.PlainDate.from("2026-12-24")}
                  closeOnDoubleClick>
                  Christmas Eve
                </DatePicker.PresetItem>
                <DatePicker.PresetItem value="halloween" dateValue={Temporal.PlainDate.from("2026-10-31")}>
                  Halloween
                </DatePicker.PresetItem>
              </DatePicker.Presets>
              <DatePicker.Calendar />
            </DatePicker.Popup>
          </DatePicker.Root>
          <ChangeLog lines={lines} />
        </>
      );
    }
    renderThemed(withLocale("en-US", <PresetValues />));
    await waitForPopupSettled();

    // The picker refuses Halloween: the value and the checked preset stay, and the pane is never asked.
    await userEvent.click(presetLabel("Halloween"));
    await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-31");
    expect(presetReports).toEqual([]);
    expect(roleNamed("radio", "Halloween")).not.toBeChecked();
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);

    await userEvent.dblClick(presetLabel("Christmas Eve"));
    await expect.element(log()).toHaveTextContent(
      // A double-click is two presses: the second applies the now-checked preset again.
      "value:preset-press:2026-10-31 | value:preset-press:2026-12-24 | value:preset-press:2026-12-24 | open:false:preset-press"
    );
    expect(presetReports).toEqual(["christmas"]);
    expect(segmentTexts()).toEqual(["12", "24", "2026"]);
  });

  describe("dateValue presets and the pane's checked key", () => {
    const DATED = { Payday: "2026-10-12", "Next Monday": "2026-10-12", Halloween: "2026-10-31" } as const;

    /**
     * An open picker on October 5 with three `dateValue` presets, logging the picker's and the
     * pane's changes. `paneKey` fixes a controlled pane's key, which its parent never changes.
     */
    function Rules({
      paneKey,
      keyed = false,
      cancel,
    }: {
      readonly paneKey?: string;
      /** A controlled pane whose parent sets the key its `onValueChange` reports. */
      readonly keyed?: boolean;
      readonly cancel?: "picker" | "pane";
    }): ReactElement {
      const [key, setKey] = useState<string | null>(null);
      const [lines, setLines] = useState<string[]>([]);
      const log = (line: string) => setLines((current) => [...current, line]);
      return (
        <>
          <DatePicker.Root
            aria-label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            defaultOpen
            shouldCloseOnSelect={false}
            onValueChange={(value, details) => {
              log(`value:${details.reason}:${value?.toString() ?? "null"}`);
              if (cancel === "picker") details.cancel();
            }}>
            <DatePicker.Group>
              <DatePicker.Input />
            </DatePicker.Group>
            <DatePicker.Popup>
              <DatePicker.Presets
                {...definedProps({ value: keyed ? key : paneKey })}
                onValueChange={(next, details) => {
                  log(`pane:${next}`);
                  if (cancel === "pane") details.cancel();
                  else if (keyed) setKey(next);
                }}>
                {Object.entries(DATED).map(([name, iso]) => (
                  <DatePicker.PresetItem key={name} value={name} dateValue={Temporal.PlainDate.from(iso)}>
                    {name}
                  </DatePicker.PresetItem>
                ))}
              </DatePicker.Presets>
              <DatePicker.Calendar />
            </DatePicker.Popup>
          </DatePicker.Root>
          <ChangeLog lines={lines} />
        </>
      );
    }

    /** The checked presets, by radio and by label, which must agree. */
    function checkedPresets(): string[] {
      return Object.keys(DATED).flatMap((name) => {
        const radio = roleNamed("radio", name).matches(":checked");
        const label = presetLabel(name).hasAttribute("data-checked");
        return radio || label ? [`${name}${radio === label ? "" : ":disagree"}`] : [];
      });
    }

    it("re-applies a checked preset pressed again, and keeps a controlled key as the parent set it", async () => {
      renderThemed(withLocale("en-US", <Rules paneKey="Payday" />));
      await waitForPopupSettled();
      expect(checkedPresets()).toEqual(["Payday"]);

      // Already checked: no radio change, but the press still sets the picker's value.
      await userEvent.click(presetLabel("Payday"));
      await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-12");

      await userEvent.click(roleNamed("button", "Tuesday, October 13, 2026"));
      expect(checkedPresets()).toEqual(["Payday"]);
      await userEvent.click(presetLabel("Payday"));

      await userEvent.click(roleNamed("button", "Wednesday, October 14, 2026"));
      roleNamed("radio", "Payday").focus();
      await userEvent.keyboard(" ");
      await expect
        .element(log())
        .toHaveTextContent(
          "value:preset-press:2026-10-12 | value:day-press:2026-10-13 | value:preset-press:2026-10-12 | value:day-press:2026-10-14 | value:preset-press:2026-10-12"
        );
      expect(checkedPresets()).toEqual(["Payday"]);
    });

    it("unchecks its own key when a day is pressed or the input is typed, and a press applies it again", async () => {
      renderThemed(withLocale("en-US", <Rules />));
      await waitForPopupSettled();
      await userEvent.click(presetLabel("Payday"));
      await expect.poll(checkedPresets).toEqual(["Payday"]);

      await userEvent.click(roleNamed("button", "Tuesday, October 13, 2026"));
      await expect.poll(checkedPresets).toEqual([]);

      await userEvent.click(presetLabel("Payday"));
      await expect.poll(checkedPresets).toEqual(["Payday"]);
      // Focus moves from the popup to the input without a press, which keeps the popup open.
      roleNamed("spinbutton", "day, Start date").focus();
      await userEvent.keyboard("15");
      await expect.poll(checkedPresets).toEqual([]);
      expect(log().element().textContent).toBe(
        "value:preset-press:2026-10-12 | pane:Payday | value:day-press:2026-10-13 | value:preset-press:2026-10-12 | pane:Payday | value:input-change:2026-10-01 | value:input-change:2026-10-15"
      );
    });

    it("re-applies a checked preset by a pointer press after Space re-applied it", async () => {
      renderThemed(withLocale("en-US", <Rules paneKey="Payday" />));
      await waitForPopupSettled();
      roleNamed("radio", "Payday").focus();
      await userEvent.keyboard(" ");
      await userEvent.click(roleNamed("button", "Tuesday, October 13, 2026"));
      await userEvent.click(presetLabel("Payday"));

      await expect
        .element(log())
        .toHaveTextContent(
          "value:preset-press:2026-10-12 | value:day-press:2026-10-13 | value:preset-press:2026-10-12"
        );
    });

    it("applies a preset by Enter, unchecked or already checked", async () => {
      renderThemed(withLocale("en-US", <Rules />));
      await waitForPopupSettled();
      roleNamed("radio", "Halloween").focus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(checkedPresets).toEqual(["Halloween"]);

      await userEvent.click(roleNamed("button", "Tuesday, October 13, 2026"));
      await expect.poll(checkedPresets).toEqual([]);
      roleNamed("radio", "Halloween").focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Enter}");

      await expect.poll(checkedPresets).toEqual(["Halloween"]);
      expect(log().element().textContent).toBe(
        "value:preset-press:2026-10-31 | pane:Halloween | value:day-press:2026-10-13 | value:preset-press:2026-10-31 | pane:Halloween | value:preset-press:2026-10-31"
      );
    });

    it("refuses the whole press when the picker cancels its value: the pane is never asked", async () => {
      renderThemed(withLocale("en-US", <Rules keyed cancel="picker" />));
      await waitForPopupSettled();
      await userEvent.click(presetLabel("Halloween"));

      await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-31");
      expect(log().element().textContent).toBe("value:preset-press:2026-10-31");
      expect(checkedPresets()).toEqual([]);
      expect(segmentTexts()).toEqual(["10", "5", "2026"]);
    });

    it("commits the value but keeps the checked key when the pane cancels it", async () => {
      renderThemed(withLocale("en-US", <Rules keyed cancel="pane" />));
      await waitForPopupSettled();
      await userEvent.click(presetLabel("Halloween"));

      await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-31 | pane:Halloween");
      expect(checkedPresets()).toEqual([]);
      expect(segmentTexts()).toEqual(["10", "31", "2026"]);
    });

    it("checks only the pressed one of two presets on one date", async () => {
      renderThemed(withLocale("en-US", <Rules />));
      await waitForPopupSettled();
      await userEvent.click(presetLabel("Payday"));
      await expect.poll(checkedPresets).toEqual(["Payday"]);
      await userEvent.click(presetLabel("Next Monday"));

      await expect.poll(checkedPresets).toEqual(["Next Monday"]);
      expect(log().element().textContent).toBe(
        "value:preset-press:2026-10-12 | pane:Payday | value:preset-press:2026-10-12 | pane:Next Monday"
      );
    });
  });
});

describe("DatePickerField in forms", () => {
  it("submits the ISO value under its name and focuses the first segment for a returned error", async () => {
    let submitted: unknown;
    function Booking(): ReactElement {
      const [errors, setErrors] = useState<Record<string, string>>({});
      return withLocale(
        "en-US",
        <Form
          aria-label="Booking"
          errors={errors}
          onFormSubmit={(values) => {
            submitted = values;
            setErrors({ start: "Fully booked" });
          }}>
          <DatePickerField
            label="Start date"
            name="start"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
          />
          <button type="submit">Save</button>
        </Form>
      );
    }
    renderThemed(<Booking />);
    expect(new FormData(formNamed("Booking")).get("start")).toBe("2026-10-05");

    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toEqual({ start: "2026-10-05" });
    await expect.element(page.getByText("Fully booked", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");

    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await expect.element(page.getByText("Fully booked", { exact: true })).not.toBeInTheDocument();
  });

  it("restores its default value on form reset", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DatePickerField
            label="Start date"
            name="start"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
          />
          <button type="reset">Reset</button>
        </form>
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    expect(segmentTexts()).toEqual(["10", "12", "2026"]);

    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);
  });
});

describe("DatePicker held day and the close transaction", () => {
  // An empty picker opens on today's month; the calendar reads today from Date.now().
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays open with the day still held when the close's commit is canceled", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
          cancelValue={["day-press"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Starts"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.keyboard("{Escape}");

    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:day-press:2026-10-12T00:00:00+02:00[Europe/Oslo]");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Monday, October 12, 2026 selected", exact: true }))
      .toBeVisible();
  });

  it("commits the held day to the onChange of the render that closes the popup", async () => {
    const calls: string[] = [];
    function Controlled({ open, tag }: { readonly open: boolean; readonly tag: string }): ReactElement {
      return withLocale(
        "en-US",
        <DatePickerField
          aria-label="Starts"
          granularity="minute"
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          isOpen={open}
          onChange={(value) => calls.push(`${tag}:${String(value)}`)}
        />
      );
    }
    const { rerender } = renderThemed(<Controlled open tag="old" />);
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    rerender(<Controlled open={false} tag="new" />);
    await expect.poll(() => calls).toEqual(["new:2026-10-12T00:00:00+02:00[Europe/Oslo]"]);
  });
});

describe("DatePicker form reset", () => {
  it("empties a half-typed picker whose value stays empty, and forgets its shown error", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DatePickerField label="Start date" name="start" />
          <button type="button">After</button>
          <button type="reset">Reset</button>
        </form>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "month, Start date"));
    await userEvent.keyboard("10");
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByText(/The field is incomplete/u)).toBeVisible();
    expect(segmentTexts()).toEqual(["10", "dd", "yyyy"]);

    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy"]);
    await expect.element(page.getByText(/The field is incomplete/u)).not.toBeInTheDocument();
    expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");
  });
});

describe("DatePicker focus boundary", () => {
  it.each([
    ["end", "After", 1],
    ["start", "month, Start date", 0],
  ] as const)(
    "reports focus leaving once at most when Tab and Shift+Tab leave the popup, with the trigger at the %s",
    async (triggerPlacement, afterTab, leavesAfterTab) => {
      let leaves = 0;
      renderThemed(
        withLocale(
          "en-US",
          <>
            <DatePickerField
              label="Start date"
              defaultValue={Temporal.PlainDate.from("2026-10-05")}
              triggerPlacement={triggerPlacement}
              onBlur={() => (leaves += 1)}
            />
            <button type="button">After</button>
          </>
        )
      );
      const trigger = roleNamed("button", "Calendar Start date");
      const day = page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true });
      const dialog = page.getByRole("dialog");

      // Shift+Tab from the day passes the next- and previous-month buttons, then leaves the popup
      // through Base UI's guard to the trigger. The popup stays open.
      await userEvent.click(trigger);
      await expect.element(day).toHaveFocus();
      await userEvent.keyboard("{Shift>}{Tab}{Tab}{Tab}{/Shift}");
      await expect.element(trigger).toHaveFocus();
      await expect.element(dialog).toBeVisible();
      expect(leaves).toBe(0);

      // Tab out of the popup's last tabbable, the day, goes to what follows the trigger.
      day.element().focus();
      await expect.element(day).toHaveFocus();
      await userEvent.tab();
      const next = afterTab === "After" ? roleNamed("button", afterTab) : roleNamed("spinbutton", afterTab);
      await expect.poll(() => document.activeElement).toBe(next);
      expect(leaves).toBe(leavesAfterTab);
    }
  );
});

describe("DatePicker composition", () => {
  it("resolves a state callback className and keeps its automatic name under an undefined override", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <DatePickerField label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
      )
    );
    renderThemed(
      withLocale(
        "en-US",
        <DatePicker.Root aria-label="Delivery" defaultValue={Temporal.PlainDate.from("2026-10-05")}>
          <DatePicker.Group
            aria-labelledby={undefined}
            className={(state) => (state.open ? "is-open" : "is-closed")}>
            <DatePicker.Input />
            <DatePicker.Trigger />
          </DatePicker.Group>
          <DatePicker.Popup>
            <DatePicker.Calendar />
          </DatePicker.Popup>
        </DatePicker.Root>
      )
    );
    const group = roleNamed("group", "Delivery");
    expect(group).toHaveClass("is-closed");
    await userEvent.click(roleNamed("button", "Calendar Delivery"));
    await expect.element(page.getByRole("group", { name: "Delivery", exact: true })).toHaveClass("is-open");
  });
});

describe("DatePicker disabled", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is disabled inside a disabled Field.Set in server output", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      withLocale(
        "en-US",
        // The parts without a Field: `DatePickerField`'s own Field reads the Fieldset itself.
        <Field.Set disabled>
          <DatePicker.Root aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")}>
            <DatePicker.Group>
              <DatePicker.Input />
              <DatePicker.Trigger />
            </DatePicker.Group>
          </DatePicker.Root>
        </Field.Set>
      )
    );
    // Server HTML in a detached host has no accessibility tree to locate by role.
    expect(host.querySelector('[role="group"]')?.getAttribute("aria-disabled")).toBe("true");
    expect(host.querySelector('[data-slot="date-picker-trigger"]')?.hasAttribute("disabled")).toBe(true);
    expect(host.querySelector('[data-slot="date-picker"]')?.hasAttribute("data-disabled")).toBe(true);
  });

  it("is disabled whole inside a disabled Field: trigger, calendar and presets", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Field.Root disabled>
          <Field.Label>Start date</Field.Label>
          <DatePicker.Root defaultValue={Temporal.PlainDate.from("2026-10-05")} defaultOpen>
            <DatePicker.Group>
              <DatePicker.Input />
              <DatePicker.Trigger />
            </DatePicker.Group>
            <DatePicker.Popup>
              <DatePicker.Presets>
                <DatePicker.PresetItem value="today">Today</DatePicker.PresetItem>
              </DatePicker.Presets>
              <DatePicker.Calendar />
            </DatePicker.Popup>
          </DatePicker.Root>
        </Field.Root>
      )
    );
    expect(roleNamed("button", "Calendar Start date")).toBeDisabled();
    expect(roleNamed("group", "Start date")).toHaveAttribute("aria-disabled", "true");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(roleNamed("button", "Monday, October 12, 2026")).toHaveAttribute("data-disabled");
    expect(roleNamed("radio", "Today")).toBeDisabled();
  });
});

describe("preset dateValue of another kind", () => {
  /** An open picker of `kind` with one preset whose `dateValue` is `value`. */
  function PresetOf({
    granularity,
    value,
  }: {
    readonly granularity: "day" | "minute";
    readonly value: DatePickerPresetValue;
  }): ReactElement {
    return (
      <DatePicker.Root aria-label="Starts" granularity={granularity} defaultOpen>
        <DatePicker.Popup>
          <DatePicker.Presets>
            <DatePicker.PresetItem value="preset" dateValue={value}>
              Preset
            </DatePicker.PresetItem>
          </DatePicker.Presets>
        </DatePicker.Popup>
      </DatePicker.Root>
    );
  }

  it("throws while rendering for a preset of another kind than the picker's, naming both", () => {
    expectRenderTypeError(
      "DatePicker.PresetItem dateValue: received a Temporal.PlainDateTime inside DatePicker.Root, whose values are Temporal.PlainDate",
      <PresetOf granularity="day" value={Temporal.PlainDateTime.from("2026-10-05T09:30")} />
    );
  });

  it("throws while rendering for a range inside DatePicker.Root", () => {
    expectRenderTypeError(
      "DatePicker.PresetItem dateValue: received a { start, end } range inside DatePicker.Root",
      <PresetOf
        granularity="day"
        value={{ start: Temporal.PlainDate.from("2026-10-05"), end: Temporal.PlainDate.from("2026-10-09") }}
      />
    );
  });
});
