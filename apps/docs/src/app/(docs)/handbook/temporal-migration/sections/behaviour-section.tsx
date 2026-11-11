import type { ReactElement, ReactNode } from "react";

import { MappingTable, c } from "./mapping-table";
import type { Row } from "./mapping-table";

const FROZEN_TODAY = `// Today is Date.now()'s date in the LocaleProvider's timeZone. Pin noon in that zone:
// <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo"> sees June 15 in every runtime zone.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2030-06-15T12:00:00+02:00")); // noon in Oslo (summer time)

// With no timeZone on the provider, today is the runtime zone's, and runtime-local noon works:
vi.setSystemTime(new Date("2030-06-15T12:00:00"));`;

const PARITY: readonly ReactNode[] = [
  'Segment spinbuttons named by unit and label ("month, Moving date"), in the locale\'s order; textboxes on iOS.',
  'en-US typing "03152008" commits 2008-03-15; Backspace deletes a digit and still commits; clearing a segment keeps the last value, and a second Backspace moves to the previous segment.',
  'The field group is named by its label, carries data-invalid, and holds every segment inside [data-slot="field-group"].',
  'React Aria\'s bound copy, word for word: "Value must be 10/01/2026 or later.", "Value must be 10/31/2026 or earlier."',
  <>
    errorMessage without isInvalid, as <a href="#validation">validation</a> describes.
  </>,
  'The trigger is named "Calendar <label>", has aria-haspopup="dialog", and with triggerPlacement="start" comes before the first segment in tab order.',
  'Opening shows a dialog named "Calendar <label>" on the value\'s month with the selected day focused; pressing a day commits it and closes.',
  "Presets are radios inside their labels, with the checked and disabled states you set.",
  "A range picker whose whole range loses an end reports null, and the other end stays in its input.",
  "Typing a range picker's start to its last segment moves on to the end's first segment, and Backspace in the end's first empty segment goes back to the start's last.",
  'Day buttons are named by the full date, "Monday, October 12, 2026", with "Today, " on today, ", First available date" and ", Last available date" on the bounds, and "Selected Range: …" on range ends.',
  "Arrows, Home/End (month start and end), PageUp/PageDown (a month, with Shift a year) and their clamping to the bounds; unavailable days take focus but never selection.",
  "A keyboard range anchors on Enter and moves focus a day; Escape drops the anchor first and closes the popover second, value unchanged.",
  "24-hour segments with hourCycle={24}, the AM/PM segment under en-US, hideTimeZone.",
  "Bounds of mixed kinds: a zoned bound compares as an instant, a plain bound as wall-clock time in the value's zone, and the copy prints the bound in the value's zone.",
];

