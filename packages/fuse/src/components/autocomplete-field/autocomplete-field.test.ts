import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../intl/locale-context";
import { Form } from "../form/form";
import { AutocompleteField } from "./autocomplete-field";

describe("AutocompleteField", () => {
  // Field.Root knows a name passed to it while rendering. A name only on Autocomplete.Root reaches
  // the Field in an effect, after the server has rendered the error slot empty.
  it("server-renders a Form error under its name in the first HTML", () => {
    const html = renderToString(
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(
          Form,
          { errors: { company: "Enter the registered name." } },
          createElement(AutocompleteField, { label: "Company", name: "company", items: ["Fjellkraft AS"] })
        ),
      })
    );
    expect(html).toContain("Enter the registered name.");
  });
});
