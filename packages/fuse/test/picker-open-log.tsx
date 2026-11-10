import { useState } from "react";
import type { ReactElement } from "react";

import { DatePicker } from "../src/components/date-picker";
import { DateRangePicker } from "../src/components/date-range-picker";
import { withLocale } from "./locale-matrix";

/**
 * Both date pickers, each logging every `onOpenChange` as `open:reason` into a `log` named
 * "<Label> opens", for tests that open a picker by a tap and assert it stays open with exactly the
 * one change the tap made.
 */
export function PickersWithOpenLog(): ReactElement {
  const [single, setSingle] = useState<string[]>([]);
  const [range, setRange] = useState<string[]>([]);
  return withLocale(
    "en-US",
    <>
      <DatePicker.Root
        aria-label="Start date"
        defaultValue="2026-10-05"
        onOpenChange={(open, details) =>
          setSingle((lines) => [...lines, `${String(open)}:${details.reason}`])
        }>
        <DatePicker.Group>
          <DatePicker.Input />
          <DatePicker.Trigger />
        </DatePicker.Group>
        <DatePicker.Popup>
          <DatePicker.Calendar />
        </DatePicker.Popup>
      </DatePicker.Root>
      <div role="log" aria-label="Start date opens">
        {single.join(" | ")}
      </div>
      <DateRangePicker.Root
        aria-label="Stay"
        defaultValue={{ start: "2026-10-05", end: "2026-10-09" }}
        onOpenChange={(open, details) =>
          setRange((lines) => [...lines, `${String(open)}:${details.reason}`])
        }>
        <DateRangePicker.Group>
          <DateRangePicker.StartInput />
          <DateRangePicker.EndInput />
          <DateRangePicker.Trigger />
        </DateRangePicker.Group>
        <DateRangePicker.Popup>
          <DateRangePicker.Calendar />
        </DateRangePicker.Popup>
      </DateRangePicker.Root>
      <div role="log" aria-label="Stay opens">
        {range.join(" | ")}
      </div>
    </>
  );
}
