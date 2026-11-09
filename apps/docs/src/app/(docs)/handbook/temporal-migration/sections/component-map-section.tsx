import type { ReactElement } from "react";

import Link from "next/link";

import { API_SECTION_ID } from "../../../../../lib/nav";
import { componentHref } from "../../../../../lib/pages";
import { MappingTable, c } from "./mapping-table";
import type { Row } from "./mapping-table";

const IMPORT_SWAP = `// Before: the interim tier
import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import type { CalendarDate } from "@internationalized/date";

<DatePicker<CalendarDate> label="Moving date" value={value} onChange={setValue} />;

// After: the Temporal tier
import { DatePickerField } from "@elmeragroup/fuse/date-picker";

<DatePickerField<Temporal.PlainDate> label="Moving date" value={value} onChange={setValue} />;`;

const PRESETS = `<DatePickerField<Temporal.PlainDate>
  label="Start date"
  value={value}
  onChange={setValue}
  presetGroup={
    <DatePicker.Presets value={preset} onValueChange={choosePreset}>
      <DatePicker.PresetItem value="next-monday" closeOnDoubleClick>
        Next Monday
      </DatePicker.PresetItem>
      <DatePicker.PresetItem value="new-year" disabled>
        New Year (closed)
      </DatePicker.PresetItem>
    </DatePicker.Presets>
  }
/>;`;

/** The component pages whose generated API reference lists every current prop. */
const API_PAGES = [
  ["DateField and DateInput", "temporal-date-field"],
  ["DatePickerField and DatePicker", "temporal-date-picker"],
  ["DateRangePickerField and DateRangePicker", "temporal-range-picker"],
  ["Calendar", "temporal-calendar"],
  ["RangeCalendar", "temporal-range-calendar"],
] as const;

const COMPONENT_MAP: readonly Row[] = [
  [
    c("@elmeragroup/fuse/react-aria/calendar"),
    <>
      {c("@elmeragroup/fuse/calendar")}: {c("Calendar.Root")} and its parts
    </>,
    <>
      No labeled composite. Compose {c("Calendar.Header")} (with {c("Calendar.DecrementMonth")},{" "}
      {c("Calendar.VisibleRangeHeading")}, {c("Calendar.IncrementMonth")}) and {c("Calendar.Months")}, which
      renders the standard month grids without children. The interim {c("errorMessage")} has no counterpart.
      Values are days: it takes a {c("Temporal.PlainDate")} or its ISO text and reports{" "}
      {c("Temporal.PlainDate")}s, where the interim calendar took and gave back date-times and zoned values
      with their time. Holding a date-time, use a picker, or put the time back yourself with{" "}
      {c("value.with({ year, month, day })")} from the picked day.
    </>,
  ],
  [
    c("@elmeragroup/fuse/react-aria/range-calendar"),
    <>
      {c("@elmeragroup/fuse/range-calendar")}: {c("RangeCalendar.Root")}
    </>,
    <>
      The other parts are Calendar&apos;s, re-exported on the namespace. Its ends are days too, as on{" "}
      {c("Calendar.Root")}.
    </>,
  ],
  [
    <>
      {c("@elmeragroup/fuse/react-aria/date-field")}: {c("DateField")}, {c("DateInput")}
    </>,
    <>
      {c("@elmeragroup/fuse/date-field")}: {c("DateField")} (labeled), {c("DateInput.Root")},{" "}
      {c("DateInput.Segment")}
    </>,
    <>Same two names from one entry.</>,
  ],
  [
    <>
      {c("@elmeragroup/fuse/react-aria/date-picker")}: {c("DatePicker")}
    </>,
    <>
      {c("@elmeragroup/fuse/date-picker")}: {c("DatePickerField")} (labeled), {c("DatePicker.*")} parts
    </>,
    <>
      The interim {c("DatePicker")} is now {c("DatePickerField")}; the name {c("DatePicker")} is the parts
      namespace.
    </>,
  ],
  [
    <>
      {c("@elmeragroup/fuse/react-aria/date-range-picker")}: {c("DateRangePicker")}
    </>,
    <>
      {c("@elmeragroup/fuse/date-range-picker")}: {c("DateRangePickerField")} (labeled),{" "}
      {c("DateRangePicker.*")} parts
    </>,
    <>Same rename as the single picker.</>,
  ],
  [
    <>
      {c("DatePickerPresetGroup")}, {c("DateRangePickerPresetGroup")}
    </>,
    <>
      {c("DatePicker.Presets")} (also {c("DateRangePicker.Presets")})
    </>,
    <>
      A {c("radiogroup")} of your keys, passed to {c("presetGroup")} as before.
    </>,
  ],
  [
    <>
      {c("DatePickerPresetItem")}, {c("DateRangePickerPresetItem")}
    </>,
    <>
      {c("DatePicker.PresetItem")} (also {c("DateRangePicker.PresetItem")})
    </>,
    <>A native radio inside its label.</>,
  ],
  [
    <>{c("@elmeragroup/fuse/react-aria/ui-providers")} around date components</>,
    <>{c("LocaleProvider")} only</>,
    <>
      The Temporal tier reads its locale and zone from {c("@elmeragroup/fuse/theme")}&apos;s{" "}
      {c("LocaleProvider")}; it needs no {c("UiProviders")}.
    </>,
  ],
];

