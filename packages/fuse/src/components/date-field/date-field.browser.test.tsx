/**
 * Unit under test: DateField and the DateInput parts in Chromium, through roles, names, the
 * keyboard and forms. Oracles: React Aria's DateField behaviour (segment names and order, typing 03152008,
 * Backspace, the group's name and slot, the bound copy, mixed-kind bounds, time segments), React
 * Aria's `useDateSegment`/`IncompleteDate` editing rules worked out by hand for the keys and
 * locales the harness does not cover, and Base UI's Form and Field contracts (errors by name, focus
 * on the first invalid control, `onFormSubmit` values). Every scenario runs under a clock frozen at
 * local noon on June 15, 2030, so an arrow key on an empty segment reads that day.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import "../../temporal-polyfill";
import { Field } from "../field";
import { Form } from "../form/form";
import { DateField } from "./date-field";
import type { DateFieldProps } from "./date-field";
import type { DateInputRootProps, DateInputValue } from "./date-input";
import type { DateInputValueChangeReason } from "./date-input-change-details";
import { DateInput } from "./index";

const UNCHANGED = "unchanged";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-06-15T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function committed() {
  return page.getByRole("status", { name: "Committed value" });
}

/** Every segment's visible text, literals left out, in DOM order. */
function segmentTexts(): string[] {
  // Segments are not one role (spinbutton, textbox, hidden literal), and their slot and
  // `data-type` are the part's public contract.
  return [...document.querySelectorAll('[data-slot="date-input-segment"]:not([data-type="literal"])')].map(
    (element) => element.textContent
  );
}

function spin(name: string): HTMLElement {
  return roleNamed("spinbutton", name);
}

type HarnessProps<T extends DateInputValue> = DateFieldProps<T> & { readonly locale?: SupportedLocale };

/** A DateField printing the last value it committed. */
function Harness<T extends DateInputValue>({ locale = "en-US", ...props }: HarnessProps<T>): ReactElement {
  const [value, setValue] = useState(UNCHANGED);
  return withLocale(
    locale,
    <>
      <button type="button">Before</button>
      <DateField {...props} onChange={(next) => setValue(next === null ? "null" : next.toString())} />
      <button type="button">After</button>
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

describe("DateField segments", () => {
  it("names each segment by its unit and the label, in en-US order", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);

    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveTextContent("10");
    expect(spin("day, Start date").textContent).toBe("05");
    expect(spin("year, Start date").textContent).toBe("2026");
    expect(segmentTexts()).toEqual(["10", "05", "2026"]);
    const group = roleNamed("group", "Start date");
    expect(group).toHaveAttribute("data-slot", "field-group");
    expect(group).not.toHaveAttribute("data-invalid");
    expect(group.textContent).toBe("10/05/2026");
  });

  it("commits March 15, 2008 from the digits 03152008 typed into an empty field", async () => {
    renderThemed(<Harness label="Birth date" />);
    expect(segmentTexts()).toEqual(["mm", "dd", "yyyy"]);

    await userEvent.click(page.getByRole("spinbutton").first());
    await userEvent.keyboard("03152008");

    await expect.element(committed()).toHaveTextContent("2008-03-15");
    expect(segmentTexts()).toEqual(["03", "15", "2008"]);
    await expect
      .element(page.getByRole("spinbutton", { name: "year, Birth date", exact: true }))
      .toHaveFocus();
  });

  it("clears a segment with Backspace, keeps the committed value, then moves to the previous segment", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("day, Start date"));

    await userEvent.keyboard("{Backspace}");
    expect(segmentTexts()).toEqual(["10", "dd", "2026"]);
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
    await expect.element(committed()).toHaveTextContent(UNCHANGED);

    await userEvent.keyboard("{Backspace}");
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();
    expect(segmentTexts()).toEqual(["10", "dd", "2026"]);
    await expect.element(committed()).toHaveTextContent(UNCHANGED);
  });

  it("deletes the last year digit with Backspace and commits the shorter year", async () => {
    renderThemed(<Harness label="Birth date" />);
    await userEvent.click(page.getByRole("spinbutton").first());
    await userEvent.keyboard("03152008{Backspace}");

    await expect.element(committed()).toHaveTextContent("0200-03-15");
    expect(segmentTexts()).toEqual(["03", "15", "200"]);
  });
});

describe("DateField keys", () => {
  it("fills an empty segment from today on ArrowUp and wraps at the limits", async () => {
    renderThemed(<Harness label="Start date" />);
    await userEvent.click(spin("month, Start date"));

    await userEvent.keyboard("{ArrowUp}");
    expect(segmentTexts()).toEqual(["06", "dd", "yyyy"]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(segmentTexts()).toEqual(["12", "dd", "yyyy"]);
    await userEvent.keyboard("{ArrowUp}");
    expect(segmentTexts()).toEqual(["01", "dd", "yyyy"]);
    await expect.element(committed()).toHaveTextContent(UNCHANGED);
  });

  it("moves between segments with the left and right arrows", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("month, Start date"));

    await userEvent.keyboard("{ArrowRight}");
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect
      .element(page.getByRole("spinbutton", { name: "year, Start date", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
  });

  it("pages days by 7 and years to the next multiple of 5, and jumps to the ends with Home and End", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-28")} />);
    await userEvent.click(spin("day, Start date"));

    await userEvent.keyboard("{PageUp}");
    // React Aria lets a day run to 31 in any month; Oct 28 + 7 wraps past 31 to 4.
    await expect.element(committed()).toHaveTextContent("2026-10-04");
    await userEvent.keyboard("{End}");
    await expect.element(committed()).toHaveTextContent("2026-10-31");
    await userEvent.keyboard("{Home}");
    await expect.element(committed()).toHaveTextContent("2026-10-01");

    await userEvent.click(spin("year, Start date"));
    await userEvent.keyboard("{PageUp}");
    await expect.element(committed()).toHaveTextContent("2030-10-01");
    await userEvent.keyboard("{PageDown}");
    await expect.element(committed()).toHaveTextContent("2025-10-01");
  });

  it("restarts a segment when the next digit would pass its maximum, and moves on", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("month, Start date"));

    // "1" may still become 10–12, so focus stays; "3" would make 13, so it restarts at 3 and moves.
    await userEvent.keyboard("1");
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("3");
    await expect.element(committed()).toHaveTextContent("2026-03-05");
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
  });
});

