import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../intl/locale-context";
import { Form } from "../form/form";
import { ComboboxField } from "./combobox-field";

describe("ComboboxField", () => {
  // Field.Root knows a name passed to it while rendering. A name only on Combobox.Root reaches the
  // Field in an effect, after the server has rendered the error slot empty.
  it("server-renders a Form error under its name in the first HTML", () => {
    const html = renderToString(
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(
          Form,
          { errors: { fruit: "We are out of that fruit." } },
          createElement(ComboboxField, { label: "Fruit", name: "fruit", items: ["Apple"] })
        ),
      })
    );
    expect(html).toContain("We are out of that fruit.");
  });
});