/**
 * Every interim composite prop whose meaning, type or name changes, or that the composites no
 * longer take; the props each API reference lists beyond these keep their interim names.
 */
const COMPOSITE_CHANGES: readonly Row[] = [
  [
    <>
      {c("value")}, {c("defaultValue")}, {c("onChange")}
    </>,
    <>
      In: a Temporal object of any implementation or its ISO text. Out: this runtime&apos;s Temporal object.
      Range pickers still take and give {c("{ start, end }")}.
    </>,
  ],
  [
    <>
      {c("minValue")}, {c("maxValue")}
    </>,
    <>Any kind or ISO text, independent of the value&apos;s kind.</>,
  ],
  [c("isDateUnavailable"), <>Receives this runtime&apos;s Temporal value.</>],
  [c("errorMessage"), <>A node; React Aria&apos;s {c("(validation) => node")} function form is gone.</>],
  [
    <>{c("placeholderValue")}</>,
    <>
      Gone. The zone it gave an empty zoned field is the new {c("timeZone")} prop (see{" "}
      <a href="#kind-resolution">kind resolution</a>).
    </>,
  ],
  [
    <>{c("visibleDuration={{ months: n }}")} (React Aria; the interim tier left it out)</>,
    <>
      {c("visibleMonths")}, new on the pickers and calendars; one month by default. {c("pageBehavior")} keeps
      its name.
    </>,
  ],
  [
    <>{c("onBlur")} on the pickers</>,
    <>
      Called when focus leaves the whole picker, its group and its popup together; moving into the popup, to
      the trigger or between a range&apos;s ends is not a blur (see <a href="#pickers">pickers</a>).{" "}
      {c("DateField")} no longer takes {c("onBlur")}.
    </>,
  ],
  [c("className"), <>A string only; React Aria&apos;s function of the render state is gone.</>],
  [
    <>
      {c("validationBehavior")}, {c("validate")}
    </>,
    <>
      Not carried over. Validation is Fuse Form&apos;s; custom rules go on a {c("Field.Root")} {c("validate")}{" "}
      (see <a href="#validation">validation</a>).
    </>,
  ],
  [
    <>
      {c("id")}, {c("form")}, {c("style")}, {c("aria-labelledby")}, {c("aria-describedby")},{" "}
      {c("aria-details")}, {c("autoFocus")}, {c("autoComplete")}, {c("slot")}, {c("render")}, {c("children")},{" "}
      {c("dir")}, {c("lang")}, {c("hidden")}, {c("inert")}, {c("translate")}
    </>,
    <>
      Not carried over. The composites name themselves from {c("label")} or {c("aria-label")}; for {c("id")},{" "}
      {c("form")}, {c("style")}, {c("render")} or your own ARIA references, compose the parts:{" "}
      {c("DateInput.Root")}, {c("DatePicker.Root")} and {c("DateRangePicker.Root")} take a {c("div")}&apos;s
      props, {c("form")} and {c("render")}. {c("autoComplete")} and {c("slot")} have no counterpart.
    </>,
  ],
  [
    <>
      DOM event props: {c("onFocus")}, {c("onKeyDown")}, {c("onKeyUp")}, {c("onClick")}, the pointer, mouse,
      touch, wheel, scroll, animation and transition handlers and their {c("Capture")} forms
    </>,
    <>Not carried over. The Roots above take them as a {c("div")} does.</>,
  ],
  [
    <>{c("onFocusChange")}</>,
    <>
      Not carried over, and no Root takes it: it was React Aria&apos;s, not a DOM prop. Use the Root&apos;s{" "}
      {c("onFocus")}, with {c("onFocusLeave")} on {c("DatePicker.Root")} and {c("DateRangePicker.Root")} for
      focus leaving the whole picker, or {c("onBlur")} on {c("DateInput.Root")}. {c("onFocus")} and{" "}
      {c("onBlur")} bubble from every segment, so compare {c("event.relatedTarget")} with{" "}
      {c("event.currentTarget")} to tell entering or leaving the field as a whole.
    </>,
  ],
  [
    <>{c("shouldCloseOnSelect")} on the pickers</>,
    <>A boolean only; React Aria&apos;s {c("() => boolean")} function form is gone.</>,
  ],
  [
    <>{c("allowsNonContiguousRanges")} on the range picker</>,
    <>
      Not carried over; a range spans every day between its ends (see {c("isDateUnavailable")} on{" "}
      <a href="#part-props">part props</a>).
    </>,
  ],
];

