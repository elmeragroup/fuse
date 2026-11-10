/*
 * DateRangePicker and DateRangePickerField in the browser: the two Fields under `startName` and
 * `endName` with the label, description and merged error wired to both, a half-filled range held,
 * an end before its start, `Form` errors by name, the range calendar in the popup (cancel, presets
 * dropping a half range, multi-month) and the cancelable details. The shared consumer contract
 * (segment names, the calendar range commit, Escape twice) is pinned by the parity harness.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { definedProps } from "../../internal/defined-props";
import "../../temporal-polyfill";
import type { DateInputValue } from "../date-field/date-input";
import { Field } from "../field";
import { Form } from "../form/form";
import { Show } from "../show/show";
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
});