describe("DateField blur", () => {
  it("reports a half-typed field incomplete on blur", async () => {
    renderThemed(<Harness label="Start date" />);
    await userEvent.click(spin("month, Start date"));
    await userEvent.keyboard("10");
    await userEvent.click(roleNamed("button", "After"));

    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");
    await expect
      .element(
        page.getByText("Please enter a valid value. The field is incomplete or has an invalid date.", {
          exact: true,
        })
      )
      .toBeVisible();
    await expect.element(committed()).toHaveTextContent(UNCHANGED);
  });

  it("keeps a typed February 30 until blur, then commits it constrained to the month's last day", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-01-30")} />);
    await userEvent.click(spin("month, Start date"));
    await userEvent.keyboard("02");

    expect(segmentTexts()).toEqual(["02", "30", "2026"]);
    await expect.element(committed()).toHaveTextContent(UNCHANGED);

    await userEvent.click(roleNamed("button", "After"));
    await expect.element(committed()).toHaveTextContent("2026-02-28");
    expect(segmentTexts()).toEqual(["02", "28", "2026"]);
  });
});

/** A controlled field whose parent loads another value once "Load" is pressed. */
function LoadHarness({
  initial,
  loaded,
}: {
  readonly initial: DateInputValue | null;
  readonly loaded: DateInputValue;
}): ReactElement {
  const [value, setValue] = useState(initial);
  return withLocale(
    "en-US",
    <>
      <DateField label="Starts" value={value} onChange={setValue} />
      <button type="button" onClick={() => setValue(loaded)}>
        Load
      </button>
    </>
  );
}