const DIFFERENCES: readonly Row[] = [
  [
    <>Calendar root role</>,
    <>
      A {c("group")} named by its {c("aria-label")}/{c("aria-labelledby")}; React Aria&apos;s was an{" "}
      {c("application")} repeating the visible months. The grid&apos;s name is unchanged: &quot;Delivery,
      October 2026&quot;.
    </>,
  ],
  [
    <>Month buttons at a bound</>,
    <>Stay focused with {c('aria-disabled="true"')}; React Aria moved focus into the grid.</>,
  ],
  [
    <>Today marking and empty calendars</>,
    <>
      Today ({c("data-current")}, the &quot;Today, &quot; name prefix) is marked from the first client effect,
      never on the server. A calendar with neither {c("value")} nor {c("defaultValue")} renders each
      month&apos;s frame with empty days until then, hidden from assistive technology.
    </>,
  ],
  [
    <>Multi-month heading</>,
    <>
      Joined from the month names, the same in every engine: fi-FI writes &quot;lokakuu–joulukuu 2026&quot;.
      React Aria used {c("formatRange")}, which differs by engine.
    </>,
  ],
  [
    <>Selected-range description</>,
    <>
      en-US is React Aria&apos;s word for word; nb-NO, sv-SE and fi-FI no longer take the engine&apos;s range
      shape (sv-SE writes &quot;måndag 5 oktober&quot;, not &quot;05 oktober&quot;).
    </>,
  ],
  [
    <>Range pointer input</>,
    <>
      A click anchors and a second click completes; no dragging a range or its ends. Touch anchors at once. A
      press outside settles an open range when it is released, so a touch that scrolls the page leaves the
      range open. A press on an element that takes focus settles it through focus leaving first, with the
      reason {c('"focus-out"')}, as in React Aria. {c("commitBehavior")} has no {c('"clear"')}.
    </>,
  ],
  [
    <>Form control of a field</>,
    <>
      The first segment is the Field&apos;s control; the named input is a visually hidden {c('type="text"')}{" "}
      input holding the ISO text (React Aria&apos;s was a {c("hidden")} input). {c("Field.Label")} points at
      it and it refocuses the first segment.
    </>,
  ],
  [
    <>Incomplete and required</>,
    <>
      A half-typed field is invalid (&quot;Please enter a valid value. The field is incomplete or has an
      invalid date.&quot;), where React Aria submitted it empty. Both messages follow the locale provider (see{" "}
      <a href="#validation">validation</a>).
    </>,
  ],
  [
    <>Years and empty zones</>,
    <>
      Years run 1–9999 and wrap, with no era segment. An empty zoned field names its zone as it is today once
      it has mounted; the server writes the name for 2001-01-01 (CET in Oslo).
    </>,
  ],
  [
    <>Picker group text</>,
    <>
      The group&apos;s {c("textContent")} includes the hidden &quot;Selected Date: …&quot; description, which
      React Aria put at the end of the body.
    </>,
  ],
  [
    <>Time in the popup</>,
    <>
      The interim pickers had no time field in the popup; the composites now show one under the calendar for a
      time {c("granularity")}, as React Spectrum&apos;s pickers do. Composing the parts, add{" "}
      {c("DatePicker.TimeInput")}, or {c("DateRangePicker.StartTimeInput")} and{" "}
      {c("DateRangePicker.EndTimeInput")}. See <a href="#pickers">pickers</a>.
    </>,
  ],
  [
    <>Presets with a date</>,
    <>
      A preset may carry its date or range as {c("dateValue")}, which every press commits through the
      picker&apos;s {c("onValueChange")} with the reason {c('"preset-press"')}, also a press on the checked
      preset; the interim presets were only keys, as a preset without {c("dateValue")} still is. The checked
      preset stays the pane&apos;s key, as in the interim radio group: an uncontrolled pane clears it when the
      value changes any other way, and a controlled one is yours to clear.
    </>,
  ],
  [
    <>Single picker label</>,
    <>
      Pressing {c("DatePickerField")}&apos;s label focuses the first segment, also with{" "}
      {c('triggerPlacement="start"')}, where the interim picker focused the trigger. {c("triggerPlacement")}{" "}
      is a {c("DatePickerField")} prop only.
    </>,
  ],
];

