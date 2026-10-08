import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { DateField } from "../date-field/date-field";
import { DatePicker } from "../date-picker/date-picker";
import { DateRangePicker } from "../date-range-picker/date-range-picker";
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

const DESCRIPTION = "Supporting copy.";

/** Pixels from the bottom of `upper`'s border box to the top of `lower`'s. */
function verticalGap(upper: Element, lower: Element): number {
  return lower.getBoundingClientRect().top - upper.getBoundingClientRect().bottom;
}

// Each place that renders the shared FieldError beside a Description, with its field box.
// DateRangePicker is listed beside DatePicker because its range grid lays out the shell's box.
const PLACED: ReadonlyArray<{
  name: string;
  field: (isInvalid: boolean) => ReactElement;
  box: () => HTMLElement;
}> = [
  {
    name: "DateField",
    field: (isInvalid) => (
      <DateField label="Due" description={DESCRIPTION} isInvalid={isInvalid} errorMessage={ERROR} />
    ),
    box: () => roleNamed("group", "Due"),
  },
  {
    name: "DatePicker",
    field: (isInvalid) => (
      <DatePicker label="Due" description={DESCRIPTION} isInvalid={isInvalid} errorMessage={ERROR} />
    ),
    box: () => roleNamed("group", "Due"),
  },
  {
    name: "DateRangePicker",
    field: (isInvalid) => (
      <DateRangePicker label="Due" description={DESCRIPTION} isInvalid={isInvalid} errorMessage={ERROR} />
    ),
    box: () => roleNamed("group", "Due"),
  },
  {
    name: "SearchField",
    field: (isInvalid) => (
      <SearchField label="Due" description={DESCRIPTION} isInvalid={isInvalid} errorMessage={ERROR} />
    ),
    box: () => roleNamed("searchbox", "Due"),
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

// Figma: a field in error shows its message directly under the field box, where the
// description sits otherwise, and the description moves below the message.
describe("react-aria field error placement", () => {
  it.each(PLACED)("puts $name's error in the description's place under its box", async ({ field, box }) => {
    const { unmount } = renderThemed(
      <UiProviders locale="en-US" navigate={() => undefined}>
        {field(false)}
      </UiProviders>
    );
    const restingGap = verticalGap(box(), page.getByText(DESCRIPTION).element());
    unmount();

    renderThemed(
      <UiProviders locale="en-US" navigate={() => undefined}>
        {field(true)}
      </UiProviders>
    );
    await expect.element(page.getByRole("alert")).toHaveTextContent(ERROR);
    const error = page.getByRole("alert").element();

    expect(verticalGap(box(), error)).toBeCloseTo(restingGap, 0);
    expect(verticalGap(error, page.getByText(DESCRIPTION).element())).toBeGreaterThanOrEqual(0);
  });
});