describe("DateField kind-change warning", () => {
  function kindWarnings(warn: { readonly mock: { readonly calls: unknown[][] } }): unknown[][] {
    return warn.mock.calls.filter(([message]) => /changed kind/u.test(String(message)));
  }

  it("warns when a value of another kind replaces a value the field held", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      renderThemed(
        <LoadHarness
          initial={Temporal.PlainDate.from("2026-10-12")}
          loaded={Temporal.PlainDateTime.from("2026-10-12T09:30:00")}
        />
      );
      await userEvent.click(roleNamed("button", "Load"));
      await expect.poll(segmentTexts).toEqual(["10", "12", "2026", "09", "30", "AM"]);
      expect(kindWarnings(warn)).toEqual([
        [
          "DateInput.Root value changed kind from PlainDate to PlainDateTime. Keep one kind per input; the input emits the kind it last held.",
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not warn when a loaded value replaces the kind an empty field's props made", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      renderThemed(
        <LoadHarness
          initial={null}
          loaded={Temporal.ZonedDateTime.from("2026-10-12T09:30:00+02:00[Europe/Oslo]")}
        />
      );
      await userEvent.click(roleNamed("button", "Load"));
      await expect.poll(segmentTexts).toEqual(["10", "12", "2026", "09", "30", "AM", "GMT+2"]);
      expect(kindWarnings(warn)).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("DateField validation", () => {
  it("shows an explicit errorMessage in place of the built-in copy only once validation fails", async () => {
    renderThemed(
      <Harness
        label="Start date"
        errorMessage="Pick a weekday"
        maxValue={Temporal.PlainDate.from("2026-10-31")}
        defaultValue={Temporal.PlainDate.from("2026-10-05")}
      />
    );
    expect(page.getByText("Pick a weekday").query()).toBeNull();

    await userEvent.click(spin("year, Start date"));
    await userEvent.keyboard("2027");
    await userEvent.tab();

    await expect.element(page.getByText("Pick a weekday", { exact: true })).toBeVisible();
    expect(page.getByText(/or earlier/).query()).toBeNull();
  });

  it("marks the group invalid with the consumer's copy when isInvalid is passed", async () => {
    renderThemed(
      <Harness
        label="Start up date"
        description="Weekdays only"
        errorMessage="Pick a weekday"
        isInvalid
        defaultValue={Temporal.PlainDate.from("2026-10-05")}
      />
    );
    await expect
      .element(page.getByRole("group", { name: "Start up date", exact: true }))
      .toHaveAttribute("data-invalid", "true");
    await expect.element(page.getByText("Weekdays only", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Pick a weekday", { exact: true })).toBeVisible();
  });

  it("names a zoned minValue of a date field by the wall-clock day it is compared on", async () => {
    // 00:30 in Oslo on November 9 is 23:30 UTC on November 8; a date compares with its Oslo day.
    renderThemed(
      <Harness
        label="Start date"
        minValue={Temporal.ZonedDateTime.from("2026-11-09T00:30+01:00[Europe/Oslo]")}
        defaultValue={Temporal.PlainDate.from("2026-11-10")}
      />
    );
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("08");
    await userEvent.tab();

    await expect.element(committed()).toHaveTextContent("2026-11-08");
    await expect.element(page.getByText("Value must be 11/09/2026 or later.", { exact: true })).toBeVisible();
  });

  it("names a zoned maxValue of a date-time field by the wall clock it is compared on", async () => {
    renderThemed(
      <Harness
        label="Starts"
        granularity="minute"
        hourCycle={24}
        maxValue={Temporal.ZonedDateTime.from("2026-10-31T23:30+01:00[Europe/Oslo]")}
        defaultValue={Temporal.PlainDateTime.from("2026-10-31T23:00")}
      />
    );
    await userEvent.click(spin("minute, Starts"));
    await userEvent.keyboard("45");
    await userEvent.tab();

    await expect.element(committed()).toHaveTextContent("2026-10-31T23:45:00");
    await expect
      .element(page.getByText("Value must be 10/31/2026, 23:30 or earlier.", { exact: true }))
      .toBeVisible();
  });

  it("reports an unavailable date with React Aria's copy", async () => {
    renderThemed(
      <Harness
        label="Start date"
        defaultValue={Temporal.PlainDate.from("2026-10-05")}
        isDateUnavailable={(date) => date.dayOfWeek === 6}
      />
    );
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("10");
    await userEvent.tab();

    await expect.element(committed()).toHaveTextContent("2026-10-10");
    await expect.element(page.getByText("Selected date unavailable.", { exact: true })).toBeVisible();
  });

  it.each([
    ["2026-10-31T23:00[Europe/Oslo]", "30", "2026-10-31T23:30:00+01:00[Europe/Oslo]", null],
    [
      "2026-10-31T23:00[Europe/Oslo]",
      "31",
      "2026-10-31T23:31:00+01:00[Europe/Oslo]",
      "Value must be 10/31/2026, 23:30 or earlier.",
    ],
    ["2026-10-31T20:00[America/New_York]", "15", "2026-10-31T20:15:00-04:00[America/New_York]", null],
    [
      "2026-09-30T17:00[America/New_York]",
      "30",
      "2026-09-30T17:30:00-04:00[America/New_York]",
      "Value must be 09/30/2026, 18:00 or later.",
    ],
  ])(
    "compares %s with a zoned minimum and a plain maximum as React Aria does",
    async (start, minute, value, copy) => {
      renderThemed(
        <Harness
          label="Period"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          minValue={Temporal.ZonedDateTime.from("2026-10-01T00:00[Europe/Oslo]")}
          maxValue={Temporal.PlainDateTime.from("2026-10-31T23:30")}
          defaultValue={Temporal.ZonedDateTime.from(start)}
        />
      );
      await userEvent.click(spin("minute, Period"));
      await userEvent.keyboard(minute);
      await userEvent.tab();

      await expect.element(committed()).toHaveTextContent(value);
      const group = page.getByRole("group", { name: "Period", exact: true });
      if (copy === null) {
        await expect.element(group).not.toHaveAttribute("data-invalid");
      } else {
        await expect.element(group).toHaveAttribute("data-invalid", "true");
        await expect.element(page.getByText(copy, { exact: true })).toBeVisible();
      }
    }
  );
});

/** A DateInput reporting each change's reason, canceling the reasons it is told to. */
function CancelHarness({
  cancel,
  ...props
}: DateInputRootProps & { readonly cancel: readonly DateInputValueChangeReason[] }): ReactElement {
  const [log, setLog] = useState<string[]>([]);
  return withLocale(
    "en-US",
    <>
      <DateInput.Root
        aria-label="Start date"
        {...props}
        onValueChange={(value, details) => {
          setLog((entries) => [
            ...entries,
            `${details.reason}:${value === null ? "null" : value.toString()}`,
          ]);
          if (cancel.includes(details.reason)) {
            details.cancel();
          }
        }}
      />
      <output aria-label="Change log">{log.join(" ")}</output>
    </>
  );
}

function changeLog() {
  return page.getByRole("status", { name: "Change log" });
}

describe("DateInput onValueChange details", () => {
  it("reports clearing every segment as input-clear, and canceling it keeps the value", async () => {
    renderThemed(
      <CancelHarness cancel={["input-clear"]} defaultValue={Temporal.PlainDate.from("2026-10-05")} />
    );
    await userEvent.click(spin("year, Start date"));
    // Each Backspace drops a digit, committing the shorter year, or on an empty segment moves back
    // one: four for the year, one to move, one for the day, one to move, two for the month.
    await userEvent.keyboard("{Backspace>9/}");

    await expect
      .element(changeLog())
      .toHaveTextContent(
        "input-change:0202-10-05 input-change:0020-10-05 input-change:0002-10-05 input-clear:null"
      );
    expect(segmentTexts()).toEqual(["10", "5", "2"]);
  });

  it("commits pasted ISO text as input-paste, and canceling it keeps the value", async () => {
    renderThemed(
      <CancelHarness cancel={["input-paste"]} defaultValue={Temporal.PlainDate.from("2026-10-05")} />
    );
    const target = spin("day, Start date");
    target.focus();
    const data = new DataTransfer();
    data.setData("text/plain", "2027-01-02");
    target.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
    );

    await expect.element(changeLog()).toHaveTextContent("input-paste:2027-01-02");
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);
  });

  it("keeps the value and shows it again when an input-change is canceled", async () => {
    renderThemed(
      <CancelHarness cancel={["input-change"]} defaultValue={Temporal.PlainDate.from("2026-10-05")} />
    );
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("{ArrowUp}");

    await expect.element(changeLog()).toHaveTextContent("input-change:2026-10-06");
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);
  });

  it("applies an input-change that is not canceled", async () => {
    renderThemed(<CancelHarness cancel={[]} defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("{ArrowUp}");

    await expect.element(changeLog()).toHaveTextContent("input-change:2026-10-06");
    expect(segmentTexts()).toEqual(["10", "6", "2026"]);
  });
});

describe("DateField in forms", () => {
  it("submits the ISO value under its name and to onFormSubmit", async () => {
    let submitted: unknown;
    renderThemed(
      withLocale(
        "en-US",
        <Form
          aria-label="Booking"
          onFormSubmit={(values) => {
            submitted = values;
          }}>
          <DateField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <button type="submit">Save</button>
        </Form>
      )
    );
    expect(new FormData(formNamed("Booking")).get("start")).toBe("2026-10-05");

    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toEqual({ start: "2026-10-05" });
  });

  it("blocks a submit with a required empty field, shows why and focuses its first segment", async () => {
    let submits = 0;
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Booking" onFormSubmit={() => (submits += 1)}>
          <DateField label="Start date" name="start" isRequired />
          <button type="submit">Save</button>
        </Form>
      )
    );
    await userEvent.click(roleNamed("button", "Save"));

    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();
    await expect.element(page.getByText("Please fill out this field.", { exact: true })).toBeVisible();
    expect(submits).toBe(0);
  });

  it("shows a returned error by name, focuses the first segment, and clears it on edit", async () => {
    function Booking(): ReactElement {
      const [errors, setErrors] = useState<Record<string, string>>({});
      return withLocale(
        "en-US",
        <Form aria-label="Booking" errors={errors} onFormSubmit={() => setErrors({ start: "Fully booked" })}>
          <DateField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <button type="submit">Save</button>
        </Form>
      );
    }
    renderThemed(<Booking />);
    await userEvent.click(roleNamed("button", "Save"));

    await expect.element(page.getByText("Fully booked", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(page.getByText("Fully booked", { exact: true })).not.toBeInTheDocument();
  });

  it("works bare inside a consumer's Field: its label names the group and its error shows the validity", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Booking" onFormSubmit={() => undefined}>
          <Field.Root name="start">
            <Field.Label>Start date</Field.Label>
            <DateInput.Root required />
            <Field.Error />
          </Field.Root>
          <button type="submit">Save</button>
        </Form>
      )
    );
    expect(roleNamed("group", "Start date")).toBeDefined();
    expect(spin("month, Start date")).toBeDefined();

    await userEvent.click(roleNamed("button", "Save"));
    await expect.element(page.getByText("Please fill out this field.", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start date", exact: true }))
      .toHaveFocus();

    await userEvent.keyboard("10052026");
    await userEvent.click(roleNamed("button", "Save"));
    await expect
      .element(page.getByText("Please fill out this field.", { exact: true }))
      .not.toBeInTheDocument();
  });

  it("restores its default value on form reset", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <form aria-label="Booking">
          <DateField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <button type="reset">Reset</button>
        </form>
      )
    );
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("{ArrowUp}");
    expect(segmentTexts()).toEqual(["10", "06", "2026"]);

    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);
  });
});

