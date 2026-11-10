import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate, isSameDay } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { DateRangePickerContext } from "react-aria-components";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  calendarGrid,
  calendarRoot,
  cellNumbered,
  dayNumbered,
  describedTextsFor,
  navButtonNamed,
  segmentLocator,
  segmentNamed,
} from "../../../test/rac-calendar-testing";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { cssVarColor, px, renderThemed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { DateRangePicker, DateRangePickerPresetGroup, DateRangePickerPresetItem } from "./date-range-picker";

function renderPicker(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/**
 * The trigger. RAC's `useDateRangePicker` owns the name — "Calendar" plus the field
 * label — so the composite never invents copy for it.
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

/**
 * The two `role="presentation"` segment rows inside the field box, in reading order.
 * RAC prefixes every segment's own name with the row it belongs to — "month, Start Date"
 * / "month, End Date" — which is how the two rows stay tellable apart in the
 * accessibility tree. The rows' own wrappers are deliberately `role="presentation"`: RAC
 * drops them from the tree because the picker's single group and these segment names
 * already carry everything, and announcing them again would double up.
 */
function segmentRows(label: string): HTMLElement[] {
  return [...groupNamed(label).querySelectorAll('[role="presentation"]')].filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );
}

/** The `aria-hidden` en-dash between the rows. */
function separator(label: string): HTMLElement {
  // Scoped to a direct child: the segment rows carry `aria-hidden` literals of their
  // own (the "/" between month and day), and those belong to DateField, not the range separator.
  const element = groupNamed(label).querySelector(':scope > [aria-hidden="true"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the en-dash separator");
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

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

async function openPicker(): Promise<HTMLElement> {
  await userEvent.click(trigger());
  await expect.element(page.getByRole("dialog")).toBeVisible();
  return pickerDialog();
}

/** One `name`/value pair a form submit carried, read back off its FormData. */
type SubmittedEntry = [string, FormDataEntryValue | null];

/** The shape RAC hands `onChange` — a RangeValue of the picker's own date type. */
type CommittedRange = { start: DateValue; end: DateValue };
type RangeChangeSpy = Mock<(value: CommittedRange | null) => void>;

function rangeChangeSpy(): RangeChangeSpy {
  return vi.fn<(value: CommittedRange | null) => void>();
}

/** The range a spy was called with, first call, asserted to exist. */
function committedRange(onChange: RangeChangeSpy): CommittedRange {
  const committed = onChange.mock.calls[0]?.[0];
  if (committed === undefined || committed === null) {
    throw new Error("expected onChange to have received a range");
  }
  return committed;
}

const july4 = new CalendarDate(2026, 7, 4);
const july14 = new CalendarDate(2026, 7, 14);
const july17 = new CalendarDate(2026, 7, 17);
const july20 = new CalendarDate(2026, 7, 20);
const july24 = new CalendarDate(2026, 7, 24);
const julyWeek = { start: july14, end: july17 };

// Playwright waits for a target to stop moving before it clicks, so the popover's slide-in
// would cost every in-popover click its full duration. Reduced motion drops the slide and
// keeps the fade; no case here is about motion. Each worker owns its page, and the media is
// restored before the next file runs in it.
beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

describe("DateRangePicker", () => {
  it("names the field group from the label, exposes both rows' spinbuttons and a named collapsed trigger", async () => {
    renderPicker(
      <DateRangePicker label="Delivery window" description="When we may deliver." defaultValue={julyWeek} />
    );
    const group = groupNamed("Delivery window");

    expect(group.getAttribute("data-slot")).toBe("field-group");
    for (const row of ["Start Date", "End Date"] as const) {
      for (const part of ["month", "day", "year"] as const) {
        await expect.element(segmentLocator(`${part}, ${row}`)).toBeVisible();
      }
    }
    expect(describedTextsFor(group)).toContain("When we may deliver.");

    // Both rows live in the one field box, split by the decorative en dash.
    const rows = segmentRows("Delivery window");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.contains(segmentNamed("month, Start Date"))).toBe(true);
    expect(rows[1]?.contains(segmentNamed("month, End Date"))).toBe(true);
    expect(separator("Delivery window").textContent.trim()).toBe("–");

    const trigger_ = trigger();
    expect(trigger_).toHaveAttribute("aria-expanded", "false");
    expect(trigger_).toHaveAttribute("aria-haspopup", "dialog");
    expect(page.getByRole("dialog").query()).toBeNull();
    // The glyph is decoration; the button's own name carries the meaning. The recipe sizes
    // it, not the Button's fallback.
    const glyph = trigger_.querySelector("svg");
    if (!(glyph instanceof SVGElement)) {
      throw new Error("expected the trigger glyph");
    }
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(px(getComputedStyle(glyph).width)).toBe(16);
    expect(px(getComputedStyle(glyph).height)).toBe(16);
  });

  it("opens a named, chromeless dialog holding the range grid and commits two clicked endpoints", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} onChange={onChange} />);
    const dialog = await openPicker();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(dialog.contains(calendarGrid())).toBe(true);
    // The dialog keeps RAC's own name; an unnamed overlay would be an AT dead end.
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);
    expect(cellNumbered(14)).toHaveAttribute("aria-selected", "true");
    expect(cellNumbered(17)).toHaveAttribute("aria-selected", "true");

    // The styled dialog chrome, without its close button or header row: an empty heading
    // would take the dialog's accessible name from RAC (react-aria/internal/dialog.tsx).
    expect(dialog.getAttribute("data-slot")).toBe("dialog");
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(getComputedStyle(dialog).paddingTop).toBe("0px");
    expect(getComputedStyle(dialog).paddingLeft).toBe("0px");
    // RangeCalendar's root is bare by design, so the inset is the recipe's own: the small
    // surface tier, 4px.
    expect(getComputedStyle(calendarRoot()).paddingTop).toBe("4px");
    expect(getComputedStyle(calendarRoot()).borderTopWidth).toBe("0px");

    // Anchor, then commit: only the second click makes a range.
    await userEvent.click(dayNumbered(20));
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await userEvent.click(dayNumbered(24));
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july20)).toBe(true);
    expect(isSameDay(committed.end, july24)).toBe(true);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(segmentNamed("day, Start Date").textContent).toBe("20");
    expect(segmentNamed("day, End Date").textContent).toBe("24");
  });

  it("keeps a read-only picker inert: muted field, disabled trigger, no popover", async () => {
    renderPicker(<DateRangePicker label="Delivery window" isReadOnly defaultValue={julyWeek} />);
    const group = groupNamed("Delivery window");
    const glyph = group.querySelector("svg");
    if (!(glyph instanceof SVGElement)) {
      throw new Error("expected the trigger glyph");
    }

    // The FieldGroup's own `isReadOnly` axis paints the fill, exactly once. The glyph is
    // deliberately untinted: `bg-muted` on the `<svg>` never belonged there and went with
    // the picker recipe's duplicate arm.
    expect(getComputedStyle(group).backgroundColor).toBe(cssVarColor(group, "--muted"));
    expect(group.getAttribute("data-readonly")).toBe("true");
    expect(getComputedStyle(glyph).backgroundColor).not.toBe(cssVarColor(group, "--muted"));
    expect(trigger()).toBeDisabled();

    await userEvent.click(trigger(), { force: true });
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("submits both endpoints as ISO strings under startName and endName", async () => {
    const onSubmit = vi.fn<(entries: SubmittedEntry[]) => void>();
    renderPicker(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmit([...data.keys()].map((key) => [key, data.get(key)]));
        }}>
        <DateRangePicker
          label="Delivery window"
          defaultValue={julyWeek}
          startName="deliverFrom"
          endName="deliverTo"
        />
        <button type="submit">Save</button>
      </form>
    );
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();

    await userEvent.click(buttonNamed("Save"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Exactly two fields, both ISO — the hidden inputs RAC keeps for the two rows.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      ["deliverFrom", "2026-07-14"],
      ["deliverTo", "2026-07-17"],
    ]);
  });
});

