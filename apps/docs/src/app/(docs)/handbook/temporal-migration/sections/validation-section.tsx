import type { ReactElement } from "react";

import { DemoFrame } from "../../../../../components/demo-frame";
import { ServerErrors } from "../demos/server-errors";

/** Fuse Form instead of React Aria's, the copy's locale, and the server-error checklist. */
export function ValidationSection(): ReactElement {
  return (
    <>
      <h2 id="validation">Validation and errors</h2>
      <p>
        The Temporal fields are Fields of Fuse&apos;s <code>Form</code>, not of React Aria&apos;s{" "}
        <code>Form</code>. A required, incomplete, out-of-bounds or unavailable value blocks the submit and
        takes focus on its first segment, and an error the form returns under a field&apos;s <code>name</code>{" "}
        shows below it, takes focus the same way and stays until its value changes. The interim fields read
        React Aria&apos;s <code>FormValidationContext</code>; the new ones never do.
      </p>
      <ul>
        <li>
          <strong>Copy follows the locale provider.</strong> Validation messages come from Fuse&apos;s
          dictionaries in the <code>LocaleProvider</code>&apos;s locale, not the browser&apos;s language. The
          bound and unavailable messages are React Aria&apos;s words; the required (&quot;Please fill out this
          field.&quot;) and incomplete messages are Fuse&apos;s.
        </li>
        <li>
          <strong>
            <code>errorMessage</code> without <code>isInvalid</code>
          </strong>{" "}
          renders nothing while the value is valid and replaces the built-in message once validation fails, as
          before. With <code>isInvalid</code> it always shows.
        </li>
        <li>
          <strong>Custom rules</strong> go on a <code>Field.Root</code> <code>validate</code> around a{" "}
          <code>DateInput.Root</code>, or come back from the server as <code>errors</code>.
        </li>
      </ul>
      <h3 id="form-error-checklist">Checklist: server errors from a React Aria form</h3>
      <p>
        A bare interim picker inside React Aria&apos;s <code>&lt;Form validationErrors&gt;</code> received
        server errors through React Aria&apos;s context, with no props of its own. After the switch it will
        not. Before you switch a screen:
      </p>
      <ol>
        <li>
          Find every date picker or field rendered under a React Aria{" "}
          <code>&lt;Form validationErrors&gt;</code> that passes neither <code>isInvalid</code> nor{" "}
          <code>errorMessage</code>.
        </li>
        <li>
          Route each through Fuse&apos;s <code>Form errors</code>, keyed by the field&apos;s <code>name</code>{" "}
          (and <code>startName</code>/<code>endName</code> for a range), or pass <code>isInvalid</code> and{" "}
          <code>errorMessage</code> from your form library&apos;s field state.
        </li>
        <li>
          Look for sites that pass <code>errorMessage</code> without <code>isInvalid</code> and confirm they
          mean &quot;replace the built-in copy when invalid&quot;; to show a server error, pass{" "}
          <code>isInvalid</code> too.
        </li>
        <li>
          Add a browser test per screen in which a returned error appears under the picker and takes focus.
        </li>
      </ol>
      <DemoFrame
        section="handbook"
        slug="temporal-migration"
        id="server-errors"
        title="Server errors by name"
        file="server-errors.tsx">
        <ServerErrors />
      </DemoFrame>
    </>
  );
}
