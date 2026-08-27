"use client";

import { CalendarDate } from "@internationalized/date";

import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";
import { DatePicker } from "@elmeragroup/ui/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

/**
 * A picker inside a dialog: the popover is a separate overlay layer, and choosing a day
 * inside it must never dismiss the dialog underneath. The public base-ui `Dialog` gets
 * that for free — its dismissal logic follows the React tree, so an interaction in the
 * portalled popover still counts as inside the dialog. The library's private RAC `Modal`
 * has no such tracking and leans on the cluster's overlay-container attribute instead;
 * that seam is covered by the DatePicker browser suite rather than by this demo. Both
 * overlays portal into the nearest `ThemeScope`, so the popover keeps the dialog's theme.
 */
export function DatePickerInModal() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Dialog.Root>
        <Dialog.Trigger render={<Button variant="outline">Edit order</Button>} />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Edit order</Dialog.Title>
            <Dialog.Description>Pick a delivery date without losing this dialog.</Dialog.Description>
          </Dialog.Header>
          <DatePicker label="Delivery date" defaultValue={new CalendarDate(2026, 7, 14)} />
        </Dialog.Content>
      </Dialog.Root>
    </UiProviders>
  );
}
