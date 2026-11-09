import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Locator } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { DATE_TIER_ADAPTERS, freezeDateTierClock } from "../../test/date-tier-parity-adapters";
import type {
  DateTierAdapter,
  ParityCalendarProps,
  ParityDateFieldProps,
  ParityDatePickerProps,
  ParityDateRangePickerProps,
  ParityRangeCalendarProps,
} from "../../test/date-tier-parity-adapters";
import { emulateReducedMotion } from "../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../test/themed-browser-render";
import type { QueryableRole } from "../../test/themed-browser-render";

/*
 * Date-tier parity: the consumer contract OrderModule's date tests lean on, run against every
 * implementation in `DATE_TIER_ADAPTERS`.
 *
 * Oracle: React Aria. Every literal below was read off the interim `react-aria/*` tier (React Aria
 * Components over `@internationalized/date`) in the en-US locale and written out by hand: roles,
 * accessible names, keyboard targets, validation copy and the committed ISO values. A second
 * implementation passes only by reproducing them. The scenarios take fixed dates and run under a
 * clock frozen at June 15, 2030 (`DATE_TIER_TODAY`). That is outside every month the other
 * scenarios show; only the today scenario and a valueless picker's popover show June 2030. So no
 * expectation depends on the real today or the machine's zone.
 *
 * Each scenario mounts a harness that prints the last committed value into an `<output>` named
 * "Committed value": the ISO string the adapter printed, `null` for a cleared value, or
 * `unchanged` while nothing has been committed since mount.
 */

const UNCHANGED = "unchanged";

/** U+2066 and U+2069, which React Aria wraps around a time so it reads left to right in any direction. */
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);

/**
 * The element with exactly this role and accessible name, inside `scope` (the page by default).
 * The retrying `Locator` counterpart of `roleNamed`, for assertions that wait.
 */
function named(role: QueryableRole, name: string, scope: Pick<Locator, "getByRole"> = page): Locator {
  return scope.getByRole(role, { name, exact: true });
}

/** The segment spinbutton React Aria names `<unit>, <label>`. */
function segment(unit: string, label: string): Locator {
  return named("spinbutton", `${unit}, ${label}`);
}

/** The harness's committed-value readout. */
function committed(): Locator {
  return named("status", "Committed value");
}

/**
 * An element's text as the screen and the accessibility tree read it: `textContent` without the
 * subtrees `hidden` removes from both. The Temporal tier's DateInput writes its "Selected Date: …"
 * description as a `hidden` span inside the group, where React Aria appends it to the body.
 */
function shownText(element: Element): string {
  return [...element.childNodes]
    .map((node) => {
      if (node instanceof Element) {
        return node.hasAttribute("hidden") ? "" : shownText(node);
      }
      return node.textContent;
    })
    .join("");
}

/** Every segment's visible text, in DOM order. */
function segmentTexts(): string[] {
  return page
    .getByRole("spinbutton")
    .elements()
    .map((element) => element.textContent);
}

/** Each named segment of the field labelled `label` shows exactly its text. */
async function expectSegments(label: string, texts: readonly (readonly [string, string])[]): Promise<void> {
  for (const [unit, text] of texts) {
    const target = segment(unit, label);
    await expect.element(target).toBeInTheDocument();
    expect(target.element().textContent).toBe(text);
  }
}

/** Click a segment, type `keys` into it, then Tab away so the field commits. */
async function retype(target: Locator, keys: string): Promise<void> {
  await userEvent.click(target);
  await userEvent.keyboard(keys);
  await userEvent.tab();
}

/** The named group's validity: valid with no bound copy, or invalid and showing exactly `copy`. */
async function assertValidity(groupName: string, copy: string | null): Promise<void> {
  const group = named("group", groupName);
  if (copy === null) {
    await expect.element(group).not.toHaveAttribute("data-invalid");
    expect(page.getByText(/^Value must be/).query()).toBeNull();
    return;
  }
  await expect.element(group).toHaveAttribute("data-invalid", "true");
  await expect.element(page.getByText(copy, { exact: true })).toBeVisible();
}

/** Wait for keyboard focus to land on the day button with exactly this accessible name. */
async function expectFocusOnDay(name: string): Promise<void> {
  await expect.element(named("button", name)).toHaveFocus();
}

