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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { Field } from "../field";
import { Form } from "../form/form";
import { DateField } from "./date-field";
import type { DateInputRootProps, DateInputValue } from "./date-input";
import type { DateInputValueChangeReason } from "./date-input-change-details";
import { DateInput } from "./index";

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
  // DOM audit: segments are not one role (spinbutton, textbox, hidden literal), and their slot and
  // `data-type` are the part's public contract.
  return [...document.querySelectorAll('[data-slot="date-input-segment"]:not([data-type="literal"])')].map(
    (element) => element.textContent
  );
}

function spin(name: string): HTMLElement {
  return roleNamed("spinbutton", name);
}

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

describe("date props past the types", () => {
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