const SELECTORS: readonly Row[] = [
  [c("[data-today]"), c("[data-current]"), <>On {c("Calendar.DayButton")}, present and empty.</>],
  [
    <>
      Day {c('[data-selected="true"]')}, {c('[data-selection-start="true"]')},{" "}
      {c('[data-selection-end="true"]')}, {c('[data-invalid="true"]')}, {c('[data-unavailable="true"]')},{" "}
      {c('[data-disabled="true"]')}, {c('[data-outside-month="true"]')}
    </>,
    <>Same names, present and empty</>,
    <>
      Match them by presence: {c("[data-selected]")} matches both tiers, {c('[data-selected="true"]')} only
      the interim one. Plus {c("[data-in-range]")} and {c("[data-highlighted]")} on range days. Every calendar
      writes {c("data-selected")}, {c("data-selection-start")}, {c("data-selection-end")},{" "}
      {c("data-in-range")}, {c("data-highlighted")} and {c("data-invalid")} on both the {c("gridcell")} and
      its button, where React Aria wrote them on the inner cell only, so scope a selector to the button with{" "}
      {c('[data-slot="calendar-day-button"]')}.
    </>,
  ],
  [
    <>
      Calendar root {c("[data-invalid]")}, {c("[data-disabled]")}
    </>,
    <>Same names, present and empty</>,
    <>
      On {c("Calendar.Root")} and {c("RangeCalendar.Root")}, which also write {c("data-readonly")}, new with
      the parts. The picker Root and group keep {c('data-invalid="true"')}.
    </>,
  ],
  [
    <>
      {c("[data-focused]")}, {c("[data-hovered]")}, {c("[data-pressed]")}, {c("[data-focus-visible]")}
    </>,
    <>Gone</>,
    <>
      Use {c(":focus")}, {c(":hover")}, {c(":active")}, {c(":focus-visible")}.
    </>,
  ],
  [
    <>Day cell {c('div[role="button"]')}</>,
    <>
      {c("<button>")} in a {c("gridcell")}
    </>,
    <>{c('getByRole("button", { name: "Monday, October 12, 2026" })')} still finds it.</>,
  ],
  [
    <>
      {c('[data-slot="date-picker-preset-group"]')}, {c('[data-slot="date-range-picker-preset-group"]')}
    </>,
    c('[data-slot="date-picker-presets"]'),
    <>Both pickers.</>,
  ],
  [c('[data-slot="date-range-picker-preset-item"]'), c('[data-slot="date-picker-preset-item"]'), null],
  [
    <>
      Preset item {c('[data-selected="true"]')}, {c('[data-disabled="true"]')}
    </>,
    <>
      {c("[data-checked]")}, {c("[data-disabled]")}, present and empty
    </>,
    <>The checked preset is {c("data-checked")}, as Base UI names a checked radio; match both by presence.</>,
  ],
  [
    <>
      {c('[data-slot="dialog"]')}, {c('[data-slot="dialog-content"]')} in the popover
    </>,
    c('[data-slot="date-picker-popup"]'),
    <>Still a {c("dialog")} named &quot;Calendar &lt;label&gt;&quot;.</>,
  ],
  [
    <>React Aria&apos;s date input and segments, with no {c("data-slot")}</>,
    <>
      {c('[data-slot="date-picker-input"]')} ({c('role="presentation"')}),{" "}
      {c('[data-slot="date-input-segment"]')}
    </>,
    <>
      {c('[data-slot="field-group"] [role="spinbutton"]')} still matches every segment, and each segment keeps
      its {c("data-type")}.
    </>,
  ],
  [
    <>Calendar parts</>,
    <>
      {c("calendar-*")} slots: {c("calendar-header")}, {c("calendar-day-grid")}, {c("calendar-day-button")} …
    </>,
    <>RangeCalendar uses Calendar&apos;s slots; its Root is {c("range-calendar")}.</>,
  ],
  [
    <>Range picker label, description and error ids</>,
    <>
      {c("DateRangePicker.Label")}, {c("DateRangePicker.Description")} and {c("DateRangePicker.Error")} put
      their text in an inner span with an id the Root owns; {c("aria-labelledby")} and {c("aria-describedby")}{" "}
      of the group, both ends and the trigger point there.
    </>,
    <>
      An {c("id")} you give the part stays on its outer element, so look elements up by role and name, not by
      following those references to your id. The error joins the descriptions whenever it renders. The
      references are in the server-rendered HTML when the parts sit in the Root&apos;s children, also nested
      in other elements&apos; children; a part rendered inside one of your own components joins them after
      mount. With only an {c("aria-label")}, the ends&apos; segments are named &quot;month, Start Date,
      Period&quot;, as in React Aria.
    </>,
  ],
];