const PART_PROPS: readonly Row[] = [
  [
    <>
      {c("onChange")} on {c("Calendar")}/{c("RangeCalendar")}
    </>,
    <>{c("onValueChange(value, details)")}</>,
    <>
      Parts use Base UI&apos;s names; the labeled composites keep {c("onChange(value)")}. See{" "}
      <a href="#cancelable-changes">cancelable change details</a>.
    </>,
  ],
  [
    <>
      {c("isDisabled")}, {c("isReadOnly")}
    </>,
    <>
      {c("disabled")}, {c("readOnly")}
    </>,
    <>On every Root.</>,
  ],
  [
    <>
      {c("isRequired")}, {c("isInvalid")}
    </>,
    <>
      {c("required")}, {c("invalid")}
    </>,
    <>
      On {c("DateInput.Root")}, {c("DatePicker.Root")} and {c("DateRangePicker.Root")}. {c("Calendar.Root")}{" "}
      and {c("RangeCalendar.Root")} take neither: they mark a selected value that fails their bounds or{" "}
      {c("isDateUnavailable")} invalid themselves, with {c("data-invalid")} on the Root and the day.
    </>,
  ],
  [
    <>
      {c("focusedValue")}, {c("defaultFocusedValue")}, {c("onFocusChange")}
    </>,
    <>{c("onVisibleRangeChange(start, details)")}</>,
    <>The focused day is internal; the visible months are reported.</>,
  ],
  [
    <>{c("commitBehavior")} on a range calendar</>,
    <>
      {c("commitBehavior")}: {c('"select"')} (default) or {c('"reset"')}
    </>,
    <>
      React Aria&apos;s {c('"clear"')} is not offered. A range picker with presets defaults to {c('"reset"')},
      as before.
    </>,
  ],
  [
    <>{c("isDateUnavailable(date)")} on a range calendar</>,
    <>{c("isDateUnavailable(date, anchor)")}</>,
    <>The anchor is the half-picked range&apos;s first day, or {c("null")}.</>,
  ],
  [
    <>
      Preset {c("isDisabled")}, {c("isCloseDialogOnDoubleClick")}
    </>,
    <>
      {c("disabled")}, {c("closeOnDoubleClick")}
    </>,
    <>
      On {c("DatePicker.PresetItem")}. The interim item&apos;s {c("description")} prop is gone.
    </>,
  ],
  [
    <>
      Preset group {c("value")}, {c("onChange(value)")}, {c("isDisabled")}, {c("label")}
    </>,
    <>
      {c("value")}, {c("onValueChange(value, details)")}, {c("disabled")}, {c("label")}
    </>,
    <>
      On {c("DatePicker.Presets")}; the value is still your preset key, and the details can cancel the press
      (see <a href="#cancelable-changes">cancelable change details</a>).
    </>,
  ],
  [
    <>React Aria render props and {c("className")} functions</>,
    <>
      {c("render")}, data attributes, and {c("className")} callbacks on the stateful picker parts
    </>,
    <>
      Each part passes its state to {c("render")} and writes it as data attributes. On the pickers,{" "}
      {c("DatePicker.Root")}, {c("DateRangePicker.Root")}, {c("DatePicker.Group")} and{" "}
      {c("DatePicker.PresetItem")} also take {c("className")} as a callback of their state (
      {c("DatePickerClassName<State>")}), while {c("DatePicker.Calendar")} and {c("DateRangePicker.Calendar")}{" "}
      take a string only. Each part&apos;s {c("className")} type is in its page&apos;s API reference.
    </>,
  ],
];

