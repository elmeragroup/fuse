import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

/**
 * Unit under test: the date input's naming in `date-input-naming.ts`. Oracle: the ARIA rules the
 * input documents, written out. A screen reader reads the group's description in id order, so the
 * value's own description comes before the consumer's describers and the Field's. An empty
 * describer list leaves the attribute off. A consumer's `aria-labelledby` names the group ahead of
 * its Field's label. Segment names are CLDR's German `dateTimeField` names, which no Fuse
 * dictionary holds.
 */
import "../../temporal-polyfill";
import type { FieldFormat } from "./date-field-format";
import { nameDateInput, segmentName } from "./date-input-naming";
import type { DateInputNamingOptions } from "./date-input-naming";
import { dateFieldStrings } from "./intl";

const strings = new LocalizedStringFormatter("en-US", dateFieldStrings);

const format: FieldFormat = {
  locale: "en-US",
  granularity: "day",
  hourCycle: "h12",
  forceLeadingZeros: false,
  timeZone: undefined,
  hideTimeZone: false,
  scope: "date-time",
};

function options(overrides: Partial<DateInputNamingOptions>): DateInputNamingOptions {
  return {
    strings,
    format,
    committed: null,
    zoneName: "",
    id: "start",
    ariaLabelledBy: undefined,
    ariaDescribedBy: undefined,
    fieldLabelId: undefined,
    fieldDescribedBy: undefined,
    ...overrides,
  };
}

const october5 = Temporal.PlainDate.from("2026-10-05");

describe("nameDateInput", () => {
  it.each([
    {
      case: "the value's description, then the consumer's, then the Field's",
      input: {
        committed: october5,
        ariaDescribedBy: "hint",
        fieldDescribedBy: "field-description field-error",
      },
      describedBy: "start-description hint field-description field-error",
    },
    {
      case: "the consumer's and the Field's while the input is empty",
      input: { ariaDescribedBy: "hint", fieldDescribedBy: "field-description" },
      describedBy: "hint field-description",
    },
    {
      case: "no empty describer",
      input: { committed: october5, ariaDescribedBy: "", fieldDescribedBy: "field-description" },
      describedBy: "start-description field-description",
    },
    {
      case: "no attribute when nothing describes the input",
      input: { ariaDescribedBy: "" },
      describedBy: undefined,
    },
  ])("describes the input by $case", ({ input, describedBy }) => {
    expect(nameDateInput(options(input)).describedBy).toBe(describedBy);
  });

  it("labels the input by the consumer's aria-labelledby ahead of its Field's label", () => {
    expect(nameDateInput(options({ ariaLabelledBy: "own", fieldLabelId: "field-label" })).labelledBy).toBe(
      "own"
    );
  });
});

describe("segmentName", () => {
  it.each([
    { type: "year", name: "Jahr" },
    { type: "month", name: "Monat" },
    { type: "day", name: "Tag" },
    { type: "hour", name: "Stunde" },
  ] as const)(
    "names a $type segment in a locale without a Fuse dictionary in that locale's words",
    ({ type, name }) => {
      expect(segmentName("de-DE", new LocalizedStringFormatter("de-DE", dateFieldStrings), type)).toBe(name);
    }
  );
});