describe("DateRangePicker composition surface", () => {
  it("floors the field box width and lets only the end row absorb the slack", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    const group = groupNamed("Delivery window");
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();
    const [startRow, endRow] = segmentRows("Delivery window");
    if (startRow === undefined || endRow === undefined) {
      throw new Error("expected both segment rows");
    }

    expect(px(getComputedStyle(group).width)).toBeGreaterThanOrEqual(208);
    // Only the wide template's end column grows, so the end row is the wider of two
    // identically formatted rows.
    expect(px(getComputedStyle(endRow).width)).toBeGreaterThan(px(getComputedStyle(startRow).width));
  });
});

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

/** The visible month the open range grid shows, as RAC names it ("July 2026"). */
function visibleMonth(): string | null {
  return calendarGrid().getAttribute("aria-label");
}

/** Both rows' month, day and year segments, in reading order. */
function committedSegments(): string[] {
  return ["Start Date", "End Date"].flatMap((row) =>
    ["month", "day", "year"].map((part) => segmentNamed(`${part}, ${row}`).textContent)
  );
}

/**
 * A controlled range picker whose presets map a preset value to a range, as a caller
 * would. `onCalendarCommit` sees only what the picker itself commits (calendar or
 * segments), never the preset path, so a half range leaking out is observable.
 */
