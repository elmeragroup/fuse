// Formatted NumberField text, which Chromium and WebKit must write alike.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { NumberField } from "./number-field";

describe("NumberField formatting", () => {
  // en-US groups thousands with a comma by default; an undefined `formatOptions` keeps that default.
  it.each([
    { forwarded: "omitted", props: {} },
    { forwarded: "explicitly undefined", props: { formatOptions: undefined } },
  ])("shows the en-US default grouping with formatOptions $forwarded", ({ props }) => {
    renderThemed(withLocale("en-US", <NumberField label="Quantity" defaultValue={1234} {...props} />));
    expect(textboxNamed("Quantity")).toHaveProperty("value", "1,234");
  });
});
