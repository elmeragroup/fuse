/*
 * DatePicker and DatePickerField in the browser: opening and closing, focus moving into the
 * calendar and back, Alt+ArrowDown, presets, time values, forms, cancelable details and the
 * computed faces of the trigger, the group and a checked preset. The consumer contract both tiers
 * share (names, typing, popup naming, preset radios) is pinned by the parity harness
 * (`src/internal/date-tier-parity.browser.test.tsx`); these cases cover what only this tier has.
 * Expectations are literals: ISO values, accessible names, reasons.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
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
import { definedProps } from "../../internal/defined-props";
import "../../temporal-polyfill";
import type { DateInputValue } from "../date-field/date-input";
import { Field } from "../field";
import { Form } from "../form/form";
import type { DatePickerRootProps } from "./date-picker";
import type { DatePickerFieldProps } from "./date-picker-field";
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

/** A preset's label, its hit area: the radio inside it is visually hidden. */
function presetLabel(name: string): HTMLLabelElement {
  const label = roleNamed("radio", name).closest("label");
  if (label === null) throw new Error(`expected the label of preset ${name}`);
  return label;
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

function mountField<T extends Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime>(
  props: DatePickerFieldProps<T>
): void {
  renderThemed(withLocale("en-US", <DatePickerField {...props} />));
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

  it("opens with Alt+ArrowDown from a segment without stepping it", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, Start date"));
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
      .toHaveFocus();
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);
    await expect.element(log()).toHaveTextContent("open:true:keyboard");
  });

  it("commits a pressed day and closes with the day's reason", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:day-press:2026-10-12 | open:false:day-press");
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

  it("keeps the popup open after a day when shouldCloseOnSelect is off", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          shouldCloseOnSelect={false}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(segmentTexts()).toEqual(["10", "12", "2026"]);
  });

  it("disables the trigger of a read-only picker", () => {
    mountField({
      label: "Start date",
      defaultValue: Temporal.PlainDate.from("2026-10-05"),
      isReadOnly: true,
    });
    expect(roleNamed("button", "Calendar Start date")).toBeDisabled();
  });

  it("disables a trigger given disabled of its own", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DatePicker.Root aria-label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")}>
          <DatePicker.Group>
            <DatePicker.Input />
            <DatePicker.Trigger disabled />
          </DatePicker.Group>
        </DatePicker.Root>
      )
    );
    expect(roleNamed("button", "Calendar Start date")).toBeDisabled();
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

    const show = roleNamed("button", "Show calendar");
    await userEvent.click(show);
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(year);
  });

  it("reports focus leaving only when it leaves both the group and the popup", async () => {
    let blurs = 0;
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DatePickerField
            label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            onBlur={() => (blurs += 1)}
          />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "month, Start date"));
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await expect
      .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(blurs).toBe(0);

    await userEvent.click(roleNamed("button", "After"));
    expect(blurs).toBe(1);
  });
});

