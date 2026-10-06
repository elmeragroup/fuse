import type { ComponentType, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { DatePickerPresetGroup, DatePickerPresetItem } from "../date-picker/date-picker";
import {
  DateRangePickerPresetGroup,
  DateRangePickerPresetItem,
} from "../date-range-picker/date-range-picker";

/** The `datePicker.presets` dictionary row, the default name both public groups share. */
const PRESETS_NAME = {
  "nb-NO": "Datoforvalg",
  "sv-SE": "Datumalternativ",
  "en-US": "Date presets",
  "fi-FI": "Päivämäärän pikavalinnat",
} as const;

const PUBLIC_GROUPS: ReadonlyArray<
  readonly [
    string,
    ComponentType<{ children: ReactNode }>,
    ComponentType<{ value: string; children: ReactNode }>,
  ]
> = [
  ["DatePickerPresetGroup", DatePickerPresetGroup, DatePickerPresetItem],
  ["DateRangePickerPresetGroup", DateRangePickerPresetGroup, DateRangePickerPresetItem],
];

describe("picker preset group name", () => {
  it.each(PUBLIC_GROUPS)(
    "%s takes its name from the dictionary in every shipped locale",
    async (_name, Group, Item) => {
      for (const locale of SUPPORTED_LOCALES) {
        const { unmount } = renderThemed(
          withLocale(
            locale,
            <Group>
              <Item value="today">Today</Item>
            </Group>
          )
        );
        await expect
          .element(page.getByRole("radiogroup", { name: PRESETS_NAME[locale], exact: true }))
          .toBeVisible();
        unmount();
      }
    }
  );
});
