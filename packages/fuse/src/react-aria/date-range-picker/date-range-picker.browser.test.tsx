import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate, isSameDay } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { DateRangePickerContext } from "react-aria-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { withLocale } from "../../../test/locale-matrix";
import {
  calendarGrid,
  calendarRoot,
  cellNumbered,
  dayNumbered,
  describedTextsFor,
  insetsWithin,
  navButtonNamed,
  paddingBox,
  ROW_VIEWPORT,
  segmentLocator,
  segmentNamed,
  STACKED_VIEWPORT,
  SUBPIXEL,
  unionBox,
} from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  cssVarColor,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { Dialog } from "../../components/dialog";
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
  return rangeFromCall(onChange, 0);
}

/**
 * The range a spy was called with on its last call. Typing a four-digit year commits a
 * valid range on every digit ("2", "20", "202", "2026"), so a typed range is judged by
 * where it landed, not by how many times RAC reported progress.
 */
function lastCommittedRange(onChange: RangeChangeSpy): CommittedRange {
  return rangeFromCall(onChange, onChange.mock.calls.length - 1);
}

function rangeFromCall(onChange: RangeChangeSpy, index: number): CommittedRange {
  const committed = onChange.mock.calls[index]?.[0];
  if (committed === undefined || committed === null) {
    throw new Error(`expected onChange call ${index} to have received a range`);
  }
  return committed;
}

