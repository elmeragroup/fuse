/**
 * A directive-free server page with selection rows whose SubSections cross Flight before a row
 * partitions them: `SelectionItem.Shell` written straight into the server tree, and
 * `CheckboxItem` and `RadioItem` rendered by a client component around children this page wrote.
 * `rsc-selection-item-server.ts` renders it through Flight, and `rsc-selection-item-ssr.ts`
 * renders it again with no Flight, as the oracle.
 */
import type { ReactElement } from "react";

import { Checkbox, CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";
import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

import { ClientCheckboxRow, ClientRadioRow } from "./rsc-selection-item-client.tsx";

/** The page as a server component renders it. */
export function SelectionItemPage(): ReactElement {
  return (
    <main>
      <CheckboxItemGroup label="Shell">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox value="meter" />}>
          <SelectionItem.Title>Meter reading</SelectionItem.Title>
          <SelectionItem.SubSection>Read every hour.</SelectionItem.SubSection>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox value="estimate" />}>
          <SelectionItem.Title>Estimated reading</SelectionItem.Title>
          {/* Empty, so it renders nothing and opens no band, on either side of Flight. */}
          <SelectionItem.SubSection>{null}</SelectionItem.SubSection>
        </SelectionItem.Shell>
      </CheckboxItemGroup>
      <CheckboxItemGroup label="Client checkbox">
        <ClientCheckboxRow>
          <CheckboxItem.Title>Fixed price</CheckboxItem.Title>
          <CheckboxItem.SubSection>Locked for 12 months.</CheckboxItem.SubSection>
        </ClientCheckboxRow>
      </CheckboxItemGroup>
      <RadioItemGroup label="Client radio">
        <ClientRadioRow>
          <RadioItem.Title>Spot price</RadioItem.Title>
          <RadioItem.SubSection>Follows the hourly market.</RadioItem.SubSection>
        </ClientRadioRow>
      </RadioItemGroup>
    </main>
  );
}
