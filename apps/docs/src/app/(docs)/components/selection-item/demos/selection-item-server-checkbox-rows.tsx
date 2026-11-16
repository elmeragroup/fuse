import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

// A "use client" module whose row renders CheckboxItem around the children below.
import { AddOnRow } from "./client/plan-rows";

export function SelectionItemServerCheckboxRows() {
  return (
    <CheckboxItemGroup label="Add-ons">
      <AddOnRow value="price-alerts">
        <CheckboxItem.Title>Price alerts</CheckboxItem.Title>
        <CheckboxItem.SubSection>A text message when the spot price passes 2 kr/kWh.</CheckboxItem.SubSection>
      </AddOnRow>
    </CheckboxItemGroup>
  );
}
