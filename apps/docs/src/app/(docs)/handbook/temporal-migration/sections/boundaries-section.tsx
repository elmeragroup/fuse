import type { ReactElement } from "react";

import { DemoFrame } from "../../../../../components/demo-frame";
import { TemporalConversion } from "../demos/temporal-conversion";

const RSC = `// A server component: pass ISO text, never a Temporal object.
import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export default async function MovePage() {
  const order = await loadOrder(); // { movingDate: "2026-10-05" } from the database
  return <DatePickerField<Temporal.PlainDate> label="Moving date" name="moving" defaultValue={order.movingDate} />;
}`;

const URL_STATE = `import { createParser } from "nuqs";

// URL state holds the ISO text; the parser refuses anything Temporal refuses.
export const plainDateParser = createParser({
  parse(text) {
    try {
      return Temporal.PlainDate.from(text, { overflow: "reject" });
    } catch {
      return null;
    }
  },
  serialize: (date) => date.toString(),
  eq: (a, b) => a.equals(b),
});`;

/** ISO text across props, server components, forms and URLs, with the conversion demo. */
export function BoundariesSection(): ReactElement {
  return (
    <>
      <h2 id="boundaries">Values across boundaries</h2>
      <p>
        ISO text is the one form both libraries, every Temporal implementation and the wire agree on. Keep
        values as ISO strings wherever they leave a runtime, and convert at the edges.
      </p>
      <ul>
        <li>
          <strong>Props.</strong> Every value, default and bound takes a Temporal object from any
          implementation or its ISO text. Fuse re-reads each through <code>X.from(String(x))</code>, never{" "}
          <code>instanceof</code>, so a value from another copy of the polyfill works, and a zoned value keeps
          its exact instant. Callbacks hand back this runtime&apos;s objects. Only the ISO and Gregorian
          calendars are accepted: text or a value annotated with another calendar is refused.
        </li>
        <li>
          <strong>Instants are refused.</strong> Text with a <code>Z</code> or an offset but no bracketed
          zone, such as <code>2026-10-05T07:30:00Z</code> from a timestamp column or{" "}
          <code>Date#toISOString()</code>, names an instant, not a value of any kind, and the component throws
          a <code>TypeError</code> while rendering. Convert it first:{" "}
          {/* Wider than a phone's measure, so it breaks anywhere, as the mapping table's code does. */}
          <code className="box-decoration-clone wrap-anywhere">
            Temporal.Instant.from(text).toZonedDateTimeISO(tz).toString()
          </code>
          , the <code>parseAbsolute</code> recipe <a href="#date-api">above</a>.
        </li>
        <li>
          <strong>Server components.</strong> A Temporal object passed to a client component is serialized
          through its <code>toJSON</code>, its ISO text, with a development warning. Pass{" "}
          <code>toString()</code> yourself. Each composite renders on the server with ISO props; its parts are
          client components.
        </li>
        <li>
          <strong>Native form data, unchanged.</strong> A field&apos;s <code>name</code> submits its ISO text
          in the form&apos;s <code>FormData</code>, as the interim tier did; a range submits{" "}
          <code>startName</code> and <code>endName</code> separately, and a zoned value{" "}
          <code>2026-10-05T09:30:00+02:00[Europe/Oslo]</code>.
        </li>
        <li>
          <strong>Fuse Form, new.</strong> The interim fields were never Fields of Fuse&apos;s{" "}
          <code>Form</code>: their values were missing from <code>onFormSubmit</code>, their validation did
          not block a submit, and the form did not focus them for a returned error. The Temporal fields
          register as Fields, so their ISO text reaches <code>onFormSubmit</code> under their names and they
          take part in validation and focus (see <a href="#validation">validation</a>).
        </li>
        <li>
          <strong>URL state.</strong> Store the ISO text and parse it back with Temporal.
        </li>
      </ul>
      <pre>
        <code>{RSC}</code>
      </pre>
      <pre>
        <code>{URL_STATE}</code>
      </pre>
      <p>
        Code still on <code>@internationalized/date</code> meets the picker through the same text: hand it{" "}
        <code>calendarDate.toString()</code> and read the result back with{" "}
        <code>parseDate(value.toString())</code>.
      </p>
      <DemoFrame
        section="handbook"
        slug="temporal-migration"
        id="conversion"
        title="Temporal in, ISO out"
        file="temporal-conversion.tsx">
        <TemporalConversion />
      </DemoFrame>
    </>
  );
}