describe("DatePicker cancelable details", () => {
  it("keeps the value and the popup open when a day press is canceled", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          cancelValue={["day-press"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    await expect.element(log()).toHaveTextContent("open:true:trigger-press | value:day-press:2026-10-12");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);
  });

  it("shows the value again in the segments when an edit is canceled", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          cancelValue={["input-change"]}
        />
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, Start date"));
    await userEvent.keyboard("{ArrowUp}");

    await expect.element(log()).toHaveTextContent("value:input-change:2026-10-06");
    expect(segmentTexts()).toEqual(["10", "5", "2026"]);
  });

  it("stays closed when the trigger press is canceled", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          cancelOpen={["trigger-press"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));

    await expect.element(log()).toHaveTextContent("open:true:trigger-press");
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("stays open when the day's close is canceled, with the day committed", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Start date"
          defaultValue={Temporal.PlainDate.from("2026-10-05")}
          cancelOpen={["day-press"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    await expect
      .element(log())
      .toHaveTextContent("open:true:trigger-press | value:day-press:2026-10-12 | open:false:day-press");
    await expect.element(page.getByRole("dialog")).toBeVisible();
  });
});

describe("DatePicker with time", () => {
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

  it("holds a day picked in an empty time picker until the popup closes, then commits midnight", async () => {
    // An empty picker opens on today's month; the calendar reads today from Date.now().
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
    try {
      renderThemed(
        withLocale(
          "en-US",
          <LoggedPicker
            aria-label="Starts"
            granularity="minute"
            shouldCloseOnSelect={false}
            timeZone="Europe/Oslo"
          />
        )
      );
      await userEvent.click(roleNamed("button", "Calendar Starts"));
      await waitForPopupSettled();
      await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
      await expect
        .element(page.getByRole("button", { name: "Monday, October 12, 2026 selected", exact: true }))
        .toBeVisible();
      expect(log().element().textContent).toBe("open:true:trigger-press");

      await userEvent.keyboard("{Escape}");
      await expect
        .element(log())
        .toHaveTextContent(
          "open:true:trigger-press | value:day-press:2026-10-12T00:00:00+02:00[Europe/Oslo] | open:false:escape-key"
        );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DatePicker presets", () => {
  function Presets({ onClose }: { readonly onClose: (reason: string) => void }): ReactElement {
    const [preset, setPreset] = useState<string | null>(null);
    const [value, setValue] = useState<Temporal.PlainDate | null>(Temporal.PlainDate.from("2026-10-05"));
    return (
      <DatePicker.Root
        aria-label="Start date"
        value={value}
        onValueChange={setValue}
        defaultOpen
        onOpenChange={(open, details) => {
          if (!open) onClose(details.reason);
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

  it("moves the calendar to a preset's month and closes on a preset's double-click", async () => {
    const closes: string[] = [];
    renderThemed(withLocale("en-US", <Presets onClose={(reason) => closes.push(reason)} />));
    await waitForPopupSettled();
    const christmas = presetLabel("Christmas Eve");
    expect(roleNamed("radio", "Halloween")).toBeDisabled();

    await userEvent.click(christmas);
    await expect.element(page.getByRole("radio", { name: "Christmas Eve", exact: true })).toBeChecked();
    await expect.element(page.getByRole("grid", { name: "December 2026", exact: true })).toBeVisible();
    expect(segmentTexts()).toEqual(["12", "24", "2026"]);
    expect(closes).toEqual([]);

    await userEvent.dblClick(christmas);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(closes).toEqual(["preset-press"]);
  });

  it("reports a pressed preset with its reason and radio, and keeps the checked preset when canceled", async () => {
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
                reports.push(
                  `${value}:${details.reason}:${details.trigger?.getAttribute("value") ?? "none"}`
                );
                if (value === "tomorrow") details.cancel();
              }}>
              <DatePicker.PresetItem value="today">Today</DatePicker.PresetItem>
              <DatePicker.PresetItem value="tomorrow">Tomorrow</DatePicker.PresetItem>
              <DatePicker.PresetItem value="next-week">Next week</DatePicker.PresetItem>
            </DatePicker.Presets>
            <DatePicker.Calendar />
          </DatePicker.Popup>
        </DatePicker.Root>
      )
    );
    await waitForPopupSettled();
    await userEvent.click(presetLabel("Tomorrow"));
    expect(reports).toEqual(["tomorrow:preset-press:tomorrow"]);
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeChecked();
    expect(roleNamed("radio", "Tomorrow")).not.toBeChecked();

    await userEvent.click(presetLabel("Next week"));
    expect(reports).toEqual(["tomorrow:preset-press:tomorrow", "next-week:preset-press:next-week"]);
    await expect.element(page.getByRole("radio", { name: "Next week", exact: true })).toBeChecked();
  });

  it("fills a checked preset and leaves the others clear", async () => {
    renderThemed(withLocale("en-US", <Presets onClose={() => undefined} />));
    await waitForPopupSettled();
    await userEvent.click(presetLabel("Christmas Eve"));
    const checked = presetLabel("Christmas Eve");
    const disabled = presetLabel("Halloween");

    await expect.poll(() => getComputedStyle(checked).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(checked).toHaveAttribute("data-checked");
    expect(getComputedStyle(disabled).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(disabled).opacity).toBe("0.5");
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

describe("DatePicker multi-month", () => {
  it("forwards visibleMonths to the calendar", async () => {
    mountField({
      label: "Start date",
      defaultValue: Temporal.PlainDate.from("2026-10-05"),
      visibleMonths: 2,
      defaultOpen: true,
    });
    await expect.element(page.getByRole("grid", { name: "October 2026", exact: true })).toBeVisible();
    await expect.element(page.getByRole("grid", { name: "November 2026", exact: true })).toBeVisible();
  });
});

describe("DatePicker styles", () => {
  it("paints the invalid group and the disabled trigger differently from the plain ones", () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DatePickerField label="Plain" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <DatePickerField label="Invalid" defaultValue={Temporal.PlainDate.from("2026-10-05")} isInvalid />
          <DatePickerField label="Disabled" defaultValue={Temporal.PlainDate.from("2026-10-05")} isDisabled />
        </>
      )
    );
    const plain = roleNamed("group", "Plain");
    const invalid = roleNamed("group", "Invalid");
    expect(invalid).toHaveAttribute("data-invalid", "true");
    expect(getComputedStyle(invalid).borderTopColor).not.toBe(getComputedStyle(plain).borderTopColor);

    const enabledTrigger = roleNamed("button", "Calendar Plain");
    const disabledTrigger = roleNamed("button", "Calendar Disabled");
    expect(getComputedStyle(disabledTrigger).opacity).not.toBe(getComputedStyle(enabledTrigger).opacity);
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

  it("keeps focus on the committed day when the parent cancels the close that commits it", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <LoggedPicker
          aria-label="Starts"
          granularity="minute"
          shouldCloseOnSelect={false}
          timeZone="Europe/Oslo"
          cancelOpen={["escape-key"]}
        />
      )
    );
    await userEvent.click(roleNamed("button", "Calendar Starts"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.keyboard("{Escape}");

    await expect
      .element(log())
      .toHaveTextContent(
        "open:true:trigger-press | value:day-press:2026-10-12T00:00:00+02:00[Europe/Oslo] | open:false:escape-key"
      );
    await expect.element(page.getByRole("dialog")).toBeVisible();
    // The calendar made the value, so it stays mounted with focus on the day.
    await expect
      .element(page.getByRole("button", { name: "Monday, October 12, 2026 selected", exact: true }))
      .toHaveFocus();
  });

  it("commits the held day when the parent closes the popup itself", async () => {
    const values: string[] = [];
    function Controlled({ open }: { readonly open: boolean }): ReactElement {
      return withLocale(
        "en-US",
        <DatePickerField
          aria-label="Starts"
          granularity="minute"
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          isOpen={open}
          onChange={(value) => values.push(String(value))}
        />
      );
    }
    const { rerender } = renderThemed(<Controlled open />);
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    expect(values).toEqual([]);

    rerender(<Controlled open={false} />);
    await expect.poll(() => values).toEqual(["2026-10-12T00:00:00+02:00[Europe/Oslo]"]);
  });

  it("checks the held day a parent's close commits against the minValue of that same render", async () => {
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
        <DatePicker.Root
          aria-label="Starts"
          granularity="minute"
          timeZone="Europe/Oslo"
          shouldCloseOnSelect={false}
          open={open}
          minValue={min}
          onValueChange={(value, details) =>
            calls.push(`${String(value)}:${details.getValidationError() ?? "valid"}`)
          }>
          <DatePicker.Group>
            <DatePicker.Input />
            <DatePicker.Trigger />
          </DatePicker.Group>
          <DatePicker.Popup>
            <DatePicker.Calendar />
          </DatePicker.Popup>
        </DatePicker.Root>
      );
    }
    const { rerender } = renderThemed(<Controlled open min={Temporal.PlainDate.from("2026-10-01")} />);
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    rerender(<Controlled open={false} min={Temporal.PlainDate.from("2026-10-14")} />);
    await expect.poll(() => calls).toEqual(["2026-10-12T00:00:00+02:00[Europe/Oslo]:rangeUnderflow"]);
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

  it("keeps a cleared zoned picker's time segments and zone across a form reset", async () => {
    const values: string[] = [];
    function Zoned(): ReactElement {
      const [value, setValue] = useState<Temporal.ZonedDateTime | null>(
        Temporal.ZonedDateTime.from("2026-10-12T14:30[Europe/Oslo]")
      );
      return withLocale(
        "en-US",
        <form aria-label="Booking">
          <DatePickerField
            label="Starts"
            granularity="minute"
            hourCycle={24}
            hideTimeZone
            value={value}
            onChange={(next) => {
              values.push(String(next));
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
    await expect.poll(() => page.getByRole("spinbutton").elements().length).toBe(5);

    await userEvent.click(roleNamed("spinbutton", "month, Starts"));
    await userEvent.keyboard("102620261800");
    await expect.poll(() => values.at(-1)).toBe("2026-10-26T18:00:00+01:00[Europe/Oslo]");
  });

  it.each([
    ["day", "Europe/Oslo", "2026-10-26T00:00:00+01:00[Europe/Oslo]", ""],
    ["minute", "Europe/Oslo", "2026-10-26T18:00:00+01:00[Europe/Oslo]", "1800"],
  ] as const)(
    "keeps a cleared zoned picker's kind and zone across a form reset at %s granularity",
    async (granularity, zone, expected, time) => {
      const values: string[] = [];
      function Zoned(): ReactElement {
        const [value, setValue] = useState<Temporal.ZonedDateTime | null>(
          Temporal.ZonedDateTime.from(`2026-10-12T14:30[${zone}]`)
        );
        return withLocale(
          "en-US",
          <form aria-label="Booking">
            <DatePickerField
              label="Starts"
              granularity={granularity}
              hourCycle={24}
              hideTimeZone
              value={value}
              onChange={(next) => {
                values.push(String(next));
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
      await userEvent.click(roleNamed("spinbutton", "month, Starts"));
      await userEvent.keyboard(`10262026${time}`);
      await expect.poll(() => values.at(-1)).toBe(expected);
    }
  );
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

  it.each([
    ["a segment inside the shadow root", false, 0],
    ["a button outside the shadow host", true, 1],
  ] as const)(
    "reads focus landing on %s after a focus guard unmounts, for a picker in a shadow root",
    async (_landing, outside, expectedLeaves) => {
      const host = document.createElement("div");
      document.body.append(host);
      // Stands in for a Base UI guard that unmounts with the popup before it blurs.
      const guard = document.createElement("span");
      const after = document.createElement("button");
      after.textContent = "After";
      guard.tabIndex = 0;
      guard.setAttribute("data-base-ui-focus-guard", "");
      try {
        const shadow = host.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        shadow.append(container);
        let leaves = 0;
        renderThemed(
          withLocale(
            "en-US",
            createPortal(
              <DatePickerField
                label="Start date"
                defaultValue={Temporal.PlainDate.from("2026-10-05")}
                onBlur={() => (leaves += 1)}
              />,
              container
            )
          )
        );
        await userEvent.click(page.getByRole("button", { name: "Calendar Start date" }));
        await expect
          .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
          .toHaveFocus();
        document.body.append(guard);
        guard.focus();
        guard.remove();

        document.body.append(after);
        const landing = outside
          ? after
          : page.getByRole("spinbutton", { name: "month, Start date" }).element();
        if (!(landing instanceof HTMLElement)) throw new Error("expected a focusable landing");
        landing.focus();
        expect(leaves).toBe(expectedLeaves);
      } finally {
        guard.remove();
        after.remove();
        host.remove();
      }
    }
  );

  it("validates a half-typed input only once focus leaves both the input and the popup", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DatePickerField label="Start date" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, Start date"));
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(segmentTexts()).toEqual(["10", "dd", "2026"]);

    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
      .toHaveFocus();
    expect(page.getByText(/The field is incomplete/u).query()).toBeNull();
    expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(page.getByText(/The field is incomplete/u).query()).toBeNull();

    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByText(/The field is incomplete/u)).toBeVisible();
    await expect
      .element(page.getByRole("group", { name: "Start date", exact: true }))
      .toHaveAttribute("data-invalid", "true");
  });

  it("tells focus moving between segments from focus leaving, for nodes of a frame's realm", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument;
      if (frameDocument === null) {
        throw new Error("expected a same-origin frame");
      }
      let leaves = 0;
      renderThemed(
        withLocale(
          "en-US",
          createPortal(
            <>
              <DatePickerField
                label="Start date"
                defaultValue={Temporal.PlainDate.from("2026-10-05")}
                onBlur={() => (leaves += 1)}
              />
              <button type="button">After</button>
            </>,
            frameDocument.body
          )
        )
      );
      const inFrame = (selector: string): HTMLElement => {
        // DOM audit: the frame's nodes are out of the page locator's reach.
        const element = frameDocument.querySelector<HTMLElement>(selector);
        if (element === null) {
          throw new Error(`expected ${selector} in the frame`);
        }
        return element;
      };
      const segment = (unit: string): HTMLElement => inFrame(`[role=spinbutton][aria-label^="${unit},"]`);
      await expect.poll(() => frameDocument.querySelector("[role=group]")).not.toBeNull();
      // The premise: the frame's nodes are not this window's Elements.
      expect(segment("month") instanceof Element).toBe(false);

      segment("month").focus();
      segment("day").focus();
      segment("year").focus();
      inFrame('[data-slot="date-picker-trigger"]').focus();
      expect(leaves).toBe(0);

      inFrame("button:not([data-slot])").focus();
      expect(leaves).toBe(1);
    } finally {
      frame.remove();
    }
  });

  it("reports one focus leave for a segment to outside, and one for the popup to outside", async () => {
    let leaves = 0;
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DatePickerField
            label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            onBlur={() => (leaves += 1)}
          />
          <button type="button">After</button>
        </>
      )
    );
    await userEvent.click(roleNamed("spinbutton", "day, Start date"));
    await userEvent.click(roleNamed("button", "After"));
    expect(leaves).toBe(1);

    await userEvent.click(roleNamed("spinbutton", "day, Start date"));
    await userEvent.click(roleNamed("button", "Calendar Start date"));
    await expect
      .element(page.getByRole("button", { name: "Monday, October 5, 2026 selected", exact: true }))
      .toHaveFocus();
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(leaves).toBe(2);
  });
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

  it("disables the open calendar and presets when an enclosing Field.Set becomes disabled", async () => {
    const values: string[] = [];
    function Fenced({ disabled }: { readonly disabled: boolean }): ReactElement {
      return withLocale(
        "en-US",
        <Field.Set disabled={disabled}>
          <DatePicker.Root
            aria-label="Start date"
            defaultValue={Temporal.PlainDate.from("2026-10-05")}
            defaultOpen
            onValueChange={(value) => values.push(String(value))}>
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
        </Field.Set>
      );
    }
    const { rerender } = renderThemed(<Fenced disabled={false} />);
    await waitForPopupSettled();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(roleNamed("radio", "Today")).not.toBeDisabled();

    rerender(<Fenced disabled />);
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeDisabled();
    expect(roleNamed("button", "Monday, October 12, 2026")).toHaveAttribute("data-disabled");
    expect(roleNamed("button", "Calendar Start date")).toBeDisabled();
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"), { force: true });
    expect(values).toEqual([]);
  });
});

describe("DatePicker kind of an empty picker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A controlled minute picker whose zone and value the buttons below it change. */
  function Moving({ onValue }: { readonly onValue: (value: string) => void }): ReactElement {
    const [value, setValue] = useState<Temporal.ZonedDateTime | null>(null);
    const [zone, setZone] = useState("Europe/Oslo");
    return withLocale(
      "en-US",
      <>
        <DatePickerField
          label="Starts"
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          timeZone={zone}
          value={value}
          onChange={(next) => {
            onValue(String(next));
            setValue(next);
          }}
        />
        <button type="button" onClick={() => setValue(null)}>
          Clear
        </button>
        <button type="button" onClick={() => setZone("America/New_York")}>
          New York
        </button>
      </>
    );
  }

  async function pickOctober20(): Promise<void> {
    await userEvent.click(roleNamed("button", "Calendar Starts"));
    await waitForPopupSettled();
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
  }

  it("types a value of the zone and granularity an empty picker names", async () => {
    const values: string[] = [];
    renderThemed(<Moving onValue={(value) => values.push(value)} />);
    await userEvent.click(roleNamed("spinbutton", "month, Starts"));
    await userEvent.keyboard("102620261800");
    await expect.poll(() => values.at(-1)).toBe("2026-10-26T18:00:00+01:00[Europe/Oslo]");
  });

  it("follows a zone change while it has held no value", async () => {
    const values: string[] = [];
    renderThemed(<Moving onValue={(value) => values.push(value)} />);
    await userEvent.click(roleNamed("button", "New York"));
    await pickOctober20();
    await expect.poll(() => values).toEqual(["2026-10-20T00:00:00-04:00[America/New_York]"]);
  });

  it("types a value in the new zone once an empty picker's timeZone changes", async () => {
    const values: string[] = [];
    renderThemed(<Moving onValue={(value) => values.push(value)} />);
    await userEvent.click(roleNamed("button", "New York"));
    await userEvent.click(roleNamed("spinbutton", "month, Starts"));
    await userEvent.keyboard("102620261800");
    await expect.poll(() => values.at(-1)).toBe("2026-10-26T18:00:00-04:00[America/New_York]");
  });

  it("types the zoned kind the calendar picks once an empty picker's granularity gains a timeZone", async () => {
    const values: string[] = [];
    function Zoning(): ReactElement {
      const [zone, setZone] = useState<string | undefined>(undefined);
      return withLocale(
        "en-US",
        <>
          <DatePickerField
            label="Starts"
            granularity="minute"
            hourCycle={24}
            hideTimeZone
            {...definedProps({ timeZone: zone })}
            onChange={(next) => values.push(String(next))}
          />
          <button type="button" onClick={() => setZone("Europe/Oslo")}>
            In Oslo
          </button>
        </>
      );
    }
    renderThemed(<Zoning />);
    await userEvent.click(roleNamed("button", "In Oslo"));
    await userEvent.click(roleNamed("spinbutton", "month, Starts"));
    await userEvent.keyboard("102620261800");
    await expect.poll(() => values.at(-1)).toBe("2026-10-26T18:00:00+01:00[Europe/Oslo]");
  });

  it("follows a granularity change while it has held no value", async () => {
    const values: string[] = [];
    function Days(): ReactElement {
      const [granularity, setGranularity] = useState<"day" | "minute">("day");
      return withLocale(
        "en-US",
        <>
          <DatePickerField
            label="Starts"
            granularity={granularity}
            onChange={(next) => values.push(String(next))}
          />
          <button type="button" onClick={() => setGranularity("minute")}>
            With time
          </button>
        </>
      );
    }
    renderThemed(<Days />);
    await userEvent.click(roleNamed("button", "With time"));
    await pickOctober20();
    await expect.poll(() => values).toEqual(["2026-10-20T00:00:00"]);
  });

  it("keeps the zone a typed value named after it is cleared, though timeZone then changes", async () => {
    const values: string[] = [];
    renderThemed(<Moving onValue={(value) => values.push(value)} />);
    await userEvent.click(roleNamed("spinbutton", "month, Starts"));
    await userEvent.keyboard("102620261800");
    await expect.poll(() => values.at(-1)).toBe("2026-10-26T18:00:00+01:00[Europe/Oslo]");
    await userEvent.click(roleNamed("button", "Clear"));
    await userEvent.click(roleNamed("button", "New York"));

    await pickOctober20();
    await expect.poll(() => values.at(-1)).toBe("2026-10-20T00:00:00+02:00[Europe/Oslo]");
  });
});

describe("DatePicker context", () => {
  it("re-renders no part when its parent re-renders it with new objects for the same time value and bound", async () => {
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
        <DatePicker.Group>
          <DatePicker.Input />
          <DatePicker.Trigger />
        </DatePicker.Group>
        <DatePicker.Popup>
          <DatePicker.Calendar />
        </DatePicker.Popup>
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
          <DatePicker.Root
            aria-label="Starts"
            defaultOpen
            isDateUnavailable={unavailable}
            granularity="minute"
            value={Temporal.PlainDateTime.from("2026-10-12T08:00")}
            minValue={Temporal.PlainDate.from("2026-10-01")}>
            {parts}
          </DatePicker.Root>
          <output>Tick {ticks}</output>
        </>
      );
    }
    renderThemed(withLocale("en-US", <Parent />));
    await waitForPopupSettled();
    await expect.element(page.getByRole("spinbutton", { name: "hour, Starts" })).toBeVisible();
    const settled = checks;

    ticker.tick();
    await expect.element(page.getByRole("status")).toHaveTextContent("Tick 1");
    expect(settled).toBeGreaterThan(0);
    expect(checks).toBe(settled);
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'DatePicker.Root minValue: received the string "2026-10-01"',
      <DatePickerField
        label="Start date"
        // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
        minValue="2026-10-01"
      />
    );
  });
});