/** A controlled date-time field whose parent echoes every value back, printing it. */
function ControlledTypingHarness(): ReactElement {
  const [value, setValue] = useState<Temporal.PlainDateTime | null>(
    Temporal.PlainDateTime.from("2026-10-05T09:30")
  );
  return withLocale(
    "en-US",
    <>
      <DateField label="Starts" granularity="minute" hourCycle={24} value={value} onChange={setValue} />
      <output aria-label="Committed value">{String(value)}</output>
    </>
  );
}

describe("DateInput reconciliation", () => {
  it("keeps typing several digits into a segment while a parent echoes each value it commits", async () => {
    renderThemed(<ControlledTypingHarness />);
    // Each first digit commits on its own ("1" is January), and the parent echoes it back before
    // the second digit, which must still extend it: 12, 24, 2027, 18.
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("12242027");
    await expect.element(committed()).toHaveTextContent("2027-12-24T09:30:00");
    await expect.element(page.getByRole("spinbutton", { name: "hour, Starts", exact: true })).toHaveFocus();
    await userEvent.keyboard("18");
    await expect.element(committed()).toHaveTextContent("2027-12-24T18:30:00");
    expect(segmentTexts()).toEqual(["12", "24", "2027", "18", "30"]);
  });

  it("does not warn of a kind change when the parent moves the value to another zone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      renderThemed(<ZoneMoveHarness />);
      await userEvent.click(roleNamed("button", "New York"));
      await expect.poll(segmentTexts).toEqual(["10", "12", "2026", "03", "30", "AM", "EDT"]);
      expect(warn.mock.calls.filter(([message]) => /changed kind/u.test(String(message)))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps every typed year digit of an Oslo day field while a parent echoes each value", async () => {
    // Each year digit commits a year Oslo writes in local mean time (+00:53:28), which ISO text
    // rounds to +00:53: the echo must read back as the value the input committed (#540).
    renderThemed(<ZonedDayEchoHarness />);
    await userEvent.click(spin("year, Starts"));
    await userEvent.keyboard("2026");
    await expect.element(committed()).toHaveTextContent("2026-10-05T00:00:00+02:00[Europe/Oslo]");
    expect(segmentTexts()).toEqual(["10", "05", "2026"]);
  });

  it("drops a draft for good when the parent replaces the value, so restoring it shows the value", async () => {
    renderThemed(<ControlledHarness />);
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("{Backspace}");
    expect(segmentTexts()).toEqual(["10", "dd", "2026"]);
    // Tab past the year to the button: the incomplete message blur shows would move the button
    // under a mouse press.
    await userEvent.tab();
    await userEvent.tab();
    await expect.element(page.getByRole("button", { name: "November" })).toHaveFocus();
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");

    await userEvent.keyboard("{Enter}");
    await expect.poll(segmentTexts).toEqual(["11", "06", "2026"]);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);
    expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");
  });
});

