import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../intl/locale-context";
import { Form } from "../form/form";
import { SelectField } from "./select-field";

describe("SelectField", () => {
  // Field.Root knows a name passed to it while rendering. A name only on Select.Root reaches the
  // Field in an effect, after the server has rendered the error slot empty.
  it("server-renders a Form error under its name in the first HTML", () => {
    const html = renderToString(
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(
          Form,
          { errors: { plan: "That plan is closed to new customers." } },
          createElement(SelectField, { label: "Plan", name: "plan", items: { basic: "Basic" } })
        ),
      })
    );
    expect(html).toContain("That plan is closed to new customers.");
  });
});
