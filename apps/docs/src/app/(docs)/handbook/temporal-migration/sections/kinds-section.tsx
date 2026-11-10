import type { ReactElement } from "react";

const ZONED = `// An empty zoned field has no value to take a zone from: name it. onChange receives
// Temporal.ZonedDateTime | null.
<DatePickerField
  label="Delivery window starts"
  granularity="minute"
  timeZone="Europe/Oslo"
/>;`;

/** How a field picks its value kind and zone, and how bounds of other kinds compare. */
export function KindsSection(): ReactElement {
  return (
    <>
      <h2 id="kind-resolution">Kind resolution and time zones</h2>
      <p>
        A field holds one kind, <code>PlainDate</code>, <code>PlainDateTime</code> or{" "}
        <code>ZonedDateTime</code>, resolved in this order:
      </p>
      <ol>
        <li>
          The <code>value</code>, when it holds one. A zoned value&apos;s own zone wins over{" "}
          <code>timeZone</code>.
        </li>
        <li>
          The kind of a value the field held before, so clearing a field and typing again keeps its kind and
          zone. One exception: an emptied <code>PlainDate</code> field whose <code>granularity</code> later
          turns to a time takes the kind the next steps give, instead of throwing. A field whose kind no value
          has named, in a picker as well, follows <code>granularity</code> and <code>timeZone</code> in what
          it types and shows when they change.
        </li>
        <li>
          The <code>defaultValue</code>.
        </li>
        <li>
          <code>granularity</code>: <code>&quot;day&quot;</code> or none gives a <code>PlainDate</code>;{" "}
          <code>&quot;hour&quot;</code>, <code>&quot;minute&quot;</code> or <code>&quot;second&quot;</code> a{" "}
          <code>PlainDateTime</code>, or a <code>ZonedDateTime</code> in <code>timeZone</code> when you pass
          one.
        </li>
      </ol>
      <p>
        A time granularity on a <code>PlainDate</code> <code>value</code> or <code>defaultValue</code> is an
        error, as in React Aria. A zoned field that can start empty needs <code>timeZone</code>, which React
        Aria took from <code>placeholderValue</code>.
      </p>
      <pre>
        <code>{ZONED}</code>
      </pre>
      <p>
        The types follow the same order, so no call site passes a type argument. A <code>value</code> or{" "}
        <code>defaultValue</code> names the kind <code>onChange</code> and <code>isDateUnavailable</code>{" "}
        receive; without either, <code>granularity</code> and <code>timeZone</code> do, as in the last step. A
        prop whose type is a union, such as a <code>granularity</code> held in a variable or an optional{" "}
        <code>timeZone</code>, gives the union of the kinds it could make.
      </p>
      <p>
        <code>minValue</code> and <code>maxValue</code> take any kind, independent of the value&apos;s, and
        compare as React Aria compared them: a <code>PlainDate</code> value against each bound&apos;s
        wall-clock date; a <code>PlainDateTime</code> against the bound&apos;s wall clock, a{" "}
        <code>PlainDate</code> bound counting as its midnight; a <code>ZonedDateTime</code> as an instant,
        with a plain bound read in the value&apos;s zone. So a 20:15 New York value passes a plain 23:30
        maximum although it is 02:15 the next day in Oslo. Wall-clock times that fall in a DST gap or overlap
        resolve as <code>&quot;compatible&quot;</code>, and stepping an hour segment moves through real hours:
        the repeated hour comes twice, the missing one never.
      </p>
    </>
  );
}
