/*
 * DateRangePicker and DateRangePickerField in the browser: the two Fields under `startName` and
 * `endName` with the label, description and merged error wired to both, a half-filled range held,
 * an end before its start, `Form` errors by name, the range calendar in the popup (cancel, presets
 * dropping a half range, multi-month) and the cancelable details, typing across the two ends, and
 * the popup's time inputs.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
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
import { DatePicker } from "../date-picker";
import { Field } from "../field";
import { Form } from "../form/form";
import { Show } from "../show/show";
import type { DateRangePickerValue } from "./date-range-picker";
import type { DateRangePickerFieldProps } from "./date-range-picker-field";
import { DateRangePicker, DateRangePickerField } from "./index";

beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

function log() {
  return page.getByRole("log", { name: "Changes" });
}

/**
 * Choose a calendar day by keyboard once it renders: focus it and press Enter. Its name starts with
 * the day's: a range calendar adds the range to a day's name while one is being picked.
 */
async function pickDay(day: string): Promise<void> {
  const button = page.getByRole("button", { name: new RegExp(`^${day}`, "u") });
  await expect.element(button).toBeInTheDocument();
  const element = button.element();
  if (!(element instanceof HTMLElement)) throw new Error(`expected the day ${day}`);
  element.focus();
  await userEvent.keyboard("{Enter}");
}

function segmentTexts(): string[] {
  return page
    .getByRole("spinbutton")
    .elements()
    .map((element) => element.textContent);
}