describe("DateInput descriptions", () => {
  it("describes the group by the consumer's aria-describedby and its Field's description together", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Field.Root name="start">
          <Field.Label>Start date</Field.Label>
          <DateInput.Root
            aria-describedby="start-hint"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
          />
          <span id="start-hint">Local time</span>
          <Field.Description>Weekdays only</Field.Description>
        </Field.Root>
      )
    );
    const group = roleNamed("group", "Start date");
    expect(group).toHaveAccessibleDescription(/Local time/u);
    expect(group).toHaveAccessibleDescription(/Weekdays only/u);
  });
});

describe("DateInput form reset", () => {
  it("clears the Field's incomplete error with the draft when the form resets", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Booking" onFormSubmit={() => undefined}>
          <DateField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <button type="submit">Save</button>
          <button type="reset">Reset</button>
        </Form>
      )
    );
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard("{Backspace}");
    await userEvent.click(roleNamed("button", "Save"));
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");
    await expect
      .element(
        page.getByText("Please enter a valid value. The field is incomplete or has an invalid date.", {
          exact: true,
        })
      )
      .toBeVisible();

    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .not.toHaveAttribute("data-invalid");
    await expect.element(page.getByText(/The field is incomplete/u)).not.toBeInTheDocument();
  });

  it("stays unflagged when a reset empties a required field after a failed submit", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Form aria-label="Booking" onFormSubmit={() => undefined}>
          <DateField label="Start date" name="start" isRequired />
          <button type="submit">Save</button>
          <button type="reset">Reset</button>
        </Form>
      )
    );
    await userEvent.click(roleNamed("button", "Save"));
    await expect.element(page.getByText("Please fill out this field.", { exact: true })).toBeVisible();
    await userEvent.keyboard("10052026");
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);

    await userEvent.click(roleNamed("button", "Reset"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy"]);
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .not.toHaveAttribute("data-invalid");
    await expect
      .element(page.getByText("Please fill out this field.", { exact: true }))
      .not.toBeInTheDocument();
  });
});

describe("DateField paste of its own value", () => {
  it("shows the pasted value whole again and lets the form submit, without reporting a change", async () => {
    const changes: string[] = [];
    let submits = 0;
    renderThemed(
      withLocale(
        "en-US",
        <Form
          aria-label="Booking"
          onFormSubmit={() => {
            submits += 1;
          }}>
          <DateField
            label="Start date"
            name="start"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            onChange={(next) => changes.push(String(next))}
          />
          <button type="submit">Save</button>
        </Form>
      )
    );
    const day = spin("day, Start date");
    await userEvent.click(day);
    await userEvent.keyboard("{Backspace}");
    expect(segmentTexts()).toEqual(["10", "dd", "2026"]);

    const data = new DataTransfer();
    data.setData("text/plain", "2026-10-05");
    day.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);

    await userEvent.click(roleNamed("button", "Save"));
    await expect.poll(() => submits).toBe(1);
    expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");
    expect(changes).toEqual([]);
  });
});

describe("DateField paste of a date-only ISO text", () => {
  it("reads 0010-05-01 as the date it names", async () => {
    renderThemed(<Harness label="Starts" />);
    const data = new DataTransfer();
    data.setData("text/plain", "0010-05-01");
    spin("month, Starts").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
    );

    await expect.element(committed()).toHaveTextContent("0010-05-01");
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'DateInput.Root defaultValue: received the string "2026-10-05T09:30"',
      <DateField
        label="Starts"
        granularity="minute"
        // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
        defaultValue="2026-10-05T09:30"
      />
    );
  });

  it("throws for ISO text in value after the equal Temporal value, whatever rendered before", () => {
    expectRenderTypeError(
      'DateInput.Root value: received the string "2026-10-05"',
      <DateField label="Starts" value={Temporal.PlainDate.from("2026-10-05")} />,
      <DateField
        label="Starts"
        // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
        value="2026-10-05"
      />
    );
  });
});

/** A Harness whose parent swaps some of its props once "Switch" is pressed. */
function SwitchHarness<T extends DateInputValue>({
  switched,
  ...props
}: HarnessProps<T> & { readonly switched: Partial<DateFieldProps<T>> }): ReactElement {
  const [on, setOn] = useState(false);
  return (
    <>
      <Harness<T> {...(on ? { ...props, ...switched } : props)} />
      <button type="button" onClick={() => setOn(true)}>
        Switch
      </button>
    </>
  );
}

/** A controlled DateField whose parent can replace the value. */
function ControlledHarness(): ReactElement {
  const [value, setValue] = useState<Temporal.PlainDate | null>(Temporal.PlainDate.from("2026-10-05"));
  return withLocale(
    "en-US",
    <>
      <DateField label="Start date" value={value} onChange={setValue} />
      <button type="button" onClick={() => setValue(Temporal.PlainDate.from("2026-11-06"))}>
        November
      </button>
      <button type="button" onClick={() => setValue(Temporal.PlainDate.from("2026-10-05"))}>
        October
      </button>
    </>
  );
}

/** A controlled zoned field whose parent can move the value to another zone. */
function ZoneMoveHarness(): ReactElement {
  const [value, setValue] = useState<Temporal.ZonedDateTime | null>(
    Temporal.ZonedDateTime.from("2026-10-12T09:30:00+02:00[Europe/Oslo]")
  );
  return withLocale(
    "en-US",
    <>
      <DateField label="Starts" granularity="minute" value={value} onChange={setValue} />
      <button type="button" onClick={() => setValue(value?.withTimeZone("America/New_York") ?? null)}>
        New York
      </button>
    </>
  );
}