/** What stays identical for consumers' tests, what differs on purpose, and the changed selectors. */
export function BehaviourSection(): ReactElement {
  return (
    <>
      <h2 id="behaviour-changes">Behaviour and selector changes</h2>
      <p>
        Fuse runs the same consumer-shaped scenarios against both tiers with the same literal expectations, so
        the contract below holds for your tests unchanged.
      </p>
      <h3 id="stays-identical">What stays identical</h3>
      <ul>
        {PARITY.map((line, index) => (
          // The lines are a fixed literal list; their order is their identity.
          <li key={index}>{line}</li>
        ))}
      </ul>
      <h3 id="divergences">Deliberate differences</h3>
      <MappingTable columns={["Area", "Temporal tier"]} rows={DIFFERENCES} />
      <h3 id="pickers">Pickers: held selections, focus and reset</h3>
      <ul>
        <li>
          <strong>Held selections.</strong> With a time <code>granularity</code>,{" "}
          <code>shouldCloseOnSelect={"{false}"}</code> and no value yet, the popup holds the selection, shown
          selected, instead of committing it: in <code>DatePickerField</code> the picked day, in{" "}
          <code>DateRangePickerField</code> the completed range. A time typed in the popup&apos;s time input
          (both ends&apos; for a range) commits it at that time, as React Aria waits for one; closing the
          popup first commits it at midnight in the field&apos;s kind. A time typed before any day waits for
          one. With <code>shouldCloseOnSelect</code> (the default), or a value already there, picks commit at
          once and keep the value&apos;s time and zone.
        </li>
        <li>
          <strong>Closing is one step.</strong> The held selection commits first, through{" "}
          <code>onValueChange</code> with the pick&apos;s own reason; canceling that commit keeps the popup
          open with the selection still held, and the close does not happen. Then <code>onOpenChange</code>{" "}
          reports the close, which can be canceled in turn. A parent that closes the popup by setting{" "}
          <code>open</code> to <code>false</code> commits the held selection the same way, through the{" "}
          <code>onValueChange</code> of the render that closes it; canceling it there leaves the value
          unchanged while the popup stays closed, as the parent asked.
        </li>
        <li>
          <strong>A changed value drops a held selection.</strong> When the value changes from elsewhere (a
          preset, typing, the parent) while a selection is held, the selection is dropped for good, also if
          the value later changes back.
        </li>
        <li>
          <strong>Form reset.</strong> A native reset of the surrounding form always resets the picker, also
          when the parent owns the value: it drops a held selection, starts the inputs and the calendar over
          (no half-typed segments or shown errors remain), and resets the Field&apos;s validity, touched and
          dirty state. The field keeps its kind and zone: an emptied time or zoned field still shows its time
          segments and zone afterwards.
        </li>
        <li>
          <strong>Disabled and read-only.</strong> A picker is disabled by <code>isDisabled</code> (the
          parts&apos; <code>disabled</code>), by a disabled enclosing Field, or by a disabled Fuse{" "}
          <code>Field.Set</code> around it, already in the server-rendered HTML and on the first render; it
          then disables its group, trigger, inputs and calendar. The presets are disabled while the picker is
          disabled or read-only, and so is the trigger.
        </li>
        <li>
          <strong>Focus and validation.</strong> An input and the popup are one place for focus. Moving from
          an input into the popup and back neither validates the input nor calls <code>onBlur</code>. Leaving
          the input for anywhere else validates it: Tab from the last segment to the trigger does, as in React
          Aria, and so does moving to the range&apos;s other end. A mouse press on the trigger keeps focus in
          the segment. Closing the popup returns focus to the segment it was opened from, or to the trigger
          when it was opened from there. <code>onBlur</code> is called exactly once when focus leaves the
          whole picker (its group with both range ends, and the popup), whether it leaves from a segment or
          from the popup.
        </li>
        <li>
          <strong>Keyboard chords.</strong> A key held with Ctrl, Meta or Alt does nothing on a calendar day
          (nor Shift, except with PageUp/PageDown for a year), and neither edits a segment nor moves between
          segments, also with the left and right arrows, so the browser and the platform keep those shortcuts.
          Enter or Space held down selects a day once. This holds in the calendars and fields as well as the
          pickers.
        </li>
      </ul>
      <h3 id="selectors">Attributes and slots</h3>
      <MappingTable columns={["Interim", "Temporal tier", "Notes"]} rows={SELECTORS} />
      <h3 id="testing-today">Pinning today in tests</h3>
      <p>
        The calendars read today from <code>Date.now()</code> in the <code>LocaleProvider</code>&apos;s{" "}
        <code>timeZone</code>, or the runtime&apos;s zone without one, never from <code>Temporal.Now</code>,
        which ignores a faked clock in Chromium. Fake <code>Date</code> alone, and pin a time that falls on
        the intended date in the zone the calendar reads: noon in the provider&apos;s zone, or runtime-local
        noon when the provider names none. Runtime-local noon under an Oslo provider is June 16 in Oslo on a
        Honolulu runner.
      </p>
      <pre>
        <code>{FROZEN_TODAY}</code>
      </pre>
    </>
  );
}