/** A field that logs each committed range, with the reason and the validation error, and can cancel. */
function LoggedRange({
  cancel = [],
  ...props
}: Omit<DateRangePickerFieldProps<DateInputValue>, "onChange"> & {
  readonly cancel?: readonly string[];
}): ReactElement {
  const [lines, setLines] = useState<string[]>([]);
  return (
    <>
      <DateRangePicker.Root
        {...definedProps({ defaultValue: props.defaultValue, visibleMonths: props.visibleMonths })}
        onValueChange={(value, details) => {
          const printed = value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`;
          setLines((current) => [
            ...current,
            `${details.reason}:${printed}:${details.getValidationError() ?? "valid"}`,
          ]);
          if (cancel.includes(details.reason)) details.cancel();
        }}>
        <DateRangePicker.Label>Period</DateRangePicker.Label>
        <DateRangePicker.Group>
          <DateRangePicker.StartInput />
          <DateRangePicker.Separator />
          <DateRangePicker.EndInput />
          <DateRangePicker.Trigger />
        </DateRangePicker.Group>
        <DateRangePicker.Error />
        <DateRangePicker.Description>Nights at the cabin</DateRangePicker.Description>
        <DateRangePicker.Popup>
          <DateRangePicker.Calendar />
        </DateRangePicker.Popup>
      </DateRangePicker.Root>
      <button type="button">After</button>
      <div role="log" aria-label="Changes">
        {lines.join(" | ")}
      </div>
    </>
  );
}

describe("DateRangePicker wiring", () => {
  it("names the group and both inputs by the shared label and describes them by the description", () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    const group = roleNamed("group", "Period");
    const start = roleNamed("spinbutton", "month, Start Date, Period");
    const end = roleNamed("spinbutton", "month, End Date, Period");
    const description = page.getByText("Nights at the cabin", { exact: true }).element();

    expect(group.getAttribute("aria-describedby")).toBe(description.id);
    expect(start.getAttribute("aria-describedby")?.split(" ")).toContain(description.id);
    expect(end.getAttribute("aria-describedby")?.split(" ")).toContain(description.id);
    expect(roleNamed("button", "Calendar Period")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("holds a half-filled range and commits once both ends hold a value", async () => {
    renderThemed(withLocale("en-US", <LoggedRange />));
    await userEvent.click(roleNamed("spinbutton", "month, Start Date, Period"));
    await userEvent.keyboard("10052026");
    expect(log().element().textContent).toBe("");

    await userEvent.click(roleNamed("spinbutton", "month, End Date, Period"));
    await userEvent.keyboard("10092026");
    await expect
      .poll(() => log().element().textContent)
      .toMatch(/\| input-change:2026-10-05\.\.2026-10-09:valid$/u);
  });

  it("reports an end typed before its start on the end, merged into the picker's error", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, End Date, Period"));
    await userEvent.keyboard("01");
    await userEvent.click(roleNamed("button", "After"));

    await expect.element(log()).toHaveTextContent("input-change:2026-10-05..2026-10-01:rangeReversed");
    await expect
      .element(page.getByRole("group", { name: "Period", exact: true }))
      .toHaveAttribute("data-invalid", "true");
    const error = page.getByText("Start date must be before end date.", { exact: true });
    await expect.element(error).toBeVisible();
    expect(roleNamed("group", "Period").getAttribute("aria-describedby")?.split(" ")).toContain(
      error.element().id
    );
    expect(roleNamed("spinbutton", "month, End Date, Period")).toHaveAttribute("aria-invalid", "true");
  });

  it("reports a start typed past its end on the end, shown once focus leaves", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, Start Date, Period"));
    await userEvent.keyboard("20");
    await userEvent.click(roleNamed("button", "After"));

    // The day's first digit forms October 2 on its own, as React Aria commits a growing day.
    await expect
      .poll(() => log().element().textContent)
      .toBe("input-change:2026-10-02..2026-10-09:valid | input-change:2026-10-20..2026-10-09:rangeReversed");
    const error = page.getByText("Start date must be before end date.", { exact: true });
    await expect.element(error).toBeVisible();
    expect(roleNamed("group", "Period").getAttribute("aria-describedby")?.split(" ")).toContain(
      error.element().id
    );
    expect(roleNamed("spinbutton", "month, End Date, Period")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps its own messages when errorMessage renders nothing", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DateRangePickerField
            label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            errorMessage={false}
          />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, End Date, Stay"));
    await userEvent.keyboard("01");
    await userEvent.click(roleNamed("button", "After"));

    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent("Start date must be before end date.");
    expect(page.getByRole("alert").elements()).toHaveLength(1);
  });

  it("clears an end-before-start error once the start moves back", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DateRangePickerField
            label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
          />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, End Date, Stay"));
    await userEvent.keyboard("01");
    await userEvent.click(roleNamed("button", "After"));
    await expect
      .element(page.getByText("Start date must be before end date.", { exact: true }))
      .toBeVisible();

    await userEvent.click(roleNamed("spinbutton", "day, Start Date, Stay"));
    await userEvent.keyboard("01");
    await userEvent.click(roleNamed("button", "After"));
    await expect
      .element(page.getByText("Start date must be before end date.", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("group", { name: "Stay", exact: true }))
      .not.toHaveAttribute("data-invalid");
  });
});

describe("DateRangePicker calendar", () => {
  it("keeps each end's time and zone when a range is picked", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          defaultValue={{
            start: Temporal.ZonedDateTime.from("2026-10-05T08:00[Europe/Oslo]"),
            end: Temporal.ZonedDateTime.from("2026-10-09T17:30[Europe/Oslo]"),
          }}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));

    await expect
      .element(log())
      .toHaveTextContent(
        "day-press:2026-10-20T08:00:00+02:00[Europe/Oslo]..2026-10-26T17:30:00+01:00[Europe/Oslo]:valid"
      );
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the popup open with the anchor when a completed range is canceled", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
          cancel={["day-press"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.click(roleNamed("button", "Thursday, October 22, 2026"));

    await expect.element(log()).toHaveTextContent("day-press:2026-10-20..2026-10-22:valid");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(segmentTexts()).toEqual(["10", "5", "2026", "10", "9", "2026"]);

    // The anchor survived the canceled completion: another end completes a range from October 20.
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await expect
      .element(log())
      .toHaveTextContent("day-press:2026-10-20..2026-10-22:valid | day-press:2026-10-20..2026-10-25:valid");
  });

  it("shows two months side by side with visibleMonths", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedRange
          visibleMonths={2}
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await expect.element(page.getByRole("grid", { name: "October 2026", exact: true })).toBeVisible();
    await expect.element(page.getByRole("grid", { name: "November 2026", exact: true })).toBeVisible();
  });

  it("drops a half-picked range, rather than completing it, when focus moves to a preset", async () => {
    function WithPresets(): ReactElement {
      const [value, setValue] = useState({
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      });
      const [lines, setLines] = useState<string[]>([]);
      return (
        <>
          <DateRangePickerField
            label="Period"
            value={value}
            onChange={(next) => {
              setLines((current) => [
                ...current,
                next === null ? "null" : `${next.start.toString()}..${next.end.toString()}`,
              ]);
              if (next !== null) setValue(next);
            }}
            presetGroup={
              <DatePicker.Presets
                onValueChange={() => {
                  setValue({
                    start: Temporal.PlainDate.from("2026-12-24"),
                    end: Temporal.PlainDate.from("2026-12-26"),
                  });
                }}>
                <DatePicker.PresetItem value="christmas">Christmas</DatePicker.PresetItem>
              </DatePicker.Presets>
            }
          />
          <div role="log" aria-label="Changes">
            {lines.join(" | ")}
          </div>
        </>
      );
    }
    renderThemed(withLocale("en-US", <WithPresets />));
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    const christmas = roleNamed("radio", "Christmas").closest("label");
    if (christmas === null) throw new Error("expected the preset's label");
    await userEvent.click(christmas);

    // No range completed at October 20: the preset set the range, and the calendar followed it.
    expect(log().element().textContent).toBe("");
    await expect.element(page.getByRole("grid", { name: "December 2026", exact: true })).toBeVisible();
    expect(segmentTexts()).toEqual(["12", "24", "2026", "12", "26", "2026"]);
  });
});

describe("DateRangePickerField in forms", () => {
  it("submits both ends under their names and focuses the end input for an error returned on endName", async () => {
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
            setErrors({ checkOut: "No check-outs on Fridays" });
          }}>
          <DateRangePickerField
            label="Stay"
            startName="checkIn"
            endName="checkOut"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
          />
          <button type="submit">Save</button>
        </Form>
      );
    }
    renderThemed(<Booking />);
    const data = new FormData(formNamed("Booking"));
    expect([data.get("checkIn"), data.get("checkOut")]).toEqual(["2026-10-05", "2026-10-09"]);

    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toEqual({ checkIn: "2026-10-05", checkOut: "2026-10-09" });
    await expect.element(page.getByText("No check-outs on Fridays", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("spinbutton", { name: "month, End Date, Stay", exact: true }))
      .toHaveFocus();
    await expect
      .element(page.getByRole("group", { name: "Stay", exact: true }))
      .toHaveAttribute("data-invalid", "true");
  });

  it("blocks a submit with a required empty end and merges both ends' messages once", async () => {
    let submits = 0;
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Booking" onFormSubmit={() => (submits += 1)}>
          <DateRangePickerField label="Stay" startName="checkIn" endName="checkOut" isRequired />
          <button type="submit">Save</button>
        </Form>
      )
    );
    await userEvent.click(roleNamed("button", "Save"));

    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date, Stay", exact: true }))
      .toHaveFocus();
    await expect.element(page.getByText("Please fill out this field.", { exact: true })).toBeVisible();
    expect(submits).toBe(0);
  });
});

describe("DateRangePicker typing across ends", () => {
  it("moves on from the start's last typed segment to the end's first, and back on Backspace", async () => {
    renderThemed(withLocale("en-US", <DateRangePickerField label="Period" />));
    await userEvent.click(roleNamed("spinbutton", "month, Start Date, Period"));
    await userEvent.keyboard("10052026");

    await expect
      .element(page.getByRole("spinbutton", { name: "month, End Date, Period", exact: true }))
      .toHaveFocus();
    expect(segmentTexts()).toEqual(["10", "05", "2026", "mm", "dd", "yyyy"]);

    // An empty segment hands focus back, across the separator as within one input.
    await userEvent.keyboard("{Backspace}");
    await expect
      .element(page.getByRole("spinbutton", { name: "year, Start Date, Period", exact: true }))
      .toHaveFocus();
  });
});

describe("DateRangePicker end day picked over a time, on October 25, 2026 in Oslo, whose 02:00–03:00 comes twice", () => {
  // React Aria moves a picked day under the time it held with `ZonedDateTime.set`: a wall clock that
  // changes resolves as typed (the earlier, summer-time instant of a repeated hour), and one that
  // does not keeps the value as it is. Days inside the range shown carry the range in their names.
  async function pickOver(end: string): Promise<string[]> {
    const values: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          defaultValue={{
            start: Temporal.ZonedDateTime.from("2026-10-20T08:00[Europe/Oslo]"),
            end: Temporal.ZonedDateTime.from(end),
          }}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(page.getByRole("button", { name: /Tuesday, October 20, 2026/u }));
    await userEvent.click(page.getByRole("button", { name: /Sunday, October 25, 2026/u }));
    return values;
  }

  it("moves a winter-time 02:30 to the repeated hour's earlier instant", async () => {
    const values = await pickOver("2026-11-01T02:30+01:00[Europe/Oslo]");

    await expect
      .poll(() => values)
      .toEqual(["2026-10-20T08:00:00+02:00[Europe/Oslo]..2026-10-25T02:30:00+02:00[Europe/Oslo]"]);
  });

  it("keeps the repeated hour's later instant when its own day is picked again", async () => {
    const values = await pickOver("2026-10-25T02:30+01:00[Europe/Oslo]");

    await expect
      .poll(() => values)
      .toEqual(["2026-10-20T08:00:00+02:00[Europe/Oslo]..2026-10-25T02:30:00+01:00[Europe/Oslo]"]);
  });
});

describe("DateRangePicker end in another zone than its start", () => {
  // A day picked for an end keeps that end's own zone and kind: an Oslo start does not move a New
  // York end into Oslo. Only a time held with no day takes the picker's zone when its day comes.
  it("forms a time typed after the parent clears a mixed-zone range in the picker's zone, every digit kept", async () => {
    const values: string[] = [];
    const parent = parentHandle<DateRangePickerValue<Temporal.ZonedDateTime> | null>();
    function Clearing(): ReactElement {
      const [value, setValue] = useState<DateRangePickerValue<Temporal.ZonedDateTime> | null>({
        start: Temporal.ZonedDateTime.from("2026-10-20T08:00[Europe/Oslo]"),
        end: Temporal.ZonedDateTime.from("2026-10-22T17:30[America/New_York]"),
      });
      useEffect(() => {
        parent.bind(setValue);
      }, []);
      return (
        <>
          <DateRangePickerField
            label="Period"
            granularity="minute"
            hourCycle={24}
            value={value}
            onChange={(next) => {
              values.push(next === null ? "null" : `${next.start.toString()}..${next.end.toString()}`);
              setValue(next);
            }}
          />
        </>
      );
    }
    // An empty picker's calendar shows today's month, November here.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    renderThemed(withLocale("en-US", <Clearing />));
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    parent.set(null);
    await expect
      .element(page.getByRole("spinbutton", { name: "hour, End time", exact: true }))
      .toHaveTextContent("––");
    // The popup repositions after the clear, so its parts are reached without a pointer.
    await popupFocusRestored();
    roleNamed("spinbutton", "hour, End time").focus();
    await userEvent.keyboard("1730");
    roleNamed("button", "Previous").click();
    await pickDay("Monday, October 12, 2026");
    await pickDay("Friday, October 16, 2026");

    await expect
      .poll(() => values)
      .toEqual(["2026-10-12T00:00:00+02:00[Europe/Oslo]..2026-10-16T17:30:00+02:00[Europe/Oslo]"]);
  });

  it("keeps a New York end's zone and wall clock when a range is picked over an Oslo start", async () => {
    const values: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          defaultValue={{
            start: Temporal.ZonedDateTime.from("2026-10-20T08:00[Europe/Oslo]"),
            end: Temporal.ZonedDateTime.from("2026-10-22T17:30[America/New_York]"),
          }}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(page.getByRole("button", { name: /Tuesday, October 20, 2026/u }));
    await userEvent.click(page.getByRole("button", { name: /Monday, October 26, 2026/u }));

    await expect
      .poll(() => values)
      .toEqual(["2026-10-20T08:00:00+02:00[Europe/Oslo]..2026-10-26T17:30:00-04:00[America/New_York]"]);
  });
});

describe("DateRangePicker presets with a dateValue", () => {
  it("sets a preset's range as a preset-press, replacing a half-typed range", async () => {
    const lines: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePicker.Root
          aria-label="Period"
          defaultOpen
          onValueChange={(value, details) =>
            lines.push(
              `${details.reason}:${value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`}`
            )
          }>
          <DateRangePicker.Group>
            <DateRangePicker.StartInput />
            <DateRangePicker.EndInput />
          </DateRangePicker.Group>
          <DateRangePicker.Popup>
            <DateRangePicker.Presets>
              <DateRangePicker.PresetItem
                value="autumn-break"
                dateValue={{
                  start: Temporal.PlainDate.from("2026-10-05"),
                  end: Temporal.PlainDate.from("2026-10-09"),
                }}>
                Autumn break
              </DateRangePicker.PresetItem>
            </DateRangePicker.Presets>
            <DateRangePicker.Calendar />
          </DateRangePicker.Popup>
        </DateRangePicker.Root>
      )
    );
    await waitForPopupSettled();
    // Half a range: the start alone reports nothing.
    roleNamed("spinbutton", "month, Start Date, Period").focus();
    await userEvent.keyboard("11022026");
    expect(lines).toEqual([]);

    const preset = roleNamed("radio", "Autumn break").closest("label");
    if (preset === null) throw new Error("expected the preset's label");
    await userEvent.click(preset);

    await expect.poll(() => lines).toEqual(["preset-press:2026-10-05..2026-10-09"]);
    expect(segmentTexts()).toEqual(["10", "5", "2026", "10", "9", "2026"]);
  });
});