/**
 * Put keyboard focus on one day without a pointer. A click would select the day, and a pointer
 * left over a range grid moves the range highlight, so keyboard scenarios start here.
 */
async function focusDay(name: string): Promise<void> {
  await userEvent.hover(roleNamed("button", "Before"));
  roleNamed("button", name).focus();
  await expectFocusOnDay(name);
}

async function openCalendar(name: string): Promise<void> {
  await userEvent.click(roleNamed("button", name));
  await expect.element(page.getByRole("dialog")).toBeVisible();
}

/** Reports a committed value: the adapter's ISO string, or `null` for a cleared one. */
type Commit = (value: string | null) => void;

/**
 * A button to start a Tab walk from, one surface, and an `<output>` that prints the surface's last
 * committed value: the ISO string, `null`, or `unchanged` since mount.
 */
function Harness({ children }: { children: (commit: Commit) => ReactNode }): ReactElement {
  const [value, setValue] = useState(UNCHANGED);
  return (
    <>
      <button type="button">Before</button>
      {children((next) => setValue(next ?? "null"))}
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

/** A preset pane whose checked item this component owns, as OrderModule's controlled presets do. */
function PresetPicker({
  DatePicker,
  ...props
}: Omit<ParityDatePickerProps, "presets"> & Pick<DateTierAdapter, "DatePicker">): ReactElement {
  const [preset, setPreset] = useState<string | null>("today");
  return (
    <DatePicker
      {...props}
      presets={{
        value: preset,
        onChange: setPreset,
        items: [
          { value: "today", label: "Today" },
          { value: "next-week", label: "Next week", isDisabled: true },
          { value: "in-two-weeks", label: "In two weeks" },
        ],
      }}
    />
  );
}

/** Mount each surface of one adapter inside its providers, the committed-value harness around it. */
function mountsFor(adapter: DateTierAdapter) {
  const { Providers, DatePicker, DateRangePicker, DateField, Calendar, RangeCalendar } = adapter;
  const render = (node: ReactNode): void => {
    renderThemed(<Providers>{node}</Providers>);
  };
  const mount = (surface: (commit: Commit) => ReactNode): void => render(<Harness>{surface}</Harness>);
  return {
    mountPicker: (props: Omit<ParityDatePickerProps, "onChange">) =>
      mount((commit) => <DatePicker {...props} onChange={commit} />),
    mountPresetPicker: (props: Omit<ParityDatePickerProps, "onChange" | "presets">) =>
      mount((commit) => <PresetPicker DatePicker={DatePicker} {...props} onChange={commit} />),
    mountRangePicker: (props: Omit<ParityDateRangePickerProps, "onChange">) =>
      mount((commit) => <DateRangePicker {...props} onChange={commit} />),
    mountCalendar: (props: Omit<ParityCalendarProps, "onChange">) =>
      mount((commit) => <Calendar {...props} onChange={commit} />),
    mountRangeCalendar: (props: Omit<ParityRangeCalendarProps, "onChange">) =>
      mount((commit) => <RangeCalendar {...props} onChange={commit} />),
    /** The bare field commits nothing a scenario reads, so it mounts without the harness. */
    mountField: (props: ParityDateFieldProps) => render(<DateField {...props} />),
  };
}

// Playwright waits for a target to stop moving before it clicks, so the popover's slide-in would
// cost every in-popover click its full duration. No scenario is about motion.
beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));
// Today is June 15, 2030 in every scenario (DATE_TIER_TODAY); the returned teardown thaws the clock.
beforeEach(freezeDateTierClock);

