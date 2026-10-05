import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { DateField } from "../date-field/date-field";
import { DatePicker } from "../date-picker/date-picker";
import { SearchField } from "../search-field/search-field";
import { UiProviders } from "../ui-providers/ui-providers";

const ERROR = "Enter a value.";

// Each place that renders the shared FieldError, with the element RAC describes. DatePicker
// stands for the picker shell, which DateRangePicker renders its error through too.
const FIELDS: ReadonlyArray<{ name: string; field: ReactElement; host: () => HTMLElement }> = [
  {
    name: "DateField",
    field: <DateField label="Due" isInvalid errorMessage={ERROR} />,
    host: () => roleNamed("group", "Due"),
  },
  {
    name: "DatePicker",
    field: <DatePicker label="Due" isInvalid errorMessage={ERROR} />,
    host: () => roleNamed("group", "Due"),
  },
  {
    name: "SearchField",
    field: <SearchField label="Due" isInvalid errorMessage={ERROR} />,
    host: () => roleNamed("searchbox", "Due"),
  },
];

describe("react-aria FieldError", () => {
  it.each(FIELDS)(
    "announces $name's error as an alert that still describes the field",
    async ({ field, host }) => {
      renderThemed(
        <UiProviders locale="en-US" navigate={() => undefined}>
          {field}
        </UiProviders>
      );

      // Oracle: Fuse Field's error is an alert, and RAC describes the field by its error.
      await expect.element(page.getByRole("alert")).toHaveTextContent(ERROR);
      expect(describedTextsFor(host())).toContain(ERROR);
    }
  );
});