describe("DateRangePicker dateValue presets and the pane's checked key", () => {
  const WEEK = { start: "2026-10-05", end: "2026-10-11" };
  const DATED = {
    "This week": WEEK,
    "Week 41": WEEK,
    October: { start: "2026-10-01", end: "2026-10-31" },
  } as const;

  /**
   * An open range picker on October 1–3 with three `dateValue` presets, logging the picker's and
   * the pane's changes. `paneKey` fixes a controlled pane's key, which its parent never changes.
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
        <DateRangePicker.Root
          aria-label="Period"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-01"),
            end: Temporal.PlainDate.from("2026-10-03"),
          }}
          defaultOpen
          shouldCloseOnSelect={false}
          onValueChange={(value, details) => {
            log(
              `value:${details.reason}:${value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`}`
            );
            if (cancel === "picker") details.cancel();
          }}>
          <DateRangePicker.Group>
            <DateRangePicker.StartInput />
            <DateRangePicker.EndInput />
          </DateRangePicker.Group>
          <DateRangePicker.Popup>
            <DateRangePicker.Presets
              {...definedProps({ value: keyed ? key : paneKey })}
              onValueChange={(next, details) => {
                log(`pane:${next}`);
                if (cancel === "pane") details.cancel();
                else if (keyed) setKey(next);
              }}>
              {Object.entries(DATED).map(([name, range]) => (
                <DateRangePicker.PresetItem
                  key={name}
                  value={name}
                  dateValue={{
                    start: Temporal.PlainDate.from(range.start),
                    end: Temporal.PlainDate.from(range.end),
                  }}>
                  {name}
                </DateRangePicker.PresetItem>
              ))}
            </DateRangePicker.Presets>
            <DateRangePicker.Calendar />
          </DateRangePicker.Popup>
        </DateRangePicker.Root>
        <div role="log" aria-label="Changes">
          {lines.join(" | ")}
        </div>
      </>
    );
  }

  function presetLabel(name: string): HTMLLabelElement {
    const label = roleNamed("radio", name).closest("label");
    if (label === null) throw new Error(`expected the label of preset ${name}`);
    return label;
  }

  /** The checked presets, by radio and by label, which must agree. */
  function checkedPresets(): string[] {
    return Object.keys(DATED).flatMap((name) => {
      const radio = roleNamed("radio", name).matches(":checked");
      const label = presetLabel(name).hasAttribute("data-checked");
      return radio || label ? [`${name}${radio === label ? "" : ":disagree"}`] : [];
    });
  }

  async function pickRange(start: string, end: string): Promise<void> {
    await userEvent.click(roleNamed("button", start));
    await userEvent.click(roleNamed("button", end));
  }

  it("re-applies a checked preset pressed again, and keeps a controlled key as the parent set it", async () => {
    renderThemed(withLocale("en-US", <Rules paneKey="This week" />));
    await waitForPopupSettled();
    expect(checkedPresets()).toEqual(["This week"]);

    await userEvent.click(presetLabel("This week"));
    await pickRange("Monday, October 12, 2026", "Wednesday, October 14, 2026");
    expect(checkedPresets()).toEqual(["This week"]);
    await userEvent.click(presetLabel("This week"));

    await expect
      .element(log())
      .toHaveTextContent(
        "value:preset-press:2026-10-05..2026-10-11 | value:day-press:2026-10-12..2026-10-14 | value:preset-press:2026-10-05..2026-10-11"
      );
  });

  it("re-applies a checked preset by a pointer press after Space re-applied it", async () => {
    renderThemed(withLocale("en-US", <Rules paneKey="This week" />));
    await waitForPopupSettled();
    roleNamed("radio", "This week").focus();
    await userEvent.keyboard(" ");
    await pickRange("Monday, October 12, 2026", "Wednesday, October 14, 2026");
    await userEvent.click(presetLabel("This week"));

    await expect
      .element(log())
      .toHaveTextContent(
        "value:preset-press:2026-10-05..2026-10-11 | value:day-press:2026-10-12..2026-10-14 | value:preset-press:2026-10-05..2026-10-11"
      );
  });

  it("unchecks its own key when a range is picked or an end is typed, and a press applies it again", async () => {
    renderThemed(withLocale("en-US", <Rules />));
    await waitForPopupSettled();
    await userEvent.click(presetLabel("This week"));
    await expect.poll(checkedPresets).toEqual(["This week"]);

    await pickRange("Monday, October 12, 2026", "Wednesday, October 14, 2026");
    await expect.poll(checkedPresets).toEqual([]);

    await userEvent.click(presetLabel("This week"));
    await expect.poll(checkedPresets).toEqual(["This week"]);
    // Focus moves from the popup to the input without a press, which keeps the popup open.
    roleNamed("spinbutton", "day, Start Date, Period").focus();
    await userEvent.keyboard("6");
    await expect.poll(checkedPresets).toEqual([]);
    expect(log().element().textContent).toBe(
      "value:preset-press:2026-10-05..2026-10-11 | pane:This week | value:day-press:2026-10-12..2026-10-14 | value:preset-press:2026-10-05..2026-10-11 | pane:This week | value:input-change:2026-10-06..2026-10-11"
    );
  });

  it("refuses the whole press when the picker cancels its range: the pane is never asked", async () => {
    renderThemed(withLocale("en-US", <Rules keyed cancel="picker" />));
    await waitForPopupSettled();
    await userEvent.click(presetLabel("October"));

    await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-01..2026-10-31");
    expect(log().element().textContent).toBe("value:preset-press:2026-10-01..2026-10-31");
    expect(checkedPresets()).toEqual([]);
    expect(segmentTexts()).toEqual(["10", "1", "2026", "10", "3", "2026"]);
  });

  it("commits the range but keeps the checked key when the pane cancels it", async () => {
    renderThemed(withLocale("en-US", <Rules keyed cancel="pane" />));
    await waitForPopupSettled();
    await userEvent.click(presetLabel("October"));

    await expect.element(log()).toHaveTextContent("value:preset-press:2026-10-01..2026-10-31 | pane:October");
    expect(checkedPresets()).toEqual([]);
    expect(segmentTexts()).toEqual(["10", "1", "2026", "10", "31", "2026"]);
  });

  it("checks only the pressed one of two presets on one range", async () => {
    renderThemed(withLocale("en-US", <Rules />));
    await waitForPopupSettled();
    await userEvent.click(presetLabel("This week"));
    await expect.poll(checkedPresets).toEqual(["This week"]);
    await userEvent.click(presetLabel("Week 41"));

    await expect.poll(checkedPresets).toEqual(["Week 41"]);
    expect(log().element().textContent).toBe(
      "value:preset-press:2026-10-05..2026-10-11 | pane:This week | value:preset-press:2026-10-05..2026-10-11 | pane:Week 41"
    );
  });
});

