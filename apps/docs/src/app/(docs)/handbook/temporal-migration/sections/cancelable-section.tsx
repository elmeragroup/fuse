import type { ReactElement } from "react";

import Link from "next/link";

const CANCEL = `<DatePicker.Root
  value={value}
  onValueChange={(next, details) => {
    // Hold the value while a save is in flight: a canceled day keeps the popup open with focus
    // on the day, and a canceled edit shows the value again in the segments.
    if (saving) {
      details.cancel();
      return;
    }
    setValue(next);
  }}>
  {/* Group, Input, Trigger, Popup, Calendar … */}
</DatePicker.Root>;`;

/** The parts' change details, a capability the interim tier had no counterpart for. */
export function CancelableSection(): ReactElement {
  return (
    <>
      <h2 id="cancelable-changes">Cancelable change details</h2>
      <p>
        New with the parts, with no React Aria equivalent. The Roots&apos; <code>onValueChange</code>,{" "}
        <code>onVisibleRangeChange</code> and <code>onOpenChange</code>, on whichever of{" "}
        <code>Calendar.Root</code>, <code>RangeCalendar.Root</code>, <code>DateInput.Root</code>,{" "}
        <code>DatePicker.Root</code> and <code>DateRangePicker.Root</code> has them, receive a details object
        after the new value. Every such details object has:
      </p>
      <ul>
        <li>
          <code>reason</code>: the gesture, such as <code>&quot;day-press&quot;</code>,{" "}
          <code>&quot;keyboard&quot;</code>, <code>&quot;input-change&quot;</code>,{" "}
          <code>&quot;input-paste&quot;</code>, <code>&quot;outside-press&quot;</code>,{" "}
          <code>&quot;focus-out&quot;</code>, <code>&quot;increment-press&quot;</code> or{" "}
          <code>&quot;preset-press&quot;</code>;
        </li>
        <li>
          <code>event</code>, the DOM event, and <code>trigger</code>, the element it happened on;
        </li>
        <li>
          <code>cancel()</code>, which refuses the change when called inside the callback, and{" "}
          <code>isCanceled</code>.
        </li>
      </ul>
      <p>
        A Root&apos;s <code>onValueChange</code> details add <code>getValidationError()</code>, which says why
        the new value fails the part&apos;s rules, or <code>null</code>. Every Root uses the same words:{" "}
        <code>&quot;rangeUnderflow&quot;</code> before <code>minValue</code>,{" "}
        <code>&quot;rangeOverflow&quot;</code> past <code>maxValue</code> and{" "}
        <code>&quot;unavailable&quot;</code> for <code>isDateUnavailable</code>; a range picker adds{" "}
        <code>&quot;rangeReversed&quot;</code>. The visible-range, open-change and preset details have no such
        method.
      </p>
      <p>
        The preset pane reports your preset key, not a date: <code>DatePicker.Presets</code> and{" "}
        <code>DateRangePicker.Presets</code> call <code>onValueChange(value, details)</code> with the key and
        details whose <code>reason</code> is <code>&quot;preset-press&quot;</code> and whose{" "}
        <code>trigger</code> is the preset&apos;s radio. Canceling keeps the checked preset as it was. A
        preset changes no date on its own: you map the key to a value and set the picker&apos;s{" "}
        <code>value</code>, so not setting it also refuses one.
      </p>
      <p>
        A canceled day keeps the value, the popup and focus on the day; a canceled commit of a held selection
        while the popup closes keeps the popup open with the selection held (see{" "}
        <a href="#pickers">pickers</a>); a canceled edit shows the value again in the segments; a canceled
        month change keeps the months shown; a canceled open change leaves the popup as it was. The labeled
        composites keep plain <code>onChange(value)</code>; reach for the parts when you need this. See{" "}
        <Link href="/components/temporal-date-picker#controlled">Temporal Date Picker</Link>.
      </p>
      <pre>
        <code>{CANCEL}</code>
      </pre>
    </>
  );
}
