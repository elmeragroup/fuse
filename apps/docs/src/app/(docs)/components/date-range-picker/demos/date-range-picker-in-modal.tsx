"use client";

import { CalendarDate } from "@internationalized/date";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DateRangePicker } from "@elmeragroup/fuse/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

/**
 * A range picker inside a dialog: the popover is a separate overlay layer, and clicking
 * the two endpoints inside it must never dismiss the dialog underneath. The `Dialog` gets
 * that for free — its dismissal logic follows the React tree, so an interaction in the
 * portalled popover still counts as inside the dialog. That is why the picker cluster no
 * longer carries an overlay-container attribute of its own; the regression is pinned by the DateRangePicker browser suite, on this
 * exact composition. Both overlays portal into the nearest `ThemeScope`, so the popover
 * keeps the dialog's theme.
 */
export function DateRangePickerInModal() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Dialog.Root>
        <Dialog.Trigger render={<Button variant="outline">Edit order</Button>} />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Edit order</Dialog.Title>
            <Dialog.Description>Pick a delivery window without losing this dialog.</Dialog.Description>
          </Dialog.Header>
          <DateRangePicker
            label="Delivery window"
            defaultValue={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) }}
          />
        </Dialog.Content>
      </Dialog.Root>
    </UiProviders>
  );
}