describe("DateRangePicker form reset", () => {
  it("empties a picker with a typed start and a half-typed end, though its value never changed", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DateRangePickerField label="Stay" startName="from" endName="to" />
          <button type="button">After</button>
          <button type="reset">Reset</button>
        </form>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "month, Start Date, Stay"));
    await userEvent.keyboard("10052026");
    await userEvent.click(roleNamed("spinbutton", "month, End Date, Stay"));
    await userEvent.keyboard("11");
    expect(segmentTexts()).toEqual(["10", "05", "2026", "11", "dd", "yyyy"]);

    // Leaving the half-typed end shows its error first, which moves the Reset button.
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByText(/The field is incomplete/u)).toBeVisible();
    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy", "mm", "dd", "yyyy"]);
    await expect.element(page.getByText(/The field is incomplete/u)).not.toBeInTheDocument();
  });

  it("keeps a cleared zoned range's time segments and zone across a form reset", async () => {
    const values: string[] = [];
    function Zoned(): ReactElement {
      const [value, setValue] = useState<DateRangePickerValue<Temporal.ZonedDateTime> | null>({
        start: Temporal.ZonedDateTime.from("2026-10-12T08:00[Europe/Oslo]"),
        end: Temporal.ZonedDateTime.from("2026-10-16T17:30[Europe/Oslo]"),
      });
      return withLocale(
        "en-US",
        <form aria-label="Booking">
          <DateRangePickerField
            label="Window"
            granularity="minute"
            hourCycle={24}
            hideTimeZone
            value={value}
            onChange={(next) => {
              const printed =
                next === null ? null : { start: next.start.toString(), end: next.end.toString() };
              values.push(printed === null ? "null" : `${printed.start}..${printed.end}`);
              setValue(next);
            }}
          />
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
          <button type="reset">Reset</button>
        </form>
      );
    }
    renderThemed(<Zoned />);
    await userEvent.click(roleNamed("button", "Clear"));
    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(() => page.getByRole("spinbutton").elements().length).toBe(10);

    await userEvent.click(roleNamed("spinbutton", "month, Start Date, Window"));
    await userEvent.keyboard("102620260800");
    await userEvent.click(roleNamed("spinbutton", "month, End Date, Window"));
    await userEvent.keyboard("102720261700");
    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-26T08:00:00+01:00[Europe/Oslo]..2026-10-27T17:00:00+01:00[Europe/Oslo]");
  });
});

