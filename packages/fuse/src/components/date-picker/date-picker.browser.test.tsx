/*
 * DatePicker and DatePickerField in the browser: opening and closing, focus moving into the
 * calendar and back, Alt+ArrowDown, presets, time values, forms, cancelable details and the
 * computed faces of the trigger, the group and a checked preset. The consumer contract both tiers
 * share (names, typing, popup naming, preset radios) follows React Aria's; these cases cover what
 * only this tier has.
 * Expectations are literals: ISO values, accessible names, reasons.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { waitForPopupSettled } from "../../../test/popup-settled";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import type { DateInputValue } from "../date-field/date-input";
import { Field } from "../field";
import { Form } from "../form/form";
import type { DatePickerRootProps } from "./date-picker";
import { DatePicker, DatePickerField } from "./index";

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
    // DOM audit: server HTML in a detached host has no accessibility tree to locate by role.
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