/** A controlled zoned day field in Oslo whose parent echoes every value back, printing it. */
function ZonedDayEchoHarness(): ReactElement {
  const [value, setValue] = useState<Temporal.ZonedDateTime | null>(
    Temporal.ZonedDateTime.from("2026-10-05T00:00:00+02:00[Europe/Oslo]")
  );
  return withLocale(
    "en-US",
    <>
      <DateField label="Starts" granularity="day" value={value} onChange={setValue} />
      <output aria-label="Committed value">{String(value)}</output>
    </>
  );
}

/** A DateInput whose segments the host renders as `<strong>` once asked. */
function RenderSwapHarness(): ReactElement {
  const [strong, setStrong] = useState(false);
  const [value, setValue] = useState("unchanged");
  return withLocale(
    "en-US",
    <>
      <DateInput.Root aria-label="Start date" onValueChange={(next) => setValue(String(next))}>
        {(segment) => (
          <DateInput.Segment key={segment.index} segment={segment} render={strong ? <strong /> : undefined} />
        )}
      </DateInput.Root>
      <button type="button" onClick={() => setStrong(true)}>
        Bold
      </button>
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

describe("DateField locales", () => {
  it.each([
    ["nb-NO", ["dd", "mm", "åååå"], "15032008", ["15", "03", "2008"], "dag, Fødselsdato"],
    ["sv-SE", ["åååå", "mm", "dd"], "20080315", ["2008", "03", "15"], "år, Fødselsdato"],
    ["fi-FI", ["pp", "kk", "vvvv"], "15032008", ["15", "03", "2008"], "päivä, Fødselsdato"],
  ] as const)(
    "shows %s's placeholders in its order and commits March 15, 2008 typed in that order",
    async (locale, placeholders, digits, texts, firstName) => {
      renderThemed(<Harness locale={locale} label="Fødselsdato" />);
      expect(segmentTexts()).toEqual(placeholders);

      await userEvent.click(spin(firstName));
      await userEvent.keyboard(digits);

      await expect.element(committed()).toHaveTextContent("2008-03-15");
      expect(segmentTexts()).toEqual(texts);
    }
  );
});

describe("DateField modifier chords", () => {
  it("leaves the value alone for Ctrl, Meta and Alt with a step, edge or erase key", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("day, Start date"));
    await userEvent.keyboard(
      "{Control>}{ArrowUp}{/Control}{Meta>}{ArrowDown}{/Meta}{Alt>}{ArrowUp}{/Alt}{Control>}{Home}{/Control}{Meta>}{End}{/Meta}{Control>}{PageUp}{/Control}"
    );
    expect(segmentTexts()).toEqual(["10", "05", "2026"]);
    // Ctrl+Backspace stays out: macOS runs it as a plain delete, which reaches the segment as the
    // platform's own `beforeinput` erase, not as a chord.
    await userEvent.keyboard("{Meta>}{Backspace}{/Meta}{Alt>}{Delete}{/Alt}");
    expect(segmentTexts()).toEqual(["10", "05", "2026"]);
    await expect.element(committed()).toHaveTextContent(UNCHANGED);

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(committed()).toHaveTextContent("2026-10-06");
  });

  it("leaves Alt with the left and right arrows to the browser, keeping focus on the segment", async () => {
    renderThemed(<Harness label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />);
    await userEvent.click(spin("day, Start date"));
    const prevented: boolean[] = [];
    const record = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        prevented.push(event.defaultPrevented);
      }
    };
    // Bubble phase on the window, after the segment's own handler has run.
    window.addEventListener("keydown", record);
    try {
      await userEvent.keyboard("{Alt>}{ArrowRight}{ArrowLeft}{/Alt}");
    } finally {
      window.removeEventListener("keydown", record);
    }
    expect(prevented).toEqual([false, false]);
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
  });
});

describe("DateField time segments", () => {
  it("shows 24-hour hour and minute segments and no zone for a hidden-zone ZonedDateTime", () => {
    renderThemed(
      <Harness
        label="Starts"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        defaultValue={Temporal.ZonedDateTime.from("2026-10-12T14:30[Europe/Oslo]")}
      />
    );

    expect(segmentTexts()).toEqual(["10", "12", "2026", "14", "30"]);
    expect(roleNamed("group", "Starts").textContent).toBe(
      `10/12/2026, ${String.fromCodePoint(0x2066)}14:30${String.fromCodePoint(0x2069)}`
    );
    expect(spin("hour, Starts")).toHaveAttribute("aria-valuetext", "14");
  });

  it("shows an AM/PM segment for a read-only date-time under the en-US hour cycle", () => {
    renderThemed(
      <Harness
        label="Delivered at"
        isReadOnly
        granularity="minute"
        defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
      />
    );

    expect(segmentTexts()).toEqual(["10", "12", "2026", "02", "30", "PM"]);
    for (const unit of ["month", "day", "year", "hour", "minute", "AM/PM"]) {
      const segment = spin(`${unit}, Delivered at`);
      expect(segment).toHaveAttribute("aria-readonly", "true");
      expect(segment.tabIndex).toBe(0);
    }
    expect(spin("month, Delivered at")).toHaveAttribute("aria-valuetext", "10 – October");
    expect(spin("hour, Delivered at")).toHaveAttribute("aria-valuetext", "2 PM");
  });

  it("sets the day period by its first letter and keeps the zone's name read-only", async () => {
    renderThemed(
      <Harness
        label="Starts"
        granularity="minute"
        defaultValue={Temporal.ZonedDateTime.from("2026-01-12T09:30[America/New_York]")}
      />
    );
    expect(segmentTexts()).toEqual(["01", "12", "2026", "09", "30", "AM", "EST"]);
    expect(roleNamed("textbox", "time zone, Starts")).toHaveAttribute("aria-readonly", "true");

    await userEvent.click(spin("AM/PM, Starts"));
    await userEvent.keyboard("p");
    await expect.element(committed()).toHaveTextContent("2026-01-12T21:30:00-05:00[America/New_York]");
  });

  it("makes an empty field zoned in its timeZone", async () => {
    renderThemed(
      <Harness label="Starts" granularity="minute" hourCycle={24} hideTimeZone timeZone="Europe/Oslo" />
    );
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("101220260930");

    await expect.element(committed()).toHaveTextContent("2026-10-12T09:30:00+02:00[Europe/Oslo]");
  });

  it("keeps the kind and zone of a value it held after every segment is cleared", async () => {
    // No timeZone and no granularity: only the value it held names the zone.
    renderThemed(
      <Harness
        label="Starts"
        hourCycle={24}
        hideTimeZone
        defaultValue={Temporal.ZonedDateTime.from("2026-10-12T09:30[America/New_York]")}
      />
    );
    await userEvent.click(spin("minute, Starts"));
    // Backspace drops each digit and, on an emptied segment, moves back, until every segment is empty.
    await userEvent.keyboard("{Backspace>20/}");
    await expect.element(committed()).toHaveTextContent("null");
    expect(segmentTexts()).toEqual(["mm", "dd", "yyyy", "––", "––"]);

    await expect.element(page.getByRole("spinbutton", { name: "month, Starts", exact: true })).toHaveFocus();
    await userEvent.keyboard("110320261445");
    await expect.element(committed()).toHaveTextContent("2026-11-03T14:45:00-05:00[America/New_York]");
  });
});