describe("DateRangePicker naming", () => {
  /** A Root named only by `aria-label`, holding a Label a wrapper never renders. */
  function GhostLabel(): ReactElement {
    return withLocale(
      "en-US",
      <DateRangePicker.Root
        aria-label="Stay"
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}>
        <Show when={false}>
          <DateRangePicker.Label>Ghost</DateRangePicker.Label>
        </Show>
        <DateRangePicker.Group>
          <DateRangePicker.StartInput />
          <DateRangePicker.EndInput />
          <DateRangePicker.Trigger />
        </DateRangePicker.Group>
      </DateRangePicker.Root>
    );
  }

  it("names both ends by the picker's aria-label when it has no visible label", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          aria-label="Period"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    expect(roleNamed("group", "Period")).toBeDefined();
    expect(roleNamed("spinbutton", "month, Start Date, Period")).toBeDefined();
    expect(roleNamed("spinbutton", "year, End Date, Period")).toBeDefined();
    expect(roleNamed("button", "Calendar Period")).toBeDefined();
  });

  it("keeps names and descriptions whole with consumer ids on the label, description and error", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePicker.Root
          invalid
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}>
          <DateRangePicker.Label id="my-label">Period</DateRangePicker.Label>
          <DateRangePicker.Group>
            <DateRangePicker.StartInput />
            <DateRangePicker.EndInput />
            <DateRangePicker.Trigger />
          </DateRangePicker.Group>
          <DateRangePicker.Error render={<div id="my-error" />}>Rejected</DateRangePicker.Error>
          <DateRangePicker.Description id="my-description">Nights at the cabin</DateRangePicker.Description>
        </DateRangePicker.Root>
      )
    );
    expect(document.getElementById("my-label")).not.toBeNull();
    expect(document.getElementById("my-error")).not.toBeNull();
    expect(document.getElementById("my-description")).not.toBeNull();
    const group = roleNamed("group", "Period");
    expect(group).toHaveAccessibleDescription("Nights at the cabin Rejected");
    expect(roleNamed("spinbutton", "month, Start Date, Period")).toHaveAccessibleDescription(
      /Nights at the cabin Rejected/u
    );
    expect(roleNamed("button", "Calendar Period")).toHaveAccessibleDescription(
      "Nights at the cabin Rejected"
    );
  });

  it("names the picker by its aria-label when a wrapper renders no Label, in server output", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<GhostLabel />);
    const group = host.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-labelledby")).toBeNull();
    expect(group?.getAttribute("aria-label")).toBe("Stay");
    const month = host.querySelector('[role="spinbutton"]');
    const labelledBy = (month?.getAttribute("aria-labelledby") ?? "").split(" ");
    const named = labelledBy.map((id) => host.querySelector(`[id="${id}"]`)?.textContent ?? null);
    expect(named).not.toContain(null);
    expect(named.at(-1)).toBe("Stay");
    expect(host.textContent).not.toContain("Ghost");
  });

  it("describes the group and both ends by an explicit error shown with isInvalid", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          isInvalid
          errorMessage="Rejected"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    expect(roleNamed("group", "Period")).toHaveAccessibleDescription("Rejected");
    expect(roleNamed("spinbutton", "month, End Date, Period")).toHaveAccessibleDescription(/Rejected/u);
  });

  it("writes whole names and descriptions in server output", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          description="Nights at the cabin"
          isInvalid
          errorMessage="Rejected"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    const text = (ids: string | null): string =>
      (ids ?? "")
        .split(" ")
        .filter((id) => id !== "")
        .map((id) => {
          const target = host.querySelector(`[id="${id}"]`);
          if (target === null) throw new Error(`${id} names no element in the server output`);
          return target.textContent;
        })
        .join(" ");
    const group = host.querySelector('[role="group"]');
    expect(text(group?.getAttribute("aria-labelledby") ?? null)).toBe("Period");
    expect(text(group?.getAttribute("aria-describedby") ?? null)).toBe("Nights at the cabin Rejected");
    // Server HTML in a detached host has no accessibility tree to locate by role.
    const trigger = host.querySelector('[data-slot="date-picker-trigger"]');
    expect(trigger?.getAttribute("aria-label")).toBe("Calendar");
    expect(text(trigger?.getAttribute("aria-labelledby") ?? null)).toBe(" Period");
    const month = host.querySelector('[role="spinbutton"]');
    expect(text(month?.getAttribute("aria-describedby") ?? null)).toContain("Nights at the cabin Rejected");
  });
});

describe("DateRangePicker disabled", () => {
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
        <Field.Set disabled>
          <DateRangePickerField
            label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
          />
        </Field.Set>
      )
    );
    // Server HTML in a detached host has no accessibility tree to locate by role.
    expect(host.querySelector('[role="group"]')?.getAttribute("aria-disabled")).toBe("true");
    expect(host.querySelector('[data-slot="date-picker-trigger"]')?.hasAttribute("disabled")).toBe(true);
    expect(host.querySelector('[data-slot="date-range-picker"]')?.hasAttribute("data-disabled")).toBe(true);
  });

  it("is disabled whole inside a disabled Field: trigger, calendar and presets", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Field.Root disabled>
          <DateRangePicker.Root
            aria-label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            defaultOpen>
            <DateRangePicker.Group>
              <DateRangePicker.StartInput />
              <DateRangePicker.EndInput />
              <DateRangePicker.Trigger />
            </DateRangePicker.Group>
            <DateRangePicker.Popup>
              <DateRangePicker.Presets>
                <DateRangePicker.PresetItem value="week">This week</DateRangePicker.PresetItem>
              </DateRangePicker.Presets>
              <DateRangePicker.Calendar />
            </DateRangePicker.Popup>
          </DateRangePicker.Root>
        </Field.Root>
      )
    );
    expect(roleNamed("button", "Calendar Stay")).toBeDisabled();
    expect(roleNamed("spinbutton", "month, Start Date, Stay")).toHaveAttribute("aria-disabled", "true");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(roleNamed("button", "Monday, October 12, 2026")).toHaveAttribute("data-disabled");
    expect(roleNamed("radio", "This week")).toBeDisabled();
  });

  it("disables the open calendar and presets when an enclosing Field.Set becomes disabled", async () => {
    const values: string[] = [];
    function Fenced({ disabled }: { readonly disabled: boolean }): ReactElement {
      return withLocale(
        "en-US",
        <Field.Set disabled={disabled}>
          <DateRangePicker.Root
            aria-label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            defaultOpen
            onValueChange={(value) => values.push(String(value?.start))}>
            <DateRangePicker.Group>
              <DateRangePicker.StartInput />
              <DateRangePicker.EndInput />
              <DateRangePicker.Trigger />
            </DateRangePicker.Group>
            <DateRangePicker.Popup>
              <DateRangePicker.Presets>
                <DateRangePicker.PresetItem value="week">This week</DateRangePicker.PresetItem>
              </DateRangePicker.Presets>
              <DateRangePicker.Calendar />
            </DateRangePicker.Popup>
          </DateRangePicker.Root>
        </Field.Set>
      );
    }
    const { rerender } = renderThemed(<Fenced disabled={false} />);
    await waitForPopupSettled();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(roleNamed("radio", "This week")).not.toBeDisabled();

    rerender(<Fenced disabled />);
    await expect.element(page.getByRole("radio", { name: "This week", exact: true })).toBeDisabled();
    expect(roleNamed("button", "Monday, October 12, 2026")).toHaveAttribute("data-disabled");
    expect(roleNamed("button", "Calendar Stay")).toBeDisabled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"), { force: true });
    await userEvent.click(roleNamed("button", "Wednesday, October 14, 2026"), { force: true });
    expect(values).toEqual([]);
  });
});

