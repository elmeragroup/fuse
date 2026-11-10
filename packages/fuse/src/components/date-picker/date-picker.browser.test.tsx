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
import { expectRenderTypeError } from "../../../test/caught-error";
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