function PresetDrivenRangePicker({
  ranges,
  onCalendarCommit,
  placeholderValue,
  shouldCloseOnSelect,
}: {
  ranges: Record<string, CommittedRange>;
  onCalendarCommit?: (value: CommittedRange | null) => void;
  placeholderValue?: CalendarDate;
  shouldCloseOnSelect?: boolean;
}): ReactElement {
  const [value, setValue] = useState<CommittedRange | null>(null);
  return (
    <DateRangePicker
      label="Period"
      value={value}
      onChange={(next) => {
        onCalendarCommit?.(next);
        setValue(next);
      }}
      {...(placeholderValue && { placeholderValue })}
      {...(shouldCloseOnSelect !== undefined && { shouldCloseOnSelect })}
      presetGroup={
        <DateRangePickerPresetGroup onChange={(preset) => setValue(ranges[preset] ?? null)}>
          {Object.keys(ranges).map((preset) => (
            <DateRangePickerPresetItem key={preset} value={preset}>
              {preset}
            </DateRangePickerPresetItem>
          ))}
        </DateRangePickerPresetGroup>
      }
    />
  );
}

// The pane's divider geometry and the presets' inset come from `pickerVariants` and the
// shared preset group, which DatePicker's geometry suite measures for both pickers.
describe("DateRangePicker presets", () => {
  it("opens on a placeholder supplied through DateRangePickerContext", async () => {
    renderPicker(
      <DateRangePickerContext.Provider value={{ placeholderValue: new CalendarDate(2025, 3, 1) }}>
        <DateRangePicker label="Period" />
      </DateRangePickerContext.Provider>
    );
    await openPicker();

    expect(visibleMonth()).toMatch(/March\s+2025/i);
  });

  it.each([
    ["without presets", false],
    ["with presets", true],
  ] as const)(
    "keeps the grid and focus where a cross-month calendar selection ended (%s)",
    async (_case, withPresets) => {
      const onChange = rangeChangeSpy();
      renderPicker(
        <DateRangePicker
          label="Period"
          placeholderValue={july4}
          shouldCloseOnSelect={false}
          onChange={onChange}
          {...(withPresets && {
            presetGroup: (
              <DateRangePickerPresetGroup>
                <DateRangePickerPresetItem value="today">Today</DateRangePickerPresetItem>
              </DateRangePickerPresetGroup>
            ),
          })}
        />
      );
      await openPicker();

      await userEvent.click(dayNumbered(20));
      await userEvent.click(navButtonNamed(/next/i));
      expect(visibleMonth()).toMatch(/August\s+2026/i);
      await userEvent.click(dayNumbered(5));

      const committed = committedRange(onChange);
      expect([committed.start.toString(), committed.end.toString()]).toEqual(["2026-07-20", "2026-08-05"]);
      await expect.element(page.getByRole("dialog")).toBeVisible();
      expect(visibleMonth()).toMatch(/August\s+2026/i);
      expect(document.activeElement).toBe(dayNumbered(5));
    }
  );

  it("keeps a paged month when a preset commits an equal range, and resyncs when only the end changes", async () => {
    renderPicker(
      <PresetDrivenRangePicker
        ranges={{
          "Mid month": { start: july14, end: july24 },
          // An equal range built from fresh objects: the same committed value.
          "Same span": { start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 24) },
          // The very same start object, with a later end: a different committed value.
          "Into August": { start: july14, end: new CalendarDate(2026, 8, 5) },
        }}
      />
    );
    await openPicker();
    await userEvent.click(presetTargetNamed("Mid month"));
    expect(visibleMonth()).toMatch(/July\s+2026/i);

    await userEvent.click(navButtonNamed(/next/i));
    await userEvent.click(navButtonNamed(/next/i));
    expect(visibleMonth()).toMatch(/September\s+2026/i);

    await userEvent.click(presetTargetNamed("Same span"));
    expect(page.getByRole("radio", { name: "Same span", exact: true }).element()).toBeChecked();
    expect(visibleMonth()).toMatch(/September\s+2026/i);

    await userEvent.click(presetTargetNamed("Into August"));
    expect(committedSegments()).toEqual(["07", "14", "2026", "08", "05", "2026"]);
    expect(visibleMonth()).toMatch(/July\s+2026/i);
  });

  it("closes the dialog on double-click only where the caller opted in, after its own handler", async () => {
    const events: string[] = [];
    renderPicker(
      <DateRangePicker
        label="Period"
        defaultValue={julyWeek}
        onOpenChange={(isOpen) => events.push(isOpen ? "open" : "close")}
        presetGroup={
          <DateRangePickerPresetGroup>
            <DateRangePickerPresetItem value="today" onDoubleClick={() => events.push("double-click today")}>
              Today
            </DateRangePickerPresetItem>
            <DateRangePickerPresetItem
              value="this-month"
              isCloseDialogOnDoubleClick
              onDoubleClick={() => events.push("double-click this month")}>
              This month
            </DateRangePickerPresetItem>
          </DateRangePickerPresetGroup>
        }
      />
    );
    await openPicker();

    await userEvent.dblClick(presetTargetNamed("Today"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(events).toEqual(["open", "double-click today"]);

    await userEvent.dblClick(presetTargetNamed("This month"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(events).toEqual(["open", "double-click today", "double-click this month", "close"]);
  });
});