describe("DateRangePicker focus boundary", () => {
  it("reports focus leaving once when Tab leaves the popup, and not when Shift+Tab returns to the trigger", async () => {
    let leaves = 0;
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DateRangePickerField
            label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            onBlur={() => (leaves += 1)}
          />
          <button type="button">After</button>
        </>
      )
    );
    const trigger = roleNamed("button", "Calendar Stay");
    const dialog = page.getByRole("dialog");
    const inPopup = () => dialog.query()?.contains(document.activeElement) === true;
    await userEvent.click(trigger);
    await expect.element(dialog).toBeVisible();
    await expect.poll(inPopup).toBe(true);
    for (let step = 0; step < 5 && inPopup(); step += 1) {
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    }
    await expect.element(trigger).toHaveFocus();
    expect(leaves).toBe(0);

    if (dialog.query() === null) {
      await userEvent.click(trigger);
    } else {
      roleNamed(
        "button",
        "Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected"
      ).focus();
    }
    await expect.poll(inPopup).toBe(true);
    for (let step = 0; step < 5 && inPopup(); step += 1) {
      await userEvent.tab();
    }
    await expect.poll(() => document.activeElement).toBe(roleNamed("button", "After"));
    expect(leaves).toBe(1);
  });

  it("reports one focus leave from an end to outside, and one from the popup to outside", async () => {
    let leaves = 0;
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DateRangePickerField
            label="Stay"
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            onBlur={() => (leaves += 1)}
          />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, End Date, Stay"));
    await userEvent.click(roleNamed("button", "After"));
    expect(leaves).toBe(1);

    await userEvent.click(roleNamed("spinbutton", "day, End Date, Stay"));
    await userEvent.click(roleNamed("button", "Calendar Stay"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(leaves).toBe(2);
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'DateRangePicker.Root value.start: received the string "2026-10-05"',
      <DateRangePickerField
        label="Period"
        value={{
          // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
          start: "2026-10-05",
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
  });
});

describe("DateRangePicker held ranges", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds a range picked in an empty time picker that stays open, and commits it at midnight on close", async () => {
    const values: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Window"
          granularity="minute"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Window"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(values).toEqual([]);

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(values).toEqual(["2026-10-12T00:00:00..2026-10-16T00:00:00"]);
  });

  it("commits a range held in an empty time picker once both ends have a time typed in the popup", async () => {
    const values: string[] = [];
    // The statistics period's options: zoned minutes on a 24-hour clock, with no zone name.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("0800");
    expect(values).toEqual([]);

    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("1730");

    // Whole once the end's minute holds a digit, then the end's minute goes on to 30.
    await expect
      .poll(() => values)
      .toEqual([
        "2026-10-12T08:00:00+02:00[Europe/Oslo]..2026-10-16T17:03:00+02:00[Europe/Oslo]",
        "2026-10-12T08:00:00+02:00[Europe/Oslo]..2026-10-16T17:30:00+02:00[Europe/Oslo]",
      ]);
    await expect.element(page.getByRole("dialog")).toBeVisible();
  });

  it("keeps every time digit typed for a picked end whose offset differs from today's", async () => {
    const values: string[] = [];
    // Today, October 15, is summer time in Oslo; October 26 is after the clocks go back.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("0800");
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("1730");

    await expect
      .poll(() => values)
      .toEqual([
        "2026-10-12T08:00:00+02:00[Europe/Oslo]..2026-10-26T17:03:00+01:00[Europe/Oslo]",
        "2026-10-12T08:00:00+02:00[Europe/Oslo]..2026-10-26T17:30:00+01:00[Europe/Oslo]",
      ]);
  });

  it("steps a held end's popup hour through its own day's repeated DST hour", async () => {
    const values: string[] = [];
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter time.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("0230");
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("1000");

    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-25T02:30:00+01:00[Europe/Oslo]..2026-10-26T10:00:00+01:00[Europe/Oslo]");
  });

  it("steps a half-cleared start time on the day picked since, through its repeated DST hour", async () => {
    const values: string[] = [];
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter time.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="second"
          hourCycle={24}
          hideTimeZone
          shouldCloseOnSelect={false}
          defaultValue={{
            start: Temporal.ZonedDateTime.from("2026-10-24T02:30:00+02:00[Europe/Oslo]"),
            end: Temporal.ZonedDateTime.from("2026-10-26T10:00:00+01:00[Europe/Oslo]"),
          }}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("spinbutton", "second, Start time"));
    await userEvent.keyboard("{Backspace}");
    // Inside the range shown, so their names carry the range too.
    await userEvent.click(page.getByRole("button", { name: /^Sunday, October 25, 2026/u }));
    await userEvent.click(page.getByRole("button", { name: /Monday, October 26, 2026/u }));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.click(roleNamed("spinbutton", "second, Start time"));
    await userEvent.keyboard("00");

    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-25T02:30:00+01:00[Europe/Oslo]..2026-10-26T10:00:00+01:00[Europe/Oslo]");
  });

  it("steps a start time typed for a held range through its day's repeated DST hour", async () => {
    const values: string[] = [];
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter time.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="second"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("0230");
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.click(roleNamed("spinbutton", "second, Start time"));
    await userEvent.keyboard("00");
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("100000");

    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-25T02:30:00+01:00[Europe/Oslo]..2026-10-26T10:00:00+01:00[Europe/Oslo]");
  });

  it("keeps a held end's time stepped to the repeated hour's later instant when its day is picked again", async () => {
    const values: string[] = [];
    // October 25, 2026 sets Oslo's clocks back at 03:00: after 02:30 summer time comes 02:30 winter
    // time. React Aria moves a picked day under its time with `ZonedDateTime.set`, which keeps a value
    // whose wall clock the day leaves unchanged.
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("0230");
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("{ArrowUp}");
    // Inside the range shown, so their names carry the range too.
    await userEvent.click(page.getByRole("button", { name: /Tuesday, October 20, 2026/u }));
    await userEvent.click(page.getByRole("button", { name: /Sunday, October 25, 2026/u }));
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("0800");

    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-20T08:00:00+02:00[Europe/Oslo]..2026-10-25T02:30:00+01:00[Europe/Oslo]");
  });

  it("pastes the wall time of ISO text dated in March's gap onto a held start on October 25", async () => {
    const values: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Period"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Sunday, October 25, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 26, 2026"));
    const data = new DataTransfer();
    data.setData("text/plain", "2026-03-29T02:30");
    roleNamed("spinbutton", "hour, Start time").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
    );
    await userEvent.click(roleNamed("spinbutton", "hour, End time"));
    await userEvent.keyboard("1000");

    // Typed 02:30 on October 25 is the earlier, summer-time 02:30.
    await expect
      .poll(() => values.at(-1))
      .toBe("2026-10-25T02:30:00+02:00[Europe/Oslo]..2026-10-26T10:00:00+01:00[Europe/Oslo]");
  });

  describe("times held before days, across a change of the empty picker's zone or kind", () => {
    /** An empty Oslo range picker whose `timeZone` the test sets through `parent`, logging its ranges. */
    function Switching({ parent }: { readonly parent: ParentHandle<string | undefined> }): ReactElement {
      const [zone, setZone] = useState<string | undefined>("Europe/Oslo");
      const [values, setValues] = useState<string[]>([]);
      useEffect(() => {
        parent.bind(setZone);
      }, [parent]);
      return (
        <>
          <DateRangePickerField
            label="Period"
            granularity="minute"
            hourCycle={24}
            shouldCloseOnSelect={false}
            {...definedProps({ timeZone: zone })}
            onChange={(value) =>
              setValues((current) => [
                ...current,
                value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`,
              ])
            }
          />
          <div role="log" aria-label="Changes">
            {values.join(" | ")}
          </div>
        </>
      );
    }

    // Held times are wall times: 09:30 and 17:00 on November 11 and 12 in the zone and kind at the pick.
    // The popup times name the zone they form in, today's (October 15's) name for it, and plain
    // date-times name none.
    it.each([
      {
        change: "zone to New York",
        to: "America/New_York",
        zone: "EDT",
        expected: "2026-11-11T09:30:00-05:00[America/New_York]..2026-11-12T17:00:00-05:00[America/New_York]",
      },
      {
        change: "kind to a plain date-time",
        to: undefined,
        zone: null,
        expected: "2026-11-11T09:30:00..2026-11-12T17:00:00",
      },
    ])("commits the held times on the range picked after its $change", async ({ to, zone, expected }) => {
      const parent = parentHandle<string | undefined>();
      renderThemed(withLocale("en-US", <Switching parent={parent} />));
      await userEvent.click(roleNamed("button", "Calendar Period"));
      await waitForPopupSettled();
      await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
      await userEvent.keyboard("0930");
      await userEvent.click(roleNamed("spinbutton", "hour, End time"));
      await userEvent.keyboard("1700");

      // The parent switches with the popup open; a click on a control outside it would close it.
      parent.set(to);
      const zoneSegment = page.getByRole("textbox", { name: "time zone, End time", exact: true });
      await (zone === null
        ? expect.element(zoneSegment).not.toBeInTheDocument()
        : expect.element(zoneSegment).toHaveTextContent(zone));
      expect(roleNamed("spinbutton", "hour, Start time").textContent).toBe("09");
      expect(roleNamed("spinbutton", "hour, End time").textContent).toBe("17");
      // The month button pages to November; the popup repositions after the switch, so the month
      // button and the days are reached without a pointer, once any focus restore has run.
      await popupFocusRestored();
      roleNamed("button", "Next").click();
      await pickDay("Wednesday, November 11, 2026");
      await pickDay("Thursday, November 12, 2026");

      await expect.element(log()).toHaveTextContent(expected);
      expect(log().element().textContent).toBe(expected);
    });
  });

  it("keeps one time per end: a start typed in its input replaces the time typed in the popup before", async () => {
    const values: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Window"
          granularity="minute"
          hourCycle={24}
          shouldCloseOnSelect={false}
          onChange={(value) =>
            values.push(value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`)
          }
        />
      )
    );
    const hour = (name: string) => page.getByRole("spinbutton", { name: `hour, ${name}`, exact: true });
    await userEvent.click(roleNamed("button", "Calendar Window"));
    await waitForPopupSettled();
    await userEvent.click(hour("Start time"));
    await userEvent.keyboard("0800");
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    // The start's own input, typed whole at 09:00 on October 12.
    await userEvent.click(roleNamed("spinbutton", "month, Start Date, Window"));
    await userEvent.keyboard("101220260900");
    await userEvent.click(roleNamed("button", "Calendar Window"));
    await waitForPopupSettled();
    await expect.element(hour("Start time")).toHaveTextContent("09");

    // A range picked now keeps the start's one time.
    await userEvent.click(roleNamed("button", "Wednesday, October 14, 2026"));
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));
    await userEvent.click(hour("End time"));
    await userEvent.keyboard("1700");
    await expect.poll(() => values.at(-1)).toBe("2026-10-14T09:00:00..2026-10-16T17:00:00");
  });

  it("drops a half-typed popup time on a native form reset, showing the end's time again", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DateRangePickerField
            label="Window"
            hourCycle={24}
            defaultValue={{
              start: Temporal.PlainDateTime.from("2026-10-12T08:00"),
              end: Temporal.PlainDateTime.from("2026-10-16T17:30"),
            }}
          />
        </form>
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Window"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("spinbutton", "hour, Start time"));
    await userEvent.keyboard("{Backspace}{Backspace}");
    await expect
      .element(page.getByRole("spinbutton", { name: "hour, Start time", exact: true }))
      .toHaveTextContent("––");

    // `reset()` moves no focus, so the popup stays open over the reset.
    formNamed("Booking").reset();

    await expect
      .element(page.getByRole("spinbutton", { name: "hour, Start time", exact: true }))
      .toHaveTextContent("08");
  });

  it("drops a half-cleared range for good when the parent replaces the range and later restores it", async () => {
    const A = { start: Temporal.PlainDate.from("2026-10-05"), end: Temporal.PlainDate.from("2026-10-09") };
    const B = { start: Temporal.PlainDate.from("2026-11-02"), end: Temporal.PlainDate.from("2026-11-06") };
    function Controlled(): ReactElement {
      const [value, setValue] = useState<DateRangePickerValue | null>(A);
      return (
        <>
          <DateRangePickerField label="Period" value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue(B)}>
            Range B
          </button>
          <button type="button" onClick={() => setValue(A)}>
            Range A
          </button>
        </>
      );
    }
    renderThemed(withLocale("en-US", <Controlled />));
    // Clear the whole start: year (4 digits), day, month, moving back over each emptied segment.
    await userEvent.click(roleNamed("spinbutton", "year, Start Date, Period"));
    await userEvent.keyboard("{Backspace>10/}");
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy", "10", "09", "2026"]);

    await userEvent.click(roleNamed("button", "Range B"));
    await expect.poll(segmentTexts).toEqual(["11", "02", "2026", "11", "06", "2026"]);
    await userEvent.click(roleNamed("button", "Range A"));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026", "10", "09", "2026"]);
  });

  it("checks the held range a parent's close commits against the minValue of that same render", async () => {
    const calls: string[] = [];
    function Controlled({
      open,
      min,
    }: {
      readonly open: boolean;
      readonly min: Temporal.PlainDate;
    }): ReactElement {
      return withLocale(
        "en-US",
        <DateRangePicker.Root
          aria-label="Window"
          granularity="minute"
          shouldCloseOnSelect={false}
          open={open}
          minValue={min}
          onValueChange={(value, details) =>
            calls.push(
              `${value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`}:${details.getValidationError() ?? "valid"}`
            )
          }>
          <DateRangePicker.Group>
            <DateRangePicker.StartInput />
            <DateRangePicker.EndInput />
            <DateRangePicker.Trigger />
          </DateRangePicker.Group>
          <DateRangePicker.Popup>
            <DateRangePicker.Calendar />
          </DateRangePicker.Popup>
        </DateRangePicker.Root>
      );
    }
    const { rerender } = renderThemed(<Controlled open min={Temporal.PlainDate.from("2026-10-01")} />);
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));
    rerender(<Controlled open={false} min={Temporal.PlainDate.from("2026-10-14")} />);
    await expect.poll(() => calls).toEqual(["2026-10-12T00:00:00..2026-10-16T00:00:00:rangeUnderflow"]);
  });

  it("commits a held range to the onChange of the render that closes the popup", async () => {
    const calls: string[] = [];
    function Controlled({ open, tag }: { readonly open: boolean; readonly tag: string }): ReactElement {
      return withLocale(
        "en-US",
        <DateRangePickerField
          label="Window"
          granularity="minute"
          shouldCloseOnSelect={false}
          isOpen={open}
          onChange={(value) =>
            calls.push(
              `${tag}:${value === null ? "null" : `${value.start.toString()}..${value.end.toString()}`}`
            )
          }
        />
      );
    }
    const { rerender } = renderThemed(<Controlled open tag="old" />);
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));
    rerender(<Controlled open={false} tag="new" />);
    await expect.poll(() => calls).toEqual(["new:2026-10-12T00:00:00..2026-10-16T00:00:00"]);
  });
});

describe("DateRangePicker kind of an empty picker", () => {
  /** An empty minute range whose zone the button below it sets or changes. */
  function Zoning({
    from,
    to,
    onValue,
  }: {
    readonly from: string | undefined;
    readonly to: string;
    readonly onValue: (value: string) => void;
  }): ReactElement {
    const [zone, setZone] = useState(from);
    return withLocale(
      "en-US",
      <>
        <DateRangePickerField
          label="Window"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          {...definedProps({ timeZone: zone })}
          onChange={(next) =>
            onValue(next === null ? "null" : `${next.start.toString()}..${next.end.toString()}`)
          }
        />
        <button type="button" onClick={() => setZone(to)}>
          Move
        </button>
      </>
    );
  }

  it.each([
    ["changes", "Europe/Oslo", "America/New_York", "-04:00"],
    ["is set", undefined, "Europe/Oslo", "+01:00"],
  ] as const)(
    "types both ends in the zone the calendar picks in once an empty picker's timeZone %s",
    async (_change, from, to, offset) => {
      const values: string[] = [];
      renderThemed(<Zoning from={from} to={to} onValue={(value) => values.push(value)} />);
      await userEvent.click(roleNamed("button", "Move"));
      await userEvent.click(roleNamed("spinbutton", "month, Start Date, Window"));
      await userEvent.keyboard("102620260800");
      await userEvent.click(roleNamed("spinbutton", "month, End Date, Window"));
      await userEvent.keyboard("102720261700");
      await expect
        .poll(() => values.at(-1))
        .toBe(`2026-10-26T08:00:00${offset}[${to}]..2026-10-27T17:00:00${offset}[${to}]`);
    }
  );
});

describe("preset dateValue of another kind", () => {
  it("throws while rendering for a range whose end is of another kind than the picker's", () => {
    expectRenderTypeError(
      "DatePicker.PresetItem dateValue.end: received a Temporal.ZonedDateTime inside DateRangePicker.Root, whose values are Temporal.PlainDate",
      <DateRangePicker.Root aria-label="Period" defaultOpen>
        <DateRangePicker.Popup>
          <DateRangePicker.Presets>
            <DateRangePicker.PresetItem
              value="mixed"
              dateValue={{
                start: Temporal.PlainDate.from("2026-10-05"),
                end: Temporal.ZonedDateTime.from("2026-10-09T00:00[Europe/Oslo]"),
              }}>
              Mixed
            </DateRangePicker.PresetItem>
          </DateRangePicker.Presets>
        </DateRangePicker.Popup>
      </DateRangePicker.Root>
    );
  });

  it("throws while rendering for one value inside DateRangePicker.Root", () => {
    expectRenderTypeError(
      "DatePicker.PresetItem dateValue: received one Temporal value inside DateRangePicker.Root",
      <DateRangePicker.Root aria-label="Period" defaultOpen>
        <DateRangePicker.Popup>
          <DateRangePicker.Presets>
            <DateRangePicker.PresetItem value="one" dateValue={Temporal.PlainDate.from("2026-10-05")}>
              One
            </DateRangePicker.PresetItem>
          </DateRangePicker.Presets>
        </DateRangePicker.Popup>
      </DateRangePicker.Root>
    );
  });
});