describe("DateField granularity change mid-draft", () => {
  const INCOMPLETE = "Please enter a valid value. The field is incomplete or has an invalid date.";

  it("drops a date typed at minute granularity once the field shows days, with no incomplete error", async () => {
    renderThemed(
      <SwitchHarness<Temporal.PlainDate>
        label="Starts"
        hourCycle={24}
        granularity="minute"
        switched={{ granularity: "day" }}
      />
    );
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("10122026");
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByText(INCOMPLETE, { exact: true })).toBeVisible();

    await userEvent.click(roleNamed("button", "Switch"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy"]);
    await expect.element(committed()).toHaveTextContent(UNCHANGED);
    await expect.element(page.getByText(/The field is incomplete/u)).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("group", { name: "Starts", exact: true }))
      .not.toHaveAttribute("data-invalid");
  });

  it("keeps a value's time when its hour was emptied before the field shows days", async () => {
    renderThemed(
      <SwitchHarness<Temporal.PlainDateTime>
        label="Starts"
        hourCycle={12}
        granularity="minute"
        defaultValue={Temporal.PlainDateTime.from("2026-10-05T09:30")}
        switched={{ granularity: "day" }}
      />
    );
    await userEvent.click(spin("hour, Starts"));
    await userEvent.keyboard("{Backspace}");
    expect(segmentTexts()).toEqual(["10", "05", "2026", "––", "30", "AM"]);
    // Blur first: the message it shows would move the Switch button from under the pointer.
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByText(INCOMPLETE, { exact: true })).toBeVisible();

    await userEvent.click(roleNamed("button", "Switch"));
    await expect.poll(segmentTexts).toEqual(["10", "05", "2026"]);
    await expect.element(page.getByText(/The field is incomplete/u)).not.toBeInTheDocument();
    // A blur confirms what the segments show: the hidden emptied hour must not commit as 12 AM.
    await userEvent.click(spin("month, Starts"));
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(committed()).toHaveTextContent(UNCHANGED);
  });
});

describe("DateField granularity change under focus", () => {
  // React Aria's `useDateSegment`: a focused segment that a granularity change removes hands focus
  // to the segment before it. `click()` switches without moving focus, as a parent's own state
  // change would.
  it.each([
    ["hour", "hour, Starts"],
    ["day", "year, Starts"],
  ] as const)(
    "moves focus from a removed minute to the segment before it at %s granularity",
    async (granularity, target) => {
      renderThemed(
        <SwitchHarness<Temporal.PlainDateTime>
          label="Starts"
          hourCycle={12}
          granularity="minute"
          defaultValue={Temporal.PlainDateTime.from("2026-10-05T09:30")}
          switched={{ granularity }}
        />
      );
      await userEvent.click(spin("minute, Starts"));

      roleNamed("button", "Switch").click();

      await expect.element(page.getByRole("spinbutton", { name: target, exact: true })).toHaveFocus();
    }
  );
});