/** The import, component and prop maps from the interim tier to the Temporal tier. */
export function ComponentMapSection(): ReactElement {
  return (
    <>
      <h2 id="component-map">Component and import map</h2>
      <p>
        Each interim subpath has a Temporal entry. The labeled composites are the call-site replacements; the
        parts are new and follow Base UI&apos;s names.
      </p>
      <MappingTable columns={["Interim", "Temporal tier", "Notes"]} rows={COMPONENT_MAP} />
      <pre>
        <code>{IMPORT_SWAP}</code>
      </pre>

      <h3 id="composite-props">Labeled composite props</h3>
      <p>
        <code>DateField</code>, <code>DatePickerField</code> and <code>DateRangePickerField</code> keep the
        interim prop names: <code>label</code>, <code>description</code>, <code>isInvalid</code>,{" "}
        <code>isDisabled</code>, <code>isReadOnly</code>, <code>isRequired</code>, <code>name</code>,{" "}
        <code>granularity</code>, <code>hourCycle</code>, <code>hideTimeZone</code>,{" "}
        <code>firstDayOfWeek</code>, <code>presetGroup</code>, <code>triggerPlacement</code>,{" "}
        <code>startName</code>/<code>endName</code>, <code>size</code> and the rest. They no longer take React
        Aria&apos;s whole prop set, only their own: each page&apos;s generated API reference lists every
        current prop, and the table below lists every interim prop that changed or is gone.
      </p>
      <ul>
        {API_PAGES.map(([name, slug]) => (
          <li key={slug}>
            <Link href={`${componentHref(slug)}#${API_SECTION_ID}`}>{name}</Link>
          </li>
        ))}
      </ul>
      <p>
        The generic type argument moves to Temporal: <code>&lt;DatePicker&lt;CalendarDate&gt;&gt;</code>{" "}
        becomes <code>&lt;DatePickerField&lt;Temporal.PlainDate&gt;&gt;</code>, <code>CalendarDateTime</code>{" "}
        becomes <code>Temporal.PlainDateTime</code> and <code>ZonedDateTime</code> becomes{" "}
        <code>Temporal.ZonedDateTime</code>. <code>Temporal.PlainDate</code> is the default. Pass it whenever
        you pass ISO text alone: text names its kind only at runtime, so without it <code>onChange</code>{" "}
        receives the union of the three. What changes:
      </p>
      <MappingTable columns={["Interim", "Temporal tier"]} rows={COMPOSITE_CHANGES} />

      <h3 id="part-props">Part props</h3>
      <p>
        <code>Calendar.Root</code>, <code>RangeCalendar.Root</code>, <code>DateInput.Root</code>,{" "}
        <code>DatePicker.Root</code> and <code>DateRangePicker.Root</code> take Base UI&apos;s prop names and{" "}
        <code>render</code>.
      </p>
      <MappingTable columns={["Interim", "Temporal tier", "Notes"]} rows={PART_PROPS} />
      <pre>
        <code>{PRESETS}</code>
      </pre>
    </>
  );
}
