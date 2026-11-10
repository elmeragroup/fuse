import type { ComponentType, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { DatePickerPresetGroup, DatePickerPresetItem } from "../date-picker/date-picker";
import {
  DateRangePickerPresetGroup,
  DateRangePickerPresetItem,
} from "../date-range-picker/date-range-picker";

type GroupProps = { children: ReactNode; label?: string; "aria-label"?: string };

const PUBLIC_GROUPS: ReadonlyArray<
  readonly [string, ComponentType<GroupProps>, ComponentType<{ value: string; children: ReactNode }>]
> = [
  ["DatePickerPresetGroup", DatePickerPresetGroup, DatePickerPresetItem],
  ["DateRangePickerPresetGroup", DateRangePickerPresetGroup, DateRangePickerPresetItem],
];

// `date-picker.test.ts` pins the `datePicker.presets` copy in every shipped locale; this
// suite proves both public groups read it in the active locale, and rank it last.
describe("picker preset group name", () => {
  it.each(PUBLIC_GROUPS)(
    "%s names itself from the dictionary, then label, then an explicit aria-label",
    async (_name, Group, Item) => {
      const cases: ReadonlyArray<readonly [Omit<GroupProps, "children">, string]> = [
        [{}, "Datoforvalg"],
        [{ label: "Hurtigvalg" }, "Hurtigvalg"],
        [{ label: "Hurtigvalg", "aria-label": "Periode" }, "Periode"],
      ];
      for (const [props, name] of cases) {
        const { unmount } = renderThemed(
          withLocale(
            "nb-NO",
            <Group {...props}>
              <Item value="today">I dag</Item>
            </Group>
          )
        );
        await expect.element(page.getByRole("radiogroup", { name, exact: true })).toBeVisible();
        unmount();
      }
    }
  );
});