const july4 = new CalendarDate(2026, 7, 4);
const july9 = new CalendarDate(2026, 7, 9);
const july14 = new CalendarDate(2026, 7, 14);
const july17 = new CalendarDate(2026, 7, 17);
const july20 = new CalendarDate(2026, 7, 20);
const july24 = new CalendarDate(2026, 7, 24);
const julyWeek = { start: july14, end: july17 };

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
    // The glyph is decoration; the button's own name carries the meaning.
    expect(trigger_.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("reports a range only once both rows are complete", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" onChange={onChange} />);
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();

    await userEvent.click(segmentNamed("month, Start Date"));
    await userEvent.keyboard("07142026");
    expect(segmentNamed("day, Start Date").textContent).toBe("14");
    // A half-filled range is not a range: RAC holds `onChange` until both ends exist.
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(segmentNamed("month, End Date"));
    await userEvent.keyboard("0717");
    expect(segmentNamed("day, End Date").textContent).toBe("17");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard("2026");
    expect(onChange).toHaveBeenCalled();
    // Every value RAC reports is a whole range — never a lone endpoint.
    for (const [reported] of onChange.mock.calls) {
      expect(reported?.start).toBeDefined();
      expect(reported?.end).toBeDefined();
    }
    const committed = lastCommittedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july17)).toBe(true);
    expect(committed).not.toBeInstanceOf(Event);
  });

  it.each([
    [
      "renders leading zeros on day and month in both rows by default",
      {},
      { "month, Start Date": "07", "day, Start Date": "04", "month, End Date": "07", "day, End Date": "09" },
    ],
    [
      "drops the leading zeros when a caller turns them off",
      { shouldForceLeadingZeros: false },
      { "month, Start Date": "7", "day, Start Date": "4", "day, End Date": "9" },
    ],
  ] as const)("%s", async (_title, props, segments) => {
    renderPicker(
      <DateRangePicker label="Delivery window" defaultValue={{ start: july4, end: july9 }} {...props} />
    );
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();

    for (const [segment, text] of Object.entries(segments)) {
      expect(segmentNamed(segment).textContent, segment).toBe(text);
    }
  });

  it("opens a named dialog holding the range grid and commits two clicked endpoints", async () => {
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

  it("cancels an in-progress selection on Escape and returns focus to the trigger", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} onChange={onChange} />);
    await openPicker();

    // Anchor a new range, then abandon it: the same Escape cancels the anchor and
    // dismisses the popover, so the committed range is untouched.
    await userEvent.click(dayNumbered(20));
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    // Focus restoration lands after the dismissal commits; under full-gate load the
    // synchronous read can observe the frame before it.
    await expect.poll(() => document.activeElement).toBe(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(segmentNamed("day, Start Date").textContent).toBe("14");
    expect(segmentNamed("day, End Date").textContent).toBe("17");
  });

  it("marks a reversed range invalid and associates a string errorMessage", async () => {
    const errorCopy = "The end date cannot precede the start date.";
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={{ start: july17, end: july14 }}
        validationBehavior="aria"
        errorMessage={errorCopy}
      />
    );
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();
    const group = groupNamed("Delivery window");
    const root = group.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DateRangePicker root");
    }

    expect(root).toHaveAttribute("data-invalid");
    expect(describedTextsFor(group)).toContain(errorCopy);
  });

  it("keeps a read-only picker inert: muted field, no editing, no popover", async () => {
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

    await userEvent.click(segmentNamed("day, Start Date"));
    await userEvent.keyboard("09");
    expect(segmentNamed("day, Start Date").textContent).toBe("14");

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

describe("DateRangePicker overlay containment", () => {
  it("portals into an explicit container when one is given", async () => {
    function WithContainer(): ReactElement {
      const container = useRef<HTMLDivElement>(null);
      return (
        <>
          <DateRangePicker container={container} label="Delivery window" defaultValue={julyWeek} />
          <div data-explicit-container="" ref={container} />
        </>
      );
    }
    renderPicker(<WithContainer />);
    const dialog = await openPicker();

    expect(dialog.closest("[data-explicit-container]")).not.toBeNull();
  });

  it("keeps a host Dialog open while the user picks both endpoints in the popover", async () => {
    const onOpenChange = vi.fn();
    function ControlledPicker(): ReactElement {
      const [value, setValue] = useState<{ start: CalendarDate; end: CalendarDate } | null>(julyWeek);
      return <DateRangePicker label="Delivery window" onChange={setValue} value={value} />;
    }
    renderPicker(
      <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content showCloseButton={false}>
          <Dialog.Header>
            <Dialog.Title>Order</Dialog.Title>
          </Dialog.Header>
          <ControlledPicker />
        </Dialog.Content>
      </Dialog.Root>
    );
    await expect.element(page.getByRole("dialog", { name: "Order" })).toBeVisible();
    await userEvent.click(trigger());
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();

    // Paging is an interaction that keeps the popover open: the host must survive it.
    await userEvent.click(navButtonNamed(/next/i));
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/August\s+2026/i);
    expect(onOpenChange).not.toHaveBeenCalled();

    // The anchoring click is the seam's real test: it lands in a portalled popover and
    // must not read as an interaction outside the host dialog.
    await userEvent.click(dayNumbered(3));
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Committing dismisses the picker's own popover — and nothing else.
    await userEvent.click(dayNumbered(6));
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).not.toBeInTheDocument();
    expect(segmentNamed("month, Start Date").textContent).toBe("08");
    expect(segmentNamed("day, Start Date").textContent).toBe("03");
    expect(segmentNamed("day, End Date").textContent).toBe("06");
    expect(onOpenChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog", { name: "Order" })).toBeVisible();
  });

  it("paints the shared state ring on the field group for keyboard focus at both densities", async () => {
    renderPicker(
      <>
        <button type="button">Before</button>
        <DateRangePicker label="Meter" defaultValue={julyWeek} />
      </>
    );
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();

    await assertStateFocusRingAtBothDensities(
      buttonNamed("Before"),
      segmentNamed("month, Start Date"),
      groupNamed("Meter")
    );
  });
});

describe("DateRangePicker density metrics", () => {
  it("keeps both dates and the trigger inside a narrow container at both densities", async () => {
    renderPicker(
      <div style={{ width: 240 }}>
        <DateRangePicker label="Narrow range" defaultValue={julyWeek} />
      </div>
    );
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const group = groupNamed("Narrow range");
      const bounds = group.getBoundingClientRect();
      expect(bounds.width).toBeLessThanOrEqual(240);
      for (const part of [...segmentRows("Narrow range"), trigger()]) {
        const rect = part.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
        expect(rect.right).toBeLessThanOrEqual(bounds.right);
        expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
      }
      const [start, end] = segmentRows("Narrow range");
      if (!start || !end) throw new Error("expected both dates");
      expect(end.getBoundingClientRect().top).toBeGreaterThan(start.getBoundingClientRect().top);
    }
    await userEvent.click(segmentNamed("day, Start Date"));
    await userEvent.keyboard("{ArrowUp}");
    expect(segmentNamed("day, Start Date").getAttribute("aria-valuenow")).toBe("15");
    await userEvent.click(trigger());
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
  });

  it("insets the en-dash by one md inset from each date at both densities", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const dash = separator("Delivery window").getBoundingClientRect();
      const beforeDash = dash.left - segmentNamed("year, Start Date").getBoundingClientRect().right;
      const afterDash = segmentNamed("month, End Date").getBoundingClientRect().left - dash.right;
      expect(Math.round(beforeDash)).toBe(CONTROL_MD[density].px);
      expect(Math.round(afterDash)).toBe(CONTROL_MD[density].px);
    }
  });
});

