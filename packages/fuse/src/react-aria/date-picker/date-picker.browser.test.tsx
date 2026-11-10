import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import { DatePickerContext } from "react-aria-components";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError } from "../../../test/caught-error";
import {
  calendarGrid,
  cellNamed,
  describedTextsFor,
  segmentLocator,
  segmentNamed,
} from "../../../test/rac-calendar-testing";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { DatePicker, DatePickerPresetGroup, DatePickerPresetItem } from "./date-picker";

function renderPicker(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/**
 * The trigger. RAC's `useDatePicker` owns the name — "Calendar" plus the field label —
 * so the composite never invents copy for it.
 */
function trigger(): HTMLElement {
  const element = page.getByRole("button", { name: /^calendar/i }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the calendar trigger");
  }
  return element;
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group ${name}`);
  }
  return element;
}

function pickerDialog(): HTMLElement {
  const element = page.getByRole("dialog").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the picker dialog");
  }
  return element;
}

/**
 * A preset's pointer target. RAC keeps the `radio` element visually hidden inside the
 * label that carries the visible copy, so the item is *found* by its role and name and
 * *clicked* on the label the user actually sees.
 */
function presetTargetNamed(name: string): HTMLElement {
  const label = page.getByRole("radio", { name, exact: true }).element().closest("label");
  if (!(label instanceof HTMLElement)) {
    throw new Error(`expected the preset label for ${name}`);
  }
  return label;
}

async function openPicker(): Promise<HTMLElement> {
  await userEvent.click(trigger());
  await expect.element(page.getByRole("dialog")).toBeVisible();
  return pickerDialog();
}

const march10 = new CalendarDate(2026, 3, 10);
const july14 = new CalendarDate(2026, 7, 14);

/**
 * A controlled picker whose single preset drives the value from inside the open popover.
 * A preset is the only way to change the value with the popover open, so this is the
 * fixture for the value-change resync rather than the per-open initializer.
 */
function PresetDrivenPicker({
  next,
  presetLabel,
  ...pickerProps
}: {
  next: CalendarDate | null;
  presetLabel: string;
  placeholderValue?: CalendarDate;
}): ReactElement {
  const [value, setValue] = useState<CalendarDate | null>(july14);
  return (
    <DatePicker
      {...pickerProps}
      label="Invoice date"
      onChange={setValue}
      presetGroup={
        <DatePickerPresetGroup onChange={() => setValue(next)}>
          <DatePickerPresetItem value="preset">{presetLabel}</DatePickerPresetItem>
        </DatePickerPresetGroup>
      }
      value={value}
    />
  );
}

// Playwright waits for a target to stop moving before it clicks, so the popover's slide-in
// would cost every in-popover click its full duration. Reduced motion drops the slide and
// keeps the fade; no case here is about motion. Each worker owns its page, and the media is
// restored before the next file runs in it.
beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

describe("DatePicker", () => {
  it("throws the missing-LocaleProvider error when it mounts, before the calendar opens", () => {
    const { host } = renderThemed(
      <CaughtError>
        <DatePicker label="Dates" />
      </CaughtError>
    );
    expect(host.textContent).toBe("useLocale must be used within LocaleProvider");
  });

  it("names the field group from the label, exposes segment spinbuttons and a named collapsed trigger", async () => {
    renderPicker(<DatePicker label="Invoice date" description="Billing date." defaultValue={july14} />);
    const group = groupNamed("Invoice date");

    expect(group.getAttribute("data-slot")).toBe("field-group");
    await expect.element(segmentLocator("month")).toBeVisible();
    await expect.element(segmentLocator("day")).toBeVisible();
    await expect.element(segmentLocator("year")).toBeVisible();
    expect(describedTextsFor(group)).toContain("Billing date.");

    const trigger_ = trigger();
    expect(trigger_).toHaveAttribute("aria-expanded", "false");
    expect(trigger_).toHaveAttribute("aria-haspopup", "dialog");
    expect(page.getByRole("dialog").query()).toBeNull();
    // The glyph is decoration; the button's own name carries the meaning.
    expect(trigger_.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("opens a named dialog holding the calendar grid, commits a day with Enter, and re-evaluates a className callback", async () => {
    const onChange = vi.fn();
    renderPicker(
      <DatePicker
        label="Invoice date"
        value={march10}
        onChange={onChange}
        className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      />
    );
    const root = groupNamed("Invoice date").parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DatePicker root");
    }
    // The caller's class wins over the recipe's `gap-1` column, closed and open.
    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
    expect(px(getComputedStyle(root).rowGap)).toBe(8);
    const dialog = await openPicker();
    expect(px(getComputedStyle(root).rowGap)).toBe(16);

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(dialog.contains(calendarGrid())).toBe(true);
    // The dialog keeps RAC's own name; an unnamed overlay would be an AT dead end.
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(cellNamed(/Tuesday, March 10, 2026/i)).toHaveAttribute("aria-selected", "true");
    // RAC moves focus onto the selected day from an effect after the popover mounts.
    await expect.element(page.getByRole("button", { name: /Tuesday, March 10, 2026/i })).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ year: 2026, month: 3, day: 10 }));
    expect(onChange.mock.calls[0]?.[0]).not.toBeInstanceOf(Event);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("reopens an uncontrolled picker on its committed month: the defaultValue's, then the day the user chose", async () => {
    // The sync reads the picker state's committed value, so `defaultValue` alone — with
    // no `value` prop in sight — still lands the reopen on July.
    renderPicker(<DatePicker label="Invoice date" defaultValue={july14} />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    // Page to September and commit the focused day: the uncontrolled value is now the
    // picker's own, and reopening has to follow it rather than the initial default.
    await userEvent.keyboard("{PageDown}{PageDown}{Enter}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(segmentNamed("month").textContent).toBe("09");

    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);
  });

  it("opens on the current month when there is no value or placeholder", async () => {
    renderPicker(<DatePicker label="Invoice date" />);
    await openPicker();

    expect(calendarGrid().getAttribute("aria-label")).toEqual(
      new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())
    );
  });

  it("returns to the placeholder's month when the value is cleared with the dialog open", async () => {
    renderPicker(
      <PresetDrivenPicker next={null} presetLabel="No date" placeholderValue={new CalendarDate(1990, 1, 1)} />
    );
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    await userEvent.click(presetTargetNamed("No date"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/January\s+1990/i);
  });

  it("follows a value change to its month while the dialog stays open", async () => {
    const november3 = new CalendarDate(2026, 11, 3);
    renderPicker(<PresetDrivenPicker next={november3} presetLabel="Early November" />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    // A preset lives inside the popover, so the value can change while it stays open —
    // which is the case the value effect (rather than the per-open mount) exists for.
    await userEvent.click(presetTargetNamed("Early November"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/November\s+2026/i);
    expect(segmentNamed("month").textContent).toBe("11");
  });

  it("keeps a paged month when the value is replaced by an equal date", async () => {
    // A fresh object for the same day: the committed value has not changed.
    renderPicker(<PresetDrivenPicker next={new CalendarDate(2026, 7, 14)} presetLabel="Same day" />);
    await openPicker();
    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);

    await userEvent.click(presetTargetNamed("Same day"));
    expect(page.getByRole("radio", { name: "Same day", exact: true }).element()).toBeChecked();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);
  });

  it("opens on a placeholder supplied through DatePickerContext", async () => {
    renderPicker(
      <DatePickerContext.Provider value={{ placeholderValue: new CalendarDate(1990, 1, 1) }}>
        <DatePicker label="Birth date" />
      </DatePickerContext.Provider>
    );
    await openPicker();

    expect(calendarGrid().getAttribute("aria-label")).toMatch(/January\s+1990/i);
  });
});

describe("DatePicker presets", () => {
  it("exposes a radiogroup named by visible copy, closing on double-click only where the caller opted in", async () => {
    const onDoubleClick = vi.fn();
    renderPicker(
      <DatePicker
        label="Invoice date"
        value={march10}
        presetGroup={
          <DatePickerPresetGroup>
            <DatePickerPresetItem value="today" onDoubleClick={onDoubleClick}>
              Today
            </DatePickerPresetItem>
            <DatePickerPresetItem value="in-a-week" isCloseDialogOnDoubleClick onDoubleClick={onDoubleClick}>
              In a week
            </DatePickerPresetItem>
          </DatePickerPresetGroup>
        }
      />
    );
    await openPicker();
    const radiogroup = roleNamed("radiogroup", "Date presets");

    expect(radiogroup.getAttribute("data-slot")).toBe("date-picker-preset-group");
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "In a week", exact: true })).toBeVisible();
    // The name is the visible copy — never English synthesised from `value`.
    expect(page.getByRole("radio", { name: /preset option/i }).query()).toBeNull();
    expect(presetTargetNamed("Today").getAttribute("data-slot")).toBe("date-picker-preset-item");
    expect(pickerDialog().contains(radiogroup)).toBe(true);
    expect(pickerDialog().contains(calendarGrid())).toBe(true);

    // DateRangePicker's suite pins the handler-then-close order; this one proves the item
    // closes DatePicker's own state.
    await userEvent.dblClick(presetTargetNamed("Today"));
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await userEvent.dblClick(presetTargetNamed("In a week"));
    expect(onDoubleClick).toHaveBeenCalledTimes(2);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
