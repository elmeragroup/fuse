/*
 * DateRangePicker and DateRangePickerField in the browser: the two Fields under `startName` and
 * `endName` with the label, description and merged error wired to both, a half-filled range held,
 * an end before its start, `Form` errors by name, the range calendar in the popup (cancel, presets
 * dropping a half range, multi-month) and the cancelable details. The shared consumer contract
 * (segment names, the calendar range commit, Escape twice) is pinned by the parity harness.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
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
    // Each year digit forms a whole range, as React Aria commits a growing year (0002, 0020, …).
    await expect
      .poll(() => log().element().textContent)
      .toMatch(/\| input-change:2026-10-05\.\.2026-10-09:valid$/u);
    expect(log().element().textContent).toMatch(/^input-change:2026-10-05\.\.0002-10-09:rangeReversed \|/u);
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

  it.each([
    ["day", "Europe/Oslo", "+01:00"],
    ["minute", "Europe/Oslo", "+01:00"],
  ] as const)(
    "keeps a cleared zoned range's kind and zone across a form reset at %s granularity",
    async (granularity, zone, offset) => {
      const values: string[] = [];
      function Zoned(): ReactElement {
        const [value, setValue] = useState<DateRangePickerValue<Temporal.ZonedDateTime> | null>({
          start: Temporal.ZonedDateTime.from(`2026-10-12T08:00[${zone}]`),
          end: Temporal.ZonedDateTime.from(`2026-10-16T17:30[${zone}]`),
        });
        return withLocale(
          "en-US",
          <form aria-label="Booking">
            <DateRangePickerField
              label="Window"
              granularity={granularity}
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
      const time = granularity === "minute" ? "0800" : "";
      await userEvent.click(roleNamed("spinbutton", "month, Start Date, Window"));
      await userEvent.keyboard(`10262026${time}`);
      await userEvent.click(roleNamed("spinbutton", "month, End Date, Window"));
      await userEvent.keyboard(`10272026${time}`);
      const at = granularity === "minute" ? "08:00" : "00:00";
      await expect
        .poll(() => values.at(-1))
        .toBe(`2026-10-26T${at}:00${offset}[${zone}]..2026-10-27T${at}:00${offset}[${zone}]`);
    }
  );
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
    // DOM audit: server HTML in a detached host has no accessibility tree to locate by role.
    const trigger = host.querySelector('[data-slot="date-picker-trigger"]');
    expect(trigger?.getAttribute("aria-label")).toBe("Calendar");
    expect(text(trigger?.getAttribute("aria-labelledby") ?? null)).toBe(" Period");
    const month = host.querySelector('[role="spinbutton"]');
    expect(text(month?.getAttribute("aria-describedby") ?? null)).toContain("Nights at the cabin Rejected");
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

  it("names the picker by its aria-label when a wrapper renders no Label, after mount", () => {
    renderThemed(<GhostLabel />);
    expect(roleNamed("group", "Stay")).toBeDefined();
    expect(roleNamed("spinbutton", "month, Start Date, Stay")).toBeDefined();
    expect(roleNamed("button", "Calendar Stay")).toBeDefined();
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
    // DOM audit: server HTML in a detached host has no accessibility tree to locate by role.
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

describe("DateRangePicker context", () => {
  it("re-renders no part when its parent re-renders it with new objects for the same range", async () => {
    // The input and the open calendar ask about every value or day they render, so the calls count
    // their renders.
    let checks = 0;
    const unavailable = (): boolean => {
      checks += 1;
      return false;
    };
    // Hoisted, so only the Root's contexts can re-render the parts.
    const parts = (
      <>
        <DateRangePicker.Group>
          <DateRangePicker.StartInput />
          <DateRangePicker.EndInput />
          <DateRangePicker.Trigger />
        </DateRangePicker.Group>
        <DateRangePicker.Popup>
          <DateRangePicker.Calendar />
        </DateRangePicker.Popup>
      </>
    );
    // Re-renders the parent without a press, which would land outside the popup and close it.
    const ticker = { tick: (): void => undefined };
    function Parent(): ReactElement {
      const [ticks, setTicks] = useState(0);
      useEffect(() => {
        ticker.tick = () => setTicks((current) => current + 1);
      }, []);
      return (
        <>
          <DateRangePicker.Root
            aria-label="Window"
            defaultOpen
            isDateUnavailable={unavailable}
            granularity="minute"
            value={{
              start: Temporal.PlainDateTime.from("2026-10-12T08:00"),
              end: Temporal.PlainDateTime.from("2026-10-16T17:30"),
            }}
            minValue={Temporal.PlainDate.from("2026-10-01")}>
            {parts}
          </DateRangePicker.Root>
          <output>Tick {ticks}</output>
        </>
      );
    }
    renderThemed(withLocale("en-US", <Parent />));
    await waitForPopupSettled();
    await expect.element(page.getByRole("spinbutton", { name: "hour, Start Date, Window" })).toBeVisible();
    const settled = checks;

    ticker.tick();
    await expect.element(page.getByRole("status")).toHaveTextContent("Tick 1");
    expect(settled).toBeGreaterThan(0);
    expect(checks).toBe(settled);
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    const prefix = 'DateRangePicker.Root value.start: received the string "2026-10-05"';
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderThemed(
      withLocale(
        "en-US",
        <CaughtError>
          <DateRangePickerField
            label="Period"
            value={{
              // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
              start: "2026-10-05",
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
          />
        </CaughtError>
      )
    );
    const { name, message } = caughtError();
    expect(name).toBe("TypeError");
    expect(message?.slice(0, prefix.length)).toBe(prefix);
    error.mockRestore();
  });
});