describe("DateRangePicker composition surface", () => {
  it("keeps a caller className on the root over the recipe's column layout", async () => {
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={julyWeek}
        className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      />
    );
    const root = groupNamed("Delivery window").parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DateRangePicker root");
    }

    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
    expect(px(getComputedStyle(root).rowGap)).toBe(8);
    await openPicker();
    expect(px(getComputedStyle(root).rowGap)).toBe(16);
  });

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

  it("wears the styled dialog chrome without its close button, and pads the calendar itself", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    const dialog = await openPicker();
    const root = calendarRoot();

    expect(dialog.getAttribute("data-slot")).toBe("dialog");
    // No `title` ⇒ no header row at all: an empty heading would take the dialog's
    // accessible name from RAC and spend one 16 px `gap-4` on nothing
    // (react-aria/internal/dialog.tsx).
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(root.closest('[role="dialog"]')).toBe(dialog);
    // `closeButton={false}`: the popover is dismissed by Escape or an outside click, so
    // the dialog chrome renders no dismiss affordance of its own.
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(getComputedStyle(dialog).paddingTop).toBe("0px");
    expect(getComputedStyle(dialog).paddingLeft).toBe("0px");
    // RangeCalendar's root is bare by design, so the inset is the recipe's own.
    expect(getComputedStyle(root).paddingTop).toBe("8px");
    expect(getComputedStyle(root).borderTopWidth).toBe("0px");
  });

  it("sizes the trigger glyph from the recipe rather than the Button's fallback", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    await expect.element(segmentLocator("month, Start Date")).toBeVisible();
    const glyph = trigger().querySelector("svg");
    if (!(glyph instanceof SVGElement)) {
      throw new Error("expected the trigger glyph");
    }

    expect(px(getComputedStyle(glyph).width)).toBe(16);
    expect(px(getComputedStyle(glyph).height)).toBe(16);
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

/** The pane wrapper the composite puts around the preset group and the calendar. */
function paneAroundCalendar(): HTMLElement {
  const pane = calendarRoot().parentElement;
  if (!(pane instanceof HTMLElement)) {
    throw new Error("expected the dialog's pane wrapper");
  }
  return pane;
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

function presetPicker(): ReactElement {
  return (
    <DateRangePicker
      label="Period"
      defaultValue={julyWeek}
      presetGroup={
        <DateRangePickerPresetGroup>
          <DateRangePickerPresetItem value="today">Today</DateRangePickerPresetItem>
          <DateRangePickerPresetItem value="last-7-days">Last 7 days</DateRangePickerPresetItem>
        </DateRangePickerPresetGroup>
      }
    />
  );
}

describe("DateRangePicker preset pane geometry", () => {
  afterEach(async () => {
    await page.viewport(STACKED_VIEWPORT.width, STACKED_VIEWPORT.height);
  });

  it("runs the row divider from the dialog's top edge to its bottom edge", async () => {
    await page.viewport(ROW_VIEWPORT.width, ROW_VIEWPORT.height);
    renderPicker(presetPicker());
    const inner = paddingBox(await openPicker());
    const column = roleNamed("radiogroup", "Date presets");
    const divider = column.getBoundingClientRect();

    expect(px(getComputedStyle(column).borderRightWidth)).toBeGreaterThan(0);
    expect(Math.abs(divider.top - inner.top)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.bottom - inner.bottom)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.left - inner.left)).toBeLessThanOrEqual(SUBPIXEL);
  });

  it("runs the stacked divider from the dialog's start edge to its end edge", async () => {
    await page.viewport(STACKED_VIEWPORT.width, STACKED_VIEWPORT.height);
    renderPicker(presetPicker());
    const inner = paddingBox(await openPicker());
    const column = roleNamed("radiogroup", "Date presets");
    const divider = column.getBoundingClientRect();

    expect(px(getComputedStyle(column).borderBottomWidth)).toBeGreaterThan(0);
    expect(Math.abs(divider.left - inner.left)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.right - inner.right)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.top - inner.top)).toBeLessThanOrEqual(SUBPIXEL);
  });

  it.each([
    ["row", ROW_VIEWPORT],
    ["stacked", STACKED_VIEWPORT],
  ])("insets the presets by at least 8px on every side of their column (%s)", async (_layout, viewport) => {
    await page.viewport(viewport.width, viewport.height);
    renderPicker(presetPicker());
    await openPicker();
    const items = unionBox([presetTargetNamed("Today"), presetTargetNamed("Last 7 days")]);
    const insets = insetsWithin(paddingBox(roleNamed("radiogroup", "Date presets")), items);

    expect(insets.top).toBeGreaterThanOrEqual(8 - SUBPIXEL);
    expect(insets.right).toBeGreaterThanOrEqual(8 - SUBPIXEL);
    expect(insets.bottom).toBeGreaterThanOrEqual(8 - SUBPIXEL);
    expect(insets.left).toBeGreaterThanOrEqual(8 - SUBPIXEL);
  });
});