describe.each(DATE_TIER_ADAPTERS)("date-tier parity: $name", (adapter) => {
  const { mountPicker, mountPresetPicker, mountRangePicker, mountCalendar, mountRangeCalendar, mountField } =
    mountsFor(adapter);

  describe("date picker field", () => {
    it("names each segment spinbutton by its unit and the field label, in en-US order", async () => {
      mountPicker({ label: "Start date", defaultValue: "2026-10-05" });

      await expectSegments("Start date", [
        ["month", "10"],
        ["day", "05"],
        ["year", "2026"],
      ]);
      expect(segmentTexts()).toEqual(["10", "05", "2026"]);
    });

    it("commits March 15, 2008 from the digits 03152008 typed into an empty field", async () => {
      mountPicker({ label: "Birth date" });
      expect(segmentTexts()).toEqual(["mm", "dd", "yyyy"]);

      await userEvent.click(page.getByRole("spinbutton").first());
      await userEvent.keyboard("03152008");

      await expect.element(committed()).toHaveTextContent("2008-03-15");
      expect(segmentTexts()).toEqual(["03", "15", "2008"]);
      await expect.element(segment("year", "Birth date")).toHaveFocus();
    });

    it("deletes the last year digit with Backspace and commits the shorter year", async () => {
      // React Aria keeps a complete date complete while a segment shrinks: "200" is year 200.
      mountPicker({ label: "Birth date" });
      await userEvent.click(page.getByRole("spinbutton").first());
      await userEvent.keyboard("03152008{Backspace}");

      await expect.element(committed()).toHaveTextContent("0200-03-15");
      expect(segmentTexts()).toEqual(["03", "15", "200"]);
    });

    it("clears a segment with Backspace, keeps the last committed value, then moves to the previous segment", async () => {
      mountPicker({ label: "Start date", defaultValue: "2026-10-05" });
      await userEvent.click(segment("day", "Start date"));

      await userEvent.keyboard("{Backspace}");
      expect(segmentTexts()).toEqual(["10", "dd", "2026"]);
      await expect.element(segment("day", "Start date")).toHaveFocus();
      await expect.element(committed()).toHaveTextContent(UNCHANGED);

      await userEvent.keyboard("{Backspace}");
      await expect.element(segment("month", "Start date")).toHaveFocus();
      expect(segmentTexts()).toEqual(["10", "dd", "2026"]);
      await expect.element(committed()).toHaveTextContent(UNCHANGED);
    });

    it("names the field group by its label and keeps every segment inside the field-group slot", () => {
      mountPicker({ label: "Start date", defaultValue: "2026-10-05" });
      const group = roleNamed("group", "Start date");

      expect(group).not.toHaveAttribute("data-invalid");
      expect(group).toHaveAttribute("data-slot", "field-group");
      expect(group.querySelectorAll('[role="spinbutton"]')).toHaveLength(3);
    });

    it("marks the group invalid and shows the error copy when the consumer says so", async () => {
      mountPicker({
        label: "Start up date",
        description: "Weekdays only",
        errorMessage: "Pick a weekday",
        isInvalid: true,
        defaultValue: "2026-10-05",
      });

      await assertValidity("Start up date", "Pick a weekday");
      await expect.element(page.getByText("Weekdays only", { exact: true })).toBeVisible();
    });

    it("renders an explicit errorMessage without isInvalid only once its own validation fails, in place of the built-in copy", async () => {
      mountPicker({
        label: "Start date",
        errorMessage: "Pick a weekday",
        maxValue: "2026-10-31",
        defaultValue: "2026-10-05",
      });
      expect(page.getByText("Pick a weekday").query()).toBeNull();
      expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");

      await retype(segment("year", "Start date"), "2027");

      await assertValidity("Start date", "Pick a weekday");
      expect(page.getByText(/or earlier/).query()).toBeNull();
    });

    it("leaves an explicit errorMessage without isInvalid unrendered while the value is valid", async () => {
      mountPicker({ label: "Start date", errorMessage: "Pick a weekday", defaultValue: "2026-10-05" });
      await retype(segment("year", "Start date"), "2027");

      await expect.element(committed()).toHaveTextContent("2027-10-05");
      expect(page.getByText("Pick a weekday").query()).toBeNull();
      expect(roleNamed("group", "Start date")).not.toHaveAttribute("data-invalid");
    });

    it.each([
      ["2027", "2027-10-05", "Value must be 10/31/2026 or earlier."],
      ["2025", "2025-10-05", "Value must be 10/01/2026 or later."],
    ])("says why a typed year %s falls outside the bounds", async (year, value, copy) => {
      mountPicker({
        label: "Start date",
        minValue: "2026-10-01",
        maxValue: "2026-10-31",
        defaultValue: "2026-10-05",
      });
      await retype(segment("year", "Start date"), year);

      // An out-of-bounds value still commits; the field reports it invalid.
      await expect.element(committed()).toHaveTextContent(value);
      await assertValidity("Start date", copy);
    });
  });

  describe("date picker trigger and popover", () => {
    it("names the trigger Calendar plus the label and, placed at the start, tabs to it before the first segment", async () => {
      mountPicker({ label: "Start up date", triggerPlacement: "start", defaultValue: "2026-10-05" });
      const trigger = roleNamed("button", "Calendar Start up date");
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(roleNamed("group", "Start up date").querySelector("button, [role=spinbutton]")).toBe(trigger);

      await userEvent.click(roleNamed("button", "Before"));
      await userEvent.tab();
      expect(document.activeElement).toBe(trigger);
      await userEvent.tab();
      expect(document.activeElement).toBe(segment("month", "Start up date").element());
    });

    it("keeps the trigger after the last segment by default", async () => {
      mountPicker({ label: "Start date", defaultValue: "2026-10-05" });

      await userEvent.click(roleNamed("button", "Before"));
      await userEvent.tab();
      expect(document.activeElement).toBe(segment("month", "Start date").element());
      await userEvent.tab();
      await userEvent.tab();
      await userEvent.tab();
      expect(document.activeElement).toBe(roleNamed("button", "Calendar Start date"));
    });

    it("opens a dialog on the value's month, focuses the selected day, and commits a pressed day", async () => {
      mountPicker({ label: "Start up date", triggerPlacement: "start", defaultValue: "2026-10-05" });
      await openCalendar("Calendar Start up date");

      const dialog = named("dialog", "Calendar Start up date");
      await expect.element(dialog).toBeVisible();
      await expect.element(named("grid", "October 2026", dialog)).toBeVisible();
      await expect.element(named("heading", "October 2026", dialog)).toBeVisible();
      expect(roleNamed("button", "Calendar Start up date")).toHaveAttribute("aria-expanded", "true");
      await expectFocusOnDay("Monday, October 5, 2026 selected");
      await expect.element(named("button", "Previous", dialog)).toBeVisible();
      await expect.element(named("button", "Next", dialog).first()).toBeVisible();

      await userEvent.click(named("button", "Monday, October 12, 2026", dialog));

      await expect.element(committed()).toHaveTextContent("2026-10-12");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      expect(segmentTexts()).toEqual(["10", "12", "2026"]);
    });

    it("lists presets as radios inside labels, with the checked and disabled states the consumer set", async () => {
      mountPresetPicker({ label: "Start date" });
      expect(page.getByRole("radio").query()).toBeNull();
      await openCalendar("Calendar Start date");

      const pane = named("radiogroup", "Date presets");
      await expect.element(pane).toBeVisible();
      const today = named("radio", "Today", pane);
      const nextWeek = named("radio", "Next week", pane);
      const inTwoWeeks = named("radio", "In two weeks", pane);
      await expect.element(today).toBeChecked();
      await expect.element(nextWeek).toBeDisabled();
      await expect.element(inTwoWeeks).not.toBeChecked();

      const label = inTwoWeeks.element().closest("label");
      if (label === null) {
        throw new Error("expected the preset's label");
      }
      await userEvent.click(label);

      await expect.element(inTwoWeeks).toBeChecked();
      await expect.element(today).not.toBeChecked();
    });
  });

  describe("today", () => {
    it("prefixes the frozen today's day name with Today and leaves the other days plain", async () => {
      mountCalendar({ label: "Delivery", defaultValue: "2030-06-10" });

      await expect.element(named("button", "Today, Saturday, June 15, 2030")).toBeVisible();
      await expect.element(named("button", "Sunday, June 16, 2030")).toBeVisible();
    });
  });

  describe("calendar keyboard", () => {
    it.each([
      ["{Home}", "Thursday, October 1, 2026", "Delivery, October 2026"],
      ["{End}", "Saturday, October 31, 2026", "Delivery, October 2026"],
      ["{PageUp}", "Monday, September 14, 2026", "Delivery, September 2026"],
      ["{PageDown}", "Saturday, November 14, 2026", "Delivery, November 2026"],
      ["{Shift>}{PageUp}{/Shift}", "Tuesday, October 14, 2025", "Delivery, October 2025"],
      ["{Shift>}{PageDown}{/Shift}", "Thursday, October 14, 2027", "Delivery, October 2027"],
      ["{End}{PageUp}", "Wednesday, September 30, 2026", "Delivery, September 2026"],
      ["{ArrowDown}{ArrowDown}{ArrowDown}", "Wednesday, November 4, 2026", "Delivery, November 2026"],
    ])("moves focus from October 14, 2026 with %s", async (keys, day, grid) => {
      mountCalendar({ label: "Delivery", defaultValue: "2026-10-14" });
      await focusDay("Wednesday, October 14, 2026 selected");

      await userEvent.keyboard(keys);

      await expectFocusOnDay(day);
      await expect.element(named("grid", grid)).toBeVisible();
      await expect.element(committed()).toHaveTextContent(UNCHANGED);
    });

    it("lets an unavailable date take focus but never selection", async () => {
      mountCalendar({ label: "Delivery", defaultValue: "2026-10-14", unavailableDates: ["2026-10-15"] });
      await focusDay("Wednesday, October 14, 2026 selected");

      await userEvent.keyboard("{ArrowRight}");
      await expectFocusOnDay("Thursday, October 15, 2026");
      expect(roleNamed("button", "Thursday, October 15, 2026")).toHaveAttribute("aria-disabled", "true");

      await userEvent.keyboard("{Enter}");
      // Playwright refuses an aria-disabled target unless forced; a pointer press is still a press.
      await userEvent.click(roleNamed("button", "Thursday, October 15, 2026"), { force: true });
      await expect.element(committed()).toHaveTextContent(UNCHANGED);

      await userEvent.keyboard("{ArrowRight}{Enter}");
      await expect.element(committed()).toHaveTextContent("2026-10-16");
    });

    it("names the first and last available dates, clamps Home, End and PageUp to them, and never focuses beyond", async () => {
      mountCalendar({
        label: "Delivery",
        defaultValue: "2026-10-14",
        minValue: "2026-10-10",
        maxValue: "2026-10-20",
      });
      expect(roleNamed("button", "Friday, October 9, 2026")).toHaveAttribute("aria-disabled", "true");
      expect(roleNamed("button", "Wednesday, October 21, 2026")).toHaveAttribute("aria-disabled", "true");
      await focusDay("Wednesday, October 14, 2026 selected");

      await userEvent.keyboard("{Home}");
      await expectFocusOnDay("Saturday, October 10, 2026, First available date");
      await userEvent.keyboard("{ArrowLeft}");
      await expectFocusOnDay("Saturday, October 10, 2026, First available date");
      await userEvent.keyboard("{End}");
      await expectFocusOnDay("Tuesday, October 20, 2026, Last available date");
      await userEvent.keyboard("{ArrowRight}");
      await expectFocusOnDay("Tuesday, October 20, 2026, Last available date");
      await userEvent.keyboard("{PageUp}");
      await expectFocusOnDay("Saturday, October 10, 2026, First available date");

      await userEvent.click(roleNamed("button", "Friday, October 9, 2026"), { force: true });
      await expect.element(committed()).toHaveTextContent(UNCHANGED);
    });
  });

  describe("range selection", () => {
    it("anchors on the first Enter, advances focus a day, highlights to the focused day, and drops the anchor on Escape", async () => {
      mountRangeCalendar({ label: "Stay", defaultValue: { start: "2026-10-05", end: "2026-10-09" } });
      const selectedDays = () =>
        page
          .getByRole("gridcell")
          .elements()
          .filter((cell) => cell.getAttribute("aria-selected") === "true")
          .map((cell) => cell.textContent);
      expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
      await focusDay("Monday, October 12, 2026");

      // React Aria moves keyboard focus one day on after anchoring (useCalendarCell), so the
      // anchor alone already highlights two days.
      await userEvent.keyboard("{Enter}");
      await expectFocusOnDay("Tuesday, October 13, 2026 selected");
      expect(selectedDays()).toEqual(["12", "13"]);
      await userEvent.keyboard("{ArrowRight}");
      await expectFocusOnDay("Wednesday, October 14, 2026 selected");
      expect(selectedDays()).toEqual(["12", "13", "14"]);
      await expect.element(committed()).toHaveTextContent(UNCHANGED);

      await userEvent.keyboard("{Escape}");
      expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
      await expectFocusOnDay("Wednesday, October 14, 2026");
      await expect.element(committed()).toHaveTextContent(UNCHANGED);

      await userEvent.keyboard("{Enter}{ArrowRight}{Enter}");
      await expect.element(committed()).toHaveTextContent("2026-10-14..2026-10-16");
      expect(selectedDays()).toEqual(["14", "15", "16"]);
    });

    it("names the range ends with the whole selected range", async () => {
      mountRangeCalendar({ label: "Stay", defaultValue: { start: "2026-10-05", end: "2026-10-09" } });

      for (const name of [
        "Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected",
        "Tuesday, October 6, 2026 selected",
        "Selected Range: Monday, October 5 to Friday, October 9, 2026, Friday, October 9, 2026 selected",
      ]) {
        await expect.element(named("button", name)).toBeVisible();
      }
    });

    it("names both range picker rows on every segment and commits a range pressed in its popover", async () => {
      mountRangePicker({ label: "Period", defaultValue: { start: "2026-10-05", end: "2026-10-09" } });
      for (const row of ["Start Date", "End Date"]) {
        for (const unit of ["month", "day", "year"]) {
          await expect.element(segment(unit, `${row}, Period`)).toBeVisible();
        }
      }
      expect(segmentTexts()).toEqual(["10", "05", "2026", "10", "09", "2026"]);

      await openCalendar("Calendar Period");
      await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
      await expect.element(committed()).toHaveTextContent(UNCHANGED);
      await userEvent.click(roleNamed("button", "Thursday, October 22, 2026"));

      await expect.element(committed()).toHaveTextContent("2026-10-20..2026-10-22");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    });

    it("reports a cleared range once its start loses every segment, and keeps the end in its row", async () => {
      mountRangePicker({ label: "Period", defaultValue: { start: "2026-10-05", end: "2026-10-09" } });
      // Backspace empties the year a digit at a time, then each emptied segment hands focus back.
      await userEvent.click(segment("year", "Start Date, Period"));
      await userEvent.keyboard("{Backspace>10/}");
      await userEvent.tab();

      await expect.element(committed()).toHaveTextContent("null");
      expect(segmentTexts()).toEqual(["mm", "dd", "yyyy", "10", "09", "2026"]);
    });

    it("keeps the range picker's value when Escape drops an anchor and then closes the popover", async () => {
      mountRangePicker({ label: "Period", defaultValue: { start: "2026-10-05", end: "2026-10-09" } });
      await openCalendar("Calendar Period");
      await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));

      await userEvent.keyboard("{Escape}");
      await expectFocusOnDay("Tuesday, October 20, 2026");
      await userEvent.keyboard("{Escape}");

      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      await expect.element(committed()).toHaveTextContent(UNCHANGED);
      expect(segmentTexts()).toEqual(["10", "05", "2026", "10", "09", "2026"]);
    });
  });

  describe("time segments", () => {
    it("shows 24-hour hour and minute segments and no zone for a hidden-zone ZonedDateTime", async () => {
      mountPicker({
        label: "Starts",
        granularity: "minute",
        hourCycle: 24,
        hideTimeZone: true,
        defaultValue: "2026-10-12T14:30[Europe/Oslo]",
      });

      await expectSegments("Starts", [
        ["month", "10"],
        ["day", "12"],
        ["year", "2026"],
        ["hour", "14"],
        ["minute", "30"],
      ]);
      expect(segmentTexts()).toEqual(["10", "12", "2026", "14", "30"]);
      expect(shownText(roleNamed("group", "Starts"))).toBe(
        `10/12/2026, ${LEFT_TO_RIGHT_ISOLATE}14:30${POP_DIRECTIONAL_ISOLATE}`
      );
    });

    it("shows an AM/PM segment for a read-only CalendarDateTime under the en-US hour cycle", () => {
      mountField({
        label: "Delivered at",
        isReadOnly: true,
        granularity: "minute",
        defaultValue: "2026-10-12T14:30",
      });

      expect(segmentTexts()).toEqual(["10", "12", "2026", "02", "30", "PM"]);
      for (const unit of ["month", "day", "year", "hour", "minute", "AM/PM"]) {
        const field = segment(unit, "Delivered at").element();
        expect(field).toHaveAttribute("aria-readonly", "true");
        expect(field.tabIndex).toBe(0);
      }
    });
  });

  describe("bounds of mixed kinds", () => {
    // OrderModule's statistics page: ZonedDateTime values, a ZonedDateTime minimum and a
    // CalendarDateTime maximum at minute granularity. React Aria compares a ZonedDateTime against
    // a plain bound by reading the bound as wall-clock time in the value's own zone, and a
    // ZonedDateTime bound as an instant. Its copy prints the bound in the value's zone.
    const STATISTICS_PERIOD = {
      label: "Period",
      granularity: "minute",
      hourCycle: 24,
      hideTimeZone: true,
      minValue: "2026-10-01T00:00[Europe/Oslo]",
      maxValue: "2026-10-31T23:30",
    } as const;

    for (const { title, end, minute, committedEnd, copy } of [
      {
        title: "end at the maximum in Oslo",
        end: "2026-10-31T23:00[Europe/Oslo]",
        minute: "30",
        committedEnd: "2026-10-31T23:30:00+01:00[Europe/Oslo]",
        copy: null,
      },
      {
        title: "end past the maximum in Oslo",
        end: "2026-10-31T23:00[Europe/Oslo]",
        minute: "31",
        committedEnd: "2026-10-31T23:31:00+01:00[Europe/Oslo]",
        copy: "Value must be 10/31/2026, 23:30 or earlier.",
      },
      // 20:15 in New York is 01:15 on November 1 in Oslo; the plain maximum is read in New York.
      {
        title: "end before the maximum read in New York",
        end: "2026-10-31T20:00[America/New_York]",
        minute: "15",
        committedEnd: "2026-10-31T20:15:00-04:00[America/New_York]",
        copy: null,
      },
      {
        title: "end past the maximum read in New York",
        end: "2026-10-31T23:00[America/New_York]",
        minute: "31",
        committedEnd: "2026-10-31T23:31:00-04:00[America/New_York]",
        copy: "Value must be 10/31/2026, 23:30 or earlier.",
      },
    ]) {
      it(title, async () => {
        mountRangePicker({
          ...STATISTICS_PERIOD,
          defaultValue: { start: "2026-10-10T08:00[Europe/Oslo]", end },
        });
        await retype(segment("minute", "End Date, Period"), minute);

        await expect
          .element(committed())
          .toHaveTextContent(`2026-10-10T08:00:00+02:00[Europe/Oslo]..${committedEnd}`);
        await assertValidity("Period", copy);
      });
    }

    for (const { title, start, committedStart, copy } of [
      // 19:30 on September 30 in New York is 01:30 on October 1 in Oslo: after the zoned minimum.
      {
        title: "start after the zoned minimum as an instant",
        start: "2026-09-30T19:00[America/New_York]",
        committedStart: "2026-09-30T19:30:00-04:00[America/New_York]",
        copy: null,
      },
      // 17:30 in New York is 23:30 in Oslo, before midnight; the copy prints the minimum in New York.
      {
        title: "start before the zoned minimum as an instant",
        start: "2026-09-30T17:00[America/New_York]",
        committedStart: "2026-09-30T17:30:00-04:00[America/New_York]",
        copy: "Value must be 09/30/2026, 18:00 or later.",
      },
      {
        title: "start before the zoned minimum in its own zone",
        start: "2026-09-30T23:00[Europe/Oslo]",
        committedStart: "2026-09-30T23:30:00+02:00[Europe/Oslo]",
        copy: "Value must be 10/01/2026, 00:00 or later.",
      },
    ]) {
      it(title, async () => {
        mountRangePicker({
          ...STATISTICS_PERIOD,
          defaultValue: { start, end: "2026-10-20T08:00[Europe/Oslo]" },
        });
        await retype(segment("minute", "Start Date, Period"), "30");

        await expect
          .element(committed())
          .toHaveTextContent(`${committedStart}..2026-10-20T08:00:00+02:00[Europe/Oslo]`);
        await assertValidity("Period", copy);
      });
    }
  });
});