describe("DateField kind across prop changes", () => {
  it("takes a time once an empty date field's granularity turns to minutes", async () => {
    renderThemed(
      <SwitchHarness<Temporal.PlainDateTime>
        label="Starts"
        hourCycle={24}
        switched={{ granularity: "minute" }}
      />
    );
    expect(segmentTexts()).toEqual(["mm", "dd", "yyyy"]);

    await userEvent.click(roleNamed("button", "Switch"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy", "––", "––"]);
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("101220260930");
    await expect.element(committed()).toHaveTextContent("2026-10-12T09:30:00");
  });

  it("emits a PlainDate once an empty date-time field's granularity turns to days", async () => {
    renderThemed(
      <SwitchHarness<Temporal.PlainDate>
        label="Starts"
        hourCycle={24}
        granularity="minute"
        switched={{ granularity: "day" }}
      />
    );
    expect(segmentTexts()).toEqual(["mm", "dd", "yyyy", "––", "––"]);

    await userEvent.click(roleNamed("button", "Switch"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy"]);
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("10122026");
    await expect.poll(() => committed().element().textContent).toBe("2026-10-12");
  });

  it("follows an empty zoned field's timeZone", async () => {
    renderThemed(
      <SwitchHarness<Temporal.ZonedDateTime>
        label="Starts"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        timeZone="Europe/Oslo"
        switched={{ timeZone: "America/New_York" }}
      />
    );
    await userEvent.click(roleNamed("button", "Switch"));
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("101220260930");
    await expect.element(committed()).toHaveTextContent("2026-10-12T09:30:00-04:00[America/New_York]");
  });

  it("takes a time once a typed and cleared date field's granularity turns to minutes", async () => {
    renderThemed(
      <SwitchHarness<Temporal.PlainDateTime>
        label="Starts"
        hourCycle={24}
        switched={{ granularity: "minute" }}
      />
    );
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("10122026");
    await expect.element(committed()).toHaveTextContent("2026-10-12");
    await userEvent.keyboard("{Backspace>12/}");
    await expect.element(committed()).toHaveTextContent("null");

    await userEvent.click(roleNamed("button", "Switch"));
    await expect.poll(segmentTexts).toEqual(["mm", "dd", "yyyy", "––", "––"]);
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("110320261445");
    await expect.element(committed()).toHaveTextContent("2026-11-03T14:45:00");
  });

  it("keeps the zone of a value it was typed into after a clear, when its timeZone then changes", async () => {
    renderThemed(
      <SwitchHarness<Temporal.ZonedDateTime>
        label="Starts"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        timeZone="Europe/Oslo"
        switched={{ timeZone: "America/New_York" }}
      />
    );
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("101220260930");
    await expect.element(committed()).toHaveTextContent("2026-10-12T09:30:00+02:00[Europe/Oslo]");
    await userEvent.keyboard("{Backspace>20/}");
    await expect.element(committed()).toHaveTextContent("null");

    await userEvent.click(roleNamed("button", "Switch"));
    await userEvent.click(spin("month, Starts"));
    await userEvent.keyboard("110320261445");
    await expect.element(committed()).toHaveTextContent("2026-11-03T14:45:00+01:00[Europe/Oslo]");
  });
});

describe("DateInput.Segment input", () => {
  it("keeps intercepting typing on the element a new render puts in its place", async () => {
    renderThemed(<RenderSwapHarness />);
    await userEvent.click(roleNamed("button", "Bold"));
    const month = spin("month, Start date");
    expect(month.tagName).toBe("STRONG");

    await userEvent.click(month);
    await userEvent.keyboard("12052026");
    await expect.element(committed()).toHaveTextContent("2026-12-05");
    expect(segmentTexts()).toEqual(["12", "5", "2026"]);
  });
});

describe("DateInput wiring with undefined props", () => {
  it("keeps the Field's label and description when optional props arrive undefined", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Field.Root name="start">
          <Field.Label>Start date</Field.Label>
          <DateInput.Root
            aria-labelledby={undefined}
            aria-describedby={undefined}
            id={undefined}
            defaultValue={Temporal.PlainDate.from("2026-10-05")}>
            {(segment) => (
              <DateInput.Segment
                key={segment.index}
                segment={segment}
                id={undefined}
                aria-describedby={undefined}
              />
            )}
          </DateInput.Root>
          <Field.Description>Weekdays only</Field.Description>
        </Field.Root>
      )
    );
    expect(roleNamed("group", "Start date")).toHaveAccessibleDescription(/Weekdays only/u);
    const month = spin("month, Start date");
    expect(month).toHaveAccessibleDescription(/Weekdays only/u);
    expect(month.id).not.toBe("");
  });
});

describe("DateField in a same-origin frame", () => {
  it("takes typing and tells focus moving inside from focus leaving, for nodes of the frame's realm", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument;
      // SAFETY: a same-origin frame's window has this window's globals, from its own realm.
      const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
      if (frameDocument === null || frameWindow === null) {
        throw new Error("expected a same-origin frame");
      }
      const reported: string[] = [];
      renderThemed(
        withLocale(
          "en-US",
          createPortal(
            <>
              <DateField
                label="Start date"
                defaultValue={Temporal.PlainDate.from("2026-10-05")}
                onChange={(next) => reported.push(String(next))}
              />
              <button type="button">After</button>
            </>,
            frameDocument.body
          )
        )
      );
      const inFrame = (selector: string): HTMLElement => {
        // The frame's nodes are out of the page locator's reach.
        const element = frameDocument.querySelector<HTMLElement>(selector);
        if (element === null) {
          throw new Error(`expected ${selector} in the frame`);
        }
        return element;
      };
      const segment = (unit: string): HTMLElement => inFrame(`[role=spinbutton][aria-label^="${unit},"]`);
      const type = (target: HTMLElement, inputType: string, data: string | null): void => {
        target.dispatchEvent(
          new frameWindow.InputEvent("beforeinput", { inputType, data, bubbles: true, cancelable: true })
        );
      };
      await expect.poll(() => frameDocument.querySelector("[role=group]")).not.toBeNull();
      // The premise: the frame's nodes are not this window's Elements.
      expect(segment("month") instanceof Element).toBe(false);

      segment("month").focus();
      type(segment("month"), "insertText", "1");
      type(segment("month"), "insertText", "2");
      await expect.poll(() => reported).toEqual(["2026-01-05", "2026-12-05"]);
      expect(segment("month").textContent).toBe("12");
      expect(frameDocument.activeElement).toBe(segment("day"));

      // Clearing the day leaves a half-typed date; moving to the year stays inside the field.
      type(segment("day"), "deleteContentBackward", null);
      await expect.poll(() => segment("day").textContent).toBe("dd");
      segment("year").focus();
      expect(inFrame("[role=group]").hasAttribute("data-invalid")).toBe(false);
      inFrame("button").focus();
      await expect.poll(() => inFrame("[role=group]").getAttribute("data-invalid")).toBe("true");
    } finally {
      frame.remove();
    }
  });
});