describe("DateRangePicker presets", () => {
  it("lays a locale-named preset radiogroup beside the range calendar inside the dialog", async () => {
    renderPicker(
      <DateRangePicker
        label="Period"
        defaultValue={julyWeek}
        presetGroup={
          <DateRangePickerPresetGroup>
            <DateRangePickerPresetItem value="today">Today</DateRangePickerPresetItem>
            <DateRangePickerPresetItem value="last-7-days">Last 7 days</DateRangePickerPresetItem>
          </DateRangePickerPresetGroup>
        }
      />
    );
    const dialog = await openPicker();
    const radiogroup = page.getByRole("radiogroup", { name: "Date presets" }).element();
    if (!(radiogroup instanceof HTMLElement)) {
      throw new Error("expected the preset radiogroup");
    }

    expect(radiogroup.getAttribute("data-slot")).toBe("date-range-picker-preset-group");
    expect(presetTargetNamed("Today").getAttribute("data-slot")).toBe("date-range-picker-preset-item");
    await expect.element(page.getByRole("radio", { name: "Last 7 days", exact: true })).toBeVisible();
    // The group and the grid share one pane inside the dialog, the group first.
    const pane = paneAroundCalendar();
    expect(pane.closest('[role="dialog"]')).toBe(dialog);
    expect(radiogroup.parentElement).toBe(pane);
    expect(getComputedStyle(pane).display).toBe("flex");
  });

  it("draws the pane divider in the border role colour, not the text colour", async () => {
    renderPicker(
      <DateRangePicker
        label="Period"
        defaultValue={julyWeek}
        presetGroup={
          <DateRangePickerPresetGroup>
            <DateRangePickerPresetItem value="today">Today</DateRangePickerPresetItem>
          </DateRangePickerPresetGroup>
        }
      />
    );
    await openPicker();
    // The preset group is the pane's first child, so it carries the divider: on its
    // bottom edge while the panes stack, on its trailing edge once they sit side by side.
    const group = page.getByRole("radiogroup", { name: "Date presets" }).element();
    if (!(group instanceof HTMLElement)) {
      throw new Error("expected the preset radiogroup");
    }
    const groupStyle = getComputedStyle(group);
    const drawn = ["top", "right", "bottom", "left"].filter(
      (side) => px(groupStyle.getPropertyValue(`border-${side}-width`)) > 0
    );

    expect(drawn).toHaveLength(1);
    const color = groupStyle.getPropertyValue(`border-${drawn.join("")}-color`);
    expect(color).toBe(cssVarColor(group, "--border"));
    expect(color).not.toBe(groupStyle.color);
  });

  it("keeps the lone range calendar single-pane when the preset guard collapses to false", async () => {
    renderPicker(<DateRangePicker label="Period" defaultValue={julyWeek} presetGroup={false} />);
    await openPicker();
    const pane = paneAroundCalendar();
    const paneStyle = getComputedStyle(pane);

    expect(page.getByRole("radiogroup").query()).toBeNull();
    // None of the two-pane layout: no flex row, no inset, and no divider on any child.
    expect(paneStyle.display).toBe("block");
    expect(paneStyle.columnGap).toBe("normal");
    expect(paneStyle.paddingBottom).toBe("0px");
    for (const child of pane.children) {
      expect(getComputedStyle(child).borderLeftWidth).toBe("0px");
      expect(getComputedStyle(child).borderRightWidth).toBe("0px");
    }
  });

  it("lands each preset's range in both rows and follows it to its month with the popover open", async () => {
    renderPicker(
      <PresetDrivenRangePicker
        placeholderValue={new CalendarDate(2025, 3, 1)}
        ranges={{
          "Mid month": { start: july14, end: july24 },
          "Early November": { start: new CalendarDate(2026, 11, 3), end: new CalendarDate(2026, 11, 9) },
          "Year end": { start: new CalendarDate(2025, 12, 28), end: new CalendarDate(2026, 1, 3) },
        }}
      />
    );
    await openPicker();
    // The placeholder month, so every later month is the sync's doing and not the clock's.
    expect(visibleMonth()).toMatch(/March\s+2025/i);

    await userEvent.click(presetTargetNamed("Mid month"));
    expect(page.getByRole("radio", { name: "Mid month", exact: true }).element()).toBeChecked();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(visibleMonth()).toMatch(/July\s+2026/i);
    expect(committedSegments()).toEqual(["07", "14", "2026", "07", "24", "2026"]);
    expect(cellNumbered(14)).toHaveAttribute("aria-selected", "true");
    expect(cellNumbered(24)).toHaveAttribute("aria-selected", "true");

    await userEvent.click(presetTargetNamed("Early November"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(visibleMonth()).toMatch(/November\s+2026/i);
    expect(committedSegments()).toEqual(["11", "03", "2026", "11", "09", "2026"]);

    // Across a year boundary the grid follows the start, not the end.
    await userEvent.click(presetTargetNamed("Year end"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(visibleMonth()).toMatch(/December\s+2025/i);
    expect(committedSegments()).toEqual(["12", "28", "2025", "01", "03", "2026"]);
  });

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
    ["pointer", () => userEvent.click(presetTargetNamed("Mid month"))],
    [
      "keyboard",
      async () => {
        await userEvent.keyboard("{Tab}");
        expect(document.activeElement).toBe(
          page.getByRole("radio", { name: "First week", exact: true }).element()
        );
        await userEvent.keyboard("{ArrowDown}");
      },
    ],
  ] as const)(
    "drops a half-picked range rather than committing it when the user moves to the presets by %s",
    async (_input, moveToPreset) => {
      const onCalendarCommit = vi.fn<(value: CommittedRange | null) => void>();
      renderPicker(
        <PresetDrivenRangePicker
          onCalendarCommit={onCalendarCommit}
          placeholderValue={july4}
          ranges={{ "First week": { start: july4, end: july9 }, "Mid month": { start: july14, end: july24 } }}
        />
      );
      await openPicker();

      // Anchor a first endpoint, then leave the grid for the preset pane.
      await userEvent.click(dayNumbered(20));
      await moveToPreset();

      await expect.element(page.getByRole("dialog")).toBeVisible();
      expect(onCalendarCommit).not.toHaveBeenCalled();
      expect(page.getByRole("radio", { name: "Mid month", exact: true }).element()).toBeChecked();
      expect(committedSegments()).toEqual(["07", "14", "2026", "07", "24", "2026"]);
      expect(cellNumbered(20)).toHaveAttribute("aria-selected", "true");
    }
  );

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

  it("still moves the grid to a preset's month after a calendar commit in the same open", async () => {
    renderPicker(
      <PresetDrivenRangePicker
        placeholderValue={july4}
        shouldCloseOnSelect={false}
        ranges={{
          "Early November": { start: new CalendarDate(2026, 11, 3), end: new CalendarDate(2026, 11, 9) },
        }}
      />
    );
    await openPicker();
    await userEvent.click(dayNumbered(14));
    await userEvent.click(dayNumbered(24));
    expect(committedSegments()).toEqual(["07", "14", "2026", "07", "24", "2026"]);
    expect(visibleMonth()).toMatch(/July\s+2026/i);

    await userEvent.click(presetTargetNamed("Early November"));

    expect(visibleMonth()).toMatch(/November\s+2026/i);
  });

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

  it("forwards label and aria-label to the group name, the explicit aria-label first", async () => {
    const { unmount } = renderThemed(
      withLocale(
        "nb-NO",
        <DateRangePickerPresetGroup label="Hurtigvalg">
          <DateRangePickerPresetItem value="today">I dag</DateRangePickerPresetItem>
        </DateRangePickerPresetGroup>
      )
    );
    await expect.element(page.getByRole("radiogroup", { name: "Hurtigvalg", exact: true })).toBeVisible();
    unmount();

    renderThemed(
      withLocale(
        "nb-NO",
        <DateRangePickerPresetGroup label="Hurtigvalg" aria-label="Periode">
          <DateRangePickerPresetItem value="today">I dag</DateRangePickerPresetItem>
        </DateRangePickerPresetGroup>
      )
    );
    await expect.element(page.getByRole("radiogroup", { name: "Periode", exact: true })).toBeVisible();
    expect(page.getByRole("radiogroup", { name: "Hurtigvalg" }).query()).toBeNull();
  });
});
